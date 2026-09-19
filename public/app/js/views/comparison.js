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
  var started = false;    // la comparaison ne se calcule qu'après « Lancer »
  var hashParsed = false; // le lien #comparison=… n'est lu qu'une fois

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
    // Ordre du catalogue (Marché → Valorisation → Rentabilité → Solidité → Synthèse),
    // pas l'ordre des clics : sinon P/B se retrouvait sous Volume, loin du PER.
    if (mp && mp.CAT) {
      var pos = {};
      mp.CAT.forEach(function (m, i) { pos[m.k] = i; });
      keys = keys.slice().sort(function (a, b) { return pos[a] - pos[b]; });
    }
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
      '#view-comparison{padding:30px clamp(16px,3.5vw,42px) 64px;max-width:1440px;margin-inline:auto}',
      '#view-comparison .page-header{margin:0 0 24px;padding:0 0 22px;border-bottom:1px solid var(--border2);position:relative}',
      '#view-comparison .page-header:after{content:"";position:absolute;left:0;bottom:-1px;width:88px;height:1px;background:var(--gold)}',
      '#view-comparison .page-header h1{font-size:clamp(27px,2.4vw,38px);line-height:1.08;margin:0 0 8px;letter-spacing:-.025em}',
      '#view-comparison .page-header p{max-width:850px;margin:0;color:var(--muted);font-size:12px;line-height:1.65}',
      '#view-comparison .cmp-pick{display:grid;grid-template-columns:repeat(2,minmax(210px,1fr)) minmax(190px,1fr);gap:10px;margin:0 0 18px}',
      '#view-comparison .cmp-company{position:relative;min-height:72px;padding:13px 36px 12px 15px;border:1px solid var(--border);border-radius:10px;background:linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.012));box-shadow:inset 0 1px 0 rgba(255,255,255,.025);display:flex;flex-direction:column;justify-content:center}',
      '#view-comparison .cmp-company:hover{border-color:rgba(184,150,78,.55)}',
      '#view-comparison .cmp-company-t{font:700 12px var(--mono);color:var(--gold-l);letter-spacing:.03em}',
      '#view-comparison .cmp-company-n{margin-top:4px;color:var(--cream);font-size:11px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#view-comparison .cmp-company-s{margin-top:3px;color:var(--dim);font-size:9px}',
      '#view-comparison .cmp-remove{position:absolute;right:10px;top:9px;width:22px;height:22px;border:1px solid var(--border2);border-radius:50%;background:transparent;color:var(--muted);cursor:pointer;font-size:14px;line-height:19px}',
      '#view-comparison .cmp-remove:hover{border-color:var(--gold);color:var(--gold-l);background:var(--gold-bg)}',
      '#view-comparison .cmp-add{min-height:72px;border:1px dashed rgba(184,150,78,.55);border-radius:10px;background:rgba(184,150,78,.025);color:var(--gold-l);padding:0 14px;cursor:pointer;font:600 11px var(--sans);text-align:left}',
      '#view-comparison .cmp-add:hover{background:var(--gold-bg);border-color:var(--gold)}',
      '#view-comparison .cmp-add strong{display:block;font:700 13px var(--serif);color:var(--cream);margin-bottom:3px}',
      '#view-comparison .cmp-add span{color:var(--dim);font-size:9px}',
      '#view-comparison .cmp-pick select{width:100%;height:72px;background:var(--surface);border:1px dashed var(--border2);border-radius:10px;color:var(--cream);padding:0 13px;font:400 11px var(--sans);cursor:pointer}',
      '#view-comparison .cmp-pick select:hover{border-color:var(--gold)}',
      '#view-comparison .cmp-tools{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 0 12px}',
      '#view-comparison .cmp-count{font:600 9px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--dim)}',
      '#view-comparison .cmp-count b{color:var(--gold-l)}',
      '#view-comparison .cmp-bar{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin:0 0 12px}',
      '#view-comparison .cmp-bar button,#view-comparison .cmp-bar #cmpCsv{border:1px solid var(--border2);background:rgba(255,255,255,.018);color:var(--gold-l);border-radius:7px;padding:8px 12px;font:600 9px var(--sans);text-transform:uppercase;letter-spacing:.07em;cursor:pointer;transition:.18s ease}',
      '#view-comparison .cmp-bar button:hover,#view-comparison .cmp-bar #cmpCsv:hover{border-color:var(--gold);background:var(--gold-bg);transform:translateY(-1px)}',
      '#view-comparison .cmp-cols{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(330px,.8fr);gap:14px;align-items:start}',
      '#view-comparison .card{background:linear-gradient(145deg,rgba(255,255,255,.026),rgba(255,255,255,.012));border:1px solid var(--border);border-radius:12px;box-shadow:0 14px 34px rgba(0,0,0,.16);overflow:hidden}',
      '#view-comparison .cmp-table-card{min-width:0}',
      '#view-comparison .cmp-card-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid var(--border2);background:rgba(255,255,255,.012)}',
      '#view-comparison .cmp-card-title{display:flex;align-items:center;gap:10px}',
      '#view-comparison .cmp-icon{width:30px;height:30px;display:grid;place-items:center;border:1px solid rgba(184,150,78,.35);border-radius:8px;background:var(--gold-bg);color:var(--gold-l);font-size:13px}',
      '#view-comparison .cmp-card-title strong{display:block;font:600 15px var(--serif);color:var(--cream)}',
      '#view-comparison .cmp-card-title span{display:block;margin-top:2px;color:var(--dim);font-size:9px}',
      '#view-comparison .cmp-view-label{font:600 8px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--dim);white-space:nowrap}',
      '#view-comparison .cmp-table-scroll{overflow:auto;max-height:620px}',
      '#view-comparison table{width:100%;min-width:620px;border-collapse:separate;border-spacing:0;font-size:12px}',
      '#view-comparison th,#view-comparison td{padding:10px 13px;border-bottom:1px solid rgba(255,255,255,.055);text-align:right;font-variant-numeric:tabular-nums;color:var(--cream);white-space:nowrap}',
      '#view-comparison th:first-child,#view-comparison td:first-child{text-align:left;position:sticky;left:0;z-index:2;background:#17140f;color:var(--muted);min-width:155px}',
      '#view-comparison thead th{position:sticky;top:0;z-index:3;background:#181510;font:600 8px var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--border)}',
      '#view-comparison thead th:not(:first-child){min-width:150px}',
      '#view-comparison thead th:first-child{z-index:4}',
      '#view-comparison thead th b{display:block;color:var(--gold);font:700 12px var(--mono);letter-spacing:.02em}',
      '#view-comparison tbody tr:hover td{background:rgba(184,150,78,.025)}',
      '#view-comparison tbody tr:hover td:first-child{background:#1b1711}',
      '#view-comparison td.best{color:var(--green);font-weight:700;background:rgba(74,222,128,.035)}',
      '#view-comparison td.warn{color:var(--orange)}',
      '#view-comparison .cmp-sub{display:block;font:400 9px var(--sans);letter-spacing:0;text-transform:none;color:var(--dim);margin-top:2px}',
      '#view-comparison .cmp-notes{margin:0;padding:13px 18px 15px 32px;border-top:1px solid var(--border2);font-size:10px;line-height:1.55;color:var(--dim);background:rgba(0,0,0,.08)}',
      '#view-comparison .cmp-notes li+li{margin-top:4px}',
      '#view-comparison .cmp-radar-card{min-width:0}',
      '#view-comparison .cmp-radar-head{padding:16px 18px 4px}',
      '#view-comparison .cmp-radar{height:390px;padding:8px 10px 14px}',
      '#view-comparison .cmp-radar-help{font-size:9px;color:var(--dim);line-height:1.5;margin-top:3px}',
      '#view-comparison .cmp-start{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:28px 24px}',
      '#view-comparison .cmp-start-t{font:600 16px var(--serif);color:var(--cream)}',
      '#view-comparison .fch-muted{color:var(--dim);font-size:12px}',
      '#view-comparison .cmp-go{margin-top:10px;border:0;background:var(--gold);color:#1a1408;border-radius:8px;padding:10px 20px;font:700 10px var(--sans);text-transform:uppercase;letter-spacing:.08em;cursor:pointer}',
      '#view-comparison .cmp-go:disabled{opacity:.35;cursor:not-allowed}',
      '@media(max-width:1050px){#view-comparison .cmp-pick{grid-template-columns:repeat(2,minmax(0,1fr));}#view-comparison .cmp-add{grid-column:1/-1}}',
      '@media(max-width:900px){#view-comparison .cmp-cols{grid-template-columns:1fr}#view-comparison .cmp-radar{height:350px}}',
      '@media(max-width:620px){#view-comparison{padding-inline:12px}.cmp-pick{grid-template-columns:1fr!important}.cmp-add{grid-column:auto!important}.cmp-tools{align-items:flex-start;flex-direction:column}.cmp-bar{justify-content:flex-start!important;flex-wrap:wrap}.cmp-card-head{align-items:flex-start!important}.cmp-view-label{display:none}}'
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
        scales: { r: { min: 0, max: 100, ticks: { display: false }, grid: { color: 'rgba(184,150,78,.12)' }, angleLines: { color: 'rgba(184,150,78,.12)' }, pointLabels: { color: 'rgba(245,240,232,.88)', font: { size: 11, weight: '600' } } } },
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
    // Le lien #comparison=A,B,C n'est lu qu'une fois : c'est un choix explicite
    // (≥ 2 valeurs valides → comparaison lancée). Sans lien, on part d'une
    // sélection vide : plus aucune société n'est choisie à la place de l'utilisateur.
    if (!hashParsed) {
      hashParsed = true;
      var m = (location.hash || '').match(/^#comparison=(.+)$/);
      // Un ticker inconnu dans le lien (société retirée, faute de frappe) donnerait une colonne vide.
      picks = m ? decodeURIComponent(m[1]).split(',').map(function (x) { return x.trim().toUpperCase(); })
        .filter(function (x, i, a) { return known[x] && a.indexOf(x) === i; }).slice(0, 6) : [];
      started = picks.length >= 2;
    }
    if (picks.length < 2) started = false;

    var head = '<div class="page-header"><h1>Comparaison <span style="color:var(--gold)">de sociétés</span></h1>'
      + '<p>Comparez de 2 à 6 valeurs sur leurs principaux indicateurs financiers, leur valorisation et leur profil relatif.</p></div>'
      + '<div class="cmp-pick">'
      + picks.map(function (t) {
          var co = companies.find(function (x) { return String(x.ticker).toUpperCase() === t; }) || {};
          return '<div class="cmp-company"><span class="cmp-company-t">' + esc(t) + '</span>'
            + '<span class="cmp-company-n">' + esc(co.nom || co.nom_court || t) + '</span>'
            + '<span class="cmp-company-s">' + esc(co.secteur || 'Société cotée') + '</span>'
            + '<button type="button" class="cmp-remove" data-rm="' + esc(t) + '" aria-label="Retirer ' + esc(t) + '">×</button></div>';
        }).join('')
      + (picks.length < 6 ? '<select id="cmpAdd" aria-label="Ajouter une société"><option value="">+ Ajouter une société…</option>'
        + companies.filter(function (c) { return picks.indexOf(String(c.ticker).toUpperCase()) < 0; })
          .map(function (c) { return '<option value="' + esc(c.ticker) + '">' + esc(c.ticker) + ' — ' + esc(c.nom || c.nom_court || '') + '</option>'; }).join('')
        + '</select>' : '')
      + '</div>';

    function wirePicks() {
      var add = document.getElementById('cmpAdd');
      if (add) add.addEventListener('change', function () {
        var v = String(this.value || '').toUpperCase();
        if (v && picks.indexOf(v) < 0 && picks.length < 6) { picks.push(v); render(); }
      });
      view.querySelectorAll('[data-rm]').forEach(function (b) {
        b.addEventListener('click', function () {
          var t = b.getAttribute('data-rm');
          picks = picks.filter(function (x) { return x !== t; });
          if (picks.length < 2) started = false;
          render();
        });
      });
      var go = document.getElementById('cmpGo');
      if (go) go.addEventListener('click', function () { started = true; render(); });
    }

    // Étape 1 : choisir. La comparaison ne se calcule qu'après « Lancer ».
    if (!started) {
      var n = picks.length;
      view.innerHTML = head
        + '<div class="card cmp-start"><div class="cmp-start-t">' + (n === 0 ? 'Choisissez les sociétés à comparer'
          : n === 1 ? '1 société choisie — ajoutez-en au moins une autre' : n + ' sociétés choisies') + '</div>'
        + '<div class="fch-muted">De 2 à 6 valeurs. Le tableau et le radar s\'affichent une fois la comparaison lancée.</div>'
        + '<button type="button" id="cmpGo" class="cmp-go"' + (n < 2 ? ' disabled' : '') + '>Lancer la comparaison</button></div>';
      wirePicks();
      try { if (/^#comparison=/.test(location.hash)) history.replaceState(null, '', '#comparison'); } catch (e) {}
      return;
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

    view.innerHTML = head
      + '<div class="cmp-tools"><span class="cmp-count"><b>' + picks.length + ' / 6</b> sociétés sélectionnées</span>'
      + '<div class="cmp-bar"><span id="cmpActions"><button type="button" id="cmpCsv">Export CSV</button></span></div></div>'
      + '<div class="cmp-cols">'
      + '<div class="card cmp-table-card"><div class="cmp-card-head"><div class="cmp-card-title"><span class="cmp-icon">◈</span><div><strong>Indicateurs clés</strong><span>Lecture comparative des données disponibles</span></div></div><span class="cmp-view-label">Valeurs absolues</span></div>'
      + '<div class="cmp-table-scroll"><table><thead><tr><th>Indicateur</th>'
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
      + '</div></div>'
      + '<div class="card cmp-radar-card"><div class="cmp-radar-head"><div class="cmp-card-title"><span class="cmp-icon">⌁</span><div><strong>Profil relatif</strong><span>Positionnement percentile parmi les valeurs cotées</span></div></div></div>'
      + '<div class="cmp-radar"><canvas id="cmpRadar"></canvas></div></div>'
      + '</div>';

    drawRadar(snaps);
    try { history.replaceState(null, '', '#comparison=' + encodeURIComponent(picks.join(','))); } catch (e) {}

    wirePicks();
    var cx = document.getElementById('cmpCsv');
    if (cx) cx.addEventListener('click', function () { csv(snaps); });

    var actions = document.getElementById('cmpActions');
    if (window.TC_METRICS && actions && !actions.querySelector('.tc-mp-wrap')) {
      window.TC_METRICS.mount(actions, 'comparison', CMP_DEFAULT, function () { render(); });
    }
  }

  window.renderComparison = render;
})();
