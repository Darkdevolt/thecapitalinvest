// ============================================================================
// ANALYSE TECHNIQUE v3  (P1 roadmap — reconstruction autonome)
// L'ancien sous-système « pro » (technique/*, at-app.js) n'était plus chargé :
// window.atInit absent -> la vue restait vide. Cette version se monte seule
// dans #view-analyse-technique et sépare explicitement, comme demandé par le
// rapport §6 :
//   1. Données        — ce qui vient de la base, brut
//   2. Indicateurs    — ce qui est calculé (formule rappelée)
//   3. Interprétation — lecture automatique de chaque indicateur + confiance
//   4. Opinion        — synthèse pondérée, horizon court terme, non conseil
// Source : historique complet via apiGetHistoriqueComplet. Rien d'inventé :
// un indicateur sans assez de séances affiche « — ».
// ============================================================================
(function () {
  'use strict';
  if (window.__TC_TECHNIQUE_V3__) return;
  window.__TC_TECHNIQUE_V3__ = true;

  var T = '';
  var PERIOD = 252;
  var ADJ = true;
  var series = null;      // [{d, o,h,l,c, v}]
  var chart = null;
  var loading = false;

  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }
  function ymd(v) { return v ? String(v).slice(0, 10) : ''; }
  function nf(v, dec) { var n = Number(v); return isFinite(n) ? n.toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 0 : dec }) : '—'; }
  function pct(v) { var n = Number(v); return isFinite(n) ? (n > 0 ? '+' : '') + nf(n, 2) + ' %' : '—'; }
  function g(id) { return document.getElementById(id); }
  function dLabel(s) { var d = ymd(s); if (!d) return '—'; var p = d.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

  function companyList() {
    return (Array.isArray(window.allEntreprises) ? window.allEntreprises : [])
      .filter(function (e) { return e && e.ticker && e.actif !== false; })
      .map(function (e) { return { t: String(e.ticker).toUpperCase(), n: e.nom || e.nom_court || '' }; })
      .sort(function (a, b) { return a.t.localeCompare(b.t); });
  }

  // ---- maths ----
  function sma(arr, p, i) {
    if (i + 1 < p) return null;
    var s = 0; for (var k = i - p + 1; k <= i; k++) s += arr[k];
    return s / p;
  }
  function emaSeries(arr, p) {
    var out = [], k = 2 / (p + 1), prev = null;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] == null) { out.push(null); continue; }
      prev = prev == null ? arr[i] : arr[i] * k + prev * (1 - k);
      out.push(i + 1 < p ? null : prev);
    }
    return out;
  }
  function stdev(arr, p, i) {
    if (i + 1 < p) return null;
    var m = sma(arr, p, i), s = 0;
    for (var k = i - p + 1; k <= i; k++) s += (arr[k] - m) * (arr[k] - m);
    return Math.sqrt(s / p);
  }
  function rsi(closes, p) {
    if (closes.length <= p) return null;
    var gain = 0, loss = 0, k;
    for (k = 1; k <= p; k++) { var d = closes[k] - closes[k - 1]; if (d >= 0) gain += d; else loss -= d; }
    gain /= p; loss /= p;
    for (k = p + 1; k < closes.length; k++) {
      var dd = closes[k] - closes[k - 1];
      gain = (gain * (p - 1) + (dd > 0 ? dd : 0)) / p;
      loss = (loss * (p - 1) + (dd < 0 ? -dd : 0)) / p;
    }
    if (loss === 0) return 100;
    var rs = gain / loss;
    return 100 - 100 / (1 + rs);
  }
  function macd(closes) {
    var e12 = emaSeries(closes, 12), e26 = emaSeries(closes, 26);
    var line = closes.map(function (_, i) { return (e12[i] != null && e26[i] != null) ? e12[i] - e26[i] : null; });
    var sig = emaSeries(line.map(function (v) { return v == null ? 0 : v; }), 9);
    var i = closes.length - 1;
    if (line[i] == null || sig[i] == null) return null;
    return { line: line[i], signal: sig[i], hist: line[i] - sig[i] };
  }
  function atr(s, p) {
    if (s.length <= p) return null;
    var trs = [];
    for (var i = 1; i < s.length; i++) {
      var h = s[i].h, l = s[i].l, pc = s[i].pc;
      trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }
    var a = trs.slice(0, p).reduce(function (x, y) { return x + y; }, 0) / p;
    for (var k = p; k < trs.length; k++) a = (a * (p - 1) + trs[k]) / p;
    return a;
  }
  function perfOver(closes, k) {
    if (closes.length <= k) return null;
    var a = closes[closes.length - 1 - k], b = closes[closes.length - 1];
    return (a > 0) ? (b / a - 1) * 100 : null;
  }

  // ---- chargement ----
  function loadSeries(ticker) {
    var getter = (typeof window.apiGetHistoriqueComplet === 'function')
      ? window.apiGetHistoriqueComplet(ticker, { pageSize: 1000, maxPages: 12 })
      : (typeof window.apiGetHistorique === 'function' ? window.apiGetHistorique(ticker, 1000, 0) : Promise.resolve([]));
    var guard = new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, 12000); });
    return Promise.race([Promise.resolve(getter), guard]).then(function (rows) {
      var arr = Array.isArray(rows) ? rows : (rows && rows.data) || [];
      if (ADJ && typeof window.tcAdjustedSeries === 'function') arr = window.tcAdjustedSeries(ticker, arr);
      var out = arr.map(function (r) {
        var c = ADJ && r.cours_ajuste != null ? num(r.cours_ajuste)
          : num(r.cours_cloture != null ? r.cours_cloture : r.cloture != null ? r.cloture : r.cours_normal != null ? r.cours_normal : r.cours);
        return {
          d: ymd(r.date_seance || r.date), c: c,
          h: num(r.plus_haut) != null && num(r.plus_haut) > 0 ? num(r.plus_haut) : c,
          l: num(r.plus_bas) != null && num(r.plus_bas) > 0 ? num(r.plus_bas) : c,
          v: num(r.volume)
        };
      }).filter(function (x) { return x.d && x.c != null && x.c > 0; })
        .sort(function (a, b) { return a.d < b.d ? -1 : 1; });
      for (var i = 0; i < out.length; i++) out[i].pc = i ? out[i - 1].c : out[i].c;
      return out;
    });
  }

  // ---- interprétations ----
  function readTrend(closes, s20, s50, s200, last) {
    var above = [s20, s50, s200].filter(function (x) { return x != null && last > x; }).length;
    var have = [s20, s50, s200].filter(function (x) { return x != null; }).length;
    var aligned = (s20 != null && s50 != null && s200 != null) && ((s20 > s50 && s50 > s200) || (s20 < s50 && s50 < s200));
    var upAlign = aligned && s20 > s50;
    var conf = (have === 3 && aligned) ? 'élevée' : have >= 2 ? 'moyenne' : 'faible';
    var verdict, txt;
    if (have === 0) { verdict = 'indéterminée'; txt = 'Pas assez de séances pour les moyennes mobiles.'; conf = 'faible'; }
    else if (above === have && upAlign) { verdict = 'haussière'; txt = 'Cours au-dessus des MM20/50/200, moyennes alignées en ordre haussier.'; }
    else if (above === have) { verdict = 'haussière'; txt = 'Cours au-dessus de toutes les moyennes mobiles disponibles.'; }
    else if (above === 0 && aligned && !upAlign) { verdict = 'baissière'; txt = 'Cours sous les MM20/50/200, moyennes alignées en ordre baissier.'; }
    else if (above === 0) { verdict = 'baissière'; txt = 'Cours sous toutes les moyennes mobiles disponibles.'; }
    else { verdict = 'neutre / transition'; txt = 'Cours entre ses moyennes mobiles — pas de tendance nette.'; }
    return { k: 'tendance', label: 'Tendance', verdict: verdict, conf: conf, txt: txt, score: verdict === 'haussière' ? 1 : verdict === 'baissière' ? -1 : 0 };
  }
  function readRsi(r) {
    if (r == null) return { k: 'rsi', label: 'Momentum (RSI 14)', verdict: '—', conf: 'faible', txt: 'Moins de 15 séances.', score: 0 };
    var verdict, txt, score = 0;
    if (r >= 70) { verdict = 'suracheté'; txt = 'RSI ' + r.toFixed(0) + ' ≥ 70 : risque de correction / consolidation.'; score = -0.5; }
    else if (r <= 30) { verdict = 'survendu'; txt = 'RSI ' + r.toFixed(0) + ' ≤ 30 : rebond technique possible.'; score = 0.5; }
    else if (r >= 55) { verdict = 'momentum positif'; txt = 'RSI ' + r.toFixed(0) + ' dans la zone 55-70 : dynamique acheteuse.'; score = 0.5; }
    else if (r <= 45) { verdict = 'momentum négatif'; txt = 'RSI ' + r.toFixed(0) + ' dans la zone 30-45 : dynamique vendeuse.'; score = -0.5; }
    else { verdict = 'neutre'; txt = 'RSI ' + r.toFixed(0) + ' autour de 50 : pas de biais.'; }
    return { k: 'rsi', label: 'Momentum (RSI 14)', verdict: verdict, conf: 'moyenne', txt: txt, score: score };
  }
  function readMacd(m) {
    if (!m) return { k: 'macd', label: 'MACD (12,26,9)', verdict: '—', conf: 'faible', txt: 'Moins de 35 séances.', score: 0 };
    var pos = m.line > m.signal, above0 = m.line > 0;
    var verdict = pos ? 'signal haussier' : 'signal baissier';
    var txt = 'Ligne MACD ' + (pos ? 'au-dessus' : 'en dessous') + ' de sa ligne de signal, ' + (above0 ? 'au-dessus' : 'sous') + ' du zéro (histogramme ' + (m.hist >= 0 ? '+' : '') + m.hist.toFixed(1) + ').';
    return { k: 'macd', label: 'MACD (12,26,9)', verdict: verdict, conf: 'moyenne', txt: txt, score: (pos ? 0.5 : -0.5) + (above0 ? 0.25 : -0.25) };
  }
  function readBoll(last, mid, up, lo) {
    if (mid == null) return { k: 'boll', label: 'Bollinger (20, 2σ)', verdict: '—', conf: 'faible', txt: 'Moins de 20 séances.', score: 0 };
    var width = (up - lo) / mid * 100;
    var posp = (last - lo) / (up - lo) * 100;
    var verdict, txt, score = 0;
    if (last >= up) { verdict = 'contact bande haute'; txt = 'Cours sur la bande supérieure (position ' + posp.toFixed(0) + ' %) — extension haussière, prudence.'; score = -0.25; }
    else if (last <= lo) { verdict = 'contact bande basse'; txt = 'Cours sur la bande inférieure (position ' + posp.toFixed(0) + ' %) — extension baissière.'; score = 0.25; }
    else { verdict = 'dans les bandes'; txt = 'Cours à ' + posp.toFixed(0) + ' % de la largeur des bandes ; largeur ' + width.toFixed(1) + ' % du cours.'; }
    return { k: 'boll', label: 'Bollinger (20, 2σ)', verdict: verdict, conf: 'moyenne', txt: txt, score: score };
  }
  function readVol(lastV, avgV, volAnn) {
    var parts = [], score = 0, verdict = 'normal';
    if (lastV != null && avgV != null && avgV > 0) {
      var ratio = lastV / avgV;
      if (ratio >= 2) { verdict = 'volume élevé'; parts.push('Volume du jour ×' + ratio.toFixed(1) + ' la moyenne 20 séances — mouvement à confirmer.'); score = 0.25; }
      else if (ratio <= 0.4) { verdict = 'volume faible'; parts.push('Volume du jour à ' + (ratio * 100).toFixed(0) + ' % de la moyenne — faible conviction.'); }
      else parts.push('Volume proche de sa moyenne 20 séances.');
    } else parts.push('Volumes indisponibles.');
    if (volAnn != null) parts.push('Volatilité annualisée ' + volAnn.toFixed(0) + ' %.');
    return { k: 'vol', label: 'Volume & volatilité', verdict: verdict, conf: 'moyenne', txt: parts.join(' '), score: score };
  }

  // ---- rendu ----
  function injectCss() {
    if (g('tc-technique-v3-css')) return;
    var s = document.createElement('style');
    s.id = 'tc-technique-v3-css';
    s.textContent = [
      '#view-analyse-technique .at3-form{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:14px}',
      '#view-analyse-technique .at3-field{display:flex;flex-direction:column;gap:4px}',
      '#view-analyse-technique .at3-field label{font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--gold)}',
      '#view-analyse-technique select{background:var(--surface);border:1px solid rgba(245,240,232,.16);color:var(--cream);border-radius:8px;padding:9px 10px;font:inherit}',
      '#view-analyse-technique .at3-toggle{display:flex;gap:0;border:1px solid rgba(245,240,232,.16);border-radius:8px;overflow:hidden}',
      '#view-analyse-technique .at3-toggle button{background:var(--surface);border:0;color:var(--muted,rgba(245,240,232,.6));padding:9px 12px;font:inherit;cursor:pointer}',
      '#view-analyse-technique .at3-toggle button.on{background:var(--gold);color:#1a1408;font-weight:700}',
      '#view-analyse-technique .at3-sec{margin-bottom:18px}',
      '#view-analyse-technique .at3-sec h2{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--gold);margin:0 0 8px}',
      '#view-analyse-technique .at3-card{background:var(--card);border:1px solid rgba(245,240,232,.09);border-radius:12px;padding:16px}',
      '#view-analyse-technique .at3-chart{height:300px}',
      '#view-analyse-technique table{width:100%;border-collapse:collapse;font-size:13px}',
      '#view-analyse-technique th,#view-analyse-technique td{text-align:left;padding:8px 10px;border-bottom:1px solid rgba(245,240,232,.08);vertical-align:top}',
      '#view-analyse-technique td.r,#view-analyse-technique th.r{text-align:right;font-variant-numeric:tabular-nums}',
      '#view-analyse-technique .at3-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}',
      '#view-analyse-technique .at3-kpi{background:var(--surface);border:1px solid rgba(245,240,232,.08);border-radius:9px;padding:11px 13px}',
      '#view-analyse-technique .at3-kpi .k{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim)}',
      '#view-analyse-technique .at3-kpi .v{font-family:var(--mono,monospace);font-size:16px;margin-top:4px;font-variant-numeric:tabular-nums}',
      '#view-analyse-technique .pos{color:var(--green,#4ADE80)}#view-analyse-technique .neg{color:var(--red,#F87171)}',
      '#view-analyse-technique .at3-int{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid rgba(245,240,232,.07)}',
      '#view-analyse-technique .at3-int .b{font-weight:700;min-width:120px}',
      '#view-analyse-technique .at3-int .c{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);white-space:nowrap}',
      '#view-analyse-technique .at3-op{font-size:15px;font-weight:700;margin-bottom:6px}',
      '#view-analyse-technique .at3-note{font-size:11.5px;line-height:1.55;color:var(--muted,rgba(245,240,232,.6))}',
      '#view-analyse-technique .at3-empty{padding:26px;text-align:center;color:var(--dim)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function kpi(k, v, cls) { return '<div class="at3-kpi"><div class="k">' + esc(k) + '</div><div class="v ' + (cls || '') + '">' + v + '</div></div>'; }

  function computeAndRender() {
    var view = g('view-analyse-technique');
    if (!view || !series) return;
    var s = series.slice(-Math.max(30, PERIOD));
    if (s.length < 20) { g('at3Body').innerHTML = '<div class="at3-empty">Moins de 20 séances disponibles pour ' + esc(T) + '.</div>'; return; }
    var closes = s.map(function (x) { return x.c; });
    var i = closes.length - 1, last = closes[i];
    var s20 = sma(closes, 20, i), s50 = sma(closes, 50, i), s200 = sma(closes, 200, i);
    var e20a = emaSeries(closes, 20), e20 = e20a[i];
    var sd = stdev(closes, 20, i);
    var bMid = s20, bUp = (s20 != null && sd != null) ? s20 + 2 * sd : null, bLo = (s20 != null && sd != null) ? s20 - 2 * sd : null;
    var rsi14 = rsi(closes, 14);
    var mac = macd(closes);
    var atr14 = atr(s, 14);
    var rets = [];
    for (var k = 1; k < closes.length; k++) if (closes[k - 1] > 0) rets.push(closes[k] / closes[k - 1] - 1);
    var mean = rets.reduce(function (a, b) { return a + b; }, 0) / (rets.length || 1);
    var varc = rets.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / (rets.length > 1 ? rets.length - 1 : 1);
    var volAnn = Math.sqrt(varc) * Math.sqrt(252) * 100;
    var hi = Math.max.apply(null, s.map(function (x) { return x.h; }));
    var lo = Math.min.apply(null, s.map(function (x) { return x.l; }));
    var lastV = s[i].v, avgV = s.slice(-20).reduce(function (a, x) { return a + (x.v || 0); }, 0) / Math.min(20, s.length);

    // 1 · Données
    var dataHtml = '<div class="at3-kpis">'
      + kpi('Dernière séance', dLabel(s[i].d))
      + kpi('Cours (' + (ADJ ? 'ajusté' : 'brut') + ')', nf(last))
      + kpi('Variation veille', pct(s[i].pc > 0 ? (last / s[i].pc - 1) * 100 : null), last >= s[i].pc ? 'pos' : 'neg')
      + kpi('Plus haut période', nf(hi))
      + kpi('Plus bas période', nf(lo))
      + kpi('Volume dernière séance', lastV != null ? nf(lastV) : '—')
      + kpi('Séances analysées', s.length)
      + '</div><p class="at3-note" style="margin-top:8px">Source : table <i>historique</i> (clôtures officielles BRVM)' + (ADJ ? ', retraitées des détachements de dividende' : '') + '. Fenêtre : ' + s.length + ' séances jusqu\'au ' + dLabel(s[i].d) + '.</p>';

    // 2 · Indicateurs calculés
    function row(name, val, formula) { return '<tr><td><b>' + esc(name) + '</b></td><td class="r">' + val + '</td><td class="at3-note">' + esc(formula) + '</td></tr>'; }
    var indHtml = '<div style="overflow-x:auto"><table><thead><tr><th>Indicateur</th><th class="r">Valeur</th><th>Définition</th></tr></thead><tbody>'
      + row('SMA 20', s20 != null ? nf(s20) : '—', 'Moyenne arithmétique des 20 dernières clôtures.')
      + row('SMA 50', s50 != null ? nf(s50) : '—', 'Moyenne arithmétique des 50 dernières clôtures.')
      + row('SMA 200', s200 != null ? nf(s200) : '—', 'Moyenne arithmétique des 200 dernières clôtures (tendance de fond).')
      + row('EMA 20', e20 != null ? nf(e20) : '—', 'Moyenne exponentielle, poids 2/(20+1) sur la dernière clôture.')
      + row('RSI 14', rsi14 != null ? rsi14.toFixed(1) : '—', 'Force relative (Wilder) : 100 − 100/(1+moyenne gains/moyenne pertes) sur 14 séances.')
      + row('MACD (12,26,9)', mac ? nf(mac.line, 1) + ' / sig ' + nf(mac.signal, 1) + ' / hist ' + nf(mac.hist, 1) : '—', 'EMA12 − EMA26, ligne de signal = EMA9 du MACD.')
      + row('Bollinger 20', (bUp != null) ? nf(bLo) + ' – ' + nf(bUp) : '—', 'SMA20 ± 2 écarts-types des 20 dernières clôtures.')
      + row('ATR 14', atr14 != null ? nf(atr14) : '—', 'Average True Range (Wilder) : amplitude vraie moyenne sur 14 séances.')
      + row('Volatilité annualisée', isFinite(volAnn) ? volAnn.toFixed(1) + ' %' : '—', 'Écart-type des rendements quotidiens × √252.')
      + row('Perf. 1 mois', pct(perfOver(closes, 21)), 'Variation de clôture sur 21 séances.')
      + row('Perf. 3 mois', pct(perfOver(closes, 63)), 'Variation de clôture sur 63 séances.')
      + row('Perf. 1 an', pct(perfOver(closes, 252)), 'Variation de clôture sur 252 séances.')
      + '</tbody></table></div>';

    // 3 · Interprétation
    var reads = [
      readTrend(closes, s20, s50, s200, last),
      readRsi(rsi14),
      readMacd(mac),
      readBoll(last, bMid, bUp, bLo),
      readVol(lastV, avgV, isFinite(volAnn) ? volAnn : null)
    ];
    var intHtml = reads.map(function (r) {
      return '<div class="at3-int"><span class="b">' + esc(r.label) + '</span>'
        + '<span style="flex:1"><b>' + esc(r.verdict) + '</b><div class="at3-note">' + esc(r.txt) + '</div></span>'
        + '<span class="c">confiance ' + esc(r.conf) + '</span></div>';
    }).join('');

    // 4 · Opinion (agrégation pondérée)
    var W = { tendance: 3, rsi: 1.5, macd: 2, boll: 1, vol: 0.5 };
    var total = 0, wsum = 0;
    reads.forEach(function (r) { var w = W[r.k] || 1; total += (r.score || 0) * w; wsum += w; });
    var norm = wsum ? total / wsum : 0;
    var stance, sc;
    if (norm >= 0.45) { stance = 'Configuration acheteuse'; sc = 'pos'; }
    else if (norm >= 0.15) { stance = 'Légèrement positive'; sc = 'pos'; }
    else if (norm <= -0.45) { stance = 'Configuration vendeuse'; sc = 'neg'; }
    else if (norm <= -0.15) { stance = 'Légèrement négative'; sc = 'neg'; }
    else { stance = 'Neutre'; sc = ''; }
    var opHtml = '<div class="at3-op ' + sc + '">' + esc(stance) + ' <span class="at3-note">(indice ' + norm.toFixed(2) + ' sur −1 à +1)</span></div>'
      + '<p class="at3-note">Méthode : moyenne pondérée des signaux ci-dessus — tendance ×3, MACD ×2, RSI ×1,5, Bollinger ×1, volume ×0,5. Horizon court terme (quelques semaines). '
      + 'Cette synthèse mécanique <b>ne tient pas compte des fondamentaux ni de l\'actualité</b> de la société et <b>ne constitue pas un conseil d\'investissement</b>.</p>';

    g('at3Body').innerHTML = ''
      + section('1 · Données de marché', dataHtml)
      + '<div class="at3-sec"><h2>Graphique</h2><div class="at3-card"><div class="at3-chart"><canvas id="at3Chart"></canvas></div></div></div>'
      + section('2 · Indicateurs calculés', indHtml)
      + section('3 · Interprétation automatique', intHtml)
      + section('4 · Opinion de synthèse', opHtml);

    drawChart(s, e20a);
  }

  function section(title, inner) { return '<div class="at3-sec"><h2>' + esc(title) + '</h2><div class="at3-card">' + inner + '</div></div>'; }

  function drawChart(s, ema20) {
    var cv = g('at3Chart');
    if (!cv || typeof Chart === 'undefined') return;
    if (chart) { try { chart.destroy(); } catch (e) {} chart = null; }
    var closes = s.map(function (x) { return x.c; });
    var labels = s.map(function (x) { return x.d; });
    var s20 = closes.map(function (_, i) { return sma(closes, 20, i); });
    var s50 = closes.map(function (_, i) { return sma(closes, 50, i); });
    var sd = closes.map(function (_, i) { return stdev(closes, 20, i); });
    var bUp = closes.map(function (_, i) { return (s20[i] != null && sd[i] != null) ? s20[i] + 2 * sd[i] : null; });
    var bLo = closes.map(function (_, i) { return (s20[i] != null && sd[i] != null) ? s20[i] - 2 * sd[i] : null; });
    chart = new Chart(cv, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          { label: 'Bande sup.', data: bUp, borderColor: 'rgba(184,150,78,.25)', pointRadius: 0, borderWidth: 1, fill: '+1' },
          { label: 'Bande inf.', data: bLo, borderColor: 'rgba(184,150,78,.25)', pointRadius: 0, borderWidth: 1, backgroundColor: 'rgba(184,150,78,.06)', fill: false },
          { label: 'Cours', data: closes, borderColor: '#B8964E', backgroundColor: 'rgba(184,150,78,.10)', pointRadius: 0, borderWidth: 2, fill: false, tension: .15 },
          { label: 'SMA 20', data: s20, borderColor: '#60A5FA', pointRadius: 0, borderWidth: 1.2, fill: false },
          { label: 'SMA 50', data: s50, borderColor: '#F87171', pointRadius: 0, borderWidth: 1.2, fill: false }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: 'rgba(245,240,232,.7)', font: { size: 10 }, filter: function (it) { return it.text !== 'Bande sup.' && it.text !== 'Bande inf.'; } } } },
        scales: {
          x: { ticks: { color: 'rgba(245,240,232,.4)', maxTicksLimit: 8 }, grid: { display: false } },
          y: { ticks: { color: 'rgba(245,240,232,.4)', callback: function (v) { return nf(v); } }, grid: { color: 'rgba(245,240,232,.06)' } }
        }
      }
    });
  }

  function launch() {
    if (loading || !T) return;
    loading = true;
    g('at3Body').innerHTML = '<div class="at3-empty">Chargement de l\'historique de ' + esc(T) + '…</div>';
    loadSeries(T).then(function (out) {
      series = out; loading = false;
      if (!series.length) { g('at3Body').innerHTML = '<div class="at3-empty">Historique indisponible pour ' + esc(T) + '.</div>'; return; }
      computeAndRender();
    }).catch(function (e) {
      loading = false;
      g('at3Body').innerHTML = '<div class="at3-empty">Échec du chargement : ' + esc(e && e.message === 'timeout' ? 'délai dépassé.' : (e && e.message) || 'erreur.') + '</div>';
    });
  }

  function render() {
    var view = g('view-analyse-technique');
    if (!view) return;
    injectCss();
    var comps = companyList();
    if (!T && comps.length) {
      var m = (location.hash || '').match(/[?&]t=([A-Z0-9]+)/i);
      T = m ? m[1].toUpperCase() : comps[0].t;
    }
    view.innerHTML = ''
      + '<div class="page-header"><h1>Analyse <span style="color:var(--gold)">technique</span></h1>'
      + '<p>Données de marché, indicateurs calculés, lecture automatique et opinion de synthèse — séparés et explicités.</p></div>'
      + '<div class="at3-form">'
      + '<div class="at3-field"><label for="at3Ticker">Valeur</label><select id="at3Ticker">'
      + comps.map(function (c) { return '<option value="' + esc(c.t) + '"' + (c.t === T ? ' selected' : '') + '>' + esc(c.t) + (c.n ? ' — ' + esc(c.n) : '') + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="at3-field"><label for="at3Period">Fenêtre</label><select id="at3Period">'
      + [[126, '6 mois'], [252, '1 an'], [504, '2 ans'], [99999, 'Tout']].map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === PERIOD ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="at3-field"><label>Cours</label><div class="at3-toggle"><button type="button" id="at3Adj" class="' + (ADJ ? 'on' : '') + '">Ajusté</button><button type="button" id="at3Raw" class="' + (ADJ ? '' : 'on') + '">Brut</button></div></div>'
      + '</div>'
      + '<div id="at3Body"><div class="at3-empty">Sélectionnez une valeur.</div></div>';

    g('at3Ticker').addEventListener('change', function () { T = this.value.toUpperCase(); series = null; launch(); });
    g('at3Period').addEventListener('change', function () { PERIOD = Number(this.value) || 252; if (series) computeAndRender(); });
    g('at3Adj').addEventListener('click', function () { if (ADJ) return; ADJ = true; render(); series = null; launch(); });
    g('at3Raw').addEventListener('click', function () { if (!ADJ) return; ADJ = false; render(); series = null; launch(); });

    if (T) launch();
  }

  window.renderAnalyseTechnique = render;
})();
