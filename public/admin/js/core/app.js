/* ============================================================
   THE CAPITAL — NOYAU / APPLICATION
   Démarrage, contrôle des droits, registre des modules,
   navigation, palette de commandes et contrôle de santé.

   Chaque module s'enregistre lui-même par TC.register(). Aucun
   module n'injecte de bouton ni de panneau dans le DOM : l'ordre
   d'affichage et l'état actif sont décidés ici, une seule fois.
   ============================================================ */
'use strict';

(function (TC) {

    const modules = [];
    const byId = {};
    let current = '';

    const GROUPS = [
        { id: 'pilotage', label: 'Pilotage' },
        { id: 'marche', label: 'Données de marché' },
        { id: 'societes', label: 'Sociétés cotées' },
        { id: 'diffusion', label: 'Diffusion' },
        { id: 'gestion', label: 'Gestion' }
    ];

    /**
     * Enregistre un module.
     * { id, label, group, icon, view(): string, mount(): void, refresh(): void }
     */
    TC.register = function (module) {
        if (byId[module.id]) return;
        modules.push(module);
        byId[module.id] = module;
    };

    TC.module = id => byId[id];

    /* ============================================================
       JOURNAL DE DÉMARRAGE

       Un démarrage qui échoue doit dire où, depuis combien de temps
       et pourquoi. Chaque étape est horodatée ; les erreurs
       JavaScript et les rejets de promesse non traités sont captés
       dès le chargement de ce fichier, y compris ceux qui
       surviennent en dehors du fil du démarrage.
       ============================================================ */

    const T0 = Date.now();

    const journal = TC.journal = {
        app: 'The Capital Admin',
        startedAt: new Date().toISOString(),
        steps: [],
        errors: [],
        current: null,
        done: false,

        begin(step) {
            this.current = { step, startedAt: Date.now(), duration_ms: null, ok: null };
            this.steps.push(this.current);
            bootMsg(step.label || step.id);
            return this.current;
        },
        end(ok, extra) {
            if (!this.current) return;
            this.current.duration_ms = Date.now() - this.current.startedAt;
            this.current.ok = !!ok;
            if (extra) Object.assign(this.current, extra);
            console.log('[ADMIN BOOT]', this.current.step.id,
                (ok ? 'ok' : 'échec') + ' en ' + this.current.duration_ms + ' ms');
        },
        fail(code, message, extra) {
            this.errors.push(Object.assign({
                code, message,
                step: this.current ? this.current.step.id : null,
                at: new Date().toISOString()
            }, extra || {}));
            console.error('[ADMIN BOOT]', code, message);
        },
        lastSuccess() {
            const ok = this.steps.filter(s => s.ok === true);
            return ok.length ? ok[ok.length - 1].step.id : null;
        },
        report(code, message, extra) {
            return {
                app: this.app,
                code: code || (this.errors[0] && this.errors[0].code) || null,
                message: message || (this.errors[0] && this.errors[0].message) || null,
                step: this.current ? this.current.step.id : null,
                step_label: this.current ? this.current.step.label : null,
                duration_ms: Date.now() - T0,
                last_success: this.lastSuccess(),
                steps: this.steps.map(s => ({
                    id: s.step.id, endpoint: s.step.endpoint || null,
                    duration_ms: s.duration_ms, ok: s.ok, status: s.status || null
                })),
                errors: this.errors,
                startedAt: this.startedAt,
                time: new Date().toISOString(),
                online: navigator.onLine,
                url: location.href,
                userAgent: navigator.userAgent,
                extra: extra || null
            };
        }
    };

    window.addEventListener('error', function (e) {
        journal.fail('ADMIN_JS_ERROR', e.message || 'Erreur JavaScript',
            { source: e.filename, line: e.lineno, column: e.colno });
    });
    window.addEventListener('unhandledrejection', function (e) {
        const reason = e.reason;
        journal.fail('ADMIN_UNHANDLED_REJECTION',
            (reason && (reason.message || String(reason))) || 'Promesse rejetée sans traitement');
    });

    /* ── Écran de démarrage ──────────────────────────────── */

    function bootMsg(text) {
        const node = TC.el('boot-msg');
        if (node) node.textContent = text;
    }

    /**
     * Écran d'échec exploitable : code, étape, durée, motif, et de quoi
     * agir. Le rapport technique s'exporte en JSON pour être transmis.
     */
    function bootFatal(title, detail, code, options) {
        const opts = options || {};
        const report = journal.report(code, detail, opts.extra);
        const boot = TC.el('boot');
        if (!boot) return;

        boot.innerHTML =
            '<img src="' + TC.env.LOGO + '" alt="">' +
            '<div class="fatal">' +
            '<h2>' + TC.esc(title) + '</h2>' +
            '<p>' + TC.esc(detail) + '</p>' +
            '<p style="font-family:var(--mono);font-size:11px;color:var(--gold);margin-bottom:18px;">' +
            TC.esc(code || 'ADMIN_BOOT_ERROR') + ' · étape « ' + TC.esc(report.step_label || report.step || 'inconnue') +
            ' » · ' + report.duration_ms + ' ms' +
            (navigator.onLine ? '' : ' · hors ligne') + '</p>' +
            '<div style="display:flex;gap:9px;justify-content:center;flex-wrap:wrap;">' +
            '<button class="btn btn-primary" id="boot-retry">Réessayer</button>' +
            '<button class="btn btn-outline" id="boot-report">Rapport technique</button>' +
            (opts.hideRelogin ? '' : '<button class="btn btn-outline" id="boot-relogin">Se reconnecter</button>') +
            '</div></div>';
        boot.hidden = false;

        TC.el('boot-retry').addEventListener('click', () => location.reload());
        TC.el('boot-report').addEventListener('click', function () {
            TC.download('thecapital-admin-diagnostic.json',
                JSON.stringify(report, null, 2), 'application/json');
        });
        const relogin = TC.el('boot-relogin');
        if (relogin) relogin.addEventListener('click', function () {
            TC.clearSession();
            location.href = '/login.html';
        });
    }

    /* ============================================================
       VÉRIFICATION DES DROITS D'ADMINISTRATION

       Isolée du reste du démarrage, avec son propre délai maximal.
       Elle ne lève jamais d'exception : elle renvoie toujours un
       verdict lisible, ce qui garantit qu'aucun chemin ne peut
       laisser l'écran de démarrage tourner indéfiniment.
       ============================================================ */

    const ADMIN_CHECK_TIMEOUT = 5000;
    const ENDPOINT = '/rest/v1/users';

    TC.checkAdmin = async function (options) {
        const opts = options || {};
        const started = Date.now();
        const verdict = c => ({
            ok: false, code: c.code, message: c.message, profile: null,
            status: c.status || null, endpoint: ENDPOINT, duration_ms: Date.now() - started
        });

        if (!TC.loadSession()) {
            return verdict({ code: 'ADMIN_SESSION_MISSING', message: 'Aucune session enregistrée.' });
        }

        const user = TC.session.user;
        const userId = user && user.id;
        const userEmail = (user && user.email) || '';
        if (!userId && !userEmail) {
            return verdict({
                code: 'ADMIN_SESSION_MISSING',
                message: 'La session ne contient ni identifiant ni adresse de courriel.'
            });
        }

        /* Requête directe, hors TC.get : cette dernière absorbe les erreurs
           et affiche une notification, alors qu'ici le code HTTP exact est
           l'information utile. */
        async function fetchProfile(filter) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), opts.timeout || ADMIN_CHECK_TIMEOUT);
            try {
                await TC.ensureToken();
                const r = await fetch(TC.env.REST + '/users?select=id,email,nom,is_admin&limit=1&' + filter, {
                    headers: {
                        apikey: TC.env.SUPABASE_ANON,
                        Authorization: 'Bearer ' + TC.session.token,
                        Accept: 'application/json'
                    },
                    cache: 'no-store',
                    signal: controller.signal
                });
                if (!r.ok) {
                    let detail = '';
                    try { const body = await r.json(); detail = body.message || body.hint || ''; }
                    catch (e) { /* corps illisible */ }
                    return { status: r.status, rows: null, detail };
                }
                return { status: 200, rows: await r.json(), detail: '' };
            } finally { clearTimeout(timer); }
        }

        let result;
        try {
            result = userId ? await fetchProfile('id=eq.' + encodeURIComponent(userId)) : { rows: [], status: 200 };
            if ((!result.rows || !result.rows.length) && userEmail && result.status === 200) {
                result = await fetchProfile('email=eq.' + encodeURIComponent(userEmail));
            }
        } catch (e) {
            if (e.name === 'AbortError') {
                return verdict({
                    code: 'ADMIN_AUTH_CHECK_TIMEOUT',
                    message: 'Supabase n\'a pas répondu dans le délai imparti (' +
                        Math.round((opts.timeout || ADMIN_CHECK_TIMEOUT) / 1000) + ' s).'
                });
            }
            return verdict({
                code: 'ADMIN_AUTH_CHECK_ERROR',
                message: e.message || 'Erreur inattendue pendant la vérification.'
            });
        }

        if (result.status === 401) {
            return verdict({
                code: 'ADMIN_HTTP_401', status: 401,
                message: 'Session refusée par Supabase. Le jeton est expiré ou invalide.'
            });
        }
        if (result.status === 403) {
            return verdict({
                code: 'ADMIN_HTTP_403', status: 403,
                message: 'Lecture de la table users interdite par une règle RLS.' +
                    (result.detail ? ' [' + result.detail + ']' : '')
            });
        }
        if (result.status !== 200) {
            return verdict({
                code: 'ADMIN_AUTH_CHECK_ERROR', status: result.status,
                message: 'Supabase a répondu HTTP ' + result.status +
                    (result.detail ? ' : ' + result.detail : '.')
            });
        }

        const profile = result.rows && result.rows[0];
        if (!profile) {
            return verdict({
                code: 'ADMIN_PROFILE_NOT_FOUND',
                message: 'Aucun profil ne correspond à cette session dans la table users.'
            });
        }
        if (!profile.is_admin) {
            return verdict({
                code: 'ADMIN_NOT_ADMIN',
                message: 'Ce compte ne dispose pas des droits d\'administration.'
            });
        }

        return {
            ok: true, code: null, message: null, profile,
            status: 200, endpoint: ENDPOINT, duration_ms: Date.now() - started
        };
    };

    /* ── Navigation ──────────────────────────────────────── */

    function paintRail() {
        const host = TC.el('rail-groups');
        host.innerHTML = GROUPS.map(function (group) {
            const items = modules.filter(m => m.group === group.id);
            if (!items.length) return '';
            return '<div class="rail-group"><h4>' + TC.esc(group.label) + '</h4>' +
                items.map(m =>
                    '<button class="rail-link" data-go="' + m.id + '">' +
                    '<span class="rail-ico">' + (m.icon || '·') + '</span>' +
                    '<span>' + TC.esc(m.label) + '</span>' +
                    '<span class="rail-badge" id="badge-' + m.id + '" hidden></span>' +
                    '</button>').join('') +
                '</div>';
        }).join('');
    }

    function paintStage() {
        TC.el('stage').innerHTML = modules.map(m =>
            '<section class="panel" id="panel-' + m.id + '" data-module="' + m.id + '"></section>').join('');
    }

    /** Marque un module d'une pastille numérique (anomalies à traiter). */
    TC.badge = function (id, count) {
        const node = TC.el('badge-' + id);
        if (!node) return;
        if (!count) { node.hidden = true; return; }
        node.hidden = false;
        node.textContent = count > 99 ? '99+' : String(count);
    };

    const mounted = {};

    TC.go = function (id, options) {
        const module = byId[id];
        if (!module) return;
        const opts = options || {};

        TC.qsa('.panel').forEach(p => p.classList.remove('active'));
        TC.qsa('.rail-link').forEach(b => b.classList.toggle('active', b.dataset.go === id));

        const panel = TC.el('panel-' + id);
        if (!panel) return;
        panel.classList.add('active');

        if (!mounted[id]) {
            panel.innerHTML = typeof module.view === 'function' ? module.view() : '';
            mounted[id] = true;
            try { if (typeof module.mount === 'function') module.mount(); }
            catch (e) {
                console.error('[TC] Montage de ' + id, e);
                panel.innerHTML = '<div class="note err"><strong>Section indisponible.</strong> ' +
                    TC.esc(e.message) + '</div>';
            }
        } else if (typeof module.refresh === 'function' && opts.reload !== false && current !== id) {
            try { module.refresh(); } catch (e) { console.error('[TC] Rechargement de ' + id, e); }
        }

        current = id;
        if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
        TC.el('rail').classList.remove('open');
        if (opts.scroll !== false) window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    TC.currentModule = () => current;

    /* ── Palette de commandes ────────────────────────────── */

    let paletteIndex = 0;
    let paletteHits = [];

    function paintPalette(query) {
        const q = String(query || '').toLowerCase().trim();
        paletteHits = modules.filter(m => !q || (m.label + ' ' + m.id + ' ' + (m.keywords || '')).toLowerCase().indexOf(q) !== -1);
        paletteIndex = 0;
        TC.el('palette-list').innerHTML = paletteHits.length
            ? paletteHits.map((m, i) =>
                '<div class="palette-item' + (i === 0 ? ' sel' : '') + '" data-go="' + m.id + '">' +
                '<span class="rail-ico">' + (m.icon || '·') + '</span>' + TC.esc(m.label) +
                '<span class="grp">' + TC.esc((GROUPS.find(g => g.id === m.group) || {}).label || '') + '</span></div>').join('')
            : '<div class="palette-item">Aucune section ne correspond.</div>';
    }

    function paletteOpen() {
        TC.el('palette').classList.add('open');
        const input = TC.el('palette-input');
        input.value = '';
        paintPalette('');
        setTimeout(() => input.focus(), 40);
    }

    function paletteClose() { TC.el('palette').classList.remove('open'); }

    function paletteMove(delta) {
        if (!paletteHits.length) return;
        paletteIndex = (paletteIndex + delta + paletteHits.length) % paletteHits.length;
        TC.qsa('#palette-list .palette-item').forEach((n, i) => n.classList.toggle('sel', i === paletteIndex));
    }

    /* ── Contrôle de santé permanent ─────────────────────── */

    TC.health = {
        set(level, text) {
            const dot = TC.el('health-dot');
            const label = TC.el('health-text');
            if (!dot || !label) return;
            dot.className = 'health-dot ' + level;
            label.innerHTML = text;
        },
        async probe() {
            this.set('busy', 'Contrôle de la base…');
            try {
                /* PostgREST ne sait pas comparer deux colonnes entre elles :
                   « plus_haut.lt.plus_bas » lui fait chercher la valeur
                   littérale « plus_bas » dans une colonne numérique et il
                   répond 400. Les comparaisons de ce type se font désormais
                   côté client, dans le diagnostic. Ici, on ne teste que ce
                   qui se compare à une constante. */
                const [session, anomalies] = await Promise.all([
                    TC.get('historique', 'select=date_seance&order=date_seance.desc&limit=1'),
                    TC.count('historique', 'or=(cours_cloture.lt.0,plus_haut.lt.0,plus_bas.lt.0,volume.lt.0)')
                ]);
                const last = session && session[0] && session[0].date_seance;
                const bad = anomalies.value || 0;
                const age = last ? Math.round((Date.now() - Date.parse(last + 'T12:00:00')) / 86400000) : null;

                let level = 'ok';
                let text = 'Dernière séance <b>' + (last ? TC.fmtDate(last) : 'inconnue') + '</b>';
                if (!last) { level = 'err'; text = 'Aucune séance en base'; }
                else if (bad > 0) { level = 'err'; text += ' · <b>' + bad + '</b> anomalie(s)'; }
                else if (age !== null && age > 4) { level = 'warn'; text += ' · ' + age + ' jours de retard'; }
                else { text += ' · base saine'; }

                this.set(level, text);
                TC.badge('diagnostic', bad);
                TC.lastSession = last || null;
            } catch (e) {
                this.set('err', 'Contrôle impossible');
            }
        }
    };

    /* ── Démarrage ───────────────────────────────────────── */

    const BOOT_WATCHDOG = 10000;

    /* Correspondance entre code technique et message adressé à l'utilisateur. */
    const TITRES = {
        ADMIN_SESSION_MISSING: 'Session absente',
        ADMIN_AUTH_CHECK_TIMEOUT: 'Supabase ne répond pas',
        ADMIN_HTTP_401: 'Session expirée',
        ADMIN_HTTP_403: 'Lecture refusée',
        ADMIN_PROFILE_NOT_FOUND: 'Compte introuvable',
        ADMIN_NOT_ADMIN: 'Accès refusé',
        ADMIN_AUTH_CHECK_ERROR: 'Vérification impossible',
        ADMIN_BOOT_TIMEOUT: 'Démarrage trop long',
        ADMIN_BOOT_ERROR: 'Démarrage interrompu'
    };

    TC.boot = async function () {
        /* Filet de dernier recours : quoi qu'il arrive en aval, l'écran de
           démarrage cède la place à un diagnostic au bout de dix secondes. */
        const watchdog = setTimeout(function () {
            if (journal.done) return;
            journal.fail('ADMIN_BOOT_TIMEOUT',
                'Le démarrage n\'a pas abouti en ' + (BOOT_WATCHDOG / 1000) + ' secondes.');
            bootFatal(TITRES.ADMIN_BOOT_TIMEOUT,
                'Le démarrage s\'est arrêté à l\'étape « ' +
                (journal.current ? journal.current.step.label : 'inconnue') +
                ' ». La cause la plus fréquente est une base qui ne répond pas.',
                'ADMIN_BOOT_TIMEOUT');
        }, BOOT_WATCHDOG);

        try {
            journal.begin({ id: 'session', label: 'Lecture de la session…' });
            if (!TC.loadSession()) {
                journal.end(false);
                clearTimeout(watchdog);
                journal.done = true;
                location.href = '/login.html';
                return;
            }
            journal.end(true);

            journal.begin({
                id: 'admin-rights',
                label: 'Vérification des droits d\'administration…',
                endpoint: '/rest/v1/users'
            });
            const verdict = await TC.checkAdmin();
            journal.end(verdict.ok, { status: verdict.status, duration_ms: verdict.duration_ms });

            if (!verdict.ok) {
                journal.fail(verdict.code, verdict.message,
                    { endpoint: verdict.endpoint, status: verdict.status, duration_ms: verdict.duration_ms });
                clearTimeout(watchdog);
                journal.done = true;
                bootFatal(TITRES[verdict.code] || 'Démarrage interrompu', verdict.message, verdict.code, {
                    hideRelogin: verdict.code === 'ADMIN_NOT_ADMIN'
                });
                if (verdict.code === 'ADMIN_NOT_ADMIN') setTimeout(() => { location.href = '/app.html'; }, 3200);
                return;
            }

            const profile = verdict.profile;
            journal.begin({ id: 'interface', label: 'Construction de l\'interface…' });

            TC.session.profile = profile;
            TC.el('who').textContent = profile.email || (TC.session.user && TC.session.user.email) || '';

        paintRail();
        paintStage();

        TC.el('boot').hidden = true;
        TC.el('shell').hidden = false;

        /* Navigation */
        TC.el('rail').addEventListener('click', function (e) {
            const link = e.target.closest('[data-go]');
            if (link) TC.go(link.dataset.go);
        });
        TC.el('rail-toggle').addEventListener('click', () => TC.el('rail').classList.toggle('open'));
        TC.el('logout').addEventListener('click', function () {
            TC.clearSession();
            location.href = '/login.html';
        });
        TC.el('refresh-all').addEventListener('click', function () {
            TC.invalidateTickers();
            TC.clearScans();
            const module = byId[current];
            if (module && typeof module.refresh === 'function') module.refresh();
            TC.health.probe();
            TC.toast('Section rechargée depuis Supabase', 'info');
        });
        TC.el('health-chip').addEventListener('click', () => TC.go('diagnostic'));

        /* Palette */
        TC.el('palette-open').addEventListener('click', paletteOpen);
        TC.el('palette-input').addEventListener('input', e => paintPalette(e.target.value));
        TC.el('palette-list').addEventListener('click', function (e) {
            const item = e.target.closest('[data-go]');
            if (item) { paletteClose(); TC.go(item.dataset.go); }
        });
        TC.el('palette').addEventListener('click', function (e) {
            if (e.target.id === 'palette') paletteClose();
        });
        document.addEventListener('keydown', function (e) {
            const open = TC.el('palette').classList.contains('open');
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open ? paletteClose() : paletteOpen(); return; }
            if (!open) return;
            if (e.key === 'Escape') { paletteClose(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); paletteMove(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); paletteMove(-1); }
            else if (e.key === 'Enter') {
                e.preventDefault();
                const pick = paletteHits[paletteIndex];
                if (pick) { paletteClose(); TC.go(pick.id); }
            }
        });

        /* Section initiale : ancre de l'URL, sinon tableau de bord. */
            const wanted = location.hash.slice(1);
            TC.go(byId[wanted] ? wanted : 'dashboard');

            journal.end(true);
            journal.done = true;
            clearTimeout(watchdog);
            console.log('[ADMIN BOOT] terminé en ' + (Date.now() - T0) + ' ms');

            /* Ce qui suit enrichit l'interface sans la conditionner : une
               lenteur ici ne doit plus jamais retenir l'écran de démarrage. */
            TC.health.probe();
            setInterval(() => TC.health.probe(), 5 * 60 * 1000);
            TC.tickers().then(() => TC.tickerDatalist('tickers-list'))
                .catch(e => console.warn('[ADMIN BOOT] référentiel indisponible :', e.message));

        } catch (e) {
            clearTimeout(watchdog);
            journal.done = true;
            journal.end(false);
            journal.fail('ADMIN_BOOT_ERROR', e.message || String(e), { stack: e.stack });
            bootFatal(TITRES.ADMIN_BOOT_ERROR,
                e.message || 'Une erreur inattendue a interrompu le démarrage.',
                'ADMIN_BOOT_ERROR', { extra: { stack: e.stack } });
        }
    };

})(window.TC);
