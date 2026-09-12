// ============================================================================
// ÉVÈNEMENTS SUR VALEURS (ESV) BRVM — dividendes, coupons/remboursement de
// capital, fractionnements, augmentations/réductions de capital, fusions,
// consolidations, radiations. Calendrier global, toutes sociétés confondues
// (voir aussi la fiche titre, qui n'affiche que les évènements d'une société).
// Alimenté par api/process-brvm.js?scope=esv (voir Admin → Évènements sur
// valeurs pour la récupération).
// ============================================================================
(function () {
  'use strict';
  if (window.__TC_ESV_VIEW__) return;
  window.__TC_ESV_VIEW__ = true;

  var CATEGORIES = [
    { value: 'dividende', label: 'Dividendes' },
    { value: 'coupon', label: 'Coupon / remb. capital' },
    { value: 'fractionnement', label: 'Fractionnement' },
    { value: 'augmentation_capital', label: 'Augmentation de capital' },
    { value: 'reduction_capital', label: 'Réduction de capital' },
    { value: 'fusion_absorption', label: 'Fusion / absorption' },
    { value: 'consolidation', label: 'Consolidation' },
    { value: 'radiation', label: 'Radiation' }
  ];
  var labelOf = function (c) { var m = CATEGORIES.filter(function (x) { return x.value === c; })[0]; return m ? m.label : c; };

  var ticker = '', categorie = '', onlyUpcoming = false, loading = false;

  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function g(id) { return document.getElementById(id); }
  function fmtDate(v) {
    if (!v) return '';
    var s = String(v).slice(0, 10), p = s.split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s;
  }
  function fmtNum(v) {
    if (v == null || v === '') return '';
    var n = Number(v);
    return isFinite(n) ? n.toLocaleString('fr-FR') : '';
  }

  function companyList() {
    return (Array.isArray(window.allEntreprises) ? window.allEntreprises : [])
      .filter(function (e) { return e && e.ticker && e.actif !== false; })
      .map(function (e) { return { t: String(e.ticker).toUpperCase(), n: e.nom || e.nom_court || '' }; })
      .sort(function (a, b) { return a.t.localeCompare(b.t); });
  }

  function detailOf(e) {
    switch (e.categorie) {
      case 'dividende':
        return [e.exercice ? 'Exercice ' + e.exercice : null, e.montant_net != null ? fmtNum(e.montant_net) + ' FCFA net' : null].filter(Boolean).join(' · ');
      case 'coupon':
        return e.obligation || '';
      case 'fractionnement':
        return [e.parite, e.valeur_theorique != null ? 'Valeur théorique ' + fmtNum(e.valeur_theorique) + ' FCFA' : null].filter(Boolean).join(' · ');
      case 'augmentation_capital': case 'reduction_capital':
        return [e.parite, e.nature_droit, e.periode_negociation].filter(Boolean).join(' · ');
      case 'fusion_absorption':
        return e.emetteur_absorbe ? 'Absorbé : ' + e.emetteur_absorbe : '';
      case 'radiation':
        return e.obligation || '';
      default:
        return '';
    }
  }
  function dateOf(e) {
    return e.date_paiement || e.date_evenement || e.date_ex || null;
  }

  function injectCss() {
    if (g('tc-esv-css')) return;
    var s = document.createElement('style');
    s.id = 'tc-esv-css';
    s.textContent = [
      '#view-evenements-valeurs .doc-form{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:16px}',
      '#view-evenements-valeurs .doc-field{display:flex;flex-direction:column;gap:4px;min-width:180px}',
      '#view-evenements-valeurs .doc-field label{font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--gold)}',
      '#view-evenements-valeurs select,#view-evenements-valeurs input{background:var(--surface);border:1px solid rgba(245,240,232,.16);color:var(--cream);border-radius:8px;padding:9px 10px;font:inherit}',
      '#view-evenements-valeurs .doc-checkbox{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);padding-bottom:9px}',
      '#view-evenements-valeurs .doc-list{display:flex;flex-direction:column;gap:0;background:var(--card);border:1px solid rgba(245,240,232,.09);border-radius:12px;overflow:hidden}',
      '#view-evenements-valeurs .doc-row{display:grid;grid-template-columns:96px 150px 120px 1fr auto;gap:14px;align-items:center;padding:13px 16px;border-bottom:1px solid rgba(245,240,232,.08);text-decoration:none;color:inherit}',
      '#view-evenements-valeurs .doc-row:last-child{border-bottom:0}',
      '#view-evenements-valeurs .doc-row:hover{background:rgba(184,150,78,.05)}',
      '#view-evenements-valeurs .doc-date{font-family:var(--mono,monospace);font-size:12px;color:var(--dim)}',
      '#view-evenements-valeurs .doc-cat{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--gold);white-space:nowrap}',
      '#view-evenements-valeurs .doc-ticker{font-size:12px;font-weight:600;color:var(--cream)}',
      '#view-evenements-valeurs .doc-titre{font-size:13px;color:var(--cream)}',
      '#view-evenements-valeurs .doc-titre .soc{color:var(--muted);font-size:11.5px;display:block;margin-top:2px}',
      '#view-evenements-valeurs .doc-open{font-size:11px;color:var(--gold);white-space:nowrap}',
      '#view-evenements-valeurs .doc-empty{padding:36px;text-align:center;color:var(--dim)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function load() {
    if (loading) return;
    loading = true;
    g('esvBody').innerHTML = '<div class="doc-empty">Chargement…</div>';
    var q = 'type=evenements_valeurs&limit=300';
    if (ticker) q += '&ticker=' + encodeURIComponent(ticker);
    if (categorie) q += '&categorie=' + encodeURIComponent(categorie);
    (window.apiGet ? window.apiGet('/marche?' + q, { cache: 'no-store' }) : Promise.reject(new Error('API indisponible')))
      .then(function (r) {
        loading = false;
        var rows = (r && (r.data || r)) || [];
        if (onlyUpcoming) {
          var today = new Date().toISOString().slice(0, 10);
          rows = rows.filter(function (e) { var d = dateOf(e); return d && d >= today; });
        }
        if (!rows.length) { g('esvBody').innerHTML = '<div class="doc-empty">Aucun évènement pour ces filtres.</div>'; return; }
        g('esvBody').innerHTML = rows.map(function (e) {
          var link = e.avis_stored_url || e.avis_url;
          var row = '<span class="doc-date">' + esc(fmtDate(dateOf(e)) || '—') + '</span>'
            + '<span class="doc-cat">' + esc(labelOf(e.categorie)) + '</span>'
            + '<span class="doc-ticker">' + esc(e.ticker || '—') + '</span>'
            + '<span class="doc-titre">' + esc(e.emetteur_brvm || e.emetteur_absorbe || '—')
            + (detailOf(e) ? '<span class="soc">' + esc(detailOf(e)) + '</span>' : '') + '</span>';
          return link
            ? '<a class="doc-row" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + row + '<span class="doc-open">Avis ↗</span></a>'
            : '<div class="doc-row">' + row + '<span></span></div>';
        }).join('');
      })
      .catch(function (e) {
        loading = false;
        g('esvBody').innerHTML = '<div class="doc-empty">Échec du chargement : ' + esc(e && e.message || 'erreur.') + '</div>';
      });
  }

  function render() {
    var view = g('view-evenements-valeurs');
    if (!view) return;
    injectCss();
    var comps = companyList();
    view.innerHTML = ''
      + '<div class="page-header"><h1>Évènements sur <span style="color:var(--gold)">valeurs</span></h1>'
      + '<p>Dividendes, coupons, fractionnements, augmentations/réductions de capital, fusions, radiations — toutes sociétés BRVM, avec l\'avis officiel téléchargeable.</p></div>'
      + '<div class="doc-form">'
      + '<div class="doc-field"><label for="esvTicker">Société</label><select id="esvTicker">'
      + '<option value="">Toutes les sociétés</option>'
      + comps.map(function (c) { return '<option value="' + esc(c.t) + '"' + (c.t === ticker ? ' selected' : '') + '>' + esc(c.t) + (c.n ? ' — ' + esc(c.n) : '') + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="doc-field"><label for="esvCat">Catégorie</label><select id="esvCat">'
      + '<option value="">Toutes catégories</option>'
      + CATEGORIES.map(function (c) { return '<option value="' + c.value + '"' + (c.value === categorie ? ' selected' : '') + '>' + esc(c.label) + '</option>'; }).join('')
      + '</select></div>'
      + '<label class="doc-checkbox"><input type="checkbox" id="esvUpcoming"' + (onlyUpcoming ? ' checked' : '') + '> À venir uniquement</label>'
      + '</div>'
      + '<div class="doc-list" id="esvBody"><div class="doc-empty">Chargement…</div></div>';

    g('esvTicker').addEventListener('change', function () { ticker = this.value.toUpperCase(); load(); });
    g('esvCat').addEventListener('change', function () { categorie = this.value; load(); });
    g('esvUpcoming').addEventListener('change', function () { onlyUpcoming = this.checked; load(); });
    load();
  }

  window.renderEvenementsValeurs = render;
})();
