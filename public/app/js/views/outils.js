// ============================================================================
// OUTILS & SIMULATEURS  (P0 roadmap — parité RichBourse « simulateurs »)
// Quatre outils autonomes, une seule vue à onglets :
//   1. Intérêts composés (épargne / capitalisation)
//   2. Rendement obligataire (coupon, rendement courant, rendement à l'échéance)
//   3. Fourchette de fluctuation BRVM (plancher / plafond du jour)
//   4. Score maison The Capital (note /100 depuis les ratios réels de la base)
// Les trois premiers sont des calculs purs. Le 4e lit allCours / allFinancials /
// allEntreprises. Aucune donnée inventée : ratio absent = non noté.
// ============================================================================
(function () {
  'use strict';
  if (window.__TC_OUTILS_V1__) return;
  window.__TC_OUTILS_V1__ = true;

  var TAB = 'compose';

  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }
  function nf(v, dec) {
    var n = Number(v); if (!isFinite(n)) return '—';
    return n.toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 0 : dec });
  }
  function money(v) { var n = Number(v); return isFinite(n) ? nf(Math.round(n)) + ' FCFA' : '—'; }
  function pct(v, dec) { var n = Number(v); return isFinite(n) ? (n > 0 ? '+' : '') + nf(n, dec == null ? 2 : dec) + ' %' : '—'; }
  function g(id) { return document.getElementById(id); }
  function val(id, dflt) { var e = g(id); var n = e ? Number(e.value) : NaN; return isFinite(n) ? n : dflt; }
  function median(a) {
    var x = a.filter(function (v) { return isFinite(v); }).sort(function (m, n) { return m - n; });
    if (!x.length) return null;
    var i = Math.floor(x.length / 2);
    return x.length % 2 ? x[i] : (x[i - 1] + x[i]) / 2;
  }

  // ---------------------------------------------------------------- CSS
  function injectCss() {
    if (g('tc-outils-css')) return;
    var s = document.createElement('style');
    s.id = 'tc-outils-css';
    s.textContent = [
      '#view-outils .ou-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}',
      '#view-outils .ou-tab{background:var(--surface);border:1px solid rgba(245,240,232,.14);color:var(--muted,rgba(245,240,232,.6));border-radius:8px;padding:8px 14px;font:inherit;font-size:13px;cursor:pointer}',
      '#view-outils .ou-tab.active{background:var(--gold);color:#1a1408;border-color:var(--gold);font-weight:700}',
      '#view-outils .ou-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}',
      '#view-outils .ou-field{display:flex;flex-direction:column;gap:4px}',
      '#view-outils .ou-field label{font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--gold)}',
      '#view-outils .ou-field input,#view-outils .ou-field select{background:var(--surface);border:1px solid rgba(245,240,232,.16);color:var(--cream);border-radius:8px;padding:9px 10px;font:inherit}',
      '#view-outils .ou-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:16px 0}',
      '#view-outils .ou-kpi{background:var(--card);border:1px solid rgba(245,240,232,.09);border-radius:10px;padding:13px 15px}',
      '#view-outils .ou-kpi .k{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim)}',
      '#view-outils .ou-kpi .v{font-family:var(--mono,monospace);font-size:19px;margin-top:5px;font-variant-numeric:tabular-nums}',
      '#view-outils .pos{color:var(--green,#4ADE80)}#view-outils .neg{color:var(--red,#F87171)}',
      '#view-outils table{width:100%;border-collapse:collapse;font-size:13px}',
      '#view-outils th,#view-outils td{text-align:left;padding:7px 10px;border-bottom:1px solid rgba(245,240,232,.08)}',
      '#view-outils td.r,#view-outils th.r{text-align:right;font-variant-numeric:tabular-nums}',
      '#view-outils .ou-note{font-size:12px;line-height:1.6;color:var(--muted,rgba(245,240,232,.6))}',
      '#view-outils .ou-gauge{height:14px;border-radius:7px;background:rgba(245,240,232,.1);overflow:hidden;margin:6px 0}',
      '#view-outils .ou-gauge>i{display:block;height:100%;background:linear-gradient(90deg,#F87171,#F0A72A,#4ADE80)}',
      '#view-outils .ou-score{font-family:var(--serif,serif);font-size:44px;line-height:1}',
      '#view-outils .ou-err{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.4);color:var(--red,#F87171);padding:10px 12px;border-radius:8px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ====================================================== 1. INTÉRÊTS COMPOSÉS
  function composeForm() {
    return '<form class="ou-form" id="ouComposeForm">'
      + field('ouCapital', 'Capital de départ (FCFA)', 'number', '500000', 'min="0" step="1000"')
      + field('ouPmt', 'Versement périodique (FCFA)', 'number', '25000', 'min="0" step="1000"')
      + field('ouRate', 'Taux annuel (%)', 'number', '6', 'min="0" max="50" step="0.1"')
      + field('ouYears', 'Durée (années)', 'number', '10', 'min="1" max="60" step="1"')
      + '<div class="ou-field"><label for="ouFreq">Fréquence de versement</label><select id="ouFreq"><option value="12">Mensuelle</option><option value="4">Trimestrielle</option><option value="1">Annuelle</option></select></div>'
      + '<div class="ou-field"><label>&nbsp;</label><button type="submit" class="ou-tab active" style="cursor:pointer">Calculer</button></div>'
      + '</form><div id="ouComposeOut"></div>';
  }
  function runCompose() {
    var P = Math.max(0, val('ouCapital', 0));
    var PMT = Math.max(0, val('ouPmt', 0));
    var r = Math.max(0, val('ouRate', 0)) / 100;
    var Y = Math.max(1, Math.round(val('ouYears', 1)));
    var m = Math.round(val('ouFreq', 12));
    var i = r / m, n = m * Y;
    var fv = P * Math.pow(1 + i, n) + (i > 0 ? PMT * ((Math.pow(1 + i, n) - 1) / i) : PMT * n);
    var contrib = P + PMT * n;
    var interest = fv - contrib;

    var rows = '', bal = P;
    for (var y = 1; y <= Y; y++) {
      var start = bal, yContrib = 0;
      for (var k = 0; k < m; k++) { bal = bal * (1 + i) + PMT; yContrib += PMT; }
      rows += '<tr><td>Année ' + y + '</td><td class="r">' + money(start) + '</td><td class="r">' + money(yContrib) + '</td>'
        + '<td class="r">' + money(bal - start - yContrib) + '</td><td class="r">' + money(bal) + '</td></tr>';
    }

    g('ouComposeOut').innerHTML = ''
      + '<div class="ou-kpis">'
      + kpi('Valeur finale', money(fv))
      + kpi('Total versé', money(contrib))
      + kpi('Intérêts cumulés', money(interest), 'pos')
      + kpi('Multiple du capital', contrib > 0 ? (fv / contrib).toFixed(2) + '×' : '—')
      + '</div>'
      + '<div class="card"><div class="card-header"><div class="card-title">Détail annuel</div></div><div class="card-body" style="overflow-x:auto">'
      + '<table><thead><tr><th>Période</th><th class="r">Capital initial</th><th class="r">Versements</th><th class="r">Intérêts</th><th class="r">Capital fin</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<p class="ou-note" style="margin-top:10px">Intérêts composés à fréquence ' + (m === 12 ? 'mensuelle' : m === 4 ? 'trimestrielle' : 'annuelle') + ', versements en fin de période, taux constant. Hors fiscalité et frais.</p>'
      + '</div></div>';
  }

  // ====================================================== 2. RENDEMENT OBLIGATAIRE
  function bondForm() {
    return '<form class="ou-form" id="ouBondForm">'
      + field('ouNominal', 'Valeur nominale (FCFA)', 'number', '10000', 'min="1" step="100"')
      + field('ouPrice', "Prix d'achat (% du pair)", 'number', '98', 'min="1" max="200" step="0.01"')
      + field('ouCoupon', 'Taux de coupon annuel (%)', 'number', '6.25', 'min="0" max="30" step="0.01"')
      + '<div class="ou-field"><label for="ouCpnFreq">Périodicité du coupon</label><select id="ouCpnFreq"><option value="1">Annuelle</option><option value="2">Semestrielle</option><option value="4">Trimestrielle</option></select></div>'
      + field('ouMaturity', "Maturité résiduelle (années)", 'number', '5', 'min="0.5" max="30" step="0.5"')
      + '<div class="ou-field"><label>&nbsp;</label><button type="submit" class="ou-tab active" style="cursor:pointer">Calculer</button></div>'
      + '</form><div id="ouBondOut"></div>';
  }
  function runBond() {
    var N = Math.max(1, val('ouNominal', 10000));
    var pricePct = Math.max(0.01, val('ouPrice', 100));
    var c = Math.max(0, val('ouCoupon', 0)) / 100;
    var f = Math.round(val('ouCpnFreq', 1));
    var years = Math.max(0.5, val('ouMaturity', 1));
    var PV = pricePct / 100 * N;
    var annualCoupon = c * N;
    var couponPerPeriod = annualCoupon / f;
    var current = PV > 0 ? annualCoupon / PV : null;
    // Rendement à l'échéance — approximation analytique (yield-to-maturity)
    var ytm = (annualCoupon + (N - PV) / years) / ((N + PV) / 2);
    var totalCoupons = annualCoupon * years;
    var gainCapital = N - PV;

    g('ouBondOut').innerHTML = ''
      + '<div class="ou-kpis">'
      + kpi('Prix payé', money(PV))
      + kpi('Coupon annuel', money(annualCoupon))
      + kpi('Coupon par échéance', money(couponPerPeriod))
      + kpi('Rendement courant', pct(current * 100), current >= 0 ? 'pos' : '')
      + kpi("Rendement à l'échéance (approx.)", pct(ytm * 100), ytm >= 0 ? 'pos' : 'neg')
      + kpi('Gain / perte en capital', money(gainCapital), gainCapital >= 0 ? 'pos' : 'neg')
      + '</div>'
      + '<div class="card"><div class="card-body">'
      + '<table><tbody>'
      + '<tr><td>Total des coupons sur la période</td><td class="r">' + money(totalCoupons) + '</td></tr>'
      + '<tr><td>Remboursement au pair à l\'échéance</td><td class="r">' + money(N) + '</td></tr>'
      + '<tr><td>Flux total attendu</td><td class="r">' + money(totalCoupons + N) + '</td></tr>'
      + '<tr><td>Gain total (flux − prix payé)</td><td class="r">' + money(totalCoupons + N - PV) + '</td></tr>'
      + '</tbody></table>'
      + '<p class="ou-note" style="margin-top:10px">Le <b>rendement courant</b> = coupon annuel / prix payé. Le <b>rendement à l\'échéance</b> utilise l\'approximation ( C + (VN − prix)/n ) / ( (VN + prix)/2 ) — pas de calcul actuariel exact ni de prise en compte du réinvestissement des coupons. Hors fiscalité, frais et risque de défaut.</p>'
      + '</div></div>';
  }

  // ====================================================== 3. FOURCHETTE BRVM
  function bandForm() {
    var opts = '';
    var comps = companyList();
    if (comps.length) opts = '<option value="">— saisir manuellement —</option>' + comps.map(function (c) {
      return '<option value="' + esc(c.ref) + '">' + esc(c.ticker) + (c.nom ? ' — ' + esc(c.nom) : '') + '</option>';
    }).join('');
    return '<form class="ou-form" id="ouBandForm">'
      + (opts ? '<div class="ou-field"><label for="ouBandTicker">Reprendre le cours d\'une valeur</label><select id="ouBandTicker">' + opts + '</select></div>' : '')
      + field('ouRef', 'Cours de référence (FCFA)', 'number', '10000', 'min="1" step="1"')
      + field('ouLimit', 'Limite quotidienne (%)', 'number', '7.5', 'min="0.5" max="20" step="0.5"')
      + '<div class="ou-field"><label>&nbsp;</label><button type="submit" class="ou-tab active" style="cursor:pointer">Calculer</button></div>'
      + '</form><div id="ouBandOut"></div>';
  }
  function runBand() {
    var ref = Math.max(0, val('ouRef', 0));
    var lim = Math.max(0.5, val('ouLimit', 7.5)) / 100;
    if (!ref) { g('ouBandOut').innerHTML = '<div class="ou-err">Renseignez un cours de référence.</div>'; return; }
    var floor = ref * (1 - lim), ceil = ref * (1 + lim);
    g('ouBandOut').innerHTML = ''
      + '<div class="ou-kpis">'
      + kpi('Plancher du jour', money(floor), 'neg')
      + kpi('Cours de référence', money(ref))
      + kpi('Plafond du jour', money(ceil), 'pos')
      + kpi('Amplitude autorisée', money(ceil - floor))
      + '</div>'
      + '<p class="ou-note">À la BRVM, la variation d\'un cours sur une séance est encadrée par une limite (± ' + nf(lim * 100, 1) + ' % ici, valeur usuelle pour les actions). Un ordre exécuté hors de cette fourchette est refusé ; au-delà, la cotation peut être réservée à la hausse ou à la baisse. Vérifiez la limite en vigueur pour la valeur concernée.</p>';
  }

  // ====================================================== 4. SCORE MAISON
  function companyList() {
    return (Array.isArray(window.allEntreprises) ? window.allEntreprises : [])
      .filter(function (e) { return e && e.ticker && e.actif !== false; })
      .map(function (e) { return { ticker: String(e.ticker).toUpperCase(), nom: e.nom || e.nom_court || '', ref: String(e.ticker).toUpperCase() }; })
      .sort(function (a, b) { return a.ticker.localeCompare(b.ticker); });
  }
  function ent(t) { return (window.entMap && window.entMap[t]) || {}; }
  function coursOf(t) { return (Array.isArray(window.allCours) ? window.allCours : []).find(function (c) { return c && String(c.ticker).toUpperCase() === t; }) || {}; }
  function finsOf(t) {
    return (Array.isArray(window.allFinancials) ? window.allFinancials : [])
      .filter(function (f) { return f && String(f.ticker).toUpperCase() === t; })
      .sort(function (a, b) { return Number(b.annee || 0) - Number(a.annee || 0); });
  }
  function snapshot(t) {
    var e = ent(t), c = coursOf(t), fs = finsOf(t), f = fs[0] || null, f1 = fs[1] || null;
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
    var croiss = (f && f1 && num(f.chiffre_affaires) != null && num(f1.chiffre_affaires) && f1.chiffre_affaires) ? (f.chiffre_affaires / f1.chiffre_affaires - 1) * 100 : null;
    return {
      ticker: t, nom: e.nom || e.nom_court || t, secteur: e.secteur || '—',
      per: (cp != null && bpa != null && bpa > 0) ? cp / bpa : null,
      pbr: (cp != null && fp != null && na && na > 0 && fp > 0) ? cp / (fp / na) : null,
      roe: roe, marge: marge, rdt: yld,
      detteFp: (dette != null && fp) ? dette / fp : null,
      croissance: croiss, exercice: f ? f.annee : null
    };
  }
  function sectorMedians(secteur) {
    var peers = (Array.isArray(window.allEntreprises) ? window.allEntreprises : [])
      .filter(function (e) { return e && e.ticker && (e.secteur || '—') === secteur; })
      .map(function (e) { return snapshot(String(e.ticker).toUpperCase()); });
    return {
      per: median(peers.map(function (p) { return p.per; }).filter(function (v) { return v != null && v > 0; })),
      pbr: median(peers.map(function (p) { return p.pbr; }).filter(function (v) { return v != null && v > 0; }))
    };
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function scoreForm() {
    var comps = companyList();
    var opts = comps.map(function (c) { return '<option value="' + esc(c.ref) + '">' + esc(c.ticker) + (c.nom ? ' — ' + esc(c.nom) : '') + '</option>'; }).join('');
    return '<form class="ou-form" id="ouScoreForm">'
      + '<div class="ou-field"><label for="ouScoreTicker">Valeur</label><select id="ouScoreTicker">' + (opts || '<option value="">—</option>') + '</select></div>'
      + '<div class="ou-field"><label>&nbsp;</label><button type="submit" class="ou-tab active" style="cursor:pointer">Noter</button></div>'
      + '</form><div id="ouScoreOut"></div>';
  }
  function runScore() {
    var t = g('ouScoreTicker') ? String(g('ouScoreTicker').value || '').toUpperCase() : '';
    var out = g('ouScoreOut');
    if (!t) { out.innerHTML = '<div class="ou-err">Sélectionnez une valeur.</div>'; return; }
    var s = snapshot(t);
    var med = sectorMedians(s.secteur);

    var comps = [];
    // Valorisation /25 — décote vs médiane secteur = bon
    (function () {
      var pts = null, detail = [];
      if (s.per != null && s.per > 0 && med.per) { var rp = s.per / med.per; detail.push('PER ' + s.per.toFixed(1) + 'x vs médiane ' + med.per.toFixed(1) + 'x'); pts = clamp(1 - (rp - 1), 0, 1.5) / 1.5 * 12.5; }
      if (s.pbr != null && s.pbr > 0 && med.pbr) { var rb = s.pbr / med.pbr; detail.push('P/B ' + s.pbr.toFixed(2) + 'x vs médiane ' + med.pbr.toFixed(2) + 'x'); var p2 = clamp(1 - (rb - 1), 0, 1.5) / 1.5 * 12.5; pts = pts == null ? p2 * 2 : pts + p2; }
      comps.push({ l: 'Valorisation', max: 25, pts: pts, detail: detail.join(' · ') || 'PER / P&B ou médiane secteur indisponibles' });
    })();
    // Rentabilité /25 — ROE + marge
    (function () {
      var pts = null, detail = [];
      if (s.roe != null) { detail.push('ROE ' + s.roe.toFixed(1) + ' %'); pts = clamp(s.roe / 20, 0, 1) * 15; }
      if (s.marge != null) { detail.push('marge nette ' + s.marge.toFixed(1) + ' %'); var p2 = clamp(s.marge / 20, 0, 1) * 10; pts = pts == null ? p2 : pts + p2; }
      comps.push({ l: 'Rentabilité', max: 25, pts: pts, detail: detail.join(' · ') || 'ROE / marge indisponibles' });
    })();
    // Croissance /20 — CA YoY
    (function () {
      var pts = null, detail = [];
      if (s.croissance != null) { detail.push('CA ' + (s.croissance >= 0 ? '+' : '') + s.croissance.toFixed(1) + ' % sur un an'); pts = clamp((s.croissance + 5) / 20, 0, 1) * 20; }
      comps.push({ l: 'Croissance', max: 20, pts: pts, detail: detail.join(' · ') || 'Deux exercices de CA requis' });
    })();
    // Rendement /15
    (function () {
      var pts = null, detail = [];
      if (s.rdt != null) { detail.push('rendement ' + s.rdt.toFixed(2) + ' %'); pts = clamp(s.rdt / 7, 0, 1) * 15; }
      comps.push({ l: 'Rendement', max: 15, pts: pts, detail: detail.join(' · ') || 'Dividende / rendement indisponible' });
    })();
    // Solidité /15 — dette / FP
    (function () {
      var pts = null, detail = [];
      if (s.detteFp != null) { detail.push('dette nette / FP ' + s.detteFp.toFixed(2) + 'x'); pts = clamp(1 - s.detteFp / 1.5, 0, 1) * 15; }
      comps.push({ l: 'Solidité financière', max: 15, pts: pts, detail: detail.join(' · ') || 'Endettement indisponible' });
    })();

    var scored = comps.filter(function (c) { return c.pts != null; });
    var gotMax = scored.reduce(function (a, c) { return a + c.max; }, 0);
    var gotPts = scored.reduce(function (a, c) { return a + c.pts; }, 0);
    var score = gotMax > 0 ? Math.round(gotPts / gotMax * 100) : null;
    var label = score == null ? '—' : score >= 75 ? 'Solide' : score >= 55 ? 'Correct' : score >= 40 ? 'Fragile' : 'À risque';

    out.innerHTML = ''
      + '<div class="card"><div class="card-body">'
      + '<div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap">'
      + '<span class="ou-score">' + (score == null ? '—' : score) + '</span><span style="color:var(--dim)">/ 100</span>'
      + '<b style="font-size:15px;color:var(--gold)">' + esc(label) + '</b>'
      + '<span class="ou-note">' + esc(s.ticker) + ' · ' + esc(s.nom) + ' · ' + esc(s.secteur) + (s.exercice ? ' · exercice ' + esc(s.exercice) : '') + '</span></div>'
      + '<div class="ou-gauge"><i style="width:' + (score == null ? 0 : score) + '%"></i></div>'
      + '<table style="margin-top:10px"><thead><tr><th>Critère</th><th class="r">Points</th><th>Lecture</th></tr></thead><tbody>'
      + comps.map(function (c) {
        return '<tr><td>' + c.l + '</td><td class="r">' + (c.pts == null ? '<span style="color:var(--dim)">non noté</span>' : c.pts.toFixed(1) + ' / ' + c.max) + '</td><td class="ou-note">' + esc(c.detail) + '</td></tr>';
      }).join('')
      + '</tbody></table>'
      + '<p class="ou-note" style="margin-top:10px">Score The Capital : pondération valorisation 25 · rentabilité 25 · croissance 20 · rendement 15 · solidité 15. La note est ramenée sur 100 <b>en ne comptant que les critères réellement calculables</b> depuis la base (états financiers annuels + dernière cotation + médianes du secteur). Ce n\'est pas un conseil d\'investissement.</p>'
      + '</div></div>';
  }

  // ---------------------------------------------------------------- shared
  function field(id, label, type, dflt, attrs) {
    return '<div class="ou-field"><label for="' + id + '">' + label + '</label>'
      + '<input type="' + type + '" id="' + id + '" value="' + dflt + '" ' + (attrs || '') + '></div>';
  }
  function kpi(k, v, cls) { return '<div class="ou-kpi"><div class="k">' + esc(k) + '</div><div class="v ' + (cls || '') + '">' + v + '</div></div>'; }

  var TOOLS = [
    { id: 'compose', label: 'Intérêts composés', form: composeForm, run: runCompose, formId: 'ouComposeForm' },
    { id: 'bond', label: 'Rendement obligataire', form: bondForm, run: runBond, formId: 'ouBondForm' },
    { id: 'band', label: 'Fourchette BRVM', form: bandForm, run: runBand, formId: 'ouBandForm' },
    { id: 'score', label: 'Score maison', form: scoreForm, run: runScore, formId: 'ouScoreForm' }
  ];

  function mountTool() {
    var host = g('ouBody');
    var tool = TOOLS.find(function (t) { return t.id === TAB; }) || TOOLS[0];
    host.innerHTML = '<div class="card"><div class="card-body">' + tool.form() + '</div></div>';
    var form = g(tool.formId);
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); try { tool.run(); } catch (err) { console.error('[OUTILS]', err); } });
    // valeur → cours de référence (fourchette)
    var bandSel = g('ouBandTicker');
    if (bandSel) bandSel.addEventListener('change', function () {
      var c = coursOf(String(this.value || '').toUpperCase());
      var cp = num(c.cloture != null ? c.cloture : c.cours);
      if (cp && g('ouRef')) g('ouRef').value = Math.round(cp);
    });
  }

  function render() {
    var view = g('view-outils');
    if (!view) return;
    injectCss();
    view.innerHTML = ''
      + '<div class="page-header"><h1>Outils <span style="color:var(--gold)">&amp; Simulateurs</span></h1>'
      + '<p>Calculateurs d\'épargne et d\'obligations, fourchette de cotation BRVM, et note maison The Capital à partir des données de la base.</p></div>'
      + '<div class="ou-tabs">' + TOOLS.map(function (t) {
        return '<button type="button" class="ou-tab' + (t.id === TAB ? ' active' : '') + '" data-ou="' + t.id + '">' + esc(t.label) + '</button>';
      }).join('') + '</div>'
      + '<div id="ouBody"></div>';
    view.querySelectorAll('[data-ou]').forEach(function (b) {
      b.addEventListener('click', function () { TAB = b.getAttribute('data-ou'); render(); });
    });
    mountTool();
  }

  window.renderOutils = render;
})();
