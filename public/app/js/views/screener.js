// ============================================================================
// SCREENER + RANKING BRVM v2  (P1 roadmap)
// Filtres combinables (marché + valorisation + qualité + dividende + croissance),
// presets, colonnes triables (= ranking), export CSV, permalien de filtre.
// Sources : allCours · allFinancials · allEntreprises. Valeur absente = « — ».
// ============================================================================
(function () {
  'use strict';

  var SORT = { key: 'ticker', dir: 1 };
  var CRIT = {};

  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }
  function nf(v, dec) { var n = Number(v); return isFinite(n) ? n.toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 0 : dec }) : '—'; }
  function pf(v, dec) { var n = Number(v); return isFinite(n) ? (n > 0 ? '+' : '') + n.toFixed(dec == null ? 1 : dec) + ' %' : '—'; }
  function money(v) {
    var n = Number(v); if (!isFinite(n)) return '—';
    var a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' Md';
    if (a >= 1e6) return (n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M';
    return nf(n);
  }

  function latestFin(ticker) {
    return (Array.isArray(window.allFinancials) ? window.allFinancials : [])
      .filter(function (f) { return f && String(f.ticker).toUpperCase() === ticker; })
      .sort(function (a, b) { return Number(b.annee || 0) - Number(a.annee || 0); })[0] || null;
  }
  function caGrowth(ticker) {
    var rows = (Array.isArray(window.allFinancials) ? window.allFinancials : [])
      .filter(function (f) { return f && String(f.ticker).toUpperCase() === ticker; })
      .sort(function (a, b) { return Number(b.annee || 0) - Number(a.annee || 0); });
    if (rows.length < 2) return null;
    var a = Number(rows[0].chiffre_affaires), b = Number(rows[1].chiffre_affaires);
    return isFinite(a) && isFinite(b) && b !== 0 ? (a / b - 1) * 100 : null;
  }

  // Un enregistrement par titre, tous indicateurs calculés une fois.
  function buildRows() {
    var secMedCache = {};
    var coursByT = {};
    (Array.isArray(window.allCours) ? window.allCours : []).forEach(function (c) {
      if (!c || !c.ticker) return;
      var t = String(c.ticker).toUpperCase();
      if (!coursByT[t]) coursByT[t] = c;
    });
    var ent = (window.entMap && typeof window.entMap === 'object') ? window.entMap : {};
    return Object.keys(coursByT).map(function (t) {
      var c = coursByT[t];
      var e = ent[t] || {};
      var f = latestFin(t);
      var cp = num(c.cloture != null ? c.cloture : c.cours);
      var bpa = f ? num(f.bpa) : null, dpa = f ? num(f.dpa) : null;
      var fp = f ? num(f.fonds_propres != null ? f.fonds_propres : f.capitaux_propres) : null;
      var na = (f && num(f.nombre_actions)) || num(e.nombre_actions) || num(e.nb_actions);
      var roe = f ? num(f.roe) : null; if (roe != null && roe <= 1.5) roe *= 100;
      if (roe == null && f && num(f.resultat_net) != null && fp) roe = (f.resultat_net / fp) * 100;
      var marge = f ? num(f.marge_nette) : null; if (marge != null && marge <= 1.5) marge *= 100;
      if (marge == null && f && num(f.resultat_net) != null && num(f.chiffre_affaires)) marge = (f.resultat_net / f.chiffre_affaires) * 100;
      var yld = f ? num(f.dividend_yield != null ? f.dividend_yield : f.rendement_dividende) : null;
      if (yld != null && yld <= 1.5) yld *= 100;
      if (yld == null && dpa != null && cp) yld = (dpa / cp) * 100;
      var dette = f ? num(f.dette_nette != null ? f.dette_nette : f.dettes_financieres) : null;
      var detteFp = (dette != null && fp) ? dette / fp : null;
      var secteur = e.secteur || (typeof getSector === 'function' ? getSector(t) : '') || '—';
      var per = (cp != null && bpa != null && bpa > 0) ? cp / bpa : null;
      var pbr = (cp != null && fp != null && na && na > 0 && fp > 0) ? cp / (fp / na) : null;
      var croissance = caGrowth(t);
      var score = null;
      if (typeof window.tcScoreFromMetrics === 'function') {
        if (!(secteur in secMedCache)) secMedCache[secteur] = (typeof window.tcSectorMedians === 'function') ? window.tcSectorMedians(secteur) : {};
        score = window.tcScoreFromMetrics({ per: per, pbr: pbr, roe: roe, marge: marge, rdt: yld, detteFp: detteFp, croissance: croissance }, secMedCache[secteur]).score;
      }
      return {
        ticker: t,
        nom: e.nom || e.nom_court || t,
        secteur: secteur,
        pays: e.pays || '',
        cours: cp,
        variation: num(c.variation_pct != null ? c.variation_pct : c.variation),
        volume: num(c.volume),
        capi: num(c.capitalisation) || (cp && na ? cp * na : null),
        per: per,
        pbr: pbr,
        roe: roe, marge: marge, rdt: yld, detteFp: detteFp,
        croissance: croissance,
        score: score,
        exercice: f ? f.annee : null
      };
    });
  }

  var COLS = [
    { k: 'ticker', l: 'Ticker', fmt: function (r) { return '<strong style="color:var(--gold)">' + esc(r.ticker) + '</strong>'; }, cls: '' },
    { k: 'nom', l: 'Société', fmt: function (r) { return esc(r.nom); }, cls: '' },
    { k: 'secteur', l: 'Secteur', fmt: function (r) { return '<span style="color:var(--muted);font-size:11px">' + esc(r.secteur) + '</span>'; }, cls: '' },
    { k: 'score', l: 'Score', fmt: function (r) { return r.score != null ? '<strong style="color:var(--gold-l)">' + r.score + '</strong>' : '—'; }, cls: 'right' },
    { k: 'cours', l: 'Cours', fmt: function (r) { return nf(r.cours); }, cls: 'right' },
    { k: 'variation', l: 'Var.', fmt: function (r) { return '<span style="color:' + (r.variation > 0 ? 'var(--green)' : r.variation < 0 ? 'var(--red)' : 'var(--dim)') + '">' + pf(r.variation, 2) + '</span>'; }, cls: 'right' },
    { k: 'volume', l: 'Volume', fmt: function (r) { return nf(r.volume); }, cls: 'right' },
    { k: 'capi', l: 'Capi.', fmt: function (r) { return money(r.capi); }, cls: 'right' },
    { k: 'per', l: 'PER', fmt: function (r) { return r.per != null ? r.per.toFixed(1) + 'x' : '—'; }, cls: 'right' },
    { k: 'pbr', l: 'P/B', fmt: function (r) { return r.pbr != null ? r.pbr.toFixed(2) + 'x' : '—'; }, cls: 'right' },
    { k: 'roe', l: 'ROE', fmt: function (r) { return r.roe != null ? r.roe.toFixed(1) + ' %' : '—'; }, cls: 'right' },
    { k: 'marge', l: 'Marge', fmt: function (r) { return r.marge != null ? r.marge.toFixed(1) + ' %' : '—'; }, cls: 'right' },
    { k: 'rdt', l: 'Rdt div.', fmt: function (r) { return r.rdt != null ? r.rdt.toFixed(2) + ' %' : '—'; }, cls: 'right' },
    { k: 'detteFp', l: 'Dette/FP', fmt: function (r) { return r.detteFp != null ? r.detteFp.toFixed(2) + 'x' : '—'; }, cls: 'right' },
    { k: 'croissance', l: 'Croiss. CA', fmt: function (r) { return r.croissance != null ? pf(r.croissance, 0) : '—'; }, cls: 'right' }
  ];

  // id filtre -> [label, comparateur]  (min = ≥, max = ≤)
  var FILTERS = [
    ['fMinPrice', 'Cours min', 'cours', 'min'], ['fMaxPrice', 'Cours max', 'cours', 'max'],
    ['fMinVar', 'Var. min %', 'variation', 'min'], ['fMaxVar', 'Var. max %', 'variation', 'max'],
    ['fMinVol', 'Volume min', 'volume', 'min'],
    ['fMinScore', 'Score min', 'score', 'min'],
    ['fMaxPer', 'PER max', 'per', 'max'], ['fMaxPbr', 'P/B max', 'pbr', 'max'],
    ['fMinRoe', 'ROE min %', 'roe', 'min'], ['fMinMarge', 'Marge min %', 'marge', 'min'],
    ['fMinRdt', 'Rdt div. min %', 'rdt', 'min'], ['fMaxDette', 'Dette/FP max', 'detteFp', 'max'],
    ['fMinCroiss', 'Croiss. CA min %', 'croissance', 'min']
  ];

  var PRESETS = {
    'Value': { fMaxPer: 12, fMaxPbr: 1.5 },
    'Dividende': { fMinRdt: 5 },
    'Qualité': { fMinRoe: 15, fMinMarge: 12 },
    'Momentum': { fMinVar: 0, fMinVol: 1000 },
    'Croissance': { fMinCroiss: 10 },
    'Score élevé': { fMinScore: 70 }
  };

  function sectorOptions() {
    var set = {};
    (Array.isArray(window.allEntreprises) ? window.allEntreprises : []).forEach(function (e) {
      if (e && e.secteur) set[e.secteur] = 1;
    });
    return '<option value="">Tous secteurs</option>' + Object.keys(set).sort().map(function (s) {
      return '<option value="' + esc(s) + '">' + esc(s) + '</option>';
    }).join('');
  }

  function readForm() {
    var c = {};
    var sec = document.getElementById('fSector'); if (sec && sec.value) c.secteur = sec.value;
    FILTERS.forEach(function (f) {
      var el = document.getElementById(f[0]);
      if (el && el.value !== '' && isFinite(Number(el.value))) c[f[0]] = Number(el.value);
    });
    return c;
  }
  function applyToForm(c) {
    var sec = document.getElementById('fSector'); if (sec) sec.value = c.secteur || '';
    FILTERS.forEach(function (f) { var el = document.getElementById(f[0]); if (el) el.value = (c[f[0]] != null ? c[f[0]] : ''); });
  }

  function filterRows(rows, c) {
    return rows.filter(function (r) {
      if (c.secteur && String(r.secteur) !== String(c.secteur)) return false;
      for (var i = 0; i < FILTERS.length; i++) {
        var id = FILTERS[i][0], field = FILTERS[i][2], mode = FILTERS[i][3];
        if (c[id] == null) continue;
        var v = r[field];
        if (v == null || !isFinite(v)) return false;
        if (mode === 'min' && v < c[id]) return false;
        if (mode === 'max' && v > c[id]) return false;
      }
      return true;
    });
  }

  function sortRows(rows) {
    var k = SORT.key, d = SORT.dir;
    return rows.slice().sort(function (a, b) {
      var va = a[k], vb = b[k];
      if (typeof va === 'string' || typeof vb === 'string') {
        return String(va || '').localeCompare(String(vb || '')) * d;
      }
      if (va == null) return 1; if (vb == null) return -1;
      return (va - vb) * d;
    });
  }

  function toHash(c) {
    var p = [];
    Object.keys(c).forEach(function (k) { p.push(k + '~' + c[k]); });
    p.push('sort~' + SORT.key + '.' + SORT.dir);
    return '#screener' + (p.length ? '=' + encodeURIComponent(p.join(';')) : '');
  }
  function fromHash() {
    var m = (location.hash || '').match(/^#screener=(.+)$/);
    if (!m) return {};
    var c = {};
    decodeURIComponent(m[1]).split(';').forEach(function (kv) {
      var i = kv.indexOf('~'); if (i < 0) return;
      var k = kv.slice(0, i), v = kv.slice(i + 1);
      if (k === 'sort') { var s = v.split('.'); SORT.key = s[0] || 'ticker'; SORT.dir = Number(s[1]) || 1; return; }
      if (k === 'secteur') c.secteur = v; else if (isFinite(Number(v))) c[k] = Number(v);
    });
    return c;
  }

  function csv(rows) {
    var head = COLS.map(function (col) { return col.l; }).join(';');
    var body = rows.map(function (r) {
      return COLS.map(function (col) {
        var v = r[col.k];
        return v == null ? '' : (typeof v === 'number' ? String(v).replace('.', ',') : String(v));
      }).join(';');
    }).join('\n');
    var blob = new Blob(['﻿' + head + '\n' + body], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'screener-brvm.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function injectCss() {
    if (document.getElementById('tc-screener-v2-css')) return;
    var s = document.createElement('style');
    s.id = 'tc-screener-v2-css';
    s.textContent = [
      '#view-screener{padding:24px clamp(14px,3vw,32px) 56px;max-width:1400px;margin-inline:auto}',
      '#view-screener .scr-presets{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}',
      '#view-screener .scr-preset{border:1px solid var(--border2);background:transparent;color:var(--muted);border-radius:999px;padding:5px 13px;font:600 10px var(--sans);text-transform:uppercase;letter-spacing:.06em;cursor:pointer}',
      '#view-screener .scr-preset:hover,#view-screener .scr-preset.on{color:var(--gold-l);border-color:var(--gold);background:var(--gold-bg)}',
      '#view-screener .scr-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px}',
      '#view-screener .scr-form label{display:block;font:600 8px var(--sans);letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin-bottom:4px}',
      '#view-screener .scr-form input,#view-screener .scr-form select{width:100%;box-sizing:border-box;background:var(--surface);border:1px solid var(--border2);border-radius:7px;color:var(--cream);padding:8px 10px;font:400 12px var(--sans);outline:none}',
      '#view-screener .scr-form input:focus,#view-screener .scr-form select:focus{border-color:var(--gold)}',
      '#view-screener .scr-bar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:16px 0 10px}',
      '#view-screener .scr-bar .cnt{font:500 12px var(--mono);color:var(--muted)}',
      '#view-screener .scr-bar button{border:1px solid var(--border2);background:transparent;color:var(--gold-l);border-radius:7px;padding:6px 12px;font:600 10px var(--sans);text-transform:uppercase;letter-spacing:.06em;cursor:pointer}',
      '#view-screener .scr-bar button:hover{border-color:var(--gold)}',
      '#view-screener .scr-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:12px}',
      '#view-screener table{width:100%;border-collapse:collapse;font-size:12px;min-width:920px}',
      '#view-screener thead th{position:sticky;top:0;background:var(--card);padding:10px 12px;text-align:right;font:600 8px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--border);cursor:pointer;white-space:nowrap}',
      '#view-screener thead th:first-child,#view-screener thead th:nth-child(2),#view-screener thead th:nth-child(3){text-align:left}',
      '#view-screener thead th.sorted{color:var(--gold-l)}',
      '#view-screener tbody td{padding:9px 12px;text-align:right;border-bottom:1px solid var(--border2);color:var(--cream);font-variant-numeric:tabular-nums;white-space:nowrap}',
      '#view-screener tbody td:first-child,#view-screener tbody td:nth-child(2),#view-screener tbody td:nth-child(3){text-align:left}',
      '#view-screener tbody tr{cursor:pointer}#view-screener tbody tr:hover td{background:rgba(184,150,78,.05)}',
      '#view-screener .scr-empty{padding:30px;text-align:center;color:var(--dim);font-size:13px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  var ALL = [];

  function renderTable() {
    var c = readForm();
    var rows = sortRows(filterRows(ALL, c));
    var cnt = document.getElementById('scrCount');
    if (cnt) cnt.textContent = rows.length + ' / ' + ALL.length + ' valeurs';
    var tb = document.getElementById('screenerTable');
    if (!tb) return;
    tb.innerHTML = rows.length
      ? rows.map(function (r) {
        return '<tr onclick="openFiche && openFiche(\'' + esc(r.ticker) + '\',\'screener\')">'
          + COLS.map(function (col) { return '<td class="' + col.cls + '">' + col.fmt(r) + '</td>'; }).join('') + '</tr>';
      }).join('')
      : '<tr><td colspan="' + COLS.length + '" class="scr-empty">Aucun titre ne correspond aux critères.</td></tr>';
    document.querySelectorAll('#view-screener thead th').forEach(function (th) {
      th.classList.toggle('sorted', th.dataset.k === SORT.key);
      var base = th.dataset.l || th.textContent.replace(/[ ▲▼]+$/, '');
      th.dataset.l = base;
      th.textContent = base + (th.dataset.k === SORT.key ? (SORT.dir > 0 ? ' ▲' : ' ▼') : '');
    });
    try { history.replaceState(null, '', toHash(c)); } catch (e) {}
  }
  window.runScreener = renderTable;

  function bind() {
    document.getElementById('fSector').addEventListener('change', renderTable);
    FILTERS.forEach(function (f) {
      var el = document.getElementById(f[0]);
      if (el) el.addEventListener('input', renderTable);
    });
    document.querySelectorAll('#view-screener thead th').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.dataset.k;
        if (SORT.key === k) SORT.dir = -SORT.dir; else { SORT.key = k; SORT.dir = (k === 'ticker' || k === 'nom' || k === 'secteur') ? 1 : -1; }
        renderTable();
      });
    });
    document.querySelectorAll('#view-screener .scr-preset').forEach(function (b) {
      b.addEventListener('click', function () {
        var name = b.dataset.p;
        var on = b.classList.toggle('on');
        document.querySelectorAll('#view-screener .scr-preset').forEach(function (x) { if (x !== b) x.classList.remove('on'); });
        var c = {};
        if (on && PRESETS[name]) c = Object.assign({}, PRESETS[name]);
        applyToForm(c);
        renderTable();
      });
    });
    document.getElementById('scrReset').addEventListener('click', function () {
      applyToForm({});
      document.querySelectorAll('#view-screener .scr-preset').forEach(function (x) { x.classList.remove('on'); });
      SORT = { key: 'ticker', dir: 1 };
      renderTable();
    });
    document.getElementById('scrExport').addEventListener('click', function () {
      csv(sortRows(filterRows(ALL, readForm())));
    });
  }

  window.renderScreener = function () {
    injectCss();
    var v = document.getElementById('view-screener');
    if (!v) return;
    var initial = fromHash();
    v.innerHTML =
      '<div class="page-header"><h1>Screener <span style="color:var(--gold)">&amp; Ranking BRVM</span></h1>'
      + '<p>Filtres combinables, colonnes triables (clic sur l\'en-tête = classement), export et permalien.</p></div>'
      + '<div class="scr-presets">'
      + Object.keys(PRESETS).map(function (n) { return '<button type="button" class="scr-preset" data-p="' + n + '">' + n + '</button>'; }).join('')
      + '</div>'
      + '<div class="scr-form"><div><label>Secteur</label><select id="fSector">' + sectorOptions() + '</select></div>'
      + FILTERS.map(function (f) { return '<div><label>' + f[1] + '</label><input type="number" step="0.1" id="' + f[0] + '" placeholder="—"></div>'; }).join('')
      + '</div>'
      + '<div class="scr-bar"><span class="cnt" id="scrCount">—</span>'
      + '<span><button type="button" id="scrReset">Réinitialiser</button> '
      + '<button type="button" id="scrExport">Export CSV</button></span></div>'
      + '<div class="scr-wrap"><table><thead><tr>'
      + COLS.map(function (col) { return '<th data-k="' + col.k + '" data-l="' + col.l + '">' + col.l + '</th>'; }).join('')
      + '</tr></thead><tbody id="screenerTable"></tbody></table></div>';

    ALL = buildRows();
    applyToForm(initial);
    bind();
    renderTable();
  };
})();
