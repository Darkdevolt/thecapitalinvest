/* ============================================================
   THE CAPITAL — NOYAU / ACCÈS AUX DONNÉES
   ============================================================ */
'use strict';

(function (TC) {
    const E = TC.env;
    TC.session = { token: '', user: null };

    function readStored() {
        try {
            const raw = localStorage.getItem(E.SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }
    function unwrap(stored) {
        if (!stored) return { session: null, user: null };
        const session = (stored.data && stored.data.session) || stored.session || stored;
        const user = (stored.data && stored.data.user) || stored.user || (stored.id ? stored : null);
        return { session, user };
    }
    TC.loadSession = function () {
        const { session, user } = unwrap(readStored());
        TC.session.token = (session && session.access_token) || '';
        TC.session.user = user;
        return TC.session.token ? TC.session : null;
    };
    TC.clearSession = function () {
        try { localStorage.removeItem(E.SESSION_KEY); } catch (e) {}
        TC.session = { token: '', user: null };
    };

    async function refreshToken() {
        const stored = readStored();
        const { session } = unwrap(stored);
        const refresh = session && session.refresh_token;
        if (!refresh) return false;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
            const r = await fetch(E.AUTH + '/token?grant_type=refresh_token', {
                method: 'POST', headers: { apikey: E.SUPABASE_ANON, 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refresh }), signal: controller.signal
            });
            const data = await r.json().catch(() => ({}));
            if (!r.ok || !data.access_token) return false;
            const target = (stored.data && stored.data.session) || stored.session || stored;
            target.access_token = data.access_token;
            if (data.refresh_token) target.refresh_token = data.refresh_token;
            if (data.expires_at) target.expires_at = data.expires_at;
            localStorage.setItem(E.SESSION_KEY, JSON.stringify(stored));
            TC.session.token = data.access_token;
            return true;
        } catch (e) { return false; }
        finally { clearTimeout(timer); }
    }
    TC.ensureToken = async function () {
        const { session } = unwrap(readStored());
        if (!session) return false;
        const expires = session.expires_at;
        if (expires && Date.now() / 1000 > expires - 120) return refreshToken();
        return !!session.access_token;
    };

    function headers(extra) {
        const base = { apikey: E.SUPABASE_ANON, Authorization: 'Bearer ' + TC.session.token, 'Content-Type': 'application/json', Prefer: 'return=representation' };
        if (extra) Object.keys(extra).forEach(k => { base[k] = extra[k]; });
        return base;
    }
    function explain(payload, table, body) {
        const raw = String((payload && (payload.message || payload.details || payload.hint)) || 'Erreur inconnue');
        const ticker = body && (Array.isArray(body) ? body[0] && body[0].ticker : body.ticker);
        if (/foreign key/i.test(raw)) return 'Ticker ' + (ticker ? '« ' + ticker + ' » ' : '') + 'inconnu du référentiel.';
        if (/duplicate|unique/i.test(raw)) return 'Cette entrée existe déjà' + (ticker ? ' pour ' + ticker : '') + '.';
        if (/null value|not-null/i.test(raw)) return 'Un champ obligatoire est vide.';
        if (/Could not find the '([^']+)' column/i.test(raw)) return 'La colonne demandée n’existe pas dans ' + table + '.';
        if (/permission|policy|row-level/i.test(raw)) return 'Accès refusé par une règle RLS Supabase sur ' + table + '.';
        if (/jwt|expired/i.test(raw)) return 'Session expirée. Reconnectez-vous.';
        return raw.slice(0, 240) + ' [' + table + ']';
    }

    /* Requête générique : timeout strict. Aucun fetch ne peut rester pendu. */
    async function request(url, options, timeoutMs) {
        const tokenOK = await TC.ensureToken();
        if (!tokenOK) throw Object.assign(new Error('SESSION_TOKEN_UNAVAILABLE'), { code: 'SESSION_TOKEN_UNAVAILABLE' });
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs || 8000);
        try {
            let r = await fetch(url, Object.assign({}, options, { headers: headers(options.headers), signal: controller.signal }));
            if (r.status === 401 && await refreshToken()) {
                r = await fetch(url, Object.assign({}, options, { headers: headers(options.headers), signal: controller.signal }));
            }
            return r;
        } catch (e) {
            if (e.name === 'AbortError') throw Object.assign(new Error('REQUEST_TIMEOUT'), { code: 'REQUEST_TIMEOUT', url });
            throw e;
        } finally { clearTimeout(timer); }
    }

    /* CRITIQUE : contrôle admin isolé. Uniquement 1 requête par ID/email,
       timeout 4 s, aucun fallback lent. */
    TC.checkAdmin = async function (user) {
        const started = performance.now();
        const userId = user && user.id;
        const email = user && user.email;
        if (!userId && !email) throw Object.assign(new Error('ADMIN_IDENTITY_MISSING'), { code: 'ADMIN_IDENTITY_MISSING' });
        const query = userId
            ? 'select=id,email,nom,is_admin&id=eq.' + encodeURIComponent(userId) + '&limit=1'
            : 'select=id,email,nom,is_admin&email=eq.' + encodeURIComponent(email) + '&limit=1';
        try {
            const r = await request(E.REST + '/users?' + query, { method: 'GET' }, 4000);
            const ms = Math.round(performance.now() - started);
            if (!r.ok) {
                const payload = await r.json().catch(() => ({}));
                const err = Object.assign(new Error(explain(payload, 'users')), { code: 'ADMIN_HTTP_' + r.status, status: r.status, duration_ms: ms });
                throw err;
            }
            const rows = await r.json();
            if (!Array.isArray(rows) || !rows.length) throw Object.assign(new Error('ADMIN_PROFILE_NOT_FOUND'), { code: 'ADMIN_PROFILE_NOT_FOUND', duration_ms: ms });
            return Object.assign(rows[0], { _admin_check_ms: ms });
        } catch (e) {
            e.duration_ms = e.duration_ms || Math.round(performance.now() - started);
            e.code = e.code || 'ADMIN_CHECK_FAILED';
            throw e;
        }
    };

    TC.get = async function (table, query, timeoutMs) {
        try {
            const r = await request(E.REST + '/' + table + (query ? '?' + query : ''), { method: 'GET' }, timeoutMs || 8000);
            if (!r.ok) { const payload = await r.json().catch(() => ({})); throw new Error(explain(payload, table)); }
            return await r.json();
        } catch (e) {
            if (e.name !== 'AbortError' && !/^REQUEST_TIMEOUT|SESSION_TOKEN/.test(e.code || '')) TC.toast('Erreur ' + table + ' : ' + e.message, 'err');
            throw e;
        }
    };
    TC.count = async function (table, filter) {
        try {
            const clean = filter ? String(filter).replace(/select=[^&]*/g, '').replace(/^&|&$/g, '') : '';
            const r = await request(E.REST + '/' + table + '?select=*&limit=0' + (clean ? '&' + clean : ''), { method: 'GET', headers: { Prefer: 'count=exact', Range: '0-0' } }, 8000);
            if (!r.ok) return { value: 0, ok: false, status: r.status };
            const range = r.headers.get('content-range') || '';
            return { value: parseInt(range.split('/')[1], 10) || 0, ok: true };
        } catch (e) { return { value: 0, ok: false, error: e.message, code: e.code }; }
    };
    TC.getAll = async function (table, query, pageSize) {
        const size = pageSize || 1000, out = [];
        for (let page = 0; page < 60; page++) {
            const chunk = await TC.get(table, query + '&limit=' + size + '&offset=' + page * size);
            if (!chunk || !chunk.length) break;
            out.push.apply(out, chunk);
            if (chunk.length < size) break;
        }
        return out;
    };
    const fit = TC.fit = function (row, table) {
        const allowed = TC.COLUMNS[table]; if (!allowed) return row;
        const out = {}; allowed.forEach(col => { if (Object.prototype.hasOwnProperty.call(row, col) && row[col] !== undefined && row[col] !== '') out[col] = row[col]; }); return out;
    };
    TC.post = async function (table, body, onConflict) {
        const payload = Array.isArray(body) ? body.map(r => fit(r, table)) : fit(body, table);
        const conflict = onConflict === undefined ? TC.CONFLICT[table] : onConflict;
        const url = E.REST + '/' + table + (conflict ? '?on_conflict=' + conflict : '');
        try {
            const r = await request(url, { method: 'POST', headers: { Prefer: conflict ? 'return=representation,resolution=merge-duplicates' : 'return=representation' }, body: JSON.stringify(payload) }, 40000);
            if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(explain(err, table, body)); }
            return await r.json();
        } catch (e) { if (e.code === 'REQUEST_TIMEOUT') throw new Error('Délai dépassé pendant l’écriture dans ' + table + '.'); throw e; }
    };
    TC.patch = async function (table, filter, body) {
        const r = await request(E.REST + '/' + table + '?' + filter, { method: 'PATCH', body: JSON.stringify(fit(body, table)) }, 15000);
        if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(explain(err, table, body)); }
        return r.json();
    };
    TC.del = async function (table, filter) {
        const r = await request(E.REST + '/' + table + '?' + filter, { method: 'DELETE' }, 15000);
        if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(explain(err, table)); }
        return true;
    };
    TC.postBatched = async function (table, rows, onConflict, onProgress, batchSize) {
        const size = batchSize || 400, failures = []; let done = 0;
        for (let i = 0; i < rows.length; i += size) {
            const slice = rows.slice(i, i + size); let lastError = null, ok = false;
            for (let attempt = 1; attempt <= 3 && !ok; attempt++) { try { await TC.post(table, slice, onConflict); ok = true; } catch (e) { lastError = e; if (attempt < 3) await new Promise(r => setTimeout(r, 700 * attempt)); } }
            if (ok) done += slice.length; else failures.push({ batch: Math.floor(i / size) + 1, rows: slice, error: lastError ? lastError.message : 'échec' });
            if (onProgress) onProgress({ done, total: rows.length, batch: Math.floor(i / size) + 1, size: slice.length, ok, error: lastError ? lastError.message : '' });
            await new Promise(r => setTimeout(r, 0));
        }
        return { imported: done, failures };
    };
    TC.api = async function (path, options) {
        const opts = options || {}, controller = new AbortController(), timer = setTimeout(() => controller.abort(), opts.timeout || 30000);
        try { const h = Object.assign({ Accept: 'application/json' }, opts.headers || {}); if (TC.session.token) h.Authorization = 'Bearer ' + TC.session.token; const r = await fetch(path, Object.assign({}, opts, { headers: h, cache: 'no-store', signal: controller.signal })); const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.error || data.message || ('HTTP ' + r.status)); return data; }
        finally { clearTimeout(timer); }
    };
    let refCache = null;
    TC.tickers = async function (force) { if (refCache && !force) return refCache; const rows = await TC.get('entreprises', 'select=ticker,nom,secteur,pays,compartiment,nombre_actions,nb_actions&order=ticker.asc&limit=1000', 8000); refCache = (rows || []).filter(r => r && r.ticker && !TC.isIndice(r.ticker)); return refCache; };
    TC.tickerSet = async function () { return new Set((await TC.tickers()).map(r => String(r.ticker).toUpperCase())); };
    TC.invalidateTickers = function () { refCache = null; };
    TC.tickerDatalist = async function (id) { const rows = await TC.tickers(); let list = TC.el(id); if (!list) { list = document.createElement('datalist'); list.id = id; document.body.appendChild(list); } list.innerHTML = rows.map(r => '<option value="' + TC.esc(r.ticker) + '">' + TC.esc(r.nom || '') + '</option>').join(''); return list; };
})(window.TC);
