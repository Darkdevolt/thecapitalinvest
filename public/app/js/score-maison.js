// ============================================================================
// SCORE MAISON THE CAPITAL — helper partagé (fiche, screener, outils)
// Note /100 pondérée : valorisation 25 · rentabilité 25 · croissance 20 ·
// rendement 15 · solidité 15. La note est ramenée sur 100 en ne comptant que
// les critères réellement calculables depuis la base (états financiers annuels
// + dernière cotation + médianes du secteur). Aucun critère inventé.
//   window.tcScoreFromMetrics(metrics, sectorMedians) -> { score, label, components }
//   window.tcSectorMedians(secteur)                   -> { per, pbr }
//   window.tcScoreMaison(ticker)                      -> { ...score, ticker, nom, secteur, exercice }
// Ce n'est pas un conseil d'investissement.
// ============================================================================
(function () {
  'use strict';
  if (window.tcScoreFromMetrics) return;

  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function median(a) {
    var x = (a || []).filter(function (v) { return isFinite(v); }).sort(function (m, n) { return m - n; });
    if (!x.length) return null;
    var i = Math.floor(x.length / 2);
    return x.length % 2 ? x[i] : (x[i - 1] + x[i]) / 2;
  }

  function entOf(t) { return (window.entMap && window.entMap[t]) || {}; }
  function coursOf(t) {
    return (Array.isArray(window.allCours) ? window.allCours : []).find(function (c) { return c && String(c.ticker).toUpperCase() === t; }) || {};
  }
  function finsOf(t) {
    return (Array.isArray(window.allFinancials) ? window.allFinancials : [])
      .filter(function (f) { return f && String(f.ticker).toUpperCase() === t; })
      .sort(function (a, b) { return Number(b.annee || 0) - Number(a.annee || 0); });
  }

  // metrics normalisées d'un titre (mêmes conventions que screener/comparaison)
  function metricsFor(ticker) {
    var t = String(ticker || '').toUpperCase();
    var e = entOf(t), c = coursOf(t), fs = finsOf(t), f = fs[0] || null, f1 = fs[1] || null;
    var cp = num(c.cloture != null ? c.cloture : c.cours);
    var bpa = f ? num(f.bpa) : null;
    var fp = f ? num(f.fonds_propres != null ? f.fonds_propres : f.capitaux_propres) : null;
    var na = (f && num(f.nombre_actions)) || num(e.nombre_actions) || num(e.nb_actions);
    var roe = f ? num(f.roe) : null; if (roe != null && roe <= 1.5) roe *= 100;
    if (roe == null && f && num(f.resultat_net) != null && fp) roe = f.resultat_net / fp * 100;
    var marge = f ? num(f.marge_nette) : null; if (marge != null && marge <= 1.5) marge *= 100;
    if (marge == null && f && num(f.resultat_net) != null && num(f.chiffre_affaires)) marge = f.resultat_net / f.chiffre_affaires * 100;
    var dpa = f ? num(f.dpa) : null;
    var yld = f ? num(f.dividend_yield != null ? f.dividend_yield : f.rendement_dividende) : null;
    if (yld != null && yld <= 1.5) yld *= 100;
    if (yld == null && dpa != null && cp) yld = dpa / cp * 100;
    var dette = f ? num(f.dette_nette != null ? f.dette_nette : f.dettes_financieres) : null;
    var croiss = (f && f1 && num(f.chiffre_affaires) != null && num(f1.chiffre_affaires) && f1.chiffre_affaires)
      ? (f.chiffre_affaires / f1.chiffre_affaires - 1) * 100 : null;
    return {
      ticker: t, nom: e.nom || e.nom_court || t, secteur: e.secteur || '—', exercice: f ? f.annee : null,
      per: (cp != null && bpa != null && bpa > 0) ? cp / bpa : null,
      pbr: (cp != null && fp != null && na && na > 0 && fp > 0) ? cp / (fp / na) : null,
      roe: roe, marge: marge, rdt: yld,
      detteFp: (dette != null && fp) ? dette / fp : null,
      croissance: croiss
    };
  }

  window.tcSectorMedians = function (secteur) {
    var peers = (Array.isArray(window.allEntreprises) ? window.allEntreprises : [])
      .filter(function (e) { return e && e.ticker && (e.secteur || '—') === secteur; })
      .map(function (e) { return metricsFor(String(e.ticker).toUpperCase()); });
    return {
      per: median(peers.map(function (p) { return p.per; }).filter(function (v) { return v != null && v > 0; })),
      pbr: median(peers.map(function (p) { return p.pbr; }).filter(function (v) { return v != null && v > 0; }))
    };
  };

  // metrics : { per, pbr, roe, marge, rdt, detteFp, croissance }
  // med    : { per, pbr }  (médianes secteur, facultatif)
  window.tcScoreFromMetrics = function (m, med) {
    m = m || {}; med = med || {};
    var comps = [];

    // Valorisation /25 — décote vs médiane secteur = bon
    (function () {
      var pts = null, detail = [], parts = 0;
      if (m.per != null && m.per > 0 && med.per) {
        var rp = m.per / med.per;
        detail.push('PER ' + m.per.toFixed(1) + 'x vs médiane ' + med.per.toFixed(1) + 'x');
        pts = (pts || 0) + clamp(1 - (rp - 1), 0, 1.5) / 1.5 * 12.5; parts++;
      }
      if (m.pbr != null && m.pbr > 0 && med.pbr) {
        var rb = m.pbr / med.pbr;
        detail.push('P/B ' + m.pbr.toFixed(2) + 'x vs médiane ' + med.pbr.toFixed(2) + 'x');
        pts = (pts || 0) + clamp(1 - (rb - 1), 0, 1.5) / 1.5 * 12.5; parts++;
      }
      if (pts != null && parts === 1) pts *= 2; // un seul ratio dispo -> ramené sur 25
      comps.push({ k: 'valo', l: 'Valorisation', max: 25, pts: pts, detail: detail.join(' · ') || 'PER / P&B ou médiane secteur indisponibles' });
    })();

    // Rentabilité /25 — ROE (15) + marge nette (10)
    (function () {
      var pts = null, detail = [];
      if (m.roe != null) { detail.push('ROE ' + m.roe.toFixed(1) + ' %'); pts = clamp(m.roe / 20, 0, 1) * 15; }
      if (m.marge != null) { detail.push('marge nette ' + m.marge.toFixed(1) + ' %'); pts = (pts || 0) + clamp(m.marge / 20, 0, 1) * 10; }
      comps.push({ k: 'renta', l: 'Rentabilité', max: 25, pts: pts, detail: detail.join(' · ') || 'ROE / marge indisponibles' });
    })();

    // Croissance /20 — CA YoY
    (function () {
      var pts = null, detail = [];
      if (m.croissance != null) {
        detail.push('CA ' + (m.croissance >= 0 ? '+' : '') + m.croissance.toFixed(1) + ' % sur un an');
        pts = clamp((m.croissance + 5) / 20, 0, 1) * 20;
      }
      comps.push({ k: 'croiss', l: 'Croissance', max: 20, pts: pts, detail: detail.join(' · ') || 'Deux exercices de CA requis' });
    })();

    // Rendement /15
    (function () {
      var pts = null, detail = [];
      if (m.rdt != null) { detail.push('rendement ' + m.rdt.toFixed(2) + ' %'); pts = clamp(m.rdt / 7, 0, 1) * 15; }
      comps.push({ k: 'rdt', l: 'Rendement', max: 15, pts: pts, detail: detail.join(' · ') || 'Dividende / rendement indisponible' });
    })();

    // Solidité /15 — dette nette / FP (moins = mieux)
    (function () {
      var pts = null, detail = [];
      if (m.detteFp != null) { detail.push('dette nette / FP ' + m.detteFp.toFixed(2) + 'x'); pts = clamp(1 - m.detteFp / 1.5, 0, 1) * 15; }
      comps.push({ k: 'solid', l: 'Solidité financière', max: 15, pts: pts, detail: detail.join(' · ') || 'Endettement indisponible' });
    })();

    var scored = comps.filter(function (c) { return c.pts != null; });
    var gotMax = scored.reduce(function (a, c) { return a + c.max; }, 0);
    var gotPts = scored.reduce(function (a, c) { return a + c.pts; }, 0);
    var score = gotMax > 0 ? Math.round(gotPts / gotMax * 100) : null;
    var label = score == null ? '—' : score >= 75 ? 'Solide' : score >= 55 ? 'Correct' : score >= 40 ? 'Fragile' : 'À risque';
    return { score: score, label: label, components: comps, coverage: gotMax };
  };

  window.tcScoreMaison = function (ticker) {
    var m = metricsFor(ticker);
    var med = window.tcSectorMedians(m.secteur);
    var res = window.tcScoreFromMetrics(m, med);
    res.ticker = m.ticker; res.nom = m.nom; res.secteur = m.secteur; res.exercice = m.exercice;
    res.metrics = m; res.medians = med;
    return res;
  };
})();
