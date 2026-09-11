// ============================================================================
// ANNONCES & DOCUMENTS BRVM — convocations d'assemblées générales, projets de
// résolution, notations financières, communiqués, changements de dirigeants,
// franchissements de seuil. Documents copiés depuis brvm.org (voir Admin →
// Annonces émetteurs pour la récupération).
// ============================================================================
(function () {
  'use strict';
  if (window.__TC_DOCUMENTS_VIEW__) return;
  window.__TC_DOCUMENTS_VIEW__ = true;

  var CATEGORIES = [
    { value: 'convocation_ag', label: 'Convocations AG' },
    { value: 'projet_resolution', label: 'Projets de résolution' },
    { value: 'notation_financiere', label: 'Notations financières' },
    { value: 'communique', label: 'Communiqués' },
    { value: 'changement_dirigeants', label: 'Changements de dirigeants' },
    { value: 'franchissement_seuil', label: 'Franchissements de seuil' }
  ];
  var labelOf = function (c) { var m = CATEGORIES.filter(function (x) { return x.value === c; })[0]; return m ? m.label : c; };

  var ticker = '', categorie = '', loading = false;

  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function g(id) { return document.getElementById(id); }

  function companyList() {
    return (Array.isArray(window.allEntreprises) ? window.allEntreprises : [])
      .filter(function (e) { return e && e.ticker && e.actif !== false; })
      .map(function (e) { return { t: String(e.ticker).toUpperCase(), n: e.nom || e.nom_court || '' }; })
      .sort(function (a, b) { return a.t.localeCompare(b.t); });
  }

  function injectCss() {
    if (g('tc-documents-css')) return;
    var s = document.createElement('style');
    s.id = 'tc-documents-css';
    s.textContent = [
      '#view-documents .doc-form{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:16px}',
      '#view-documents .doc-field{display:flex;flex-direction:column;gap:4px;min-width:180px}',
      '#view-documents .doc-field label{font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--gold)}',
      '#view-documents select,#view-documents input{background:var(--surface);border:1px solid rgba(245,240,232,.16);color:var(--cream);border-radius:8px;padding:9px 10px;font:inherit}',
      '#view-documents .doc-list{display:flex;flex-direction:column;gap:0;background:var(--card);border:1px solid rgba(245,240,232,.09);border-radius:12px;overflow:hidden}',
      '#view-documents .doc-row{display:grid;grid-template-columns:96px 140px 1fr auto;gap:14px;align-items:center;padding:13px 16px;border-bottom:1px solid rgba(245,240,232,.08);text-decoration:none;color:inherit}',
      '#view-documents .doc-row:last-child{border-bottom:0}',
      '#view-documents .doc-row:hover{background:rgba(184,150,78,.05)}',
      '#view-documents .doc-date{font-family:var(--mono,monospace);font-size:12px;color:var(--dim)}',
      '#view-documents .doc-cat{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--gold);white-space:nowrap}',
      '#view-documents .doc-titre{font-size:13px;color:var(--cream)}',
      '#view-documents .doc-titre .soc{color:var(--muted);font-size:11.5px;display:block;margin-top:2px}',
      '#view-documents .doc-open{font-size:11px;color:var(--gold);white-space:nowrap}',
      '#view-documents .doc-empty{padding:36px;text-align:center;color:var(--dim)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function load() {
    if (loading) return;
    loading = true;
    g('docBody').innerHTML = '<div class="doc-empty">Chargement…</div>';
    var q = 'type=documents_emetteurs&limit=300';
    if (ticker) q += '&ticker=' + encodeURIComponent(ticker);
    if (categorie) q += '&categorie=' + encodeURIComponent(categorie);
    (window.apiGet ? window.apiGet('/marche?' + q, { cache: 'no-store' }) : Promise.reject(new Error('API indisponible')))
      .then(function (r) {
        loading = false;
        var rows = (r && (r.data || r)) || [];
        if (!rows.length) { g('docBody').innerHTML = '<div class="doc-empty">Aucun document pour ces filtres.</div>'; return; }
        g('docBody').innerHTML = rows.map(function (d) {
          return '<a class="doc-row" href="' + esc(d.fichier_url) + '" target="_blank" rel="noopener noreferrer">'
            + '<span class="doc-date">' + esc(d.date_publication || '—') + '</span>'
            + '<span class="doc-cat">' + esc(labelOf(d.categorie)) + '</span>'
            + '<span class="doc-titre">' + esc(d.titre || '—') + (d.ticker || d.societe_nom ? '<span class="soc">' + esc(d.ticker || d.societe_nom) + '</span>' : '') + '</span>'
            + '<span class="doc-open">Ouvrir ↗</span></a>';
        }).join('');
      })
      .catch(function (e) {
        loading = false;
        g('docBody').innerHTML = '<div class="doc-empty">Échec du chargement : ' + esc(e && e.message || 'erreur.') + '</div>';
      });
  }

  function render() {
    var view = g('view-documents');
    if (!view) return;
    injectCss();
    var comps = companyList();
    view.innerHTML = ''
      + '<div class="page-header"><h1>Annonces <span style="color:var(--gold)">& Documents</span></h1>'
      + '<p>Convocations d\'assemblées générales, résultats, dividendes, avis divers publiés par la BRVM — copiés depuis brvm.org.</p></div>'
      + '<div class="doc-form">'
      + '<div class="doc-field"><label for="docTicker">Société</label><select id="docTicker">'
      + '<option value="">Toutes les sociétés</option>'
      + comps.map(function (c) { return '<option value="' + esc(c.t) + '"' + (c.t === ticker ? ' selected' : '') + '>' + esc(c.t) + (c.n ? ' — ' + esc(c.n) : '') + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="doc-field"><label for="docCat">Catégorie</label><select id="docCat">'
      + '<option value="">Toutes catégories</option>'
      + CATEGORIES.map(function (c) { return '<option value="' + c.value + '"' + (c.value === categorie ? ' selected' : '') + '>' + esc(c.label) + '</option>'; }).join('')
      + '</select></div>'
      + '</div>'
      + '<div class="doc-list" id="docBody"><div class="doc-empty">Chargement…</div></div>';

    g('docTicker').addEventListener('change', function () { ticker = this.value.toUpperCase(); load(); });
    g('docCat').addEventListener('change', function () { categorie = this.value; load(); });
    load();
  }

  window.renderDocuments = render;
})();
