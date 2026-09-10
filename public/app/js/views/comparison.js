// ============================================================================
// COMPARAISON DE SOCIÉTÉS v2  (P1 roadmap) — 2 à 6 sociétés
// Tableau multi-indicateurs + radar normalisé + export CSV.
// Sources : allEntreprises · allCours · allFinancials. Absent = « — ».
// ============================================================================
(function () {
  'use strict';
  if (window.__TC_COMPARISON_V2__) return;
  window.__TC_COMPARISON_V2__ = true;

  var chart = null;
  var picks = [];

  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }
  function nf(v, dec) { var n = Number(v); return isFinite(n) ? n.toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 0 : dec }) : '—'; }
  function money(v) {
    var n = Number(v); if (!isFinite(n)) return '—';
    var a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' Md';
    if (a >= 1e6) return (n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M';
    return nf(n);
  }

  function ent(t) { return (window.entMap && window.entMap[t]) || {}; }
  function cours(t) { return (Array.isArray(window.allCours) ? window.allCours : []).find(function (c) { return c && String(c.ticker).toUpperCase() === t; }) || {}; }
  function fins(t) {
    return (Array.isArray(window.allFinancials) ? window.allFinancials : [])
      .filter(function (f) { return f && String(f.ticker).toUpperCase() === t; })
      .sort(function (a, b) { return Number(b.annee || 0) - Number(a.annee || 0); });
  }

  function snapshot(t) {
    var e = ent(t), c = cours(t), fs = fins(t), f = fs[0] || null, f1 = fs[1] || null;
    var cp = num(c.cloture != null ? c.cloture : c.cours);
    var bpa = f ? num(f.bpa) : null, dpa = f ? num(f.dpa) : null;
    var fp = f ? num(f.fonds_propres != null ? f.fonds_propres : f.capitaux_propres) : null;
    var na = (f && num(f.nombre_actions)) || num(e.nombre_actions) || num(e.nb_actions);
    var roe = f ? num(f.roe) : null; if (roe != null && roe <= 1.5) roe *= 100;
    if (roe == null && f && num(f.resultat_net) != null && fp) roe = f.resultat_net / fp * 100;
    var marge = f ? num(f.marge_nette) : null; if (marge != null && marge <= 1.5) marge *= 100;
    if (marge == null && f && num(f.resultat_net) != null && num(f.chiffre_affaires)) marge = f.resultat_net / f.chiffre_affaires * 100;
    var yld = f ? num(f.dividend_yield != null ? f.dividend_yield : f.rendement_dividende) : null;
    if (yld != null && yld <= 1.5) yld *= 100;
    if (yld == null && dpa != null && cp) yld = dpa / cp * 100;
    var dette = f ? num(f.dette_nette != null ? f.dette_nette : f.dettes_financieres) : null;
    var croiss = (f && f1 && num(f.chiffre_affaires) != null && num(f1.chiffre_affaires)) ? (f.chiffre_affaires / f1.chiffre_affaires - 1) * 100 : null;
    var score = null;
    try { if (typeof window.tcScoreMaison === 'function') score = window.tcScoreMaison(t).score; } catch (e) {}
    return {
      ticker: t, nom: e.nom || e.nom_court || t, secteur: e.secteur || '—',
      pays: e.pays || '—',
      cours: cp,
      variation: num(c.variation_pct != null ? c.variation_pct : c.variation),
      volume: num(c.volume),
      turnover: num(c.valeur_totale != null ? c.valeur_totale : c.valeur_transigee),
      capi: num(c.capitalisation) || (cp && na ? cp * na : null),
      per: (cp != null && bpa != null && bpa > 0) ? cp / bpa : null,
      pbr: (cp != null && fp != null && na && na > 0 && fp > 0) ? cp / (fp / na) : null,
      roe: roe, marge: marge, rdt: yld,
      detteFp: (dette != null && fp) ? dette / fp : null,
      croissance: croiss, score: score, exercice: f ? f.annee : null
    };
  }

  // Formatteurs par valeur (le catalogue partagé formate par ligne).
  var VF = {
    cours: function (v) { return nf(v); },
    variation: function (v) { return v != null ? (v > 0 ? '+' : '') + Number(v).toFixed(2) + ' %' : '—'; },
    volume: function (v) { return nf(v); },
    turnover: function (v) { return money(v) + ' F'; },
    capi: function (v) { return money(v); },
    per: function (v) { return v != null ? Number(v).toFixed(1) + 'x' : '—'; },
    pbr: function (v) { return v != null ? Number(v).toFixed(2) + 'x' : '—'; },
    rdt: function (v) { return v != null ? Number(v).toFixed(2) + ' %' : '—'; },
    roe: function (v) { return v != null ? Number(v).toFixed(1) + ' %' : '—'; },
    marge: function (v) { return v != null ? Number(v).toFixed(1) + ' %' : '—'; },
    croissance: function (v) { return v != null ? (v > 0 ? '+' : '') + Number(v).toFixed(0) + ' %' : '—'; },
    detteFp: function (v) { return v != null ? Number(v).toFixed(2) + 'x' : '—'; },
    score: function (v) { return v != null ? String(v) : '—'; }
  };
  var CMP_DEFAULT = ['cours', 'capi', 'score', 'per', 'pbr', 'roe', 'marge', 'rdt', 'detteFp', 'croissance'];
  function buildRows() {
    var mp = window.TC_METRICS;
    var keys = mp ? mp.getSelection('comparison', CMP_DEFAULT).filter(function (k) { return VF[k]; }) : CMP_DEFAULT;
    return keys.map(function (k) {
      var m = mp && mp.metaFor(k);
      return { k: k, l: m ? m.l : k, f: VF[k], hi: m ? m.hi : null };
    });
  }
  var ROWS = buildRows();
  var RADAR = ['roe', 'marge', 'rdt', 'croissance', 'per', 'pbr'];

  function injectCss() {
    if (document.getElementById('tc-cmp-v2-css')) return;
    var s = document.createElement('style');
    s.id = 'tc-cmp-v2-css';
    s.textContent = [
      '#view-comparison{padding:24px clamp(14px,3vw,32px) 56px;max-width:1240px;margin-inline:auto}',
      '#view-comparison .cmp-pick{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}',
      '#view-comparison .cmp-pick select{background:var(--surface);border:1px solid var(--border2);border-radius:8px;color:var(--cream);padding:8px 12px;font:400 12px var(--sans);min-width:200px}',
      '#view-comparison .cmp-chip{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--gold);background:var(--gold-bg);color:var(--gold-l);border-radius:999px;padding:5px 8px 5px 12px;font:600 11px var(--mono)}',
      '#view-comparison .cmp-chip button{border:0;background:transparent;color:inherit;cursor:pointer;font-size:13px;line-height:1}',
      '#view-comparison .cmp-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,420px);gap:18px;align-items:start}',
      '#view-comparison .card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 20px}',
      '#view-comparison table{width:100%;border-collapse:collapse;font-size:12px}',
      '#view-comparison th,#view-comparison td{padding:9px 11px;border-bottom:1px solid var(--border2);text-align:right;font-variant-numeric:tabular-nums;color:var(--cream);white-space:nowrap}',
      '#view-comparison th:first-child,#view-comparison td:first-child{text-align:left;color:var(--muted)}',
      '#view-comparison thead th{font:600 8px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--border)}',
      '#view-comparison thead th b{display:block;color:var(--gold);font:600 12px var(--mono)}',
      '#view-comparison td.best{color:var(--green);font-weight:600}',
      '#view-comparison .cmp-radar{height:360px}',
      '#view-comparison .cmp-bar{display:flex;justify-content:flex-end;gap:8px;margin:14px 0 8px}',
      '#view-comparison .cmp-bar button{border:1px solid var(--border2);background:transparent;color:var(--gold-l);border-radius:7px;padding:6px 12px;font:600 10px var(--sans);text-transform:uppercase;letter-spacing:.06em;cursor:pointer}',
      '#view-comparison .fch-muted{color:var(--dim);font-size:12px}',
      '@media(max-width:900px){#view-comparison .cmp-cols{grid-template-columns:1fr}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function bestIndex(vals, hi) {
    if (!hi) return -1;
    var idx = -1, best = null;
    vals.forEach(function (v, i) {
      if (v == null || !isFinite(v)) return;
      if (best == null || (hi === 'high' ? v > best : v < best)) { best = v; idx = i; }
    });
    return idx;
  }

  function drawRadar(snaps) {
    var cv = document.getElementById('cmpRadar');
    if (!cv || typeof Chart === 'undefined') return;
    var palette = ['#B8964E', '#60a5fa', '#4ade80', '#f87171', '#e6c979', '#c084fc'];
    var ranges = {};
    RADAR.forEach(function (k) {
      var vs = snaps.map(function (s) { return s[k]; }).filter(function (v) { return v != null && isFinite(v); });
      ranges[k] = vs.length ? { min: Math.min.apply(null, vs), max: Math.max.apply(null, vs) } : null;
    });
    var labels = { roe: 'ROE', marge: 'Marge', rdt: 'Rendement', croissance: 'Croiss. CA', per: 'PER (inv.)', pbr: 'P/B (inv.)' };
    var datasets = snaps.map(function (s, i) {
      var col = palette[i % palette.length];
      return {
        label: s.ticker,
        data: RADAR.map(function (k) {
          var r = ranges[k], v = s[k];
          if (!r || v == null || !isFinite(v) || r.max === r.min) return r && v != null ? 50 : 0;
          var t = (v - r.min) / (r.max - r.min) * 100;
          return (k === 'per' || k === 'pbr') ? 100 - t : t; // valorisation : plus bas = mieux
        }),
        borderColor: col, backgroundColor: col + '22', borderWidth: 2, pointRadius: 2
      };
    });
    if (chart) { try { chart.destroy(); } catch (e) {} }
    chart = new Chart(cv, {
      type: 'radar',
      data: { labels: RADAR.map(function (k) { return labels[k]; }), datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { r: { min: 0, max: 100, ticks: { display: false }, grid: { color: 'rgba(184,150,78,.12)' }, angleLines: { color: 'rgba(184,150,78,.12)' }, pointLabels: { color: 'rgba(245,240,232,.6)', font: { size: 10 } } } },
        plugins: { legend: { position: 'bottom', labels: { color: 'rgba(245,240,232,.7)', boxWidth: 10, font: { size: 10 } } } }
      }
    });
  }

  function csv(snaps) {
    var head = 'Indicateur;' + snaps.map(function (s) { return s.ticker; }).join(';');
    var lines = ROWS.map(function (row) {
      return row.l + ';' + snaps.map(function (s) { var v = s[row.k]; return v == null ? '' : String(v).replace('.', ','); }).join(';');
    });
    var blob = new Blob(['﻿' + head + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'comparaison-brvm.csv'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function render() {
    var view = document.getElementById('view-comparison');
    if (!view) return;
    injectCss();
    var companies = (Array.isArray(window.allEntreprises) ? window.allEntreprises : [])
      .filter(function (e) { return e && e.ticker && e.actif !== false; })
      .sort(function (a, b) { return String(a.ticker).localeCompare(String(b.ticker)); });
    if (!companies.length) { view.innerHTML = '<div class="page-header"><h1>Comparaison</h1></div><div class="fch-muted">Données sociétés indisponibles.</div>'; return; }
    if (!picks.length) {
      var m = (location.hash || '').match(/^#comparison=(.+)$/);
      picks = m ? decodeURIComponent(m[1]).split(',').map(function (x) { return x.toUpperCase(); }).filter(Boolean).slice(0, 6)
        : companies.slice(0, 3).map(function (c) { return String(c.ticker).toUpperCase(); });
    }
    var snaps = picks.map(snapshot);
    ROWS = buildRows();

    view.innerHTML =
      '<div class="page-header"><h1>Comparaison <span style="color:var(--gold)">de sociétés</span></h1>'
      + '<p>2 à 6 valeurs — tableau, radar normalisé et export. Meilleure valeur par ligne en vert.</p></div>'
      + '<div class="cmp-pick">'
      + picks.map(function (t) { return '<span class="cmp-chip">' + esc(t) + '<button type="button" data-rm="' + esc(t) + '">×</button></span>'; }).join('')
      + (picks.length < 6 ? '<select id="cmpAdd"><option value="">+ Ajouter une société…</option>'
        + companies.filter(function (c) { return picks.indexOf(String(c.ticker).toUpperCase()) < 0; })
          .map(function (c) { return '<option value="' + esc(c.ticker) + '">' + esc(c.ticker) + ' — ' + esc(c.nom || c.nom_court || '') + '</option>'; }).join('')
        + '</select>' : '')
      + '</div>'
      + '<div class="cmp-bar"><span id="cmpActions"><button type="button" id="cmpCsv">Export CSV</button> </span></div>'
      + '<div class="cmp-cols">'
      + '<div class="card" style="overflow-x:auto"><table><thead><tr><th>Indicateur</th>'
      + snaps.map(function (s) { return '<th><b>' + esc(s.ticker) + '</b>' + esc(s.nom) + '</th>'; }).join('')
      + '</tr></thead><tbody>'
      + ROWS.map(function (row) {
        var vals = snaps.map(function (s) { return s[row.k]; });
        var bi = bestIndex(vals, row.hi);
        return '<tr><td>' + row.l + '</td>' + vals.map(function (v, i) {
          return '<td class="' + (i === bi ? 'best' : '') + '">' + row.f(v) + '</td>';
        }).join('') + '</tr>';
      }).join('')
      + '</tbody></table></div>'
      + '<div class="card"><div class="fch-muted" style="margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;font-size:9px;color:var(--gold)">Profil relatif</div>'
      + '<div class="cmp-radar"><canvas id="cmpRadar"></canvas></div></div>'
      + '</div>';

    drawRadar(snaps);
    try { history.replaceState(null, '', '#comparison=' + encodeURIComponent(picks.join(','))); } catch (e) {}

    var add = document.getElementById('cmpAdd');
    if (add) add.addEventListener('change', function () {
      var v = String(this.value || '').toUpperCase();
      if (v && picks.indexOf(v) < 0 && picks.length < 6) { picks.push(v); render(); }
    });
    view.querySelectorAll('[data-rm]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-rm');
        picks = picks.filter(function (x) { return x !== t; });
        if (picks.length < 2) { var c0 = companies.find(function (c) { return picks.indexOf(String(c.ticker).toUpperCase()) < 0; }); if (c0) picks.push(String(c0.ticker).toUpperCase()); }
        render();
      });
    });
    var cx = document.getElementById('cmpCsv');
    if (cx) cx.addEventListener('click', function () { csv(snaps); });

    if (window.TC_METRICS && !document.getElementById('cmpActions').querySelector('.tc-mp-wrap')) {
      window.TC_METRICS.mount(document.getElementById('cmpActions'), 'comparison', CMP_DEFAULT, function () { render(); });
    }
  }

  window.renderComparison = render;
})();
