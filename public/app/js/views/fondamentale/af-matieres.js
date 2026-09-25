/* ════════════════════════════════════════════════════════════════════
   af-matieres.js : prix des matières premières et lien avec l'activité.

   Pour une société dont le chiffre d'affaires suit le cours d'une matière
   première (huile de palme, caoutchouc, sucre, pétrole), le prix du mois
   en cours dit à l'avance une bonne part du prochain trimestre publié.
   Ce module convertit les prix mondiaux (FMI, via FRED, en dollars) en
   FCFA — la parité euro/dollar du mois suffit, le FCFA étant arrimé à
   l'euro — puis mesure, sur l'historique de la société, à quel point son
   chiffre d'affaires a réellement suivi ce prix. Rien n'est supposé : si
   le lien n'est pas établi par les chiffres, il est dit non établi.
   ════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var XOF_EUR = 655.957;
  var LB_KG = 2.20462;

  var SERIES = {
    huile_palme: { libelle: 'Huile de palme', court: 'palme', unite: 'FCFA/kg', usd: 'USD/t', versKgUsd: function (v) { return v / 1000; } },
    caoutchouc: { libelle: 'Caoutchouc naturel', court: 'caoutchouc', unite: 'FCFA/kg', usd: 'US cents/lb', versKgUsd: function (v) { return v / 100 * LB_KG; } },
    sucre: { libelle: 'Sucre (cours mondial)', court: 'sucre', unite: 'FCFA/kg', usd: 'US cents/lb', versKgUsd: function (v) { return v / 100 * LB_KG; } },
    cacao: { libelle: 'Cacao', court: 'cacao', unite: 'FCFA/kg', usd: 'USD/t', versKgUsd: function (v) { return v / 1000; } },
    coton: { libelle: 'Coton', court: 'coton', unite: 'FCFA/kg', usd: 'US cents/lb', versKgUsd: function (v) { return v / 100 * LB_KG; } },
    brent: { libelle: 'Pétrole Brent', court: 'Brent', unite: 'FCFA/baril', usd: 'USD/baril', versKgUsd: function (v) { return v; } }
  };

  /* Matière(s) qui déterminent le chiffre d'affaires, et ce qu'il faut
     savoir pour lire le lien correctement. */
  var LIENS = {
    PALC: [{ serie: 'huile_palme', note: 'Palmci vend de l\'huile de palme brute et des régimes : son chiffre d\'affaires suit directement le cours mondial, avec un décalage de quelques semaines.' }],
    SICC: [{ serie: 'huile_palme', note: 'Sicor transforme de l\'huile de palme : le cours mondial pèse autant sur ses achats que sur ses ventes.' }],
    SOGC: [
      { serie: 'caoutchouc', note: 'SOGB tire l\'essentiel de ses ventes du caoutchouc, vendu sur la base du cours de Singapour.' },
      { serie: 'huile_palme', note: 'L\'huile de palme est la seconde activité de SOGB.' }
    ],
    SPHC: [{ serie: 'caoutchouc', note: 'SAPH vend son caoutchouc au cours de Singapour, mais achète aussi celui des planteurs villageois à un prix indexé sur ce même cours : la marge dépend de l\'écart, pas du seul prix.' }],
    SCRC: [{ serie: 'sucre', note: 'Sucrivoire vend surtout sur le marché ivoirien, protégé et à prix encadré : le cours mondial n\'y agit qu\'indirectement, via le prix des importations concurrentes.' }],
    SHEC: [{ serie: 'brent', note: 'Les prix à la pompe sont administrés en Côte d\'Ivoire : le Brent gonfle le chiffre d\'affaires plus qu\'il ne change la marge unitaire.' }],
    TTLC: [{ serie: 'brent', note: 'Les prix à la pompe sont administrés en Côte d\'Ivoire : le Brent gonfle le chiffre d\'affaires plus qu\'il ne change la marge unitaire.' }],
    TTLS: [{ serie: 'brent', note: 'Les prix à la pompe sont administrés au Sénégal : le Brent gonfle le chiffre d\'affaires plus qu\'il ne change la marge unitaire.' }],
    SMBC: [{ serie: 'brent', note: 'SMB fabrique du bitume et des lubrifiants à partir de brut : le Brent fixe le coût de sa matière première.' }]
  };
  var PAR_SOUS_SECTEUR = { caoutchouc: 'caoutchouc', huilerie: 'huile_palme', agriculture: 'huile_palme', sucre: 'sucre', 'distribution pétrolière': 'brent', 'pétrole': 'brent' };

  function fin(v) { return typeof v === 'number' && isFinite(v); }
  function mean(a) { var v = a.filter(fin); return v.length ? v.reduce(function (s, x) { return s + x; }, 0) / v.length : NaN; }

  function liens(ticker, sousSecteur) {
    var t = String(ticker || '').toUpperCase();
    if (LIENS[t]) return LIENS[t];
    var s = PAR_SOUS_SECTEUR[String(sousSecteur || '').toLowerCase()];
    return s ? [{ serie: s, note: '' }] : [];
  }

  /* ── Chargement (une seule fois par session) ─────────────────────── */
  var promesse = null;
  function charger() {
    if (Array.isArray(global.allCommodities) && global.allCommodities.length) return Promise.resolve(global.allCommodities);
    if (promesse) return promesse;
    var get = typeof global.apiGet === 'function' ? global.apiGet('/marche?type=commodities') : Promise.reject(new Error('apiGet indisponible'));
    promesse = get.then(function (r) {
      var rows = Array.isArray(r) ? r : (r && Array.isArray(r.data) ? r.data : []);
      global.allCommodities = rows;
      return rows;
    }).catch(function (e) { promesse = null; throw e; });
    return promesse;
  }
  function charge() { return Array.isArray(global.allCommodities) && global.allCommodities.length > 0; }

  /* ── Séries mensuelles en FCFA ───────────────────────────────────── */
  function serieFcfa(cle) {
    var def = SERIES[cle];
    var rows = Array.isArray(global.allCommodities) ? global.allCommodities : [];
    var fx = {};
    rows.forEach(function (r) { if (r.serie === 'eurusd') fx[String(r.date).slice(0, 7)] = Number(r.valeur); });
    var dernierFx = NaN;
    return rows.filter(function (r) { return r.serie === cle; })
      .map(function (r) { return { mois: String(r.date).slice(0, 7), usd: Number(r.valeur) }; })
      .sort(function (a, b) { return a.mois < b.mois ? -1 : 1; })
      .map(function (p) {
        if (fin(fx[p.mois])) dernierFx = fx[p.mois];
        var eurusd = fin(fx[p.mois]) ? fx[p.mois] : dernierFx;
        return { mois: p.mois, usd: p.usd, fcfa: def && fin(eurusd) ? def.versKgUsd(p.usd) / eurusd * XOF_EUR : NaN };
      })
      .filter(function (p) { return fin(p.usd); });
  }

  function trimestreDe(mois) { var m = Number(mois.slice(5, 7)); return { annee: Number(mois.slice(0, 4)), t: Math.ceil(m / 3) }; }

  /* Moyennes par trimestre et par année civile ; `mois` compte les mois
     disponibles, un trimestre en cours n'est pas confondu avec un trimestre complet. */
  function agreger(points) {
    var trim = {}, an = {};
    points.forEach(function (p) {
      var q = trimestreDe(p.mois), kq = q.annee + '-t' + q.t;
      (trim[kq] = trim[kq] || { annee: q.annee, t: q.t, vals: [] }).vals.push(p.fcfa);
      (an[q.annee] = an[q.annee] || { annee: q.annee, vals: [] }).vals.push(p.fcfa);
    });
    Object.keys(trim).forEach(function (k) { trim[k].moy = mean(trim[k].vals); trim[k].mois = trim[k].vals.length; });
    Object.keys(an).forEach(function (k) { an[k].moy = mean(an[k].vals); an[k].mois = an[k].vals.length; });
    return { trim: trim, an: an };
  }

  function stats(points) {
    if (!points.length) return null;
    var n = points.length, der = points[n - 1];
    var cinq = points.slice(-60).map(function (p) { return p.fcfa; });
    var sous = cinq.filter(function (v) { return v < der.fcfa; }).length;
    return {
      mois: der.mois, dernier: der.fcfa, dernierUsd: der.usd,
      var1m: n > 1 ? der.fcfa / points[n - 2].fcfa - 1 : NaN,
      var12m: n > 12 ? der.fcfa / points[n - 13].fcfa - 1 : NaN,
      var12mUsd: n > 12 ? der.usd / points[n - 13].usd - 1 : NaN,
      moy5: mean(cinq), min5: Math.min.apply(null, cinq), max5: Math.max.apply(null, cinq),
      rang5: cinq.length > 1 ? sous / (cinq.length - 1) : NaN
    };
  }

  /* ── Lien prix → chiffre d'affaires ──────────────────────────────── */
  function regression(paires) {
    var n = paires.length;
    if (n < 3) return { n: n, r: NaN, pente: NaN };
    var mx = mean(paires.map(function (p) { return p.x; })), my = mean(paires.map(function (p) { return p.y; }));
    var sxy = 0, sxx = 0, syy = 0;
    paires.forEach(function (p) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) * (p.x - mx); syy += (p.y - my) * (p.y - my); });
    return { n: n, r: sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN, pente: sxx > 0 ? sxy / sxx : NaN };
  }

  function lecture(reg) {
    if (!fin(reg.r)) return 'non établi';
    var a = Math.abs(reg.r);
    return a >= 0.7 ? 'fort' : a >= 0.4 ? 'modéré' : 'faible';
  }

  /* Variations sur un an du prix moyen et du chiffre d'affaires, période par
     période (trimestre contre même trimestre, année contre année) : la
     saisonnalité propre à chaque trimestre s'annule ainsi d'elle-même. */
  function lienCa(ticker, cle) {
    var C = global.AFCore;
    var agg = agreger(serieFcfa(cle));
    var out = { trimestriel: null, annuel: null, pairesT: [], pairesA: [] };
    if (!C) return out;
    var it = null, a = null;
    try { it = C.intermediaire(ticker); } catch (e) { it = null; }
    try { a = C.analyse(ticker); } catch (e) { a = null; }

    if (it && it.enough) {
      it.annees.forEach(function (y) {
        [1, 2, 3, 4].forEach(function (t) {
          var cur = it.champs.ca[y] && it.champs.ca[y]['t' + t], prev = it.champs.ca[y - 1] && it.champs.ca[y - 1]['t' + t];
          var pc = agg.trim[y + '-t' + t], pp = agg.trim[(y - 1) + '-t' + t];
          if (!cur || !prev || !(prev.valeur > 0) || !(cur.valeur > 0) || !pc || !pp || pc.mois < 3 || pp.mois < 3) return;
          out.pairesT.push({ label: 'T' + t + ' ' + String(y).slice(2), x: pc.moy / pp.moy - 1, y: cur.valeur / prev.valeur - 1 });
        });
      });
    }
    if (a && a.enough) {
      a.rows.forEach(function (r, i) {
        var p = a.rows[i - 1];
        if (!p || p.annee !== r.annee - 1 || !(r.ca > 0) || !(p.ca > 0)) return;
        var pc = agg.an[r.annee], pp = agg.an[p.annee];
        if (!pc || !pp || pc.mois < 12 || pp.mois < 12) return;
        out.pairesA.push({ label: String(r.annee), x: pc.moy / pp.moy - 1, y: r.ca / p.ca - 1 });
      });
    }
    out.trimestriel = regression(out.pairesT);
    out.annuel = regression(out.pairesA);
    out.trimestriel.lecture = lecture(out.trimestriel);
    out.annuel.lecture = lecture(out.annuel);
    return out;
  }

  /* Dernier trimestre de prix connu contre le même trimestre un an plus tôt,
     et ce que la sensibilité observée en déduit pour le chiffre d'affaires —
     seulement si le lien trimestriel est au moins modéré. */
  function signal(ticker, cle, lien) {
    var pts = serieFcfa(cle);
    if (!pts.length) return null;
    var agg = agreger(pts);
    var der = trimestreDe(pts[pts.length - 1].mois);
    var cur = agg.trim[der.annee + '-t' + der.t], prev = agg.trim[(der.annee - 1) + '-t' + der.t];
    if (!cur || !prev) return null;
    var prevComparable = prev.vals.slice(0, cur.mois);
    var dPrix = cur.moy / mean(prevComparable) - 1;
    var reg = lien && lien.trimestriel && Math.abs(lien.trimestriel.r) >= 0.4 && lien.trimestriel.n >= 4 ? lien.trimestriel
      : (lien && lien.annuel && Math.abs(lien.annuel.r) >= 0.4 && lien.annuel.n >= 4 ? lien.annuel : null);
    return {
      label: 'T' + der.t + ' ' + der.annee, moisConnus: cur.mois,
      dPrix: dPrix,
      dCaIndicatif: reg && fin(reg.pente) ? reg.pente * dPrix : NaN,
      base: reg === (lien && lien.trimestriel) ? 'trimestrielle' : (reg ? 'annuelle' : null)
    };
  }

  /* Titres cotés dont le chiffre d'affaires dépend de la matière `cle`
     (table LIENS, puis sous-secteur pour un titre qui n'y figure pas). */
  function titresLies(cle) {
    var ents = Array.isArray(global.allEntreprises) ? global.allEntreprises : [];
    var vus = {}, out = [];
    Object.keys(LIENS).forEach(function (t) {
      LIENS[t].forEach(function (l, rang) { if (l.serie === cle) { vus[t] = 1; out.push({ ticker: t, principal: rang === 0, note: l.note }); } });
    });
    ents.forEach(function (e) {
      var t = String(e && e.ticker || '').toUpperCase();
      if (!t || vus[t]) return;
      liens(t, e.sous_secteur).forEach(function (l, rang) { if (l.serie === cle) { vus[t] = 1; out.push({ ticker: t, principal: rang === 0, note: l.note }); } });
    });
    return out;
  }

  global.AFMatieres = {
    SERIES: SERIES, liens: liens, titresLies: titresLies, charger: charger, charge: charge,
    serieFcfa: serieFcfa, agreger: agreger, stats: stats, lienCa: lienCa, signal: signal
  };
})(typeof window !== 'undefined' ? window : globalThis);
