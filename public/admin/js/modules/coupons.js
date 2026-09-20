/* ============================================================
   THE CAPITAL — CALENDRIER DES COUPONS OBLIGATAIRES
   Table coupons_calendrier, lue par l'application (marche.js, calendrier
   des évènements : ticker, date_detachement, coupon) mais qui n'avait
   jusqu'ici AUCUN chemin d'écriture nulle part dans le code — ni admin,
   ni scraper : elle restait vide quoi qu'il arrive. Ce module lui donne
   une saisie manuelle, sur le même principe que le Calendrier des
   dividendes.
   ============================================================ */
'use strict';

(function (TC) {

    let rows = [];
    let editing = null;
    let calDate = new Date();

    const STATUTS = [
        { v: 'prévisionnel', l: 'Prévisionnel' },
        { v: 'confirmé', l: 'Confirmé' },
        { v: 'payé', l: 'Payé' }
    ];

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">Calendrier des <em>coupons</em></div>' +
            '<div class="page-sub">Détachements de coupons obligataires affichés dans le calendrier des évènements de l\'application. Aucun scraper n\'alimente cette table pour l\'instant : elle se renseigne ici, à la main, à partir des échéanciers d\'émission (DC/BR ou note d\'information).</div></div>' +
            '<div class="page-actions"><button class="btn btn-outline btn-sm" id="cpn-export">⬇ CSV</button></div></div>' +

            '<div class="kpis" id="cpn-kpis"></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Calendrier des détachements</span>' +
            '<span class="card-tools"><span class="card-count" id="cpn-cal-count"></span></span></div>' +
            '<div class="card-body">' +
            '<div class="tc-cal-nav">' +
            '<button class="btn btn-outline btn-sm" id="cpn-cal-prev">← Mois précédent</button>' +
            '<span class="tc-cal-title" id="cpn-cal-title"></span>' +
            '<button class="btn btn-outline btn-sm" id="cpn-cal-today">Aujourd\'hui</button>' +
            '<button class="btn btn-outline btn-sm" id="cpn-cal-next">Mois suivant →</button>' +
            '</div>' +
            '<div id="cpn-cal-grid" class="tc-cal-grid"></div>' +
            '<div class="tc-cal-legend"><span><i style="background:rgba(184,150,78,.55)"></i>Coupon enregistré — cliquer pour modifier</span></div>' +
            '</div></div>' +

            '<div class="card accent"><div class="card-head"><span class="card-title" id="cpn-form-title">Enregistrer un coupon</span>' +
            '<span class="card-tools"><button class="btn btn-outline btn-sm" id="cpn-cancel-edit" hidden>Annuler la modification</button></span></div>' +
            '<div class="form-grid">' + TC.fields([
                { id: 'cpn-ticker', label: 'Code obligation', upper: true, placeholder: 'CI.O17' },
                { id: 'cpn-montant', label: 'Coupon par titre', type: 'number', col: 'coupon', placeholder: '680' },
                { id: 'cpn-detach', label: 'Date de détachement', type: 'date', col: 'date_detachement' },
                { id: 'cpn-paiement', label: 'Date de paiement', type: 'date', col: 'date_paiement' },
                { id: 'cpn-statut', label: 'Statut', type: 'select', options: STATUTS },
                { id: 'cpn-notes', label: 'Observation', placeholder: 'Coupon annuel, remboursement partiel du capital…', wide: true }
            ]) + '</div>' +
            '<div class="actions"><button class="btn btn-primary" id="cpn-save">Enregistrer</button>' +
            '<button class="btn btn-outline btn-sm" id="cpn-clear">Effacer</button>' +
            '<span class="msg" id="cpn-msg"></span></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Coupons enregistrés</span>' +
            '<span class="card-tools"><span class="card-count" id="cpn-count"></span>' +
            '<button class="btn btn-outline btn-sm" id="cpn-reload">↺</button></span></div>' +
            '<div class="tw capped" id="cpn-scope"><table><thead><tr>' +
            '<th>Code</th><th class="r">Coupon</th><th>Détachement</th><th>Paiement</th><th>Statut</th><th></th>' +
            '</tr></thead><tbody id="cpn-tbody">' + TC.rowsLoading(6) + '</tbody></table></div></div>';
    }

    function box(label, value, tone) {
        return '<div class="kpi"><div class="kpi-label">' + TC.esc(label) + '</div><div class="kpi-value sm"' +
            (tone ? ' style="color:var(--' + tone + ')"' : '') + '>' + TC.esc(String(value)) + '</div></div>';
    }

    function paintKpis() {
        const today = TC.today();
        const upcoming = rows.filter(r => r.date_detachement && r.date_detachement >= today).length;
        const sansMontant = rows.filter(r => TC.toNumber(r.coupon) === null).length;
        TC.el('cpn-kpis').innerHTML =
            box('Coupons enregistrés', rows.length) +
            box('Détachements à venir', upcoming) +
            box('Sans montant', sansMontant, sansMontant ? 'orange' : 'green');
    }

    function paint(list) {
        const tbody = TC.el('cpn-tbody');
        TC.el('cpn-count').textContent = list.length + ' ligne(s)';
        if (!list.length) {
            tbody.innerHTML = TC.rowsEmpty(6, 'Aucun coupon enregistré', 'Saisissez une échéance ci-dessus pour qu\'elle apparaisse dans le calendrier de l\'application.');
            return;
        }
        tbody.innerHTML = list.map(function (r) {
            const statut = r.statut || 'prévisionnel';
            const tone = statut === 'payé' ? 'badge-green' : statut === 'confirmé' ? 'badge-gold' : 'badge-orange';
            return '<tr><td class="td-key">' + TC.esc(r.ticker) + '</td>' +
                '<td class="r td-mono">' + TC.fmt(r.coupon) + '</td>' +
                '<td class="td-muted">' + TC.fmtDate(r.date_detachement) + '</td>' +
                '<td class="td-muted">' + TC.fmtDate(r.date_paiement) + '</td>' +
                '<td><span class="badge ' + tone + '">' + TC.esc(statut) + '</span></td>' +
                '<td class="r" style="white-space:nowrap;">' +
                '<button class="btn btn-outline btn-ico" data-edit="' + r.id + '">✎</button> ' +
                '<button class="btn btn-danger btn-ico" data-del="' + r.id + '">✕</button></td></tr>';
        }).join('');
    }

    async function load() {
        TC.el('cpn-tbody').innerHTML = TC.rowsLoading(6);
        rows = await TC.getAll('coupons_calendrier', 'select=*&order=date_detachement.desc');
        paintKpis();
        paint(rows);
        renderCalendar();
    }

    function resetForm() {
        editing = null;
        TC.clear(['cpn-ticker', 'cpn-montant', 'cpn-detach', 'cpn-paiement', 'cpn-notes']);
        TC.setVal('cpn-statut', 'prévisionnel');
        TC.el('cpn-form-title').textContent = 'Enregistrer un coupon';
        TC.el('cpn-save').textContent = 'Enregistrer';
        TC.el('cpn-cancel-edit').hidden = true;
        TC.say('cpn-msg', '');
    }

    function edit(row) {
        editing = row.id;
        TC.setVal('cpn-ticker', row.ticker);
        TC.setVal('cpn-montant', row.coupon);
        TC.setVal('cpn-detach', TC.toISODate(row.date_detachement) || '');
        TC.setVal('cpn-paiement', TC.toISODate(row.date_paiement) || '');
        TC.setVal('cpn-statut', row.statut || 'prévisionnel');
        TC.setVal('cpn-notes', row.notes);
        TC.el('cpn-form-title').textContent = 'Modifier ' + row.ticker;
        TC.el('cpn-save').textContent = 'Enregistrer la modification';
        TC.el('cpn-cancel-edit').hidden = false;
        TC.say('cpn-msg', 'Modification en cours.', 'info');
        document.getElementById('cpn-form-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function save() {
        const ticker = String(TC.val('cpn-ticker') || '').toUpperCase();
        const detach = TC.toISODate(TC.val('cpn-detach'));
        if (!ticker || !detach) { TC.say('cpn-msg', 'Le code et la date de détachement sont obligatoires.', 'err'); return; }
        const body = {
            ticker, coupon: TC.num('cpn-montant'), date_detachement: detach,
            date_paiement: TC.toISODate(TC.val('cpn-paiement')) || null,
            statut: TC.val('cpn-statut') || 'prévisionnel', notes: TC.val('cpn-notes') || null
        };
        try {
            if (editing) await TC.patch('coupons_calendrier', 'id=eq.' + editing, body);
            else await TC.post('coupons_calendrier', body);
            TC.say('cpn-msg', ticker + ' enregistré.', 'ok');
            resetForm();
            load();
        } catch (e) { TC.say('cpn-msg', e.message, 'err'); }
    }

    function calMove(delta) { calDate = new Date(calDate.getFullYear(), calDate.getMonth() + delta, 1); renderCalendar(); }

    function renderCalendar() {
        const grid = TC.el('cpn-cal-grid'); if (!grid) return;
        const y = calDate.getFullYear(), m = calDate.getMonth();
        const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
        const titleEl = TC.el('cpn-cal-title'); if (titleEl) titleEl.textContent = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        const byDay = {};
        rows.forEach(r => {
            const iso = TC.toISODate(r.date_detachement);
            if (!iso || iso.slice(0, 4) !== String(y) || Number(iso.slice(5, 7)) !== m + 1) return;
            (byDay[iso] = byDay[iso] || []).push(r);
        });
        const today = TC.today();
        const names = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        let html = names.map(n => '<div class="tc-cal-dow">' + n + '</div>').join('');
        const offset = (first.getDay() + 6) % 7;
        for (let i = 0; i < offset; i++) html += '<div class="tc-cal-day empty"></div>';
        let count = 0;
        for (let d = 1; d <= last.getDate(); d++) {
            const iso = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            const ev = byDay[iso] || [];
            count += ev.length;
            html += '<div class="tc-cal-day' + (TC.isWeekend(iso) ? ' weekend' : '') + (iso === today ? ' today' : '') + '">' +
                '<span class="n">' + d + '</span>' +
                ev.map(r => '<span class="tc-cal-event" data-cal-edit="' + r.id + '" style="cursor:pointer" title="' +
                    TC.esc(r.ticker + ' · ' + TC.fmt(r.coupon)) + '">' + TC.esc(r.ticker) + '</span>').join('') +
                '</div>';
        }
        grid.innerHTML = html;
        const countEl = TC.el('cpn-cal-count'); if (countEl) countEl.textContent = count + ' détachement(s) ce mois-ci';
    }

    TC.register({
        id: 'coupons',
        label: 'Calendrier des coupons',
        group: 'marche',
        icon: '◇',
        keywords: 'coupons obligations detachement paiement calendrier',
        view,
        refresh: load,
        mount() {
            TC.on('cpn-save', 'click', save);
            TC.on('cpn-clear', 'click', resetForm);
            TC.on('cpn-cancel-edit', 'click', resetForm);
            TC.on('cpn-reload', 'click', load);
            TC.on('cpn-cal-prev', 'click', () => calMove(-1));
            TC.on('cpn-cal-next', 'click', () => calMove(1));
            TC.on('cpn-cal-today', 'click', () => { calDate = new Date(); renderCalendar(); });
            TC.delegate('cpn-cal-grid', '[data-cal-edit]', 'click', n => {
                const row = rows.find(r => String(r.id) === n.dataset.calEdit); if (row) edit(row);
            });
            TC.delegate('cpn-tbody', '[data-edit]', 'click', n => {
                const row = rows.find(r => String(r.id) === n.dataset.edit); if (row) edit(row);
            });
            TC.delegate('cpn-tbody', '[data-del]', 'click', async function (n) {
                const row = rows.find(r => String(r.id) === n.dataset.del);
                if (!row || !TC.confirmTwice('Supprimer le coupon ' + row.ticker + ' ?')) return;
                try { await TC.del('coupons_calendrier', 'id=eq.' + row.id); TC.toast('Supprimé', 'ok'); load(); }
                catch (e) { TC.toast(e.message, 'err'); }
            });
            TC.on('cpn-export', 'click', function () {
                if (!rows.length) return;
                TC.download('coupons-' + TC.today() + '.csv',
                    TC.toCSV(rows, ['ticker', 'coupon', 'date_detachement', 'date_paiement', 'statut', 'notes']),
                    'text/csv;charset=utf-8');
            });
            load();
        }
    });

})(window.TC);
