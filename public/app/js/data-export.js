/* ============================================================================
   THE CAPITAL — Export des données financières (Excel / PDF)
   ----------------------------------------------------------------------------
   Réservé à la formule Professional : la lecture /api/marche?type=export_financier
   est refusée par le serveur (402) aux autres formules, le bouton n'est donc
   pas qu'une façade. Le fichier est composé dans le navigateur :
     - Excel : un onglet par jeu de données (sociétés, comptes annuels complets,
       publications intermédiaires, ratios calculés, dividendes, cours) et, pour
       une société seule, une synthèse « exercices en colonnes » ;
     - PDF   : un rapport par société (fiche, ratios, comptes annuels en
       colonnes, intermédiaires, dividendes), A4 paysage.
   Bibliothèques chargées à la demande depuis cdnjs (SheetJS, jsPDF + autoTable).
   ========================================================================== */
(function (w, d) {
  'use strict';
  if (w.TCExport) return;

  var LIBS = {
    xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    autotable: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
  };
  var UPGRADE = '/payment.html?plan=pro&period=monthly';

  /* Libellés de toutes les colonnes de la table financials, groupées comme
     dans les états SYSCOHADA. Les colonnes techniques sont exclues. */
  var GROUPS = [
    ['Compte de résultat', [
      ['chiffre_affaires', "Chiffre d'affaires / PNB"], ['ventes_marchandises', 'Ventes de marchandises'], ['achats_marchandises', 'Achats de marchandises'],
      ['marge_commerciale', 'Marge commerciale'], ['production_vendue', 'Production vendue'], ['autres_produits_exploitation', "Autres produits d'exploitation"],
      ['consommations_intermediaires', 'Consommations intermédiaires'], ['valeur_ajoutee', 'Valeur ajoutée'], ['charges_personnel', 'Charges de personnel'],
      ['impots_taxes', 'Impôts et taxes'], ['excedent_brut_exploitation', "Excédent brut d'exploitation"], ['rbe', "Résultat brut d'exploitation"],
      ['ebitda', 'EBITDA'], ['dotations_amortissements', 'Dotations aux amortissements'], ['resultat_exploitation', "Résultat d'exploitation"], ['ebit', 'EBIT'],
      ['produits_financiers', 'Produits financiers'], ['charges_financieres', 'Charges financières'], ['resultat_financier', 'Résultat financier'],
      ['resultat_activites_ordinaires', 'Résultat des activités ordinaires'], ['produits_hao', 'Produits HAO'], ['charges_hao', 'Charges HAO'], ['resultat_hao', 'Résultat HAO'],
      ['impot_sur_resultat', 'Impôt sur le résultat'], ['resultat_net', 'Résultat net']]],
    ['Bilan — actif', [
      ['immobilisations_incorporelles', 'Immobilisations incorporelles'], ['immobilisations_corporelles', 'Immobilisations corporelles'],
      ['immobilisations_financieres', 'Immobilisations financières'], ['actif_immobilise', 'Actif immobilisé'], ['stocks', 'Stocks'],
      ['creances_clients', 'Créances clients'], ['autres_creances', 'Autres créances'], ['actif_circulant', 'Actif circulant'],
      ['tresorerie_actif', 'Trésorerie actif'], ['total_actif', 'Total actif']]],
    ['Bilan — passif', [
      ['capital_social', 'Capital social'], ['primes_reserves', 'Primes et réserves'], ['report_a_nouveau', 'Report à nouveau'],
      ['capitaux_propres', 'Capitaux propres'], ['fonds_propres', 'Fonds propres'], ['emprunts_dettes_financieres', 'Emprunts et dettes financières'],
      ['provisions_risques_charges', 'Provisions pour risques et charges'], ['dettes_financieres_total', 'Dettes financières (total)'],
      ['dettes_financieres', 'Dettes financières'], ['dette_fin', 'Dette financière'], ['dette_nette', 'Dette nette'], ['dettes_fournisseurs', 'Dettes fournisseurs'],
      ['autres_dettes', 'Autres dettes'], ['passif_circulant', 'Passif circulant'], ['tresorerie_passif', 'Trésorerie passif'], ['total_passif', 'Total passif']]],
    ['Flux de trésorerie', [
      ['capacite_autofinancement', "Capacité d'autofinancement"], ['variation_bfr', 'Variation du BFR'],
      ['flux_activites_operationnelles', 'Flux des activités opérationnelles'], ['cash_flow_operationnel', 'Cash-flow opérationnel'],
      ['acquisitions_immobilisations', "Acquisitions d'immobilisations"], ['cessions_immobilisations', "Cessions d'immobilisations"], ['capex', 'CAPEX'],
      ['flux_activites_investissement', "Flux d'investissement"], ['augmentation_capital', 'Augmentation de capital'], ['dividendes_verses', 'Dividendes versés'],
      ['flux_capitaux_propres', 'Flux des capitaux propres'], ['emprunts_nouveaux', 'Nouveaux emprunts'], ['remboursements_emprunts', "Remboursements d'emprunts"],
      ['flux_capitaux_etrangers', 'Flux des capitaux étrangers'], ['variation_tresorerie_nette', 'Variation de trésorerie nette'],
      ['tresorerie_ouverture', "Trésorerie d'ouverture"], ['tresorerie_cloture', 'Trésorerie de clôture']]],
    ['Données par action et marché', [
      ['nombre_actions', "Nombre d'actions"], ['nb_actions', "Nombre d'actions (autre source)"], ['facteur_actions', "Facteur d'ajustement des actions"],
      ['bpa', 'BPA (FCFA)'], ['dpa', 'DPA brut (FCFA)'], ['cap_boursiere', 'Capitalisation boursière'], ['ev', "Valeur d'entreprise"]]],
    ['Ratios publiés', [
      ['marge_nette', 'Marge nette publiée'], ['roe', 'ROE publié'], ['roa', 'ROA publié'], ['payout_ratio', 'Taux de distribution publié'],
      ['dividend_yield', 'Rendement publié'], ['rendement_dividende', 'Rendement du dividende publié']]]
  ];
  var META = [['ticker', 'Ticker'], ['annee', 'Exercice'], ['periode', 'Période'], ['date_arrete', "Date d'arrêté"], ['date_publication', 'Date de publication'],
    ['devise', 'Devise'], ['unite', 'Unité'], ['statut_audit', 'Audit'], ['validation_status', 'Statut The Capital'], ['source', 'Source'], ['source_url', 'Lien source'], ['source_page', 'Page']];
  var PERIOD_LABEL = { annuel: 'Annuel', S1: 'S1 (cumul 6 mois)', S2: 'S2', Q1: 'T1', Q2: 'T2', Q3: 'T3', Q4: 'T4', '9M': '9 mois (cumul)', TTM: '12 mois glissants' };
  var STATUS_LABEL = { validated: 'Validé', review: 'En revue', draft: 'Brouillon' };

  function esc(v) { var e = d.createElement('div'); e.textContent = v == null ? '' : String(v); return e.innerHTML; }
  function num(v) { if (v === null || v === undefined || v === '') return null; var n = Number(v); return Number.isFinite(n) ? n : null; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function fmt(v, dec) {
    var n = num(v); if (n === null) return '—';
    return n.toLocaleString('fr-FR', { maximumFractionDigits: dec == null ? 0 : dec }).replace(/ | /g, ' ');
  }
  function mFcfa(v) { var n = num(v); return n === null ? '—' : fmt(n / 1e6, Math.abs(n) < 1e8 ? 1 : 0); }
  function pctTxt(v) { return v == null || !Number.isFinite(v) ? '—' : (v * 100).toFixed(1).replace('.', ',') + ' %'; }
  function ratio(a, b) { a = num(a); b = num(b); return a !== null && b !== null && b !== 0 ? a / b : null; }
  function cp(f) { return num(f.capitaux_propres != null ? f.capitaux_propres : f.fonds_propres); }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (d.querySelector('script[data-tc-lib="' + src + '"]')) return resolve();
      var s = d.createElement('script'); s.src = src; s.async = true; s.dataset.tcLib = src;
      s.onload = function () { resolve(); }; s.onerror = function () { reject(new Error('Bibliothèque indisponible : ' + src)); };
      d.head.appendChild(s);
    });
  }

  function token() {
    try { var raw = JSON.parse(localStorage.getItem('tc_session') || 'null'); var s = raw && (raw.data && raw.data.session || raw.session || raw); return s && s.access_token || ''; }
    catch (e) { return ''; }
  }

  function canExport() { return !w.TC || typeof w.TC.can !== 'function' || w.TC.can('export_donnees'); }

  async function fetchData(tickers, withHistory) {
    var qs = 'type=export_financier' + (tickers && tickers.length ? '&tickers=' + encodeURIComponent(tickers.join(',')) : '') + (withHistory ? '&historique=1' : '');
    var r = await fetch('/api/marche?' + qs, { headers: { Authorization: 'Bearer ' + token(), Accept: 'application/json' }, cache: 'no-store' });
    var body = await r.json().catch(function () { return {}; });
    if (r.status === 402) { var e = new Error('PLAN_REQUIRED'); e.code = 'PLAN_REQUIRED'; throw e; }
    if (!r.ok) throw new Error(body.error || body.message || ('Export impossible (HTTP ' + r.status + ').'));
    return body.data || body;
  }

  /* ── Mise en forme commune ─────────────────────────────────────────── */

  function prepare(data) {
    var ents = {}; (data.entreprises || []).forEach(function (e) { ents[String(e.ticker).toUpperCase()] = e; });
    var px = {}; (data.cours || []).forEach(function (c) { px[String(c.ticker).toUpperCase()] = c; });
    var fins = (data.financials || []).slice().sort(function (a, b) {
      return String(a.ticker).localeCompare(String(b.ticker)) || Number(b.annee) - Number(a.annee) || String(a.periode || '').localeCompare(String(b.periode || ''));
    });
    var used = {}; fins.forEach(function (f) { GROUPS.forEach(function (g) { g[1].forEach(function (c) { if (num(f[c[0]]) !== null) used[c[0]] = true; }); }); });
    var cols = []; GROUPS.forEach(function (g) { g[1].forEach(function (c) { if (used[c[0]]) cols.push(c); }); });
    var tickers = Object.keys(fins.reduce(function (m, f) { m[String(f.ticker).toUpperCase()] = 1; return m; }, {})).sort();
    return { ents: ents, px: px, fins: fins, cols: cols, tickers: tickers, data: data };
  }

  /* Ratios calculés par exercice, au dernier cours connu. */
  function ratiosFor(f, P) {
    var t = String(f.ticker).toUpperCase(), ent = P.ents[t] || {}, price = num((P.px[t] || {}).cours);
    var shares = num(f.nombre_actions) || num(f.nb_actions) || num(ent.nombre_actions) || num(ent.nb_actions);
    var c = cp(f), bvps = c !== null && shares ? c / shares : null;
    var annual = !f.periode || f.periode === 'annuel';
    return {
      marge_nette: ratio(f.resultat_net, f.chiffre_affaires),
      roe: c > 0 ? ratio(f.resultat_net, c) : null,
      roa: ratio(f.resultat_net, f.total_actif),
      dette_cp: c > 0 ? ratio(f.dettes_financieres_total != null ? f.dettes_financieres_total : f.dettes_financieres, c) : null,
      per: annual && price && num(f.bpa) > 0 ? price / num(f.bpa) : null,
      pb: price && bvps > 0 ? price / bvps : null,
      rendement: annual && price && num(f.dpa) !== null ? num(f.dpa) / price : null,
      payout: annual && num(f.bpa) > 0 && num(f.dpa) !== null ? num(f.dpa) / num(f.bpa) : null,
      bvps: bvps, price: price, shares: shares
    };
  }

  /* ── Excel ─────────────────────────────────────────────────────────── */

  var FMT = { amount: '#,##0', perShare: '#,##0.00', pct: '0.0%', mult: '0.00"x"' };
  /* Format de nombre par colonne (index → format), appliqué sous l'en-tête. */
  function applyFormats(XLSX, ws, formats) {
    if (!formats || !ws['!ref']) return;
    var range = XLSX.utils.decode_range(ws['!ref']);
    for (var r = 1; r <= range.e.r; r++) {
      Object.keys(formats).forEach(function (c) {
        var cell = ws[XLSX.utils.encode_cell({ r: r, c: Number(c) })];
        if (cell && cell.t === 'n') cell.z = formats[c];
      });
    }
  }

  function sheetFromRows(XLSX, header, rows, widths, formats) {
    var ws = XLSX.utils.aoa_to_sheet([header].concat(rows));
    applyFormats(XLSX, ws, formats);
    ws['!cols'] = header.map(function (h, i) { return { wch: widths && widths[i] || Math.min(Math.max(String(h).length + 2, 10), 40) }; });
    ws['!freeze'] = { xSplit: 1, ySplit: 1 };
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }) };
    return ws;
  }

  async function toExcel(P, opts) {
    await loadScript(LIBS.xlsx);
    var XLSX = w.XLSX, wb = XLSX.utils.book_new();
    var annual = P.fins.filter(function (f) { return !f.periode || f.periode === 'annuel'; });
    var interim = P.fins.filter(function (f) { return f.periode && f.periode !== 'annuel'; });

    var readme = [
      ['The Capital — export des données financières'], [''],
      ['Généré le', new Date().toLocaleString('fr-FR')], ['Sociétés', P.tickers.length], ['Lignes de comptes', P.fins.length], [''],
      ['Unités', 'Montants des comptes en FCFA (unités, non en millions), sauf BPA et DPA en FCFA par action.'],
      ['Ratios calculés', 'Calculés par The Capital au dernier cours connu ; PER, rendement et payout sur les exercices annuels uniquement.'],
      ['Statut The Capital', '« Validé » : contrôlé deux fois ; « En revue » : issu des publications officielles, contrôle en cours.'],
      ['Périodes', 'S1 et 9 mois sont des cumuls depuis le 1er janvier ; T1 à T4 sont des trimestres isolés.'],
      ['Usage', "Données fournies à titre d'information, sans valeur de conseil. Redistribution soumise aux conditions d'utilisation de The Capital."]
    ];
    var wsR = XLSX.utils.aoa_to_sheet(readme); wsR['!cols'] = [{ wch: 22 }, { wch: 110 }];
    XLSX.utils.book_append_sheet(wb, wsR, 'Lisez-moi');

    if (P.tickers.length === 1) XLSX.utils.book_append_sheet(wb, synthesisSheet(XLSX, P, P.tickers[0]), 'Synthèse ' + P.tickers[0]);

    var entCols = [['ticker', 'Ticker'], ['nom', 'Société'], ['secteur', 'Secteur'], ['sous_secteur', 'Sous-secteur'], ['pays', 'Pays'], ['compartiment', 'Compartiment'],
      ['code_isin', 'ISIN'], ['nombre_actions', "Nombre d'actions"], ['flottant_pct', 'Flottant (%)'], ['valeur_nominale', 'Valeur nominale'],
      ['date_introduction', 'Introduction'], ['pdg', 'Président'], ['dg', 'Directeur général'], ['siege_social', 'Siège'], ['site_web', 'Site web']];
    XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX, entCols.map(function (c) { return c[1]; }).concat(['Dernier cours (FCFA)', 'Séance', 'Capitalisation (FCFA)']),
      P.tickers.map(function (t) {
        var e = P.ents[t] || { ticker: t }, c = P.px[t] || {}, sh = num(e.nombre_actions) || num(e.nb_actions);
        return entCols.map(function (k) { var v = e[k[0]]; return k[0] === 'nombre_actions' ? sh : (v == null ? '' : v); })
          .concat([num(c.cours), c.date_seance || '', num(c.cours) && sh ? num(c.cours) * sh : null]);
      }), null, { 7: FMT.amount, 15: FMT.amount, 17: FMT.amount }), 'Sociétés');

    function finRows(list) {
      return list.map(function (f) {
        return META.map(function (m) {
          var v = f[m[0]];
          if (m[0] === 'periode') return PERIOD_LABEL[v || 'annuel'] || v;
          if (m[0] === 'validation_status') return STATUS_LABEL[v] || v || '';
          return v == null ? '' : v;
        }).concat(P.cols.map(function (c) { return num(f[c[0]]); }));
      });
    }
    var finHeader = META.map(function (m) { return m[1]; }).concat(P.cols.map(function (c) { return c[1]; }));
    var finFormats = {};
    P.cols.forEach(function (c, i) { finFormats[META.length + i] = /^(bpa|dpa|facteur_actions)$/.test(c[0]) ? FMT.perShare : /^(marge_nette|roe|roa|payout_ratio|dividend_yield|rendement_dividende)$/.test(c[0]) ? '0.00' : FMT.amount; });
    XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX, finHeader, finRows(annual), null, finFormats), 'Comptes annuels');
    if (interim.length) XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX, finHeader, finRows(interim), null, finFormats), 'Intermédiaires');

    var rHeader = ['Ticker', 'Exercice', 'Période', 'Marge nette', 'ROE', 'ROA', 'Dette fin. / CP', 'PER', 'P/B', 'Rendement', 'Payout', 'Valeur comptable / action (FCFA)', 'Cours utilisé (FCFA)'];
    XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX, rHeader, P.fins.map(function (f) {
      var r = ratiosFor(f, P);
      return [f.ticker, f.annee, PERIOD_LABEL[f.periode || 'annuel'] || f.periode, r.marge_nette, r.roe, r.roa, r.dette_cp, r.per, r.pb, r.rendement, r.payout, r.bvps, r.price];
    }), null, { 3: FMT.pct, 4: FMT.pct, 5: FMT.pct, 6: FMT.mult, 7: FMT.mult, 8: FMT.mult, 9: FMT.pct, 10: FMT.pct, 11: FMT.perShare, 12: FMT.amount }), 'Ratios calculés');

    var divs = P.data.dividendes || [];
    if (divs.length) XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX,
      ['Ticker', 'Exercice', 'Dividende brut (FCFA)', 'Dividende net (FCFA)', 'Taux IRVM (%)', 'Rendement (%)', 'Détachement', 'Paiement', 'Statut', 'Notes'],
      divs.map(function (v) { return [v.ticker, v.exercice, num(v.montant), num(v.montant_net), num(v.taux_irvm), num(v.taux_rendement != null ? v.taux_rendement : v.rendement), v.date_detachement || v.ex_date || '', v.date_paiement || v.date_paiement_cal || '', v.statut || '', v.notes || '']; }), null, { 2: FMT.perShare, 3: FMT.perShare }), 'Dividendes');

    var hist = P.data.historique || [];
    if (hist.length) XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX,
      ['Ticker', 'Séance', 'Ouverture', 'Plus haut', 'Plus bas', 'Clôture', 'Variation (%)', 'Volume', 'Valeur échangée (FCFA)'],
      hist.map(function (h) { return [h.ticker, h.date_seance, num(h.cours_ouverture), num(h.plus_haut), num(h.plus_bas), num(h.cours_cloture != null ? h.cours_cloture : h.cloture), num(h.variation), num(h.volume), num(h.valeur_totale)]; }),
      null, { 2: FMT.amount, 3: FMT.amount, 4: FMT.amount, 5: FMT.amount, 6: '0.00', 7: FMT.amount, 8: FMT.amount }), 'Cours 12 mois');

    XLSX.writeFile(wb, opts.filename + '.xlsx', { compression: true });
  }

  /* Une société : postes en lignes, exercices annuels en colonnes. */
  function synthesisSheet(XLSX, P, t) {
    var list = P.fins.filter(function (f) { return String(f.ticker).toUpperCase() === t && (!f.periode || f.periode === 'annuel'); })
      .sort(function (a, b) { return Number(a.annee) - Number(b.annee); });
    var rows = [], header = ['Poste'].concat(list.map(function (f) { return String(f.annee); }));
    GROUPS.forEach(function (g) {
      var lines = g[1].filter(function (c) { return list.some(function (f) { return num(f[c[0]]) !== null; }); });
      if (!lines.length) return;
      rows.push([g[0].toUpperCase()]);
      lines.forEach(function (c) { rows.push([c[1]].concat(list.map(function (f) { return num(f[c[0]]); }))); });
    });
    rows.push(['RATIOS CALCULÉS']);
    [['Marge nette', 'marge_nette'], ['ROE', 'roe'], ['ROA', 'roa'], ['Dette fin. / CP', 'dette_cp'], ['PER (cours actuel)', 'per'], ['P/B (cours actuel)', 'pb'], ['Rendement (cours actuel)', 'rendement'], ['Payout', 'payout']]
      .forEach(function (r) { rows.push([r[0]].concat(list.map(function (f) { return ratiosFor(f, P)[r[1]]; }))); });
    rows.push(['Statut The Capital'].concat(list.map(function (f) { return STATUS_LABEL[f.validation_status] || f.validation_status || ''; })));
    var ws = XLSX.utils.aoa_to_sheet([header].concat(rows));
    var PCT = /^(Marge nette|ROE|ROA|Rendement|Payout)/, MULT = /^(PER|P\/B|Dette fin)/, PS = /^(BPA|DPA|Facteur)/;
    rows.forEach(function (row, i) {
      var z = PCT.test(row[0]) ? FMT.pct : MULT.test(row[0]) ? FMT.mult : PS.test(row[0]) ? FMT.perShare : FMT.amount;
      for (var c = 1; c < row.length; c++) { var cell = ws[XLSX.utils.encode_cell({ r: i + 1, c: c })]; if (cell && cell.t === 'n') cell.z = z; }
    });
    ws['!cols'] = [{ wch: 38 }].concat(list.map(function () { return { wch: 18 }; }));
    return ws;
  }

  /* ── PDF ───────────────────────────────────────────────────────────── */

  async function toPdf(P, opts) {
    await loadScript(LIBS.jspdf);
    await loadScript(LIBS.autotable);
    var jsPDF = w.jspdf.jsPDF, doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    var W = doc.internal.pageSize.getWidth(), GOLD = [184, 150, 78], INK = [28, 24, 18];
    var theme = { theme: 'grid', styles: { fontSize: 7.5, cellPadding: 3, lineColor: [225, 218, 205], lineWidth: 0.4, textColor: INK },
      headStyles: { fillColor: [33, 28, 20], textColor: [240, 220, 170], fontStyle: 'bold' }, alternateRowStyles: { fillColor: [250, 247, 240] }, margin: { left: 36, right: 36 } };

    P.tickers.forEach(function (t, idx) {
      if (idx) doc.addPage();
      var e = P.ents[t] || {}, c = P.px[t] || {};
      var annual = P.fins.filter(function (f) { return String(f.ticker).toUpperCase() === t && (!f.periode || f.periode === 'annuel'); })
        .sort(function (a, b) { return Number(a.annee) - Number(b.annee); }).slice(-8);
      var interim = P.fins.filter(function (f) { return String(f.ticker).toUpperCase() === t && f.periode && f.periode !== 'annuel'; }).slice(0, 8);
      var last = annual[annual.length - 1], r = last ? ratiosFor(last, P) : {};

      doc.setFillColor(20, 16, 11); doc.rect(0, 0, W, 64, 'F');
      doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('THE CAPITAL · FICHE FINANCIÈRE', 36, 22);
      doc.setTextColor(245, 240, 232); doc.setFontSize(17); doc.text((e.nom || t) + '  (' + t + ')', 36, 44);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(200, 190, 170);
      doc.text([e.secteur, e.pays, e.compartiment ? 'Compartiment ' + e.compartiment : ''].filter(Boolean).join(' · '), 36, 57);
      doc.setTextColor(245, 240, 232); doc.setFontSize(10);
      doc.text('Cours : ' + fmt(c.cours) + ' FCFA' + (c.date_seance ? '  (' + c.date_seance + ')' : ''), W - 36, 30, { align: 'right' });
      doc.setFontSize(8.5); doc.setTextColor(200, 190, 170);
      doc.text('Capitalisation : ' + (r.price && r.shares ? mFcfa(r.price * r.shares) + ' M FCFA' : '—'), W - 36, 46, { align: 'right' });

      doc.autoTable(Object.assign({}, theme, {
        startY: 80,
        head: [['Ratios (dernier exercice ' + (last ? last.annee : '—') + ', cours actuel)', 'PER', 'P/B', 'Rendement', 'ROE', 'ROA', 'Marge nette', 'Dette fin. / CP', 'Payout']],
        body: [['', r.per ? fmt(r.per, 1) + 'x' : '—', r.pb ? fmt(r.pb, 2) + 'x' : '—', pctTxt(r.rendement), pctTxt(r.roe), pctTxt(r.roa), pctTxt(r.marge_nette), r.dette_cp != null ? fmt(r.dette_cp, 2) + 'x' : '—', pctTxt(r.payout)]],
        columnStyles: { 0: { cellWidth: 190 } }
      }));

      if (annual.length) {
        var body = [];
        GROUPS.forEach(function (g) {
          var lines = g[1].filter(function (col) { return annual.some(function (f) { return num(f[col[0]]) !== null; }); });
          if (!lines.length) return;
          body.push([{ content: g[0], colSpan: annual.length + 1, styles: { fillColor: [242, 234, 216], fontStyle: 'bold' } }]);
          lines.forEach(function (col) {
            var perShare = /^(bpa|dpa)$/.test(col[0]) || /actions/.test(col[0]) || /^(marge_nette|roe|roa|payout_ratio|dividend_yield|rendement_dividende)$/.test(col[0]);
            body.push([col[1] + (perShare ? '' : ' (M FCFA)')].concat(annual.map(function (f) { return perShare ? fmt(f[col[0]], 2) : mFcfa(f[col[0]]); })));
          });
        });
        doc.autoTable(Object.assign({}, theme, {
          startY: doc.lastAutoTable.finalY + 14,
          head: [['Comptes annuels'].concat(annual.map(function (f) { return String(f.annee) + (f.validation_status === 'validated' ? '' : ' *'); }))],
          body: body,
          columnStyles: { 0: { cellWidth: 200 } },
          didParseCell: function (dta) { if (dta.column.index > 0 && (dta.section === 'body' || dta.section === 'head')) dta.cell.styles.halign = 'right'; }
        }));
      } else {
        doc.setFontSize(9); doc.setTextColor(INK[0], INK[1], INK[2]); doc.text('Aucun compte annuel disponible pour cette société.', 36, doc.lastAutoTable.finalY + 24);
      }

      if (interim.length) doc.autoTable(Object.assign({}, theme, {
        startY: doc.lastAutoTable.finalY + 14,
        head: [['Publications intermédiaires', "Chiffre d'affaires (M FCFA)", 'Résultat net (M FCFA)', 'Capitaux propres (M FCFA)', 'Statut']],
        body: interim.map(function (f) { return [f.annee + ' ' + (PERIOD_LABEL[f.periode] || f.periode), mFcfa(f.chiffre_affaires), mFcfa(f.resultat_net), mFcfa(cp(f)), STATUS_LABEL[f.validation_status] || '']; })
      }));

      var divs = (P.data.dividendes || []).filter(function (v) { return String(v.ticker).toUpperCase() === t; }).slice(0, 8);
      if (divs.length) doc.autoTable(Object.assign({}, theme, {
        startY: doc.lastAutoTable.finalY + 14,
        head: [['Dividendes', 'Brut (FCFA)', 'Net (FCFA)', 'Détachement', 'Paiement']],
        body: divs.map(function (v) { return ['Exercice ' + v.exercice, fmt(v.montant, 2), fmt(v.montant_net, 2), v.date_detachement || v.ex_date || '—', v.date_paiement || v.date_paiement_cal || '—']; })
      }));
    });

    var pages = doc.internal.getNumberOfPages();
    for (var i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFontSize(7); doc.setTextColor(140, 130, 115);
      doc.text("The Capital · thecapitalinvest · export du " + new Date().toLocaleDateString('fr-FR') + " · * exercice en revue (non encore contrôlé deux fois) · Information sans valeur de conseil.", 36, doc.internal.pageSize.getHeight() - 18);
      doc.text(i + ' / ' + pages, W - 36, doc.internal.pageSize.getHeight() - 18, { align: 'right' });
    }
    doc.save(opts.filename + '.pdf');
  }

  /* ── Fenêtre d'export ──────────────────────────────────────────────── */

  function css() {
    if (d.getElementById('tc-export-css')) return;
    var s = d.createElement('style'); s.id = 'tc-export-css';
    s.textContent = '' +
      '.tc-exp-ov{position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:999990;display:flex;align-items:center;justify-content:center;padding:16px}' +
      '.tc-exp{width:min(520px,100%);background:#15120d;border:1px solid rgba(184,150,78,.28);border-radius:14px;padding:22px 22px 18px;color:#f5f0e8;font-family:"DM Sans",sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.5)}' +
      '.tc-exp h3{margin:0 0 4px;font:700 19px "Playfair Display",Georgia,serif}.tc-exp .sub{font-size:12px;color:rgba(245,240,232,.6);margin-bottom:16px}' +
      '.tc-exp .tier{display:inline-block;margin-bottom:10px;padding:3px 10px;border-radius:999px;background:rgba(184,150,78,.14);color:#d4af6a;font:600 10px "DM Mono",monospace;letter-spacing:.08em;text-transform:uppercase}' +
      '.tc-exp fieldset{border:1px solid rgba(255,255,255,.08);border-radius:10px;margin:0 0 12px;padding:10px 12px}.tc-exp legend{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#d4af6a;padding:0 4px}' +
      '.tc-exp label{display:flex;gap:8px;align-items:center;font-size:13px;margin:5px 0;cursor:pointer}.tc-exp input[type=text]{width:100%;margin-top:6px;padding:8px 10px;border-radius:7px;border:1px solid rgba(255,255,255,.12);background:#0e0c09;color:#f5f0e8;font:inherit}' +
      '.tc-exp .row{display:flex;gap:10px;justify-content:flex-end;align-items:center;margin-top:14px;flex-wrap:wrap}.tc-exp .msg{flex:1;font-size:12px;color:rgba(245,240,232,.7);min-width:160px}.tc-exp .msg.err{color:#f08080}' +
      '.tc-exp button{padding:10px 16px;border-radius:8px;border:1px solid rgba(184,150,78,.4);background:transparent;color:#f5f0e8;font:600 12px "DM Sans",sans-serif;cursor:pointer}' +
      '.tc-exp button.go,.tc-exp a.go{background:#b8964e;color:#14100a;border-color:#b8964e;text-decoration:none;padding:10px 16px;border-radius:8px;font:700 12px "DM Sans",sans-serif}.tc-exp button:disabled{opacity:.5;cursor:wait}' +
      '.tc-exp-btn{display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:8px;border:1px solid rgba(184,150,78,.45);background:rgba(184,150,78,.08);color:#d4af6a;font:600 12px "DM Sans",sans-serif;cursor:pointer;white-space:nowrap}' +
      '.tc-exp-btn:hover{background:rgba(184,150,78,.16)}.tc-exp-btn .pro{font:600 9px "DM Mono",monospace;letter-spacing:.06em;padding:2px 6px;border-radius:999px;background:rgba(184,150,78,.18)}';
    d.head.appendChild(s);
  }

  function close(ov) { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); }

  function upsell() {
    css();
    var ov = d.createElement('div'); ov.className = 'tc-exp-ov';
    ov.innerHTML = '<div class="tc-exp" role="dialog" aria-modal="true"><div class="tier">Formule Professional</div><h3>Export Excel et PDF</h3>' +
      '<div class="sub">L\'export des données financières complètes (comptes annuels et intermédiaires détaillés, ratios calculés, dividendes, cours sur 12 mois) est réservé aux abonnés Professional.</div>' +
      '<div class="row"><button type="button" data-x>Fermer</button><a class="go" href="' + UPGRADE + '">Passer à Professional</a></div></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.hasAttribute('data-x')) close(ov); });
    d.body.appendChild(ov);
  }

  function open(opts) {
    opts = opts || {};
    if (!canExport()) return upsell();
    css();
    var single = opts.ticker ? String(opts.ticker).toUpperCase() : '';
    var ov = d.createElement('div'); ov.className = 'tc-exp-ov';
    ov.innerHTML = '<div class="tc-exp" role="dialog" aria-modal="true"><div class="tier">Formule Professional</div>' +
      '<h3>Exporter les données financières</h3><div class="sub">Toutes les données disponibles dans The Capital, prêtes pour vos modèles et vos rapports.</div>' +
      '<fieldset><legend>Sociétés</legend>' +
      (single ? '<label><input type="radio" name="tcx-scope" value="one" checked> ' + esc(single) + ' uniquement</label>' : '') +
      '<label><input type="radio" name="tcx-scope" value="all"' + (single ? '' : ' checked') + '> Toutes les sociétés cotées</label>' +
      '<label><input type="radio" name="tcx-scope" value="list"> Une sélection</label>' +
      '<input type="text" id="tcx-list" placeholder="Tickers séparés par des virgules : SNTS, SGBC, ORAC" hidden></fieldset>' +
      '<fieldset><legend>Format</legend><label><input type="radio" name="tcx-fmt" value="xlsx" checked> Excel (.xlsx) — tous les postes, un onglet par jeu de données</label>' +
      '<label><input type="radio" name="tcx-fmt" value="pdf"> PDF — rapport par société</label>' +
      '<label><input type="checkbox" id="tcx-hist"> Inclure les cours des 12 derniers mois (Excel)</label></fieldset>' +
      '<div class="row"><span class="msg" id="tcx-msg"></span><button type="button" data-x>Annuler</button><button type="button" class="go" id="tcx-go">Exporter</button></div></div>';
    d.body.appendChild(ov);
    var list = ov.querySelector('#tcx-list'), msg = ov.querySelector('#tcx-msg'), go = ov.querySelector('#tcx-go');
    ov.addEventListener('change', function () { list.hidden = (ov.querySelector('input[name=tcx-scope]:checked') || {}).value !== 'list'; });
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.hasAttribute('data-x')) close(ov); });
    go.addEventListener('click', async function () {
      var scope = (ov.querySelector('input[name=tcx-scope]:checked') || {}).value;
      var format = (ov.querySelector('input[name=tcx-fmt]:checked') || {}).value;
      var tickers = scope === 'one' ? [single] : scope === 'list'
        ? String(list.value || '').toUpperCase().split(/[\s,;]+/).filter(Boolean) : [];
      if (scope === 'list' && !tickers.length) { msg.className = 'msg err'; msg.textContent = 'Indiquez au moins un ticker.'; return; }
      go.disabled = true; msg.className = 'msg'; msg.textContent = 'Préparation des données…';
      try {
        var data = await fetchData(tickers, format === 'xlsx' && ov.querySelector('#tcx-hist').checked);
        var P = prepare(data);
        if (!P.tickers.length) throw new Error('Aucune donnée financière pour cette sélection.');
        msg.textContent = 'Composition du fichier (' + P.tickers.length + ' société' + (P.tickers.length > 1 ? 's' : '') + ')…';
        var name = 'the-capital-' + (P.tickers.length === 1 ? P.tickers[0] : P.tickers.length + '-societes') + '-' + today();
        if (format === 'pdf') await toPdf(P, { filename: name }); else await toExcel(P, { filename: name });
        msg.textContent = 'Fichier téléchargé.';
        setTimeout(function () { close(ov); }, 900);
      } catch (e) {
        if (e && e.code === 'PLAN_REQUIRED') { close(ov); upsell(); return; }
        msg.className = 'msg err'; msg.textContent = (e && e.message) || 'Export impossible.';
      } finally { go.disabled = false; }
    });
  }

  /** Bouton prêt à insérer dans une vue. */
  function button(ticker) {
    css();
    var locked = !canExport();
    return '<button type="button" class="tc-exp-btn" onclick="TCExport.open(' + (ticker ? "{ticker:'" + esc(ticker).replace(/'/g, '') + "'}" : '') + ')">' +
      (locked ? '🔒 ' : '⬇ ') + 'Exporter Excel / PDF <span class="pro">PRO</span></button>';
  }

  w.TCExport = { open: open, button: button, _prepare: prepare, _ratiosFor: ratiosFor };
})(window, document);
