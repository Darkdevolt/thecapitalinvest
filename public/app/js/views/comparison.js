// ============================================================================
// COMPARAISON DE SOCIÉTÉS v2  (P1 roadmap) — 2 à 6 sociétés
// Tableau multi-indicateurs + radar (rang parmi la cote) + export CSV.
// Indicateurs : window.tcMetricsFor (score-maison.js). Absent = « — ».
// ============================================================================
(function () {
  'use strict';
  if (window.__TC_COMPARISON_V2__) return;
  window.__TC_COMPARISON_V2__ = true;

  var chart = null;
  var picks = [];

  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  // null / '' = donnée absente, jamais 0 (Number(null) vaut 0 : une colonne
  // vide s'affichait « 0,00 % » et passait pour la meilleure valeur).
  function num(v) { if (v == null || v === '') return null; var n = Number(v); return isFinite(n) ? n : null; }
  function nf(v, dec) { var n = (v == null || v === '') ? NaN : Number(v); return isFinite(n) ? n.toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 0 : dec }) : '—'; }
  function money(v) {
    var n = (v == null || v === '') ? NaN : Number(v); if (!isFinite(n)) return '—';
    var a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' Md';
    if (a >= 1e6) return (n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M';
    return nf(n);
  }

  function cours(t) { return (Array.isArray(window.allCours) ? window.allCours : []).find(function (c) { return c && String(c.ticker).toUpperCase() === t; }) || {}; }

  // Indicateurs fondamentaux : source unique partagée avec le score, le screener
  // et les outils (score-maison.js), pour que tous affichent les mêmes chiffres.
  // Ici on ajoute seulement les données de séance propres au tableau.
  function metrics(t) {
    var s = typeof window.tcMetricsFor === 'function' ? window.tcMetricsFor(t) : { ticker: t, nom: t, secteur: '—', pays: '—' };
    var c = cours(t);
    s.variation = num(c.variation_pct != null ? c.variation_pct : c.variation);
    s.volume = num(c.volume);
    s.turnover = num(c.valeur_totale != null ? c.valeur_totale : c.valeur_transigee);
    return s;
  }

  function snapshot(t) {
    var s = metrics(t), score = null;
    try { if (typeof window.tcScoreMaison === 'function') score = window.tcScoreMaison(t).score; } catch (e) {}
    s.score = score;
    return s;
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
      '#view-comparison td.warn{color:var(--orange)}',
      '#view-comparison .cmp-sub{display:block;font:400 9px var(--sans);letter-spacing:0;text-transform:none;color:var(--dim);margin-top:2px}',
      '#view-comparison .cmp-notes{margin:14px 0 0;padding:12px 0 0 16px;border-top:1px solid var(--border2);font-size:11px;line-height:1.55;color:var(--dim)}',
      '#view-comparison .cmp-radar{height:360px}',
      '#view-comparison .cmp-bar{display:flex;justify-content:flex-end;gap:8px;margin:14px 0 8px}',
      '#view-comparison .cmp-bar button{border:1px solid var(--border2);background:transparent;color:var(--gold-l);border-radius:7px;padding:6px 12px;font:600 10px var(--sans);text-transform:uppercase;letter-spacing:.06em;cursor:pointer}',
      '#view-comparison .fch-muted{color:var(--dim);font-size:12px}',
      '@media(max-width:900px){#view-comparison .cmp-cols{grid-template-columns:1fr}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function valid(v) { return v != null && isFinite(v); }

  // Meilleures valeurs de la ligne. Aucune mise en évidence s'il y a moins de
  // deux valeurs comparables ou si toutes sont égales (un 0 % contre un 0 %
  // n'a pas de gagnant) ; en cas d'ex æquo en tête, tous les ex æquo sont marqués.
  function bestSet(vals, hi) {
    var out = vals.map(function () { return false; });
    if (!hi) return out;
    var pres = vals.filter(valid);
    if (pres.length < 2) return out;
    var best = pres.reduce(function (a, b) { return hi === 'high' ? Math.max(a, b) : Math.min(a, b); });
    if (pres.every(function (v) { return v === best; })) return out;
    vals.forEach(function (v, i) { if (valid(v) && v === best) out[i] = true; });
    return out;
  }

  // Le radar situe chaque société parmi toutes les valeurs cotées disposant de
  // la donnée (100 = meilleure du marché). Une échelle min-max entre les seules
  // sociétés affichées envoyait toujours la moins bonne à 0, même avec un bon ROE.
  function universeMetrics() {
    return (Array.isArray(window.allEntreprises) ? window.allEntreprises : [])
      .filter(function (e) { return e && e.ticker && e.actif !== false; })
      .map(function (e) { return metrics(String(e.ticker).toUpperCase()); });
  }
  function percentile(v, all) {
    var below = 0, same = 0;
    all.forEach(function (x) { if (x < v) below++; else if (x === v) same++; });
    return (below + same / 2) / all.length * 100;
  }

  function drawRadar(snaps) {
    var cv = document.getElementById('cmpRadar');
    if (!cv || typeof Chart === 'undefined') return;
    var palette = ['#B8964E', '#60a5fa', '#4ade80', '#f87171', '#e6c979', '#c084fc'];
    var uni = universeMetrics();
    var pools = {};
    RADAR.forEach(function (k) { pools[k] = uni.map(function (u) { return u[k]; }).filter(valid); });
    var labels = { roe: 'ROE', marge: 'Marge', rdt: 'Rendement', croissance: 'Croiss. CA', per: 'PER (inv.)', pbr: 'P/B (inv.)' };
    var datasets = snaps.map(function (s, i) {
      var col = palette[i % palette.length];
      return {
        label: s.ticker,
        raw: RADAR.map(function (k) { return s[k]; }),
        data: RADAR.map(function (k) {
          var v = s[k];
          if (!valid(v) || pools[k].length < 3) return null; // donnée absente : point non tracé, jamais 0
          var p = percentile(v, pools[k]);
          return (k === 'per' || k === 'pbr') ? 100 - p : p; // valorisation : plus bas = mieux
        }),
        spanGaps: true,
        borderColor: col, backgroundColor: col + '22', borderWidth: 2, pointRadius: 3
      };
    });
    if (chart) { try { chart.destroy(); } catch (e) {} }
    chart = new Chart(cv, {
      type: 'radar',
      data: { labels: RADAR.map(function (k) { return labels[k]; }), datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { r: { min: 0, max: 100, ticks: { display: false }, grid: { color: 'rgba(184,150,78,.12)' }, angleLines: { color: 'rgba(184,150,78,.12)' }, pointLabels: { color: 'rgba(245,240,232,.6)', font: { size: 10 } } } },
        plugins: {
          legend: { position: 'bottom', labels: { color: 'rgba(245,240,232,.7)', boxWidth: 10, font: { size: 10 } } },
          tooltip: { callbacks: { label: function (ctx) {
            var k = RADAR[ctx.dataIndex], raw = ctx.dataset.raw[ctx.dataIndex];
            if (ctx.raw == null) return ctx.dataset.label + ' : donnée absente';
            return ctx.dataset.label + ' : ' + VF[k](raw) + ' — devant ' + Math.round(ctx.raw) + ' % des valeurs';
          } } }
        }
      }
    });
  }

  function csv(snaps) {
    var head = 'Indicateur;' + snaps.map(function (s) { return s.ticker; }).join(';');
    var lines = ['Exercice;' + snaps.map(function (s) { return s.exercice == null ? '' : s.exercice; }).join(';')].concat(ROWS.map(function (row) {
      return row.l + ';' + snaps.map(function (s) {
        if (row.k === 'detteFp' && s.financial) return 'n.s.';
        var v = s[row.k];
        return v == null ? '' : String(Math.round(v * 100) / 100).replace('.', ',');
      }).join(';');
    }));
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
    var known = {};
    companies.forEach(function (c) { known[String(c.ticker).toUpperCase()] = true; });
    if (!picks.length) {
      var m = (location.hash || '').match(/^#comparison=(.+)$/);
      // Un ticker inconnu dans le lien (société retirée, faute de frappe) donnerait une colonne vide.
      picks = m ? decodeURIComponent(m[1]).split(',').map(function (x) { return x.trim().toUpperCase(); })
        .filter(function (x, i, a) { return known[x] && a.indexOf(x) === i; }).slice(0, 6) : [];
      if (picks.length < 2) picks = companies.slice(0, 3).map(function (c) { return String(c.ticker).toUpperCase(); });
    }
    var snaps = picks.map(snapshot);
    ROWS = buildRows();

    // Rappels sous le tableau : ce qui rend une comparaison trompeuse si on l'ignore.
    var years = snaps.map(function (s) { return s.exercice; }).filter(valid);
    var yearsDiffer = years.length > 1 && years.some(function (y) { return y !== years[0]; });
    var notes = [];
    if (snaps.some(function (s) { return s.financial; }) && snaps.some(function (s) { return !s.financial; })) {
      notes.push('Banque ou assurance comparée à une société non financière : PER, P/B, marge et dette ne sont pas comparables d\'un secteur à l\'autre.');
    }
    if (yearsDiffer) notes.push('Les derniers exercices publiés diffèrent d\'une société à l\'autre (ligne « Exercice »).');
    var draft = snaps.filter(function (s) { return s.provisoire; }).map(function (s) { return s.ticker; });
    if (draft.length) notes.push('Comptes non encore validés : ' + esc(draft.join(', ')) + '.');
    if (snaps.some(function (s) { return s.rdtEx != null; })) {
      notes.push('Rendement = dernier dividende brut connu ÷ cours actuel ; « ex. » donne l\'exercice de ce dividende.');
    }
    if (snaps.some(function (s) { return s.financial; })) notes.push('n.s. : non significatif (dette nette / fonds propres pour un établissement financier).');

    view.innerHTML =
      '<div class="page-header"><h1>Comparaison <span style="color:var(--gold)">de sociétés</span></h1>'
      + '<p>2 à 6 valeurs — tableau, radar et export. Meilleure valeur par ligne en vert ; le radar situe chaque société parmi toutes les valeurs cotées.</p></div>'
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
      + snaps.map(function (s) { return '<th><b>' + esc(s.ticker) + '</b>' + esc(s.nom) + '<span class="cmp-sub">' + esc(s.secteur) + '</span></th>'; }).join('')
      + '</tr></thead><tbody>'
      + '<tr><td>Exercice</td>' + snaps.map(function (s) {
        return '<td class="' + (yearsDiffer ? 'warn' : '') + '">' + (s.exercice != null ? esc(s.exercice) : '—')
          + (s.provisoire ? '<span class="cmp-sub" title="Comptes non validés">provisoire</span>' : '') + '</td>';
      }).join('') + '</tr>'
      + ROWS.map(function (row) {
        var vals = snaps.map(function (s) { return s[row.k]; });
        var best = bestSet(vals, row.hi);
        return '<tr><td>' + row.l + '</td>' + snaps.map(function (s, i) {
          var v = vals[i], txt;
          if (row.k === 'detteFp' && s.financial) {
            txt = '<span title="Non significatif pour un établissement financier">n.s.</span>';
          } else {
            txt = row.f(v);
            if (row.k === 'rdt' && v != null && s.rdtEx != null) txt += '<span class="cmp-sub">ex. ' + esc(s.rdtEx) + '</span>';
          }
          return '<td class="' + (best[i] ? 'best' : '') + '">' + txt + '</td>';
        }).join('') + '</tr>';
      }).join('')
      + '</tbody></table>'
      + (notes.length ? '<ul class="cmp-notes">' + notes.map(function (n) { return '<li>' + n + '</li>'; }).join('') + '</ul>' : '')
      + '</div>'
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
