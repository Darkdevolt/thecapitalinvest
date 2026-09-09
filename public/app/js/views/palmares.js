// ============================================================================
// PALMARÈS BRVM  (P1 roadmap — parité RichBourse « palmarès hausses/baisses/
// volumes » par période). Trois classements — plus fortes hausses, plus fortes
// baisses, plus gros échanges — sur jour / semaine / mois / 3 mois / depuis le
// 1ᵉʳ janvier. Sources : allCours (séance) + historique (fenêtre paginée,
// partagée avec l'écran d'opportunités). Aucune performance inventée : une
// valeur sans historique suffisant est absente des classements de période.
// ============================================================================
(function () {
  'use strict';
  if (window.__TC_PALMARES_V1__) return;
  window.__TC_PALMARES_V1__ = true;

  var PERIOD = 'jour';
  var histIndex = null;
  var loading = false;

  var PERIODS = [
    { id: 'jour', label: 'Jour', sessions: 1 },
    { id: 'semaine', label: 'Semaine', sessions: 5 },
    { id: 'mois', label: '1 mois', sessions: 21 },
    { id: 'trim', label: '3 mois', sessions: 63 },
    { id: 'ytd', label: 'Depuis le 1ᵉʳ janvier', sessions: null }
  ];

  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }
  function ymd(v) { return v ? String(v).slice(0, 10) : ''; }
  function nf(v, dec) { var n = Number(v); return isFinite(n) ? n.toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 0 : dec }) : '—'; }
  function pct(v) { var n = Number(v); return isFinite(n) ? (n > 0 ? '+' : '') + nf(n, 2) + ' %' : '—'; }
  function g(id) { return document.getElementById(id); }
  function close(r) { return num(r && (r.cours_cloture != null ? r.cours_cloture : r.cloture != null ? r.cloture : r.cours_normal != null ? r.cours_normal : r.cours)); }
  function ent(t) { return (window.entMap && window.entMap[t]) || {}; }

  function buildIndexFrom(rows) {
    var idx = {};
    (rows || []).forEach(function (r) {
      var t = String(r && r.ticker || '').toUpperCase();
      if (!t) return;
      (idx[t] || (idx[t] = [])).push(r);
    });
    Object.keys(idx).forEach(function (t) {
      idx[t].sort(function (a, b) { return ymd(a.date_seance) < ymd(b.date_seance) ? -1 : 1; });
    });
    return idx;
  }
  function ensureHistory() {
    if (histIndex) return Promise.resolve(histIndex);
    if (Array.isArray(window.allCoursHistorique) && window.allCoursHistorique.length > 400) {
      histIndex = buildIndexFrom(window.allCoursHistorique);
      return Promise.resolve(histIndex);
    }
    if (typeof window.apiGet !== 'function') { histIndex = {}; return Promise.resolve(histIndex); }
    var since = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    var all = [];
    var page = function (offset) {
      return window.apiGet('/marche?type=historique&limit=1000&offset=' + offset + '&date_from=' + since, { cache: 'no-store' })
        .then(function (rows) {
          var arr = Array.isArray(rows) ? rows : (rows && rows.data) || [];
          all = all.concat(arr);
          if (arr.length === 1000 && offset < 8000) return page(offset + 1000);
          return all;
        });
    };
    return page(0).then(function (rows) {
      window.allCoursHistorique = rows;
      histIndex = buildIndexFrom(rows);
      return histIndex;
    }).catch(function () { histIndex = {}; return histIndex; });
  }

  // performance d'un titre sur la période courante
  function perfOf(t, snap) {
    var cp = close(snap);
    if (cp == null || !(cp > 0)) return null;
    if (PERIOD === 'jour') {
      var v = num(snap.variation_pct != null ? snap.variation_pct : snap.variation);
      return v == null ? null : { perf: v, ref: null };
    }
    var series = (histIndex && histIndex[t]) || [];
    if (series.length < 3) return null;
    var refRow = null;
    var p = PERIODS.find(function (x) { return x.id === PERIOD; });
    if (PERIOD === 'ytd') {
      var jan1 = new Date().getFullYear() + '-01-01';
      for (var i = 0; i < series.length; i++) { if (ymd(series[i].date_seance) >= jan1) { refRow = series[i]; break; } }
      if (!refRow) refRow = series[0];
    } else {
      var k = p.sessions;
      refRow = series[Math.max(0, series.length - 1 - k)];
    }
    var rp = close(refRow);
    if (rp == null || !(rp > 0)) return null;
    return { perf: (cp / rp - 1) * 100, ref: ymd(refRow.date_seance) };
  }

  function turnoverOf(snap) {
    var t = num(snap.valeur_totale != null ? snap.valeur_totale : snap.valeur_transigee);
    if (t != null && t > 0) return t;
    var v = num(snap.volume), c = close(snap);
    return (v != null && c != null) ? v * c : null;
  }

  function compute() {
    var snaps = (Array.isArray(window.allCours) ? window.allCours : []).filter(function (c) { return c && c.ticker; });
    var rows = snaps.map(function (s) {
      var t = String(s.ticker).toUpperCase();
      var e = ent(t);
      var pr = perfOf(t, s);
      return {
        ticker: t, nom: e.nom || e.nom_court || t,
        cours: close(s),
        perf: pr ? pr.perf : null,
        ref: pr ? pr.ref : null,
        turnover: turnoverOf(s),
        volume: num(s.volume)
      };
    });
    var withPerf = rows.filter(function (r) { return r.perf != null; });
    var hausses = withPerf.filter(function (r) { return r.perf > 0; }).sort(function (a, b) { return b.perf - a.perf; }).slice(0, 12);
    var baisses = withPerf.filter(function (r) { return r.perf < 0; }).sort(function (a, b) { return a.perf - b.perf; }).slice(0, 12);
    var volumes = rows.filter(function (r) { return r.turnover != null && r.turnover > 0; }).sort(function (a, b) { return b.turnover - a.turnover; }).slice(0, 12);
    return { hausses: hausses, baisses: baisses, volumes: volumes, counted: withPerf.length, total: rows.length };
  }

  function injectCss() {
    if (g('tc-palmares-css')) return;
    var s = document.createElement('style');
    s.id = 'tc-palmares-css';
    s.textContent = [
      '#view-palmares .pm-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}',
      '#view-palmares .pm-tab{background:var(--surface);border:1px solid rgba(245,240,232,.14);color:var(--muted,rgba(245,240,232,.6));border-radius:8px;padding:7px 13px;font:inherit;font-size:13px;cursor:pointer}',
      '#view-palmares .pm-tab.active{background:var(--gold);color:#1a1408;border-color:var(--gold);font-weight:700}',
      '#view-palmares .pm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}',
      '#view-palmares .pm-col{background:var(--card);border:1px solid rgba(245,240,232,.09);border-radius:12px;overflow:hidden}',
      '#view-palmares .pm-col h3{margin:0;padding:12px 15px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid rgba(245,240,232,.08)}',
      '#view-palmares .pm-col.up h3{color:var(--green,#4ADE80)}',
      '#view-palmares .pm-col.down h3{color:var(--red,#F87171)}',
      '#view-palmares .pm-col.vol h3{color:var(--blue,#60A5FA)}',
      '#view-palmares table{width:100%;border-collapse:collapse;font-size:13px}',
      '#view-palmares td{padding:7px 12px;border-bottom:1px solid rgba(245,240,232,.06);cursor:pointer}',
      '#view-palmares tr:hover td{background:rgba(245,240,232,.04)}',
      '#view-palmares .pm-rk{color:var(--dim);width:24px;font-variant-numeric:tabular-nums}',
      '#view-palmares .pm-tk{font-family:var(--mono,monospace);font-weight:700}',
      '#view-palmares .pm-nom{font-size:10px;color:var(--dim)}',
      '#view-palmares .pm-val{text-align:right;font-variant-numeric:tabular-nums}',
      '#view-palmares .pos{color:var(--green,#4ADE80)}#view-palmares .neg{color:var(--red,#F87171)}',
      '#view-palmares .pm-note{font-size:12px;color:var(--muted,rgba(245,240,232,.6));margin-top:14px;line-height:1.6}',
      '#view-palmares .pm-empty{padding:26px;text-align:center;color:var(--dim)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function rowsHtml(list, kind) {
    if (!list.length) return '<tr><td class="pm-empty" colspan="3">—</td></tr>';
    return list.map(function (r, i) {
      var val = kind === 'vol'
        ? '<span>' + nf(r.turnover) + ' F</span>'
        : '<span class="' + (r.perf >= 0 ? 'pos' : 'neg') + '">' + pct(r.perf) + '</span>';
      return '<tr data-pm-ticker="' + esc(r.ticker) + '">'
        + '<td class="pm-rk">' + (i + 1) + '</td>'
        + '<td><span class="pm-tk">' + esc(r.ticker) + '</span><div class="pm-nom">' + esc(r.nom) + '</div></td>'
        + '<td class="pm-val">' + val + (kind !== 'vol' && r.cours != null ? '<div class="pm-nom">' + nf(r.cours) + ' F</div>' : '') + '</td>'
        + '</tr>';
    }).join('');
  }

  function draw() {
    var view = g('view-palmares');
    if (!view) return;
    var d = compute();
    var pdef = PERIODS.find(function (x) { return x.id === PERIOD; });

    view.innerHTML = ''
      + '<div class="page-header"><h1>Palmarès <span style="color:var(--gold)">BRVM</span></h1>'
      + '<p>Plus fortes hausses, plus fortes baisses et plus gros échanges de la cote. Cliquez une ligne pour ouvrir la fiche.</p></div>'
      + '<div class="pm-tabs">' + PERIODS.map(function (p) {
        return '<button type="button" class="pm-tab' + (p.id === PERIOD ? ' active' : '') + '" data-p="' + p.id + '">' + esc(p.label) + '</button>';
      }).join('') + '</div>'
      + (d.counted === 0 && PERIOD !== 'jour'
        ? '<div class="pm-empty">Historique insuffisant pour la période « ' + esc(pdef.label) +' ».</div>'
        : '<div class="pm-grid">'
          + '<div class="pm-col up"><h3>Hausses</h3><table><tbody>' + rowsHtml(d.hausses, 'up') + '</tbody></table></div>'
          + '<div class="pm-col down"><h3>Baisses</h3><table><tbody>' + rowsHtml(d.baisses, 'down') + '</tbody></table></div>'
          + '<div class="pm-col vol"><h3>Échanges du jour</h3><table><tbody>' + rowsHtml(d.volumes, 'vol') + '</tbody></table></div>'
          + '</div>')
      + '<p class="pm-note">Période « ' + esc(pdef.label) + ' » : '
      + (PERIOD === 'jour'
        ? 'variation de clôture de la dernière séance (source séance).'
        : 'performance entre la clôture actuelle et celle ' + (PERIOD === 'ytd' ? 'de la première séance de l\'année' : 'd\'il y a ' + pdef.sessions + ' séances') + '. ' + d.counted + ' valeur(s) sur ' + d.total + ' disposent d\'un historique suffisant.')
      + ' Les échanges sont toujours ceux de la dernière séance (valeur transigée, ou volume × cours à défaut). Hors fiscalité et frais.</p>';

    view.querySelectorAll('[data-p]').forEach(function (b) {
      b.addEventListener('click', function () { PERIOD = b.getAttribute('data-p'); draw(); });
    });
    view.querySelectorAll('[data-pm-ticker]').forEach(function (tr) {
      tr.addEventListener('click', function () {
        var t = tr.getAttribute('data-pm-ticker');
        if (typeof window.openFiche === 'function') window.openFiche(t, 'palmares');
        else location.hash = '#fiche=' + t;
      });
    });
  }

  function render() {
    var view = g('view-palmares');
    if (!view) return;
    injectCss();
    if (loading) return;
    if (!histIndex && PERIOD !== 'jour' || !histIndex) {
      // charge l'historique une fois ; le jour seul n'en a pas besoin mais
      // on précharge pour que le changement de période soit instantané.
      view.innerHTML = '<div class="page-header"><h1>Palmarès <span style="color:var(--gold)">BRVM</span></h1></div>'
        + '<div class="pm-empty">Constitution des classements…</div>';
      loading = true;
      ensureHistory().then(function () { loading = false; draw(); });
      return;
    }
    draw();
  }

  window.renderPalmares = render;
})();
