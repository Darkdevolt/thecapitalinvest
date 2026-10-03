// ============================================================================
// OBLIGATIONS BRVM
// Marché obligataire : rendement actuariel exact (brut et net), duration,
// courbe des taux (Nelson-Siegel et spline cubique), et par ligne l'échéancier
// réel (différé, amortissement constant 1/N ou in fine, périodicité) tiré de la
// fiche technique DC/BR. Calculs : obligations-math.js (window.OBMath).
// Source prioritaire : le dernier BOC (capital restant dû, périodicité, prochain
// coupon, type d'amortissement). Aucune donnée inventée : un mode absent du BOC
// et de la fiche est déduit du cours et signalé « hypothèse ».
// ============================================================================
(function () {
  'use strict';
  if (window.__TC_OBLIGATIONS_V2__) return;
  window.__TC_OBLIGATIONS_V2__ = true;

  var LIST = null, MARCHE = null, CARAC = null, BOC = null, ROWS = null;
  var loading = false;
  var SEL = null;
  var SORT = { key: 'life', dir: 1 };
  var SEG = 'tous';          // tous | etat | regional | corporate
  var CURVE_SEG = 'etat';
  var CURVE_X = 'life';      // life (maturité) | duration
  var QTY = 1;               // nombre de titres pour l'échéancier
  var QUERY = '';
  var chartCurve = null, chartFlux = null;

  function M() { return window.OBMath; }
  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function num(v) { if (v == null || v === '') return null; var n = Number(v); return isFinite(n) ? n : null; }
  function nf(v, dec) { var n = Number(v); return v != null && isFinite(n) ? n.toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 0 : dec }) : '—'; }
  function pc(v, dec) { return v == null || !isFinite(v) ? '—' : nf(v, dec == null ? 2 : dec) + ' %'; }
  function g(id) { return document.getElementById(id); }
  function dLabel(s) { if (!s) return '—'; var d = typeof s === 'string' ? s.slice(0, 10) : M().iso(s); var p = d.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function key(s) { return String(s || '').toUpperCase().replace(/^TNC_/, '').trim(); }

  function segment(o) {
    var s = ((o.code || '') + ' ' + (o.nom || '')).toUpperCase();
    if (/BOAD|BIDC|EBID|CRRH|SHELTER|BRS\b/.test(s)) return 'regional';
    if (/^(TP|EO|FTP|FEO)|ETAT|TRESOR|TRÉSOR|SUKUK|APE\b/.test(s)) return 'etat';
    return 'corporate';
  }
  var SEG_LABEL = { tous: 'Toutes', etat: 'États (souverain)', regional: 'Institutions régionales', corporate: 'Entreprises' };

  // ---- données ----
  function load() {
    if (LIST) return Promise.resolve();
    if (typeof window.apiGet !== 'function') { LIST = []; CARAC = {}; BOC = {}; return Promise.resolve(); }
    return Promise.all([
      window.apiGet('/marche?type=obligations').catch(function () { return []; }),
      window.apiGet('/marche?type=obligations_marche&limit=5').catch(function () { return []; }),
      window.apiGet('/marche?type=obligations_caracteristiques&limit=1000').catch(function () { return []; }),
      window.apiGet('/marche?type=obligations_boc').catch(function () { return []; })
    ]).then(function (r) {
      var rows = Array.isArray(r[0]) ? r[0] : (r[0] && r[0].data) || [];
      var mar = Array.isArray(r[1]) ? r[1] : (r[1] && r[1].data) || [];
      var fiches = Array.isArray(r[2]) ? r[2] : (r[2] && r[2].data) || [];
      LIST = rows.filter(function (o) { return o && o.code; });
      MARCHE = mar[0] || null;
      /* Fiches DC/BR rapprochées par code obligation ou symbole (préfixe « TNC_ » retiré) ;
         la plus récemment publiée l'emporte. */
      CARAC = {};
      fiches.forEach(function (f) {
        var k = key(f && (f.code_obligation || f.symbole));
        if (!k) return;
        var prev = CARAC[k];
        if (!prev || String(f.date_jouissance || '') > String(prev.date_jouissance || '')) CARAC[k] = f;
      });
      /* Dernier BOC : capital restant dû, périodicité, prochain coupon et type
         d'amortissement de chaque ligne cotée. Une ligne du BOC absente de la
         cote quotidienne est ajoutée à partir du BOC. */
      var bocRows = Array.isArray(r[3]) ? r[3] : (r[3] && r[3].data) || [];
      BOC = {};
      bocRows.forEach(function (b) { if (b && b.symbole) BOC[key(b.symbole)] = b; });
      var known = {};
      LIST.forEach(function (o) { known[key(o.code)] = 1; });
      bocRows.forEach(function (b) {
        if (!b || !b.symbole || known[key(b.symbole)]) return;
        LIST.push({ code: b.symbole, nom: b.titre, taux_facial: b.taux, cours: b.cours_jour || b.cours_reference,
          coupon_couru: b.coupon_couru, date_seance: b.date_seance, fromBoc: true });
      });
      ROWS = null;
    });
  }
  function settleDate() {
    return (MARCHE && MARCHE.date_seance) || (LIST && LIST[0] && LIST[0].date_seance) || new Date().toISOString().slice(0, 10);
  }
  function ficheOf(o) { return (CARAC && CARAC[key(o.code)]) || null; }
  function bocOf(o) { return (BOC && BOC[key(o.code)]) || null; }
  function analyzed() {
    if (ROWS) return ROWS;
    var settle = settleDate();
    ROWS = (LIST || []).map(function (o) {
      var a = null;
      try { a = M().analyze(o, ficheOf(o), settle, null, bocOf(o)); } catch (e) { a = null; }
      return { o: o, a: a, seg: segment(o), f: ficheOf(o), b: bocOf(o) };
    });
    return ROWS;
  }

  // ---- styles ----
  function injectCss() {
    if (g('tc-obl-css')) return;
    var s = document.createElement('style');
    s.id = 'tc-obl-css';
    s.textContent = [
      '#view-obligations .ob-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:14px 0}',
      '#view-obligations .ob-kpi{background:var(--card,#181410);border:1px solid rgba(245,240,232,.09);border-radius:10px;padding:13px 15px}',
      '#view-obligations .ob-kpi .k{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim)}',
      '#view-obligations .ob-kpi .v{font-family:var(--mono,monospace);font-size:18px;margin-top:5px;font-variant-numeric:tabular-nums}',
      '#view-obligations .ob-kpi .s{font-size:10.5px;color:var(--dim);margin-top:3px}',
      '#view-obligations .ob-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:4px 0 12px}',
      '#view-obligations .ob-chip{border:1px solid rgba(245,240,232,.16);background:transparent;color:var(--dim);border-radius:999px;padding:6px 12px;font:inherit;font-size:12px;cursor:pointer}',
      '#view-obligations .ob-chip.on{border-color:var(--gold);color:var(--gold);background:rgba(184,150,78,.1)}',
      '#view-obligations select,#view-obligations input{background:var(--surface,#13110C);border:1px solid rgba(245,240,232,.16);color:var(--cream,#F5F0E8);border-radius:8px;padding:7px 10px;font:inherit;font-size:13px}',
      '#view-obligations .ob-card{background:var(--card,#181410);border:1px solid rgba(245,240,232,.09);border-radius:12px;padding:16px;margin-bottom:16px}',
      '#view-obligations .ob-h{margin-bottom:10px;text-transform:uppercase;letter-spacing:.1em;font-size:9.5px;color:var(--gold);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}',
      '#view-obligations .ob-chart{height:320px}',
      '#view-obligations .ob-grid2{display:grid;grid-template-columns:2fr 1fr;gap:16px}',
      '@media(max-width:900px){#view-obligations .ob-grid2{grid-template-columns:1fr}}',
      '#view-obligations table{width:100%;border-collapse:collapse;font-size:13px}',
      '#view-obligations th,#view-obligations td{padding:8px 10px;border-bottom:1px solid rgba(245,240,232,.08);text-align:left;white-space:nowrap}',
      '#view-obligations td.r,#view-obligations th.r{text-align:right;font-variant-numeric:tabular-nums}',
      '#view-obligations thead th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim)}',
      '#view-obligations thead th[data-k]{cursor:pointer}',
      '#view-obligations .ob-list tbody tr{cursor:pointer}#view-obligations .ob-list tbody tr:hover td{background:rgba(245,240,232,.04)}',
      '#view-obligations tr.paid td{color:var(--dim)}',
      '#view-obligations tr.next td{background:rgba(184,150,78,.08)}',
      '#view-obligations .ob-code{font-family:var(--mono,monospace);font-weight:700;color:var(--gold)}',
      '#view-obligations .ob-nom{font-size:11px;color:var(--dim);max-width:260px;overflow:hidden;text-overflow:ellipsis}',
      '#view-obligations .ob-tag{display:inline-block;font-size:9.5px;letter-spacing:.04em;padding:2px 7px;border-radius:999px;border:1px solid rgba(245,240,232,.18);color:var(--dim)}',
      '#view-obligations .ob-tag.fiche{border-color:rgba(74,222,128,.4);color:#4ADE80}',
      '#view-obligations .ob-tag.hyp{border-color:rgba(251,191,36,.4);color:#FBBF24}',
      '#view-obligations .ob-ns{color:var(--dim);border-bottom:1px dotted var(--dim);cursor:help}',
      '#view-obligations .ob-note{font-size:11.5px;line-height:1.6;color:var(--muted,rgba(245,240,232,.6))}',
      '#view-obligations .ob-warn{font-size:12px;line-height:1.5;color:#FBBF24;border:1px solid rgba(251,191,36,.3);background:rgba(251,191,36,.06);border-radius:8px;padding:9px 12px;margin-bottom:12px}',
      '#view-obligations .ob-back,#view-obligations .ob-btn{background:transparent;border:1px solid rgba(245,240,232,.2);color:var(--cream);border-radius:7px;padding:6px 12px;font:inherit;font-size:12px;cursor:pointer}',
      '#view-obligations .ob-back{margin-bottom:12px}',
      '#view-obligations .ob-sim{display:grid;grid-template-columns:1fr 1fr;gap:14px}',
      '@media(max-width:700px){#view-obligations .ob-sim{grid-template-columns:1fr}}',
      '#view-obligations .ob-sim label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-bottom:5px}',
      '#view-obligations .ob-sim .out{font-family:var(--mono,monospace);font-size:17px;margin-top:8px;color:var(--gold)}',
      '#view-obligations .ob-empty{padding:26px;text-align:center;color:var(--dim)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function kpi(k, v, sub, cls) { return '<div class="ob-kpi"><div class="k">' + esc(k) + '</div><div class="v ' + (cls || '') + '">' + v + '</div>' + (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>'; }
  function ytmCell(a, net) {
    if (!a) return '—';
    if (a.matured) return '<span class="ob-ns" title="Échéance passée">échue</span>';
    var v = net ? a.ytmNet : a.ytm;
    if (v != null) return (net ? '' : '<b>') + pc(v) + (net ? '' : '</b>');
    if (net && a.ytm != null) return '<span class="ob-ns" title="Taux net non publié dans la fiche">—</span>';
    return '<span class="ob-ns" title="' + esc(a.priceIssue || 'Cours indisponible') + '">n.s.</span>';
  }
  function modeTag(r) {
    if (!r.a || !r.a.schedule) return '—';
    var sc = r.a.schedule;
    var cls = sc.source === 'hypothese' || (sc.mode && sc.mode.deferGuess) ? 'hyp' : 'fiche';
    var lbl = sc.source === 'boc' ? 'BOC · ' + sc.mode.boc : sc.source === 'fiche' ? 'fiche' : 'hypothèse';
    return '<span class="ob-tag ' + cls + '" title="' + esc(sc.mode && sc.mode.label || '') + '">' + esc(lbl) + '</span>';
  }

  // ---- courbe des taux ----
  function curvePoints() {
    return analyzed().filter(function (r) {
      return r.a && r.a.ytm != null && r.a.ytm >= 1 && r.a.ytm <= 15 && r.a.life >= 0.25 && (CURVE_SEG === 'tous' || r.seg === CURVE_SEG);
    }).map(function (r) { return { x: CURVE_X === 'duration' ? r.a.duration : r.a.life, y: r.a.ytm, code: r.o.code, nom: r.o.nom }; })
      .filter(function (p) { return p.x > 0; });
  }
  function drawCurve() {
    var cv = g('obCurve');
    if (!cv || typeof Chart === 'undefined') return;
    if (chartCurve) { try { chartCurve.destroy(); } catch (e) {} chartCurve = null; }
    var pts = curvePoints();
    var tbl = g('obTenors');
    if (pts.length < 4) {
      cv.parentElement.innerHTML = '<div class="ob-empty">Pas assez de lignes avec un rendement significatif pour tracer la courbe de ce segment (' + pts.length + ').</div>';
      if (tbl) tbl.innerHTML = '';
      return;
    }
    var ns = M().nelsonSiegel(pts), sp = M().splineCurve(pts, 1);
    var xmax = Math.min(20, Math.max.apply(null, pts.map(function (p) { return p.x; })));
    var line = function (f) { var out = []; for (var x = 0.25; x <= xmax + 1e-9; x += 0.25) out.push({ x: +x.toFixed(2), y: f(x) }); return out; };
    var ds = [{ label: 'Rendements observés', data: pts, backgroundColor: 'rgba(245,240,232,.55)', pointRadius: 4, pointHoverRadius: 6 }];
    if (ns) ds.push({ label: 'Nelson-Siegel', type: 'line', data: line(ns.at), borderColor: '#B8964E', borderWidth: 2.2, pointRadius: 0, fill: false, tension: 0 });
    if (sp) ds.push({ label: 'Spline cubique', type: 'line', data: line(sp.at), borderColor: '#60A5FA', borderWidth: 1.8, borderDash: [6, 4], pointRadius: 0, fill: false, tension: 0 });
    chartCurve = new Chart(cv, {
      type: 'scatter',
      data: { datasets: ds },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: {
          legend: { labels: { color: 'rgba(245,240,232,.7)', font: { size: 11 } } },
          tooltip: { callbacks: { label: function (c) { return c.raw.code ? c.raw.code + ' · ' + nf(c.raw.x, 1) + ' an(s) · ' + nf(c.raw.y, 2) + ' %' : c.dataset.label + ' · ' + nf(c.raw.x, 2) + ' an(s) · ' + nf(c.raw.y, 2) + ' %'; } } }
        },
        scales: {
          x: { type: 'linear', min: 0, title: { display: true, text: CURVE_X === 'duration' ? 'Duration (années)' : 'Durée restante jusqu\'à l\'échéance (années)', color: 'rgba(245,240,232,.5)' }, ticks: { color: 'rgba(245,240,232,.4)' }, grid: { color: 'rgba(245,240,232,.06)' } },
          y: { title: { display: true, text: 'Rendement actuariel brut (%)', color: 'rgba(245,240,232,.5)' }, ticks: { color: 'rgba(245,240,232,.4)', callback: function (v) { return v + ' %'; } }, grid: { color: 'rgba(245,240,232,.06)' } }
        }
      }
    });
    if (tbl) {
      var tenors = [1, 2, 3, 5, 7, 10].filter(function (t) { return t <= xmax + 0.5; });
      tbl.innerHTML = '<table><thead><tr><th>Maturité</th><th class="r">Nelson-Siegel</th><th class="r">Spline</th></tr></thead><tbody>'
        + tenors.map(function (t) { return '<tr><td>' + t + ' an' + (t > 1 ? 's' : '') + '</td><td class="r">' + (ns ? pc(ns.at(t)) : '—') + '</td><td class="r">' + (sp ? pc(sp.at(t)) : '—') + '</td></tr>'; }).join('')
        + '</tbody></table><p class="ob-note" style="margin-top:8px">' + pts.length + ' lignes retenues' + (ns ? ' · écart moyen au modèle ' + nf(ns.rmse, 2) + ' pt' : '') + '.</p>';
    }
  }

  // ---- liste ----
  var COLS = [
    { k: 'code', l: 'Obligation', v: function (r) { return '<span class="ob-code">' + esc(r.o.code) + '</span><div class="ob-nom" title="' + esc(r.o.nom || '') + '">' + esc(r.o.nom || '') + '</div>'; } },
    { k: 'taux', l: 'Taux', cls: 'r', v: function (r) { return pc(num(r.o.taux_facial)); } },
    { k: 'maturite', l: 'Échéance', cls: 'r', v: function (r) { return r.a && r.a.schedule ? dLabel(r.a.schedule.maturity) : dLabel(r.o.date_maturite); } },
    { k: 'crd', l: 'Capital restant', cls: 'r', v: function (r) { return r.a ? nf(r.a.crd) : '—'; } },
    { k: 'cours', l: 'Cours', cls: 'r', v: function (r) { return num(r.o.cours) ? nf(r.o.cours) + (r.a && r.a.pricePct != null ? '<div class="ob-nom" style="text-align:right">' + nf(r.a.pricePct, 1) + ' % du CRD</div>' : '') : '—'; } },
    { k: 'ytm', l: 'Rdt actuariel brut', cls: 'r', v: function (r) { return ytmCell(r.a, false); } },
    { k: 'ytmNet', l: 'Rdt net', cls: 'r', v: function (r) { return ytmCell(r.a, true); } },
    { k: 'duration', l: 'Duration', cls: 'r', v: function (r) { return r.a && r.a.duration != null ? nf(r.a.duration, 2) : '—'; } },
    { k: 'mode', l: 'Échéancier', v: modeTag }
  ];
  function sortVal(r, k) {
    if (k === 'code') return r.o.code || '';
    if (k === 'maturite') return r.a && r.a.schedule ? +r.a.schedule.maturity : Infinity;
    if (k === 'taux') return num(r.o.taux_facial);
    if (k === 'cours') return num(r.o.cours);
    if (k === 'mode') return r.a && r.a.schedule ? r.a.schedule.source : '';
    return r.a ? r.a[k === 'life' ? 'life' : k] : null;
  }
  function sortRows(rows) {
    var k = SORT.key, d = SORT.dir;
    return rows.slice().sort(function (a, b) {
      var va = sortVal(a, k), vb = sortVal(b, k);
      if (typeof va === 'string' || typeof vb === 'string') return String(va || '').localeCompare(String(vb || '')) * d;
      va = va == null ? Infinity : va; vb = vb == null ? Infinity : vb;
      return (va - vb) * d;
    });
  }

  function renderList() {
    var view = g('view-obligations');
    injectCss();
    var all = analyzed();
    var live = all.filter(function (r) { return r.a && !r.a.matured; });
    var withY = live.filter(function (r) { return r.a.ytm != null; });
    var med = function (a) { if (!a.length) return null; a = a.slice().sort(function (x, y) { return x - y; }); var m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
    var q = QUERY.trim().toUpperCase();
    var rows = live.filter(function (r) {
      return (SEG === 'tous' || r.seg === SEG) && (!q || (r.o.code + ' ' + (r.o.nom || '') + ' ' + ((r.f && r.f.isin) || '')).toUpperCase().indexOf(q) >= 0);
    });
    var m = MARCHE || {};

    view.innerHTML = ''
      + '<div class="page-header"><h1>Obligations <span style="color:var(--gold)">BRVM</span></h1>'
      + '<p>Rendement actuariel exact, courbe des taux et échéancier réel de chaque ligne. Cliquez une obligation pour son tableau d\'amortissement.</p></div>'
      + '<div class="ob-kpis">'
      + kpi('Lignes en vie', nf(live.length), nf(withY.length) + ' avec un rendement significatif')
      + kpi('Rendement médian', pc(med(withY.map(function (r) { return r.a.ytm; }))), 'actuariel brut, toutes lignes')
      + kpi('Souverain médian', pc(med(withY.filter(function (r) { return r.seg === 'etat'; }).map(function (r) { return r.a.ytm; }))), 'emprunts d\'États UEMOA')
      + kpi('Capitalisation obligataire', num(m.capitalisation_obligations) != null ? nf(m.capitalisation_obligations / 1e9, 1) + ' Md' : '—', m.date_seance ? 'séance du ' + dLabel(m.date_seance) : '')
      + '</div>'

      + '<div class="ob-card"><div class="ob-h"><span>Courbe des taux</span><span class="ob-bar" style="margin:0">'
      + ['etat', 'regional', 'corporate', 'tous'].map(function (s) { return '<button type="button" class="ob-chip' + (CURVE_SEG === s ? ' on' : '') + '" data-cseg="' + s + '">' + SEG_LABEL[s] + '</button>'; }).join('')
      + '<select id="obCurveX" title="Axe horizontal"><option value="life"' + (CURVE_X === 'life' ? ' selected' : '') + '>Axe : durée restante</option><option value="duration"' + (CURVE_X === 'duration' ? ' selected' : '') + '>Axe : duration</option></select>'
      + '</span></div>'
      + '<div class="ob-grid2"><div class="ob-chart"><canvas id="obCurve"></canvas></div><div id="obTenors"></div></div>'
      + '<p class="ob-note" style="margin-top:10px">Chaque point est une ligne cotée (rendement actuariel brut au cours du jour). <b>Nelson-Siegel</b> : courbe lissée à 4 paramètres, standard des banques centrales. <b>Spline cubique</b> : courbe passant par la médiane de chaque tranche d\'un an. Sont exclues les lignes au rendement non significatif (cours ancien) et celles à moins de 3 mois de l\'échéance.</p></div>'

      + '<div class="ob-bar">'
      + ['tous', 'etat', 'regional', 'corporate'].map(function (s) { return '<button type="button" class="ob-chip' + (SEG === s ? ' on' : '') + '" data-seg="' + s + '">' + SEG_LABEL[s] + '</button>'; }).join('')
      + '<input type="search" id="obQ" placeholder="Rechercher un code, un émetteur, un ISIN…" value="' + esc(QUERY) + '" style="min-width:240px;flex:1">'
      + '</div>'
      + (rows.length
        ? '<div class="ob-card ob-list" style="overflow-x:auto"><table><thead><tr>'
          + COLS.map(function (c) { return '<th class="' + (c.cls || '') + '" data-k="' + c.k + '">' + esc(c.l) + (SORT.key === c.k ? (SORT.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; }).join('')
          + '</tr></thead><tbody>'
          + sortRows(rows).map(function (r) { return '<tr data-code="' + esc(r.o.code) + '">' + COLS.map(function (c) { return '<td class="' + (c.cls || '') + '">' + c.v(r) + '</td>'; }).join('') + '</tr>'; }).join('')
          + '</tbody></table></div>'
        : '<div class="ob-empty">' + (LIST && LIST.length ? 'Aucune ligne ne correspond à ce filtre.' : 'Données obligataires momentanément indisponibles. Réessayez dans quelques instants.') + '</div>')
      + '<p class="ob-note"><b>Rendement actuariel</b> : taux qui égalise le prix payé (cours + coupon couru) et les flux futurs (coupons et remboursements), date à date, base exact/365. <b>Net</b> : coupons nets d\'impôt (montant net publié au BOC, sinon taux net de la fiche). '
      + '<b>Échéancier</b> : <span class="ob-tag fiche">BOC</span> capital restant, périodicité, prochain coupon et type d\'amortissement (IF in fine, AC constant, AD dégressif, ACD constant après différé) lus dans le Bulletin Officiel de la Cote ; <span class="ob-tag fiche">fiche</span> mode de remboursement lu dans la fiche technique DC/BR ; <span class="ob-tag hyp">hypothèse</span> mode déduit du capital restant cohérent avec le cours. '
      + '« n.s. » : cours coté manifestement ancien, rendement non significatif (survolez pour le détail). Ceci n\'est pas un conseil d\'investissement.</p>';

    view.querySelectorAll('[data-cseg]').forEach(function (b) { b.addEventListener('click', function () { CURVE_SEG = b.getAttribute('data-cseg'); renderList(); }); });
    view.querySelectorAll('[data-seg]').forEach(function (b) { b.addEventListener('click', function () { SEG = b.getAttribute('data-seg'); renderList(); }); });
    if (g('obCurveX')) g('obCurveX').addEventListener('change', function () { CURVE_X = this.value; renderList(); });
    if (g('obQ')) g('obQ').addEventListener('input', function () { var v = this.value, pos = this.selectionStart; QUERY = v; renderList(); var i = g('obQ'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) {} } });
    view.querySelectorAll('thead th[data-k]').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-k');
        if (SORT.key === k) SORT.dir = -SORT.dir; else { SORT.key = k; SORT.dir = (k === 'code' || k === 'maturite' || k === 'mode') ? 1 : -1; }
        renderList();
      });
    });
    view.querySelectorAll('.ob-list tbody tr[data-code]').forEach(function (tr) { tr.addEventListener('click', function () { SEL = tr.getAttribute('data-code'); render(); window.scrollTo(0, 0); }); });
    drawCurve();
  }

  // ---- détail ----
  function renderDetail() {
    var view = g('view-obligations');
    injectCss();
    var r = analyzed().find(function (x) { return x.o.code === SEL; });
    if (!r) { SEL = null; return renderList(); }
    var o = r.o, a = r.a, f = r.f, b = r.b;
    if (!a || !a.schedule) {
      view.innerHTML = '<button type="button" class="ob-back" id="obBack">← Toutes les obligations</button><div class="ob-card ob-note">Échéancier impossible : taux facial ou dates manquants pour ' + esc(o.code) + '.</div>';
      g('obBack').addEventListener('click', function () { SEL = null; render(); });
      return;
    }
    var sc = a.schedule, settle = M().toDate(a.settle);
    var freqL = { 1: 'annuelle', 2: 'semestrielle', 4: 'trimestrielle', 12: 'mensuelle' }[sc.freq] || sc.freq + '/an';
    var next = a.next;
    var carac = [
      ['Code', o.code], ['Émetteur', o.nom || '—'],
      ['ISIN', f && f.isin ? f.isin : '—'],
      ['Catégorie', SEG_LABEL[r.seg]],
      ['Taux facial brut / net', pc(sc.rate) + (sc.rateNet != null ? ' / ' + pc(sc.rateNet) : '')],
      ['Valeur nominale', nf(sc.vn) + ' FCFA'],
      ['Jouissance', dLabel(sc.start)], ['Échéance', dLabel(sc.maturity)],
      ['Périodicité des coupons', freqL],
      ['Mode de remboursement', (sc.mode && sc.mode.label) || '—'],
      ['Source de l\'échéancier', sc.source === 'boc' ? 'Bulletin Officiel de la Cote du ' + dLabel(sc.bocDate) + (f ? ' + fiche technique DC/BR' : '') : sc.source === 'fiche' ? 'Fiche technique DC/BR' : 'Hypothèse déduite du cours'],
      ['Dernier paiement publié', o.dernier_paiement_date ? dLabel(o.dernier_paiement_date) + (num(o.dernier_paiement_valeur) != null ? ' · ' + nf(o.dernier_paiement_valeur, 2) + ' FCFA' : '') : '—']
    ];
    if (b) {
      carac.push(['Capital restant dû publié (BOC)', nf(b.valeur_nominale, 2) + ' FCFA par titre']);
      if (b.coupon_net != null) carac.push(['Prochain coupon net publié', nf(b.coupon_net, 2) + ' FCFA' + (b.echeance_coupon ? ' le ' + dLabel(b.echeance_coupon) : '')]);
      carac.push(['Cours de référence (BOC)', b.cours_reference != null ? nf(b.cours_reference, 2) + ' FCFA' + (b.suspendu ? ' · cotation suspendue' : '') : '—']);
      if (sc.rateFromCoupon) carac.push(['Taux', 'Variable : taux courant déduit du prochain coupon publié']);
    }
    if (f && f.registraire) carac.push(['Registraire', f.registraire]);
    if (f && f.nombre_titres != null) carac.push(['Titres émis', nf(f.nombre_titres)]);

    var totals = { i: 0, in: 0, a: 0 };
    var body = sc.rows.map(function (row) {
      var paid = row.date <= settle, isNext = next && row.k === next.k;
      if (!paid) { totals.i += row.interet; totals.in += row.interetNet; totals.a += row.amort; }
      return '<tr class="' + (paid ? 'paid' : isNext ? 'next' : '') + '"><td>' + row.k + '</td><td>' + dLabel(row.date) + '</td><td>' + (paid ? 'payé' : isNext ? 'prochain' : 'à venir') + '</td>'
        + '<td class="r">' + nf(row.crd0 * QTY) + '</td><td class="r">' + nf(row.interet * QTY, QTY > 1 ? 0 : 2) + '</td><td class="r">' + nf(row.interetNet * QTY, QTY > 1 ? 0 : 2) + '</td>'
        + '<td class="r">' + nf(row.amort * QTY) + '</td><td class="r"><b>' + nf(row.flux * QTY, QTY > 1 ? 0 : 2) + '</b></td><td class="r">' + nf(Math.max(0, row.crd1) * QTY) + '</td></tr>';
    }).join('');

    view.innerHTML = ''
      + '<button type="button" class="ob-back" id="obBack">← Toutes les obligations</button>'
      + '<div class="page-header"><h1>' + esc(o.code) + ' <span style="color:var(--gold)">' + esc(o.nom || '') + '</span></h1></div>'
      + (a.priceIssue ? '<div class="ob-warn">' + esc(a.priceIssue) + '</div>' : '')
      + (a.priceBasis === 'nominal' ? '<div class="ob-warn">Le cours coté (' + nf(a.quoted) + ' FCFA) n\'a pas été ajusté des amortissements déjà remboursés : il est lu comme ' + nf(a.pricePct, 1) + ' % du capital restant (' + nf(a.crd) + ' FCFA).</div>' : '')
      + '<div class="ob-kpis">'
      + kpi('Rendement actuariel brut', a.matured ? 'échue' : pc(a.ytm), 'au cours du jour')
      + kpi('Rendement actuariel net', pc(a.ytmNet), sc.rateNet != null ? 'coupons nets d\'impôt' : 'taux net non publié')
      + kpi('Prix', a.pricePct != null ? nf(a.pricePct, 2) + ' %' : '—', 'du capital restant · cours ' + (num(o.cours) ? nf(o.cours) + ' F' : '—'))
      + kpi('Capital restant dû', nf(a.crd) + ' F', 'sur ' + nf(sc.vn) + ' F de nominal')
      + kpi('Coupon couru', a.accrued != null ? nf(a.accrued, 2) + ' F' : '—', a.accruedPublished != null ? 'publié : ' + nf(a.accruedPublished, 2) + ' F' : 'calculé')
      + kpi('Duration', a.duration != null ? nf(a.duration, 2) + ' ans' : '—', a.modDuration != null ? 'sensibilité ' + nf(a.modDuration, 2) + ' % par point de taux' : '')
      + kpi('Convexité', a.convexity != null ? nf(a.convexity, 2) : '—', a.dv01 != null ? nf(a.dv01, 2) + ' F par titre pour 0,01 %' : '')
      + kpi('Durée de vie moyenne', a.averageLife != null ? nf(a.averageLife, 2) + ' ans' : '—', 'échéance dans ' + nf(a.life, 2) + ' ans')
      + kpi('Prochain flux', next ? nf(next.flux, 2) + ' F' : '—', next ? dLabel(next.date) + (next.amort > 0 ? ' · dont ' + nf(next.amort) + ' F de capital' : ' · coupon') : '')
      + '</div>'

      + '<div class="ob-card"><div class="ob-h"><span>Simulateur d\'ordre · prix, frais et rendement</span><span class="ob-note" style="margin:0">Professional</span></div><div id="obOrdre"></div></div>'

      + '<div class="ob-card"><div class="ob-h"><span>Tableau d\'amortissement · ' + esc(freqL) + ' · ' + esc((sc.mode && sc.mode.label) || '') + '</span>'
      + '<span class="ob-bar" style="margin:0"><label for="obQty" style="font-size:10px;letter-spacing:.08em;color:var(--dim)">NOMBRE DE TITRES</label><input type="number" id="obQty" min="1" step="1" value="' + QTY + '" style="width:90px"><button type="button" class="ob-btn" id="obCsv">Export CSV</button></span></div>'
      + '<div class="ob-chart" style="height:240px"><canvas id="obFlux"></canvas></div>'
      + '<div style="overflow-x:auto;margin-top:12px"><table><thead><tr><th>N°</th><th>Date</th><th>Statut</th><th class="r">Capital début</th><th class="r">Intérêt brut</th><th class="r">Intérêt net</th><th class="r">Amortissement</th><th class="r">Flux total</th><th class="r">Capital fin</th></tr></thead><tbody>'
      + body
      + '<tr><td colspan="4"><b>Reste à percevoir</b></td><td class="r"><b>' + nf(totals.i * QTY) + '</b></td><td class="r"><b>' + nf(totals.in * QTY) + '</b></td><td class="r"><b>' + nf(totals.a * QTY) + '</b></td><td class="r"><b>' + nf((totals.i + totals.a) * QTY) + '</b></td><td></td></tr>'
      + '</tbody></table></div>'
      + '<p class="ob-note" style="margin-top:10px">Montants en FCFA pour ' + nf(QTY) + ' titre' + (QTY > 1 ? 's' : '') + '. Intérêts calculés sur le capital restant en début de période. '
      + (sc.source === 'boc' ? 'Capital restant dû, périodicité, date du prochain coupon et type d\'amortissement issus du Bulletin Officiel de la Cote de la BRVM' + (sc.mode.deferGuess ? ' ; la durée du différé n\'y figure pas et suit l\'usage des émissions UEMOA (à confirmer dans la note d\'information).' : '.') : sc.source === 'fiche' ? 'Mode de remboursement et périodicité issus de la fiche technique DC/BR.' : 'La fiche technique de cette ligne n\'est pas disponible : le mode de remboursement est une hypothèse déduite du cours ; se référer à la note d\'information.')
      + ' Hors frais et clauses particulières (remboursement anticipé…).</p></div>'

      + '<div class="ob-card"><div class="ob-h"><span>Caractéristiques</span></div><div style="overflow-x:auto"><table><tbody>'
      + carac.map(function (c) { return '<tr><td>' + esc(c[0]) + '</td><td class="r" style="white-space:normal">' + esc(c[1]) + '</td></tr>'; }).join('')
      + '</tbody></table></div></div>';

    g('obBack').addEventListener('click', function () { SEL = null; render(); });
    g('obQty').addEventListener('change', function () { QTY = Math.max(1, Math.round(num(this.value) || 1)); renderDetail(); });
    g('obCsv').addEventListener('click', function () { exportCsv(o, sc); });
    mountOrdre({ o: o, f: f, b: b, a: a });
    drawFlux(sc, settle);
  }

  /* Simulateur d'ordre (frais SGI, TAF, BRVM/DC-BR) : module chargé à la demande. */
  function mountOrdre(ctx) {
    var go = function () { if (window.TCOrdreObligataire && g('obOrdre')) window.TCOrdreObligataire.mount(g('obOrdre'), ctx); };
    if (window.TCOrdreObligataire) return go();
    var s = document.createElement('script');
    s.src = '/app/js/views/obligations-ordre.js?v=20261003.3';
    s.onload = go;
    s.onerror = function () { var h = g('obOrdre'); if (h) h.innerHTML = '<div class="ob-note">Simulateur indisponible : rechargez la page.</div>'; };
    document.head.appendChild(s);
  }

  function exportCsv(o, sc) {
    var lines = [['N', 'Date', 'Capital debut', 'Interet brut', 'Interet net', 'Amortissement', 'Flux total', 'Capital fin'].join(';')];
    sc.rows.forEach(function (r) {
      lines.push([r.k, M().iso(r.date), (r.crd0 * QTY).toFixed(2), (r.interet * QTY).toFixed(2), (r.interetNet * QTY).toFixed(2), (r.amort * QTY).toFixed(2), (r.flux * QTY).toFixed(2), (Math.max(0, r.crd1) * QTY).toFixed(2)].join(';'));
    });
    var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var aEl = document.createElement('a');
    aEl.href = URL.createObjectURL(blob);
    aEl.download = 'echeancier-' + o.code + '.csv';
    document.body.appendChild(aEl); aEl.click(); document.body.removeChild(aEl);
  }

  function drawFlux(sc, settle) {
    var cv = g('obFlux');
    if (!cv || typeof Chart === 'undefined') return;
    if (chartFlux) { try { chartFlux.destroy(); } catch (e) {} chartFlux = null; }
    chartFlux = new Chart(cv, {
      type: 'bar',
      data: {
        labels: sc.rows.map(function (r) { return dLabel(r.date).slice(3); }),
        datasets: [
          { label: 'Intérêt', data: sc.rows.map(function (r) { return Math.round(r.interet * QTY); }), backgroundColor: sc.rows.map(function (r) { return r.date <= settle ? 'rgba(184,150,78,.35)' : '#B8964E'; }) },
          { label: 'Amortissement', data: sc.rows.map(function (r) { return Math.round(r.amort * QTY); }), backgroundColor: sc.rows.map(function (r) { return r.date <= settle ? 'rgba(96,165,250,.35)' : '#60A5FA'; }) }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { labels: { color: 'rgba(245,240,232,.7)', font: { size: 11 } } } },
        scales: {
          x: { stacked: true, ticks: { color: 'rgba(245,240,232,.4)', maxTicksLimit: 14 }, grid: { display: false } },
          y: { stacked: true, ticks: { color: 'rgba(245,240,232,.4)', callback: function (v) { return nf(v); } }, grid: { color: 'rgba(245,240,232,.06)' } }
        }
      }
    });
  }

  function ensureMath() {
    if (window.OBMath) return Promise.resolve();
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = '/app/js/views/obligations-math.js?v=3';
      s.onload = resolve; s.onerror = resolve;
      document.head.appendChild(s);
    });
  }

  function render() {
    var view = g('view-obligations');
    if (!view) return;
    injectCss();
    if (loading) return;
    if (!LIST || !window.OBMath) {
      view.innerHTML = '<div class="page-header"><h1>Obligations <span style="color:var(--gold)">BRVM</span></h1></div><div class="ob-empty">Chargement du marché obligataire…</div>';
      loading = true;
      Promise.all([ensureMath(), load()]).then(function () { loading = false; render(); });
      return;
    }
    if (SEL) renderDetail(); else renderList();
  }

  window.renderObligations = render;
})();
