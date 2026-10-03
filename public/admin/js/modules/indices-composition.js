/* ============================================================
   THE CAPITAL — COMPOSITION DES INDICES BRVM
   Table indices_composition : une ligne par appartenance d'un titre
   à un indice sur une période (date_debut = entrée, date_fin =
   sortie, vide tant que le titre en fait partie). L'historique des
   révisions trimestrielles du BRVM 30 est ainsi conservé : une
   révision ferme les sortants à la date d'effet et ouvre les
   entrants, elle n'écrase jamais la liste précédente.
   ============================================================ */
'use strict';

(function (TC) {

    /* Indices connus. `auto` décrit la règle d'appartenance quand elle
       se déduit des fiches sociétés (compartiment ou secteur) ; le
       BRVM 30 dépend de la liquidité et se saisit d'après l'avis BRVM. */
    const KNOWN = [
        { code: 'BRVM-30', label: 'BRVM 30', size: 30, rule: 'Les 30 valeurs les plus liquides, révision trimestrielle (avis BRVM).' },
        { code: 'BRVM-PRESTIGE', label: 'BRVM Prestige', rule: 'Compartiment Prestige, révision annuelle.', auto: e => up(e.compartiment) === 'PRESTIGE' },
        { code: 'BRVM-PRINCIPAL', label: 'BRVM Principal', rule: 'Compartiment Principal.', auto: e => up(e.compartiment) === 'PRINCIPAL' },
        { code: 'BRVM-COMPOSITE', label: 'BRVM Composite', rule: 'Toutes les actions cotées.', auto: () => true },
        { code: 'BRVM-TELECOMMUNICATIONS', label: 'BRVM Télécommunications', rule: 'Secteur Télécommunications.', auto: sector('Télécommunications') },
        { code: 'BRVM-CONSOMMATION-DISCRETIONNAIRE', label: 'BRVM Consommation discrétionnaire', rule: 'Secteur Consommation discrétionnaire.', auto: sector('Consommation discrétionnaire') },
        { code: 'BRVM-SERVICES-FINANCIERS', label: 'BRVM Services financiers', rule: 'Secteur Services financiers.', auto: sector('Services Financiers') },
        { code: 'BRVM-CONSOMMATION-DE-BASE', label: 'BRVM Consommation de base', rule: 'Secteur Consommation de base.', auto: sector('Consommation de base') },
        { code: 'BRVM-INDUSTRIELS', label: 'BRVM Industriels', rule: 'Secteur Industriels.', auto: sector('Industriels') },
        { code: 'BRVM-ENERGIE', label: 'BRVM Énergie', rule: 'Secteur Énergie.', auto: sector('Energie') },
        { code: 'BRVM-SERVICES-PUBLICS', label: 'BRVM Services publics', rule: 'Secteur Services publics.', auto: sector('Services Publics') }
    ];

    let rows = [];
    let companies = [];
    let current = 'BRVM-30';
    let pending = null;

    function up(v) { return String(v || '').trim().toUpperCase(); }
    function norm(v) { return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase(); }
    function sector(name) { return e => norm(e.secteur) === norm(name); }
    function meta(code) { return KNOWN.find(k => k.code === code) || { code, label: code, rule: 'Indice personnalisé.' }; }
    function company(ticker) { return companies.find(c => c.ticker === ticker) || null; }

    /** Appartenance en vigueur à une date donnée (bornes : entrée incluse, sortie exclue). */
    function activeAt(row, date) {
        return row.date_debut <= date && (!row.date_fin || row.date_fin > date);
    }
    function membersAt(code, date) {
        return rows.filter(r => r.indice === code && activeAt(r, date))
            .sort((a, b) => a.ticker.localeCompare(b.ticker));
    }

    function codes() {
        const set = new Set(KNOWN.map(k => k.code));
        rows.forEach(r => set.add(r.indice));
        return Array.from(set);
    }

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">Composition <em>des indices</em></div>' +
            '<div class="page-sub">Valeurs qui composent chaque indice BRVM, avec l\'historique des révisions. Une révision ferme les sortants à la date d\'effet et ouvre les entrants : la composition passée reste consultable à n\'importe quelle date. Ces listes sont affichées dans l\'application (page Marché).</div></div>' +
            '<div class="page-actions"><button class="btn btn-outline btn-sm" id="icp-export">⬇ CSV</button>' +
            '<button class="btn btn-outline btn-sm" id="icp-reload">↺</button></div></div>' +

            '<div class="kpis" id="icp-kpis"></div>' +

            '<div class="card accent"><div class="card-head"><span class="card-title">Indice et date</span></div>' +
            '<div class="form-grid">' +
            '<div class="field"><label for="icp-index">Indice</label><select id="icp-index"></select></div>' +
            '<div class="field"><label for="icp-date">Composition au</label><input type="date" id="icp-date"></div>' +
            '<div class="field"><label for="icp-new-code">Nouvel indice (code)</label><input type="text" id="icp-new-code" data-upper="1" placeholder="BRVM-10"></div>' +
            '<div class="field"><label>&nbsp;</label><button class="btn btn-outline btn-sm" id="icp-new-add">Créer cet indice</button></div>' +
            '</div><div class="hint" id="icp-rule" style="padding:0 16px 14px;"></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title" id="icp-title">Composition</span>' +
            '<span class="card-tools"><span class="card-count" id="icp-count"></span></span></div>' +
            '<div class="tw capped"><table><thead><tr>' +
            '<th>Ticker</th><th>Société</th><th>Secteur</th><th>Depuis</th><th>Jusqu\'au</th><th class="r">Poids %</th><th>Note</th><th></th>' +
            '</tr></thead><tbody id="icp-tbody">' + TC.rowsLoading(8) + '</tbody></table></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Ajouter une valeur</span></div>' +
            '<div class="form-grid">' +
            '<div class="field"><label for="icp-add-ticker">Société</label><select id="icp-add-ticker"></select></div>' +
            '<div class="field"><label for="icp-add-date">Date d\'entrée</label><input type="date" id="icp-add-date"></div>' +
            '<div class="field"><label for="icp-add-poids">Poids % (facultatif)</label><input type="number" step="any" id="icp-add-poids"></div>' +
            '<div class="field"><label for="icp-add-notes">Note</label><input type="text" id="icp-add-notes" placeholder="Avis BRVM n°…"></div>' +
            '</div><div class="actions"><button class="btn btn-primary" id="icp-add">Ajouter à l\'indice</button>' +
            '<span class="msg" id="icp-add-msg"></span></div></div>' +

            '<div class="card accent"><div class="card-head"><span class="card-title">Révision complète</span></div>' +
            '<div class="card-body"><div class="hint" style="margin-bottom:10px;">Collez la liste complète des tickers après révision (séparés par des virgules, espaces ou retours à la ligne). L\'aperçu indique les entrées et les sorties avant toute écriture.</div>' +
            '<div class="form-grid">' +
            '<div class="field wide"><label for="icp-rev-list">Nouvelle composition</label><textarea id="icp-rev-list" rows="4" placeholder="SNTS, ORAC, SGBC, ECOC, …"></textarea></div>' +
            '<div class="field"><label for="icp-rev-date">Date d\'effet</label><input type="date" id="icp-rev-date"></div>' +
            '<div class="field"><label for="icp-rev-notes">Référence</label><input type="text" id="icp-rev-notes" placeholder="Avis BRVM du 01/01/2027"></div>' +
            '</div></div>' +
            '<div class="actions"><button class="btn btn-outline btn-sm" id="icp-rev-current">Reprendre la composition actuelle</button>' +
            '<button class="btn btn-outline btn-sm" id="icp-rev-auto">Pré-remplir depuis les fiches sociétés</button>' +
            '<button class="btn btn-outline btn-sm" id="icp-rev-preview">Aperçu</button>' +
            '<button class="btn btn-primary" id="icp-rev-apply" disabled>Appliquer la révision</button>' +
            '<span class="msg" id="icp-rev-msg"></span></div>' +
            '<div id="icp-rev-diff" style="padding:0 16px 14px;"></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Historique des révisions</span></div>' +
            '<div class="tw capped"><table><thead><tr><th>Date d\'effet</th><th class="r">Taille</th><th>Entrées</th><th>Sorties</th></tr></thead>' +
            '<tbody id="icp-history">' + TC.rowsLoading(4) + '</tbody></table></div></div>';
    }

    async function load() {
        TC.el('icp-tbody').innerHTML = TC.rowsLoading(8);
        const [data, ents] = await Promise.all([
            TC.getAll('indices_composition', 'select=*&order=indice.asc,ticker.asc,date_debut.asc'),
            companies.length ? Promise.resolve(companies) : TC.getAll('entreprises', 'select=ticker,nom,secteur,compartiment,actif&order=ticker.asc')
        ]);
        rows = data || [];
        companies = (ents || []).filter(c => c.actif !== false);
        paintSelectors();
        paint();
    }

    function paintSelectors() {
        const sel = TC.el('icp-index');
        sel.innerHTML = codes().map(c => '<option value="' + TC.esc(c) + '"' + (c === current ? ' selected' : '') + '>' +
            TC.esc(meta(c).label) + '</option>').join('');
        const add = TC.el('icp-add-ticker');
        if (!add.options.length) {
            add.innerHTML = companies.map(c => '<option value="' + TC.esc(c.ticker) + '">' +
                TC.esc(c.ticker + ' — ' + (c.nom || '')) + '</option>').join('');
        }
    }

    function box(label, value, tone) {
        return '<div class="kpi"><div class="kpi-label">' + TC.esc(label) + '</div><div class="kpi-value sm"' +
            (tone ? ' style="color:var(--' + tone + ')"' : '') + '>' + TC.esc(String(value)) + '</div></div>';
    }

    function paintKpis() {
        const today = TC.today();
        const b30 = membersAt('BRVM-30', today).length;
        const prestige = membersAt('BRVM-PRESTIGE', today).length;
        const indexes = new Set(rows.filter(r => activeAt(r, today)).map(r => r.indice)).size;
        const last = rows.filter(r => r.indice === 'BRVM-30').reduce((m, r) => {
            [r.date_debut, r.date_fin].forEach(d => { if (d && d <= today && d > m) m = d; });
            return m;
        }, '');
        TC.el('icp-kpis').innerHTML =
            box('Indices renseignés', indexes) +
            box('BRVM 30 — valeurs', b30, b30 === 30 ? 'green' : 'orange') +
            box('BRVM Prestige — valeurs', prestige) +
            box('Dernière révision BRVM 30', last ? TC.fmtDate(last) : '—');
    }

    function paint() {
        paintKpis();
        const date = TC.val('icp-date') || TC.today();
        const m = meta(current);
        const list = membersAt(current, date);
        TC.el('icp-rule').textContent = m.rule + (m.size ? ' Taille attendue : ' + m.size + ' valeurs.' : '');
        TC.el('icp-title').textContent = m.label + ' au ' + TC.fmtDate(date);
        const sizeWarn = m.size && list.length !== m.size;
        TC.el('icp-count').innerHTML = list.length + ' valeur(s)' +
            (sizeWarn ? ' <span class="badge badge-orange">attendu : ' + m.size + '</span>' : '');
        const tbody = TC.el('icp-tbody');
        if (!list.length) {
            tbody.innerHTML = TC.rowsEmpty(8, 'Aucune valeur à cette date',
                'Ajoutez des valeurs ci-dessous ou appliquez une révision complète.');
        } else {
            tbody.innerHTML = list.map(function (r) {
                const c = company(r.ticker) || {};
                return '<tr><td class="td-key">' + TC.esc(r.ticker) + '</td>' +
                    '<td>' + TC.esc(c.nom || '—') + '</td>' +
                    '<td class="td-muted">' + TC.esc(c.secteur || '') + '</td>' +
                    '<td class="td-mono td-muted">' + TC.fmtDate(r.date_debut) + '</td>' +
                    '<td class="td-mono td-muted">' + (r.date_fin ? TC.fmtDate(r.date_fin) : '—') + '</td>' +
                    '<td class="r td-mono">' + (r.poids_pct != null ? TC.fmt(r.poids_pct) : '—') + '</td>' +
                    '<td class="td-muted" style="font-size:11px;">' + TC.esc(r.notes || '') + '</td>' +
                    '<td class="r" style="white-space:nowrap;">' +
                    '<button class="btn btn-outline btn-ico" data-edit="' + r.id + '" title="Modifier">✎</button> ' +
                    '<button class="btn btn-outline btn-sm" data-out="' + r.id + '" title="Sortie de l\'indice">Retirer</button> ' +
                    '<button class="btn btn-danger btn-ico" data-del="' + r.id + '" title="Supprimer la ligne (erreur de saisie)">✕</button></td></tr>';
            }).join('');
        }
        paintHistory();
    }

    /** Historique : chaque date d'entrée ou de sortie est une révision. */
    function paintHistory() {
        const mine = rows.filter(r => r.indice === current);
        const dates = new Set();
        mine.forEach(r => { dates.add(r.date_debut); if (r.date_fin) dates.add(r.date_fin); });
        const list = Array.from(dates).sort().reverse();
        const tbody = TC.el('icp-history');
        if (!list.length) { tbody.innerHTML = TC.rowsEmpty(4, 'Aucune révision enregistrée'); return; }
        tbody.innerHTML = list.map(function (d) {
            const ins = mine.filter(r => r.date_debut === d).map(r => r.ticker).sort();
            const outs = mine.filter(r => r.date_fin === d).map(r => r.ticker).sort();
            return '<tr><td class="td-mono">' + TC.fmtDate(d) + '</td>' +
                '<td class="r td-mono">' + membersAt(current, d).length + '</td>' +
                '<td style="color:var(--green);font-size:12px;">' + TC.esc(ins.join(', ') || '—') + '</td>' +
                '<td style="color:var(--red);font-size:12px;">' + TC.esc(outs.join(', ') || '—') + '</td></tr>';
        }).join('');
    }

    async function addOne() {
        const ticker = TC.val('icp-add-ticker');
        const date = TC.val('icp-add-date') || TC.today();
        if (!ticker) { TC.say('icp-add-msg', 'Choisissez une société.', 'err'); return; }
        if (membersAt(current, date).some(r => r.ticker === ticker)) {
            TC.say('icp-add-msg', ticker + ' fait déjà partie de ' + meta(current).label + ' à cette date.', 'warn');
            return;
        }
        try {
            await TC.post('indices_composition', {
                indice: current, ticker, date_debut: date, date_fin: null,
                poids_pct: TC.num('icp-add-poids'), notes: TC.val('icp-add-notes') || null
            });
            TC.say('icp-add-msg', ticker + ' ajouté à ' + meta(current).label + '.', 'ok');
            TC.clear(['icp-add-poids', 'icp-add-notes']);
            load();
        } catch (e) { TC.say('icp-add-msg', e.message, 'err'); }
    }

    function parseList(text) {
        return Array.from(new Set(String(text || '').toUpperCase().split(/[\s,;]+/).map(s => s.trim()).filter(Boolean)));
    }

    function preview() {
        const date = TC.val('icp-rev-date');
        const wanted = parseList(TC.val('icp-rev-list'));
        const btn = TC.el('icp-rev-apply');
        btn.disabled = true; pending = null;
        if (!date) { TC.say('icp-rev-msg', 'Indiquez la date d\'effet.', 'err'); return; }
        if (!wanted.length) { TC.say('icp-rev-msg', 'La liste est vide.', 'err'); return; }
        const unknown = wanted.filter(t => !company(t));
        if (unknown.length) {
            TC.say('icp-rev-msg', 'Tickers inconnus des fiches sociétés : ' + unknown.join(', '), 'err');
            TC.el('icp-rev-diff').innerHTML = '';
            return;
        }
        const before = membersAt(current, date);
        const beforeSet = new Set(before.map(r => r.ticker));
        const entering = wanted.filter(t => !beforeSet.has(t));
        const leaving = before.filter(r => wanted.indexOf(r.ticker) === -1);
        const future = rows.filter(r => r.indice === current && r.date_debut > date).length;
        const m = meta(current);
        TC.el('icp-rev-diff').innerHTML =
            '<div style="font-size:12px;line-height:1.7;">' +
            '<div><strong>' + wanted.length + '</strong> valeur(s) après révision' +
            (m.size && wanted.length !== m.size ? ' <span class="badge badge-orange">attendu : ' + m.size + '</span>' : '') + '</div>' +
            '<div style="color:var(--green)">Entrées (' + entering.length + ') : ' + TC.esc(entering.join(', ') || '—') + '</div>' +
            '<div style="color:var(--red)">Sorties (' + leaving.length + ') : ' + TC.esc(leaving.map(r => r.ticker).join(', ') || '—') + '</div>' +
            (future ? '<div style="color:var(--orange)">' + future + ' ligne(s) déjà datée(s) après le ' + TC.fmtDate(date) + ' : vérifiez-les après application.</div>' : '') +
            '</div>';
        if (!entering.length && !leaving.length) { TC.say('icp-rev-msg', 'Aucun changement par rapport à la composition en vigueur.', 'warn'); return; }
        pending = { date, entering, leaving, notes: TC.val('icp-rev-notes') || null };
        btn.disabled = false;
        TC.say('icp-rev-msg', 'Vérifiez l\'aperçu puis appliquez.', 'ok');
    }

    async function apply() {
        if (!pending) return;
        const p = pending;
        if (!confirm('Appliquer la révision de ' + meta(current).label + ' au ' + TC.fmtDate(p.date) + ' ?\n' +
            p.entering.length + ' entrée(s), ' + p.leaving.length + ' sortie(s).')) return;
        TC.el('icp-rev-apply').disabled = true;
        let errors = 0;
        for (const r of p.leaving) {
            try {
                if (r.date_debut === p.date) await TC.del('indices_composition', 'id=eq.' + r.id);
                else await TC.patch('indices_composition', 'id=eq.' + r.id, { date_fin: p.date });
            } catch (e) { errors++; }
        }
        if (p.entering.length) {
            try {
                await TC.post('indices_composition', p.entering.map(t => ({
                    indice: current, ticker: t, date_debut: p.date, date_fin: null, notes: p.notes
                })));
            } catch (e) { errors++; TC.toast(e.message, 'err'); }
        }
        pending = null;
        TC.el('icp-rev-diff').innerHTML = '';
        TC.say('icp-rev-msg', errors ? errors + ' écriture(s) en échec, rechargez et vérifiez.' : 'Révision appliquée.', errors ? 'err' : 'ok');
        TC.toast('Révision ' + meta(current).label + ' enregistrée', errors ? 'err' : 'ok');
        TC.setVal('icp-date', p.date);
        load();
    }

    function edit(row) {
        TC.modal.open({
            title: row.ticker + ' · ' + meta(row.indice).label,
            subtitle: (company(row.ticker) || {}).nom || '',
            body: '<div class="form-grid">' + TC.fields([
                { id: 'mc-debut', label: 'Date d\'entrée', type: 'date' },
                { id: 'mc-fin', label: 'Date de sortie', type: 'date', hint: 'Vide : toujours dans l\'indice.' },
                { id: 'mc-poids', label: 'Poids %', type: 'number' },
                { id: 'mc-notes', label: 'Note', wide: true }
            ]) + '</div>',
            afterOpen() {
                TC.setVal('mc-debut', row.date_debut);
                TC.setVal('mc-fin', row.date_fin || '');
                TC.setVal('mc-poids', row.poids_pct);
                TC.setVal('mc-notes', row.notes || '');
            },
            async onSave() {
                const debut = TC.val('mc-debut'), fin = TC.val('mc-fin') || null;
                if (!debut) { TC.modal.msg('La date d\'entrée est obligatoire.', 'err'); return; }
                if (fin && fin < debut) { TC.modal.msg('La sortie précède l\'entrée.', 'err'); return; }
                try {
                    await TC.patch('indices_composition', 'id=eq.' + row.id, {
                        date_debut: debut, date_fin: fin, poids_pct: TC.num('mc-poids'), notes: TC.val('mc-notes') || null
                    });
                    TC.modal.close(); TC.toast('Composition mise à jour', 'ok'); load();
                } catch (e) { TC.modal.msg(e.message, 'err'); }
            }
        });
    }

    async function retire(row) {
        const date = prompt('Date de sortie de ' + row.ticker + ' (AAAA-MM-JJ) :', TC.val('icp-date') || TC.today());
        if (!date) return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < row.date_debut) { TC.toast('Date invalide', 'err'); return; }
        try {
            if (date === row.date_debut) await TC.del('indices_composition', 'id=eq.' + row.id);
            else await TC.patch('indices_composition', 'id=eq.' + row.id, { date_fin: date });
            TC.toast(row.ticker + ' retiré au ' + TC.fmtDate(date), 'ok'); load();
        } catch (e) { TC.toast(e.message, 'err'); }
    }

    TC.register({
        id: 'indices-composition',
        label: 'Composition des indices',
        group: 'marche',
        icon: '◫',
        keywords: 'brvm 30 prestige principal composite sectoriel composition revision constituants',
        view,
        refresh: load,
        mount() {
            const today = TC.today();
            TC.setVal('icp-date', today);
            TC.setVal('icp-add-date', today);
            TC.setVal('icp-rev-date', today);
            TC.on('icp-reload', 'click', load);
            TC.on('icp-index', 'change', () => { current = TC.val('icp-index'); pending = null; TC.el('icp-rev-apply').disabled = true; TC.el('icp-rev-diff').innerHTML = ''; paint(); });
            TC.on('icp-date', 'input', paint);
            TC.on('icp-new-add', 'click', function () {
                const code = up(TC.val('icp-new-code')).replace(/[\s_]+/g, '-');
                if (!/^[A-Z0-9-]+$/.test(code)) { TC.toast('Code d\'indice invalide (lettres, chiffres, tirets)', 'err'); return; }
                current = code;
                if (codes().indexOf(code) === -1) KNOWN.push({ code, label: code, rule: 'Indice personnalisé.' });
                TC.clear(['icp-new-code']);
                paintSelectors(); paint();
                TC.toast('Indice ' + code + ' prêt : ajoutez ses valeurs', 'ok');
            });
            TC.on('icp-add', 'click', addOne);
            TC.on('icp-rev-current', 'click', () => {
                TC.setVal('icp-rev-list', membersAt(current, TC.val('icp-date') || today).map(r => r.ticker).join(', '));
            });
            TC.on('icp-rev-auto', 'click', function () {
                const m = meta(current);
                if (!m.auto) { TC.say('icp-rev-msg', m.label + ' ne se déduit pas des fiches : collez la liste de l\'avis BRVM.', 'warn'); return; }
                TC.setVal('icp-rev-list', companies.filter(m.auto).map(c => c.ticker).join(', '));
                TC.say('icp-rev-msg', 'Liste pré-remplie depuis les fiches sociétés. Cliquez sur Aperçu.', 'ok');
            });
            TC.on('icp-rev-preview', 'click', preview);
            TC.on('icp-rev-apply', 'click', apply);
            TC.on('icp-export', 'click', function () {
                if (!rows.length) return;
                TC.download('composition-indices-' + today + '.csv',
                    TC.toCSV(rows, ['indice', 'ticker', 'date_debut', 'date_fin', 'poids_pct', 'notes']), 'text/csv;charset=utf-8');
            });
            TC.delegate('icp-tbody', '[data-edit]', 'click', n => { const r = rows.find(x => String(x.id) === n.dataset.edit); if (r) edit(r); });
            TC.delegate('icp-tbody', '[data-out]', 'click', n => { const r = rows.find(x => String(x.id) === n.dataset.out); if (r) retire(r); });
            TC.delegate('icp-tbody', '[data-del]', 'click', async function (n) {
                const r = rows.find(x => String(x.id) === n.dataset.del);
                if (!r || !TC.confirmTwice('Supprimer la ligne ' + r.ticker + ' (' + meta(r.indice).label + ') ?', 'à réserver aux erreurs de saisie : pour une sortie d\'indice, utilisez « Retirer »')) return;
                try { await TC.del('indices_composition', 'id=eq.' + r.id); TC.toast('Supprimé', 'ok'); load(); }
                catch (e) { TC.toast(e.message, 'err'); }
            });
            load();
        }
    });

})(window.TC);
