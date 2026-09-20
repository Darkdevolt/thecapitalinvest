/* ============================================================
   THE CAPITAL — MARCHÉ OBLIGATAIRE
   Tables obligations (une ligne par code, conflit sur `code`) et
   obligations_marche (une ligne par séance, conflit sur `date_seance`).
   Alimentées par le scraper (process-brvm, scope 'obligations'), sans
   correction manuelle possible jusqu'ici — contrairement à Cours &
   historique et Indices, qui ont toujours eu cette possibilité pour
   les actions. Les caractéristiques d'émission (ISIN, taux…) se
   corrigent dans DC/BR, pas ici : cette page ne touche que le cours du
   jour et les agrégats de marché.
   ============================================================ */
'use strict';

(function (TC) {

    let rows = [];
    let marche = [];

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">Marché <em>obligataire</em></div>' +
            '<div class="page-sub">Cours du jour par obligation cotée et agrégats quotidiens du marché. Alimenté par le scraper BRVM ; cette page permet de corriger ou de compléter une ligne à la main quand la source est indisponible ou mal lue.</div></div>' +
            '<div class="page-actions"><button class="btn btn-outline btn-sm" id="obl-export">⬇ CSV</button></div></div>' +

            '<div class="kpis" id="obl-kpis"></div>' +

            '<div class="card accent"><div class="card-head"><span class="card-title">Enregistrer une obligation</span></div>' +
            '<div class="form-grid">' + TC.fields([
                { id: 'obl-code', label: 'Code', upper: true, placeholder: 'CI.O17' },
                { id: 'obl-nom', label: 'Nom', wide: true, placeholder: 'EMPRUNT OBLIGATAIRE... 6,80% 2024-2029' },
                { id: 'obl-seance', label: 'Date de séance', type: 'date' },
                { id: 'obl-cours', label: 'Cours du jour', type: 'number', placeholder: '10250' },
                { id: 'obl-taux', label: 'Taux facial (%)', type: 'number', step: '0.01' },
                { id: 'obl-coupon', label: 'Coupon couru', type: 'number' },
                { id: 'obl-emission', label: 'Date d\'émission', type: 'date' },
                { id: 'obl-maturite', label: 'Date de maturité', type: 'date' },
                { id: 'obl-pay-date', label: 'Dernier paiement — date', type: 'date' },
                { id: 'obl-pay-val', label: 'Dernier paiement — valeur', type: 'number' }
            ]) + '</div>' +
            '<div class="actions"><button class="btn btn-primary" id="obl-save">Enregistrer</button>' +
            '<button class="btn btn-outline btn-sm" id="obl-clear">Effacer</button>' +
            '<span class="msg" id="obl-msg"></span></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Obligations cotées</span>' +
            '<span class="card-tools">' +
            '<input type="search" id="obl-search" placeholder="Code ou nom…" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;width:160px;">' +
            '<span class="card-count" id="obl-count"></span>' +
            '<button class="btn btn-outline btn-sm" id="obl-reload">↺</button></span></div>' +
            '<div class="tw capped" id="obl-scope"><table><thead><tr>' +
            '<th>Code</th><th>Nom</th><th>Séance</th><th class="r">Cours</th><th class="r">Taux facial</th>' +
            '<th>Maturité</th><th>Dernier paiement</th><th></th>' +
            '</tr></thead><tbody id="obl-tbody">' + TC.rowsLoading(8) + '</tbody></table></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Agrégats du marché — par séance</span></div>' +
            '<div class="card-body">' +
            '<div class="form-grid">' + TC.fields([
                { id: 'oblm-date', label: 'Date de séance', type: 'date' },
                { id: 'oblm-valeur', label: 'Valeur des transactions', type: 'number' },
                { id: 'oblm-cap-actions', label: 'Capitalisation Actions', type: 'number' },
                { id: 'oblm-cap-oblig', label: 'Capitalisation Obligations', type: 'number' }
            ]) + '</div>' +
            '<div class="actions"><button class="btn btn-primary" id="oblm-save">Enregistrer</button>' +
            '<button class="btn btn-outline btn-sm" id="oblm-clear">Effacer</button>' +
            '<span class="msg" id="oblm-msg"></span></div></div>' +
            '<div class="tw capped" id="oblm-scope"><table><thead><tr>' +
            '<th>Séance</th><th class="r">Valeur des transactions</th><th class="r">Capi. Actions</th><th class="r">Capi. Obligations</th><th></th>' +
            '</tr></thead><tbody id="oblm-tbody">' + TC.rowsLoading(5) + '</tbody></table></div></div>';
    }

    function box(label, value, tone) {
        return '<div class="kpi"><div class="kpi-label">' + TC.esc(label) + '</div><div class="kpi-value sm"' +
            (tone ? ' style="color:var(--' + tone + ')"' : '') + '>' + TC.esc(String(value)) + '</div></div>';
    }

    function paintKpis() {
        const total = rows.length;
        const sansCours = rows.filter(r => TC.toNumber(r.cours) === null).length;
        const derniere = marche.length ? marche[0].date_seance : null;
        TC.el('obl-kpis').innerHTML =
            box('Obligations cotées', total) +
            box('Sans cours', sansCours, sansCours ? 'orange' : 'green') +
            box('Dernière séance', derniere ? TC.fmtDate(derniere) : '—');
    }

    function paint(list) {
        const tbody = TC.el('obl-tbody');
        TC.el('obl-count').textContent = list.length + ' ligne(s)';
        if (!list.length) {
            tbody.innerHTML = TC.rowsEmpty(8, 'Aucune obligation enregistrée', 'Le scraper BRVM alimente cette table, ou saisissez une ligne ci-dessus.');
            return;
        }
        tbody.innerHTML = list.map(function (r) {
            return '<tr' + (TC.toNumber(r.cours) === null ? ' class="row-warn"' : '') + '>' +
                '<td class="td-key">' + TC.esc(r.code) + '</td>' +
                '<td class="td-muted">' + TC.esc((r.nom || '').slice(0, 46)) + '</td>' +
                '<td class="td-mono td-muted">' + TC.fmtDate(r.date_seance) + '</td>' +
                '<td class="r td-mono">' + TC.fmt(r.cours, 0) + '</td>' +
                '<td class="r td-mono">' + (r.taux_facial != null ? TC.fmt(r.taux_facial, 2) + ' %' : '—') + '</td>' +
                '<td class="td-muted">' + TC.fmtDate(r.date_maturite) + '</td>' +
                '<td class="td-muted">' + (r.dernier_paiement_date ? TC.fmtDate(r.dernier_paiement_date) + ' · ' + TC.fmt(r.dernier_paiement_valeur) : '—') + '</td>' +
                '<td class="r" style="white-space:nowrap;">' +
                '<button class="btn btn-outline btn-ico" data-edit="' + TC.esc(r.code) + '">✎</button> ' +
                '<button class="btn btn-danger btn-ico" data-del="' + TC.esc(r.code) + '">✕</button></td></tr>';
        }).join('');
    }

    function filter() {
        const q = (TC.val('obl-search') || '').toUpperCase();
        paint(!q ? rows : rows.filter(r =>
            String(r.code || '').toUpperCase().indexOf(q) !== -1 ||
            String(r.nom || '').toUpperCase().indexOf(q) !== -1));
    }

    async function load() {
        TC.el('obl-tbody').innerHTML = TC.rowsLoading(8);
        rows = await TC.getAll('obligations', 'select=*&order=code.asc');
        paintKpis();
        filter();
    }

    async function save() {
        const code = String(TC.val('obl-code') || '').toUpperCase();
        if (!code) { TC.say('obl-msg', 'Le code est obligatoire.', 'err'); return; }
        const body = {
            code, nom: TC.val('obl-nom') || null,
            date_seance: TC.toISODate(TC.val('obl-seance')) || null,
            cours: TC.num('obl-cours'), taux_facial: TC.num('obl-taux'), coupon_couru: TC.num('obl-coupon'),
            date_emission: TC.toISODate(TC.val('obl-emission')) || null,
            date_maturite: TC.toISODate(TC.val('obl-maturite')) || null,
            dernier_paiement_date: TC.toISODate(TC.val('obl-pay-date')) || null,
            dernier_paiement_valeur: TC.num('obl-pay-val')
        };
        try {
            await TC.post('obligations', body, 'code');
            TC.say('obl-msg', code + ' enregistrée.', 'ok');
            TC.clear(['obl-code', 'obl-nom', 'obl-seance', 'obl-cours', 'obl-taux', 'obl-coupon', 'obl-emission', 'obl-maturite', 'obl-pay-date', 'obl-pay-val']);
            load();
        } catch (e) { TC.say('obl-msg', e.message, 'err'); }
    }

    function edit(row) {
        TC.modal.open({
            title: row.code,
            subtitle: row.nom || '',
            body: '<div class="form-grid">' + TC.fields([
                { id: 'mo-seance', label: 'Date de séance', type: 'date' },
                { id: 'mo-cours', label: 'Cours du jour', type: 'number' },
                { id: 'mo-taux', label: 'Taux facial (%)', type: 'number', step: '0.01' },
                { id: 'mo-coupon', label: 'Coupon couru', type: 'number' },
                { id: 'mo-emission', label: 'Date d\'émission', type: 'date' },
                { id: 'mo-maturite', label: 'Date de maturité', type: 'date' },
                { id: 'mo-pay-date', label: 'Dernier paiement — date', type: 'date' },
                { id: 'mo-pay-val', label: 'Dernier paiement — valeur', type: 'number' }
            ]) + '</div>',
            afterOpen() {
                TC.setVal('mo-seance', TC.toISODate(row.date_seance) || '');
                TC.setVal('mo-cours', row.cours);
                TC.setVal('mo-taux', row.taux_facial);
                TC.setVal('mo-coupon', row.coupon_couru);
                TC.setVal('mo-emission', TC.toISODate(row.date_emission) || '');
                TC.setVal('mo-maturite', TC.toISODate(row.date_maturite) || '');
                TC.setVal('mo-pay-date', TC.toISODate(row.dernier_paiement_date) || '');
                TC.setVal('mo-pay-val', row.dernier_paiement_valeur);
            },
            async onSave() {
                try {
                    await TC.patch('obligations', 'code=eq.' + encodeURIComponent(row.code), {
                        date_seance: TC.toISODate(TC.val('mo-seance')) || null,
                        cours: TC.num('mo-cours'), taux_facial: TC.num('mo-taux'), coupon_couru: TC.num('mo-coupon'),
                        date_emission: TC.toISODate(TC.val('mo-emission')) || null,
                        date_maturite: TC.toISODate(TC.val('mo-maturite')) || null,
                        dernier_paiement_date: TC.toISODate(TC.val('mo-pay-date')) || null,
                        dernier_paiement_valeur: TC.num('mo-pay-val')
                    });
                    TC.modal.close(); TC.toast('Obligation mise à jour', 'ok'); load();
                } catch (e) { TC.modal.msg(e.message, 'err'); }
            }
        });
    }

    /* ── Agrégats de marché (une ligne par séance) ─────────── */

    function paintMarche(list) {
        const tbody = TC.el('oblm-tbody');
        if (!list.length) { tbody.innerHTML = TC.rowsEmpty(5, 'Aucun agrégat enregistré', 'Le scraper BRVM alimente cette table, ou saisissez une séance ci-dessus.'); return; }
        tbody.innerHTML = list.map(function (r) {
            return '<tr><td class="td-mono td-key">' + TC.fmtDate(r.date_seance) + '</td>' +
                '<td class="r td-mono">' + TC.fmt(r.valeur_transactions, 0) + '</td>' +
                '<td class="r td-mono">' + TC.fmt(r.capitalisation_actions, 0) + '</td>' +
                '<td class="r td-mono">' + TC.fmt(r.capitalisation_obligations, 0) + '</td>' +
                '<td class="r" style="white-space:nowrap;">' +
                '<button class="btn btn-outline btn-ico" data-medit="' + TC.esc(r.date_seance) + '">✎</button> ' +
                '<button class="btn btn-danger btn-ico" data-mdel="' + TC.esc(r.date_seance) + '">✕</button></td></tr>';
        }).join('');
    }

    async function loadMarche() {
        TC.el('oblm-tbody').innerHTML = TC.rowsLoading(5);
        marche = await TC.getAll('obligations_marche', 'select=*&order=date_seance.desc', 200);
        paintKpis();
        paintMarche(marche);
    }

    async function saveMarche() {
        const date = TC.toISODate(TC.val('oblm-date'));
        if (!date) { TC.say('oblm-msg', 'La date de séance est obligatoire.', 'err'); return; }
        try {
            await TC.post('obligations_marche', {
                date_seance: date,
                valeur_transactions: TC.num('oblm-valeur'),
                capitalisation_actions: TC.num('oblm-cap-actions'),
                capitalisation_obligations: TC.num('oblm-cap-oblig')
            }, 'date_seance');
            TC.say('oblm-msg', 'Séance du ' + TC.fmtDate(date) + ' enregistrée.', 'ok');
            TC.clear(['oblm-date', 'oblm-valeur', 'oblm-cap-actions', 'oblm-cap-oblig']);
            loadMarche();
        } catch (e) { TC.say('oblm-msg', e.message, 'err'); }
    }

    function editMarche(row) {
        TC.modal.open({
            title: 'Séance du ' + TC.fmtDate(row.date_seance),
            body: '<div class="form-grid">' + TC.fields([
                { id: 'mm-valeur', label: 'Valeur des transactions', type: 'number' },
                { id: 'mm-cap-actions', label: 'Capitalisation Actions', type: 'number' },
                { id: 'mm-cap-oblig', label: 'Capitalisation Obligations', type: 'number' }
            ]) + '</div>',
            afterOpen() {
                TC.setVal('mm-valeur', row.valeur_transactions);
                TC.setVal('mm-cap-actions', row.capitalisation_actions);
                TC.setVal('mm-cap-oblig', row.capitalisation_obligations);
            },
            async onSave() {
                try {
                    await TC.patch('obligations_marche', 'date_seance=eq.' + encodeURIComponent(row.date_seance), {
                        valeur_transactions: TC.num('mm-valeur'),
                        capitalisation_actions: TC.num('mm-cap-actions'),
                        capitalisation_obligations: TC.num('mm-cap-oblig')
                    });
                    TC.modal.close(); TC.toast('Séance mise à jour', 'ok'); loadMarche();
                } catch (e) { TC.modal.msg(e.message, 'err'); }
            }
        });
    }

    TC.register({
        id: 'obligations',
        label: 'Marché obligataire',
        group: 'marche',
        icon: '◈',
        keywords: 'obligations bond emprunt cours taux facial coupon capitalisation marche',
        view,
        refresh() { load(); loadMarche(); },
        mount() {
            TC.on('obl-save', 'click', save);
            TC.on('obl-clear', 'click', () => { TC.clear(['obl-code', 'obl-nom', 'obl-seance', 'obl-cours', 'obl-taux', 'obl-coupon', 'obl-emission', 'obl-maturite', 'obl-pay-date', 'obl-pay-val']); TC.say('obl-msg', ''); });
            TC.on('obl-reload', 'click', load);
            TC.on('obl-search', 'input', filter);
            TC.on('obl-export', 'click', function () {
                if (!rows.length) return;
                TC.download('obligations-' + TC.today() + '.csv',
                    TC.toCSV(rows, ['code', 'nom', 'date_seance', 'cours', 'taux_facial', 'coupon_couru', 'date_emission', 'date_maturite', 'dernier_paiement_date', 'dernier_paiement_valeur']),
                    'text/csv;charset=utf-8');
            });
            TC.delegate('obl-tbody', '[data-edit]', 'click', n => {
                const row = rows.find(r => r.code === n.dataset.edit); if (row) edit(row);
            });
            TC.delegate('obl-tbody', '[data-del]', 'click', async function (n) {
                const row = rows.find(r => r.code === n.dataset.del);
                if (!row || !TC.confirmTwice('Supprimer l\'obligation ' + row.code + ' ?')) return;
                try { await TC.del('obligations', 'code=eq.' + encodeURIComponent(row.code)); TC.toast('Supprimé', 'ok'); load(); }
                catch (e) { TC.toast(e.message, 'err'); }
            });

            TC.on('oblm-save', 'click', saveMarche);
            TC.on('oblm-clear', 'click', () => { TC.clear(['oblm-date', 'oblm-valeur', 'oblm-cap-actions', 'oblm-cap-oblig']); TC.say('oblm-msg', ''); });
            TC.delegate('oblm-tbody', '[data-medit]', 'click', n => {
                const row = marche.find(r => r.date_seance === n.dataset.medit); if (row) editMarche(row);
            });
            TC.delegate('oblm-tbody', '[data-mdel]', 'click', async function (n) {
                const row = marche.find(r => r.date_seance === n.dataset.mdel);
                if (!row || !TC.confirmTwice('Supprimer les agrégats du ' + TC.fmtDate(row.date_seance) + ' ?')) return;
                try { await TC.del('obligations_marche', 'date_seance=eq.' + encodeURIComponent(row.date_seance)); TC.toast('Supprimé', 'ok'); loadMarche(); }
                catch (e) { TC.toast(e.message, 'err'); }
            });

            load();
            loadMarche();
        }
    });

})(window.TC);
