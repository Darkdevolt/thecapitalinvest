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

    /* ── Écran de démarrage ──────────────────────────────── */

    function bootMsg(text) {
        const node = TC.el('boot-msg');
        if (node) node.textContent = text;
    }

    function bootFatal(title, detail) {
        const boot = TC.el('boot');
        boot.innerHTML =
            '<img src="' + TC.env.LOGO + '" alt="">' +
            '<div class="fatal">' +
            '<h2>' + TC.esc(title) + '</h2>' +
            '<p>' + TC.esc(detail) + '</p>' +
            '<button class="btn btn-primary" id="boot-relogin">Se reconnecter</button>' +
            '</div>';
        boot.hidden = false;
        TC.el('boot-relogin').addEventListener('click', function () {
            TC.clearSession();
            location.href = '/login.html';
        });
    }

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

    TC.boot = async function () {
        bootMsg('Vérification de la session…');

        if (!TC.loadSession()) { location.href = '/login.html'; return; }

        const user = TC.session.user;
        const userId = user && user.id;
        const userEmail = (user && user.email) || '';

        if (!userId && !userEmail) {
            bootFatal('Session incomplète', 'Aucun identifiant utilisateur n\'a été trouvé dans la session enregistrée.');
            return;
        }

        bootMsg('Vérification des droits d\'administration…');

        let profile = null;
        try {
            if (userId) {
                const rows = await TC.get('users', 'select=id,email,nom,is_admin&id=eq.' + encodeURIComponent(userId));
                profile = rows && rows[0];
            }
            if (!profile && userEmail) {
                const rows = await TC.get('users', 'select=id,email,nom,is_admin&email=eq.' + encodeURIComponent(userEmail));
                profile = rows && rows[0];
            }
        } catch (e) {
            bootFatal('Connexion impossible', e.message || 'La base n\'a pas répondu.');
            return;
        }

        if (!profile) {
            bootFatal('Compte introuvable',
                'Votre compte n\'existe pas dans la table users, ou une règle RLS en interdit la lecture.');
            return;
        }

        if (!profile.is_admin) {
            bootFatal('Accès refusé', 'Ce compte ne dispose pas des droits d\'administration.');
            setTimeout(() => { location.href = '/app.html'; }, 2600);
            return;
        }

        TC.session.profile = profile;
        TC.el('who').textContent = profile.email || userEmail;

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

        TC.health.probe();
        setInterval(() => TC.health.probe(), 5 * 60 * 1000);

        /* Le référentiel est chargé une fois pour tous les formulaires. */
        TC.tickers().then(() => TC.tickerDatalist('tickers-list'));
    };

})(window.TC);
