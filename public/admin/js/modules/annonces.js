/* ============================================================
   THE CAPITAL — ANNONCES ÉMETTEURS (BRVM)
   Récupération des PDF publiés par la BRVM (convocations AG,
   projets de résolution, notations, communiqués, changements de
   dirigeants, franchissements de seuil), copiés dans Supabase
   Storage. Déclenchement manuel uniquement — voir la note dans
   api/process-brvm.js sur les crons silencieusement cassés.
   ============================================================ */
'use strict';

(function (TC) {

    const CATEGORIES = [
        { slug: 'convocations-assemblees-generales', categorie: 'convocation_ag', label: 'Convocations AG' },
        { slug: 'projets-de-resolution', categorie: 'projet_resolution', label: 'Projets de résolution' },
        { slug: 'notations-financieres', categorie: 'notation_financiere', label: 'Notations financières' },
        { slug: 'communiques', categorie: 'communique', label: 'Communiqués' },
        { slug: 'changements-de-dirigeants', categorie: 'changement_dirigeants', label: 'Changements de dirigeants' },
        { slug: 'franchissements-de-seuil', categorie: 'franchissement_seuil', label: 'Franchissements de seuil' }
    ];
    const labelOf = categorie => (CATEGORIES.find(c => c.categorie === categorie) || {}).label || categorie;

    function view() {
        return '' +
            '<div class="page-head"><div><div class="page-title">Annonces <em>émetteurs</em></div>' +
            '<div class="page-sub">Convocations d\'assemblées générales, résultats, dividendes, avis divers — récupérés depuis brvm.org et copiés dans le stockage. Déclenchement manuel : relancer ne duplique rien, ça reprend là où c\'est arrêté.</div></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Récupération</span></div>' +
            '<div class="card-body">' +
            '<div class="field" style="margin-bottom:12px;"><label>Catégories</label>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;">' +
            CATEGORIES.map(c => '<label style="display:flex;align-items:center;gap:5px;font-size:12px;">' +
                '<input type="checkbox" class="ann-cat" value="' + c.slug + '" checked> ' + TC.esc(c.label) + '</label>').join('') +
            '</div></div>' +
            '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">' +
            '<div class="field" style="max-width:120px;"><label>Ancienneté (années)</label><input type="number" id="ann-years" value="5" min="1" max="15"></div>' +
            '<button class="btn btn-primary btn-sm" id="ann-run">▶ Récupérer</button>' +
            '<button class="btn btn-outline btn-sm" id="ann-continue" hidden>Continuer (reste à traiter)</button>' +
            '</div>' +
            '<div class="msg" id="ann-msg" style="margin-top:10px;"></div>' +
            '<div class="log" id="ann-log" style="margin-top:10px;">Aucune exécution dans cette session.</div>' +
            '</div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Documents récupérés</span>' +
            '<span class="card-tools">' +
            '<select id="ann-filter-cat" style="margin-right:6px;"><option value="">Toutes catégories</option>' +
            CATEGORIES.map(c => '<option value="' + c.categorie + '">' + TC.esc(c.label) + '</option>').join('') + '</select>' +
            '<input type="text" id="ann-filter-ticker" placeholder="Ticker…" style="width:100px;">' +
            '</span></div>' +
            '<div class="card-body tight"><div class="tw"><table><thead><tr>' +
            '<th>Date</th><th>Société</th><th>Catégorie</th><th>Titre</th><th></th><th></th>' +
            '</tr></thead><tbody id="ann-body"></tbody></table></div></div></div>';
    }

    function log(text, level) {
        const box = TC.el('ann-log');
        if (!box) return;
        if (box.dataset.fresh !== '1') { box.innerHTML = ''; box.dataset.fresh = '1'; }
        const time = new Date().toLocaleTimeString('fr-FR');
        box.innerHTML += '<div><span class="' + (level || 'info') + '">' + TC.esc(time) + ' — ' + TC.esc(text) + '</span></div>';
        box.scrollTop = box.scrollHeight;
    }

    function selectedSlugs() {
        return Array.from(document.querySelectorAll('.ann-cat:checked')).map(el => el.value);
    }

    async function runScrape(extra) {
        const slugs = selectedSlugs();
        if (!slugs.length) { TC.say('ann-msg', 'Choisissez au moins une catégorie.', 'err'); return; }
        const years = Math.max(1, Number(TC.val('ann-years')) || 5);
        TC.say('ann-msg', 'Interrogation de brvm.org…', 'info');
        TC.el('ann-run').disabled = true;
        try {
            const r = await TC.api('/api/process-brvm', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({ scope: 'announcements', categories: slugs, sinceYears: years }, extra || {})),
                timeout: 55000
            });
            log(r.found + ' annonce(s) trouvée(s) · ' + r.already_stored + ' déjà en base · ' + r.imported + ' importée(s).', 'ok');
            if (r.scrape_errors && r.scrape_errors.length) {
                r.scrape_errors.forEach(e => log('Catégorie ' + labelOf(e.categorie) + ' : ' + e.error, 'warn'));
            }
            if (r.write_errors && r.write_errors.length) {
                r.write_errors.forEach(e => log('Échec document (' + e.source_url + ') : ' + e.error, 'err'));
            }
            TC.el('ann-continue').hidden = !r.has_more;
            TC.say('ann-msg', r.imported + ' document(s) importé(s)' + (r.has_more ? ' · ' + r.remaining + ' restant(s), cliquez « Continuer »' : '.'), r.has_more ? 'warn' : 'ok');
            await loadList();
        } catch (e) {
            log('Échec : ' + e.message, 'err');
            TC.say('ann-msg', e.message, 'err');
        } finally {
            TC.el('ann-run').disabled = false;
        }
    }

    async function loadList() {
        const body = TC.el('ann-body');
        if (!body) return;
        const categorie = TC.val('ann-filter-cat');
        const ticker = (TC.val('ann-filter-ticker') || '').trim().toUpperCase();
        try {
            const params = new URLSearchParams({ type: 'documents_emetteurs', limit: '300' });
            if (categorie) params.set('categorie', categorie);
            if (ticker) params.set('ticker', ticker);
            const r = await TC.api('/api/marche?' + params.toString(), { method: 'GET', timeout: 20000 });
            const rows = (r && (r.data || r)) || [];
            body.innerHTML = rows.length ? rows.map(d => '<tr>' +
                '<td class="td-mono">' + TC.esc(TC.fmtDate ? TC.fmtDate(d.date_publication) : (d.date_publication || '—')) + '</td>' +
                '<td>' + TC.esc(d.ticker || d.societe_nom || '—') + '</td>' +
                '<td><span class="badge">' + TC.esc(labelOf(d.categorie)) + '</span></td>' +
                '<td class="td-muted">' + TC.esc(d.titre || '—') + '</td>' +
                '<td><a href="' + TC.esc(d.fichier_url) + '" target="_blank" rel="noopener noreferrer">Ouvrir ↗</a></td>' +
                '<td><button class="btn btn-outline btn-sm ann-del" data-id="' + TC.esc(d.id) + '">Retirer</button></td>' +
                '</tr>').join('') : '<tr><td colspan="6" class="td-muted" style="text-align:center;padding:20px;">Aucun document.</td></tr>';
        } catch (e) {
            body.innerHTML = '<tr><td colspan="6" class="td-muted">Chargement impossible : ' + TC.esc(e.message) + '</td></tr>';
        }
    }

    async function deleteDoc(id) {
        if (!confirm('Retirer ce document (base + fichier stocké) ?')) return;
        try {
            await TC.api('/api/process-brvm', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scope: 'announcements', action: 'delete', id }),
                timeout: 15000
            });
            TC.toast('Document retiré', 'ok');
            await loadList();
        } catch (e) {
            TC.toast(e.message, 'err');
        }
    }

    TC.register({
        id: 'annonces',
        label: 'Annonces émetteurs',
        group: 'marche',
        icon: '📄',
        keywords: 'annonces documents convocations assemblee generale resultats dividendes brvm pdf',
        view,
        mount() {
            TC.on('ann-run', 'click', () => runScrape());
            TC.on('ann-continue', 'click', () => runScrape());
            TC.on('ann-filter-cat', 'change', loadList);
            TC.on('ann-filter-ticker', 'input', loadList);
            TC.delegate('ann-body', '.ann-del', 'click', function (btn) { deleteDoc(btn.dataset.id); });
            loadList();
        }
    });

})(window.TC);
