/* ═══════════════════════════════════════════════════════════════════
   THE CAPITAL — ANALYSE FONDAMENTALE PRO
   af-core.js : normalisation des données et calcul des ratios.

   ── Ce que publient les états financiers disponibles ─────────────
   chiffre_affaires, rbe, resultat_net, fonds_propres, total_actif,
   dettes_financieres, cash_flow_operationnel, capex, nombre_actions,
   bpa, dpa. Rien d'autre.

   ── Ce qui manque, et comment on le traite ───────────────────────
   La trésorerie, le besoin en fonds de roulement, les réserves
   accumulées et la charge d'impôt ne figurent pas dans la source.
   Plutôt que de les estimer en silence, ils sont exposés comme des
   hypothèses que l'utilisateur saisit lui-même. Tant qu'ils sont
   vides, les ratios qui en dépendent affichent « non calculable »
   et disent pourquoi. Aucune valeur n'est inventée nulle part.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.AFCore) return;

  var ND = 'non calculable';

  /* ── Utilitaires ──────────────────────────────────────────────── */

  function num(v) {
    if (v === null || v === undefined || v === '') return NaN;
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    var s = String(v).replace(/\s|\u00a0/g, '').replace(/,/g, '.');
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }
  function fin(v) { return typeof v === 'number' && isFinite(v); }
  function pos(v) { return fin(v) && v > 0; }
  function div(a, b) { return fin(a) && pos(b) ? a / b : NaN; }
  function norm(v) {
    return String(v == null ? '' : v).trim().toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');
  }
  function first(row, keys) {
    for (var i = 0; i < keys.length; i++) {
      var n = num(row[keys[i]]);
      if (fin(n)) return n;
    }
    return NaN;
  }
  function mean(a) { var v = a.filter(fin); return v.length ? v.reduce(function (x, y) { return x + y; }, 0) / v.length : NaN; }
  function median(a) {
    var v = a.filter(fin).sort(function (x, y) { return x - y; });
    if (!v.length) return NaN;
    var m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }
  function stdev(a) {
    var v = a.filter(fin);
    if (v.length < 2) return NaN;
    var m = mean(v), s = 0;
    v.forEach(function (x) { s += (x - m) * (x - m); });
    return Math.sqrt(s / (v.length - 1));
  }

  /* ── Normalisation d'un exercice ──────────────────────────────── */

  var CHAMPS = {
    ca: ['chiffre_affaires', 'chiffreAffaires', 'revenue', 'ca', 'produits'],
    rbe: ['rbe', 'ebitda', 'EBITDA', 'resultat_brut_exploitation', 'excedent_brut'],
    ebit: ['ebit', 'resultat_exploitation', 'resultat_operationnel', 'resultatOperationnel'],
    rn: ['resultat_net', 'resultatNet', 'net_income', 'netIncome', 'benefice_net'],
    cp: ['fonds_propres', 'fondsPropres', 'capitaux_propres', 'capitauxPropres', 'equity', 'total_equity'],
    actif: ['total_actif', 'totalActif', 'actif_total', 'actifTotal', 'total_assets', 'total_bilan'],
    dette: ['dettes_financieres', 'dettesFinancieres', 'dette_financiere', 'detteFinanciere', 'total_dette', 'totalDebt'],
    cfo: ['cash_flow_operationnel', 'cashFlowOperationnel', 'operating_cash_flow', 'flux_operationnel'],
    capex: ['capex', 'investissements', 'investissement', 'invest'],
    actions: ['nombre_actions', 'nb_actions', 'actions', 'shares', 'nbActions'],
    bpa: ['bpa', 'eps', 'benefice_par_action'],
    dpa: ['dpa', 'dividende_par_action', 'dps', 'dividende'],
    treso: ['tresorerie_actif', 'tresorerie', 'treso', 'liquidites', 'disponibilites', 'cash'],
    impot: ['impots', 'impot', 'charge_impot', 'tax']
  };

  function normalizeRow(r) {
    var o = {
      annee: num(r.annee) || num(r.exercice) || num(r.year),
      /* La base code un trimestre « Q1 » et le cumul des neuf mois « 9M » ; ce
         module raisonne en t1…t4 et m9. */
      periode: String(r.periode || 'annuel').toLowerCase().replace(/^q([1-4])$/, 't$1').replace(/^9m$/, 'm9'),
      source: r.source || '', sourceUrl: r.source_url || r.sourceUrl || '',
      sourcePage: r.source_page || r.sourcePage || ''
    };
    Object.keys(CHAMPS).forEach(function (k) { o[k] = first(r, CHAMPS[k]); });

    /* Le BPA et le DPA publiés priment ; à défaut on les reconstitue,
       et on marque le champ comme reconstitué pour que l'interface le
       signale plutôt que de le présenter comme une donnée source. */
    o.bpaCalcule = false; o.dpaSource = fin(o.dpa);
    if (!fin(o.bpa) && fin(o.rn) && pos(o.actions)) { o.bpa = o.rn / o.actions; o.bpaCalcule = true; }
    o.fcf = fin(o.cfo) && fin(o.capex) ? o.cfo - o.capex : NaN;
    return o;
  }

  /* ── Construction de la série d'un titre ──────────────────────── */

  function marketRow(ticker) {
    var rows = Array.isArray(global.allCours) ? global.allCours : [];
    var q = norm(ticker), exact = null;
    rows.forEach(function (r) {
      if (norm(r.ticker || r.symbol || r.code) === q) exact = exact || r;
    });
    return exact;
  }

  function companyRow(ticker) {
    var rows = Array.isArray(global.allEntreprises) ? global.allEntreprises : [];
    var q = norm(ticker), found = null;
    rows.forEach(function (r) { if (norm(r.ticker) === q) found = found || r; });
    return found;
  }

  function build(ticker, overrides) {
    var q = norm(ticker);
    var all = Array.isArray(global.allFinancials) ? global.allFinancials : [];
    var rows = all
      .filter(function (f) { return norm(f.ticker) === q; })
      .map(normalizeRow)
      .filter(function (f) { return fin(f.annee) && (f.periode === 'annuel' || !f.periode); })
      .sort(function (a, b) { return a.annee - b.annee; });

    /* Un même exercice peut apparaître deux fois si la source a été
       corrigée : on garde la dernière occurrence. */
    var byYear = {};
    rows.forEach(function (r) { byYear[r.annee] = r; });
    rows = Object.keys(byYear).map(Number).sort(function (a, b) { return a - b; })
      .map(function (y) { return byYear[y]; });

    var mk = marketRow(ticker);
    var co = companyRow(ticker);
    var price = mk ? first(mk, ['cours', 'cours_cloture', 'cloture', 'close', 'prix', 'last']) : NaN;

    /* Le nombre d'actions le plus récent connu sert à toute la série
       si un exercice ne le publie pas. */
    var shares = NaN;
    for (var i = rows.length - 1; i >= 0; i--) if (pos(rows[i].actions)) { shares = rows[i].actions; break; }
    if (!pos(shares) && mk) shares = first(mk, ['nombre_actions', 'nb_actions', 'actions']);
    if (!pos(shares) && co) shares = first(co, ['nombre_actions', 'nb_actions', 'actions', 'capital_actions']);

    var ov = overrides || {};
    rows.forEach(function (r) {
      if (!pos(r.actions) && pos(shares)) { r.actions = shares; r.actionsEstimees = true; }
      var o = ov[r.annee] || {};
      ['treso', 'bfr', 'reserves', 'ebit', 'actifCirculant', 'passifCirculant', 'impot'].forEach(function (k) {
        var v = num(o[k]);
        if (fin(v)) { r[k] = v; r['_saisi_' + k] = true; }
      });
      if (!fin(r.bpa) && fin(r.rn) && pos(r.actions)) { r.bpa = r.rn / r.actions; r.bpaCalcule = true; }
    });

    return {
      ticker: (mk && (mk.ticker || '')) || String(ticker).toUpperCase(),
      nom: (co && (co.nom || co.raison_sociale)) || (mk && (mk.nom || mk.libelle)) || '',
      secteur: (co && (co.secteur || co.sector || co.activite)) || '',
      sousSecteur: (co && (co.sous_secteur || co.sousSecteur)) || '',
      pays: (co && (co.pays || co.country)) || '',
      rows: rows,
      price: pos(price) ? price : NaN,
      variation: mk ? first(mk, ['variation', 'var', 'variation_pct']) : NaN,
      shares: shares,
      marketCap: pos(price) && pos(shares) ? price * shares : NaN,
      overrides: ov
    };
  }

  /* ── Ratios d'un exercice ─────────────────────────────────────── */

  function ratios(r, prev, price, shares) {
    var act = pos(r.actions) ? r.actions : shares;
    var mc = pos(price) && pos(act) ? price * act : NaN;
    var detteNette = fin(r.dette) ? (fin(r.treso) ? r.dette - r.treso : r.dette) : NaN;
    var detteNetteExacte = fin(r.dette) && fin(r.treso);
    var ev = fin(mc) && fin(detteNette) ? mc + detteNette : NaN;

    var o = {
      annee: r.annee,
      /* Rentabilité */
      margeBrute: div(r.rbe, r.ca),
      margeExploitation: div(fin(r.ebit) ? r.ebit : r.rbe, r.ca),
      margeNette: div(r.rn, r.ca),
      roe: div(r.rn, r.cp),
      roa: div(r.rn, r.actif),
      roce: div(fin(r.ebit) ? r.ebit : r.rbe, fin(r.cp) && fin(r.dette) ? r.cp + r.dette : NaN),
      /* Structure */
      gearing: div(r.dette, r.cp),
      autonomie: div(r.cp, r.actif),
      detteActif: div(r.dette, r.actif),
      detteNette: detteNette,
      detteNetteExacte: detteNetteExacte,
      detteEbitda: div(detteNette, r.rbe),
      levier: div(r.actif, r.cp),
      /* Efficacité */
      rotationActifs: div(r.ca, r.actif),
      /* Flux */
      fcf: r.fcf,
      margeFcf: div(r.fcf, r.ca),
      conversionCash: div(r.cfo, r.rn),
      capexCa: div(r.capex, r.ca),
      capexAmort: NaN,
      /* Par action */
      bpa: r.bpa,
      dpa: r.dpa,
      anpa: div(r.cp, act),
      fcfpa: div(r.fcf, act),
      capa: div(r.ca, act),
      /* Valorisation, au cours actuel */
      marketCap: mc,
      ev: ev,
      per: div(price, r.bpa),
      pbr: div(price, div(r.cp, act)),
      psr: div(mc, r.ca),
      pfcf: div(mc, r.fcf),
      evEbitda: div(ev, r.rbe),
      evCa: div(ev, r.ca),
      rendement: div(r.dpa, price),
      rendementFcf: div(r.fcf, mc),
      payout: div(r.dpa, r.bpa),
      payoutFcf: fin(r.dpa) && pos(act) && fin(r.fcf) ? (r.dpa * act) / r.fcf : NaN
    };

    /* DuPont : ROE = marge nette × rotation × levier */
    o.dupont = {
      marge: o.margeNette, rotation: o.rotationActifs, levier: o.levier,
      produit: fin(o.margeNette) && fin(o.rotationActifs) && fin(o.levier)
        ? o.margeNette * o.rotationActifs * o.levier : NaN
    };

    /* Croissances d'un exercice à l'autre */
    if (prev) {
      o.croissanceCa = fin(r.ca) && pos(prev.ca) ? r.ca / prev.ca - 1 : NaN;
      o.croissanceRn = fin(r.rn) && pos(prev.rn) ? r.rn / prev.rn - 1 : NaN;
      o.croissanceRbe = fin(r.rbe) && pos(prev.rbe) ? r.rbe / prev.rbe - 1 : NaN;
      o.croissanceFcf = fin(r.fcf) && pos(prev.fcf) ? r.fcf / prev.fcf - 1 : NaN;
      o.croissanceBpa = fin(r.bpa) && pos(prev.bpa) ? r.bpa / prev.bpa - 1 : NaN;
      o.croissanceDpa = fin(r.dpa) && pos(prev.dpa) ? r.dpa / prev.dpa - 1 : NaN;
      o.croissanceCp = fin(r.cp) && pos(prev.cp) ? r.cp / prev.cp - 1 : NaN;
    }
    return o;
  }

  /* ── Croissance sur la durée ──────────────────────────────────── */

  /* Le TCAM ne se calcule que sur deux bornes strictement positives.
     Une série qui part d'une perte n'a pas de taux de croissance annuel
     moyen ; le prétendre serait une faute, on renvoie donc « non
     calculable » assortie de la raison. */
  function tcam(values, years) {
    var v = [], y = [];
    for (var i = 0; i < values.length; i++) if (fin(values[i])) { v.push(values[i]); y.push(years[i]); }
    if (v.length < 2) return { value: NaN, raison: 'moins de deux exercices renseignés' };
    var a = v[0], b = v[v.length - 1], n = y[y.length - 1] - y[0];
    if (n <= 0) return { value: NaN, raison: 'exercices non distincts' };
    if (a <= 0) return { value: NaN, raison: 'le premier exercice est nul ou négatif' };
    if (b <= 0) return { value: NaN, raison: 'le dernier exercice est nul ou négatif', tendance: 'passage en perte' };
    return { value: Math.pow(b / a, 1 / n) - 1, annees: n, debut: a, fin: b };
  }

  function regression(years, values) {
    var xs = [], ys = [];
    for (var i = 0; i < values.length; i++) if (fin(values[i]) && fin(years[i])) { xs.push(years[i]); ys.push(values[i]); }
    if (xs.length < 3) return null;
    var mx = mean(xs), my = mean(ys), sxy = 0, sxx = 0;
    for (var k = 0; k < xs.length; k++) { sxy += (xs[k] - mx) * (ys[k] - my); sxx += (xs[k] - mx) * (xs[k] - mx); }
    if (sxx === 0) return null;
    var slope = sxy / sxx, intercept = my - slope * mx;
    var ssTot = 0, ssRes = 0;
    for (var j = 0; j < xs.length; j++) {
      var pred = slope * xs[j] + intercept;
      ssTot += (ys[j] - my) * (ys[j] - my);
      ssRes += (ys[j] - pred) * (ys[j] - pred);
    }
    return {
      slope: slope, intercept: intercept,
      r2: ssTot === 0 ? null : 1 - ssRes / ssTot,
      at: function (x) { return slope * x + intercept; },
      n: xs.length
    };
  }

  /* Régularité : un chiffre d'affaires qui progresse chaque année vaut
     mieux qu'un chiffre d'affaires qui double puis s'effondre, même si
     le TCAM est identique. */
  function regularite(values) {
    var v = values.filter(fin);
    if (v.length < 3) return { value: NaN, raison: 'moins de trois exercices' };
    var hausses = 0, deltas = [];
    for (var i = 1; i < v.length; i++) {
      if (v[i] > v[i - 1]) hausses++;
      if (pos(v[i - 1])) deltas.push(v[i] / v[i - 1] - 1);
    }
    var m = mean(deltas), sd = stdev(deltas);
    return {
      value: hausses / (v.length - 1),
      exercicesHausse: hausses,
      exercices: v.length - 1,
      volatilite: sd,
      /* Coefficient de variation : dispersion rapportée au niveau moyen */
      dispersion: fin(sd) && fin(m) && m !== 0 ? Math.abs(sd / m) : NaN
    };
  }

  /* ── Score de Piotroski ───────────────────────────────────────── */

  /* Neuf tests dans l'original. Deux d'entre eux demandent le ratio de
     liquidité générale, absent de la source. Ils ne sont évalués que si
     l'utilisateur a saisi l'actif et le passif circulants ; sinon le
     score est publié sur le nombre de tests réellement évaluables, et
     l'interface indique lequel manque. */
  function piotroski(rows, ratiosList) {
    if (rows.length < 2) return { enough: false, raison: 'deux exercices consécutifs sont nécessaires' };
    var n = rows.length - 1;
    var c = rows[n], p = rows[n - 1];
    var rc = ratiosList[n], rp = ratiosList[n - 1];
    var tests = [];

    function t(cle, libelle, condition, detail, groupe) {
      tests.push({
        cle: cle, libelle: libelle, groupe: groupe,
        reussi: condition === true, evaluable: condition !== null, detail: detail
      });
    }

    t('roa', 'Rentabilité des actifs positive',
      fin(rc.roa) ? rc.roa > 0 : null,
      fin(rc.roa) ? 'ROA de ' + (rc.roa * 100).toFixed(2) + ' %' : ND, 'Rentabilité');
    t('cfo', 'Flux opérationnel positif',
      fin(c.cfo) ? c.cfo > 0 : null,
      fin(c.cfo) ? 'flux de ' + Math.round(c.cfo).toLocaleString('fr-FR') : ND, 'Rentabilité');
    t('droa', 'Rentabilité des actifs en progrès',
      fin(rc.roa) && fin(rp.roa) ? rc.roa > rp.roa : null,
      fin(rc.roa) && fin(rp.roa) ? (rc.roa * 100).toFixed(2) + ' % contre ' + (rp.roa * 100).toFixed(2) + ' %' : ND, 'Rentabilité');
    t('accruals', 'Flux opérationnel supérieur au résultat',
      fin(c.cfo) && fin(c.rn) ? c.cfo > c.rn : null,
      fin(c.cfo) && fin(c.rn) ? 'écart de ' + Math.round(c.cfo - c.rn).toLocaleString('fr-FR') : ND, 'Rentabilité');

    t('levier', 'Endettement en recul',
      fin(rc.detteActif) && fin(rp.detteActif) ? rc.detteActif <= rp.detteActif : null,
      fin(rc.detteActif) && fin(rp.detteActif) ? (rc.detteActif * 100).toFixed(1) + ' % contre ' + (rp.detteActif * 100).toFixed(1) + ' %' : ND, 'Structure');
    var lgC = fin(c.actifCirculant) && pos(c.passifCirculant) ? c.actifCirculant / c.passifCirculant : NaN;
    var lgP = fin(p.actifCirculant) && pos(p.passifCirculant) ? p.actifCirculant / p.passifCirculant : NaN;
    t('liquidite', 'Liquidité générale en progrès',
      fin(lgC) && fin(lgP) ? lgC > lgP : null,
      fin(lgC) && fin(lgP) ? lgC.toFixed(2) + ' contre ' + lgP.toFixed(2)
        : 'demande l\'actif et le passif circulants, à saisir dans les hypothèses', 'Structure');
    t('dilution', 'Absence de dilution',
      pos(c.actions) && pos(p.actions) && !c.actionsEstimees && !p.actionsEstimees ? c.actions <= p.actions : null,
      pos(c.actions) && pos(p.actions) && !c.actionsEstimees
        ? Math.round(c.actions).toLocaleString('fr-FR') + ' actions contre ' + Math.round(p.actions).toLocaleString('fr-FR')
        : 'nombre d\'actions non publié par exercice', 'Structure');

    t('marge', 'Marge d\'exploitation (RBE) en progrès',
      fin(rc.margeBrute) && fin(rp.margeBrute) ? rc.margeBrute > rp.margeBrute : null,
      fin(rc.margeBrute) && fin(rp.margeBrute) ? (rc.margeBrute * 100).toFixed(1) + ' % contre ' + (rp.margeBrute * 100).toFixed(1) + ' %' : ND, 'Efficacité');
    t('rotation', 'Rotation des actifs en progrès',
      fin(rc.rotationActifs) && fin(rp.rotationActifs) ? rc.rotationActifs > rp.rotationActifs : null,
      fin(rc.rotationActifs) && fin(rp.rotationActifs) ? rc.rotationActifs.toFixed(2) + ' contre ' + rp.rotationActifs.toFixed(2) : ND, 'Efficacité');

    var evaluables = tests.filter(function (x) { return x.evaluable; });
    var score = evaluables.filter(function (x) { return x.reussi; }).length;
    return {
      enough: evaluables.length >= 5,
      score: score, sur: evaluables.length, total: tests.length,
      tests: tests,
      manquants: tests.filter(function (x) { return !x.evaluable; }).map(function (x) { return x.libelle; }),
      lecture: evaluables.length ? (score / evaluables.length >= 0.78 ? 'santé financière en amélioration sur tous les fronts'
        : score / evaluables.length >= 0.5 ? 'santé financière correcte, sans signal fort'
          : 'signaux de dégradation') : ND,
      exercices: [p.annee, c.annee]
    };
  }

  /* ── Score de qualité maison ──────────────────────────────────── */

  /* Cinq piliers notés de 0 à 20, dont la construction est affichée en
     entier dans l'interface. Ce n'est pas une note de marché mais une
     grille de lecture assumée, que l'utilisateur peut contester poste
     par poste. */
  /* Une banque ou une assurance ne se juge pas aux mêmes seuils qu'une
     société industrielle : son bilan EST son métier (les dépôts et
     emprunts interbancaires financent les crédits), une autonomie
     financière de 7 à 12 % y est la norme et non un signal de fragilité,
     et son « endettement » n'a pas la même lecture qu'une dette
     industrielle rapportée à l'excédent brut. Même logique déjà
     appliquée côté valorisation (voir POIDS_DEFAUT_FINANCIER dans
     af-valuation.js) : cette fonction est la source commune des deux. */
  function estFinancier(secteur) {
    return typeof secteur === 'string' && /financ|banque|assuran/i.test(secteur);
  }

  function qualite(rows, ratiosList, croissances, data) {
    if (rows.length < 2) return { enough: false, raison: 'deux exercices au minimum' };
    var n = ratiosList.length - 1;
    var r = ratiosList[n];
    var financier = estFinancier(data && (data.secteur || data.sousSecteur));
    var piliers = [];

    function pilier(nom, note, sur, motif, details) {
      piliers.push({ nom: nom, note: fin(note) ? Math.max(0, Math.min(sur, note)) : NaN, sur: sur, motif: motif, details: details || [] });
    }

    /* Rentabilité : ROE et marge nette, chacun sur dix points */
    var nRoe = fin(r.roe) ? (r.roe >= 0.20 ? 10 : r.roe >= 0.15 ? 8 : r.roe >= 0.10 ? 6 : r.roe >= 0.05 ? 3 : r.roe > 0 ? 1 : 0) : NaN;
    var nMarge = fin(r.margeNette) ? (r.margeNette >= 0.20 ? 10 : r.margeNette >= 0.12 ? 8 : r.margeNette >= 0.06 ? 6 : r.margeNette >= 0.02 ? 3 : r.margeNette > 0 ? 1 : 0) : NaN;
    pilier('Rentabilité', fin(nRoe) && fin(nMarge) ? nRoe + nMarge : NaN, 20,
      fin(r.roe) ? 'ROE de ' + (r.roe * 100).toFixed(1) + ' %, marge nette de ' + (fin(r.margeNette) ? (r.margeNette * 100).toFixed(1) : '—') + ' %' : ND,
      [{ l: 'ROE', n: nRoe, sur: 10 }, { l: 'Marge nette', n: nMarge, sur: 10 }]);

    /* Croissance : TCAM du chiffre d'affaires et régularité */
    var tc = croissances.ca && fin(croissances.ca.value) ? croissances.ca.value : NaN;
    var nTc = fin(tc) ? (tc >= 0.15 ? 12 : tc >= 0.08 ? 9 : tc >= 0.03 ? 6 : tc >= 0 ? 3 : 0) : NaN;
    var reg = croissances.regularite && fin(croissances.regularite.value) ? croissances.regularite.value : NaN;
    var nReg = fin(reg) ? Math.round(reg * 8) : NaN;
    pilier('Croissance', fin(nTc) && fin(nReg) ? nTc + nReg : NaN, 20,
      fin(tc) ? 'chiffre d\'affaires à ' + (tc * 100).toFixed(1) + ' % par an, en hausse ' +
        (croissances.regularite ? croissances.regularite.exercicesHausse + ' exercices sur ' + croissances.regularite.exercices : '') + ''
        : (croissances.ca && croissances.ca.raison) || ND,
      [{ l: 'Rythme', n: nTc, sur: 12 }, { l: 'Régularité', n: nReg, sur: 8 }]);

    /* Solidité : gearing, autonomie, dette sur excédent brut — sauf pour
       une banque ou un assureur, où « dette financière » et « excédent
       brut d'exploitation » ne se lisent pas comme chez un industriel
       (les dépôts et le refinancement interbancaire sont la matière
       première du métier, pas un levier au sens classique). On y
       substitue l'autonomie financière, jugée à l'aune du secteur
       bancaire (7 à 12 % y est courant, 50 % y serait impossible), et la
       rentabilité des actifs (ROA), l'indicateur de solidité standard
       pour un établissement de crédit. */
    var nGe, nAu, nDe, motifSolidite, detailSolidite;
    if (financier) {
      nGe = NaN;
      nAu = fin(r.autonomie) ? (r.autonomie >= 0.12 ? 10 : r.autonomie >= 0.09 ? 8 : r.autonomie >= 0.06 ? 6 : r.autonomie >= 0.04 ? 3 : 1) : NaN;
      var roa = r.roa;
      nDe = fin(roa) ? (roa >= 0.02 ? 10 : roa >= 0.015 ? 8 : roa >= 0.01 ? 6 : roa >= 0.005 ? 3 : roa > 0 ? 1 : 0) : NaN;
      motifSolidite = fin(r.autonomie) ? 'autonomie de ' + (r.autonomie * 100).toFixed(1) + ' % (repère bancaire, pas industriel), ROA de ' + (fin(roa) ? (roa * 100).toFixed(2) : '—') + ' %' : ND;
      detailSolidite = [{ l: 'Autonomie (repère bancaire)', n: nAu, sur: 10 }, { l: 'Rentabilité des actifs (ROA)', n: nDe, sur: 10 }];
      pilier('Solidité financière', fin(nAu) && fin(nDe) ? nAu + nDe : NaN, 20, motifSolidite, detailSolidite);
    } else {
      nGe = fin(r.gearing) ? (r.gearing <= 0.3 ? 8 : r.gearing <= 0.6 ? 6 : r.gearing <= 1 ? 4 : r.gearing <= 2 ? 2 : 0) : NaN;
      nAu = fin(r.autonomie) ? (r.autonomie >= 0.5 ? 6 : r.autonomie >= 0.35 ? 5 : r.autonomie >= 0.2 ? 3 : 1) : NaN;
      nDe = fin(r.detteEbitda) ? (r.detteEbitda <= 1 ? 6 : r.detteEbitda <= 2 ? 5 : r.detteEbitda <= 3 ? 3 : r.detteEbitda <= 4 ? 1 : 0) : (fin(r.gearing) ? 3 : NaN);
      pilier('Solidité financière', fin(nGe) && fin(nAu) ? nGe + nAu + (fin(nDe) ? nDe : 0) : NaN, 20,
        fin(r.gearing) ? 'levier de ' + r.gearing.toFixed(2) + ', autonomie de ' + (fin(r.autonomie) ? (r.autonomie * 100).toFixed(0) : '—') + ' %' : ND,
        [{ l: 'Levier', n: nGe, sur: 8 }, { l: 'Autonomie', n: nAu, sur: 6 }, { l: 'Dette / excédent brut', n: nDe, sur: 6 }]);
    }

    /* Qualité des flux : conversion en trésorerie et marge de flux libre */
    var nCv = fin(r.conversionCash) ? (r.conversionCash >= 1.1 ? 12 : r.conversionCash >= 0.9 ? 10 : r.conversionCash >= 0.7 ? 7 : r.conversionCash >= 0.4 ? 4 : r.conversionCash > 0 ? 2 : 0) : NaN;
    var nFcf = fin(r.margeFcf) ? (r.margeFcf >= 0.12 ? 8 : r.margeFcf >= 0.06 ? 6 : r.margeFcf >= 0.02 ? 4 : r.margeFcf > 0 ? 2 : 0) : NaN;
    pilier('Qualité des flux', fin(nCv) && fin(nFcf) ? nCv + nFcf : NaN, 20,
      fin(r.conversionCash) ? 'conversion de ' + r.conversionCash.toFixed(2) + ', marge de flux libre de ' + (fin(r.margeFcf) ? (r.margeFcf * 100).toFixed(1) : '—') + ' %' : ND,
      [{ l: 'Conversion en trésorerie', n: nCv, sur: 12 }, { l: 'Marge de flux libre', n: nFcf, sur: 8 }]);

    /* Retour à l'actionnaire : rendement et soutenabilité du dividende.
       Absence de donnée sur le DERNIER exercice ≠ absence de dividende :
       la société peut très bien verser un dividende régulier dont
       l'exercice le plus récent n'a simplement pas encore été publié ou
       saisi (cas fréquent : le DPA de l'exercice qui vient de clôturer
       arrive après le reste des comptes). Mettre 0 dans ce cas revient à
       compter une donnée manquante comme un fait défavorable avéré —
       exactement ce que ce module s'interdit partout ailleurs (cf.
       « Qualité des flux » juste au-dessus, qui exclut le pilier plutôt
       que de le noter à zéro). On applique donc la même règle ici : si
       aucun exercice récent ne permet de calculer un rendement, ou un
       historique de dividende, le pilier est exclu de la note globale au
       lieu d'être compté contre la société. Seul un dividende NUL déjà
       publié (payout à 0 sur un exercice renseigné) reste noté 0, à bon
       droit. */
    var dpaHistorique = rows.some(function (row) { return fin(row.dpa) && row.dpa > 0; });
    var nRd, nPo, motifRetour;
    if (fin(r.rendement)) {
      nRd = r.rendement >= 0.07 ? 10 : r.rendement >= 0.04 ? 8 : r.rendement >= 0.02 ? 5 : r.rendement > 0 ? 2 : 0;
      nPo = fin(r.payout) ? (r.payout <= 0 ? 0 : r.payout <= 0.5 ? 10 : r.payout <= 0.7 ? 8 : r.payout <= 0.9 ? 5 : r.payout <= 1 ? 2 : 0) : (r.rendement > 0 ? 4 : 0);
      motifRetour = r.rendement > 0
        ? 'rendement de ' + (r.rendement * 100).toFixed(2) + ' %, distribution de ' + (fin(r.payout) ? (r.payout * 100).toFixed(0) + ' %' : 'non déterminée')
        : 'aucun dividende identifié sur le dernier exercice';
    } else if (dpaHistorique) {
      nRd = NaN; nPo = NaN;
      motifRetour = 'dividende versé par le passé, mais non renseigné sur le dernier exercice publié : pilier non noté plutôt que compté à zéro';
    } else {
      nRd = NaN; nPo = NaN;
      motifRetour = ND;
    }
    pilier('Retour à l\'actionnaire', fin(nRd) && fin(nPo) ? nRd + nPo : NaN, 20, motifRetour,
      [{ l: 'Rendement', n: nRd, sur: 10 }, { l: 'Soutenabilité', n: nPo, sur: 10 }]);

    var notes = piliers.filter(function (p2) { return fin(p2.note); });
    var total = notes.reduce(function (s, p2) { return s + p2.note; }, 0);
    var sur = notes.reduce(function (s, p2) { return s + p2.sur; }, 0);
    var pct100 = sur ? total / sur * 100 : NaN;

    return {
      enough: notes.length >= 3,
      piliers: piliers,
      note: total, sur: sur, note100: pct100,
      pilliersManquants: piliers.filter(function (p2) { return !fin(p2.note); }).map(function (p2) { return p2.nom; }),
      mention: !fin(pct100) ? ND
        : pct100 >= 80 ? 'société de grande qualité financière'
          : pct100 >= 65 ? 'société solide'
            : pct100 >= 50 ? 'société correcte, avec des points de vigilance'
              : pct100 >= 35 ? 'société fragile sur plusieurs piliers'
                : 'situation financière préoccupante'
    };
  }

  /* ── Contrôle de cohérence des données ────────────────────────── */

  /* Une analyse ne vaut rien sur des données incohérentes. Ces
     vérifications ne corrigent rien : elles alertent. */
  function controles(rows, ratiosList) {
    var alertes = [];
    rows.forEach(function (r, i) {
      var pre = 'Exercice ' + r.annee + ' : ';
      if (fin(r.rn) && fin(r.ca) && r.ca > 0 && Math.abs(r.rn) > r.ca)
        alertes.push({ niveau: 'grave', txt: pre + 'le résultat net dépasse le chiffre d\'affaires en valeur absolue.' });
      if (fin(r.cp) && r.cp < 0)
        alertes.push({ niveau: 'grave', txt: pre + 'les capitaux propres sont négatifs.' });
      if (fin(r.cp) && fin(r.actif) && r.cp > r.actif)
        alertes.push({ niveau: 'grave', txt: pre + 'les capitaux propres dépassent le total du bilan.' });
      if (fin(r.rbe) && fin(r.rn) && r.rn > r.rbe && r.rbe > 0)
        alertes.push({ niveau: 'moyen', txt: pre + 'le résultat net dépasse le résultat brut d\'exploitation, ce qui suppose des produits hors exploitation importants.' });
      if (r.actionsEstimees)
        alertes.push({ niveau: 'info', txt: pre + 'nombre d\'actions non publié, celui de l\'exercice le plus récent a été retenu.' });
      if (r.bpaCalcule && fin(r.bpa))
        alertes.push({ niveau: 'info', txt: pre + 'bénéfice par action reconstitué à partir du résultat net et du nombre d\'actions.' });
      var rr = ratiosList[i];
      if (rr && fin(rr.conversionCash) && rr.conversionCash < 0.4 && fin(r.rn) && r.rn > 0)
        alertes.push({ niveau: 'moyen', txt: pre + 'moins de 40 % du résultat net se retrouve en trésorerie opérationnelle.' });
      if (fin(rr && rr.payout) && rr.payout > 1)
        alertes.push({ niveau: 'moyen', txt: pre + 'le dividende dépasse le bénéfice de l\'exercice.' });
    });
    if (rows.length && !fin(rows[rows.length - 1].treso))
      alertes.push({ niveau: 'info', txt: 'La trésorerie n\'est pas publiée : la dette nette est assimilée à la dette financière brute, ce qui surestime l\'endettement réel.' });
    var manque = rows.length ? Math.max(0, new Date().getFullYear() - 1 - rows[rows.length - 1].annee) : 0;
    if (manque >= 2)
      alertes.push({ niveau: 'moyen', txt: 'Le dernier exercice disponible remonte à ' + rows[rows.length - 1].annee + '. Les ratios de valorisation rapportent un cours d\'aujourd\'hui à des comptes anciens.' });
    return alertes;
  }

  /* ── Assemblage ───────────────────────────────────────────────── */

  function analyse(ticker, overrides) {
    var d = build(ticker, overrides);
    if (!d.rows.length) return { enough: false, data: d, raison: 'aucun exercice annuel disponible pour ce titre' };

    var years = d.rows.map(function (r) { return r.annee; });
    var ratiosList = d.rows.map(function (r, i) { return ratios(r, i ? d.rows[i - 1] : null, d.price, d.shares); });

    var serie = function (k) { return d.rows.map(function (r) { return r[k]; }); };
    var croissances = {
      ca: tcam(serie('ca'), years),
      rbe: tcam(serie('rbe'), years),
      rn: tcam(serie('rn'), years),
      fcf: tcam(serie('fcf'), years),
      bpa: tcam(serie('bpa'), years),
      dpa: tcam(serie('dpa'), years),
      cp: tcam(serie('cp'), years),
      regularite: regularite(serie('ca')),
      regCa: regression(years, serie('ca')),
      regRn: regression(years, serie('rn')),
      regFcf: regression(years, serie('fcf'))
    };

    return {
      enough: true,
      data: d,
      years: years,
      rows: d.rows,
      ratios: ratiosList,
      dernier: ratiosList[ratiosList.length - 1],
      dernierExercice: d.rows[d.rows.length - 1],
      croissances: croissances,
      piotroski: piotroski(d.rows, ratiosList),
      qualite: qualite(d.rows, ratiosList, croissances, d),
      alertes: controles(d.rows, ratiosList),
      moyennes: {
        roe: mean(ratiosList.map(function (r) { return r.roe; })),
        margeNette: mean(ratiosList.map(function (r) { return r.margeNette; })),
        margeBrute: mean(ratiosList.map(function (r) { return r.margeBrute; })),
        per: mean(ratiosList.map(function (r) { return r.per; })),
        perMediane: median(ratiosList.map(function (r) { return r.per; })),
        payout: mean(ratiosList.map(function (r) { return r.payout; })),
        conversionCash: mean(ratiosList.map(function (r) { return r.conversionCash; })),
        capexCa: mean(ratiosList.map(function (r) { return r.capexCa; })),
        margeFcf: mean(ratiosList.map(function (r) { return r.margeFcf; }))
      }
    };
  }

  /* ── Périodes intermédiaires (trimestres et semestres) ────────────

     La source publie parfois un trimestre isolé (T1), parfois un cumul
     (S1, l'annuel), rarement les quatre trimestres. Un même exercice
     peut ainsi avoir T1 et S1 connus mais pas T2 : comme S1 = T1 + T2
     par construction comptable, T2 se déduit par soustraction plutôt
     que d'être laissé vide alors qu'il est parfaitement déterminé.
     Seules les grandeurs de flux (compte de résultat) s'additionnent
     ainsi sur une période — un bilan (capitaux propres, dette...) est
     une photo à une date, pas une somme de trimestres : il est donc
     exclu de cette reconstruction. */

  var FLUX_INTER = ['ca', 'rbe', 'rn'];
  /* T3 est le trimestre isolé (« réel »), m9 le cumul des neuf premiers mois tel
     que publié au 30 septembre : les deux se lisent côte à côte. */
  var LABEL_PERIODE = { t1: 'T1', t2: 'T2', t3: 'T3', t4: 'T4', s1: 'S1', s2: 'S2', m9: '9 mois', annuel: 'Annuel' };

  /* Une valeur déduite plutôt que publiée est marquée `brut:false` pour
     que l'interface la distingue visuellement, exactement comme les
     données saisies manuellement ailleurs dans ce module. Deux passes
     suffisent : la première résout les cas directs (T2 = S1 − T1, T4 =
     Annuel − T1 − T2 − T3), la seconde profite des valeurs que la
     première vient de déduire (S1 déduit de T1 + T2 permet alors de
     déduire S2 = Annuel − S1). */
  function resoudPeriode(v) {
    for (var pass = 0; pass < 2; pass++) {
      if (v.t1 && v.s1 && !v.t2) v.t2 = { valeur: v.s1.valeur - v.t1.valeur, brut: false };
      if (v.t2 && v.s1 && !v.t1) v.t1 = { valeur: v.s1.valeur - v.t2.valeur, brut: false };
      if (v.t1 && v.t2 && !v.s1) v.s1 = { valeur: v.t1.valeur + v.t2.valeur, brut: false };
      if (v.t1 && v.t2 && v.t3 && v.annuel && !v.t4) v.t4 = { valeur: v.annuel.valeur - v.t1.valeur - v.t2.valeur - v.t3.valeur, brut: false };
      if (v.t3 && v.t4 && !v.s2) v.s2 = { valeur: v.t3.valeur + v.t4.valeur, brut: false };
      if (v.s1 && v.annuel && !v.s2) v.s2 = { valeur: v.annuel.valeur - v.s1.valeur, brut: false };
      if (v.s2 && v.annuel && !v.s1) v.s1 = { valeur: v.annuel.valeur - v.s2.valeur, brut: false };
      if (v.s1 && v.s2 && !v.annuel) v.annuel = { valeur: v.s1.valeur + v.s2.valeur, brut: false };
      if (v.t3 && v.s2 && !v.t4) v.t4 = { valeur: v.s2.valeur - v.t3.valeur, brut: false };
      /* Cumul 9 mois publié : T3 réel = 9 mois − S1 (ou − T1 − T2), T4 = annuel − 9 mois ;
         et inversement le cumul se reconstitue quand T1, T2, T3 sont connus. */
      if (v.m9 && v.s1 && !v.t3) v.t3 = { valeur: v.m9.valeur - v.s1.valeur, brut: false };
      if (v.m9 && v.t1 && v.t2 && !v.t3) v.t3 = { valeur: v.m9.valeur - v.t1.valeur - v.t2.valeur, brut: false };
      if (v.m9 && v.annuel && !v.t4) v.t4 = { valeur: v.annuel.valeur - v.m9.valeur, brut: false };
      if (v.t1 && v.t2 && v.t3 && !v.m9) v.m9 = { valeur: v.t1.valeur + v.t2.valeur + v.t3.valeur, brut: false };
    }
    return v;
  }

  /* Reconstitue, pour un champ de flux et une année, les six périodes
     possibles (t1..t4, s1, s2) à partir de ce que la source publie
     réellement pour cet exercice. */
  function periodesAnnee(byPeriode, champ) {
    var v = {};
    /* T4 et S2 ne sont quasiment jamais publiés tels quels sur la BRVM,
       mais si la source les tague un jour explicitement, ils comptent
       comme bruts au même titre que les autres plutôt que d'être ignorés. */
    ['t1', 't2', 't3', 't4', 's1', 's2', 'm9', 'annuel'].forEach(function (p) {
      var row = byPeriode[p];
      var val = row ? row[champ] : NaN;
      v[p] = fin(val) ? { valeur: val, brut: true } : null;
    });
    return resoudPeriode(v);
  }

  /* Croissance d'une période par rapport à la MÊME période de l'exercice
     précédent — jamais un trimestre contre un semestre, qui n'auraient
     rien de comparable. */
  function croissancePeriode(cur, prev) {
    if (!cur || !prev || !pos(prev.valeur)) return NaN;
    return cur.valeur / prev.valeur - 1;
  }

  /* Cumul depuis le début de l'exercice, borné au dernier trimestre
     entièrement déterminé (publié ou déduit) : s'arrêter avant plutôt
     que d'agréger un trimestre manquant comme s'il valait zéro. */
  function cumulPartiel(v) {
    var n = 0, somme = 0;
    for (var i = 1; i <= 3; i++) {
      var p = v['t' + i];
      if (!p) break;
      somme += p.valeur; n = i;
    }
    if (n > 0) return { n: n, valeur: somme, label: n === 1 ? 'T1' : 'T1–T' + n };
    if (v.s1) return { n: 2, valeur: v.s1.valeur, label: 'S1' };
    return null;
  }

  function intermediaire(ticker) {
    var q = norm(ticker);
    var all = Array.isArray(global.allFinancials) ? global.allFinancials : [];
    var rows = all.filter(function (f) { return norm(f.ticker) === q; }).map(normalizeRow)
      .filter(function (f) { return fin(f.annee); });
    if (!rows.length) return { enough: false, raison: 'aucun état financier disponible pour ce titre' };

    /* Une correction publiée plus tard écrase la version précédente du
       même exercice et de la même période, comme pour la série annuelle. */
    var parAnnee = {};
    rows.forEach(function (r) {
      parAnnee[r.annee] = parAnnee[r.annee] || {};
      parAnnee[r.annee][r.periode || 'annuel'] = r;
    });
    var annees = Object.keys(parAnnee).map(Number).sort(function (a, b) { return a - b; });

    var champs = {};
    FLUX_INTER.forEach(function (c) {
      champs[c] = {};
      annees.forEach(function (y) { champs[c][y] = periodesAnnee(parAnnee[y], c); });
    });

    var aDesPeriodes = annees.some(function (y) {
      return ['t1', 't2', 't3', 's1', 'm9'].some(function (p) { return !!parAnnee[y][p]; });
    });
    if (!aDesPeriodes) return { enough: false, raison: 'seuls des exercices annuels complets sont disponibles, aucun trimestre ni semestre publié' };

    var derniere = annees[annees.length - 1];

    /* Comparaisons d'une période à la même période l'an dernier, pour
       chaque type de période effectivement publié ou déduit sur le
       dernier exercice — jamais deux périodes de nature différente. */
    var comparaisons = [];
    ['t1', 't2', 't3', 's1', 'm9'].forEach(function (p) {
      var cur = champs.ca[derniere] ? champs.ca[derniere][p] : null;
      if (!cur) return;
      var champsPeriode = {};
      FLUX_INTER.forEach(function (c) {
        var cv = champs[c][derniere][p];
        var pv = champs[c][derniere - 1] ? champs[c][derniere - 1][p] : null;
        champsPeriode[c] = { valeur: cv, croissance: croissancePeriode(cv, pv), precedent: pv };
      });
      comparaisons.push({ periode: p, label: LABEL_PERIODE[p], annee: derniere, brut: cur.brut, champs: champsPeriode });
    });

    /* Cumul depuis le début du dernier exercice contre le même point de
       l'exercice précédent : la question qu'un investisseur pose le
       plus souvent en cours d'année — « fait-on mieux que l'an dernier
       à date comparable ? » — plutôt qu'un trimestre isolé. */
    var ytd = null;
    var reachCourant = cumulPartiel(champs.ca[derniere]);
    if (reachCourant) {
      var ytdChamps = {};
      FLUX_INTER.forEach(function (c) {
        var v = champs[c][derniere], vp = champs[c][derniere - 1];
        function cumul(vv, n) {
          if (!vv) return NaN;
          if (n === 2 && vv.s1) return vv.s1.valeur;
          var s = 0;
          for (var i = 1; i <= n; i++) { if (!vv['t' + i]) return NaN; s += vv['t' + i].valeur; }
          return s;
        }
        var courant = cumul(v, reachCourant.n);
        var precedent = cumul(vp, reachCourant.n);
        ytdChamps[c] = { courant: courant, precedent: precedent, croissance: fin(courant) && pos(precedent) ? courant / precedent - 1 : NaN };
      });
      ytd = { annee: derniere, anneePrecedente: derniere - 1, label: reachCourant.label, champs: ytdChamps };
    }

    /* Saisonnalité : part moyenne du chiffre d'affaires réalisée dans
       chaque trimestre (ou, à défaut, chaque semestre) sur l'ensemble
       des exercices où le rapprochement à l'annuel est possible — publié
       ou déduit, peu importe, la part relative est la même identité
       comptable dans les deux cas. */
    var partsTrim = { t1: [], t2: [], t3: [], t4: [] };
    var partsSem = { s1: [], s2: [] };
    annees.forEach(function (y) {
      var v = champs.ca[y];
      if (!v || !v.annuel || !pos(v.annuel.valeur)) return;
      ['t1', 't2', 't3', 't4'].forEach(function (p) { if (v[p]) partsTrim[p].push(v[p].valeur / v.annuel.valeur); });
      ['s1', 's2'].forEach(function (p) { if (v[p]) partsSem[p].push(v[p].valeur / v.annuel.valeur); });
    });
    var nAnneesTrim = Math.max(partsTrim.t1.length, partsTrim.t2.length, partsTrim.t3.length, partsTrim.t4.length);
    var saisonnalite = null;
    if (nAnneesTrim >= 1) {
      var partsT = { t1: mean(partsTrim.t1), t2: mean(partsTrim.t2), t3: mean(partsTrim.t3), t4: mean(partsTrim.t4) };
      var maxP = -1, maxK = null;
      ['t1', 't2', 't3', 't4'].forEach(function (k) { if (fin(partsT[k]) && partsT[k] > maxP) { maxP = partsT[k]; maxK = k; } });
      saisonnalite = {
        granularite: 'trimestre', parts: partsT, exercices: nAnneesTrim,
        marquee: fin(maxP) && maxP - 0.25 > 0.08,
        dominante: maxK, dominanteLabel: maxK ? LABEL_PERIODE[maxK] : null,
        verdict: !fin(maxP) ? ND
          : (maxP - 0.25 > 0.08 ? LABEL_PERIODE[maxK] + ' concentre en moyenne ' + Math.round(maxP * 100) + ' % du chiffre d\'affaires annuel : activité nettement saisonnière.'
            : 'Le chiffre d\'affaires se répartit assez régulièrement sur l\'année, sans trimestre nettement dominant.')
      };
    } else if (partsSem.s1.length || partsSem.s2.length) {
      var partsS = { s1: mean(partsSem.s1), s2: mean(partsSem.s2) };
      var ecart = fin(partsS.s1) ? partsS.s1 - 0.5 : (fin(partsS.s2) ? 0.5 - partsS.s2 : NaN);
      saisonnalite = {
        granularite: 'semestre', parts: partsS, exercices: Math.max(partsSem.s1.length, partsSem.s2.length),
        marquee: fin(ecart) && Math.abs(ecart) > 0.08,
        dominante: fin(ecart) ? (ecart > 0 ? 's1' : 's2') : null,
        dominanteLabel: fin(ecart) ? (ecart > 0 ? 'S1' : 'S2') : null,
        verdict: !fin(ecart) ? ND
          : (Math.abs(ecart) > 0.08 ? (ecart > 0 ? 'S1' : 'S2') + ' concentre en moyenne ' + Math.round((ecart > 0 ? partsS.s1 : partsS.s2) * 100) + ' % du chiffre d\'affaires annuel : activité plus soutenue sur ce semestre.'
            : 'Le chiffre d\'affaires se répartit assez également entre les deux semestres.')
      };
    }

    return {
      enough: true,
      annees: annees,
      champs: champs,
      derniere: derniere,
      comparaisons: comparaisons,
      ytd: ytd,
      saisonnalite: saisonnalite,
      labels: LABEL_PERIODE
    };
  }

  /* ── Comparaison sectorielle ──────────────────────────────────── */

  function univers(filtre) {
    var all = Array.isArray(global.allFinancials) ? global.allFinancials : [];
    var tickers = {};
    all.forEach(function (f) { if (f && f.ticker) tickers[String(f.ticker).toUpperCase()] = 1; });
    var out = [];
    Object.keys(tickers).forEach(function (t) {
      var a = analyse(t);
      if (!a.enough) return;
      if (filtre && !filtre(a)) return;
      out.push(a);
    });
    return out;
  }

  /* Comparer une banque à l'ensemble du marché (industriels, télécoms,
     biens de consommation compris) produit un PER ou un PBR médian sans
     signification : les niveaux de multiples n'ont rien à voir d'un
     secteur à l'autre. La portée par défaut est donc le sous-secteur
     (« Banque », « Assurance »…), avec repli progressif si le groupe de
     pairs est trop restreint pour qu'une médiane soit robuste, jusqu'au
     marché entier en dernier recours — et dans ce cas, la portée
     réellement utilisée est renvoyée pour être affichée telle quelle. */
  function comparables(ticker, opts) {
    opts = opts || {};
    var base = analyse(ticker);
    if (!base.enough) return null;
    var secteur = base.data.secteur;
    var sousSecteur = base.data.sousSecteur;
    var tous = univers();
    var autres = tous.filter(function (a) { return norm(a.data.ticker) !== norm(ticker); });

    function memes(cle, valeur) {
      if (!valeur) return [];
      return autres.filter(function (a) { return norm(a.data[cle]) === norm(valeur); });
    }

    var portee = opts.portee || 'sousSecteur';
    var pairs, porteeEffective, repli = null;
    var MIN_PAIRS = 2;

    if (portee === 'marche') {
      pairs = autres; porteeEffective = 'marche';
    } else if (portee === 'secteur') {
      pairs = memes('secteur', secteur); porteeEffective = 'secteur';
      if (pairs.length < MIN_PAIRS) { pairs = autres; porteeEffective = 'marche'; repli = 'secteur'; }
    } else {
      pairs = memes('sousSecteur', sousSecteur); porteeEffective = 'sousSecteur';
      if (pairs.length < MIN_PAIRS) {
        var parSecteur = memes('secteur', secteur);
        if (parSecteur.length >= MIN_PAIRS) { pairs = parSecteur; porteeEffective = 'secteur'; repli = 'sousSecteur'; }
        else { pairs = autres; porteeEffective = 'marche'; repli = 'sousSecteur'; }
      }
    }

    /* Deux réglages laissés à l'utilisateur plutôt que tranchés une fois
       pour toutes dans le code : quelles sociétés du groupe comptent
       vraiment comme comparables (un pair dont le bénéfice est tombé
       presque à zéro produit un PER ou un PBR qui n'a plus rien
       d'économique — à chacun de juger, au cas par cas, si BOAN ou SAFC
       par exemple doivent peser dans la médiane du secteur bancaire), et
       la statistique elle-même : médiane (recommandée, insensible aux
       valeurs extrêmes) ou moyenne simple (plus sensible, parfois voulue
       délibérément). L'exclusion ne rétrécit pas la portée choisie
       ci-dessus : elle retire des sociétés précises du groupe déjà
       retenu, sans déclencher de repli vers une portée plus large. */
    var exclus = {};
    (opts.exclus || []).forEach(function (t) { if (t) exclus[norm(t)] = 1; });
    var pairsRetenus = pairs.filter(function (a) { return !exclus[norm(a.data.ticker)]; });
    var stat = opts.stat === 'mediane' ? 'mediane' : 'moyenne';
    var agrege = stat === 'moyenne' ? mean : median;

    function col(k) { return pairsRetenus.map(function (a) { return a.dernier[k]; }).filter(function (v) { return fin(v) && v > 0 && v < 500; }); }
    return {
      base: base,
      pairs: pairs,
      pairsRetenus: pairsRetenus,
      exclus: exclus,
      stat: stat,
      secteur: secteur,
      sousSecteur: sousSecteur,
      portee: porteeEffective,
      porteeDemandee: portee,
      repli: repli,
      medianes: {
        per: agrege(col('per')), pbr: agrege(col('pbr')), psr: agrege(col('psr')),
        evEbitda: agrege(col('evEbitda')), rendement: agrege(pairsRetenus.map(function (a) { return a.dernier.rendement; })),
        roe: agrege(pairsRetenus.map(function (a) { return a.dernier.roe; })),
        margeNette: agrege(pairsRetenus.map(function (a) { return a.dernier.margeNette; })),
        gearing: agrege(pairsRetenus.map(function (a) { return a.dernier.gearing; }))
      }
    };
  }

  global.AFCore = {
    ND: ND,
    num: num, fin: fin, pos: pos, div: div, norm: norm,
    mean: mean, median: median, stdev: stdev,
    CHAMPS: CHAMPS,
    normalizeRow: normalizeRow,
    build: build,
    ratios: ratios,
    tcam: tcam,
    regression: regression,
    regularite: regularite,
    piotroski: piotroski,
    qualite: qualite,
    controles: controles,
    analyse: analyse,
    intermediaire: intermediaire,
    univers: univers,
    comparables: comparables,
    estFinancier: estFinancier
  };
})(typeof window !== 'undefined' ? window : globalThis);
