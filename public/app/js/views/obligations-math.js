// ============================================================================
// Calculs obligataires The Capital (BRVM / UEMOA)
// - échéancier réel à partir de la fiche technique (DC/BR) : périodicité,
//   différé, amortissement constant 1/N, in fine ; à défaut, mode déduit du
//   capital restant cohérent avec le cours coté (signalé comme hypothèse) ;
// - rendement actuariel exact (TRI des flux futurs sur le prix plein coupon
//   couru inclus, base exact/365), brut et net d'impôt ;
// - duration de Macaulay, sensibilité, convexité, durée de vie moyenne ;
// - courbe des taux : ajustement Nelson-Siegel et spline cubique naturelle.
// Utilisable dans le navigateur (window.OBMath) et sous Node (tests).
// ============================================================================
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.OBMath = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var DAY = 86400000;
  function num(v) { if (v == null || v === '') return null; var n = Number(v); return isFinite(n) ? n : null; }
  function toDate(s) { if (!s) return null; var d = new Date(String(s).slice(0, 10) + 'T00:00:00Z'); return isNaN(d) ? null : d; }
  function iso(d) { return d ? d.toISOString().slice(0, 10) : null; }
  function addMonths(d, m) {
    var y = d.getUTCFullYear(), mo = d.getUTCMonth() + m, day = d.getUTCDate();
    var t = new Date(Date.UTC(y, mo, 1));
    var last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(day, last)));
  }
  function years(a, b) { return (b - a) / (365 * DAY); }

  /* ── Lecture de la fiche ─────────────────────────────────────────── */

  function parseFreq(txt) {
    var s = String(txt || '').toLowerCase();
    if (/mensuel/.test(s)) return 12;
    if (/trimestri/.test(s)) return 4;
    if (/semestri/.test(s)) return 2;
    if (/annuel/.test(s)) return 1;
    return null;
  }
  function parseYears(txt) {
    var m = String(txt || '').match(/(\d+(?:[.,]\d+)?)\s*an/i);
    return m ? Number(m[1].replace(',', '.')) : null;
  }
  /* « Après 2 ans de différé, amortissement constant de 1/5 », « IN FINE »,
     « Amortissement constant de 1/5 à partir de la 3e année », « Différé de 06 mois… ». */
  function parseMode(txt) {
    var s = String(txt || '').toLowerCase().replace(/\s+/g, ' ');
    if (!s.trim()) return null;
    if (/in ?fine/.test(s)) return { type: 'in_fine', label: 'In fine' };
    var frac = s.match(/1\s*\/\s*(\d+)/);
    var defer = 0, m;
    if ((m = s.match(/(\d+)\s*ans?\s*de\s*diff[ée]r[ée]/))) defer = +m[1];
    else if ((m = s.match(/diff[ée]r[ée]\s*(?:de\s*)?(\d+)\s*(ans?|mois)/))) defer = m[2] === 'mois' ? +m[1] / 12 : +m[1];
    else if ((m = s.match(/(\d+)\s*(?:e|è|ème|eme)\s*ann[ée]e/))) defer = Math.max(0, +m[1] - 1);
    return {
      type: 'constant',
      n: frac ? +frac[1] : null,
      defer: defer,
      annualAmort: /annuel/.test(s),
      label: s.charAt(0).toUpperCase() + s.slice(1)
    };
  }

  /* ── Échéancier ──────────────────────────────────────────────────── */

  function datesBetween(start, maturity, freq) {
    var step = 12 / freq, out = [], k = 1, d;
    if (!start || !maturity || maturity <= start) return out;
    while (k < 2000) {
      d = addMonths(start, step * k);
      if (d >= maturity || years(d, maturity) < 0.02) { out.push(maturity); break; }
      out.push(d); k++;
    }
    return out;
  }

  function build(dates, vn, rate, rateNet, freq, mode, start) {
    var n = dates.length, amort = new Array(n).fill(0);
    if (!n) return [];
    if (!mode || mode.type === 'in_fine') amort[n - 1] = vn;
    else {
      var cand = [];
      for (var i = 0; i < n; i++) {
        var t = years(start, dates[i]);
        if (mode.annualAmort && freq > 1 && (i + 1) % freq !== 0 && i !== n - 1) continue;
        cand.push({ i: i, t: t });
      }
      var chosen = mode.n ? cand.slice(-Math.min(mode.n, cand.length))
        : cand.filter(function (c) { return c.t > (mode.defer || 0) + 1e-6; });
      if (!chosen.length) chosen = [cand[cand.length - 1] || { i: n - 1 }];
      chosen.forEach(function (c) { amort[c.i] = vn / chosen.length; });
    }
    var rows = [], crd = vn;
    for (var j = 0; j < n; j++) {
      var interet = crd * rate / 100 / freq;
      var interetNet = crd * (rateNet != null ? rateNet : rate) / 100 / freq;
      var a = Math.min(amort[j], crd);
      rows.push({ k: j + 1, date: dates[j], crd0: crd, interet: interet, interetNet: interetNet, amort: a, flux: interet + a, fluxNet: interetNet + a, crd1: crd - a });
      crd -= a;
    }
    return rows;
  }

  function crdAt(rows, vn, when) {
    var c = vn;
    rows.forEach(function (r) { if (r.date <= when) c = r.crd1; });
    return c;
  }

  /* Échéancier d'une ligne. bond : ligne de `obligations` ; fiche : ligne de
     `obligations_caracteristiques` (peut être null) ; settle : date de valeur. */
  function schedule(bond, fiche, settle) {
    /* Une fiche n'est retenue que si son taux correspond à la ligne cotée : un même
       code peut désigner une autre tranche. */
    var tf = num(bond.taux_facial), tb = num(fiche && fiche.taux_brut);
    if (fiche && tf != null && tb != null && Math.abs(tf - tb) > 0.05) fiche = null;
    var rate = tb != null && fiche ? tb : tf;
    var rateNet = num(fiche && fiche.taux_net);
    var vn = num(fiche && fiche.valeur_nominale) || 10000;
    var start = toDate((fiche && fiche.date_jouissance) || bond.date_emission);
    /* Échéance : celle de la cote BRVM ; à défaut, jouissance + durée de la fiche. */
    var maturity = toDate(bond.date_maturite);
    var dur = parseYears(fiche && fiche.duree);
    if (start && dur) maturity = addMonths(start, Math.round(dur * 12));
    else if (start && maturity && iso(maturity).slice(5) === '12-31') {
      /* « 31/12 » de la cote = année tirée du libellé (« 2019-2026 ») : l'échéance réelle
         tombe à la date anniversaire de l'émission cette année-là. */
      var anniv = new Date(Date.UTC(maturity.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
      if (anniv > start) maturity = anniv;
    }
    if (rate == null || !start || !maturity) return null;

    var freq = parseFreq(fiche && fiche.modalite_paiement);
    var source = 'fiche', mode = parseMode(fiche && fiche.mode_remboursement);
    if (!freq) {
      /* Sans fiche : périodicité déduite du dernier paiement connu. */
      var last = num(bond.dernier_paiement_valeur), ratio = last && rate ? last / (vn * rate / 100) : null;
      freq = ratio && ratio > 0.38 && ratio < 0.62 ? 2 : ratio && ratio > 0.18 && ratio < 0.32 ? 4 : 1;
    }
    var dates = datesBetween(start, maturity, freq);
    var rows;
    if (mode) rows = build(dates, vn, rate, rateNet, freq, mode, start);
    else {
      /* Mode inconnu : parmi les modes usuels, celui dont le capital restant
         est le plus proche du cours (les lignes cotent autour du pair). */
      source = 'hypothese';
      var price = num(bond.cours), totalY = Math.max(1, Math.round(years(start, maturity)));
      var cands = [{ type: 'in_fine', label: 'In fine (hypothèse)' }];
      [0, 1, 2, 3].forEach(function (d) { if (totalY - d >= 2) cands.push({ type: 'constant', n: (totalY - d) * freq, defer: d, label: 'Amortissement constant' + (d ? ' après ' + d + ' an' + (d > 1 ? 's' : '') + ' de différé' : '') + ' (hypothèse)' }); });
      var best = null;
      cands.forEach(function (c) {
        var r = build(dates, vn, rate, rateNet, freq, c, start);
        var gap = price ? Math.abs(crdAt(r, vn, settle) - price) : (c.type === 'in_fine' ? 0 : 1);
        if (!best || gap < best.gap - 1e-9) best = { gap: gap, rows: r, mode: c };
      });
      rows = best.rows; mode = best.mode;
    }
    return { rows: rows, vn: vn, rate: rate, rateNet: rateNet, freq: freq, start: start, maturity: maturity, mode: mode, source: source };
  }

  /* ── Échéancier ancré sur le BOC ─────────────────────────────────────
     Le Bulletin Officiel de la Cote publie pour chaque ligne, à chaque séance :
     capital restant dû par titre, périodicité (A/S/T), date et montant net du
     prochain coupon, coupon couru et type d'amortissement (IF in fine, AC
     constant, AD dégressif, ACD constant différé). L'échéancier est calé sur la
     date du prochain coupon et part du capital restant publié ; seul le différé
     d'un ACD encore non amorti reste à supposer (fiche DC/BR sinon). */
  var BOC_TYPE = {
    IF: 'In fine',
    AC: 'Amortissement constant',
    AD: 'Amortissement dégressif',
    ACD: 'Amortissement constant après différé'
  };
  function titleYears(t) {
    var m = String(t || '').match(/((?:19|20)\d{2})\s*[-–\/]\s*((?:19|20)\d{2})/);
    return m ? [+m[1], +m[2]] : null;
  }
  function nearestOnGrid(anchor, step, target) {
    var k = Math.round((target - anchor) / (step * 30.4375 * DAY)), best = null;
    for (var j = k - 2; j <= k + 2; j++) {
      var d = addMonths(anchor, step * j);
      if (!best || Math.abs(d - target) < Math.abs(best - target)) best = d;
    }
    return best;
  }
  function scheduleBoc(bond, fiche, boc) {
    var freq = num(boc.periodicite), next = toDate(boc.echeance_coupon), crdNow = num(boc.valeur_nominale);
    var type = boc.type_amort;
    if (!freq || !next || !(crdNow > 0) || !BOC_TYPE[type]) return null;
    var tf = num(bond && bond.taux_facial), tb = num(fiche && fiche.taux_brut);
    if (fiche && tf != null && tb != null && Math.abs(tf - tb) > 0.05) fiche = null;
    var rate = tb != null && fiche ? tb : tf != null ? tf : num(boc.taux);
    /* Taux variable (« taux de base + spread ») : taux courant déduit du prochain coupon. */
    var rateFromCoupon = false;
    if (rate == null && num(boc.coupon_net) > 0) { rate = num(boc.coupon_net) * freq / crdNow * 100; rateFromCoupon = true; }
    if (rate == null) return null;
    var step = 12 / freq, ty = titleYears(boc.titre || (bond && bond.nom));
    var vn = Math.max(num(fiche && fiche.valeur_nominale) || 10000, crdNow);
    /* Jouissance et échéance, recalées sur la grille des coupons du BOC. */
    var start = toDate((fiche && fiche.date_jouissance) || (bond && bond.date_emission));
    var maturity = toDate(bond && bond.date_maturite);
    var dur = parseYears(fiche && fiche.duree);
    if (start && dur) maturity = addMonths(start, Math.round(dur * 12));
    else if (maturity && start && iso(maturity).slice(5) === '12-31') maturity = new Date(Date.UTC(maturity.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    if (!maturity && ty) maturity = new Date(Date.UTC(ty[1], next.getUTCMonth(), next.getUTCDate()));
    if (!maturity) return null;
    maturity = nearestOnGrid(next, step, maturity);
    if (maturity < next) maturity = next;
    if (!start && ty) start = new Date(Date.UTC(ty[0], next.getUTCMonth(), next.getUTCDate()));
    start = start ? nearestOnGrid(next, step, start) : addMonths(next, -step);
    if (start >= next) start = addMonths(next, -step);
    var dates = datesBetween(start, maturity, freq);
    if (!dates.length) return null;
    var fm = parseMode(fiche && fiche.mode_remboursement);
    var annual = !!(fm && fm.annualAmort);
    var totalY = years(start, maturity);
    /* Différé : fiche ; à défaut, usage des émissions UEMOA (1 an jusqu'à 5 ans,
       2 ans jusqu'à 7 ans, 3 ans au-delà). */
    var defer = 0, deferGuess = false;
    if (type === 'ACD') {
      if (fm && fm.type === 'constant' && (fm.defer || fm.n)) defer = fm.n ? Math.max(0, totalY - fm.n / (annual ? 1 : freq)) : fm.defer;
      else { defer = totalY <= 5.1 ? 1 : totalY <= 7.1 ? 2 : 3; deferGuess = crdNow >= vn - 1e-6; }
    }
    var past = [], fut = [];
    dates.forEach(function (d, i) {
      var t = years(start, d);
      var amortOk = type === 'IF' ? i === dates.length - 1
        : (!annual || freq === 1 || (i + 1) % freq === 0 || i === dates.length - 1) && t > defer + 1e-6;
      (d < next ? past : fut).push({ i: i, ok: amortOk });
    });
    var amort = new Array(dates.length).fill(0);
    /* Futur : capital restant publié réparti sur les échéances d'amortissement restantes. */
    var futAm = fut.filter(function (x) { return x.ok; });
    if (!futAm.length) futAm = [fut[fut.length - 1]];
    if (type === 'AD') {
      /* Dégressif : poids décroissants (dernier = 1, avant-dernier = 2…). */
      var w = futAm.map(function (x, k) { return futAm.length - k; }), sw = w.reduce(function (a, b) { return a + b; }, 0);
      futAm.forEach(function (x, k) { amort[x.i] = crdNow * w[k] / sw; });
    } else futAm.forEach(function (x) { amort[x.i] = crdNow / futAm.length; });
    /* Passé : déjà remboursé (nominal d'origine − restant), réparti à parts égales. */
    var paid = vn - crdNow;
    if (paid > 1e-6) {
      var pastAm = past.filter(function (x) { return x.ok; });
      if (!pastAm.length) pastAm = past.slice(-1);
      if (!pastAm.length) vn = crdNow;
      else pastAm.forEach(function (x) { amort[x.i] = paid / pastAm.length; });
    }
    /* Taux net : rapport du prochain coupon net publié au coupon brut attendu. */
    var gross = crdNow * rate / 100 / freq, cn = num(boc.coupon_net), rateNet = num(fiche && fiche.taux_net);
    var ratio = cn && gross ? cn / gross : null;
    if (ratio != null && ratio > 0.75 && ratio < 1.02) rateNet = rate * Math.min(1, ratio);
    var rows = [], crd = vn;
    for (var j = 0; j < dates.length; j++) {
      var a = Math.min(amort[j], crd);
      var it = crd * rate / 100 / freq, itn = crd * (rateNet != null ? rateNet : rate) / 100 / freq;
      rows.push({ k: j + 1, date: dates[j], crd0: crd, interet: it, interetNet: itn, amort: a, flux: it + a, fluxNet: itn + a, crd1: crd - a });
      crd -= a;
    }
    var label = BOC_TYPE[type] + (type === 'ACD' ? ' (' + (deferGuess ? 'différé supposé de ' : 'différé ') + nf1(defer) + ' an' + (defer > 1 ? 's' : '') + ')' : '');
    return {
      rows: rows, vn: vn, rate: rate, rateNet: rateNet, freq: freq, start: start, maturity: maturity,
      mode: { type: type === 'IF' ? 'in_fine' : 'constant', label: label, boc: type, deferGuess: deferGuess },
      source: 'boc', bocDate: boc.date_seance, crdPublished: crdNow, rateFromCoupon: rateFromCoupon
    };
  }
  function nf1(v) { return String(Math.round(v * 10) / 10).replace('.', ','); }

  /* ── Rendement, duration, convexité ──────────────────────────────── */

  function pv(flows, y) { var s = 0; for (var i = 0; i < flows.length; i++) s += flows[i].cf / Math.pow(1 + y, flows[i].t); return s; }
  function irr(flows, price) {
    if (!flows.length || !(price > 0)) return null;
    var lo = -0.9, hi = 3, flo = pv(flows, lo) - price, fhi = pv(flows, hi) - price;
    if (flo * fhi > 0) return null;
    for (var i = 0; i < 200; i++) {
      var mid = (lo + hi) / 2, fm = pv(flows, mid) - price;
      if (Math.abs(fm) < 1e-9) return mid;
      if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  }

  /* Analyse complète d'une ligne à la date `settle` pour un cours pied de coupon
     `clean` (FCFA par titre) et un coupon couru publié (sinon calculé). */
  function analyze(bond, fiche, settleIso, cleanOverride, boc) {
    var settle = toDate(settleIso) || new Date();
    var sc = (boc && scheduleBoc(bond, fiche, boc)) || schedule(bond, fiche, settle);
    if (!sc || !sc.rows.length) return null;
    var future = sc.rows.filter(function (r) { return r.date > settle; });
    var crd = crdAt(sc.rows, sc.vn, settle);
    var out = { schedule: sc, crd: crd, settle: iso(settle), matured: !future.length };
    if (!future.length) return out;
    var prev = sc.rows.filter(function (r) { return r.date <= settle; }).pop();
    var prevDate = prev ? prev.date : sc.start;
    var accruedCalc = crd * sc.rate / 100 * Math.max(0, (settle - prevDate) / DAY) / 365;
    /* Coupon couru recalculé sur le capital restant (celui publié est parfois établi
       sur le nominal d'origine) ; le chiffre publié est conservé pour information. */
    var accrued = accruedCalc;
    out.accruedPublished = num(boc && boc.coupon_couru != null ? boc.coupon_couru : bond.coupon_couru);
    /* Coupon couru du BOC : établi sur le capital restant, retenu tel quel le jour de sa séance. */
    if (sc.source === 'boc' && boc.coupon_couru != null && String(boc.date_seance).slice(0, 10) === iso(settle)) accrued = num(boc.coupon_couru);
    var clean = cleanOverride != null ? cleanOverride : (num(bond.cours) || num(boc && (boc.cours_jour || boc.cours_reference)));
    out.next = future[0];
    out.accrued = accrued;
    out.life = years(settle, sc.maturity);
    var al = 0; future.forEach(function (r) { al += r.amort * years(settle, r.date); });
    out.averageLife = crd > 0 ? al / crd : null;
    if (!(clean > 0)) return out;
    /* Base du cours : la BRVM cote en FCFA par titre. Après amortissement, une ligne
       peu échangée garde souvent un cours proche du nominal d'origine : il est alors
       lu comme un pourcentage du nominal appliqué au capital restant. Sinon le
       rendement n'est pas significatif. */
    var rCrd = crd > 0 ? clean / crd : null, rVn = clean / sc.vn;
    out.priceBasis = null;
    /* Prix saisi dans le simulateur : pris tel quel, en FCFA par titre. */
    var useNominal = cleanOverride == null && crd < sc.vn - 1 && (rCrd == null || Math.abs(rVn - 1) < Math.abs(rCrd - 1));
    if (cleanOverride != null) out.priceBasis = 'crd';
    else if (!useNominal && rCrd != null && rCrd >= 0.75 && rCrd <= 1.25) out.priceBasis = 'crd';
    else if (useNominal && rVn >= 0.85 && rVn <= 1.15) { out.priceBasis = 'nominal'; clean = rVn * crd; }
    if (!out.priceBasis) { out.priceIssue = 'Cours incohérent avec le capital restant (' + Math.round(clean) + ' FCFA pour ' + Math.round(crd) + ' FCFA restants) : rendement non significatif.'; return out; }
    var dirty = clean + accrued;
    var flows = future.map(function (r) { return { t: years(settle, r.date), cf: r.flux }; });
    var flowsNet = future.map(function (r) { return { t: years(settle, r.date), cf: r.fluxNet }; });
    var y = irr(flows, dirty), yn = irr(flowsNet, dirty);
    out.clean = clean; out.dirty = dirty;
    out.pricePct = crd > 0 ? clean / crd * 100 : null;
    out.quoted = cleanOverride != null ? cleanOverride : (num(bond.cours) || num(boc && (boc.cours_jour || boc.cours_reference)));
    out.ytm = y != null ? y * 100 : null;
    out.ytmNet = yn != null ? yn * 100 : null;
    if (cleanOverride == null && (out.ytm == null || out.ytm < 0 || out.ytm > 25)) {
      out.priceIssue = 'Rendement non significatif (' + (out.ytm == null ? 'incalculable' : out.ytm.toFixed(1).replace('.', ',') + ' %') + ') : le cours coté est probablement ancien ou établi avant le dernier amortissement.';
      out.ytmRaw = out.ytm; out.ytm = null; out.ytmNet = null;
      out.duration = out.modDuration = out.convexity = out.dv01 = null;
    }
    out.currentYield = clean > 0 ? crd * sc.rate / 100 / clean * 100 : null;
    if (sc.rateNet == null) out.ytmNet = null; // pas de taux net publié : pas de rendement net
    if (y != null && (out.ytm != null || cleanOverride != null)) {
      var p = pv(flows, y), mac = 0, cvx = 0;
      flows.forEach(function (f) { var d = f.cf / Math.pow(1 + y, f.t); mac += f.t * d; cvx += f.t * (f.t + 1) * d / Math.pow(1 + y, 2); });
      out.duration = mac / p;
      out.modDuration = out.duration / (1 + y);
      out.convexity = cvx / p;
      out.dv01 = out.modDuration * dirty / 10000; // FCFA par titre pour 1 point de base
    }
    return out;
  }

  /* Prix pied de coupon pour un rendement cible (simulateur). */
  function priceForYield(an, yPct, net) {
    if (!an || !an.schedule) return null;
    var settle = toDate(an.settle);
    var y = yPct / 100, s = 0;
    an.schedule.rows.forEach(function (r) { if (r.date > settle) s += (net ? r.fluxNet : r.flux) / Math.pow(1 + y, years(settle, r.date)); });
    return s - (an.accrued || 0);
  }

  /* ── Courbe des taux ─────────────────────────────────────────────── */

  function nsBasis(t, tau) {
    var x = t / tau, e = Math.exp(-x), f1 = x > 1e-8 ? (1 - e) / x : 1;
    return [1, f1, f1 - e];
  }
  function solve3(A, b) {
    var M = A.map(function (r, i) { return r.concat([b[i]]); });
    for (var c = 0; c < 3; c++) {
      var p = c; for (var r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      var tmp = M[c]; M[c] = M[p]; M[p] = tmp;
      if (Math.abs(M[c][c]) < 1e-12) return null;
      for (var r2 = 0; r2 < 3; r2++) if (r2 !== c) { var f = M[r2][c] / M[c][c]; for (var k = c; k < 4; k++) M[r2][k] -= f * M[c][k]; }
    }
    return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
  }
  /* Nelson-Siegel : τ par balayage, β par moindres carrés. */
  function nelsonSiegel(points) {
    if (points.length < 4) return null;
    var best = null;
    for (var tau = 0.3; tau <= 12; tau += 0.1) {
      var A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
      points.forEach(function (p) { var f = nsBasis(p.x, tau); for (var i = 0; i < 3; i++) { b[i] += f[i] * p.y; for (var j = 0; j < 3; j++) A[i][j] += f[i] * f[j]; } });
      var beta = solve3(A, b);
      if (!beta) continue;
      var sse = 0; points.forEach(function (p) { var f = nsBasis(p.x, tau); var e = p.y - (beta[0] * f[0] + beta[1] * f[1] + beta[2] * f[2]); sse += e * e; });
      if (!best || sse < best.sse) best = { beta: beta, tau: tau, sse: sse };
    }
    if (!best) return null;
    best.rmse = Math.sqrt(best.sse / points.length);
    best.at = function (t) { var f = nsBasis(Math.max(t, 0.01), best.tau); return best.beta[0] * f[0] + best.beta[1] * f[1] + best.beta[2] * f[2]; };
    return best;
  }
  /* Spline cubique naturelle passant par les médianes par tranche de maturité
     (les médianes écartent les lignes isolées aberrantes). */
  function splineCurve(points, bucket) {
    bucket = bucket || 1;
    var groups = {};
    /* Tranches d'un an jusqu'à 10 ans, puis de 3 ans (peu de lignes longues). */
    points.forEach(function (p) { var k = p.x < 10 ? Math.floor(p.x / bucket) : 10 + Math.floor((p.x - 10) / 3) * 3; (groups[k] = groups[k] || []).push(p); });
    var knots = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; }).map(function (k) {
      var g = groups[k], xs = g.map(function (p) { return p.x; }).sort(function (a, b) { return a - b; }), ys = g.map(function (p) { return p.y; }).sort(function (a, b) { return a - b; });
      var med = function (a) { var m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
      return { x: med(xs), y: med(ys), n: g.length };
    });
    if (knots.length < 3) return null;
    var n = knots.length, h = [], al = [], l = [1], mu = [0], z = [0], c = new Array(n).fill(0), b = [], d = [];
    for (var i = 0; i < n - 1; i++) h[i] = knots[i + 1].x - knots[i].x || 1e-6;
    for (var i2 = 1; i2 < n - 1; i2++) al[i2] = 3 / h[i2] * (knots[i2 + 1].y - knots[i2].y) - 3 / h[i2 - 1] * (knots[i2].y - knots[i2 - 1].y);
    for (var i3 = 1; i3 < n - 1; i3++) { l[i3] = 2 * (knots[i3 + 1].x - knots[i3 - 1].x) - h[i3 - 1] * mu[i3 - 1]; mu[i3] = h[i3] / l[i3]; z[i3] = (al[i3] - h[i3 - 1] * z[i3 - 1]) / l[i3]; }
    for (var j = n - 2; j >= 0; j--) { c[j] = (z[j] || 0) - (mu[j] || 0) * c[j + 1]; b[j] = (knots[j + 1].y - knots[j].y) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3; d[j] = (c[j + 1] - c[j]) / (3 * h[j]); }
    return {
      knots: knots,
      at: function (x) {
        if (x <= knots[0].x) return knots[0].y;
        if (x >= knots[n - 1].x) return knots[n - 1].y;
        var k = 0; while (k < n - 2 && x > knots[k + 1].x) k++;
        var dx = x - knots[k].x;
        return knots[k].y + b[k] * dx + c[k] * dx * dx + d[k] * dx * dx * dx;
      }
    };
  }

  return {
    parseFreq: parseFreq, parseMode: parseMode, parseYears: parseYears,
    schedule: schedule, scheduleBoc: scheduleBoc, analyze: analyze, priceForYield: priceForYield, irr: irr,
    nelsonSiegel: nelsonSiegel, splineCurve: splineCurve,
    toDate: toDate, iso: iso
  };
});
