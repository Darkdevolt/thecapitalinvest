// ═══════════════════════════════════════════════════════════════════════════
// VIEW — BOC (Bulletin Officiel de la Cote)
// Se monte lui-même dans #view-boc (l'ancien code écrivait dans des éléments
// #bocCount / #bocTable absents de app.html -> TypeError au rendu).
// Source : window.allBoc (via /api/boc). Table vide -> état vide honnête.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var FILTER = 'all';   // all | week | month
  var YEAR = '';
  var Q = '';

  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function d2(s) {
    if (!s) return '—';
    try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch (e) { return String(s).slice(0, 10); }
  }
  function rows() { return Array.isArray(window.allBoc) ? window.allBoc : []; }

  function apply(list) {
    var out = list.slice();
    if (Q) {
      var q = Q.toLowerCase();
      out = out.filter(function (r) {
        return String(r.date_seance || '').toLowerCase().indexOf(q) !== -1
          || String(r.numero_seance || '').indexOf(q) !== -1;
      });
    }
    if (YEAR) out = out.filter(function (r) { return String(r.annee || String(r.date_seance || '').slice(0, 4)) === YEAR; });
    if (FILTER === 'week' || FILTER === 'month') {
      var since = new Date();
      since.setDate(since.getDate() - (FILTER === 'week' ? 7 : 30));
      out = out.filter(function (r) { return r.date_seance && new Date(r.date_seance) >= since; });
    }
    out.sort(function (a, b) { return String(b.date_seance || '').localeCompare(String(a.date_seance || '')); });
    return out;
  }

  function render() {
    var view = document.getElementById('view-boc');
    if (!view) return;
    var all = rows();
    var years = {};
    all.forEach(function (r) { var y = String(r.annee || String(r.date_seance || '').slice(0, 4)); if (y && y !== 'null') years[y] = 1; });
    var yearOpts = '<option value="">Toutes les années</option>' + Object.keys(years).sort().reverse()
      .map(function (y) { return '<option value="' + esc(y) + '"' + (y === YEAR ? ' selected' : '') + '>' + esc(y) + '</option>'; }).join('');

    var list = apply(all);
    var body = list.length
      ? list.map(function (b) {
        var url = b.pdf_url || b.url || b.fichier_url || '';
        var num = b.numero_seance != null ? b.numero_seance : (b.numero || '');
        return '<tr>'
          + '<td><strong>' + d2(b.date_seance) + '</strong></td>'
          + '<td class="tc-boc-num">' + (num !== '' ? '#' + esc(num) : '—') + '</td>'
          + '<td class="right">' + (url
            ? '<a href="' + esc(url) + '" target="_blank" rel="noopener" class="tc-boc-link">Ouvrir le PDF ↗</a>'
            : '<span class="tc-boc-none">PDF indisponible</span>') + '</td>'
          + '</tr>';
      }).join('')
      : '<tr><td colspan="3" class="tc-boc-empty">Aucun bulletin officiel en base pour le moment. Les BOC sont déposés depuis l\'administration.</td></tr>';

    view.innerHTML = ''
      + '<div class="page-header"><h1>BOC <span style="color:var(--gold)">/ Bulletin Officiel de la Cote</span></h1>'
      + '<p>Archive des bulletins de séance de la BRVM. ' + all.length + ' bulletin(s) en base.</p></div>'
      + '<style>'
      + '#view-boc .tc-boc-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:14px}'
      + '#view-boc .tc-boc-bar input,#view-boc .tc-boc-bar select{background:var(--surface,#13110C);border:1px solid rgba(245,240,232,.16);color:var(--cream,#F5F0E8);border-radius:8px;padding:8px 10px;font:inherit}'
      + '#view-boc .tc-boc-chip{background:var(--surface,#13110C);border:1px solid rgba(245,240,232,.14);color:var(--muted,rgba(245,240,232,.6));border-radius:999px;padding:6px 12px;font-size:12px;cursor:pointer}'
      + '#view-boc .tc-boc-chip.on{background:var(--gold,#B8964E);color:#1a1408;border-color:var(--gold,#B8964E);font-weight:700}'
      + '#view-boc table{width:100%;border-collapse:collapse;font-size:13px}'
      + '#view-boc th,#view-boc td{padding:9px 12px;border-bottom:1px solid rgba(245,240,232,.08);text-align:left}'
      + '#view-boc td.right,#view-boc th.right{text-align:right}'
      + '#view-boc .tc-boc-num{font-family:var(--mono,monospace);color:var(--gold,#B8964E)}'
      + '#view-boc .tc-boc-link{color:var(--gold-l,#D4AF6A);text-decoration:none}'
      + '#view-boc .tc-boc-none,#view-boc .tc-boc-empty{color:var(--dim,rgba(245,240,232,.34))}'
      + '#view-boc .tc-boc-empty{text-align:center;padding:28px}'
      + '</style>'
      + '<div class="tc-boc-bar">'
      + '<input type="search" id="bocQ" placeholder="Rechercher (date, n° séance)…" value="' + esc(Q) + '" style="flex:1;min-width:180px">'
      + '<select id="bocYear">' + yearOpts + '</select>'
      + '<button type="button" class="tc-boc-chip' + (FILTER === 'all' ? ' on' : '') + '" data-f="all">Tout</button>'
      + '<button type="button" class="tc-boc-chip' + (FILTER === 'week' ? ' on' : '') + '" data-f="week">7 jours</button>'
      + '<button type="button" class="tc-boc-chip' + (FILTER === 'month' ? ' on' : '') + '" data-f="month">30 jours</button>'
      + '</div>'
      + '<div class="card" style="overflow-x:auto"><table><thead><tr><th>Séance</th><th>N°</th><th class="right">Document</th></tr></thead><tbody>'
      + body + '</tbody></table></div>';

    var q = document.getElementById('bocQ');
    if (q) q.addEventListener('input', function () { Q = this.value; render(); var f = document.getElementById('bocQ'); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } });
    var yr = document.getElementById('bocYear');
    if (yr) yr.addEventListener('change', function () { YEAR = this.value; render(); });
    view.querySelectorAll('[data-f]').forEach(function (b) {
      b.addEventListener('click', function () { FILTER = b.getAttribute('data-f'); render(); });
    });
  }

  window.renderBOC = render;
  window.renderBoc = render;
})();
