/* ═══════════════════════════════════════════════════════════════════
   THE CAPITAL — ANALYSE TECHNIQUE PRO
   at-analysis.js : lecture analytique de la série.

   Ce module ne dessine rien et n'appelle aucune API. Il reçoit une
   série de bougies et renvoie des objets exploitables : un faisceau
   de signaux argumentés, un tableau de bord statistique, les figures
   détectées, un plan de trade chiffré et des backtests.

   Trois principes le gouvernent :

     1. Toute conclusion est motivée. Un signal sans phrase
        d'explication n'est pas publié.
     2. Une métrique qui manque de données affiche « données
        insuffisantes ». Elle ne se remplace jamais par zéro et ne
        disparaît pas en silence.
     3. Rien n'est extrapolé. Les objectifs de cours sont des
        projections géométriques de figures identifiées, présentées
        comme telles, jamais comme des prévisions.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.ATAnalysis) return;

  var M = global.ATMath;
  var ND = 'données insuffisantes';

  function pct(v, d) { return M.fin(v) ? (v >= 0 ? '+' : '') + (v * 100).toFixed(d == null ? 2 : d) + ' %' : null; }

  /* ═══════════ Faisceau de signaux ═══════════ */

  /* Chaque test renvoie un score dans [-2, +2], un poids, et la phrase
     qui justifie le score. Le score global est la moyenne pondérée,
     ramenée sur une échelle de -100 à +100. */
  function signals(d) {
    var c = d.c, h = d.h, l = d.l, v = d.v;
    var n = c.length;
    var out = [];
    if (n < 30) return { enough: false, need: 30, have: n, items: [] };

    var i = n - 1;
    var price = c[i];

    function add(group, label, score, weight, reason, detail) {
      out.push({
        group: group, label: label,
        score: M.fin(score) ? M.clamp(score, -2, 2) : null,
        weight: weight, reason: reason, detail: detail || null
      });
    }

    /* — Tendance — */
    var s20 = M.sma(c, 20), s50 = M.sma(c, 50), s200 = M.sma(c, 200);
    var a20 = s20[i], a50 = s50[i], a200 = s200[i];
    if (M.fin(a20) && M.fin(a50)) {
      var sc, why;
      if (price > a20 && a20 > a50) { sc = 2; why = 'Le cours domine la moyenne à 20 séances, elle-même au-dessus de celle à 50 : la hiérarchie des moyennes est haussière.'; }
      else if (price < a20 && a20 < a50) { sc = -2; why = 'Le cours passe sous la moyenne à 20 séances, elle-même sous celle à 50 : la hiérarchie des moyennes est baissière.'; }
      else if (price > a50) { sc = 0.5; why = 'Le cours tient au-dessus de la moyenne à 50 séances mais les moyennes courtes sont enchevêtrées.'; }
      else { sc = -0.5; why = 'Le cours évolue sous la moyenne à 50 séances sans hiérarchie claire des moyennes courtes.'; }
      add('Tendance', 'Empilement des moyennes', sc, 2.5, why,
        'Cours ' + fmt(price) + ' · MM20 ' + fmt(a20) + ' · MM50 ' + fmt(a50));
    }
    if (M.fin(a200)) {
      var above = price > a200;
      var dist = (price - a200) / a200 * 100;
      add('Tendance', 'Moyenne à 200 séances', above ? 1 : -1, 2,
        above
          ? 'Le cours se situe ' + dist.toFixed(1) + ' % au-dessus de sa moyenne à 200 séances : la tendance de fond reste haussière.'
          : 'Le cours se situe ' + Math.abs(dist).toFixed(1) + ' % sous sa moyenne à 200 séances : la tendance de fond reste baissière.',
        'MM200 ' + fmt(a200));
    }
    if (M.fin(a50) && M.fin(a200) && M.fin(s50[i - 1]) && M.fin(s200[i - 1])) {
      if (s50[i - 1] <= s200[i - 1] && a50 > a200) {
        add('Tendance', 'Croisement doré', 2, 2, 'La moyenne à 50 séances vient de repasser au-dessus de celle à 200 séances. Ce croisement est lent mais structurant.');
      } else if (s50[i - 1] >= s200[i - 1] && a50 < a200) {
        add('Tendance', 'Croisement de la mort', -2, 2, 'La moyenne à 50 séances vient de repasser sous celle à 200 séances.');
      }
    }

    var adxR = M.adx(h, l, c, 14);
    var adxV = adxR.adx[i], diP = adxR.diP[i], diN = adxR.diN[i];
    if (M.fin(adxV)) {
      var dir = M.fin(diP) && M.fin(diN) ? (diP > diN ? 1 : -1) : 0;
      var force = adxV >= 40 ? 2 : adxV >= 25 ? 1.2 : adxV >= 20 ? 0.5 : 0;
      add('Tendance', 'Force directionnelle', force * dir, 2,
        adxV < 20
          ? 'ADX à ' + adxV.toFixed(1) + ' : sous 20, le marché n\'a pas de tendance exploitable et les signaux de suivi de tendance sont peu fiables.'
          : 'ADX à ' + adxV.toFixed(1) + ', ' + (dir > 0 ? '+DI au-dessus de −DI' : '−DI au-dessus de +DI') + ' : tendance ' + (adxV >= 40 ? 'très établie' : adxV >= 25 ? 'établie' : 'naissante') + ' et orientée à la ' + (dir > 0 ? 'hausse' : 'baisse') + '.',
        '+DI ' + (M.fin(diP) ? diP.toFixed(1) : '—') + ' · −DI ' + (M.fin(diN) ? diN.toFixed(1) : '—'));
    }

    var st = M.superTrend(h, l, c, 10, 3);
    if (M.fin(st.dir[i])) {
      var flipped = M.fin(st.dir[i - 1]) && st.dir[i - 1] !== st.dir[i];
      add('Tendance', 'SuperTrend', st.dir[i] * (flipped ? 2 : 1.2), 1.5,
        flipped
          ? 'Le SuperTrend vient de basculer en position ' + (st.dir[i] === 1 ? 'haussière' : 'baissière') + ' : c\'est le signal le plus récent du faisceau.'
          : 'Le SuperTrend reste en position ' + (st.dir[i] === 1 ? 'haussière' : 'baissière') + ', avec un stop suiveur à ' + fmt(st.line[i]) + '.',
        'Ligne à ' + fmt(st.line[i]));
    }

    /* — Momentum — */
    var rsiS = M.rsi(c, 14);
    var rsiV = rsiS[i];
    if (M.fin(rsiV)) {
      var rs, rwhy;
      if (rsiV >= 70) { rs = -1; rwhy = 'RSI à ' + rsiV.toFixed(1) + ' : zone de surachat. En tendance haussière forte, un RSI tendu peut le rester ; c\'est un avertissement, pas un signal de vente.'; }
      else if (rsiV <= 30) { rs = 1; rwhy = 'RSI à ' + rsiV.toFixed(1) + ' : zone de survente. En tendance baissière, le RSI peut y stationner longtemps.'; }
      else if (rsiV > 55) { rs = 0.8; rwhy = 'RSI à ' + rsiV.toFixed(1) + ' : momentum acheteur sans excès.'; }
      else if (rsiV < 45) { rs = -0.8; rwhy = 'RSI à ' + rsiV.toFixed(1) + ' : momentum vendeur sans excès.'; }
      else { rs = 0; rwhy = 'RSI à ' + rsiV.toFixed(1) + ' : zone neutre, aucun déséquilibre marqué.'; }
      add('Momentum', 'RSI (14)', rs, 2, rwhy);
    }

    var mc = M.macd(c);
    if (M.fin(mc.macd[i]) && M.fin(mc.signal[i])) {
      var cross = M.fin(mc.macd[i - 1]) && M.fin(mc.signal[i - 1]) &&
        ((mc.macd[i - 1] <= mc.signal[i - 1]) !== (mc.macd[i] <= mc.signal[i]));
      var bull = mc.macd[i] > mc.signal[i];
      var expanding = M.fin(mc.hist[i - 1]) && Math.abs(mc.hist[i]) > Math.abs(mc.hist[i - 1]);
      add('Momentum', 'MACD', (bull ? 1 : -1) * (cross ? 2 : expanding ? 1.4 : 0.8), 2,
        cross
          ? 'Croisement ' + (bull ? 'haussier' : 'baissier') + ' des lignes MACD sur la dernière séance.'
          : 'Ligne MACD ' + (bull ? 'au-dessus' : 'au-dessous') + ' de son signal, histogramme ' + (expanding ? 'en expansion' : 'en contraction') + ' : le mouvement ' + (expanding ? 's\'accélère' : 'ralentit') + '.',
        'MACD ' + mc.macd[i].toFixed(2) + ' · signal ' + mc.signal[i].toFixed(2));
    }

    var sto = M.stochastic(h, l, c, 14, 3, 3);
    if (M.fin(sto.k[i]) && M.fin(sto.d[i])) {
      var kv = sto.k[i], dv = sto.d[i];
      var sscore = kv > 80 ? -0.8 : kv < 20 ? 0.8 : (kv > dv ? 0.5 : -0.5);
      add('Momentum', 'Stochastique', sscore, 1.2,
        kv > 80 ? '%K à ' + kv.toFixed(1) + ' : le titre clôture en haut de son amplitude récente.'
          : kv < 20 ? '%K à ' + kv.toFixed(1) + ' : le titre clôture en bas de son amplitude récente.'
            : '%K à ' + kv.toFixed(1) + ' contre %D à ' + dv.toFixed(1) + ' : ' + (kv > dv ? 'l\'avantage reste aux acheteurs' : 'l\'avantage reste aux vendeurs') + '.');
    }

    var rocV = M.roc(c, 20)[i];
    if (M.fin(rocV)) {
      add('Momentum', 'Variation 20 séances', M.clamp(rocV / 5, -2, 2), 1,
        'Le cours varie de ' + (rocV >= 0 ? '+' : '') + rocV.toFixed(2) + ' % sur les vingt dernières séances.');
    }

    /* — Volatilité — */
    var bb = M.bollinger(c, 20, 2);
    if (M.fin(bb.width[i])) {
      var widths = bb.width.filter(M.fin).slice(-120);
      var sorted = widths.slice().sort(function (a, b) { return a - b; });
      var rank = sorted.length ? sorted.filter(function (x) { return x < bb.width[i]; }).length / sorted.length : null;
      var squeeze = rank != null && rank < 0.15;
      add('Volatilité', 'Bandes de Bollinger', 0, 1,
        squeeze
          ? 'Largeur des bandes à ' + bb.width[i].toFixed(1) + ' %, dans les 15 % les plus faibles des six derniers mois. Cette compression précède souvent une expansion, sans en indiquer le sens.'
          : 'Largeur des bandes à ' + bb.width[i].toFixed(1) + ' %' + (rank != null ? ', soit le ' + Math.round(rank * 100) + 'ᵉ centile des six derniers mois' : '') + '. %B à ' + bb.percentB[i].toFixed(2) + '.',
        squeeze ? 'compression' : null);
    }
    var atrV = M.atr(h, l, c, 14)[i];
    if (M.fin(atrV) && price) {
      add('Volatilité', 'ATR (14)', 0, 0.8,
        'Amplitude vraie moyenne de ' + fmt(atrV) + ' FCFA, soit ' + (atrV / price * 100).toFixed(2) + ' % du cours. Un stop plus serré que cette amplitude sera emporté par le bruit ordinaire de la cote.');
    }

    /* — Volume — */
    var volMa = M.sma(v, 20)[i];
    if (M.fin(volMa) && volMa > 0 && M.fin(v[i])) {
      var ratio = v[i] / volMa;
      var priceUp = M.fin(c[i - 1]) && c[i] >= c[i - 1];
      var vscore = ratio > 1.5 ? (priceUp ? 1.5 : -1.5) : ratio < 0.5 ? 0 : (priceUp ? 0.5 : -0.5);
      add('Volume', 'Volume relatif', vscore, 1.5,
        ratio > 1.5
          ? 'Volume à ' + ratio.toFixed(1) + ' fois sa moyenne à 20 séances sur une séance ' + (priceUp ? 'haussière' : 'baissière') + ' : le mouvement est soutenu par les échanges.'
          : ratio < 0.5
            ? 'Volume à ' + ratio.toFixed(1) + ' fois sa moyenne : les échanges sont trop rares pour valider quoi que ce soit. Prudence sur toute lecture technique.'
            : 'Volume proche de sa moyenne (' + ratio.toFixed(1) + '×), séance ' + (priceUp ? 'haussière' : 'baissière') + '.',
        M.fin(v[i]) ? Math.round(v[i]).toLocaleString('fr-FR') + ' titres' : null);
    }
    var obvS = M.obv(c, v);
    if (M.fin(obvS[i]) && M.fin(obvS[i - 20])) {
      var obvUp = obvS[i] > obvS[i - 20];
      var pxUp = M.fin(c[i - 20]) && c[i] > c[i - 20];
      var diverge = obvUp !== pxUp;
      add('Volume', 'On-Balance Volume', diverge ? (obvUp ? 1 : -1) * 1.2 : (obvUp ? 1 : -1), 1.3,
        diverge
          ? 'L\'OBV ' + (obvUp ? 'progresse' : 'recule') + ' alors que le cours fait l\'inverse sur vingt séances : les volumes contredisent le prix, ce qui précède souvent un ajustement.'
          : 'L\'OBV ' + (obvUp ? 'progresse' : 'recule') + ' de concert avec le cours sur vingt séances : les volumes confirment le mouvement.');
    }
    var mfiV = M.mfi(h, l, c, v, 14)[i];
    if (M.fin(mfiV)) {
      add('Volume', 'Money Flow Index', mfiV > 80 ? -0.8 : mfiV < 20 ? 0.8 : (mfiV - 50) / 30, 1,
        'MFI à ' + mfiV.toFixed(1) + ' : ' + (mfiV > 80 ? 'flux acheteurs saturés' : mfiV < 20 ? 'flux vendeurs saturés' : mfiV > 50 ? 'flux orientés à l\'achat' : 'flux orientés à la vente') + '.');
    }

    /* — Divergences — */
    var divR = M.detectDivergences(c, h, l, rsiS, 'RSI', { window: 90, max: 2 });
    divR.forEach(function (dv2) {
      if (n - dv2.to > 12) return;
      add('Divergences', 'Divergence RSI', dv2.bias * (dv2.hidden ? 1 : 1.6), 1.6, dv2.note);
    });
    var divM = M.detectDivergences(c, h, l, mc.hist, 'MACD', { window: 90, max: 1 });
    divM.forEach(function (dv3) {
      if (n - dv3.to > 12) return;
      add('Divergences', 'Divergence MACD', dv3.bias * 1.2, 1.2, dv3.note);
    });

    /* — Chandeliers récents — */
    var candles = M.detectCandles(d.o, h, l, c, 4);
    var seenC = {};
    candles.forEach(function (cd) {
      if (seenC[cd.key]) return;
      seenC[cd.key] = true;
      if (cd.bias === 0) return;
      var age = n - 1 - cd.index;
      add('Chandeliers', cd.name, M.clamp(cd.bias, -2, 2) * (age === 0 ? 1 : 0.6), 1,
        cd.note + (age === 0 ? ' Configuration formée sur la dernière séance.' : ' Configuration repérée il y a ' + age + ' séance' + (age > 1 ? 's' : '') + '.'));
    });

    var scored = out.filter(function (s) { return M.fin(s.score); });
    var wsum = 0, ssum = 0;
    scored.forEach(function (s) { wsum += s.weight; ssum += s.score * s.weight; });
    var global100 = wsum ? M.clamp(ssum / (wsum * 2) * 100, -100, 100) : 0;

    var verdict =
      global100 >= 45 ? { label: 'Configuration haussière affirmée', tone: 'strong-bull' } :
        global100 >= 15 ? { label: 'Biais haussier', tone: 'bull' } :
          global100 <= -45 ? { label: 'Configuration baissière affirmée', tone: 'strong-bear' } :
            global100 <= -15 ? { label: 'Biais baissier', tone: 'bear' } :
              { label: 'Absence de biais net', tone: 'neutral' };

    /* Le degré d'accord entre signaux compte autant que leur moyenne :
       un score modéré porté par des signaux unanimes est plus solide
       qu'un score élevé issu de signaux qui se contredisent. */
    var pos = scored.filter(function (s) { return s.score > 0.2; }).length;
    var neg = scored.filter(function (s) { return s.score < -0.2; }).length;
    var neu = scored.length - pos - neg;
    var agreement = scored.length ? Math.abs(pos - neg) / scored.length : 0;

    var groups = {};
    out.forEach(function (s) { (groups[s.group] = groups[s.group] || []).push(s); });

    return {
      enough: true,
      items: out, groups: groups,
      score: global100, verdict: verdict,
      counts: { positive: pos, negative: neg, neutral: neu, total: scored.length },
      agreement: agreement,
      confidence: agreement >= 0.5 ? 'élevée' : agreement >= 0.28 ? 'moyenne' : 'faible'
    };

    function fmt(x) { return M.fin(x) ? x.toLocaleString('fr-FR', { maximumFractionDigits: Math.abs(x) >= 100 ? 0 : 2 }) : '—'; }
  }

  /* ═══════════ Plan de trade chiffré ═══════════ */

  /* Les niveaux sont dérivés de l'ATR et des pivots réellement observés,
     jamais d'une cible arbitraire. Le rapport gain/risque est affiché
     tel qu'il ressort du calcul, favorable ou non. */
  function tradePlan(d, sig) {
    var c = d.c, h = d.h, l = d.l;
    var n = c.length;
    if (n < 40) return { enough: false };
    var i = n - 1;
    var price = c[i];
    var atrV = M.atr(h, l, c, 14)[i];
    if (!M.fin(atrV) || !M.fin(price) || atrV <= 0) return { enough: false };

    var levels = M.supportResistance(h, l, c, { max: 10, minTouches: 2 });
    var supports = levels.filter(function (x) { return x.value < price; }).sort(function (a, b) { return b.value - a.value; });
    var resistances = levels.filter(function (x) { return x.value > price; }).sort(function (a, b) { return a.value - b.value; });

    var bullish = sig && sig.score > 0;
    var direction = bullish ? 'long' : 'short';

    var stop, target1, target2, stopBasis, targetBasis;
    if (bullish) {
      var sup = supports[0];
      var atrStop = price - 2 * atrV;
      if (sup && sup.value > atrStop && sup.value < price * 0.995) {
        stop = sup.value - 0.25 * atrV;
        stopBasis = 'sous le support à ' + fmtP(sup.value) + ' (' + sup.touches + ' contacts), avec une marge d\'un quart d\'ATR';
      } else {
        stop = atrStop;
        stopBasis = 'à deux ATR sous le cours, faute de support proche identifié';
      }
      target1 = resistances[0] ? resistances[0].value : price + 2 * atrV;
      target2 = resistances[1] ? resistances[1].value : price + 4 * atrV;
      targetBasis = resistances[0]
        ? 'première résistance à ' + fmtP(resistances[0].value) + (resistances[1] ? ', puis ' + fmtP(resistances[1].value) : '')
        : 'aucune résistance repérée au-dessus : objectifs projetés à deux et quatre ATR';
    } else {
      var res = resistances[0];
      var atrStopS = price + 2 * atrV;
      if (res && res.value < atrStopS && res.value > price * 1.005) {
        stop = res.value + 0.25 * atrV;
        stopBasis = 'au-dessus de la résistance à ' + fmtP(res.value) + ' (' + res.touches + ' contacts), avec une marge d\'un quart d\'ATR';
      } else {
        stop = atrStopS;
        stopBasis = 'à deux ATR au-dessus du cours, faute de résistance proche identifiée';
      }
      target1 = supports[0] ? supports[0].value : price - 2 * atrV;
      target2 = supports[1] ? supports[1].value : price - 4 * atrV;
      targetBasis = supports[0]
        ? 'premier support à ' + fmtP(supports[0].value) + (supports[1] ? ', puis ' + fmtP(supports[1].value) : '')
        : 'aucun support repéré au-dessous : objectifs projetés à deux et quatre ATR';
    }

    var risk = Math.abs(price - stop);
    var reward1 = Math.abs(target1 - price);
    var reward2 = Math.abs(target2 - price);

    return {
      enough: true,
      direction: direction,
      entry: price,
      stop: stop,
      target1: target1,
      target2: target2,
      risk: risk,
      riskPct: risk / price * 100,
      rr1: risk > 0 ? reward1 / risk : null,
      rr2: risk > 0 ? reward2 / risk : null,
      atr: atrV,
      atrPct: atrV / price * 100,
      stopBasis: stopBasis,
      targetBasis: targetBasis,
      supports: supports.slice(0, 3),
      resistances: resistances.slice(0, 3),
      /* Dimensionnement : combien de titres pour ne risquer qu'un
         pourcentage donné d'un capital donné. */
      sizing: function (capital, riskPct) {
        if (!M.fin(capital) || !M.fin(riskPct) || risk <= 0) return null;
        var budget = capital * riskPct / 100;
        var qty = Math.floor(budget / risk);
        return { quantity: qty, engaged: qty * price, budget: budget };
      }
    };

    function fmtP(x) { return M.fin(x) ? Math.round(x).toLocaleString('fr-FR') : '—'; }
  }

  /* ═══════════ Tableau de bord statistique ═══════════ */

  function statistics(d, benchmark) {
    var c = d.c;
    var n = c.length;
    var warn = [];
    if (n < 25) return { enough: false, need: 25, have: n };

    var r = M.returns(c);
    var lr = M.returns(c, true);
    var sd = M.stdev(r);
    var volAnn = M.fin(sd) ? sd * Math.sqrt(M.SEANCES_AN) : NaN;
    var totalRet = M.fin(c[0]) && c[0] > 0 ? c[n - 1] / c[0] - 1 : NaN;
    var years = n / M.SEANCES_AN;
    var cagr = M.fin(totalRet) && years > 0.08 ? Math.pow(1 + totalRet, 1 / years) - 1 : NaN;
    var rf = typeof global.TC_TAUX_SANS_RISQUE === 'number' ? global.TC_TAUX_SANS_RISQUE : 0.035;
    var meanAnn = M.fin(M.mean(r)) ? M.mean(r) * M.SEANCES_AN : NaN;
    var sharpe = M.fin(meanAnn) && M.fin(volAnn) && volAnn > 0 ? (meanAnn - rf) / volAnn : NaN;
    var downside = r.filter(function (x) { return x < 0; });
    var dsd = downside.length > 4 ? M.stdev(downside) * Math.sqrt(M.SEANCES_AN) : NaN;
    var sortino = M.fin(meanAnn) && M.fin(dsd) && dsd > 0 ? (meanAnn - rf) / dsd : NaN;
    var dd = M.maxDrawdown(c);
    var calmar = M.fin(cagr) && dd.value < 0 ? cagr / Math.abs(dd.value) : NaN;

    if (n < 60) warn.push('Série courte (' + n + ' séances) : les ratios annualisés restent indicatifs.');

    var bench = null;
    if (benchmark && benchmark.values && benchmark.values.length > 25) {
      /* Alignement date à date. Sans dates communes en nombre suffisant,
         beta et corrélation ne sont pas publiés. */
      var mapB = {};
      benchmark.dates.forEach(function (dt, k) { mapB[dt] = benchmark.values[k]; });
      var pa = [], pb = [];
      d.dates.forEach(function (dt, k) {
        if (mapB[dt] != null && M.fin(mapB[dt]) && M.fin(c[k])) { pa.push(c[k]); pb.push(mapB[dt]); }
      });
      if (pa.length >= 30) {
        var ra = M.returns(pa), rb = M.returns(pb);
        var be = M.beta(ra, rb);
        var co = M.correlation(ra, rb);
        var benchAnn = M.fin(M.mean(rb)) ? M.mean(rb) * M.SEANCES_AN : NaN;
        bench = {
          name: benchmark.name || 'indice de référence',
          observations: pa.length,
          beta: be,
          correlation: co,
          r2: M.fin(co) ? co * co : NaN,
          benchReturnAnn: benchAnn,
          alpha: M.fin(be) && M.fin(meanAnn) && M.fin(benchAnn) ? meanAnn - (rf + be * (benchAnn - rf)) : NaN
        };
      } else {
        warn.push('Beta et corrélation non calculés : ' + pa.length + ' séance(s) commune(s) seulement avec l\'indice, il en faut au moins 30.');
      }
    } else {
      warn.push('Aucune série d\'indice alignée disponible : le comportement relatif au marché n\'est pas mesuré.');
    }

    var volumes = d.v.filter(function (x) { return M.fin(x) && x > 0; });
    var tradedDays = d.v.filter(function (x) { return M.fin(x) && x > 0; }).length;

    return {
      enough: true,
      observations: r.length,
      sessions: n,
      period: { from: d.dates[0], to: d.dates[n - 1] },
      totalReturn: totalRet,
      cagr: cagr,
      volAnn: volAnn,
      volParkinson: M.parkinsonVol(d.h, d.l),
      volGarmanKlass: M.garmanKlassVol(d.o, d.h, d.l, d.c),
      sharpe: sharpe, sortino: sortino, calmar: calmar,
      riskFree: rf,
      maxDrawdown: dd.value,
      drawdownFrom: d.dates[dd.peakIndex],
      drawdownTo: d.dates[dd.troughIndex],
      drawdownDuration: dd.duration,
      var95: M.historicalVar(r, 0.95),
      var99: M.historicalVar(r, 0.99),
      cvar95: M.conditionalVar(r, 0.95),
      skewness: M.skewness(r),
      kurtosis: M.kurtosis(r),
      hurst: M.hurst(lr),
      bestDay: r.length ? Math.max.apply(null, r) : NaN,
      worstDay: r.length ? Math.min.apply(null, r) : NaN,
      positiveDays: r.length ? r.filter(function (x) { return x > 0; }).length / r.length : NaN,
      avgVolume: volumes.length ? M.mean(volumes) : NaN,
      medianVolume: volumes.length ? M.quantile(volumes.slice().sort(function (a, b) { return a - b; }), 0.5) : NaN,
      liquidity: n ? tradedDays / n : NaN,
      benchmark: bench,
      warnings: warn
    };
  }

  /* ═══════════ Structure et figures ═══════════ */

  function structure(d) {
    var levels = M.supportResistance(d.h, d.l, d.c, { max: 8, minTouches: 2, tolerance: 0.018 });
    var patterns = M.detectChartPatterns(d.h, d.l, d.c, { threshold: 4.5, window: 220 });
    var candles = M.detectCandles(d.o, d.h, d.l, d.c, 12);
    var rsiS = M.rsi(d.c, 14);
    var mc = M.macd(d.c);
    var divergences = M.detectDivergences(d.c, d.h, d.l, rsiS, 'RSI', { window: 140, max: 3 })
      .concat(M.detectDivergences(d.c, d.h, d.l, mc.hist, 'MACD', { window: 140, max: 2 }))
      .sort(function (a, b) { return b.to - a.to; });
    /* Une même divergence peut être relevée sur plusieurs paires de pivots
       voisines. Publier trois fois la même phrase n'apporte rien : on ne
       garde que la plus récente de chaque type. */
    var seenDiv = {};
    divergences = divergences.filter(function (d2) {
      var k = d2.label + '|' + d2.kind;
      if (seenDiv[k]) return false;
      seenDiv[k] = true;
      return true;
    }).slice(0, 4);
    return { levels: levels, patterns: patterns, candles: candles, divergences: divergences };
  }

  /* ═══════════ Stratégies de backtest ═══════════ */

  var STRATEGIES = [
    {
      id: 'ma-cross', name: 'Croisement de moyennes', short: 'MM 20/50',
      desc: 'Achat au passage de la moyenne à 20 séances au-dessus de celle à 50, vente au croisement inverse. La référence des stratégies de suivi de tendance.',
      build: function (d) {
        var f = M.sma(d.c, 20), s = M.sma(d.c, 50);
        return function (i) {
          if (!M.fin(f[i]) || !M.fin(s[i]) || !M.fin(f[i - 1]) || !M.fin(s[i - 1])) return 0;
          if (f[i] > s[i] && f[i - 1] <= s[i - 1]) return 1;
          if (f[i] < s[i] && f[i - 1] >= s[i - 1]) return -1;
          return 0;
        };
      }
    },
    {
      id: 'ema-cross', name: 'Croisement exponentiel', short: 'EMA 12/26',
      desc: 'Même logique avec des moyennes exponentielles, plus réactives : davantage de signaux, davantage de faux départs.',
      build: function (d) {
        var f = M.ema(d.c, 12), s = M.ema(d.c, 26);
        return function (i) {
          if (!M.fin(f[i]) || !M.fin(s[i]) || !M.fin(f[i - 1]) || !M.fin(s[i - 1])) return 0;
          if (f[i] > s[i] && f[i - 1] <= s[i - 1]) return 1;
          if (f[i] < s[i] && f[i - 1] >= s[i - 1]) return -1;
          return 0;
        };
      }
    },
    {
      id: 'macd', name: 'Croisement MACD', short: 'MACD',
      desc: 'Achat au croisement haussier de la ligne MACD sur son signal, vente au croisement baissier.',
      build: function (d) {
        var m = M.macd(d.c);
        return function (i) {
          if (!M.fin(m.macd[i]) || !M.fin(m.signal[i]) || !M.fin(m.macd[i - 1]) || !M.fin(m.signal[i - 1])) return 0;
          if (m.macd[i] > m.signal[i] && m.macd[i - 1] <= m.signal[i - 1]) return 1;
          if (m.macd[i] < m.signal[i] && m.macd[i - 1] >= m.signal[i - 1]) return -1;
          return 0;
        };
      }
    },
    {
      id: 'rsi', name: 'Retour à la moyenne RSI', short: 'RSI 30/70',
      desc: 'Achat lorsque le RSI ressort de la zone de survente, vente lorsqu\'il retombe de la zone de surachat. Adapté aux marchés sans tendance.',
      build: function (d) {
        var r = M.rsi(d.c, 14);
        return function (i) {
          if (!M.fin(r[i]) || !M.fin(r[i - 1])) return 0;
          if (r[i] > 30 && r[i - 1] <= 30) return 1;
          if (r[i] < 70 && r[i - 1] >= 70) return -1;
          return 0;
        };
      }
    },
    {
      id: 'supertrend', name: 'Retournement SuperTrend', short: 'SuperTrend',
      desc: 'Position calée sur le sens du SuperTrend, avec stop suiveur implicite. Peu de signaux, longtemps portés.',
      build: function (d) {
        var s = M.superTrend(d.h, d.l, d.c, 10, 3);
        return function (i) {
          if (!M.fin(s.dir[i]) || !M.fin(s.dir[i - 1])) return 0;
          if (s.dir[i] === 1 && s.dir[i - 1] === -1) return 1;
          if (s.dir[i] === -1 && s.dir[i - 1] === 1) return -1;
          return 0;
        };
      }
    },
    {
      id: 'donchian', name: 'Cassure de canal', short: 'Donchian 20',
      desc: 'Achat sur un plus haut de vingt séances, sortie sur un plus bas de dix. Stratégie de cassure historique des tortues.',
      build: function (d) {
        var up = M.donchian(d.h, d.l, 20).upper;
        var dn = M.donchian(d.h, d.l, 10).lower;
        return function (i) {
          if (!M.fin(up[i - 1]) || !M.fin(dn[i - 1]) || !M.fin(d.c[i])) return 0;
          if (d.c[i] > up[i - 1]) return 1;
          if (d.c[i] < dn[i - 1]) return -1;
          return 0;
        };
      }
    },
    {
      id: 'buyhold', name: 'Achat et conservation', short: 'Buy & hold',
      desc: 'Référence de comparaison : entrée à la première séance disponible, aucune sortie. Toute stratégie doit être jugée face à elle.',
      build: function () { return function (i) { return i === 1 ? 1 : 0; }; }
    }
  ];

  function runBacktest(d, strategyId, opts) {
    var strat = null;
    STRATEGIES.forEach(function (s) { if (s.id === strategyId) strat = s; });
    if (!strat) return null;
    var bars = d.dates.map(function (dt, i) { return { date: dt, o: d.o[i], h: d.h[i], l: d.l[i], c: d.c[i], v: d.v[i] }; });
    var fn = strat.build(d);
    var res = M.backtest(bars, fn, {
      fees: opts && opts.fees != null ? opts.fees : 0.02,
      minTrades: strategyId === 'buyhold' ? 1 : 5
    });
    res.strategy = strat;
    /* Comparaison systématique à l'achat-conservation : un résultat brut
       n'a pas de sens hors de cette référence. */
    if (strategyId !== 'buyhold' && d.c.length > 2 && M.fin(d.c[0]) && d.c[0] > 0) {
      res.buyHold = d.c[d.c.length - 1] / d.c[0] - 1;
    }
    return res;
  }

  function runAllBacktests(d, opts) {
    return STRATEGIES.map(function (s) {
      var r = runBacktest(d, s.id, opts);
      return { id: s.id, name: s.name, short: s.short, desc: s.desc, result: r };
    });
  }

  /* ═══════════ Balayage technique du marché ═══════════ */

  /* Le balayage ne travaille que sur des séries déjà en mémoire. Il
     n'émet aucune requête : c'est ce qui lui permet de rester instantané
     et de ne jamais peser sur les autres vues. */
  function screen(seriesByTicker, opts) {
    opts = opts || {};
    var rows = [];
    Object.keys(seriesByTicker).forEach(function (ticker) {
      var d = seriesByTicker[ticker];
      if (!d || !d.c || d.c.length < 60) return;
      var n = d.c.length, i = n - 1;
      var price = d.c[i];
      if (!M.fin(price)) return;
      var rsiV = M.rsi(d.c, 14)[i];
      var s20 = M.sma(d.c, 20)[i], s50 = M.sma(d.c, 50)[i], s200 = M.sma(d.c, 200)[i];
      var adxR = M.adx(d.h, d.l, d.c, 14);
      var mc = M.macd(d.c);
      var st = M.superTrend(d.h, d.l, d.c, 10, 3);
      var volMa = M.sma(d.v, 20)[i];
      var atrV = M.atr(d.h, d.l, d.c, 14)[i];
      var perf = function (k) {
        var p = d.c[i - k];
        return M.fin(p) && p > 0 ? (price - p) / p * 100 : null;
      };
      var trend = M.fin(s20) && M.fin(s50)
        ? (price > s20 && s20 > s50 ? 'Haussière' : price < s20 && s20 < s50 ? 'Baissière' : 'Indécise')
        : '—';
      rows.push({
        ticker: ticker,
        price: price,
        sessions: n,
        rsi: rsiV,
        adx: adxR.adx[i],
        diDir: M.fin(adxR.diP[i]) && M.fin(adxR.diN[i]) ? (adxR.diP[i] > adxR.diN[i] ? 1 : -1) : 0,
        macdHist: mc.hist[i],
        macdCross: M.fin(mc.macd[i]) && M.fin(mc.signal[i]) && M.fin(mc.macd[i - 1]) && M.fin(mc.signal[i - 1])
          ? ((mc.macd[i - 1] <= mc.signal[i - 1]) !== (mc.macd[i] <= mc.signal[i]) ? (mc.macd[i] > mc.signal[i] ? 1 : -1) : 0)
          : 0,
        superTrend: st.dir[i],
        superTrendFlip: M.fin(st.dir[i]) && M.fin(st.dir[i - 1]) && st.dir[i] !== st.dir[i - 1],
        trend: trend,
        above200: M.fin(s200) ? price > s200 : null,
        dist200: M.fin(s200) && s200 ? (price - s200) / s200 * 100 : null,
        perf5: perf(5), perf20: perf(20), perf60: perf(60), perf252: perf(252),
        volRatio: M.fin(volMa) && volMa > 0 && M.fin(d.v[i]) ? d.v[i] / volMa : null,
        atrPct: M.fin(atrV) && price ? atrV / price * 100 : null,
        liquidity: d.v.filter(function (x) { return M.fin(x) && x > 0; }).length / n
      });
    });

    if (opts.sort) {
      rows.sort(function (a, b) {
        var va = a[opts.sort], vb = b[opts.sort];
        if (va == null) return 1;
        if (vb == null) return -1;
        return opts.desc ? vb - va : va - vb;
      });
    }
    return rows;
  }

  global.ATAnalysis = {
    ND: ND,
    signals: signals,
    tradePlan: tradePlan,
    statistics: statistics,
    structure: structure,
    strategies: STRATEGIES,
    backtest: runBacktest,
    backtestAll: runAllBacktests,
    screen: screen,
    pct: pct
  };
})(typeof window !== 'undefined' ? window : globalThis);
