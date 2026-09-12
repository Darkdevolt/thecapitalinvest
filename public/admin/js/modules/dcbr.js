/* ============================================================
   THE CAPITAL — DC/BR (fiches techniques obligataires)
   Caractéristiques d'émission (ISIN, symbole, taux, valeur
   nominale, échéance...) des emprunts obligataires cotés ET non
   cotés, récupérées depuis dcbruemoa.org/fiche-technique. Complète
   la table `obligations` (cours BRVM quotidiens, cotées uniquement,
   sans ISIN) sans la remplacer. Table obligations_caracteristiques,
   alimentée par api/process-brvm.js (scope 'dcbr'). Déclenchement
   manuel uniquement : ces fiches ne changent pas d'une séance à
   l'autre, pas de cron.
   ============================================================ */
'use strict';

(function (TC) {

    let rows = [];

    function view() {
        return '' +
            '<div class="page-head"><div><div class="page-title">DC/BR — <em>fiches techniques</em></div>' +
            '<div class="page-sub">Caractéristiques d\'émission des emprunts obligataires UEMOA (ISIN, symbole, taux, valeur nominale, échéance) — cotés et non cotés, récupérés depuis dcbruemoa.org. Le code DC/BR ne correspond pas au code BRVM : le rapprochement avec la table Obligations se fait par nom, uniquement quand il n\'y a aucune ambiguïté.</div></div></div>' +

            '<div class="kpis" id="dcbr-kpis"></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Récupération</span></div>' +
            '<div class="card-body">' +
            '<div class="field" style="margin-bottom:12px;"><label>Catégories</label>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;">' +
            '<label style="display:flex;align-items:center;gap:5px;font-size:12px;"><input type="checkbox" class="dcbr-cat" value="cotee" checked> Obligations cotées</label>' +
            '<label style="display:flex;align-items:center;gap:5px;font-size:12px;"><input type="checkbox" class="dcbr-cat" value="non_cotee" checked> Obligations non cotées</label>' +
            '</div></div>' +
            '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">' +
            '<div class="field" style="max-width:140px;"><label>Pages de liste max</label><input type="number" id="dcbr-pages" value="15" min="1" max="60"></div>' +
            '<div class="field" style="max-width:140px;"><label>Fiches par lot</label><input type="number" id="dcbr-limit" value="40" min="5" max="150"></div>' +
            '<button class="btn btn-primary btn-sm" id="dcbr-run">▶ Récupérer</button>' +
            '<button class="btn btn-outline btn-sm" id="dcbr-continue" hidden>Continuer (reste à traiter)</button>' +
            '</div>' +
            '<div class="msg" id="dcbr-msg" style="margin-top:10px;"></div>' +
            '<div class="log" id="dcbr-log" style="margin-top:10px;">Aucune exécution dans cette session.</div>' +
            '</div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Fiches enregistrées</span>' +
            '<span class="card-tools">' +
            '<select id="dcbr-filter-cat" style="margin-right:6px;"><option value="">Toutes catégories</option>' +
            '<option value="cotee">Cotées</option><option value="non_cotee">Non cotées</option></select>' +
            '<input type="search" id="dcbr-filter-search" placeholder="Émetteur, ISIN, symbole…" style="width:180px;">' +
            '<span class="card-count" id="dcbr-count"></span>' +
            '<button class="btn btn-outline btn-sm" id="dcbr-reload">↺</button></span></div>' +
            '<div class="tw capped" id="dcbr-scope"><table><thead><tr>' +
            '<th>Désignation</th><th>ISIN</th><th>Symbole</th><th>Code BRVM</th><th class="r">Taux brut</th>' +
            '<th class="r">Valeur nominale</th><th>Échéance jouissance</th><th>Catégorie</th><th></th>' +
            '</tr></thead><tbody id="dcbr-body">' + TC.rowsLoading(8) + '</tbody></table></div></div>';
    }

    function log(text, level) {
        const box = TC.el('dcbr-log');
        if (!box) return;
        if (box.dataset.fresh !== '1') { box.innerHTML = ''; box.dataset.fresh = '1'; }
        const time = new Date().toLocaleTimeString('fr-FR');
        box.innerHTML += '<div><span class="' + (level || 'info') + '">' + TC.esc(time) + ' — ' + TC.esc(text) + '</span></div>';
        box.scrollTop = box.scrollHeight;
    }

    function selectedCategories() {
        return Array.from(document.querySelectorAll('.dcbr-cat:checked')).map(el => el.value);
    }

    async function runScrape() {
        const categories = selectedCategories();
        if (!categories.length) { TC.say('dcbr-msg', 'Choisissez au moins une catégorie.', 'err'); return; }
        const maxPages = Math.max(1, Number(TC.val('dcbr-pages')) || 15);
        const limit = Math.max(5, Number(TC.val('dcbr-limit')) || 40);
        TC.say('dcbr-msg', 'Interrogation de dcbruemoa.org…', 'info');
        TC.el('dcbr-run').disabled = true;
        try {
            const r = await TC.api('/api/process-brvm', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scope: 'dcbr', categories, maxPages, limit }),
                timeout: 65000
            });
            log(r.found + ' fiche(s) au total · ' + r.already_stored + ' déjà connue(s) · ' + r.fetched + ' lue(s) dans ce lot · ' +
                r.created + ' nouvelle(s) · ' + r.updated + ' modifiée(s) · ' + r.unchanged + ' inchangée(s).', 'ok');
            if (r.scrape_errors && r.scrape_errors.length) {
                r.scrape_errors.forEach(e => log('Fiche non lisible (' + e.categorie + ') ' + (e.url || '') + ' : ' + e.error, 'warn'));
            }
            if (r.row_errors && r.row_errors.length) {
                r.row_errors.forEach(e => log('Ligne ignorée (' + (e.designation || e.source_url) + ') : ' + e.error, 'err'));
            }
            TC.el('dcbr-continue').hidden = !r.has_more;
            TC.say('dcbr-msg', r.created + ' nouveauté(s), ' + r.updated + ' modification(s)' +
                (r.has_more ? ' · ' + r.remaining + ' fiche(s) restent à lire, cliquez « Continuer ».' : '.'), r.has_more ? 'warn' : 'ok');
            await load();
        } catch (e) {
            log('Échec : ' + e.message, 'err');
            TC.say('dcbr-msg', e.message, 'err');
        } finally {
            TC.el('dcbr-run').disabled = false;
        }
    }

    function box(label, value, tone) {
        return '<div class="kpi"><div class="kpi-label">' + TC.esc(label) + '</div><div class="kpi-value sm"' +
            (tone ? ' style="color:var(--' + tone + ')"' : '') + '>' + TC.esc(String(value)) + '</div></div>';
    }

    function paintKpis() {
        const total = rows.length;
        const withIsin = rows.filter(r => r.isin).length;
        const matched = rows.filter(r => r.code_obligation).length;
        const cotees = rows.filter(r => r.categorie === 'cotee').length;

        TC.el('dcbr-kpis').innerHTML =
            box('Fiches', total) +
            box('Avec ISIN', withIsin, withIsin === total ? 'green' : 'orange') +
            box('Rapprochées au code BRVM', matched) +
            box('Cotées', cotees);
    }

    function paint(list) {
        const tbody = TC.el('dcbr-body');
        TC.el('dcbr-count').textContent = list.length + ' ligne(s)';
        if (!list.length) {
            tbody.innerHTML = TC.rowsEmpty(8, 'Aucune fiche enregistrée', 'Lancez une récupération ci-dessus.');
            return;
        }
        tbody.innerHTML = list.map(function (r) {
            return '<tr>' +
                '<td class="td-muted">' + TC.esc(r.designation || '—') + '</td>' +
                '<td class="td-mono">' + TC.esc(r.isin || '—') + '</td>' +
                '<td class="td-mono">' + TC.esc(r.symbole || '—') + '</td>' +
                '<td class="td-mono">' + (r.code_obligation ? TC.esc(r.code_obligation) : '<span style="color:var(--orange);">—</span>') + '</td>' +
                '<td class="r td-mono">' + (r.taux_brut != null ? r.taux_brut.toFixed(2) + ' %' : '—') + '</td>' +
                '<td class="r td-mono">' + TC.fmt(r.valeur_nominale) + '</td>' +
                '<td class="td-muted">' + TC.fmtDate(r.date_jouissance) + '</td>' +
                '<td><span class="badge ' + (r.categorie === 'cotee' ? 'badge-green' : 'badge-orange') + '">' + TC.esc(r.categorie === 'cotee' ? 'Cotée' : 'Non cotée') + '</span></td>' +
                '<td class="r"><a href="' + TC.esc(r.source_url) + '" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">Fiche ↗</a></td></tr>';
        }).join('');
    }

    function filter() {
        const categorie = TC.val('dcbr-filter-cat');
        const q = (TC.val('dcbr-filter-search') || '').toUpperCase();
        paint(rows.filter(r =>
            (!categorie || r.categorie === categorie) &&
            (!q || String(r.designation || '').toUpperCase().indexOf(q) !== -1 ||
                String(r.isin || '').toUpperCase().indexOf(q) !== -1 ||
                String(r.symbole || '').toUpperCase().indexOf(q) !== -1)));
    }

    async function load() {
        TC.el('dcbr-body').innerHTML = TC.rowsLoading(8);
        rows = await TC.getAll('obligations_caracteristiques', 'select=*&order=last_changed_at.desc');
        paintKpis();
        filter();
    }

    TC.register({
        id: 'dcbr',
        label: 'DC/BR — Fiches obligataires',
        group: 'marche',
        icon: '🏦',
        keywords: 'dcbr depositaire central banque reglement obligations isin symbole caracteristiques emission',
        view,
        refresh: load,
        mount() {
            TC.on('dcbr-run', 'click', runScrape);
            TC.on('dcbr-continue', 'click', runScrape);
            TC.on('dcbr-reload', 'click', load);
            TC.on('dcbr-filter-cat', 'change', filter);
            TC.on('dcbr-filter-search', 'input', filter);
            load();
        }
    });

})(window.TC);
