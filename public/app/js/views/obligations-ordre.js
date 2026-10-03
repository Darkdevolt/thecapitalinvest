// ============================================================================
// THE CAPITAL — Simulateur d'ordre obligataire (formule Professional)
// ----------------------------------------------------------------------------
// Reproduit la fiche « SIMULATION » d'une SGI : intérêts courus ACT/ACT,
// montant de l'opération, commission SGI, apporteur d'affaires, TAF,
// commissions BRVM/DC-BR, prix TTC et rendement actuariel frais inclus.
// Taux par défaut fournis par le serveur ; chaque professionnel peut les
// remplacer par les siens et masquer des lignes (réglages conservés sur son
// appareil).
// ============================================================================
(function (w) {
  'use strict';
  if (w.TCOrdreObligataire) return;

  var DEFAULTS = {
    commission_sgi_pct: 0.9, commission_sgi_libelle: 'Commission SGI',
    taf_pct: 17, taf_sur_apporteur: false,
    apporteur_par_titre: 200, apporteur_actif: true,
    brvm_dcbr_pct: 0.11692125, brvm_dcbr_base: 'nominal', brvm_dcbr_actif: true,
    delai_reglement_jours: 2, masquer: []
  };
  var STORE = 'tc_ordre_oblig_v1';
  var XLSX_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  var DAY = 86400000;

  /* Lignes de la fiche, dans l'ordre du modèle. sec : bloc d'affichage. */
  var LINES = [
    { k: 'designation', l: 'Désignation', f: 'text', sec: 'titre' },
    { k: 'code', l: 'Code symbole', f: 'text', sec: 'titre' },
    { k: 'quantite', l: 'Quantité', f: 'int', sec: 'titre' },
    { k: 'vn', l: 'Valeur nominale unitaire', f: 'int', sec: 'titre' },
    { k: 'crd', l: 'Capital restant dû par titre', f: 'int', sec: 'titre', optional: true },
    { k: 'coupon', l: 'Coupon', f: 'pct', sec: 'titre' },
    { k: 'prix', l: 'Prix pied de coupon', f: 'int', sec: 'titre' },
    { k: 'prix_pct', l: 'Prix pied de coupon %', f: 'pct', sec: 'titre' },
    { k: 'date_transaction', l: 'Date de transaction', f: 'date', sec: 'titre' },
    { k: 'date_valeur', l: 'Date de valeur estimée', f: 'date', sec: 'titre' },
    { k: 'echeance', l: "Date d'échéance", f: 'date', sec: 'titre' },
    { k: 'maturite', l: 'Maturité résiduelle (en années)', f: 'dec', sec: 'titre' },
    { k: 'interets_courus', l: 'Intérêts courus', f: 'int', sec: 'titre' },
    { k: 'taux_couru', l: "Taux d'intérêts courus", f: 'pct', sec: 'titre' },
    { k: 'prix_cc', l: 'Prix coupons courus inclus', f: 'pct', sec: 'titre' },
    { k: 'montant_operation', l: "Montant de l'opération", f: 'int', sec: 'titre' },
    { k: 'commission_sgi', l: null, f: 'int', sec: 'frais' },
    { k: 'apporteur', l: null, f: 'int', sec: 'frais' },
    { k: 'taf', l: null, f: 'int', sec: 'frais' },
    { k: 'brvm_dcbr', l: 'Commissions BRVM/DCBR', f: 'int', sec: 'frais' },
    { k: 'total_commissions', l: 'Total commissions', f: 'int', sec: 'frais', strong: true },
    { k: 'taux_commissions', l: 'Taux commissions', f: 'pct', sec: 'synthese' },
    { k: 'prix_ttc', l: "Prix de l'obligation TTC", f: 'pct', sec: 'synthese' },
    { k: 'ytm', l: 'Yield to maturity (YTM)', f: 'pct', sec: 'synthese', hint: 'TRI des flux, frais inclus' },
    { k: 'ytm_brut', l: 'Rendement actuariel hors frais', f: 'pct', sec: 'synthese' },
    { k: 'ytm_net', l: "Rendement actuariel net d'impôt (hors frais)", f: 'pct', sec: 'synthese', optional: true },
    { k: 'montant', l: 'Montant', f: 'int', sec: 'total' }
  ];

  /* Lignes « paramètres » du modèle Excel complet. */
  var PARAM_ROWS = [
    ['commission_sgi_pct', 'Commission SGI (%)', 'num'],
    ['commission_sgi_libelle', 'Libellé de la commission SGI', 'text'],
    ['apporteur_par_titre', "Commission apporteur d'affaires (FCFA par titre)", 'num'],
    ['apporteur_actif', "Apporteur d'affaires inclus (OUI/NON)", 'bool'],
    ['taf_pct', 'TAF (%)', 'num'],
    ['taf_sur_apporteur', "TAF appliquée à l'apporteur (OUI/NON)", 'bool'],
    ['brvm_dcbr_pct', 'Commissions BRVM/DCBR (%)', 'num'],
    ['brvm_dcbr_base', 'Base BRVM/DCBR (NOMINAL/MONTANT)', 'base'],
    ['brvm_dcbr_actif', 'Commissions BRVM/DCBR incluses (OUI/NON)', 'bool'],
    ['delai_reglement_jours', 'Délai de règlement (jours ouvrés)', 'num'],
    ['masquer', 'Lignes masquées (codes séparés par des virgules)', 'list']
  ];

  /* Fiche de référence (modèle SGI). */
  var SAMPLE = {
    designation: 'ETAT DU SENEGAL 6,60% 2025-2030', code: 'EOS.O19', quantite: 200000, vn: 10000,
    coupon: 6.6, prix: 9600, prix_pct: 96, date_transaction: '2026-07-29', date_valeur: '2026-07-31',
    echeance: '2030-04-16', maturite: 3.71, interets_courus: 38229508, taux_couru: 1.91, prix_cc: 97.91,
    montant_operation: 1958229508, commission_sgi: 17624066, apporteur: 40000000, taf: 2996091,
    brvm_dcbr: 2338425, total_commissions: 62958582, taux_commissions: 3.15, prix_ttc: 101.06,
    montant: 2021188090
  };

  // ── utilitaires ───────────────────────────────────────────────────────
  function num(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).replace(/[\s  ]/g, '').replace('%', '').replace(',', '.');
    var n = Number(s); return isFinite(n) ? n : null;
  }
  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function nf(v, dec) { var n = Number(v); return v != null && isFinite(n) ? n.toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }) : '—'; }
  function isoOf(d) { return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
  function dOf(iso) { var d = new Date(String(iso).slice(0, 10) + 'T00:00:00Z'); return isNaN(d) ? null : d; }
  function dLabel(iso) { if (!iso) return '—'; var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function todayIso() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function pctLabel(v) { return String(v).replace('.', ','); }

  function holidaySet(list) {
    var set = {};
    (list || []).forEach(function (d) { if (d) set[String(d).slice(0, 10)] = 1; });
    var mh = w.TC_BRVM_MARKET_HOURS && w.TC_BRVM_MARKET_HOURS.holidays;
    if (mh) Object.keys(mh).forEach(function (d) { set[d] = 1; });
    return set;
  }
  function isBusiness(d, hol) { var wd = d.getUTCDay(); return wd !== 0 && wd !== 6 && !hol[isoOf(d)]; }
  /* Date de transaction + n jours ouvrés BRVM (week-ends et fériés exclus). */
  function addBusinessDays(iso, n, hol) {
    var d = dOf(iso); if (!d) return null;
    var left = Math.max(0, Math.round(n || 0));
    while (left > 0) { d = new Date(d.getTime() + DAY); if (isBusiness(d, hol)) left--; }
    return isoOf(d);
  }
  function businessDaysBetween(a, b, hol) {
    var d = dOf(a), e = dOf(b); if (!d || !e || e <= d) return 0;
    var n = 0; while (d < e) { d = new Date(d.getTime() + DAY); if (isBusiness(d, hol)) n++; }
    return n;
  }

  /* TRI.PAIEMENTS (XIRR) : Σ Fi / (1 + r)^((di − d0) / 365) = 0. */
  function xirr(list) {
    var d0 = dOf(list[0].date);
    var pts = list.map(function (x) { return { t: (dOf(x.date) - d0) / (365 * DAY), v: x.total }; });
    function npv(r) { return pts.reduce(function (s, x) { return s + x.v / Math.pow(1 + r, x.t); }, 0); }
    var lo = -0.99, hi = 5, flo = npv(lo);
    if (pts.length < 2 || flo * npv(hi) > 0) return null;
    for (var i = 0; i < 200; i++) {
      var mid = (lo + hi) / 2, fm = npv(mid);
      if (Math.abs(fm) < 1e-6) return mid;
      if (flo * fm < 0) hi = mid; else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  }

  function mergeParams(base, over) {
    var out = {}, k;
    for (k in DEFAULTS) out[k] = DEFAULTS[k];
    for (k in (base || {})) if (base[k] != null) out[k] = base[k];
    for (k in (over || {})) if (over[k] != null) out[k] = over[k];
    out.masquer = Array.isArray(out.masquer) ? out.masquer.slice() : [];
    return out;
  }

  function labelOf(line, p) {
    if (line.k === 'commission_sgi') return (p.commission_sgi_libelle || 'Commission SGI') + ' (' + pctLabel(p.commission_sgi_pct) + '%)';
    if (line.k === 'apporteur') return "Commission - Apporteur d'affaires (" + nf(p.apporteur_par_titre) + ' FCFA par titre)';
    if (line.k === 'taf') return 'TAF (' + pctLabel(p.taf_pct) + '%)';
    return line.l;
  }

  // ── calcul ────────────────────────────────────────────────────────────
  /* ctx : { o, f, b (lignes obligations / fiche DC-BR / BOC), quantite,
     prix (FCFA par titre, pied de coupon), dateTransaction, dateValeur
     (facultative), joursFeries: [] } ; p : paramètres fusionnés. */
  function compute(ctx, p) {
    var M = w.OBMath;
    if (!M) return { error: 'Moteur de calcul obligataire indisponible.' };
    var qty = Math.max(0, Math.round(num(ctx.quantite) || 0));
    var clean = num(ctx.prix);
    if (!(qty > 0)) return { error: 'Indiquez une quantité.' };
    if (!(clean > 0)) return { error: 'Indiquez un prix pied de coupon.' };
    var hol = holidaySet(ctx.joursFeries);
    var tdate = ctx.dateTransaction || todayIso();
    var vdate = ctx.dateValeur || addBusinessDays(tdate, p.delai_reglement_jours, hol);
    /* Échéance saisie par le professionnel (note d'information) : prime sur
       celle déduite de la cote, l'échéancier est recalé dessus. */
    var bond = ctx.echeance ? Object.assign({}, ctx.o, { date_maturite: ctx.echeance }) : ctx.o;
    var fiche = ctx.echeance && ctx.f ? Object.assign({}, ctx.f, { duree: null }) : ctx.f;
    var an = M.analyze(bond, fiche, vdate, clean, ctx.b);
    if (!an || !an.schedule) return { error: 'Échéancier indisponible pour cette ligne.' };
    if (an.matured) return { error: 'Cette obligation est échue à la date de valeur.' };
    var sc = an.schedule, crd = an.crd, accrued = an.accrued || 0;
    var settle = dOf(vdate);
    /* Comme sur les fiches des SGI : chaque montant est arrondi au franc avant
       d'être additionné (la TAF porte sur la commission arrondie). */
    var R = Math.round;
    var nominalTotal = qty * crd;
    var interets = R(qty * accrued);
    var montantOp = R(qty * clean) + interets;
    var sgi = R((num(p.commission_sgi_pct) || 0) / 100 * montantOp);
    var apporteur = p.apporteur_actif ? R(qty * (num(p.apporteur_par_titre) || 0)) : 0;
    var taf = R((num(p.taf_pct) || 0) / 100 * (sgi + (p.taf_sur_apporteur ? apporteur : 0)));
    var dcbr = p.brvm_dcbr_actif ? R((num(p.brvm_dcbr_pct) || 0) / 100 * (p.brvm_dcbr_base === 'montant' ? montantOp : nominalTotal)) : 0;
    var total = sgi + apporteur + taf + dcbr;
    /* Rendement = TRI des paiements (TRI.PAIEMENTS / XIRR d'Excel) sur les
       flux datés de l'ordre : décaissement du montant total à la date de
       valeur, puis coupons et amortissements perçus sur la quantité. */
    var flux = [{ date: vdate, libelle: 'Règlement (frais inclus)', coupon: 0, amort: 0, crd: R(nominalTotal), total: -(montantOp + total) }];
    sc.rows.filter(function (r) { return r.date > settle; }).forEach(function (r) {
      var c = R(qty * r.interet), a = R(qty * r.amort);
      flux.push({ date: isoOf(r.date), libelle: a > 0 ? 'Coupon + amortissement' : 'Coupon', coupon: c, amort: a, crd: R(qty * r.crd1), total: c + a });
    });
    var yFees = xirr(flux);
    var v = {
      designation: ctx.o.nom || (ctx.f && ctx.f.emetteur) || ctx.o.code,
      code: ctx.o.code, quantite: qty, vn: sc.vn, crd: crd < sc.vn - 0.5 ? crd : null,
      coupon: sc.rate, prix: clean, prix_pct: clean / crd * 100,
      date_transaction: tdate, date_valeur: vdate, echeance: isoOf(sc.maturity),
      maturite: (sc.maturity - settle) / (365 * DAY),
      interets_courus: interets, taux_couru: accrued / crd * 100,
      prix_cc: (clean + accrued) / crd * 100, montant_operation: montantOp,
      commission_sgi: sgi, apporteur: apporteur, taf: taf, brvm_dcbr: dcbr, total_commissions: total,
      taux_commissions: total / nominalTotal * 100,
      prix_ttc: (clean + accrued) / crd * 100 + total / nominalTotal * 100,
      ytm: yFees != null ? yFees * 100 : null, ytm_brut: an.ytm, ytm_net: sc.rateNet != null && an.ytmNet != null && Math.abs(an.ytmNet - an.ytm) > 0.005 ? an.ytmNet : null,
      montant: montantOp + total
    };
    Object.defineProperty(v, 'flux', { value: flux, enumerable: false });
    return { values: v, analysis: an, params: p, businessDays: businessDaysBetween(tdate, vdate, hol) };
  }

  function fmt(line, v) {
    if (v == null || (typeof v === 'number' && !isFinite(v))) return '—';
    if (line.f === 'int') return nf(Math.round(v));
    if (line.f === 'pct') return nf(v, 2) + '%';
    if (line.f === 'dec') return nf(v, 2);
    if (line.f === 'date') return dLabel(v);
    return String(v);
  }
  function visibleLines(values, p) {
    var hide = {}; (p.masquer || []).forEach(function (k) { hide[k] = 1; });
    return LINES.filter(function (l) {
      if (hide[l.k] && l.k !== 'montant') return false;
      if (l.optional && values[l.k] == null) return false;
      if (l.k === 'apporteur' && !p.apporteur_actif) return false;
      if (l.k === 'brvm_dcbr' && !p.brvm_dcbr_actif) return false;
      return true;
    });
  }

  // ── fichier Excel (modèle) ───────────────────────────────────────────
  /* Tableau libellé / valeur au format du modèle, suivi des paramètres. */
  function sheetRows(values, p, withParams) {
    var rows = [['THE CAPITAL — SIMULATION D\'ORDRE OBLIGATAIRE', '']];
    var lines = values === SAMPLE ? LINES.filter(function (l) { return SAMPLE[l.k] != null; }) : visibleLines(values, p);
    var prev = null;
    lines.forEach(function (l) {
      if (prev && prev !== l.sec) rows.push(['', '']);
      prev = l.sec;
      var v = values[l.k];
      if (l.f === 'pct' && v != null) v = Math.round(v * 100) / 10000;          // cellule au format %
      else if (l.f === 'int' && v != null) v = Math.round(v);
      else if (l.f === 'dec' && v != null) v = Math.round(v * 100) / 100;
      else if (l.f === 'date' && v) v = dLabel(v);
      rows.push([labelOf(l, p), v == null ? '' : v]);
    });
    if (!withParams) return rows;
    rows.push(['', '']);
    rows.push(['PARAMÈTRES', '']);
    PARAM_ROWS.forEach(function (r) {
      var v = p[r[0]];
      if (r[2] === 'bool') v = v ? 'OUI' : 'NON';
      else if (r[2] === 'base') v = v === 'montant' ? 'MONTANT' : 'NOMINAL';
      else if (r[2] === 'list') v = (v || []).join(', ');
      rows.push([r[1], v == null ? '' : v]);
    });
    return rows;
  }
  function loadXlsx() {
    if (w.XLSX) return Promise.resolve(w.XLSX);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = XLSX_SRC; s.async = true;
      s.onload = function () { w.XLSX ? resolve(w.XLSX) : reject(new Error('Moteur Excel indisponible.')); };
      s.onerror = function () { reject(new Error('Moteur Excel indisponible.')); };
      document.head.appendChild(s);
    });
  }
  /* full : modèle complet (section PARAMÈTRES + mode d'emploi) ; sinon la
     seule fiche de simulation. */
  function writeWorkbook(X, values, p, filename, full) {
    var rows = sheetRows(values, p, !!full);
    if (!full) rows.push(['', ''], ['Simulation indicative établie avec The Capital le ' + dLabel(todayIso()) + '. Intérêts courus ACT/ACT, rendement actuariel frais inclus sur l\'échéancier réel. Ne constitue ni une offre ni un conseil en investissement.', '']);
    var ws = X.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 52 }, { wch: 34 }];
    rows.forEach(function (r, i) {
      var cell = ws[X.utils.encode_cell({ r: i, c: 1 })];
      if (!cell || typeof cell.v !== 'number') return;
      var line = LINES.find(function (l) { return labelOf(l, p) === r[0]; });
      cell.z = line && line.f === 'pct' ? '0.00%' : line && line.f === 'dec' ? '0.00' : (line ? '#,##0' : 'General');
    });
    var wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, 'Simulation');
    if (values.flux && values.flux.length > 1) {
      var fr = [['Date', 'Opération', 'Coupon', 'Amortissement', 'Capital restant dû', 'Flux']];
      values.flux.forEach(function (x) { fr.push([dOf(x.date), x.libelle, x.coupon, x.amort, x.crd, x.total]); });
      var n = fr.length;
      fr.push(['', '', '', '', '', ''], ['TRI des paiements (TRI.PAIEMENTS)', '', '', '', '', values.ytm != null ? values.ytm / 100 : '']);
      var wf = X.utils.aoa_to_sheet(fr, { cellDates: true });
      for (var i = 1; i < n; i++) {
        var dc = wf[X.utils.encode_cell({ r: i, c: 0 })]; if (dc) dc.z = 'dd/mm/yyyy';
        for (var c = 2; c <= 5; c++) { var nc = wf[X.utils.encode_cell({ r: i, c: c })]; if (nc) nc.z = '#,##0'; }
      }
      var tri = wf[X.utils.encode_cell({ r: n + 1, c: 5 })];
      if (tri) { tri.f = 'XIRR(F2:F' + n + ',A2:A' + n + ')'; tri.z = '0.00%'; }
      wf['!cols'] = [{ wch: 12 }, { wch: 34 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 18 }];
      X.utils.book_append_sheet(wb, wf, 'Flux');
    }
    if (full && full.notes) X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(full.notes.map(function (t) { return [t]; })), 'Mode_emploi');
    X.writeFile(wb, filename);
  }

  // ── lecture d'un fichier rempli ──────────────────────────────────────
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'").replace(/\s+/g, ' ').trim(); }
  function cellPct(raw, text) {
    if (typeof raw === 'number') return /%/.test(String(text || '')) ? raw * 100 : raw;
    return num(raw);
  }
  function cellDate(raw) {
    if (raw instanceof Date && !isNaN(raw)) return isoOf(new Date(Date.UTC(raw.getFullYear(), raw.getMonth(), raw.getDate())));
    if (typeof raw === 'number' && raw > 20000 && raw < 80000) return isoOf(new Date(Date.UTC(1899, 11, 30) + raw * DAY));
    var s = String(raw || '').trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/))) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    return null;
  }
  function bool(v) { var s = norm(v); return s === 'oui' || s === 'yes' || s === 'true' || s === '1' || s === 'vrai'; }

  /* raw / text : matrices [ligne][colonne] (valeurs brutes et texte formaté).
     Retourne { params, found: [clés lues], info: {…}, warnings: [] }. */
  function parseRows(raw, text) {
    var params = {}, found = {}, info = {}, warnings = [], sim = {};
    var paramLabels = {}; PARAM_ROWS.forEach(function (r) { paramLabels[norm(r[1])] = r; });
    for (var i = 0; i < raw.length; i++) {
      var row = raw[i] || [], trow = (text && text[i]) || [];
      var label = row[0], rawV = row[1], txtV = trow[1];
      var n = norm(label); if (!n) continue;
      var pr = paramLabels[n];
      if (pr) {
        if (rawV == null || rawV === '') continue;
        var val = pr[2] === 'num' ? num(rawV) : pr[2] === 'bool' ? bool(rawV) : pr[2] === 'base' ? (norm(rawV) === 'montant' ? 'montant' : 'nominal')
          : pr[2] === 'list' ? String(rawV).split(/[,;\s]+/).map(function (x) { return x.trim(); }).filter(function (x) { return LINES.some(function (l) { return l.k === x; }); }) : String(rawV).trim();
        if (pr[2] === 'num' && val == null) { warnings.push('Valeur illisible pour « ' + pr[1] + ' ».'); continue; }
        params[pr[0]] = val; found[pr[0]] = 'paramètres';
        continue;
      }
      var m;
      if (n === 'quantite') sim.qty = num(rawV);
      else if (/^valeur nominale? unitaire/.test(n)) sim.vn = num(rawV);
      else if (n === 'date de transaction') sim.t = cellDate(rawV);
      else if (/^date de valeur/.test(n)) sim.v = cellDate(rawV);
      else if (n === 'designation') info.designation = String(rawV || '').trim();
      else if (n === 'code symbole') info.code = String(rawV || '').trim();
      else if (n === 'coupon') info.coupon = cellPct(rawV, txtV);
      else if (n === "montant de l'operation") sim.montantOp = num(rawV);
      else if (/apporteur/.test(n)) {
        if ((m = n.match(/\(([\d\s.,]+)\s*f\s*cfa/))) sim.apporteur = num(m[1]);
        sim.apporteurMontant = num(rawV);
      } else if (/^taf\b/.test(n)) {
        if ((m = n.match(/\(([\d.,]+)\s*%\)/))) sim.taf = num(m[1]);
      } else if (/brvm|dcbr|dc\/br/.test(n) && !/total/.test(n)) {
        sim.dcbrMontant = num(rawV);
      } else if (/^commission/.test(n) && !/total|taux/.test(n) && (m = n.match(/\(([\d.,]+)\s*%\)/))) {
        sim.sgi = num(m[1]);
        sim.sgiLibelle = String(label).replace(/\s*\([^)]*\)\s*$/, '').trim();
      }
    }
    /* Taux déduits de la fiche quand la section PARAMÈTRES ne les donne pas. */
    function take(key, v, how) { if (v != null && found[key] == null) { params[key] = v; found[key] = how; } }
    take('commission_sgi_pct', sim.sgi, 'libellé');
    take('commission_sgi_libelle', sim.sgiLibelle, 'libellé');
    take('apporteur_par_titre', sim.apporteur, 'libellé');
    if (sim.apporteurMontant != null) take('apporteur_actif', sim.apporteurMontant > 0, 'montant');
    take('taf_pct', sim.taf, 'libellé');
    if (sim.dcbrMontant != null && sim.qty > 0 && sim.vn > 0) {
      take('brvm_dcbr_pct', Math.round(sim.dcbrMontant / (sim.qty * sim.vn) * 100 * 1e6) / 1e6, 'montant / nominal');
      take('brvm_dcbr_actif', sim.dcbrMontant > 0, 'montant');
    }
    if (sim.t && sim.v) take('delai_reglement_jours', businessDaysBetween(sim.t, sim.v, holidaySet([])), 'dates');
    info.quantite = sim.qty; info.vn = sim.vn; info.date_transaction = sim.t; info.date_valeur = sim.v;
    return { params: params, found: found, info: info, warnings: warnings };
  }

  // ── réglages du professionnel (appareil) ─────────────────────────────
  function readUser() { try { return JSON.parse(localStorage.getItem(STORE) || 'null') || {}; } catch (e) { return {}; } }
  function writeUser(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (e) {} }

  // ── interface (fiche obligation de l'application) ────────────────────
  var CSS = ''
    + '.oo{--oo-line:rgba(245,240,232,.09);--oo-soft:rgba(245,240,232,.04);--oo-gold:var(--gold,#B8964E)}'
    + '.oo-wrap{display:grid;grid-template-columns:minmax(280px,380px) minmax(0,1fr);gap:18px;align-items:start}'
    + '@media (max-width:900px){.oo-wrap{grid-template-columns:1fr}}'
    + '.oo-panel{background:var(--card,rgba(245,240,232,.03));border:1px solid var(--oo-line);border-radius:12px;padding:16px}'
    + '.oo-panel h3{margin:0 0 12px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--oo-gold);font-weight:600}'
    + '.oo-wrap>*,.oo-grid>*{min-width:0}.oo input,.oo select{min-width:0;max-width:100%}'
    + '.oo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-items:end}'
    + '.oo-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}'
    + '@media (max-width:520px){.oo-grid,.oo-checks.cols{grid-template-columns:1fr}.oo-sheet td{padding:7px 10px}.oo-sheet .hd span{display:none}.oo-kpi .v{font-size:16px}}'
    + '.oo-grid .full{grid-column:1/-1}'
    + '.oo label.l{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim,rgba(245,240,232,.5));margin-bottom:5px}'
    + '.oo input[type=number],.oo input[type=date],.oo input[type=text],.oo select{width:100%;box-sizing:border-box;background:var(--oo-soft);border:1px solid rgba(245,240,232,.14);color:inherit;border-radius:8px;padding:9px 10px;font:inherit;font-variant-numeric:tabular-nums}'
    + '.oo input:focus,.oo select:focus{outline:none;border-color:var(--oo-gold);box-shadow:0 0 0 3px rgba(184,150,78,.15)}'
    + '.oo-kpis{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}'
    + '.oo-kpi{background:var(--oo-soft);border:1px solid var(--oo-line);border-radius:10px;padding:11px 12px}'
    + '.oo-kpi .k{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim,rgba(245,240,232,.5))}'
    + '.oo-kpi .v{margin-top:4px;font-size:18px;font-weight:600;font-variant-numeric:tabular-nums}'
    + '.oo-kpi.oo-kmain{grid-column:1/-1;background:linear-gradient(135deg,rgba(184,150,78,.18),rgba(184,150,78,.05));border-color:rgba(184,150,78,.45)}'
    + '.oo-kpi.oo-kmain .v{font-size:24px;color:var(--oo-gold)}'
    + '.oo-sheet{border:1px solid var(--oo-line);border-radius:12px;overflow:hidden;background:var(--card,rgba(245,240,232,.02))}'
    + '.oo-sheet .hd{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid rgba(184,150,78,.35);background:rgba(184,150,78,.08)}'
    + '.oo-sheet .hd b{font-size:12px;letter-spacing:.14em;color:var(--oo-gold)}.oo-sheet .hd span{font-size:12px;color:var(--dim,rgba(245,240,232,.55));text-align:right}'
    + '.oo-sheet table{width:100%;border-collapse:collapse;font-size:13.5px}.oo-sheet td{padding:7px 16px;border-bottom:1px solid var(--oo-line)}'
    + '.oo-sheet td.v{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.oo-sheet tr.gap td{padding:3px;border:0;background:var(--oo-soft)}'
    + '.oo-sheet tr.sec td{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--oo-gold);padding-top:12px;border-bottom:0}'
    + '.oo-sheet tr.strong td{font-weight:600;border-top:1px solid rgba(245,240,232,.22)}'
    + '.oo-sheet tr.total td{background:var(--oo-gold);color:#17120a;font-weight:700;font-size:16px;border:0;padding:12px 16px}'
    + '.oo-sheet .h{font-size:11px;color:var(--dim,rgba(245,240,232,.5));margin-left:6px}'
    + '.oo-flux{margin-top:12px;border:1px solid var(--oo-line);border-radius:12px;overflow:hidden}.oo-flux summary{cursor:pointer;padding:11px 16px;font-size:12.5px;font-weight:600;color:var(--oo-gold);background:rgba(184,150,78,.06)}'
    + '.oo-fluxw{overflow-x:auto}.oo-flux table{width:100%;border-collapse:collapse;font-size:12.5px}.oo-flux th{text-align:right;font-weight:500;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim,rgba(245,240,232,.55));padding:8px 12px;border-bottom:1px solid var(--oo-line)}'
    + '.oo-flux th:nth-child(-n+2){text-align:left}.oo-flux td{padding:6px 12px;border-bottom:1px solid var(--oo-line);white-space:nowrap}.oo-flux td.v{text-align:right;font-variant-numeric:tabular-nums}.oo-flux td.neg{color:#e07a6a}'
    + '.oo-bar{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0}'
    + '.oo-btn{background:var(--oo-soft);border:1px solid rgba(245,240,232,.16);color:inherit;border-radius:8px;padding:8px 13px;font:inherit;font-size:13px;cursor:pointer}'
    + '.oo-btn:hover{border-color:var(--oo-gold)}.oo-btn.gold{background:var(--oo-gold);border-color:var(--oo-gold);color:#17120a;font-weight:600}'
    + '.oo-set{margin-top:14px;border-top:1px solid var(--oo-line);padding-top:14px}'
    + '.oo-set h4{margin:14px 0 10px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--oo-gold)}.oo-set h4:first-child{margin-top:0}'
    + '.oo-checks{display:grid;grid-template-columns:1fr;gap:6px;font-size:13px}.oo-checks.cols{grid-template-columns:1fr 1fr;gap:6px 12px;font-size:12px}'
    + '.oo-checks label{display:flex;gap:8px;align-items:center;cursor:pointer}'
    + '.oo-checks input{accent-color:var(--oo-gold)}'
    + '.oo-note{font-size:12px;color:var(--dim,rgba(245,240,232,.55));line-height:1.55;margin-top:12px}'
    + '.oo-err{color:#f87171;padding:14px 16px}'
    + '.oo-lock{padding:18px;border:1px solid rgba(184,150,78,.45);border-radius:12px;background:linear-gradient(135deg,rgba(184,150,78,.12),rgba(184,150,78,.03))}'
    + '.oo-lock a{display:inline-block;margin-top:10px;background:var(--oo-gold);color:#17120a;font-weight:600;padding:8px 14px;border-radius:8px;text-decoration:none}'
    + '.oo-pick{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end;margin-bottom:16px}'
    + '.oo-pick .meta{font-size:12px;color:var(--dim,rgba(245,240,232,.55));margin-top:6px}'
    + '.oo select,#ooBond{color-scheme:dark}.oo select option,#ooBond option,#ooBond optgroup{background:#15120d;color:#f5f0e8}.oo select option:checked,#ooBond option:checked{background:#b8964e;color:#17120a}';
  function injectCss() {
    if (document.getElementById('oo-css')) return;
    var s = document.createElement('style'); s.id = 'oo-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  var SESSION = {};   // saisie en cours par code obligataire
  var server = null;  // promesse de { parametres, jours_feries } ou { error }
  function loadServer() {
    if (server) return server;
    if (typeof w.apiGet !== 'function') return Promise.resolve({ parametres: {}, jours_feries: [] });
    server = w.apiGet('/marche?type=simulateur_obligataire&_=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return (r && r.parametres) ? r : ((r && r.data) || { parametres: {}, jours_feries: [] }); })
      .catch(function (e) {
        var out = { error: /402/.test(String(e && e.message)) ? 'plan' : 'network', parametres: {}, jours_feries: [] };
        server = null;  // nouvel essai au prochain affichage
        return out;
      });
    return server;
  }
  function allowed() { return !w.TC || typeof w.TC.can !== 'function' || w.TC.can('simulateur_obligataire'); }

  function lockedHtml() {
    return '<div class="oo-lock"><b>Simulateur d\'ordre — réservé à la formule Professional.</b><br>'
      + 'Calculez le coût complet d\'un ordre (intérêts courus, commission SGI, apporteur, TAF, BRVM/DC-BR), le prix TTC et le rendement frais inclus, avec vos propres taux. '
      + '<a href="/payment.html?plan=pro&period=monthly">Passer à Professional</a></div>';
  }

  /* host : élément conteneur ; ctx : { o, f, b, a } de la fiche obligation. */
  function mount(host, ctx) {
    if (!host) return;
    injectCss();
    host.classList.add('oo');
    if (!allowed()) { host.innerHTML = lockedHtml(); return; }
    var token = {}; host.__ooToken = token;  // un seul simulateur actif par conteneur
    host.innerHTML = '<div class="oo-note">Chargement des paramètres…</div>';
    loadServer().then(function (srv) {
      if (!host.isConnected || host.__ooToken !== token) return;  // fiche redessinée ou autre obligation choisie
      if (srv.error === 'plan') { host.innerHTML = lockedHtml(); return; }
      var user = readUser();
      /* État conservé par ligne pendant la session : l'application redessine la
         page à chaque rafraîchissement des données (tc:dataready), la saisie
         ne doit pas être perdue. */
      var st = SESSION[ctx.o.code] || (SESSION[ctx.o.code] = {
        quantite: user.last_quantite || 1000,
        prix: ctx.a && ctx.a.clean != null ? Math.round(ctx.a.clean) : Math.round((ctx.a && ctx.a.crd) || 10000),
        dateTransaction: todayIso(), dateValeur: '', valeurManuelle: false, echeance: '',
        settingsOpen: false
      });
      function params() { return mergeParams(srv.parametres, user.params); }

      /* Un champ qui perd le focus pendant le redessin déclenche un « change » :
         ce second rendu est différé au lieu d'être imbriqué. */
      var painting = false;
      function paint() {
        if (painting) { setTimeout(paint, 0); return; }
        painting = true;
        try { paintNow(); } finally { painting = false; }
      }
      function paintNow() {
        var p = params();
        var res = compute({ o: ctx.o, f: ctx.f, b: ctx.b, quantite: st.quantite, prix: st.prix, dateTransaction: st.dateTransaction, dateValeur: st.valeurManuelle ? st.dateValeur : '', echeance: st.echeance, joursFeries: srv.jours_feries }, p);
        if (!st.valeurManuelle && res.values) st.dateValeur = res.values.date_valeur;
        var crd = res.analysis ? res.analysis.crd : (ctx.a && ctx.a.crd) || 10000;
        var v = res.values;
        var inp = function (id, label, type, val, extra, cls) {
          return '<div class="' + (cls || '') + '"><label class="l" for="' + id + '">' + label + '</label><input type="' + type + '" id="' + id + '"' + (type === 'number' ? ' step="any"' : '') + ' value="' + esc(val == null ? '' : val) + '"' + (extra || '') + '></div>';
        };
        var panel = '<div class="oo-panel"><h3>Votre ordre</h3><div class="oo-grid">'
          + inp('ooQty', 'Quantité (titres)', 'number', st.quantite, ' min="1" step="1"', 'full')
          + inp('ooPx', 'Prix pied de coupon (FCFA)', 'number', st.prix)
          + inp('ooPct', 'Prix (% du nominal)', 'number', Math.round(st.prix / crd * 10000) / 100)
          + inp('ooT', 'Date de transaction', 'date', st.dateTransaction)
          + inp('ooV', 'Date de valeur · T+' + esc(p.delai_reglement_jours), 'date', st.dateValeur || '')
          + inp('ooE', 'Échéance' + (st.echeance ? ' (saisie)' : ''), 'date', st.echeance || (v ? v.echeance : ''))
          + inp('ooY', 'Rendement visé (%) → prix', 'number', st.rendementVise != null ? st.rendementVise : '', ' placeholder="ex. 7,5"')
          + '</div>';
        if (v) {
          var tile = function (k, val, cls) { return '<div class="oo-kpi ' + (cls || '') + '"><div class="k">' + esc(k) + '</div><div class="v">' + esc(val) + '</div></div>'; };
          panel += '<div class="oo-kpis">'
            + tile('Montant à régler', nf(Math.round(v.montant)) + ' FCFA', 'oo-kmain')
            + tile('Prix TTC', nf(v.prix_ttc, 2) + ' %')
            + tile('Rendement frais inclus', v.ytm != null ? nf(v.ytm, 2) + ' %' : '—')
            + tile('Total des frais', nf(Math.round(v.total_commissions)) + ' F')
            + tile('Intérêts courus', nf(Math.round(v.interets_courus)) + ' F')
            + '</div>';
        }
        panel += '<div class="oo-bar"><button type="button" class="oo-btn gold" id="ooXlsx">Exporter Excel</button><button type="button" class="oo-btn" id="ooPrint">Imprimer / PDF</button>'
          + '<button type="button" class="oo-btn" id="ooSet">' + (st.settingsOpen ? 'Masquer mes réglages' : 'Mes taux et lignes') + '</button></div>';
        if (st.settingsOpen) panel += settingsHtml(p);
        panel += '</div>';
        var sheet;
        if (res.error) sheet = '<div class="oo-sheet"><div class="hd"><b>SIMULATION</b></div><div class="oo-err">' + esc(res.error) + '</div></div>';
        else {
          var lines = visibleLines(v, p), prev = null, body = '';
          var SEC = { titre: 'Titre et opération', frais: 'Frais et commissions', synthese: 'Synthèse' };
          lines.forEach(function (l) {
            if (l.sec === 'total') return;
            if (prev !== l.sec) body += (prev ? '<tr class="gap"><td colspan="2"></td></tr>' : '') + '<tr class="sec"><td colspan="2">' + esc(SEC[l.sec] || '') + '</td></tr>';
            prev = l.sec;
            body += '<tr class="' + (l.strong ? 'strong' : '') + '"><td>' + esc(labelOf(l, p)) + (l.hint ? '<span class="h">' + esc(l.hint) + '</span>' : '') + '</td><td class="v">' + esc(fmt(l, v[l.k])) + '</td></tr>';
          });
          body += '<tr class="total"><td>Montant</td><td class="v">' + esc(fmt(LINES[LINES.length - 1], v.montant)) + ' FCFA</td></tr>';
          sheet = '<div class="oo-sheet" id="ooSheet"><div class="hd"><b>SIMULATION</b><span>' + esc(v.code) + ' · ' + esc(v.designation) + '</span></div><table><tbody>' + body + '</tbody></table></div>';
          if (v.flux && v.flux.length > 1) {
            sheet += '<details class="oo-flux"' + (st.fluxOpen ? ' open' : '') + ' id="ooFlux"><summary>Échéancier des flux · TRI des paiements ' + esc(fmt(LINES.find(function (l) { return l.k === 'ytm'; }), v.ytm)) + '</summary>'
              + '<div class="oo-fluxw"><table><thead><tr><th>Date</th><th>Opération</th><th>Coupon</th><th>Amortissement</th><th>Flux</th></tr></thead><tbody>'
              + v.flux.map(function (x) {
                return '<tr><td>' + dLabel(x.date) + '</td><td>' + esc(x.libelle) + '</td><td class="v">' + (x.coupon ? nf(x.coupon) : '—') + '</td><td class="v">' + (x.amort ? nf(x.amort) : '—') + '</td><td class="v' + (x.total < 0 ? ' neg' : '') + '">' + nf(x.total) + '</td></tr>';
              }).join('') + '</tbody></table></div></details>';
          }
        }
        var html = '<div class="oo-wrap">' + panel + '<div>' + sheet
          + '<p class="oo-note">Intérêts courus en base exacte (ACT/ACT) sur la période de coupon en cours. Date de valeur estimée en jours ouvrés BRVM, fériés exclus. '
          + 'Rendement = TRI des paiements (TRI.PAIEMENTS) sur les flux datés de l\'ordre : montant total réglé à la date de valeur, puis coupons et amortissements de l\'échéancier réel. Simulation indicative : les frais réels sont ceux de votre SGI.</p></div></div>';
        host.innerHTML = html;
        var fx = host.querySelector('#ooFlux');
        if (fx) fx.addEventListener('toggle', function () { st.fluxOpen = fx.open; });
        wire(res, p);
      }

      function settingsHtml(p) {
        var hide = {}; (p.masquer || []).forEach(function (k) { hide[k] = 1; });
        return '<div class="oo-set"><h4>Mes taux</h4><div class="oo-grid">'
          + field('commission_sgi_libelle', 'Libellé commission SGI', 'text', p.commission_sgi_libelle)
          + field('commission_sgi_pct', 'Commission SGI (%)', 'number', p.commission_sgi_pct)
          + field('apporteur_par_titre', 'Apporteur (FCFA / titre)', 'number', p.apporteur_par_titre)
          + field('taf_pct', 'TAF (%)', 'number', p.taf_pct)
          + field('brvm_dcbr_pct', 'BRVM / DC-BR (%)', 'number', p.brvm_dcbr_pct)
          + '<div class="full"><label class="l" for="oo_brvm_dcbr_base">Base BRVM / DC-BR</label><select id="oo_brvm_dcbr_base" data-p="brvm_dcbr_base"><option value="nominal"' + (p.brvm_dcbr_base !== 'montant' ? ' selected' : '') + '>Nominal</option><option value="montant"' + (p.brvm_dcbr_base === 'montant' ? ' selected' : '') + '>Montant de l\'opération</option></select></div>'
          + field('delai_reglement_jours', 'Délai de règlement (jours ouvrés)', 'number', p.delai_reglement_jours)
          + '</div><div class="oo-checks" style="margin-top:12px">'
          + check('apporteur_actif', "Inclure l'apporteur d'affaires", p.apporteur_actif)
          + check('brvm_dcbr_actif', 'Inclure les commissions BRVM / DC-BR', p.brvm_dcbr_actif)
          + check('taf_sur_apporteur', "Appliquer la TAF à l'apporteur", p.taf_sur_apporteur)
          + '</div><h4>Lignes affichées</h4><div class="oo-checks cols">'
          + LINES.filter(function (l) { return l.k !== 'montant'; }).map(function (l) {
            return '<label><input type="checkbox" data-show="' + l.k + '"' + (hide[l.k] ? '' : ' checked') + '> ' + esc(labelOf(l, p)) + '</label>';
          }).join('')
          + '</div><div class="oo-bar"><button type="button" class="oo-btn" id="ooReset">Revenir aux taux par défaut</button></div></div>';
      }
      function field(k, l, type, v) {
        return '<div' + (type === 'text' ? ' class="full"' : '') + '><label class="l" for="oo_' + k + '">' + esc(l) + '</label><input type="' + type + '" id="oo_' + k + '" data-p="' + k + '"' + (type === 'number' ? ' step="any"' : '') + ' value="' + esc(v == null ? '' : v) + '"></div>';
      }
      function check(k, l, v) { return '<label><input type="checkbox" data-pb="' + k + '"' + (v ? ' checked' : '') + '> ' + esc(l) + '</label>'; }

      function saveUser() { writeUser(user); }
      function setParam(k, v) { user.params = user.params || {}; user.params[k] = v; saveUser(); }

      function wire(res, p) {
        var g = function (id) { return host.querySelector('#' + id); };
        var refocus = function (id) { var el = g(id); if (el) { el.focus(); try { var l = el.value.length; el.setSelectionRange && el.type === 'text' && el.setSelectionRange(l, l); } catch (e) {} } };
        g('ooQty').addEventListener('change', function () { st.quantite = Math.max(1, Math.round(num(this.value) || 1)); user.last_quantite = st.quantite; saveUser(); paint(); });
        g('ooPx').addEventListener('change', function () { var v = num(this.value); if (v > 0) { st.prix = v; st.rendementVise = null; } paint(); });
        g('ooPct').addEventListener('change', function () { var v = num(this.value), crd = res.analysis ? res.analysis.crd : 10000; if (v > 0) st.prix = Math.round(v / 100 * crd * 100) / 100; paint(); });
        g('ooT').addEventListener('change', function () { if (this.value) { st.dateTransaction = this.value; st.valeurManuelle = false; } paint(); });
        g('ooV').addEventListener('change', function () { st.dateValeur = this.value; st.valeurManuelle = !!this.value; paint(); });
        /* Rendement actuariel visé (hors frais) → prix pied de coupon à payer. */
        g('ooY').addEventListener('change', function () {
          var y = num(this.value); st.rendementVise = y;
          if (y != null && res.analysis && w.OBMath) {
            var px = w.OBMath.priceForYield(res.analysis, y);
            if (px > 0) st.prix = Math.round(px);
          }
          paint();
        });
        g('ooE').addEventListener('change', function () { st.echeance = this.value || ''; paint(); });
        g('ooSet').addEventListener('click', function () { st.settingsOpen = !st.settingsOpen; paint(); });
        g('ooXlsx').addEventListener('click', function () {
          if (!res.values) return;
          loadXlsx().then(function (X) { writeWorkbook(X, res.values, p, 'Simulation-' + String(ctx.o.code).replace(/[^\w.-]/g, '') + '-' + res.values.date_transaction + '.xlsx'); })
            .catch(function (e) { alert(e.message); });
        });
        g('ooPrint').addEventListener('click', function () { if (res.values) printSheet(res.values, p); });
        host.querySelectorAll('[data-p]').forEach(function (el) {
          el.addEventListener('change', function () {
            var k = el.getAttribute('data-p');
            var v = el.type === 'number' ? num(el.value) : el.value;
            if (el.type === 'number' && v == null) return;
            setParam(k, v); paint(); refocus(el.id);
          });
        });
        host.querySelectorAll('[data-pb]').forEach(function (el) {
          el.addEventListener('change', function () { setParam(el.getAttribute('data-pb'), el.checked); paint(); });
        });
        host.querySelectorAll('[data-show]').forEach(function (el) {
          el.addEventListener('change', function () {
            var k = el.getAttribute('data-show'), cur = params().masquer.filter(function (x) { return x !== k; });
            if (!el.checked) cur.push(k);
            setParam('masquer', cur); paint();
          });
        });
        if (g('ooReset')) g('ooReset').addEventListener('click', function () { user.params = {}; saveUser(); paint(); });
      }

      paint();
    });
  }

  /* Fiche imprimable aux couleurs de The Capital (une page A4). */
  function printSheet(v, p) {
    var lines = visibleLines(v, p), prev = null, body = '';
    var SEC = { titre: 'Titre et opération', frais: 'Frais et commissions', synthese: 'Synthèse' };
    lines.forEach(function (l) {
      if (l.sec === 'total') return;
      if (prev !== l.sec) body += '<tr class="sec"><td colspan="2">' + esc(SEC[l.sec] || '') + '</td></tr>';
      prev = l.sec;
      body += '<tr' + (l.strong ? ' class="strong"' : '') + '><td>' + esc(labelOf(l, p)) + '</td><td class="v">' + esc(fmt(l, v[l.k])) + '</td></tr>';
    });
    var kpi = function (k, val) { return '<div class="kpi"><span>' + esc(k) + '</span><b>' + esc(val) + '</b></div>'; };
    var html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>The Capital — Simulation ' + esc(v.code) + '</title>'
      + '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">'
      + '<style>'
      + '@page{size:A4;margin:12mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + 'body{margin:0;font-family:"DM Sans",Arial,sans-serif;color:#1d1a14;font-size:11.5px;background:#fff}'
      + '.sheet{max-width:186mm;margin:0 auto}'
      + '.band{display:flex;justify-content:space-between;align-items:center;background:#14110c;color:#f5f0e8;border-radius:10px;padding:14px 18px}'
      + '.brand{font:700 15px/1 "Playfair Display",Georgia,serif;letter-spacing:.14em}.brand i{color:#B8964E;font-style:normal}'
      + '.brand small{display:block;margin-top:5px;font:500 8.5px/1 "DM Sans",sans-serif;letter-spacing:.2em;color:#B8964E}'
      + '.band .t{text-align:right}.band .t b{display:block;font:700 13px/1.2 "DM Sans",sans-serif}.band .t span{font-size:10px;color:#cfc6b6}'
      + '.id{display:flex;justify-content:space-between;align-items:flex-end;margin:14px 2px 10px}.id h1{margin:0;font:700 17px/1.2 "Playfair Display",Georgia,serif}'
      + '.id .code{display:inline-block;margin-top:4px;font-size:10.5px;color:#7a705f;letter-spacing:.06em}.id .d{font-size:10px;color:#7a705f;text-align:right}'
      + '.kpis{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:8px;margin-bottom:12px}'
      + '.kpi{border:1px solid #e6dcc8;border-radius:9px;padding:9px 12px;background:#faf7f0}.kpi span{display:block;font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:#8a7d64}'
      + '.kpi b{display:block;margin-top:4px;font-size:15px;color:#1d1a14}.kpi:first-child{background:#14110c;border-color:#14110c}.kpi:first-child span{color:#B8964E}.kpi:first-child b{color:#E6C979;font-size:17px}'
      + 'table{width:100%;border-collapse:collapse}td{padding:4.5px 10px;border-bottom:1px solid #eee6d6}td.v{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:500}'
      + 'tr.sec td{padding:11px 10px 4px;border-bottom:1.5px solid #B8964E;font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:#9a7b3c;font-weight:700}'
      + 'tr.strong td{font-weight:700;background:#faf7f0}'
      + 'tr.total td{padding:10px;border:0;border-top:2px solid #B8964E;font-size:14px;font-weight:700}tr.total td.v{color:#9a7b3c}'
      + '.foot{margin-top:14px;padding-top:8px;border-top:1px solid #eee6d6;font-size:8.5px;line-height:1.5;color:#8a7d64;display:flex;justify-content:space-between;gap:16px}'
      + '.foot b{color:#1d1a14}table,tr{page-break-inside:avoid}'
      + '</style></head><body><div class="sheet">'
      + '<div class="band"><div class="brand">THE <i>·</i> CAPITAL<small>INTELLIGENCE FINANCIÈRE AFRICAINE</small></div>'
      + '<div class="t"><b>Simulation d\'ordre obligataire</b><span>Achat · marché secondaire BRVM</span></div></div>'
      + '<div class="id"><div><h1>' + esc(v.designation) + '</h1><span class="code">' + esc(v.code) + ' · ' + esc(nf(v.quantite)) + ' titres</span></div>'
      + '<div class="d">Établie le ' + esc(dLabel(todayIso())) + '<br>Valeur estimée ' + esc(dLabel(v.date_valeur)) + '</div></div>'
      + '<div class="kpis">' + kpi('Montant à régler', nf(Math.round(v.montant)) + ' FCFA') + kpi('Prix TTC', nf(v.prix_ttc, 2) + ' %')
      + kpi('Rendement frais inclus', v.ytm != null ? nf(v.ytm, 2) + ' %' : '—') + '</div>'
      + '<table><tbody>' + body + '<tr class="total"><td>Montant total à régler</td><td class="v">' + esc(nf(Math.round(v.montant))) + ' FCFA</td></tr></tbody></table>'
      + '<div class="foot"><span>Simulation indicative établie avec <b>The Capital</b>. Intérêts courus ACT/ACT, rendement actuariel frais inclus calculé sur l\'échéancier réel. '
      + 'Les frais effectifs sont ceux de votre SGI. Ne constitue ni une offre ni un conseil en investissement.</span><span style="white-space:nowrap">thecapitalinvest.app</span></div>'
      + '</div><script>window.onload=function(){setTimeout(function(){window.print();},350);}<\/script></body></html>';
    var win = w.open('', '_blank');
    if (!win) { alert('Autorisez les fenêtres pour imprimer la simulation.'); return; }
    win.document.open(); win.document.write(html); win.document.close();
  }

  // ── page autonome (Outils & Simulateurs) ─────────────────────────────
  function loadScript(src) {
    return new Promise(function (resolve) {
      var s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = resolve; document.head.appendChild(s);
    });
  }
  function keyOf(s) { return String(s || '').toUpperCase().replace(/^TNC_/, '').trim(); }
  var market = null;
  function loadMarket() {
    if (market) return market;
    var get = function (q) { return w.apiGet('/marche?type=' + q).then(function (r) { return Array.isArray(r) ? r : (r && r.data) || []; }).catch(function () { return []; }); };
    market = Promise.all([
      w.OBMath ? Promise.resolve() : loadScript('/app/js/views/obligations-math.js?v=3'),
      get('obligations'), get('obligations_caracteristiques&limit=1000'), get('obligations_boc')
    ]).then(function (r) {
      var fiches = {}, boc = {};
      r[2].forEach(function (f) { [f.symbole, f.code_obligation].forEach(function (k) { if (k) fiches[keyOf(k)] = f; }); });
      r[3].forEach(function (b) { if (b && b.symbole) boc[keyOf(b.symbole)] = b; });
      var today = todayIso();
      var list = r[1].filter(function (o) {
        if (!o || !o.code || /^TNC_/i.test(o.code)) return false;
        var an = w.OBMath && w.OBMath.analyze(o, fiches[keyOf(o.code)] || null, today, null, boc[keyOf(o.code)] || null);
        return an && an.schedule && !an.matured;  // lignes vivantes uniquement
      })
        .sort(function (a, b) { return String(a.nom || a.code).localeCompare(String(b.nom || b.code)); });
      return { list: list, fiches: fiches, boc: boc };
    });
    market.catch(function () { market = null; });
    return market;
  }
  function mountStandalone(host) {
    if (!host) return;
    injectCss();
    host.classList.add('oo');
    if (!allowed()) { host.innerHTML = lockedHtml(); return; }
    host.innerHTML = '<div class="oo-note">Chargement du marché obligataire…</div>';
    loadMarket().then(function (m) {
      if (!host.isConnected) return;
      if (!m.list.length || !w.OBMath) { host.innerHTML = '<div class="oo-err">Marché obligataire indisponible pour le moment.</div>'; return; }
      var user = readUser();
      var sel = user.last_code && m.list.some(function (o) { return o.code === user.last_code; }) ? user.last_code
        : (m.list.find(function (o) { return Number(o.cours) > 0; }) || m.list[0]).code;
      host.innerHTML = '<div class="oo-pick"><div><label class="l" for="ooBond">Obligation</label><select id="ooBond">'
        + m.list.map(function (o) { return '<option value="' + esc(o.code) + '"' + (o.code === sel ? ' selected' : '') + '>' + esc(o.code + ' — ' + (o.nom || '')) + '</option>'; }).join('')
        + '</select><div class="meta" id="ooMeta"></div></div></div><div id="ooSim"></div>';
      function show(code) {
        var o = m.list.find(function (x) { return x.code === code; }); if (!o) return;
        var f = m.fiches[keyOf(o.code)] || null, b = m.boc[keyOf(o.code)] || null;
        var a = w.OBMath.analyze(o, f, todayIso(), null, b);
        var meta = host.querySelector('#ooMeta');
        if (meta) meta.textContent = 'Taux ' + (o.taux_facial != null ? String(o.taux_facial).replace('.', ',') + ' %' : '—')
          + ' · cours ' + (Number(o.cours) > 0 ? nf(o.cours) + ' FCFA' : 'non coté')
          + (a && a.schedule ? ' · échéance ' + dLabel(isoOf(a.schedule.maturity)) + ' · ' + (a.schedule.mode && a.schedule.mode.label || '') : '');
        user = readUser(); user.last_code = code; writeUser(user);
        mount(host.querySelector('#ooSim'), { o: o, f: f, b: b, a: a || {} });
      }
      host.querySelector('#ooBond').addEventListener('change', function () { show(this.value); });
      show(sel);
    });
  }

  w.TCOrdreObligataire = {
    DEFAULTS: DEFAULTS, LINES: LINES, PARAM_ROWS: PARAM_ROWS, SAMPLE: SAMPLE,
    compute: compute, mergeParams: mergeParams, labelOf: labelOf, visibleLines: visibleLines,
    addBusinessDays: addBusinessDays, businessDaysBetween: businessDaysBetween,
    sheetRows: sheetRows, writeWorkbook: writeWorkbook, parseRows: parseRows, loadXlsx: loadXlsx,
    mount: mount, mountStandalone: mountStandalone
  };
})(window);
