/* ============================================================
   THE CAPITAL — DIVIDENDES
   Table dividendes_calendrier. L'année est celle de l'exercice
   bénéficiaire, pas celle du paiement : c'est la confusion la plus
   fréquente et elle fausse le rendement affiché dans l'application.
   Le rendement est recalculé depuis le dernier cours connu.
   ============================================================ */
'use strict';

(function (TC) {

    let rows = [];
    let editing = null;
    const sel = TC.selection('div');

    const STATUTS = [
        { v: 'prévisionnel', l: 'Prévisionnel' },
        { v: 'confirmé', l: 'Confirmé' },
        { v: 'payé', l: 'Payé' }
    ];

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">Calendrier des <em>dividendes</em></div>' +
            '<div class="page-sub">Un dividende se rattache à l\'exercice qui l\'a produit, jamais à l\'année où il est versé. Le rendement affiché est recalculé sur le dernier cours de clôture connu : saisi à la main, il vieillit dès la séance suivante.</div></div>' +
            '<div class="page-actions">' +
            '<button class="btn btn-outline btn-sm" id="div-refresh-yield">↻ Recalculer les rendements</button>' +
            '<button class="btn btn-outline btn-sm" id="div-export">⬇ CSV</button></div></div>' +

            '<div class="kpis" id="div-kpis"></div>' +

            '<div class="card accent"><div class="card-head"><span class="card-title" id="div-form-title">Enregistrer un dividende</span>' +
            '<span class="card-tools"><button class="btn btn-outline btn-sm" id="div-cancel-edit" hidden>Annuler la modification</button></span></div>' +
            '<div class="form-grid">' + TC.fields([
                { id: 'd-ticker', label: 'Ticker', upper: true, placeholder: 'SNTS' },
                { id: 'd-annee', label: 'Exercice bénéficiaire', type: 'number', step: '1', col: 'annee', placeholder: String(new Date().getFullYear() - 1), hint: 'Année des comptes, pas celle du versement.' },
                { id: 'd-montant', label: 'Dividende par action', type: 'number', placeholder: '1 250' },
                { id: 'd-detach', label: 'Date de détachement', type: 'date', col: 'date_detachement' },
                { id: 'd-paiement', label: 'Date de paiement', type: 'date' },
                { id: 'd-statut', label: 'Statut', type: 'select', options: STATUTS },
                { id: 'd-rendement', label: 'Rendement %', type: 'number', col: 'taux_rendement', hint: 'Vide : calculé sur le dernier cours connu.' },
                { id: 'd-notes', label: 'Observation', placeholder: 'Acompte, solde, dividende exceptionnel…', wide: true }
            ]) + '</div>' +
            '<div class="card-body tight"><div class="note" id="div-live">Saisissez le ticker et le montant : le rendement se calcule sur le dernier cours enregistré.</div></div>' +
            '<div class="actions"><button class="btn btn-primary" id="div-save">Enregistrer</button>' +
            '<button class="btn btn-outline btn-sm" id="div-clear">Effacer</button>' +
            '<span class="msg" id="div-msg"></span></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Dividendes enregistrés</span>' +
            '<span class="card-tools">' +
            '<input type="search" id="div-search" placeholder="Ticker…" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;width:130px;">' +
            '<select id="div-statut-filter" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;">' +
            '<option value="">Tous statuts</option>' + STATUTS.map(s => '<option value="' + s.v + '">' + s.l + '</option>').join('') + '</select>' +
            '<span class="card-count" id="div-count"></span>' +
            '<button class="btn btn-outline btn-sm" id="div-reload">↺</button></span></div>' +
            '<div class="bulkbar" id="bulk-div"><span class="bulk-count">0 ligne(s)</span>' +
            '<button class="btn btn-danger btn-sm" id="div-bulk-del">Supprimer</button>' +
            '<button class="btn btn-outline btn-sm" id="div-bulk-reset">Désélectionner</button></div>' +
            '<div class="tw capped" id="bulk-div-scope"><table><thead><tr>' +
            '<th><input type="checkbox" class="rowcheck" id="div-all"></th>' +
            '<th>Ticker</th><th>Exercice</th><th class="r">Montant</th><th class="r">Rendement</th>' +
            '<th class="r">Rendement recalculé</th><th>Détachement</th><th>Paiement</th><th>Statut</th>' +
            '<th>Contrôle</th><th></th>' +
            '</tr></thead><tbody id="div-tbody">' + TC.rowsLoading(11) + '</tbody></table></div></div>';
    }

    /* ── Derniers cours, pour le rendement ───────────────── */

    let lastPrices = null;

    async function prices() {
        if (lastPrices) return lastPrices;
        const latest = await TC.get('historique', 'select=date_seance&order=date_seance.desc&limit=1');
        const date = latest && latest[0] && latest[0].date_seance;
        lastPrices = { date, map: {} };
        if (!date) return lastPrices;
        const data = await TC.getAll('historique', 'select=ticker,cours_cloture,cloture&date_seance=eq.' + date);
        (data || []).forEach(r => {
            lastPrices.map[String(r.ticker).toUpperCase()] =
                TC.toNumber(r.cours_cloture !== null && r.cours_cloture !== undefined ? r.cours_cloture : r.cloture);
        });
        return lastPrices;
    }

    function audit(r) {
        const issues = [];
        const montant = TC.toNumber(r.montant);
        const annee = parseInt(r.annee, 10);
        const currentYear = new Date().getFullYear();

        if (montant === null) issues.push('montant absent');
        else if (montant < 0) issues.push('montant négatif');
        if (!Number.isInteger(annee)) issues.push('exercice absent');
        else if (annee > currentYear) issues.push('exercice postérieur à l\'année en cours');

        const detach = TC.toISODate(r.date_detachement || r.ex_date);
        const paiement = TC.toISODate(r.date_paiement);
        if (detach && paiement && detach > paiement) issues.push('détachement postérieur au paiement');
        if (detach && annee && Number(detach.slice(0, 4)) < annee) {
            issues.push('détachement antérieur à l\'exercice');
        }
        if (r.statut === 'payé' && !paiement) issues.push('statut payé sans date de paiement');
        if (r.__computed !== null && r.__computed !== undefined) {
            const published = TC.toNumber(r.taux_rendement);
            if (published !== null && Math.abs(published - r.__computed) > 0.5) {
                issues.push('rendement publié ≠ recalculé');
            }
            if (r.__computed > 25) issues.push('rendement supérieur à 25 %, à vérifier');
        }
        return issues;
    }

    async function load() {
        TC.el('div-tbody').innerHTML = TC.rowsLoading(11);
        lastPrices = null;
        const [data, quotes] = await Promise.all([
            TC.getAll('dividendes_calendrier', 'select=*&order=annee.desc,ticker.asc'),
            prices()
        ]);
        rows = (data || []).map(function (r) {
            const price = quotes.map[String(r.ticker).toUpperCase()];
            const montant = TC.toNumber(r.montant !== null && r.montant !== undefined ? r.montant : r.montant_net);
            r.__price = price || null;
            r.__computed = (price && price > 0 && montant !== null) ? Math.round((montant / price) * 10000) / 100 : null;
            r.__issues = audit(r);
            return r;
        });
        paintKpis(quotes.date);
        paint(rows);
    }

    function paintKpis(priceDate) {
        const year = new Date().getFullYear();
        const thisYear = rows.filter(r => Number(r.annee) === year - 1).length;
        const upcoming = rows.filter(r => {
            const d = TC.toISODate(r.date_detachement || r.ex_date);
            return d && d >= TC.today();
        }).length;
        const yields = rows.map(r => r.__computed).filter(v => v !== null && v > 0);
        const median = yields.length ? yields.slice().sort((a, b) => a - b)[Math.floor(yields.length / 2)] : null;
        const flagged = rows.filter(r => r.__issues.length).length;

        TC.el('div-kpis').innerHTML =
            box('Dividendes', rows.length) +
            box('Exercice ' + (year - 1), thisYear) +
            box('Détachements à venir', upcoming) +
            box('Rendement médian', median !== null ? median.toFixed(2) + ' %' : '—') +
            box('À vérifier', flagged, flagged ? 'orange' : 'green') +
            '<div class="kpi"><div class="kpi-label">Cours de référence</div>' +
            '<div class="kpi-value sm">' + (priceDate ? TC.fmtDate(priceDate) : '—') + '</div>' +
            '<div class="kpi-sub">base du rendement recalculé</div></div>';
    }

    function box(label, value, tone) {
        return '<div class="kpi"><div class="kpi-label">' + TC.esc(label) + '</div><div class="kpi-value sm"' +
            (tone ? ' style="color:var(--' + tone + ')"' : '') + '>' + TC.esc(String(value)) + '</div></div>';
    }

    function paint(list) {
        const tbody = TC.el('div-tbody');
        TC.el('div-count').textContent = list.length + ' ligne(s)';
        if (!list.length) {
            tbody.innerHTML = TC.rowsEmpty(11, 'Aucun dividende enregistré',
                'Le calendrier alimente le screener dividendes de l\'application.');
            return;
        }
        sel.reset();
        tbody.innerHTML = list.map(function (r) {
            const statut = r.statut || 'confirmé';
            const tone = statut === 'payé' ? 'badge-green' : statut === 'prévisionnel' ? 'badge-orange' : 'badge-gold';
            return '<tr class="' + (r.__issues.length ? 'row-warn' : '') + '">' +
                '<td><input type="checkbox" class="rowcheck" data-id="' + r.id + '"></td>' +
                '<td class="td-key">' + TC.esc(r.ticker) + '</td>' +
                '<td class="td-mono">' + TC.esc(r.annee || r.exercice || '—') + '</td>' +
                '<td class="r td-mono">' + TC.fmt(r.montant !== null && r.montant !== undefined ? r.montant : r.montant_net) + '</td>' +
                '<td class="r td-mono">' + TC.fmtPct(r.taux_rendement) + '</td>' +
                '<td class="r td-mono td-muted">' + (r.__computed !== null ? r.__computed.toFixed(2) + ' %' : '—') + '</td>' +
                '<td class="td-muted">' + TC.fmtDate(r.date_detachement || r.ex_date) + '</td>' +
                '<td class="td-muted">' + TC.fmtDate(r.date_paiement) + '</td>' +
                '<td><span class="badge ' + tone + '">' + TC.esc(statut) + '</span></td>' +
                '<td>' + (r.__issues.length
                    ? '<span class="badge badge-orange" title="' + TC.esc(r.__issues.join(' · ')) + '">' + TC.esc(r.__issues[0]) + '</span>'
                    : '<span class="badge badge-green">conforme</span>') + '</td>' +
                '<td class="r" style="white-space:nowrap;">' +
                '<button class="btn btn-outline btn-ico" data-edit="' + r.id + '">✎</button> ' +
                '<button class="btn btn-danger btn-ico" data-del="' + r.id + '">✕</button></td></tr>';
        }).join('');
    }

    function filter() {
        const q = TC.val('div-search').toUpperCase();
        const statut = TC.val('div-statut-filter');
        paint(rows.filter(r =>
            (!q || String(r.ticker).toUpperCase().indexOf(q) !== -1) &&
            (!statut || (r.statut || 'confirmé') === statut)));
    }

    async function paintLive() {
        const ticker = TC.val('d-ticker').toUpperCase();
        const montant = TC.num('d-montant');
        const node = TC.el('div-live');
        if (!ticker || montant === null) {
            node.className = 'note';
            node.innerHTML = 'Saisissez le ticker et le montant : le rendement se calcule sur le dernier cours enregistré.';
            return;
        }
        const quotes = await prices();
        const price = quotes.map[ticker];
        if (!price) {
            node.className = 'note warn';
            node.innerHTML = '<strong>Aucun cours connu pour ' + TC.esc(ticker) + '</strong> à la séance du ' +
                (quotes.date ? TC.fmtDate(quotes.date) : 'jour') + '. Le rendement ne peut pas être calculé.';
            return;
        }
        const yieldValue = (montant / price) * 100;
        node.className = 'note' + (yieldValue > 25 ? ' warn' : '');
        node.innerHTML = '<strong>Rendement calculé : ' + yieldValue.toFixed(2) + ' %</strong> — ' +
            TC.fmt(montant) + ' F sur un cours de ' + TC.fmt(price) + ' F au ' + TC.fmtDate(quotes.date) +
            (yieldValue > 25 ? '<br>Un rendement supérieur à 25 % traduit presque toujours une erreur de montant ou un cours périmé.' : '');
    }

    async function save() {
        const ticker = TC.val('d-ticker').toUpperCase();
        const annee = TC.int('d-annee');
        const montant = TC.num('d-montant');

        if (!ticker || annee === null || montant === null) {
            TC.say('div-msg', 'Ticker, exercice et montant sont obligatoires.', 'err'); return;
        }
        const known = await TC.tickerSet();
        if (!known.has(ticker)) {
            TC.say('div-msg', 'Le ticker ' + ticker + ' n\'existe pas dans le référentiel.', 'err'); return;
        }

        let rendement = TC.num('d-rendement');
        if (rendement === null) {
            const quotes = await prices();
            const price = quotes.map[ticker];
            if (price && price > 0) rendement = Math.round((montant / price) * 10000) / 100;
        }

        const body = {
            ticker, annee, exercice: annee,
            montant, montant_net: montant,
            taux_rendement: rendement, rendement,
            date_detachement: TC.val('d-detach') || null,
            ex_date: TC.val('d-detach') || null,
            date_paiement: TC.val('d-paiement') || null,
            statut: TC.val('d-statut'),
            notes: TC.val('d-notes') || null
        };

        const issues = audit(body);
        if (issues.length && !confirm('Points à vérifier :\n\n' + issues.map(i => '· ' + i).join('\n') +
            '\n\nEnregistrer malgré tout ?')) return;

        try {
            if (editing) {
                await TC.patch('dividendes_calendrier', 'id=eq.' + editing, body);
                TC.say('div-msg', 'Dividende modifié.', 'ok');
                resetForm();
            } else {
                await TC.post('dividendes_calendrier', body);
                TC.say('div-msg', ticker + ' — exercice ' + annee + ' enregistré.', 'ok');
                TC.clear(['d-montant', 'd-rendement', 'd-detach', 'd-paiement', 'd-notes']);
            }
            load();
        } catch (e) { TC.say('div-msg', e.message, 'err'); }
    }

    /* L'édition se fait dans le formulaire de la section : une fenêtre modale
       de plus sur une page déjà dense n'apporte rien et masque le contexte. */
    function edit(row) {
        editing = row.id;
        TC.setVal('d-ticker', row.ticker);
        TC.setVal('d-annee', row.annee || row.exercice);
        TC.setVal('d-montant', row.montant !== null && row.montant !== undefined ? row.montant : row.montant_net);
        TC.setVal('d-rendement', row.taux_rendement);
        TC.setVal('d-detach', TC.toISODate(row.date_detachement || row.ex_date) || '');
        TC.setVal('d-paiement', TC.toISODate(row.date_paiement) || '');
        TC.setVal('d-statut', row.statut || 'confirmé');
        TC.setVal('d-notes', row.notes);
        TC.el('div-form-title').textContent = 'Modifier ' + row.ticker + ' — exercice ' + (row.annee || row.exercice);
        TC.el('div-save').textContent = 'Enregistrer la modification';
        TC.el('div-cancel-edit').hidden = false;
        TC.say('div-msg', 'Modification en cours. Les champs sont pré-remplis.', 'info');
        paintLive();
        TC.el('d-montant').focus();
        TC.el('panel-dividendes').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function resetForm() {
        editing = null;
        TC.clear(['d-ticker', 'd-annee', 'd-montant', 'd-rendement', 'd-detach', 'd-paiement', 'd-notes']);
        TC.setVal('d-statut', 'confirmé');
        TC.el('div-form-title').textContent = 'Enregistrer un dividende';
        TC.el('div-save').textContent = 'Enregistrer';
        TC.el('div-cancel-edit').hidden = true;
        TC.say('div-msg', '');
        paintLive();
    }

    async function refreshYields() {
        const drift = rows.filter(r => {
            const published = TC.toNumber(r.taux_rendement);
            return r.__computed !== null && (published === null || Math.abs(published - r.__computed) > 0.05);
        });
        if (!drift.length) { TC.toast('Tous les rendements sont à jour', 'ok'); return; }
        if (!confirm('Recalculer ' + drift.length + ' rendement(s) sur le dernier cours de clôture connu ?\n\n' +
            'Le rendement d\'un dividende ancien sera exprimé au cours d\'aujourd\'hui, pas à celui du détachement.')) return;
        let done = 0;
        for (const r of drift) {
            try {
                await TC.patch('dividendes_calendrier', 'id=eq.' + r.id,
                    { taux_rendement: r.__computed, rendement: r.__computed });
                done++;
            } catch (e) { /* bilan */ }
        }
        TC.toast(done + ' rendement(s) recalculés', 'ok');
        load();
    }

    TC.register({
        id: 'dividendes',
        label: 'Dividendes',
        group: 'societes',
        icon: '◆',
        keywords: 'dividende rendement detachement paiement exercice',
        view,
        refresh: load,
        mount() {
            const tickerInput = TC.el('d-ticker');
            if (tickerInput) tickerInput.setAttribute('list', 'tickers-list');
            TC.on('div-save', 'click', save);
            TC.on('div-clear', 'click', resetForm);
            TC.on('div-cancel-edit', 'click', resetForm);
            TC.on('div-reload', 'click', load);
            TC.on('div-search', 'input', filter);
            TC.on('div-statut-filter', 'change', filter);
            TC.on('div-refresh-yield', 'click', refreshYields);
            TC.on('d-ticker', 'input', paintLive);
            TC.on('d-montant', 'input', paintLive);
            TC.on('div-export', 'click', function () {
                if (!rows.length) return;
                TC.download('dividendes-' + TC.today() + '.csv',
                    TC.toCSV(rows, ['ticker', 'annee', 'montant', 'taux_rendement', 'date_detachement', 'date_paiement', 'statut', 'notes']),
                    'text/csv;charset=utf-8');
            });
            TC.on('div-all', 'change', e => sel.all(rows.map(r => r.id), e.target.checked));
            TC.on('div-bulk-reset', 'click', () => sel.reset());
            TC.on('div-bulk-del', 'click', async function () {
                const ids = sel.ids();
                if (!ids.length) return;
                if (!TC.confirmTwice('Supprimer ' + ids.length + ' dividende(s) ?', 'le screener dividendes perdra ces lignes')) return;
                let done = 0;
                for (const id of ids) { try { await TC.del('dividendes_calendrier', 'id=eq.' + id); done++; } catch (e) { /* bilan */ } }
                TC.toast(done + ' ligne(s) supprimées', 'ok');
                load();
            });
            TC.delegate('div-tbody', '.rowcheck', 'change', n => sel.toggle(n.dataset.id, n.checked));
            TC.delegate('div-tbody', '[data-edit]', 'click', n => {
                const row = rows.find(r => String(r.id) === n.dataset.edit); if (row) edit(row);
            });
            TC.delegate('div-tbody', '[data-del]', 'click', async function (n) {
                const row = rows.find(r => String(r.id) === n.dataset.del);
                if (!row || !TC.confirmTwice('Supprimer le dividende ' + row.ticker + ' — ' + (row.annee || '') + ' ?')) return;
                try { await TC.del('dividendes_calendrier', 'id=eq.' + row.id); TC.toast('Supprimé', 'ok'); load(); }
                catch (e) { TC.toast(e.message, 'err'); }
            });
            load();
        }
    });

})(window.TC);
