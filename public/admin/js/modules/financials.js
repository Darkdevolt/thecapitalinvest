/* ============================================================
   THE CAPITAL — ÉTATS FINANCIERS
   Le formulaire, le modèle Excel et l'affichage sont produits par
   le même dictionnaire de postes : ils ne peuvent plus diverger.
   Les ratios ne sont jamais saisis, toujours recalculés.
   ============================================================ */
'use strict';

(function (TC) {

    let rows = [];
    let imported = { rows: [], report: null };
    const sel = TC.selection('fin');

    const STATUTS = [
        { v: 'draft', l: 'Brouillon' },
        { v: 'review', l: 'À relire' },
        { v: 'validated', l: 'Validé' },
        { v: 'rejected', l: 'Rejeté' }
    ];

    function formFields(prefix) {
        const head = [
            { id: prefix + 'ticker', label: 'Ticker', upper: true, placeholder: 'SNTS' },
            { id: prefix + 'annee', label: 'Exercice', type: 'number', step: '1', placeholder: String(new Date().getFullYear() - 1) },
            { id: prefix + 'periode', label: 'Période', type: 'select', options: TC.PERIODES_FIN }
        ];
        const postes = TC.FIN.saisis().map(p => ({
            id: prefix + p.col, label: p.label, type: 'number',
            step: p.signe === 'entier' ? '1' : 'any', col: p.col, hint: p.aide
        }));
        const tail = [
            { id: prefix + 'source', label: 'Source', placeholder: 'Rapport annuel 2025' },
            { id: prefix + 'source_url', label: 'URL de la source', placeholder: 'https://…' },
            { id: prefix + 'source_page', label: 'Page', type: 'number', step: '1' },
            { id: prefix + 'status', label: 'État de validation', type: 'select', options: STATUTS },
            { id: prefix + 'notes', label: 'Notes de validation', type: 'textarea', rows: 2, wide: true }
        ];
        return head.concat(postes).concat(tail);
    }

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">États <em>financiers</em></div>' +
            '<div class="page-sub">Comptes publiés par les sociétés cotées, exercice par exercice. Les ratios de rentabilité, de marge et de distribution sont recalculés depuis les postes : ils ne se saisissent pas, sinon ils divergent des comptes.</div></div>' +
            '<div class="page-actions">' +
            '<button class="btn btn-outline btn-sm" id="fin-template">⬇ Modèle Excel</button>' +
            '<button class="btn btn-outline btn-sm" id="fin-export">⬇ Exporter</button></div></div>' +

            '<div class="subtabs">' +
            '<button class="subtab active" data-sub="liste">Consulter</button>' +
            '<button class="subtab" data-sub="saisie">Saisir un exercice</button>' +
            '<button class="subtab" data-sub="excel">Importer un classeur</button>' +
            '</div>' +

            '<div class="subpane active" id="fsub-liste">' +
            '<div class="kpis" id="fin-kpis"></div>' +
            '<div class="card"><div class="card-head"><span class="card-title">Exercices enregistrés</span>' +
            '<span class="card-tools">' +
            '<input type="search" id="fin-search" placeholder="Ticker…" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;width:130px;">' +
            '<select id="fin-year" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;"><option value="">Tous exercices</option></select>' +
            '<select id="fin-status" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;">' +
            '<option value="">Tous états</option>' + STATUTS.map(s => '<option value="' + s.v + '">' + s.l + '</option>').join('') +
            '<option value="anomalie">Avec anomalie</option></select>' +
            '<span class="card-count" id="fin-count"></span>' +
            '<button class="btn btn-outline btn-sm" id="fin-reload">↺</button></span></div>' +
            '<div class="bulkbar" id="bulk-fin"><span class="bulk-count">0 ligne(s)</span>' +
            '<button class="btn btn-green btn-sm" id="fin-bulk-validate">Marquer comme validés</button>' +
            '<button class="btn btn-danger btn-sm" id="fin-bulk-del">Supprimer</button>' +
            '<button class="btn btn-outline btn-sm" id="fin-bulk-reset">Désélectionner</button></div>' +
            '<div class="tw capped" id="bulk-fin-scope"><table><thead><tr>' +
            '<th><input type="checkbox" class="rowcheck" id="fin-all"></th>' +
            '<th>Ticker</th><th>Exercice</th><th>Période</th><th>État</th>' +
            '<th class="r">Chiffre d\'affaires</th><th class="r">RBE</th><th class="r">Résultat net</th>' +
            '<th class="r">Marge nette</th><th class="r">BPA</th><th class="r">DPA</th><th class="r">ROE</th>' +
            '<th>Source</th><th>Contrôle</th><th></th>' +
            '</tr></thead><tbody id="fin-tbody">' + TC.rowsLoading(15) + '</tbody></table></div></div></div>' +

            '<div class="subpane" id="fsub-saisie">' +
            '<div class="card accent"><div class="card-head"><span class="card-title">Saisir ou corriger un exercice</span>' +
            '<span class="card-tools"><button class="btn btn-outline btn-sm" id="fin-prefill">↑ Charger l\'exercice existant</button></span></div>' +
            '<div class="form-grid">' + TC.fields(formFields('f-')) + '</div>' +
            '<div class="card-body tight"><div class="note" id="fin-live">Les ratios apparaissent ici dès que les postes nécessaires sont renseignés.</div></div>' +
            '<div class="actions"><button class="btn btn-primary" id="fin-save">Enregistrer l\'exercice</button>' +
            '<button class="btn btn-outline btn-sm" id="fin-clear">Effacer</button>' +
            '<span class="msg" id="fin-msg"></span></div></div></div>' +

            '<div class="subpane" id="fsub-excel">' +
            '<div class="card"><div class="card-head"><span class="card-title">Importer un classeur</span></div>' +
            '<div class="card-body">' +
            '<div class="drop" id="fin-drop"><div class="drop-ico">▤</div>' +
            '<div class="drop-main">Déposez le classeur ou cliquez pour le choisir</div>' +
            '<div class="drop-hint">.xlsx, .xls — le modèle téléchargeable ci-dessus garantit les bonnes colonnes</div></div>' +
            '<input type="file" id="fin-file" accept=".xlsx,.xls" hidden>' +
            '<div id="fin-import-summary" style="margin-top:14px;"></div></div>' +
            '<div class="actions" id="fin-import-actions" hidden>' +
            '<button class="btn btn-primary" id="fin-import-run">Importer les lignes conformes</button>' +
            '<button class="btn btn-outline btn-sm" id="fin-import-cancel">Annuler</button>' +
            '<span class="msg" id="fin-import-msg"></span></div>' +
            '<div id="fin-import-preview"></div></div></div>';
    }

    /* ── Chargement et affichage ─────────────────────────── */

    async function load() {
        TC.el('fin-tbody').innerHTML = TC.rowsLoading(15);
        const data = await TC.getAll('financials', 'select=*&order=annee.desc,ticker.asc');
        rows = (data || []).map(function (r) {
            r.__ratios = TC.FIN.ratios(r);
            r.__issues = TC.FIN.audit(r);
            return r;
        });

        const years = Array.from(new Set(rows.map(r => r.annee).filter(y => y !== null))).sort((a, b) => b - a);
        const select = TC.el('fin-year');
        const keep = select.value;
        select.innerHTML = '<option value="">Tous exercices</option>' +
            years.map(y => '<option value="' + y + '">' + y + '</option>').join('');
        if (keep) select.value = keep;

        paintKpis();
        paint(rows);
    }

    function paintKpis() {
        const validated = rows.filter(r => r.validation_status === 'validated').length;
        const flagged = rows.filter(r => r.__issues.some(i => i.level === 'err')).length;
        const sourceless = rows.filter(r => !r.source).length;
        const covered = new Set(rows.map(r => String(r.ticker).toUpperCase())).size;
        TC.el('fin-kpis').innerHTML =
            box('Exercices', rows.length) +
            box('Sociétés couvertes', covered) +
            box('Validés', validated + ' / ' + rows.length, validated === rows.length ? '' : 'orange') +
            box('Anomalies bloquantes', flagged, flagged ? 'red' : 'green') +
            box('Sans source', sourceless, sourceless ? 'orange' : 'green');
    }

    function box(label, value, tone) {
        return '<div class="kpi"><div class="kpi-label">' + TC.esc(label) + '</div><div class="kpi-value sm"' +
            (tone ? ' style="color:var(--' + tone + ')"' : '') + '>' + TC.esc(String(value)) + '</div></div>';
    }

    function statusBadge(status) {
        const map = { validated: 'badge-green', review: 'badge-orange', rejected: 'badge-red' };
        const found = STATUTS.find(s => s.v === (status || 'draft'));
        return '<span class="badge ' + (map[status] || 'badge-blue') + '">' + TC.esc(found ? found.l : status) + '</span>';
    }

    function paint(list) {
        const tbody = TC.el('fin-tbody');
        TC.el('fin-count').textContent = list.length + ' exercice(s)';
        if (!list.length) {
            tbody.innerHTML = TC.rowsEmpty(15, 'Aucun état financier',
                'Saisissez un exercice ou importez le modèle Excel rempli.');
            return;
        }
        sel.reset();
        tbody.innerHTML = list.map(function (r) {
            const err = r.__issues.some(i => i.level === 'err');
            return '<tr class="' + (err ? 'row-flag' : r.__issues.length ? 'row-warn' : '') + '">' +
                '<td><input type="checkbox" class="rowcheck" data-id="' + r.id + '"></td>' +
                '<td class="td-key">' + TC.esc(r.ticker) + '</td>' +
                '<td class="td-mono">' + TC.esc(r.annee) + '</td>' +
                '<td><span class="badge badge-grey">' + TC.esc(r.periode || 'annuel') + '</span></td>' +
                '<td>' + statusBadge(r.validation_status) + '</td>' +
                '<td class="r td-mono">' + TC.fmt(r.chiffre_affaires, 0) + '</td>' +
                '<td class="r td-mono td-muted">' + TC.fmt(r.rbe, 0) + '</td>' +
                '<td class="r td-mono ' + TC.trendClass(r.resultat_net) + '">' + TC.fmt(r.resultat_net, 0) + '</td>' +
                '<td class="r td-mono td-muted">' + (r.__ratios.marge_nette !== undefined ? r.__ratios.marge_nette.toFixed(1) + ' %' : '—') + '</td>' +
                '<td class="r td-mono">' + TC.fmt(r.bpa) + '</td>' +
                '<td class="r td-mono">' + TC.fmt(r.dpa) + '</td>' +
                '<td class="r td-mono td-muted">' + (r.__ratios.roe !== undefined ? r.__ratios.roe.toFixed(1) + ' %' : '—') + '</td>' +
                '<td class="td-muted" style="max-width:170px;overflow:hidden;text-overflow:ellipsis;">' + TC.esc(r.source || '—') + '</td>' +
                '<td>' + (r.__issues.length
                    ? '<span class="badge ' + (err ? 'badge-red' : 'badge-orange') + '" title="' +
                    TC.esc(r.__issues.map(i => i.text).join(' · ')) + '">' + TC.esc(r.__issues[0].text) + '</span>'
                    : '<span class="badge badge-green">conforme</span>') + '</td>' +
                '<td class="r" style="white-space:nowrap;">' +
                '<button class="btn btn-outline btn-ico" data-edit="' + r.id + '">✎</button> ' +
                '<button class="btn btn-danger btn-ico" data-del="' + r.id + '">✕</button></td></tr>';
        }).join('');
    }

    function filter() {
        const q = TC.val('fin-search').toUpperCase();
        const year = TC.val('fin-year');
        const status = TC.val('fin-status');
        paint(rows.filter(function (r) {
            if (q && String(r.ticker).toUpperCase().indexOf(q) === -1) return false;
            if (year && String(r.annee) !== year) return false;
            if (status === 'anomalie') return r.__issues.length > 0;
            if (status && (r.validation_status || 'draft') !== status) return false;
            return true;
        }));
    }

    /* ── Saisie ──────────────────────────────────────────── */

    function readForm(prefix) {
        const body = {
            ticker: TC.val(prefix + 'ticker').toUpperCase(),
            annee: TC.int(prefix + 'annee'),
            periode: TC.val(prefix + 'periode') || 'annuel',
            source: TC.val(prefix + 'source') || null,
            source_url: TC.val(prefix + 'source_url') || null,
            source_page: TC.int(prefix + 'source_page'),
            validation_status: TC.val(prefix + 'status') || 'draft',
            validation_notes: TC.val(prefix + 'notes') || null
        };
        TC.FIN.saisis().forEach(p => { body[p.col] = TC.num(prefix + p.col); });
        if (body.nombre_actions !== null) body.nb_actions = body.nombre_actions;
        if (body.bpa === null) {
            const computed = TC.FIN.bpaFrom(body);
            if (computed !== null) body.bpa = computed;
        }
        Object.assign(body, TC.FIN.ratios(body));
        return body;
    }

    function paintLive() {
        const draft = readForm('f-');
        const ratios = TC.FIN.ratios(draft);
        const issues = TC.FIN.audit(draft);
        const parts = [];
        if (ratios.marge_nette !== undefined) parts.push('marge nette ' + ratios.marge_nette.toFixed(1) + ' %');
        if (ratios.roe !== undefined) parts.push('ROE ' + ratios.roe.toFixed(1) + ' %');
        if (ratios.roa !== undefined) parts.push('ROA ' + ratios.roa.toFixed(1) + ' %');
        if (ratios.payout_ratio !== undefined) parts.push('distribution ' + ratios.payout_ratio.toFixed(1) + ' %');
        const computed = TC.FIN.bpaFrom(draft);
        if (computed !== null) parts.push('BPA calculé ' + TC.fmt(computed));

        const node = TC.el('fin-live');
        const blocking = issues.filter(i => i.level === 'err');
        node.className = 'note' + (blocking.length ? ' err' : issues.length > 1 ? ' warn' : '');
        node.innerHTML = (parts.length
            ? '<strong>Ratios calculés</strong> — ' + TC.esc(parts.join(' · '))
            : '<strong>Ratios</strong> — renseignez le chiffre d\'affaires, le résultat net et les capitaux propres.') +
            (issues.length ? '<br><strong>Contrôles</strong> — ' + TC.esc(issues.map(i => i.text).join(' · ')) : '');
    }

    async function save() {
        const body = readForm('f-');
        if (!body.ticker || body.annee === null) {
            TC.say('fin-msg', 'Le ticker et l\'exercice sont obligatoires.', 'err'); return;
        }
        const known = await TC.tickerSet();
        if (!known.has(body.ticker)) {
            TC.say('fin-msg', 'Le ticker ' + body.ticker + ' n\'existe pas dans le référentiel des sociétés.', 'err'); return;
        }
        const issues = TC.FIN.audit(body);
        const blocking = issues.filter(i => i.level === 'err');
        if (blocking.length) { TC.say('fin-msg', 'Refusé : ' + blocking.map(i => i.text).join(' · '), 'err'); return; }
        const warnings = issues.filter(i => i.level === 'warn' && i.text !== 'source non renseignée');
        if (warnings.length && !confirm('Points à vérifier :\n\n' + warnings.map(i => '· ' + i.text).join('\n') +
            '\n\nEnregistrer malgré tout ?')) return;
        if (!body.source && !confirm('Aucune source n\'est renseignée. Une donnée publiée sans source n\'est pas vérifiable.\n\nEnregistrer quand même ?')) return;

        if (body.validation_status === 'validated') body.validated_at = new Date().toISOString();

        try {
            await TC.post('financials', body);
            TC.say('fin-msg', body.ticker + ' — exercice ' + body.annee + ' (' + body.periode + ') enregistré.', 'ok');
            TC.toast('État financier enregistré', 'ok');
            load();
        } catch (e) { TC.say('fin-msg', e.message, 'err'); }
    }

    async function prefill() {
        const ticker = TC.val('f-ticker').toUpperCase();
        if (!ticker) { TC.say('fin-msg', 'Indiquez un ticker.', 'err'); return; }
        const year = TC.val('f-annee');
        let query = 'select=*&ticker=eq.' + encodeURIComponent(ticker) + '&order=annee.desc&limit=1';
        if (year) query += '&annee=eq.' + year;
        const found = await TC.get('financials', query);

        if (!found || !found.length) {
            const refs = await TC.tickers();
            const company = refs.find(r => String(r.ticker).toUpperCase() === ticker);
            if (company && (company.nombre_actions || company.nb_actions)) {
                TC.setVal('f-nombre_actions', company.nombre_actions || company.nb_actions);
                TC.say('fin-msg', 'Aucun exercice existant. Nombre d\'actions repris du référentiel.', 'info');
            } else {
                TC.say('fin-msg', 'Aucun exercice enregistré pour ' + ticker + '.', 'warn');
            }
            return;
        }

        const r = found[0];
        TC.setVal('f-annee', r.annee);
        TC.setVal('f-periode', r.periode || 'annuel');
        TC.FIN.saisis().forEach(p => TC.setVal('f-' + p.col, r[p.col]));
        TC.setVal('f-source', r.source);
        TC.setVal('f-source_url', r.source_url);
        TC.setVal('f-source_page', r.source_page);
        TC.setVal('f-status', r.validation_status || 'draft');
        TC.setVal('f-notes', r.validation_notes);
        paintLive();
        TC.say('fin-msg', 'Exercice ' + r.annee + ' de ' + ticker + ' chargé. Modifiez puis enregistrez.', 'ok');
    }

    function edit(row) {
        TC.modal.open({
            title: row.ticker + ' — exercice ' + row.annee,
            subtitle: (row.periode || 'annuel') + (row.source ? ' · source : ' + row.source : ' · aucune source'),
            body: '<div class="form-grid">' + TC.fields(
                TC.FIN.saisis().map(p => ({ id: 'mf-' + p.col, label: p.label, type: 'number', step: p.signe === 'entier' ? '1' : 'any' }))
                    .concat([
                        { id: 'mf-source', label: 'Source' },
                        { id: 'mf-source_url', label: 'URL de la source' },
                        { id: 'mf-status', label: 'État de validation', type: 'select', options: STATUTS },
                        { id: 'mf-notes', label: 'Notes', type: 'textarea', rows: 2, wide: true }
                    ])) + '</div>' +
                '<div class="card-body tight"><div class="note" id="mf-live"></div></div>',
            afterOpen() {
                TC.FIN.saisis().forEach(p => TC.setVal('mf-' + p.col, row[p.col]));
                TC.setVal('mf-source', row.source);
                TC.setVal('mf-source_url', row.source_url);
                TC.setVal('mf-status', row.validation_status || 'draft');
                TC.setVal('mf-notes', row.validation_notes);
                const live = function () {
                    const draft = { ticker: row.ticker, annee: row.annee };
                    TC.FIN.saisis().forEach(p => { draft[p.col] = TC.num('mf-' + p.col); });
                    draft.source = TC.val('mf-source');
                    const ratios = TC.FIN.ratios(draft);
                    const issues = TC.FIN.audit(draft);
                    TC.el('mf-live').className = 'note' + (issues.some(i => i.level === 'err') ? ' err' : issues.length ? ' warn' : '');
                    TC.el('mf-live').innerHTML =
                        '<strong>Ratios</strong> — ' +
                        (ratios.marge_nette !== undefined ? 'marge ' + ratios.marge_nette.toFixed(1) + ' % · ' : '') +
                        (ratios.roe !== undefined ? 'ROE ' + ratios.roe.toFixed(1) + ' %' : '—') +
                        (issues.length ? '<br><strong>Contrôles</strong> — ' + TC.esc(issues.map(i => i.text).join(' · ')) : '');
                };
                TC.FIN.saisis().forEach(p => TC.on('mf-' + p.col, 'input', live));
                live();
            },
            async onSave() {
                const body = { ticker: row.ticker, annee: row.annee, periode: row.periode };
                TC.FIN.saisis().forEach(p => { body[p.col] = TC.num('mf-' + p.col); });
                body.nb_actions = body.nombre_actions;
                body.source = TC.val('mf-source') || null;
                body.source_url = TC.val('mf-source_url') || null;
                body.validation_status = TC.val('mf-status');
                body.validation_notes = TC.val('mf-notes') || null;
                if (body.bpa === null) {
                    const computed = TC.FIN.bpaFrom(body);
                    if (computed !== null) body.bpa = computed;
                }
                Object.assign(body, TC.FIN.ratios(body));
                const blocking = TC.FIN.audit(body).filter(i => i.level === 'err');
                if (blocking.length) { TC.modal.msg('Refusé : ' + blocking.map(i => i.text).join(' · '), 'err'); return; }
                if (body.validation_status === 'validated') body.validated_at = new Date().toISOString();
                try {
                    await TC.patch('financials', 'id=eq.' + row.id, body);
                    TC.modal.close(); TC.toast('Exercice mis à jour', 'ok'); load();
                } catch (e) { TC.modal.msg(e.message, 'err'); }
            }
        });
    }

    /* ── Import Excel ────────────────────────────────────── */

    async function readFile(file) {
        const summary = TC.el('fin-import-summary');
        summary.innerHTML = '<div class="loading"><div class="spinner"></div>Lecture du classeur…</div>';
        try {
            const parsed = await TC.FIN_XLS.readWorkbook(file);
            const known = await TC.tickerSet();
            const seen = new Set();

            const details = parsed.rows.map(function (row) {
                const issues = TC.FIN.audit(row);
                if (!known.has(row.ticker)) issues.push({ level: 'err', text: 'ticker absent du référentiel' });
                const key = row.ticker + '|' + row.annee + '|' + row.periode;
                if (seen.has(key)) issues.push({ level: 'err', text: 'doublon dans le classeur' });
                seen.add(key);
                if (row.bpa === null || row.bpa === undefined) {
                    const computed = TC.FIN.bpaFrom(row);
                    if (computed !== null) row.bpa = computed;
                }
                Object.assign(row, TC.FIN.ratios(row));
                if (row.nombre_actions) row.nb_actions = row.nombre_actions;
                return { row, issues, blocking: issues.filter(i => i.level === 'err') };
            });

            imported = { rows: details.filter(d => !d.blocking.length).map(d => d.row), report: details };

            const good = imported.rows.length;
            const bad = details.length - good;
            summary.innerHTML =
                '<div class="note' + (bad ? ' warn' : '') + '"><strong>' + TC.esc(file.name) + '</strong> — feuille « ' +
                TC.esc(parsed.sheetName) +' », en-tête ligne ' + parsed.headerRow + '.<br>' +
                good + ' ligne(s) prêtes à l\'import · ' + bad + ' rejetée(s)' +
                (parsed.ignored.length ? '<br>Colonnes absentes du classeur, laissées vides : ' + TC.esc(parsed.ignored.join(', ')) : '') +
                '</div>';

            TC.el('fin-import-actions').hidden = false;
            TC.el('fin-import-run').disabled = !good;
            TC.el('fin-import-preview').innerHTML =
                '<div class="tw capped"><table><thead><tr><th>Ligne</th><th>Ticker</th><th>Exercice</th><th>Période</th>' +
                '<th class="r">CA</th><th class="r">Résultat net</th><th class="r">BPA</th><th>Source</th><th>Contrôle</th>' +
                '</tr></thead><tbody>' + details.slice(0, 300).map(d =>
                    '<tr class="' + (d.blocking.length ? 'row-flag' : d.issues.length ? 'row-warn' : '') + '">' +
                    '<td class="td-muted">' + d.row.__line + '</td>' +
                    '<td class="td-key">' + TC.esc(d.row.ticker) + '</td>' +
                    '<td class="td-mono">' + TC.esc(d.row.annee) + '</td>' +
                    '<td class="td-muted">' + TC.esc(d.row.periode) + '</td>' +
                    '<td class="r td-mono">' + TC.fmt(d.row.chiffre_affaires, 0) + '</td>' +
                    '<td class="r td-mono">' + TC.fmt(d.row.resultat_net, 0) + '</td>' +
                    '<td class="r td-mono">' + TC.fmt(d.row.bpa) + '</td>' +
                    '<td class="td-muted">' + TC.esc(d.row.source || '—') + '</td>' +
                    '<td>' + (d.issues.length
                        ? '<span class="badge ' + (d.blocking.length ? 'badge-red' : 'badge-orange') + '">' +
                        TC.esc(d.issues.map(i => i.text).join(' · ')) + '</span>'
                        : '<span class="badge badge-green">prête</span>') + '</td></tr>').join('') +
                '</tbody></table></div>';
        } catch (e) {
            summary.innerHTML = '<div class="note err"><strong>Lecture impossible.</strong> ' + TC.esc(e.message) + '</div>';
            TC.el('fin-import-actions').hidden = true;
        }
    }

    async function runImport() {
        if (!imported.rows.length) return;
        TC.el('fin-import-run').disabled = true;
        TC.say('fin-import-msg', 'Écriture en cours…', 'info');
        const result = await TC.postBatched('financials', imported.rows, TC.CONFLICT.financials, function (p) {
            TC.say('fin-import-msg', p.done + ' / ' + p.total + ' exercice(s) écrits…', 'info');
        });
        TC.el('fin-import-run').disabled = false;
        if (result.failures.length) {
            TC.say('fin-import-msg', result.imported + ' importés, ' + result.failures.length +
                ' lot(s) en échec : ' + result.failures[0].error, 'err');
        } else {
            TC.say('fin-import-msg', result.imported + ' exercice(s) importés.', 'ok');
            TC.toast('Import terminé', 'ok');
            load();
        }
    }

    TC.register({
        id: 'financials',
        label: 'États financiers',
        group: 'societes',
        icon: '≡',
        keywords: 'financials comptes bilan resultat bpa roe syscohada',
        view,
        refresh: load,
        mount() {
            TC.delegate('panel-financials', '.subtab', 'click', function (btn) {
                TC.qsa('#panel-financials .subtab').forEach(b => b.classList.toggle('active', b === btn));
                TC.qsa('#panel-financials .subpane').forEach(p => p.classList.toggle('active', p.id === 'fsub-' + btn.dataset.sub));
            });

            const tickerInput = TC.el('f-ticker');
            if (tickerInput) tickerInput.setAttribute('list', 'tickers-list');

            TC.on('fin-reload', 'click', load);
            TC.on('fin-search', 'input', filter);
            TC.on('fin-year', 'change', filter);
            TC.on('fin-status', 'change', filter);
            TC.on('fin-save', 'click', save);
            TC.on('fin-prefill', 'click', prefill);
            TC.on('fin-clear', 'click', function () {
                TC.clear(['f-ticker', 'f-annee', 'f-source', 'f-source_url', 'f-source_page', 'f-notes']
                    .concat(TC.FIN.saisis().map(p => 'f-' + p.col)));
                TC.say('fin-msg', ''); paintLive();
            });
            TC.FIN.saisis().forEach(p => TC.on('f-' + p.col, 'input', paintLive));

            TC.on('fin-template', 'click', () => TC.FIN_XLS.downloadTemplate());
            TC.on('fin-export', 'click', function () {
                if (!rows.length) { TC.toast('Aucune donnée à exporter', 'info'); return; }
                TC.FIN_XLS.exportRows(rows);
                TC.toast('Export Excel généré', 'ok');
            });

            const drop = TC.el('fin-drop');
            const input = TC.el('fin-file');
            drop.addEventListener('click', () => input.click());
            ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
                e.preventDefault(); drop.classList.add('over');
            }));
            ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
                e.preventDefault(); drop.classList.remove('over');
            }));
            drop.addEventListener('drop', e => {
                const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                if (file) readFile(file);
            });
            input.addEventListener('change', e => {
                const file = e.target.files && e.target.files[0];
                if (file) readFile(file);
            });
            TC.on('fin-import-run', 'click', runImport);
            TC.on('fin-import-cancel', 'click', function () {
                imported = { rows: [], report: null };
                TC.el('fin-import-preview').innerHTML = '';
                TC.el('fin-import-summary').innerHTML = '';
                TC.el('fin-import-actions').hidden = true;
                input.value = '';
            });

            TC.on('fin-all', 'change', e => sel.all(rows.map(r => r.id), e.target.checked));
            TC.on('fin-bulk-reset', 'click', () => sel.reset());
            TC.on('fin-bulk-validate', 'click', async function () {
                const ids = sel.ids();
                if (!ids.length) return;
                if (!confirm('Marquer ' + ids.length + ' exercice(s) comme validés ?')) return;
                let done = 0;
                for (const id of ids) {
                    try {
                        await TC.patch('financials', 'id=eq.' + id,
                            { validation_status: 'validated', validated_at: new Date().toISOString() });
                        done++;
                    } catch (e) { /* bilan */ }
                }
                TC.toast(done + ' exercice(s) validés', 'ok');
                load();
            });
            TC.on('fin-bulk-del', 'click', async function () {
                const ids = sel.ids();
                if (!ids.length) return;
                if (!TC.confirmTwice('Supprimer ' + ids.length + ' exercice(s) ?', 'les analyses fondamentales perdront ces données')) return;
                let done = 0;
                for (const id of ids) { try { await TC.del('financials', 'id=eq.' + id); done++; } catch (e) { /* bilan */ } }
                TC.toast(done + ' exercice(s) supprimés', 'ok');
                load();
            });

            TC.delegate('fin-tbody', '.rowcheck', 'change', n => sel.toggle(n.dataset.id, n.checked));
            TC.delegate('fin-tbody', '[data-edit]', 'click', n => {
                const row = rows.find(r => String(r.id) === n.dataset.edit); if (row) edit(row);
            });
            TC.delegate('fin-tbody', '[data-del]', 'click', async function (n) {
                const row = rows.find(r => String(r.id) === n.dataset.del);
                if (!row || !TC.confirmTwice('Supprimer ' + row.ticker + ' — exercice ' + row.annee + ' ?')) return;
                try { await TC.del('financials', 'id=eq.' + row.id); TC.toast('Supprimé', 'ok'); load(); }
                catch (e) { TC.toast(e.message, 'err'); }
            });

            load();
        }
    });

})(window.TC);
