/* ============================================================
   THE CAPITAL — COMPTES ET ABONNEMENTS
   Les indicateurs sont calculés ici, à partir de la table users.
   L'ancienne version appelait une fonction RPC absente de la base
   et affichait « Impossible de charger les indicateurs » sans
   jamais rien montrer. Aucun chiffre d'affaires n'est reconstitué
   sans donnée tarifaire : ce qui n'est pas mesurable n'est pas affiché.
   ============================================================ */
'use strict';

(function (TC) {

    let rows = [];
    const sel = TC.selection('usr');

    const PLANS = [
        { v: 'free', l: 'Découverte' },
        { v: 'pro', l: 'Pro' },
        { v: 'elite', l: 'Elite' }
    ];

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">Comptes &amp; <em>abonnements</em></div>' +
            '<div class="page-sub">État réel de la clientèle : répartition par formule, échéances proches, comptes dormants. Les indicateurs sont calculés depuis la table des comptes, sans estimation.</div></div>' +
            '<div class="page-actions"><button class="btn btn-outline btn-sm" id="usr-export">⬇ CSV</button></div></div>' +

            '<div class="kpis" id="usr-kpis"></div>' +

            '<div class="grid-2">' +
            '<div class="card"><div class="card-head"><span class="card-title">Répartition par formule</span></div>' +
            '<div class="card-body" id="usr-plans"></div></div>' +
            '<div class="card"><div class="card-head"><span class="card-title">Inscriptions par mois</span>' +
            '<span class="card-tools"><span class="card-count">12 derniers mois</span></span></div>' +
            '<div class="card-body" id="usr-chart"></div></div>' +
            '</div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Comptes</span>' +
            '<span class="card-tools">' +
            '<input type="search" id="usr-search" placeholder="Courriel ou nom…" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;width:190px;">' +
            '<select id="usr-plan-filter" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;">' +
            '<option value="">Toutes formules</option>' + PLANS.map(p => '<option value="' + p.v + '">' + p.l + '</option>').join('') +
            '<option value="__admin">Administrateurs</option><option value="__expire">Abonnements expirés</option>' +
            '<option value="__bientot">Échéance sous 30 jours</option></select>' +
            '<span class="card-count" id="usr-count"></span>' +
            '<button class="btn btn-outline btn-sm" id="usr-reload">↺</button></span></div>' +
            '<div class="bulkbar" id="bulk-usr"><span class="bulk-count">0 compte(s)</span>' +
            '<button class="btn btn-outline btn-sm" id="usr-bulk-reset">Désélectionner</button></div>' +
            '<div class="tw capped" id="bulk-usr-scope"><table><thead><tr>' +
            '<th><input type="checkbox" class="rowcheck" id="usr-all"></th>' +
            '<th>Courriel</th><th>Nom</th><th>Formule</th><th>Échéance</th><th>Statut</th>' +
            '<th>Rôle</th><th>Inscription</th><th></th>' +
            '</tr></thead><tbody id="usr-tbody">' + TC.rowsLoading(9) + '</tbody></table></div></div>';
    }

    function statusOf(r) {
        const plan = r.plan || 'free';
        if (plan === 'free') return { label: 'Découverte', tone: 'badge-grey' };
        const expiry = TC.toISODate(r.plan_expire_at);
        if (!expiry) return { label: 'Sans échéance', tone: 'badge-orange' };
        const days = Math.round((Date.parse(expiry + 'T12:00:00') - Date.now()) / 86400000);
        if (days < 0) return { label: 'Expiré depuis ' + Math.abs(days) + ' j', tone: 'badge-red', days };
        if (days <= 30) return { label: 'Échéance dans ' + days + ' j', tone: 'badge-orange', days };
        return { label: 'Actif', tone: 'badge-green', days };
    }

    async function load() {
        TC.el('usr-tbody').innerHTML = TC.rowsLoading(9);
        const data = await TC.getAll('users', 'select=*&order=created_at.desc');
        rows = (data || []).map(function (r) {
            r.__status = statusOf(r);
            return r;
        });
        paintKpis();
        paintPlans();
        paintChart();
        paint(rows);
    }

    function paintKpis() {
        const total = rows.length;
        const paying = rows.filter(r => (r.plan || 'free') !== 'free');
        const active = paying.filter(r => r.__status.tone === 'badge-green' || r.__status.tone === 'badge-orange').length;
        const expired = paying.filter(r => r.__status.tone === 'badge-red').length;
        const soon = paying.filter(r => r.__status.days !== undefined && r.__status.days >= 0 && r.__status.days <= 30).length;
        const admins = rows.filter(r => r.is_admin).length;

        const monthAgo = TC.shiftDays(TC.today(), -30);
        const fresh = rows.filter(r => TC.toISODate(r.created_at) >= monthAgo).length;

        TC.el('usr-kpis').innerHTML =
            box('Comptes', total) +
            box('Abonnements actifs', active, active ? 'green' : '') +
            box('Expirés', expired, expired ? 'red' : '') +
            box('Échéance ≤ 30 j', soon, soon ? 'orange' : '') +
            box('Inscrits ce mois', fresh) +
            box('Administrateurs', admins);
    }

    function box(label, value, tone) {
        return '<div class="kpi"><div class="kpi-label">' + TC.esc(label) + '</div><div class="kpi-value sm"' +
            (tone ? ' style="color:var(--' + tone + ')"' : '') + '>' + TC.esc(String(value)) + '</div></div>';
    }

    function paintPlans() {
        const total = rows.length || 1;
        TC.el('usr-plans').innerHTML = PLANS.map(function (p) {
            const n = rows.filter(r => (r.plan || 'free') === p.v).length;
            const share = (n / total) * 100;
            return '<div style="margin-bottom:14px;">' +
                '<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px;">' +
                '<span>' + TC.esc(p.l) + '</span>' +
                '<span class="td-mono td-muted">' + n + ' · ' + share.toFixed(1) + ' %</span></div>' +
                '<div class="bar"><i style="width:' + Math.max(1, share) + '%"></i></div></div>';
        }).join('') +
            '<div class="note">La formule Découverte n\'a pas d\'échéance. Les formules Pro et Elite se pilotent par la date d\'expiration, seule donnée qui conditionne réellement l\'accès.</div>';
    }

    /** Courbe des inscriptions : SVG direct, aucune bibliothèque à charger. */
    function paintChart() {
        const months = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleDateString('fr-FR', { month: 'short' }), n: 0 });
        }
        const index = {};
        months.forEach(m => { index[m.key] = m; });
        rows.forEach(function (r) {
            const iso = TC.toISODate(r.created_at);
            if (!iso) return;
            const bucket = index[iso.slice(0, 7)];
            if (bucket) bucket.n++;
        });

        const host = TC.el('usr-chart');
        const max = Math.max.apply(null, months.map(m => m.n).concat([1]));
        if (!rows.length) {
            host.innerHTML = '<div class="empty-state"><strong>Aucun compte</strong>La courbe apparaîtra dès la première inscription.</div>';
            return;
        }
        const W = 640, H = 190, pad = 26;
        const step = (W - pad * 2) / Math.max(1, months.length - 1);
        const points = months.map((m, i) => ({
            x: pad + i * step,
            y: H - pad - (m.n / max) * (H - pad * 2),
            m
        }));
        const path = points.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
        const area = path + ' L' + points[points.length - 1].x.toFixed(1) + ' ' + (H - pad) + ' L' + pad + ' ' + (H - pad) + ' Z';

        host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;">' +
            '<path d="' + area + '" fill="rgba(184,150,78,0.12)"/>' +
            '<path d="' + path + '" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linejoin="round"/>' +
            points.map(p => '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3" fill="var(--gold)">' +
                '<title>' + TC.esc(p.m.label) + ' : ' + p.m.n + '</title></circle>').join('') +
            points.map((p, i) => i % 2 === 0
                ? '<text x="' + p.x.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" fill="var(--muted)" font-size="10">' +
                TC.esc(p.m.label) + '</text>' : '').join('') +
            '</svg>';
    }

    function paint(list) {
        const tbody = TC.el('usr-tbody');
        TC.el('usr-count').textContent = list.length + ' compte(s)';
        if (!list.length) {
            tbody.innerHTML = TC.rowsEmpty(9, 'Aucun compte', 'Les inscriptions apparaîtront ici.');
            return;
        }
        sel.reset();
        tbody.innerHTML = list.map(function (r) {
            const plan = PLANS.find(p => p.v === (r.plan || 'free'));
            const tone = r.plan === 'elite' ? 'badge-gold' : r.plan === 'pro' ? 'badge-blue' : 'badge-grey';
            return '<tr class="' + (r.__status.tone === 'badge-red' ? 'row-warn' : '') + '">' +
                '<td><input type="checkbox" class="rowcheck" data-id="' + r.id + '"></td>' +
                '<td>' + TC.esc(r.email) + '</td>' +
                '<td class="td-muted">' + TC.esc(r.nom || '—') + '</td>' +
                '<td><span class="badge ' + tone + '">' + TC.esc(plan ? plan.l : r.plan) + '</span></td>' +
                '<td class="td-mono td-muted">' + TC.fmtDate(r.plan_expire_at) + '</td>' +
                '<td><span class="badge ' + r.__status.tone + '">' + TC.esc(r.__status.label) + '</span></td>' +
                '<td>' + (r.is_admin ? '<span class="badge badge-orange">Admin</span>' : '<span class="td-muted">—</span>') + '</td>' +
                '<td class="td-mono td-muted">' + TC.fmtDate(r.created_at) + '</td>' +
                '<td class="r"><button class="btn btn-outline btn-ico" data-edit="' + r.id + '">✎</button></td></tr>';
        }).join('');
    }

    function filter() {
        const q = TC.val('usr-search').toLowerCase();
        const scope = TC.val('usr-plan-filter');
        paint(rows.filter(function (r) {
            const haystack = ((r.email || '') + ' ' + (r.nom || '')).toLowerCase();
            if (q && haystack.indexOf(q) === -1) return false;
            if (scope === '__admin') return !!r.is_admin;
            if (scope === '__expire') return r.__status.tone === 'badge-red';
            if (scope === '__bientot') return r.__status.days !== undefined && r.__status.days >= 0 && r.__status.days <= 30;
            if (scope) return (r.plan || 'free') === scope;
            return true;
        }));
    }

    function edit(row) {
        const isSelf = TC.session.profile && String(TC.session.profile.id) === String(row.id);
        TC.modal.open({
            title: row.email,
            subtitle: 'Inscrit le ' + TC.fmtDateLong(row.created_at) + (isSelf ? ' · c\'est votre propre compte' : ''),
            body: '<div class="form-grid">' + TC.fields([
                { id: 'mu-nom', label: 'Nom' },
                { id: 'mu-plan', label: 'Formule', type: 'select', options: PLANS },
                { id: 'mu-expiry', label: 'Échéance', type: 'date', col: 'plan_expire_at', hint: 'Vide pour la formule Découverte.' },
                {
                    id: 'mu-admin', label: 'Droits d\'administration', type: 'select',
                    options: [{ v: 'false', l: 'Utilisateur' }, { v: 'true', l: 'Administrateur' }]
                }
            ]) + '</div>' +
                '<div class="card-body tight"><div class="note" id="mu-note"></div></div>',
            afterOpen() {
                TC.setVal('mu-nom', row.nom);
                TC.setVal('mu-plan', row.plan || 'free');
                TC.setVal('mu-expiry', TC.toISODate(row.plan_expire_at) || '');
                TC.setVal('mu-admin', String(!!row.is_admin));
                const note = TC.el('mu-note');
                const paint = function () {
                    const plan = TC.val('mu-plan');
                    const expiry = TC.val('mu-expiry');
                    const admin = TC.val('mu-admin') === 'true';
                    const messages = [];
                    if (plan !== 'free' && !expiry) messages.push('Une formule payante sans échéance reste active indéfiniment.');
                    if (plan === 'free' && expiry) messages.push('L\'échéance est sans effet sur la formule Découverte.');
                    if (admin && !row.is_admin) messages.push('Ce compte obtiendra un accès complet à cet espace d\'administration.');
                    if (!admin && isSelf) messages.push('Vous êtes sur le point de retirer vos propres droits : vous perdrez immédiatement l\'accès.');
                    note.className = 'note' + (isSelf && !admin ? ' err' : messages.length ? ' warn' : '');
                    note.innerHTML = messages.length ? messages.map(TC.esc).join('<br>') : 'Aucun effet de bord détecté.';
                };
                ['mu-plan', 'mu-expiry', 'mu-admin'].forEach(id => TC.on(id, 'change', paint));
                paint();
            },
            async onSave() {
                const admin = TC.val('mu-admin') === 'true';
                if (isSelf && !admin && !confirm('Retirer vos propres droits d\'administration ?\n\nVous serez déconnecté de cet espace et ne pourrez plus y revenir sans intervention d\'un autre administrateur.')) return;
                const plan = TC.val('mu-plan');
                const body = {
                    nom: TC.val('mu-nom') || null,
                    plan,
                    plan_expire_at: plan === 'free' ? null : (TC.val('mu-expiry') || null),
                    is_admin: admin
                };
                try {
                    await TC.patch('users', 'id=eq.' + encodeURIComponent(row.id), body);
                    TC.modal.close();
                    TC.toast('Compte mis à jour', 'ok');
                    if (isSelf && !admin) { setTimeout(() => location.reload(), 900); return; }
                    load();
                } catch (e) { TC.modal.msg(e.message, 'err'); }
            }
        });
    }

    TC.register({
        id: 'utilisateurs',
        label: 'Comptes',
        group: 'gestion',
        icon: '☰',
        keywords: 'utilisateur client abonnement plan pro elite admin',
        view,
        refresh: load,
        mount() {
            TC.on('usr-reload', 'click', load);
            TC.on('usr-search', 'input', filter);
            TC.on('usr-plan-filter', 'change', filter);
            TC.on('usr-all', 'change', e => sel.all(rows.map(r => r.id), e.target.checked));
            TC.on('usr-bulk-reset', 'click', () => sel.reset());
            TC.on('usr-export', 'click', function () {
                if (!rows.length) return;
                TC.download('comptes-' + TC.today() + '.csv',
                    TC.toCSV(rows, ['email', 'nom', 'plan', 'plan_expire_at', 'is_admin', 'created_at']),
                    'text/csv;charset=utf-8');
            });
            TC.delegate('usr-tbody', '.rowcheck', 'change', n => sel.toggle(n.dataset.id, n.checked));
            TC.delegate('usr-tbody', '[data-edit]', 'click', n => {
                const row = rows.find(r => String(r.id) === n.dataset.edit); if (row) edit(row);
            });
            load();
        }
    });

})(window.TC);
