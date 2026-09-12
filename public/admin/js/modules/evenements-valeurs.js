/* ============================================================
   THE CAPITAL — ÉVÈNEMENTS SUR VALEURS (ESV)
   Dividendes, coupons obligataires, fractionnements, augmentations
   et réductions de capital, fusions/absorptions, consolidations,
   radiations — récupérés depuis brvm.org/fr/esv/*, PDF re-hébergés
   dans Supabase Storage. Table evenements_valeurs, alimentée par
   api/process-brvm.js (scope 'esv' — cron quotidien 18h Abidjan +
   backfill manuel ici).
   ============================================================ */
'use strict';

(function (TC) {

    const CATEGORIES = [
        { v: 'dividende', l: 'Paiement de dividendes' },
        { v: 'coupon', l: 'Coupon / remb. capital' },
        { v: 'fractionnement', l: 'Fractionnement' },
        { v: 'augmentation_capital', l: 'Augmentation de capital' },
        { v: 'reduction_capital', l: 'Réduction de capital' },
        { v: 'fusion_absorption', l: 'Fusion / absorption' },
        { v: 'consolidation', l: 'Consolidation' },
        { v: 'radiation', l: 'Radiation' }
    ];
    const labelOf = c => (CATEGORIES.find(x => x.v === c) || {}).l || c;

    let rows = [];

    function view() {
        return '' +
            '<div class="page-head"><div><div class="page-title">Évènements sur <em>valeurs</em></div>' +
            '<div class="page-sub">Toutes les ESV publiées par la BRVM — dividendes, coupons, fractionnements, augmentations/réductions de capital, fusions, consolidations, radiations. Un passage automatique tourne chaque jour vers 18h (heure d\'Abidjan) ; les nouveautés et les modifications apparaissent dans le journal ci-dessous.</div></div></div>' +

            '<div class="kpis" id="esv-kpis"></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Récupération</span></div>' +
            '<div class="card-body">' +
            '<div class="field" style="margin-bottom:12px;"><label>Catégories</label>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;">' +
            CATEGORIES.map(c => '<label style="display:flex;align-items:center;gap:5px;font-size:12px;">' +
                '<input type="checkbox" class="esv-cat" value="' + c.v + '" checked> ' + TC.esc(c.l) + '</label>').join('') +
            '</div></div>' +
            '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">' +
            '<div class="field" style="max-width:120px;"><label>Ancienneté (années)</label><input type="number" id="esv-years" value="5" min="1" max="20"></div>' +
            '<div class="field" style="max-width:120px;"><label>Pages max / catégorie</label><input type="number" id="esv-pages" value="15" min="1" max="60"></div>' +
            '<button class="btn btn-primary btn-sm" id="esv-run">▶ Récupérer</button>' +
            '<button class="btn btn-outline btn-sm" id="esv-continue" hidden>Continuer (reste à traiter)</button>' +
            '</div>' +
            '<div class="msg" id="esv-msg" style="margin-top:10px;"></div>' +
            '<div class="log" id="esv-log" style="margin-top:10px;">Aucune exécution dans cette session.</div>' +
            '</div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Journal du suiveur</span>' +
            '<span class="card-tools"><button class="btn btn-outline btn-sm" id="esv-runs-reload">↺</button></span></div>' +
            '<div class="card-body tight"><div class="tw capped"><table><thead><tr>' +
            '<th>Démarré</th><th>Statut</th><th class="r">Total</th><th class="r">Nouveaux</th><th class="r">Modifiés</th><th>Détail</th>' +
            '</tr></thead><tbody id="esv-runs-body">' + TC.rowsLoading(6) + '</tbody></table></div></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Évènements enregistrés</span>' +
            '<span class="card-tools">' +
            '<select id="esv-filter-cat" style="margin-right:6px;"><option value="">Toutes catégories</option>' +
            CATEGORIES.map(c => '<option value="' + c.v + '">' + TC.esc(c.l) + '</option>').join('') + '</select>' +
            '<input type="search" id="esv-filter-search" placeholder="Émetteur ou ticker…" style="width:150px;margin-right:6px;">' +
            '<label style="font-size:12px;display:inline-flex;align-items:center;gap:4px;">' +
            '<input type="checkbox" id="esv-filter-unmatched"> Non rapprochés</label>' +
            '<span class="card-count" id="esv-count"></span>' +
            '<button class="btn btn-outline btn-sm" id="esv-reload">↺</button></span></div>' +
            '<div class="tw capped" id="esv-scope"><table><thead><tr>' +
            '<th>Catégorie</th><th>Émetteur</th><th>Détail</th><th>Dates</th><th>Documents</th><th>Suivi</th><th></th>' +
            '</tr></thead><tbody id="esv-body">' + TC.rowsLoading(7) + '</tbody></table></div></div>';
    }

    function log(text, level) {
        const box = TC.el('esv-log');
        if (!box) return;
        if (box.dataset.fresh !== '1') { box.innerHTML = ''; box.dataset.fresh = '1'; }
        const time = new Date().toLocaleTimeString('fr-FR');
        box.innerHTML += '<div><span class="' + (level || 'info') + '">' + TC.esc(time) + ' — ' + TC.esc(text) + '</span></div>';
        box.scrollTop = box.scrollHeight;
    }

    function selectedCategories() {
        return Array.from(document.querySelectorAll('.esv-cat:checked')).map(el => el.value);
    }

    async function runScrape() {
        const categories = selectedCategories();
        if (!categories.length) { TC.say('esv-msg', 'Choisissez au moins une catégorie.', 'err'); return; }
        const sinceYears = Math.max(1, Number(TC.val('esv-years')) || 5);
        const maxPages = Math.max(1, Number(TC.val('esv-pages')) || 15);
        TC.say('esv-msg', 'Interrogation de brvm.org…', 'info');
        TC.el('esv-run').disabled = true;
        try {
            const r = await TC.api('/api/process-brvm', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scope: 'esv', categories, sinceYears, maxPages, downloadDocs: true }),
                timeout: 55000
            });
            log(r.total + ' évènement(s) trouvé(s) · ' + r.created + ' nouveau(x) · ' + r.updated + ' modifié(s) · ' + r.unchanged + ' inchangé(s).', 'ok');
            if (r.scrape_errors && r.scrape_errors.length) {
                r.scrape_errors.forEach(e => log('Catégorie ' + labelOf(e.categorie) + ' : ' + e.error, 'warn'));
            }
            if (r.doc_errors && r.doc_errors.length) {
                r.doc_errors.forEach(e => log('Document (' + e.doc + ') non récupéré pour ' + e.natural_key + ' : ' + e.error, 'warn'));
            }
            if (r.row_errors && r.row_errors.length) {
                r.row_errors.forEach(e => log('Ligne ignorée (' + labelOf(e.categorie) + ' — ' + (e.emetteur || '?') + ') : ' + e.error, 'err'));
            }
            const more = r.has_more && Object.values(r.has_more).some(Boolean);
            const rowIssues = (r.row_errors || []).length;
            TC.el('esv-continue').hidden = !more;
            TC.say('esv-msg', r.created + ' nouveauté(s), ' + r.updated + ' modification(s)' +
                (rowIssues ? ' · ' + rowIssues + ' ligne(s) ignorée(s) (voir le journal ci-dessus)' : '') +
                (more ? ' · certaines catégories ont encore des pages plus anciennes, augmentez « Ancienneté » ou « Pages max » puis relancez.' : '.'), (more || rowIssues) ? 'warn' : 'ok');
            await Promise.all([load(), loadRuns()]);
        } catch (e) {
            log('Échec : ' + e.message, 'err');
            TC.say('esv-msg', e.message, 'err');
        } finally {
            TC.el('esv-run').disabled = false;
        }
    }

    function box(label, value, tone) {
        return '<div class="kpi"><div class="kpi-label">' + TC.esc(label) + '</div><div class="kpi-value sm"' +
            (tone ? ' style="color:var(--' + tone + ')"' : '') + '>' + TC.esc(String(value)) + '</div></div>';
    }

    function paintKpis() {
        const total = rows.length;
        const unmatched = rows.filter(r => !r.ticker && !r.emetteur_absorbe).length;
        const upcoming = rows.filter(r => {
            const d = r.date_paiement || r.date_evenement;
            return d && d >= TC.today();
        }).length;
        const recent = new Date(Date.now() - 7 * 86400000).toISOString();
        const changed = rows.filter(r => r.last_changed_at && r.last_changed_at >= recent).length;

        TC.el('esv-kpis').innerHTML =
            box('Évènements', total) +
            box('À venir', upcoming) +
            box('Non rapprochés', unmatched, unmatched ? 'orange' : 'green') +
            box('Modifiés (7 j)', changed, changed ? 'gold' : 'green');
    }

    function detailOf(r) {
        switch (r.categorie) {
            case 'dividende':
                return (r.exercice ? 'Exercice ' + r.exercice + ' · ' : '') + (r.montant_net != null ? TC.fmt(r.montant_net) + ' FCFA net' : '—');
            case 'coupon':
                return r.obligation || '—';
            case 'fractionnement':
                return [r.parite, r.valeur_theorique != null ? 'Valeur théorique ' + TC.fmt(r.valeur_theorique) + ' FCFA' : null].filter(Boolean).join(' · ') || '—';
            case 'augmentation_capital':
            case 'reduction_capital':
                return [r.parite, r.nature_droit, r.periode_negociation].filter(Boolean).join(' · ') || '—';
            case 'fusion_absorption':
                return 'Absorbé : ' + (r.emetteur_absorbe || '—') + (r.obligation ? ' · ' + r.obligation : '');
            case 'radiation':
                return r.obligation || '—';
            default:
                return '—';
        }
    }

    function datesOf(r) {
        const parts = [];
        if (r.date_paiement) parts.push('Paiement ' + TC.fmtDate(r.date_paiement));
        if (r.date_ex) parts.push('Ex ' + TC.fmtDate(r.date_ex));
        if (r.date_evenement) parts.push(TC.fmtDate(r.date_evenement));
        return parts.length ? parts.join('<br>') : '—';
    }

    function docsOf(r) {
        const out = [];
        if (r.avis_stored_url || r.avis_url) {
            out.push('<a href="' + TC.esc(r.avis_stored_url || r.avis_url) + '" target="_blank" rel="noopener noreferrer">Avis ↗</a>');
        }
        if (r.communique_stored_url || r.communique_url) {
            out.push('<a href="' + TC.esc(r.communique_stored_url || r.communique_url) + '" target="_blank" rel="noopener noreferrer">Communiqué ↗</a>');
        }
        return out.length ? out.join(' · ') : '—';
    }

    function suiviOf(r) {
        const dayAgo = new Date(Date.now() - 24 * 3600000).toISOString();
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        if (r.first_seen_at && r.first_seen_at >= dayAgo) return '<span class="badge badge-gold">nouveau</span>';
        if (r.last_changed_at && r.last_changed_at >= weekAgo && r.last_changed_at !== r.first_seen_at) {
            return '<span class="badge badge-orange">modifié</span>';
        }
        return '<span class="badge badge-green">stable</span>';
    }

    function paint(list) {
        const tbody = TC.el('esv-body');
        TC.el('esv-count').textContent = list.length + ' ligne(s)';
        if (!list.length) {
            tbody.innerHTML = TC.rowsEmpty(7, 'Aucun évènement enregistré', 'Lancez une récupération ci-dessus.');
            return;
        }
        tbody.innerHTML = list.map(function (r) {
            const emetteur = r.ticker
                ? '<span class="td-key">' + TC.esc(r.ticker) + '</span><div class="td-muted" style="font-size:11px;">' + TC.esc(r.emetteur_brvm || '') + '</div>'
                : '<span style="color:var(--orange);">' + TC.esc(r.emetteur_brvm || r.emetteur_absorbe || '—') + '</span>' +
                  (r.emetteur_absorbe ? '' : '<div><button class="btn btn-outline btn-sm esv-assign" data-id="' + r.id + '" style="margin-top:4px;">Assigner un ticker</button></div>');
            return '<tr>' +
                '<td><span class="badge">' + TC.esc(labelOf(r.categorie)) + '</span></td>' +
                '<td>' + emetteur + '</td>' +
                '<td class="td-muted">' + TC.esc(detailOf(r)) + '</td>' +
                '<td class="td-mono" style="white-space:nowrap;">' + datesOf(r) + '</td>' +
                '<td>' + docsOf(r) + '</td>' +
                '<td>' + suiviOf(r) + '</td>' +
                '<td class="r"><button class="btn btn-danger btn-ico esv-del" data-id="' + r.id + '">✕</button></td></tr>';
        }).join('');
    }

    function filter() {
        const categorie = TC.val('esv-filter-cat');
        const q = (TC.val('esv-filter-search') || '').toUpperCase();
        const onlyUnmatched = TC.el('esv-filter-unmatched').checked;
        paint(rows.filter(r =>
            (!categorie || r.categorie === categorie) &&
            (!onlyUnmatched || (!r.ticker && !r.emetteur_absorbe)) &&
            (!q || String(r.ticker || '').toUpperCase().indexOf(q) !== -1 ||
                String(r.emetteur_brvm || '').toUpperCase().indexOf(q) !== -1)));
    }

    async function load() {
        TC.el('esv-body').innerHTML = TC.rowsLoading(7);
        rows = await TC.getAll('evenements_valeurs', 'select=*&order=last_changed_at.desc');
        paintKpis();
        filter();
    }

    async function loadRuns() {
        const body = TC.el('esv-runs-body');
        if (!body) return;
        try {
            const r = await TC.api('/api/process-brvm?scope=esv&action=runs', { method: 'GET', timeout: 15000 });
            const runs = r.runs || [];
            body.innerHTML = runs.length ? runs.map(run => {
                const res = run.result || {};
                const tone = run.status === 'success' ? 'badge-green' : run.status === 'partial' ? 'badge-orange' : 'badge-orange';
                const detailBits = [];
                if (run.error) detailBits.push(run.error);
                if ((res.scrape_errors || []).length) detailBits.push(res.scrape_errors.length + ' erreur(s) source');
                if ((res.row_errors || []).length) detailBits.push(res.row_errors.length + ' ligne(s) ignorée(s)');
                if ((res.doc_errors || []).length) detailBits.push(res.doc_errors.length + ' document(s) non récupéré(s)');
                return '<tr>' +
                    '<td class="td-mono">' + TC.esc(new Date(run.started_at).toLocaleString('fr-FR')) + '</td>' +
                    '<td><span class="badge ' + tone + '">' + TC.esc(run.status) + '</span></td>' +
                    '<td class="r td-mono">' + TC.esc(res.total ?? '—') + '</td>' +
                    '<td class="r td-mono">' + TC.esc(res.created ?? '—') + '</td>' +
                    '<td class="r td-mono">' + TC.esc(res.updated ?? '—') + '</td>' +
                    '<td class="td-muted">' + TC.esc(detailBits.length ? detailBits.join(' · ') : '—') + '</td>' +
                    '</tr>';
            }).join('') : '<tr><td colspan="6" class="td-muted" style="text-align:center;padding:16px;">Aucun passage encore enregistré.</td></tr>';
        } catch (e) {
            body.innerHTML = '<tr><td colspan="6" class="td-muted">Chargement impossible : ' + TC.esc(e.message) + '</td></tr>';
        }
    }

    async function assignTicker(id) {
        const row = rows.find(r => String(r.id) === id);
        if (!row) return;
        const ticker = prompt('Ticker à associer à « ' + (row.emetteur_brvm || '') + ' » ?');
        if (!ticker) return;
        const known = await TC.tickerSet();
        const upper = ticker.trim().toUpperCase();
        if (!known.has(upper)) { TC.toast('Ticker ' + upper + ' inconnu du référentiel.', 'err'); return; }
        try {
            await TC.patch('evenements_valeurs', 'id=eq.' + id, { ticker: upper });
            TC.toast('Ticker associé.', 'ok');
            load();
        } catch (e) { TC.toast(e.message, 'err'); }
    }

    async function deleteRow(id) {
        if (!confirm('Supprimer cet évènement de la base ?')) return;
        try {
            await TC.del('evenements_valeurs', 'id=eq.' + id);
            TC.toast('Supprimé', 'ok');
            load();
        } catch (e) { TC.toast(e.message, 'err'); }
    }

    TC.register({
        id: 'evenements-valeurs',
        label: 'Évènements sur valeurs',
        group: 'marche',
        icon: '📑',
        keywords: 'esv evenements valeurs dividende coupon fractionnement augmentation reduction capital fusion absorption consolidation radiation brvm',
        view,
        refresh: load,
        mount() {
            TC.on('esv-run', 'click', runScrape);
            TC.on('esv-continue', 'click', runScrape);
            TC.on('esv-runs-reload', 'click', loadRuns);
            TC.on('esv-reload', 'click', load);
            TC.on('esv-filter-cat', 'change', filter);
            TC.on('esv-filter-search', 'input', filter);
            TC.on('esv-filter-unmatched', 'change', filter);
            TC.delegate('esv-body', '.esv-assign', 'click', n => assignTicker(n.dataset.id));
            TC.delegate('esv-body', '.esv-del', 'click', n => deleteRow(n.dataset.id));
            load();
            loadRuns();
        }
    });

})(window.TC);
