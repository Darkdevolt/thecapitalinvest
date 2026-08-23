/* ============================================================
   THE CAPITAL — NOYAU / ACCÈS AUX DONNÉES
   Seul chemin d'écriture et de lecture vers Supabase et vers les
   routes /api. Toute écriture est filtrée sur le schéma réel de la
   table : PostgREST rejette la requête entière dès qu'une colonne
   inconnue est envoyée, et ne signale que la première.
   ============================================================ */
'use strict';

(function (TC) {

    const E = TC.env;

    TC.session = { token: '', user: null };

    /* ── Session ─────────────────────────────────────────── */

    function readStored() {
        try {
            const raw = localStorage.getItem(E.SESSION_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) { return null; }
    }

    /** Trois formes de session coexistent selon le point d'entrée utilisé. */
    function unwrap(stored) {
        if (!stored) return { session: null, user: null };
        const session = (stored.data && stored.data.session) || stored.session || stored;
        const user = (stored.data && stored.data.user) || stored.user || (stored.id ? stored : null);
        return { session, user };
    }

    TC.loadSession = function () {
        const stored = readStored();
        const { session, user } = unwrap(stored);
        TC.session.token = (session && session.access_token) || '';
        TC.session.user = user;
        return TC.session.token ? TC.session : null;
    };

    TC.clearSession = function () {
        try { localStorage.removeItem(E.SESSION_KEY); } catch (e) { /* stockage indisponible */ }
        TC.session = { token: '', user: null };
    };

    /* Rafraîchissement borné : une panne du endpoint Auth ne peut plus
       immobiliser l'écran de démarrage indéfiniment. */
    async function refreshToken() {
        const stored = readStored();
        const { session } = unwrap(stored);
        const refresh = session && session.refresh_token;
        if (!refresh) return false;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        try {
            const r = await fetch(E.AUTH + '/token?grant_type=refresh_token', {
                method: 'POST',
                headers: { apikey: E.SUPABASE_ANON, 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refresh }),
                signal: controller.signal
            });
            const data = await r.json().catch(() => ({}));
            if (!r.ok || !data.access_token) return false;
            const target = (stored.data && stored.data.session) || stored.session || stored;
            target.access_token = data.access_token;
            target.refresh_token = data.refresh_token;
            target.expires_at = data.expires_at;
            localStorage.setItem(E.SESSION_KEY, JSON.stringify(stored));
            TC.session.token = data.access_token;
            return true;
        } catch (e) {
            if (e.name !== 'AbortError') console.warn('[TC] Rafraîchissement de session impossible', e);
            return false;
        } finally {
            clearTimeout(timer);
        }
    }

    /** Renouvelle le jeton deux minutes avant son expiration. */
    TC.ensureToken = async function () {
        const stored = readStored();
        const { session } = unwrap(stored);
        if (!session) return false;
        const expires = session.expires_at;
        if (expires && (Date.now() / 1000) > (expires - 120)) return await refreshToken();
        return !!session.access_token;
    };

    function headers(extra) {
        const base = {
            apikey: E.SUPABASE_ANON,
            Authorization: 'Bearer ' + TC.session.token,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
        };
        if (extra) Object.keys(extra).forEach(k => { base[k] = extra[k]; });
        return base;
    }

    /* ── Messages d'erreur exploitables ──────────────────── */

    function explain(payload, table, body) {
        const raw = String((payload && (payload.message || payload.details || payload.hint)) || 'Erreur inconnue');
        const ticker = body && (Array.isArray(body) ? body[0] && body[0].ticker : body.ticker);
        if (/foreign key/i.test(raw)) {
            return 'Ticker ' + (ticker ? '« ' + ticker + ' » ' : '') +
                'inconnu du référentiel. Créez d\'abord la société dans Entreprises.';
        }
        if (/duplicate|unique/i.test(raw)) {
            return 'Cette entrée existe déjà' + (ticker ? ' pour ' + ticker : '') + '. Utilisez Modifier plutôt qu\'Ajouter.';
        }
        if (/null value|not-null/i.test(raw)) return 'Un champ obligatoire est vide.';
        if (/Could not find the '([^']+)' column/i.test(raw)) {
            const col = raw.match(/Could not find the '([^']+)' column/i)[1];
            return 'La colonne « ' + col + ' » n\'existe pas dans la table ' + table + '.';
        }
        if (/invalid input syntax|numeric|integer|date/i.test(raw)) {
            return 'Valeur invalide : vérifiez les colonnes numériques et les dates. ' + raw.slice(0, 160);
        }
        if (/permission|policy|row-level/i.test(raw)) return 'Accès refusé par une règle RLS Supabase sur ' + table + '.';
        if (/relation .* does not exist/i.test(raw)) return 'La table ' + table + ' n\'existe pas dans Supabase.';
        if (/jwt|expired/i.test(raw)) return 'Session expirée. Reconnectez-vous.';
        return raw.slice(0, 200) + ' [' + table + ']';
    }

    /* ── Requête bas niveau avec réessai sur jeton expiré ── */

    async function request(url, options, timeoutMs) {
        await TC.ensureToken();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs || 20000);
        try {
            let r = await fetch(url, Object.assign({}, options, {
                headers: headers(options.headers), signal: controller.signal
            }));
            if (r.status === 401 && await refreshToken()) {
                r = await fetch(url, Object.assign({}, options, { headers: headers(options.headers) }));
            }
            return r;
        } finally { clearTimeout(timer); }
    }

    /* ── Lecture ─────────────────────────────────────────── */

    TC.get = async function (table, query) {
        try {
            const r = await request(E.REST + '/' + table + (query ? '?' + query : ''), { method: 'GET' });
            if (!r.ok) {
                const payload = await r.json().catch(() => ({}));
                TC.toast(explain(payload, table), 'err');
                return null;
            }
            return await r.json();
        } catch (e) {
            if (e.name !== 'AbortError') TC.toast('Réseau indisponible : ' + e.message, 'err');
            return null;
        }
    };

    /** Nombre exact de lignes, sans rapatrier les données. */
    TC.count = async function (table, filter) {
        try {
            const clean = filter ? String(filter).replace(/select=[^&]*/g, '').replace(/^&|&$/g, '') : '';
            const url = E.REST + '/' + table + '?select=*&limit=0' + (clean ? '&' + clean : '');
            const r = await request(url, { method: 'GET', headers: { Prefer: 'count=exact', Range: '0-0' } }, 12000);
            if (!r.ok) return { value: 0, ok: false, status: r.status };
            const range = r.headers.get('content-range') || '';
            return { value: parseInt(range.split('/')[1], 10) || 0, ok: true };
        } catch (e) { return { value: 0, ok: false, error: e.message }; }
    };

    /** Lecture paginée complète : PostgREST plafonne les réponses. */
    TC.getAll = async function (table, query, pageSize) {
        const size = pageSize || 1000;
        const out = [];
        for (let page = 0; page < 60; page++) {
            const from = page * size;
            const chunk = await TC.get(table, query + '&limit=' + size + '&offset=' + from);
            if (!chunk || !chunk.length) break;
            out.push.apply(out, chunk);
            if (chunk.length < size) break;
        }
        return out;
    };

    /* ── Écriture ────────────────────────────────────────── */

    /** Retire les colonnes absentes de la table et les valeurs vides. */
    const fit = TC.fit = function (row, table) {
        const allowed = TC.COLUMNS[table];
        if (!allowed) return row;
        const out = {};
        allowed.forEach(col => {
            if (Object.prototype.hasOwnProperty.call(row, col)) {
                const value = row[col];
                if (value !== undefined && value !== '') out[col] = value;
            }
        });
        return out;
    };

    TC.post = async function (table, body, onConflict) {
        const payload = Array.isArray(body) ? body.map(r => fit(r, table)) : fit(body, table);
        const conflict = onConflict === undefined ? TC.CONFLICT[table] : onConflict;
        const url = E.REST + '/' + table + (conflict ? '?on_conflict=' + conflict : '');
        const prefer = conflict
            ? 'return=representation,resolution=merge-duplicates'
            : 'return=representation';
        try {
            const r = await request(url, { method: 'POST', headers: { Prefer: prefer }, body: JSON.stringify(payload) }, 40000);
            if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                throw new Error(explain(err, table, body));
            }
            return await r.json();
        } catch (e) {
            if (e.name === 'AbortError') throw new Error('Délai dépassé pendant l\'écriture dans ' + table + '.');
            throw e;
        }
    };

    TC.patch = async function (table, filter, body) {
        try {
            const r = await request(E.REST + '/' + table + '?' + filter, {
                method: 'PATCH', body: JSON.stringify(fit(body, table))
            });
            if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                throw new Error(explain(err, table, body));
            }
            return await r.json();
        } catch (e) {
            if (e.name === 'AbortError') throw new Error('Délai dépassé pendant la mise à jour.');
            throw e;
        }
    };

    TC.del = async function (table, filter) {
        try {
            const r = await request(E.REST + '/' + table + '?' + filter, { method: 'DELETE' });
            if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                throw new Error(explain(err, table));
            }
            return true;
        } catch (e) {
            if (e.name === 'AbortError') throw new Error('Délai dépassé pendant la suppression.');
            throw e;
        }
    };

    /** Écriture par lots, avec réessai et compte rendu ligne par ligne. */
    TC.postBatched = async function (table, rows, onConflict, onProgress, batchSize) {
        const size = batchSize || 400;
        let done = 0;
        const failures = [];
        for (let i = 0; i < rows.length; i += size) {
            const slice = rows.slice(i, i + size);
            const batchNo = Math.floor(i / size) + 1;
            let lastError = null;
            let ok = false;
            for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
                try { await TC.post(table, slice, onConflict); ok = true; }
                catch (e) {
                    lastError = e;
                    if (attempt < 3) await new Promise(r => setTimeout(r, 700 * attempt));
                }
            }
            if (ok) done += slice.length;
            else failures.push({ batch: batchNo, rows: slice, error: lastError ? lastError.message : 'échec' });
            if (onProgress) onProgress({
                done, total: rows.length, batch: batchNo,
                size: slice.length, ok, error: lastError ? lastError.message : ''
            });
            await new Promise(r => setTimeout(r, 0));
        }
        return { imported: done, failures };
    };

    /* ── Routes serveur /api ─────────────────────────────── */

    TC.api = async function (path, options) {
        const opts = options || {};
        const h = Object.assign({ Accept: 'application/json' }, opts.headers || {});
        if (TC.session.token) h.Authorization = 'Bearer ' + TC.session.token;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), opts.timeout || 60000);
        try {
            const r = await fetch(path, Object.assign({}, opts, {
                headers: h, cache: 'no-store', signal: controller.signal
            }));
            const data = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(data.error || data.message || ('HTTP ' + r.status));
            return data;
        } finally { clearTimeout(timer); }
    };

    /* ── Référentiel des tickers, mis en cache pour la session ── */

    let refCache = null;

    TC.tickers = async function (force) {
        if (refCache && !force) return refCache;
        const rows = await TC.get('entreprises', 'select=ticker,nom,secteur,pays,compartiment,nombre_actions,nb_actions&order=ticker.asc&limit=1000');
        refCache = (rows || []).filter(r => r && r.ticker && !TC.isIndice(r.ticker));
        return refCache;
    };

    TC.tickerSet = async function () {
        const rows = await TC.tickers();
        return new Set(rows.map(r => String(r.ticker).toUpperCase()));
    };

    TC.invalidateTickers = function () { refCache = null; };

    /** Liste déroulante de suggestions partagée par tous les formulaires. */
    TC.tickerDatalist = async function (id) {
        const rows = await TC.tickers();
        let list = TC.el(id);
        if (!list) {
            list = document.createElement('datalist');
            list.id = id;
            document.body.appendChild(list);
        }
        list.innerHTML = rows.map(r =>
            '<option value="' + TC.esc(r.ticker) + '">' + TC.esc(r.nom || '') + '</option>').join('');
        return list;
    };

})(window.TC);
