/* ============================================================
   THE CAPITAL — RÉFÉRENTIEL DES SOCIÉTÉS
   Tout part d'ici : une cotation, un état financier ou un
   dividende dont le ticker n'existe pas dans cette table est
   rejeté par la clé étrangère, sans message compréhensible.
   La colonne « Complétude » signale ce qui manque à chaque fiche
   pour que l'application publique l'affiche correctement.
   ============================================================ */
'use strict';

(function (TC) {

    let rows = [];
    const sel = TC.selection('ent');

    const FORM = [
        { id: 'e-ticker', label: 'Ticker', placeholder: 'SNTS', upper: true },
        { id: 'e-nom', label: 'Dénomination', placeholder: 'Sonatel SA' },
        { id: 'e-secteur', label: 'Secteur', placeholder: 'Télécommunications' },
        { id: 'e-pays', label: 'Pays', type: 'select', options: [{ v: '', l: '— Choisir —' }].concat(TC.PAYS_UEMOA.map(p => ({ v: p, l: p }))) },
        { id: 'e-compart', label: 'Compartiment', type: 'select', options: [{ v: 'PRINCIPAL', l: 'Principal' }, { v: 'PRESTIGE', l: 'Prestige' }] },
        { id: 'e-isin', label: 'Code ISIN', placeholder: 'SN0000000001', upper: true },
        { id: 'e-actions', label: 'Nombre d\'actions', type: 'number', step: '1', col: 'nombre_actions', hint: 'Indispensable au calcul de la capitalisation et du bénéfice par action.' },
        { id: 'e-nominal', label: 'Valeur nominale', type: 'number' },
        { id: 'e-site', label: 'Site internet', placeholder: 'https://…' },
        { id: 'e-siege', label: 'Siège social', placeholder: 'Dakar, Sénégal' },
        { id: 'e-intro', label: 'Date d\'introduction', type: 'date' },
        { id: 'e-desc', label: 'Description', type: 'textarea', wide: true, rows: 3, placeholder: 'Activité, positionnement, faits marquants…' }
    ];

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">Sociétés <em>cotées</em></div>' +
            '<div class="page-sub">Référentiel de la place. Chaque ticker utilisé ailleurs dans l\'administration doit exister ici : c\'est la clé étrangère de toutes les autres tables.</div></div>' +
            '<div class="page-actions">' +
            '<button class="btn btn-primary btn-sm" id="ent-new">+ Nouvelle société</button>' +
            '<button class="btn btn-outline btn-sm" id="ent-export">⬇ CSV</button></div></div>' +

            '<div class="kpis" id="ent-kpis"></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Référentiel</span>' +
            '<span class="card-tools">' +
            '<input type="search" id="ent-search" placeholder="Ticker, nom, secteur…" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;width:180px;">' +
            '<select id="ent-scope" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;">' +
            '<option value="">Toutes les fiches</option><option value="incomplet">Fiches incomplètes</option>' +
            '<option value="PRESTIGE">Compartiment Prestige</option><option value="PRINCIPAL">Compartiment Principal</option></select>' +
            '<span class="card-count" id="ent-count"></span>' +
            '<button class="btn btn-outline btn-sm" id="ent-reload">↺</button></span></div>' +
            '<div class="bulkbar" id="bulk-ent"><span class="bulk-count">0 fiche(s)</span>' +
            '<button class="btn btn-danger btn-sm" id="ent-bulk-del">Supprimer la sélection</button>' +
            '<button class="btn btn-outline btn-sm" id="ent-bulk-reset">Tout désélectionner</button></div>' +
            '<div class="tw capped" id="bulk-ent-scope"><table><thead><tr>' +
            '<th><input type="checkbox" class="rowcheck" id="ent-all"></th>' +
            '<th>Ticker</th><th>Dénomination</th><th>Secteur</th><th>Pays</th><th>Compartiment</th>' +
            '<th>ISIN</th><th class="r">Nb actions</th><th>Complétude</th><th></th>' +
            '</tr></thead><tbody id="ent-tbody">' + TC.rowsLoading(10) + '</tbody></table></div></div>';
    }

    function missingOf(r) {
        const gaps = [];
        if (!r.nom) gaps.push('dénomination');
        if (!r.secteur) gaps.push('secteur');
        if (!r.pays) gaps.push('pays');
        if (!(r.isin || r.code_isin)) gaps.push('ISIN');
        if (!TC.toNumber(r.nombre_actions || r.nb_actions)) gaps.push('nombre d\'actions');
        if (!r.compartiment) gaps.push('compartiment');
        return gaps;
    }

    async function load() {
        TC.el('ent-tbody').innerHTML = TC.rowsLoading(10);
        const data = await TC.get('entreprises', 'select=*&order=ticker.asc&limit=1000');
        rows = (data || []).filter(r => r && r.ticker && !TC.isIndice(r.ticker));
        rows.forEach(r => { r.__missing = missingOf(r); });
        TC.invalidateTickers();
        paintKpis();
        paint(rows);
    }

    function paintKpis() {
        const complete = rows.filter(r => !r.__missing.length).length;
        const prestige = rows.filter(r => String(r.compartiment).toUpperCase() === 'PRESTIGE').length;
        const countries = new Set(rows.map(r => r.pays).filter(Boolean)).size;
        const sectors = new Set(rows.map(r => r.secteur).filter(Boolean)).size;
        TC.el('ent-kpis').innerHTML =
            kpi('Sociétés', rows.length) +
            kpi('Fiches complètes', complete + ' / ' + rows.length, complete === rows.length ? '' : 'orange') +
            kpi('Compartiment Prestige', prestige) +
            kpi('Pays représentés', countries) +
            kpi('Secteurs', sectors);
    }

    function kpi(label, value, tone) {
        return '<div class="kpi"><div class="kpi-label">' + TC.esc(label) + '</div>' +
            '<div class="kpi-value sm"' + (tone ? ' style="color:var(--' + tone + ')"' : '') + '>' + TC.esc(String(value)) + '</div></div>';
    }

    function paint(list) {
        const tbody = TC.el('ent-tbody');
        TC.el('ent-count').textContent = list.length + ' fiche(s)';
        if (!list.length) {
            tbody.innerHTML = TC.rowsEmpty(10, 'Aucune société',
                'Créez les sociétés cotées avant tout import de cours ou d\'états financiers.');
            return;
        }
        sel.reset();
        tbody.innerHTML = list.map(function (r) {
            const gaps = r.__missing;
            const actions = TC.toNumber(r.nombre_actions || r.nb_actions);
            return '<tr class="' + (gaps.length >= 3 ? 'row-flag' : gaps.length ? 'row-warn' : '') + '">' +
                '<td><input type="checkbox" class="rowcheck" data-id="' + TC.esc(r.ticker) + '"></td>' +
                '<td class="td-key">' + TC.esc(r.ticker) + '</td>' +
                '<td>' + TC.esc(r.nom || '—') + '</td>' +
                '<td class="td-muted">' + TC.esc(r.secteur || '—') + '</td>' +
                '<td class="td-muted">' + TC.esc(r.pays || '—') + '</td>' +
                '<td><span class="badge ' + (String(r.compartiment).toUpperCase() === 'PRESTIGE' ? 'badge-gold' : 'badge-blue') + '">' +
                TC.esc(r.compartiment || '—') + '</span></td>' +
                '<td class="td-mono td-muted">' + TC.esc(r.isin || r.code_isin || '—') + '</td>' +
                '<td class="r td-mono' + (actions ? '' : ' down') + '">' + (actions ? TC.fmtInt(actions) : 'absent') + '</td>' +
                '<td>' + (gaps.length
                    ? '<span class="badge badge-orange" title="' + TC.esc(gaps.join(' · ')) + '">' + gaps.length + ' manque(s)</span>'
                    : '<span class="badge badge-green">complète</span>') + '</td>' +
                '<td class="r" style="white-space:nowrap;">' +
                '<button class="btn btn-outline btn-ico" data-edit="' + TC.esc(r.ticker) + '">✎</button> ' +
                '<button class="btn btn-danger btn-ico" data-del="' + TC.esc(r.ticker) + '">✕</button></td></tr>';
        }).join('');
    }

    function filter() {
        const q = TC.val('ent-search').toLowerCase();
        const scope = TC.val('ent-scope');
        paint(rows.filter(function (r) {
            const haystack = (r.ticker + ' ' + (r.nom || '') + ' ' + (r.secteur || '') + ' ' + (r.pays || '')).toLowerCase();
            if (q && haystack.indexOf(q) === -1) return false;
            if (scope === 'incomplet') return r.__missing.length > 0;
            if (scope) return String(r.compartiment).toUpperCase() === scope;
            return true;
        }));
    }

    function openForm(existing) {
        const isNew = !existing;
        TC.modal.open({
            title: isNew ? 'Nouvelle société cotée' : 'Fiche ' + existing.ticker,
            subtitle: isNew
                ? 'Le ticker devient la clé de référence de toutes les autres tables. Il ne pourra plus être modifié ensuite.'
                : (existing.__missing.length ? 'Manque : ' + existing.__missing.join(', ') : 'Fiche complète'),
            saveLabel: isNew ? 'Créer la société' : 'Enregistrer',
            body: '<div class="form-grid">' + TC.fields(FORM.map(f =>
                (!isNew && f.id === 'e-ticker') ? Object.assign({}, f, { readonly: true }) : f)) + '</div>',
            afterOpen() {
                if (isNew) { TC.setVal('e-compart', 'PRINCIPAL'); return; }
                TC.setVal('e-ticker', existing.ticker);
                TC.setVal('e-nom', existing.nom);
                TC.setVal('e-secteur', existing.secteur);
                TC.setVal('e-pays', existing.pays);
                TC.setVal('e-compart', String(existing.compartiment || 'PRINCIPAL').toUpperCase());
                TC.setVal('e-isin', existing.isin || existing.code_isin);
                TC.setVal('e-actions', existing.nombre_actions || existing.nb_actions);
                TC.setVal('e-nominal', existing.valeur_nominale);
                TC.setVal('e-site', existing.site_web);
                TC.setVal('e-siege', existing.siege_social);
                TC.setVal('e-intro', existing.date_introduction ? String(existing.date_introduction).slice(0, 10) : '');
                TC.setVal('e-desc', existing.description);
            },
            async onSave() {
                const ticker = TC.val('e-ticker').toUpperCase();
                const nom = TC.val('e-nom');
                if (!ticker || !nom) { TC.modal.msg('Le ticker et la dénomination sont obligatoires.', 'err'); return; }
                if (!/^[A-Z0-9.\-]{2,20}$/.test(ticker)) {
                    TC.modal.msg('Ticker invalide : 2 à 20 caractères, lettres, chiffres, point ou tiret.', 'err'); return;
                }
                const isin = TC.val('e-isin');
                if (isin && !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) {
                    if (!confirm('Le code ISIN « ' + isin + ' » ne respecte pas le format à 12 caractères.\n\nEnregistrer quand même ?')) return;
                }
                const actions = TC.int('e-actions');
                if (actions !== null && actions <= 0) { TC.modal.msg('Le nombre d\'actions doit être strictement positif.', 'err'); return; }

                const body = {
                    ticker, nom,
                    secteur: TC.val('e-secteur') || null,
                    pays: TC.val('e-pays') || null,
                    compartiment: TC.val('e-compart'),
                    isin: isin || null, code_isin: isin || null,
                    nombre_actions: actions, nb_actions: actions,
                    valeur_nominale: TC.num('e-nominal'),
                    site_web: TC.val('e-site') || null,
                    siege_social: TC.val('e-siege') || null,
                    date_introduction: TC.val('e-intro') || null,
                    description: TC.val('e-desc') || null,
                    actif: true
                };

                try {
                    if (isNew) await TC.post('entreprises', body, 'ticker');
                    else await TC.patch('entreprises', 'ticker=eq.' + encodeURIComponent(ticker), body);
                    TC.modal.close();
                    TC.toast(isNew ? 'Société ' + ticker + ' créée' : 'Fiche ' + ticker + ' mise à jour', 'ok');
                    load();
                } catch (e) { TC.modal.msg(e.message, 'err'); }
            }
        });
    }

    /**
     * Suppression : la société porte des cotations, des états financiers et des
     * dividendes. Les compter avant permet d'annoncer ce qui sera perdu — ou
     * refusé par la clé étrangère — plutôt que d'afficher une erreur PostgREST.
     */
    async function remove(ticker) {
        const [hist, fin, div] = await Promise.all([
            TC.count('historique', 'ticker=eq.' + encodeURIComponent(ticker)),
            TC.count('financials', 'ticker=eq.' + encodeURIComponent(ticker)),
            TC.count('dividendes_calendrier', 'ticker=eq.' + encodeURIComponent(ticker))
        ]);
        const attached = hist.value + fin.value + div.value;
        const detail = attached
            ? 'Cette société porte ' + hist.value + ' cotation(s), ' + fin.value + ' état(s) financier(s) et ' +
            div.value + ' dividende(s). Supabase refusera la suppression tant que ces lignes existent.'
            : 'Aucune donnée rattachée.';
        if (!TC.confirmTwice('Supprimer la société ' + ticker + ' ?\n\n' + detail, 'la fiche disparaîtra du référentiel')) return;
        try {
            await TC.del('entreprises', 'ticker=eq.' + encodeURIComponent(ticker));
            TC.toast('Société ' + ticker + ' supprimée', 'ok');
            load();
        } catch (e) { TC.toast(e.message, 'err'); }
    }

    TC.register({
        id: 'entreprises',
        label: 'Sociétés cotées',
        group: 'societes',
        icon: '⌂',
        keywords: 'entreprise societe referentiel ticker isin secteur',
        view,
        refresh: load,
        mount() {
            TC.on('ent-new', 'click', () => openForm(null));
            TC.on('ent-reload', 'click', load);
            TC.on('ent-search', 'input', filter);
            TC.on('ent-scope', 'change', filter);
            TC.on('ent-all', 'change', e => sel.all(rows.map(r => r.ticker), e.target.checked));
            TC.on('ent-bulk-reset', 'click', () => sel.reset());
            TC.on('ent-bulk-del', 'click', async function () {
                const ids = sel.ids();
                if (!ids.length) return;
                if (!TC.confirmTwice('Supprimer ' + ids.length + ' société(s) du référentiel ?',
                    'toute société portant des cotations sera refusée par Supabase')) return;
                let done = 0, refused = 0;
                for (const t of ids) {
                    try { await TC.del('entreprises', 'ticker=eq.' + encodeURIComponent(t)); done++; }
                    catch (e) { refused++; }
                }
                TC.toast(done + ' supprimée(s)' + (refused ? ', ' + refused + ' refusée(s) — données rattachées' : ''),
                    refused ? 'warn' : 'ok');
                load();
            });
            TC.on('ent-export', 'click', function () {
                if (!rows.length) return;
                TC.download('referentiel-societes-' + TC.today() + '.csv',
                    TC.toCSV(rows, ['ticker', 'nom', 'secteur', 'pays', 'compartiment', 'isin', 'nombre_actions', 'site_web', 'siege_social']),
                    'text/csv;charset=utf-8');
            });
            TC.delegate('ent-tbody', '.rowcheck', 'change', n => sel.toggle(n.dataset.id, n.checked));
            TC.delegate('ent-tbody', '[data-edit]', 'click', n => {
                const row = rows.find(r => r.ticker === n.dataset.edit);
                if (row) openForm(row);
            });
            TC.delegate('ent-tbody', '[data-del]', 'click', n => remove(n.dataset.del));
            load();
        }
    });

})(window.TC);
