/* ============================================================
   THE CAPITAL — DIVIDENDES
   Table dividendes_calendrier. L'année est celle de l'exercice
   bénéficiaire, pas celle du paiement : c'est la confusion la plus
   fréquente et elle fausse le rendement affiché dans l'application.
   Le rendement est recalculé sur le cours de clôture à la date de
   détachement (ou la dernière séance connue avant cette date) : un
   rendement historique doit s'exprimer au cours du jour où l'action
   a effectivement perdu son coupon, pas au cours d'aujourd'hui.
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
            '<div class="page-sub">Un dividende se rattache à l\'exercice qui l\'a produit, jamais à l\'année où il est versé. Le montant saisi est le dividende brut ; le net est calculé automatiquement après retenue de l\'IRVM. Le rendement affiché est recalculé sur le cours de clôture à la date de détachement (ou la séance précédente la plus proche) : sans date de détachement, il est estimé sur le dernier cours connu.</div></div>' +
            '<div class="page-actions">' +
            '<button class="btn btn-outline btn-sm" id="div-refresh-yield">↻ Recalculer les rendements</button>' +
            '<button class="btn btn-outline btn-sm" id="div-refresh-net">↻ Recalculer les nets (IRVM)</button>' +
            '<button class="btn btn-outline btn-sm" id="div-export">⬇ CSV</button></div></div>' +

            '<div class="kpis" id="div-kpis"></div>' +

            '<div class="card accent"><div class="card-head"><span class="card-title" id="div-form-title">Enregistrer un dividende</span>' +
            '<span class="card-tools"><button class="btn btn-outline btn-sm" id="div-cancel-edit" hidden>Annuler la modification</button></span></div>' +
            '<div class="form-grid">' + TC.fields([
                { id: 'd-ticker', label: 'Ticker', upper: true, placeholder: 'SNTS' },
                { id: 'd-annee', label: 'Exercice bénéficiaire', type: 'number', step: '1', col: 'annee', placeholder: String(new Date().getFullYear() - 1), hint: 'Année des comptes, pas celle du versement.' },
                { id: 'd-montant', label: 'Dividende brut par action', type: 'number', col: 'montant', placeholder: '229', hint: 'Montant voté, avant retenue de l\'IRVM.' },
                { id: 'd-irvm', label: 'IRVM (%)', type: 'number', step: '0.1', col: 'taux_irvm', placeholder: '12', hint: 'Impôt sur le Revenu des Valeurs Mobilières, retenu à la source. 12 % par défaut, modifiable par ligne.' },
                { id: 'd-detach', label: 'Date de détachement', type: 'date', col: 'date_detachement' },
                { id: 'd-paiement', label: 'Date de paiement', type: 'date' },
                { id: 'd-statut', label: 'Statut', type: 'select', options: STATUTS },
                { id: 'd-rendement', label: 'Rendement %', type: 'number', col: 'taux_rendement', hint: 'Vide : calculé sur le cours de clôture à la date de détachement.' },
                { id: 'd-notes', label: 'Observation', placeholder: 'Acompte, solde, dividende exceptionnel…', wide: true }
            ]) + '</div>' +
            '<div class="card-body tight"><div class="note" id="div-live">Saisissez le ticker, le montant et la date de détachement : le rendement se calcule sur le cours de clôture de ce jour-là.</div></div>' +
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
            '<th>Ticker</th><th>Exercice</th><th class="r">Brut</th><th class="r">IRVM</th><th class="r">Net</th><th class="r">Rendement</th>' +
            '<th class="r">Rendement recalculé</th><th>Détachement</th><th>Paiement</th><th>Statut</th>' +
            '<th>Contrôle</th><th></th>' +
            '</tr></thead><tbody id="div-tbody">' + TC.rowsLoading(13) + '</tbody></table></div></div>';
    }

    /* ── Cours de clôture au jour de détachement, pour le rendement ──
       Le rendement d'un dividende doit s'exprimer au cours du jour où
       l'action a perdu son coupon, pas au cours d'aujourd'hui : sinon
       un dividende ancien affiche un rendement qui varie à chaque
       séance sans que rien n'ait changé sur ce dividende. ──────── */

    /* La table historique dépasse 150 000 lignes depuis 1998 : la charger
       en entier pour en tirer 188 points de rendement serait très lent.
       On ne va donc chercher, ticker par ticker, que les séances aux
       dates de détachement effectivement utilisées par le calendrier. */
    let priceCache = null; /* 'TICKER|ISO_DATE' → {date, price} | null */

    function extractPrice(r) {
        const price = TC.toNumber(r.cours_cloture !== null && r.cours_cloture !== undefined ? r.cours_cloture : r.cloture);
        return price !== null && price > 0 ? { date: r.date_seance, price } : null;
    }

    /** Résout, pour chaque ligne, le cours de clôture à sa date de détachement (avec repli). */
    async function loadPriceHistory(rowsData) {
        priceCache = {};
        const byTicker = {};
        (rowsData || []).forEach(r => {
            const ticker = String(r.ticker || '').toUpperCase();
            if (!ticker) return;
            const detach = TC.toISODate(r.date_detachement || r.ex_date) || '';
            (byTicker[ticker] = byTicker[ticker] || new Set()).add(detach);
        });

        await Promise.all(Object.keys(byTicker).map(async ticker => {
            const dates = Array.from(byTicker[ticker]);
            const withDate = dates.filter(Boolean);
            let exact = {};
            if (withDate.length) {
                const data = await TC.get('historique',
                    'select=date_seance,cours_cloture,cloture&ticker=eq.' + encodeURIComponent(ticker) +
                    '&date_seance=in.(' + withDate.join(',') + ')');
                (data || []).forEach(row => {
                    const p = extractPrice(row);
                    if (p) exact[row.date_seance] = p;
                });
            }
            await Promise.all(dates.map(async d => {
                const key = ticker + '|' + d;
                priceCache[key] = (d && exact[d]) || await priceForTickerAtDate(ticker, d || null);
            }));
        }));
    }

    function cachedPrice(ticker, isoDate) {
        const key = String(ticker || '').toUpperCase() + '|' + (isoDate || '');
        return (priceCache && priceCache[key]) || null;
    }

    /** Lookup ponctuel pour le formulaire, ou repli quand le cache n'a pas de correspondance exacte. */
    async function priceForTickerAtDate(ticker, isoDate) {
        if (!ticker) return null;
        let query = 'select=date_seance,cours_cloture,cloture&ticker=eq.' + encodeURIComponent(ticker);
        query += isoDate ? '&date_seance=lte.' + isoDate : '';
        query += '&order=date_seance.desc&limit=1';
        const data = await TC.get('historique', query);
        if (data && data.length) {
            const p = extractPrice(data[0]);
            if (p) return p;
        }
        if (!isoDate) return null;
        /* Détachement antérieur à toute séance connue : on retombe sur la première disponible. */
        const future = await TC.get('historique',
            'select=date_seance,cours_cloture,cloture&ticker=eq.' + encodeURIComponent(ticker) +
            '&date_seance=gte.' + isoDate + '&order=date_seance.asc&limit=1');
        return (future && future.length) ? extractPrice(future[0]) : null;
    }

    /* Dividende net = brut - IRVM retenu à la source (12 % par défaut, modifiable par ligne). */
    function netOf(brut, irvm) {
        const montant = TC.toNumber(brut);
        const taux = irvm !== null && irvm !== undefined && irvm !== '' ? TC.toNumber(irvm) : 12;
        if (montant === null || taux === null) return null;
        return Math.round(montant * (1 - taux / 100) * 100) / 100;
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
        TC.el('div-tbody').innerHTML = TC.rowsLoading(13);
        const data = await TC.getAll('dividendes_calendrier', 'select=*&order=annee.desc,ticker.asc');
        await loadPriceHistory(data);
        rows = (data || []).map(function (r) {
            const ticker = String(r.ticker).toUpperCase();
            const detach = TC.toISODate(r.date_detachement || r.ex_date);
            const priceInfo = cachedPrice(ticker, detach);
            const montant = TC.toNumber(r.montant !== null && r.montant !== undefined ? r.montant : r.montant_net);
            r.__price = priceInfo ? priceInfo.price : null;
            r.__priceDate = priceInfo ? priceInfo.date : null;
            r.__computed = (r.__price && montant !== null) ? Math.round((montant / r.__price) * 10000) / 100 : null;
            r.__irvm = r.taux_irvm !== null && r.taux_irvm !== undefined ? TC.toNumber(r.taux_irvm) : 12;
            r.__net = netOf(r.montant, r.__irvm);
            r.__issues = audit(r);
            return r;
        });
        paintKpis();
        paint(rows);
    }

    function paintKpis() {
        const year = new Date().getFullYear();
        const thisYear = rows.filter(r => Number(r.annee) === year - 1).length;
        const upcoming = rows.filter(r => {
            const d = TC.toISODate(r.date_detachement || r.ex_date);
            return d && d >= TC.today();
        }).length;
        const yields = rows.map(r => r.__computed).filter(v => v !== null && v > 0);
        const median = yields.length ? yields.slice().sort((a, b) => a - b)[Math.floor(yields.length / 2)] : null;
        const flagged = rows.filter(r => r.__issues.length).length;
        const missingPrice = rows.filter(r => r.__price === null).length;

        TC.el('div-kpis').innerHTML =
            box('Dividendes', rows.length) +
            box('Exercice ' + (year - 1), thisYear) +
            box('Détachements à venir', upcoming) +
            box('Rendement médian', median !== null ? median.toFixed(2) + ' %' : '—') +
            box('À vérifier', flagged, flagged ? 'orange' : 'green') +
            box('Cours introuvable', missingPrice, missingPrice ? 'orange' : 'green');
    }

    function box(label, value, tone) {
        return '<div class="kpi"><div class="kpi-label">' + TC.esc(label) + '</div><div class="kpi-value sm"' +
            (tone ? ' style="color:var(--' + tone + ')"' : '') + '>' + TC.esc(String(value)) + '</div></div>';
    }

    function paint(list) {
        const tbody = TC.el('div-tbody');
        TC.el('div-count').textContent = list.length + ' ligne(s)';
        if (!list.length) {
            tbody.innerHTML = TC.rowsEmpty(13, 'Aucun dividende enregistré',
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
                '<td class="r td-mono td-muted">' + (r.__irvm !== null && r.__irvm !== undefined ? r.__irvm.toFixed(1) + ' %' : '—') + '</td>' +
                '<td class="r td-mono">' + TC.fmt(r.__net) + '</td>' +
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
        const detach = TC.val('d-detach') || null;
        const node = TC.el('div-live');
        const irvmRaw = TC.num('d-irvm');
        const irvm = irvmRaw !== null ? irvmRaw : 12;
        const net = netOf(montant, irvm);

        if (!ticker || montant === null) {
            node.className = 'note';
            node.innerHTML = 'Saisissez le ticker et le montant brut : le net et le rendement se calculent automatiquement.';
            return;
        }

        const netLine = '<div>Brut ' + TC.fmt(montant) + ' F − IRVM ' + irvm.toFixed(1) + ' % (' +
            TC.fmt(Math.round((montant - net) * 100) / 100) + ' F) = <strong>net ' + TC.fmt(net) + ' F</strong> par action.</div>';

        const priceInfo = await priceForTickerAtDate(ticker, detach);
        if (!priceInfo) {
            node.className = 'note warn';
            node.innerHTML = netLine + '<strong>Aucun cours connu pour ' + TC.esc(ticker) + '</strong>' +
                (detach ? ' à la date de détachement (' + TC.fmtDate(detach) + ') ni avant.' : ', aucune séance enregistrée.') +
                ' Le rendement ne peut pas être calculé.';
            return;
        }
        const yieldValue = (montant / priceInfo.price) * 100;
        const sameDay = detach && priceInfo.date === detach;
        node.className = 'note' + (yieldValue > 25 ? ' warn' : '');
        node.innerHTML = netLine + '<strong>Rendement calculé : ' + yieldValue.toFixed(2) + ' %</strong> — ' +
            TC.fmt(montant) + ' F (brut) sur un cours de ' + TC.fmt(priceInfo.price) + ' F ' +
            (detach ? (sameDay ? 'au détachement du ' : 'à la dernière séance connue avant le détachement, le ') : 'au dernier cours connu du ') +
            TC.fmtDate(priceInfo.date) +
            (!detach ? '<br>Sans date de détachement saisie, ce rendement n\'est qu\'une estimation.' : '') +
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
            const detach = TC.val('d-detach') || null;
            const priceInfo = await priceForTickerAtDate(ticker, detach);
            if (priceInfo) rendement = Math.round((montant / priceInfo.price) * 10000) / 100;
        }

        const irvmInput = TC.num('d-irvm');
        const irvm = irvmInput !== null ? irvmInput : 12;
        const net = netOf(montant, irvm);

        const body = {
            ticker, annee, exercice: annee,
            montant, montant_net: net, taux_irvm: irvm,
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
                TC.setVal('d-irvm', 12);
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
        TC.setVal('d-irvm', row.taux_irvm !== null && row.taux_irvm !== undefined ? row.taux_irvm : 12);
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
        TC.setVal('d-irvm', 12);
        TC.el('div-form-title').textContent = 'Enregistrer un dividende';
        TC.el('div-save').textContent = 'Enregistrer';
        TC.el('div-cancel-edit').hidden = true;
        TC.say('div-msg', '');
        paintLive();
    }

    async function refreshNet() {
        const drift = rows.filter(r => {
            const expected = netOf(r.montant, r.__irvm);
            return expected !== null && TC.toNumber(r.montant_net) !== expected;
        });
        if (!drift.length) { TC.toast('Tous les nets sont à jour', 'ok'); return; }
        if (!confirm('Recalculer ' + drift.length + ' dividende(s) net(s) ?\n\n' +
            'Net = brut − IRVM (12 % par défaut, ou le taux déjà saisi sur la ligne).')) return;
        let done = 0;
        for (const r of drift) {
            try {
                await TC.patch('dividendes_calendrier', 'id=eq.' + r.id,
                    { montant_net: r.__net, taux_irvm: r.__irvm });
                done++;
            } catch (e) { /* bilan */ }
        }
        TC.toast(done + ' net(s) recalculés', 'ok');
        load();
    }

    async function refreshYields() {
        const drift = rows.filter(r => {
            const published = TC.toNumber(r.taux_rendement);
            return r.__computed !== null && (published === null || Math.abs(published - r.__computed) > 0.05);
        });
        if (!drift.length) { TC.toast('Tous les rendements sont à jour', 'ok'); return; }
        if (!confirm('Recalculer ' + drift.length + ' rendement(s) sur le cours de clôture à la date de détachement de chaque ligne ?')) return;
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
            if (!TC.val('d-irvm')) TC.setVal('d-irvm', 12);
            TC.on('div-save', 'click', save);
            TC.on('div-clear', 'click', resetForm);
            TC.on('div-cancel-edit', 'click', resetForm);
            TC.on('div-reload', 'click', load);
            TC.on('div-search', 'input', filter);
            TC.on('div-statut-filter', 'change', filter);
            TC.on('div-refresh-yield', 'click', refreshYields);
            TC.on('div-refresh-net', 'click', refreshNet);
            TC.on('d-ticker', 'input', paintLive);
            TC.on('d-montant', 'input', paintLive);
            TC.on('d-irvm', 'input', paintLive);
            TC.on('d-detach', 'input', paintLive);
            TC.on('div-export', 'click', function () {
                if (!rows.length) return;
                TC.download('dividendes-' + TC.today() + '.csv',
                    TC.toCSV(rows, ['ticker', 'annee', 'montant', 'taux_irvm', 'montant_net', 'taux_rendement', 'date_detachement', 'date_paiement', 'statut', 'notes']),
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
