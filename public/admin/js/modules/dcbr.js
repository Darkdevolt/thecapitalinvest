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

            '<div class="card accent"><div class="card-head"><span class="card-title">Ajouter ou corriger une fiche à la main</span></div>' +
            '<div class="card-body"><div class="note">Utile quand une fiche manque, ou que le scraper a mal lu un champ. L\'identifiant sert de clé unique : laissez-le vide pour une fiche saisie à la main, il sera généré automatiquement.</div>' +
            '<div class="form-grid">' + TC.fields([
                { id: 'dcbr-f-source', label: 'Identifiant (URL source, ou vide)', wide: true, placeholder: 'https://dcbruemoa.org/fiche-technique/…' },
                { id: 'dcbr-f-designation', label: 'Désignation', wide: true, placeholder: 'EMPRUNT OBLIGATAIRE... 6,80% 2024-2029' },
                { id: 'dcbr-f-categorie', label: 'Catégorie', type: 'select', options: [{ v: 'cotee', l: 'Cotée' }, { v: 'non_cotee', l: 'Non cotée' }] },
                { id: 'dcbr-f-symbole', label: 'Symbole' },
                { id: 'dcbr-f-isin', label: 'ISIN' },
                { id: 'dcbr-f-code', label: 'Code BRVM (rapprochement)', col: 'code_obligation' },
                { id: 'dcbr-f-emetteur', label: 'Raison sociale émetteur', wide: true, col: 'raison_sociale_emetteur' },
                { id: 'dcbr-f-vn', label: 'Valeur nominale', type: 'number', col: 'valeur_nominale' },
                { id: 'dcbr-f-nb', label: 'Nombre de titres', type: 'number', step: '1', col: 'nombre_titres' },
                { id: 'dcbr-f-prix-em', label: 'Prix d\'émission', type: 'number', col: 'prix_emission' },
                { id: 'dcbr-f-jouissance', label: 'Date de jouissance', type: 'date', col: 'date_jouissance' },
                { id: 'dcbr-f-taux-brut', label: 'Taux brut (%)', type: 'number', step: '0.01', col: 'taux_brut' },
                { id: 'dcbr-f-taux-net', label: 'Taux net (%)', type: 'number', step: '0.01', col: 'taux_net' },
                { id: 'dcbr-f-coupon-brut', label: 'Coupon brut', type: 'number', col: 'montant_coupon_brut' },
                { id: 'dcbr-f-coupon-net', label: 'Coupon net', type: 'number', col: 'montant_coupon_net' },
                { id: 'dcbr-f-modalite', label: 'Modalité de paiement', col: 'modalite_paiement' },
                { id: 'dcbr-f-duree', label: 'Durée', col: 'duree' },
                { id: 'dcbr-f-remboursement', label: 'Mode de remboursement', col: 'mode_remboursement' },
                { id: 'dcbr-f-prix-remb', label: 'Prix de remboursement', type: 'number', col: 'prix_remboursement' }
            ]) + '</div>' +
            '<div class="actions"><button class="btn btn-primary" id="dcbr-f-save">Enregistrer</button>' +
            '<button class="btn btn-outline btn-sm" id="dcbr-f-clear">Effacer</button>' +
            '<span class="msg" id="dcbr-f-msg"></span></div></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Journal des passages</span>' +
            '<span class="card-tools"><button class="btn btn-outline btn-sm" id="dcbr-runs-reload">↺</button></span></div>' +
            '<div class="card-body tight"><div class="tw capped"><table><thead><tr>' +
            '<th>Démarré</th><th>Statut</th><th class="r">Trouvées</th><th class="r">Nouvelles</th><th class="r">Modifiées</th><th>Détail</th>' +
            '</tr></thead><tbody id="dcbr-runs-body">' + TC.rowsLoading(6) + '</tbody></table></div></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Fiches enregistrées</span>' +
            '<span class="card-tools">' +
            '<select id="dcbr-filter-cat" style="margin-right:6px;"><option value="">Toutes catégories</option>' +
            '<option value="cotee">Cotées</option><option value="non_cotee">Non cotées</option></select>' +
            '<input type="search" id="dcbr-filter-search" placeholder="Émetteur, ISIN, symbole…" style="width:180px;">' +
            '<span class="card-count" id="dcbr-count"></span>' +
            '<button class="btn btn-outline btn-sm" id="dcbr-reload">↺</button></span></div>' +
            '<div class="tw capped" id="dcbr-scope"><table><thead><tr>' +
            '<th>Désignation</th><th>ISIN</th><th>Symbole</th><th>Code BRVM</th><th class="r">Taux brut</th>' +
            '<th class="r">Valeur nominale</th><th>Échéance jouissance</th><th>Catégorie</th><th></th><th></th>' +
            '</tr></thead><tbody id="dcbr-body">' + TC.rowsLoading(9) + '</tbody></table></div></div>';
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
            await Promise.all([load(), loadRuns()]);
        } catch (e) {
            log('Échec : ' + e.message, 'err');
            TC.say('dcbr-msg', e.message, 'err');
            loadRuns();
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
            tbody.innerHTML = TC.rowsEmpty(9, 'Aucune fiche enregistrée', 'Lancez une récupération ci-dessus.');
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
                '<td class="r">' + (/^https?:/i.test(r.source_url || '') ? '<a href="' + TC.esc(r.source_url) + '" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">Fiche ↗</a>' : '<span class="td-muted">saisie manuelle</span>') + '</td>' +
                '<td class="r" style="white-space:nowrap;">' +
                '<button class="btn btn-outline btn-ico" data-edit="' + encodeURIComponent(r.source_url) + '">✎</button> ' +
                '<button class="btn btn-danger btn-ico" data-del="' + encodeURIComponent(r.source_url) + '">✕</button></td></tr>';
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
        TC.el('dcbr-body').innerHTML = TC.rowsLoading(9);
        rows = await TC.getAll('obligations_caracteristiques', 'select=*&order=last_changed_at.desc');
        paintKpis();
        filter();
    }

    /* ── Saisie et correction manuelles ─────────────────────
       source_url est la clé de conflit du scraper : une fiche saisie à
       la main reçoit un identifiant synthétique (manual://…) si aucune
       URL n'est donnée, pour ne jamais entrer en collision avec une
       fiche réellement scrapée. */
    const FORM_IDS = ['dcbr-f-source', 'dcbr-f-designation', 'dcbr-f-categorie', 'dcbr-f-symbole', 'dcbr-f-isin',
        'dcbr-f-code', 'dcbr-f-emetteur', 'dcbr-f-vn', 'dcbr-f-nb', 'dcbr-f-prix-em', 'dcbr-f-jouissance',
        'dcbr-f-taux-brut', 'dcbr-f-taux-net', 'dcbr-f-coupon-brut', 'dcbr-f-coupon-net', 'dcbr-f-modalite',
        'dcbr-f-duree', 'dcbr-f-remboursement', 'dcbr-f-prix-remb'];

    function clearForm() { TC.clear(FORM_IDS); TC.say('dcbr-f-msg', ''); }

    function fillForm(r) {
        TC.setVal('dcbr-f-source', r.source_url || '');
        TC.setVal('dcbr-f-designation', r.designation);
        TC.setVal('dcbr-f-categorie', r.categorie || 'cotee');
        TC.setVal('dcbr-f-symbole', r.symbole);
        TC.setVal('dcbr-f-isin', r.isin);
        TC.setVal('dcbr-f-code', r.code_obligation);
        TC.setVal('dcbr-f-emetteur', r.raison_sociale_emetteur);
        TC.setVal('dcbr-f-vn', r.valeur_nominale);
        TC.setVal('dcbr-f-nb', r.nombre_titres);
        TC.setVal('dcbr-f-prix-em', r.prix_emission);
        TC.setVal('dcbr-f-jouissance', TC.toISODate(r.date_jouissance) || '');
        TC.setVal('dcbr-f-taux-brut', r.taux_brut);
        TC.setVal('dcbr-f-taux-net', r.taux_net);
        TC.setVal('dcbr-f-coupon-brut', r.montant_coupon_brut);
        TC.setVal('dcbr-f-coupon-net', r.montant_coupon_net);
        TC.setVal('dcbr-f-modalite', r.modalite_paiement);
        TC.setVal('dcbr-f-duree', r.duree);
        TC.setVal('dcbr-f-remboursement', r.mode_remboursement);
        TC.setVal('dcbr-f-prix-remb', r.prix_remboursement);
        document.getElementById('dcbr-f-source').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function saveForm() {
        const designation = TC.val('dcbr-f-designation');
        if (!designation) { TC.say('dcbr-f-msg', 'La désignation est obligatoire.', 'err'); return; }
        const sourceUrl = TC.val('dcbr-f-source') ||
            'manual://' + (TC.val('dcbr-f-code') || designation).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const body = {
            source_url: sourceUrl, designation, categorie: TC.val('dcbr-f-categorie') || 'cotee',
            symbole: TC.val('dcbr-f-symbole') || null, isin: TC.val('dcbr-f-isin') || null,
            code_obligation: TC.val('dcbr-f-code') || null, raison_sociale_emetteur: TC.val('dcbr-f-emetteur') || null,
            valeur_nominale: TC.num('dcbr-f-vn'), nombre_titres: TC.num('dcbr-f-nb'), prix_emission: TC.num('dcbr-f-prix-em'),
            date_jouissance: TC.toISODate(TC.val('dcbr-f-jouissance')) || null,
            taux_brut: TC.num('dcbr-f-taux-brut'), taux_net: TC.num('dcbr-f-taux-net'),
            montant_coupon_brut: TC.num('dcbr-f-coupon-brut'), montant_coupon_net: TC.num('dcbr-f-coupon-net'),
            modalite_paiement: TC.val('dcbr-f-modalite') || null, duree: TC.val('dcbr-f-duree') || null,
            mode_remboursement: TC.val('dcbr-f-remboursement') || null, prix_remboursement: TC.num('dcbr-f-prix-remb')
        };
        try {
            await TC.post('obligations_caracteristiques', body, 'source_url');
            TC.say('dcbr-f-msg', designation + ' enregistrée.', 'ok');
            clearForm();
            load();
        } catch (e) { TC.say('dcbr-f-msg', e.message, 'err'); }
    }

    async function loadRuns() {
        const body = TC.el('dcbr-runs-body');
        if (!body) return;
        try {
            const r = await TC.api('/api/process-brvm?scope=dcbr&action=runs', { method: 'GET', timeout: 15000 });
            const runs = r.runs || [];
            body.innerHTML = runs.length ? runs.map(run => {
                const res = run.result || {};
                const tone = run.status === 'success' ? 'badge-green' : run.status === 'partial' ? 'badge-orange' : 'badge-orange';
                const detailBits = [];
                if (run.error) detailBits.push(run.error);
                if ((res.scrape_errors || []).length) detailBits.push(res.scrape_errors.length + ' erreur(s) source');
                if ((res.row_errors || []).length) detailBits.push(res.row_errors.length + ' ligne(s) ignorée(s)');
                return '<tr>' +
                    '<td class="td-mono">' + TC.esc(new Date(run.started_at).toLocaleString('fr-FR')) + '</td>' +
                    '<td><span class="badge ' + tone + '">' + TC.esc(run.status) + '</span></td>' +
                    '<td class="r td-mono">' + TC.esc(res.found ?? '—') + '</td>' +
                    '<td class="r td-mono">' + TC.esc(res.created ?? '—') + '</td>' +
                    '<td class="r td-mono">' + TC.esc(res.updated ?? '—') + '</td>' +
                    '<td class="td-muted">' + TC.esc(detailBits.length ? detailBits.join(' · ') : '—') + '</td>' +
                    '</tr>';
            }).join('') : '<tr><td colspan="6" class="td-muted" style="text-align:center;padding:16px;">Aucun passage encore enregistré.</td></tr>';
        } catch (e) {
            body.innerHTML = '<tr><td colspan="6" class="td-muted">Chargement impossible : ' + TC.esc(e.message) + '</td></tr>';
        }
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
            TC.on('dcbr-runs-reload', 'click', loadRuns);
            TC.on('dcbr-filter-cat', 'change', filter);
            TC.on('dcbr-filter-search', 'input', filter);
            TC.on('dcbr-f-save', 'click', saveForm);
            TC.on('dcbr-f-clear', 'click', clearForm);
            TC.delegate('dcbr-body', '[data-edit]', 'click', n => {
                const row = rows.find(r => r.source_url === decodeURIComponent(n.dataset.edit)); if (row) fillForm(row);
            });
            TC.delegate('dcbr-body', '[data-del]', 'click', async function (n) {
                const url = decodeURIComponent(n.dataset.del);
                const row = rows.find(r => r.source_url === url);
                if (!row || !TC.confirmTwice('Supprimer la fiche ' + (row.designation || row.source_url) + ' ?')) return;
                try { await TC.del('obligations_caracteristiques', 'source_url=eq.' + encodeURIComponent(url)); TC.toast('Supprimé', 'ok'); load(); }
                catch (e) { TC.toast(e.message, 'err'); }
            });
            load();
            loadRuns();
        }
    });

})(window.TC);
