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

  // null / '' = donnée absente, jamais 0 : Number(null) vaut 0, et une colonne
  // vide se lisait comme « 0 % de rendement » ou « dette nulle » (15/15 en solidité).
  function num(v) { if (v == null || v === '') return null; var n = Number(v); return isFinite(n) ? n : null; }
  function firstNum() { for (var i = 0; i < arguments.length; i++) { var n = num(arguments[i]); if (n != null) return n; } return null; }
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
  // Seuls les exercices annuels se comparent entre eux : une ligne semestrielle
  // ou trimestrielle (onglet « Intermédiaire ») fausserait ROE, marge, croissance.
  var INTERIM = /^(s[12]|[tq][1-4]|9m|ttm|sem|trim|interm)/i;
  function finsOf(t) {
    return (Array.isArray(window.allFinancials) ? window.allFinancials : [])
      .filter(function (f) { return f && String(f.ticker).toUpperCase() === t && !INTERIM.test(String(f.periode || '')); })
      .sort(function (a, b) { return Number(b.annee || 0) - Number(a.annee || 0); });
  }
  function isFinancial(e) { return /financ|banque|assur/i.test(String((e && (e.secteur || e.sous_secteur)) || '')); }

  // Dernier dividende brut connu : calendrier des dividendes ET colonne dpa des
  // états financiers ; on garde l'exercice le plus récent (calendrier en cas d'égalité).
  function lastDividend(t, fs) {
    var best = null;
    fs.forEach(function (f) {
      var ex = num(f.annee), v = num(f.dpa);
      if (ex != null && v != null && (!best || ex > best.ex)) best = { ex: ex, v: v };
    });
    (Array.isArray(window.allDividendes) ? window.allDividendes : []).forEach(function (r) {
      if (!r || String(r.ticker).toUpperCase() !== t || /annul|suspend/i.test(String(r.statut || ''))) return;
      var ex = num(r.exercice != null ? r.exercice : r.annee), v = num(r.montant);
      if (ex != null && v != null && (!best || ex >= best.ex)) best = { ex: ex, v: v };
    });
    return best;
  }

  // SOURCE UNIQUE des indicateurs par titre : score, comparateur, screener et
  // outils l'utilisent, pour que les quatre affichent les mêmes chiffres.
  // Les colonnes roe / marge_nette / dividend_yield sont déjà en pourcentage.
  function metricsFor(ticker) {
    var t = String(ticker || '').toUpperCase();
    var e = entOf(t), c = coursOf(t), fs = finsOf(t), f = fs[0] || null, f1 = fs[1] || null;
    var cp = num(c.cloture != null ? c.cloture : c.cours);
    var bpa = f ? num(f.bpa) : null;
    var fp = f ? firstNum(f.fonds_propres, f.capitaux_propres) : null;
    var na = firstNum(f && f.nombre_actions, f && f.nb_actions, e.nombre_actions, e.nb_actions);
    var rn = f ? num(f.resultat_net) : null, ca = f ? num(f.chiffre_affaires) : null;
    var roe = f ? num(f.roe) : null;
    if (roe == null && rn != null && fp > 0) roe = rn / fp * 100;
    var marge = f ? num(f.marge_nette) : null;
    if (marge == null && rn != null && ca > 0) marge = rn / ca * 100;
    var yld = f ? firstNum(f.dividend_yield, f.rendement_dividende) : null, yldEx = null;
    if (yld == null) {
      var ld = lastDividend(t, fs);
      if (ld && cp > 0) { yld = ld.v / cp * 100; yldEx = ld.ex; }
    }
    // Dette nette : pour un établissement financier les dépôts sont une dette
    // d'exploitation, le ratio n'a pas de sens (absent → critère non noté).
    var financial = isFinancial(e), dette = null;
    if (f && !financial) {
      dette = num(f.dette_nette);
      if (dette == null) {
        var brute = firstNum(f.dettes_financieres, f.dettes_financieres_total, f.dette_fin, f.emprunts_dettes_financieres);
        var cash = num(f.tresorerie_actif);
        if (brute != null && cash != null) dette = brute - cash;
      }
    }
    var ca1 = f1 ? num(f1.chiffre_affaires) : null;
    var croiss = (ca != null && ca1 > 0 && num(f.annee) - num(f1.annee) === 1) ? (ca / ca1 - 1) * 100 : null;
    return {
      ticker: t, nom: e.nom || e.nom_court || t, secteur: e.secteur || '—', pays: e.pays || '—', financial: financial,
      exercice: f ? num(f.annee) : null,
      provisoire: !!f && f.validation_status != null && f.validation_status !== 'validated',
      cours: cp,
      capi: num(c.capitalisation) || (cp && na ? cp * na : null),
      per: (cp != null && bpa != null && bpa > 0) ? cp / bpa : null,
      pbr: (cp != null && fp != null && na > 0 && fp > 0) ? cp / (fp / na) : null,
      roe: roe, marge: marge, rdt: yld, rdtEx: yldEx,
      detteFp: (dette != null && fp > 0) ? dette / fp : null,
      croissance: croiss
    };
  }
  window.tcMetricsFor = metricsFor;

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
