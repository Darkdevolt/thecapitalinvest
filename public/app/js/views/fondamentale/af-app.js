/* ═══════════════════════════════════════════════════════════════════
   THE CAPITAL — ANALYSE FONDAMENTALE PRO
   af-app.js : interface.

   Aucun endpoint n'est créé. Le module lit window.allFinancials,
   window.allCours et window.allEntreprises, déjà chargés par
   l'application, exactement comme le faisait l'ancienne vue.

   Toutes les hypothèses de valorisation sont modifiables et
   mémorisées par titre. Les données absentes des états publiés
   peuvent être saisies : elles débloquent alors les ratios qui en
   dépendent, et restent visuellement distinguées des données source.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.__AFP_APP__) return;
  global.__AFP_APP__ = true;

  var C = global.AFCore;
  var V = global.AFValuation;
  var fin = C.fin, pos = C.pos;

  var LS = { hyp: 'tc-af-hyp:', ov: 'tc-af-data:', tab: 'tc-af-tab', poids: 'tc-af-poids' };

  var S = {
    ticker: '', analyse: null, hypotheses: null, wacc: null,
    tab: 'synthese', overrides: {}, poids: null,
    resultats: null, comparables: null, unite: 'auto'
  };
  global.AF = S;

  /* ── Utilitaires d'affichage ──────────────────────────────────── */

  function $(id) { return document.getElementById(id); }
  function root() { return $('view-analyse-fondamentale'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function read(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function notify(m, k) { if (typeof global.toast === 'function') global.toast(m, k || 'info'); }

  /* Le mémo n'est ajouté que si la notion existe vraiment dans la base :
     une icône qui ouvrirait un panneau vide serait pire que rien. */
  function memo(cle) {
    return global.TCMemo && global.TCMemo.has(cle) ? global.TCMemo.icon(cle) : '';
  }

  var ND = '<span class="af-nd">non calculable</span>';

  function n0(v) { return fin(v) ? Math.round(v).toLocaleString('fr-FR') : null; }
  function n2(v, d) { return fin(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d }) : null; }
  function pc(v, d) { return fin(v) ? (v * 100).toFixed(d == null ? 1 : d) + ' %' : null; }
  function pcs(v, d) { return fin(v) ? (v > 0 ? '+' : '') + (v * 100).toFixed(d == null ? 1 : d) + ' %' : null; }

  /* Les montants sont énormes en francs CFA : on les ramène à l'échelle
     lisible plutôt que d'aligner douze chiffres. */
  function mont(v) {
    if (!fin(v)) return null;
    var a = Math.abs(v);
    if (a >= 1e12) return (v / 1e12).toFixed(2) + ' Bn';
    if (a >= 1e9) return (v / 1e9).toFixed(a >= 1e10 ? 1 : 2) + ' Mrd';
    if (a >= 1e6) return (v / 1e6).toFixed(1) + ' M';
    if (a >= 1e3) return Math.round(v).toLocaleString('fr-FR');
    return v.toFixed(0);
  }
  function or(v, fallback) { return v == null ? (fallback || ND) : v; }
  function tone(v, seuil, inverse) {
    if (!fin(v)) return '';
    var bon = inverse ? v <= seuil : v >= seuil;
    return bon ? 'af-up' : 'af-down';
  }

  /* ── Sélecteur de titres ──────────────────────────────────────── */

  function tickers() {
    var all = Array.isArray(global.allFinancials) ? global.allFinancials : [];
    var seen = {}, out = [];
    all.forEach(function (f) {
      var t = String(f && f.ticker || '').trim().toUpperCase();
      if (!t || seen[t]) return;
      seen[t] = 1;
      out.push(t);
    });
    var cours = Array.isArray(global.allCours) ? global.allCours : [];
    var noms = {};
    cours.forEach(function (r) { noms[String(r.ticker || '').toUpperCase()] = r.nom || r.libelle || ''; });
    return out.sort().map(function (t) { return { ticker: t, nom: noms[t] || '' }; });
  }

  function fillSelect() {
    var sel = $('afTicker');
    if (!sel) return 0;
    var list = tickers();
    var keep = sel.value || S.ticker;
    sel.innerHTML = '<option value="">Choisir un titre…</option>' +
      list.map(function (o) {
        return '<option value="' + esc(o.ticker) + '">' + esc(o.ticker) + (o.nom ? ' — ' + esc(o.nom) : '') + '</option>';
      }).join('');
    if (keep) sel.value = keep;
    sel.disabled = !list.length;
    var c = $('afTickerCount');
    if (c) c.textContent = list.length ? list.length + ' sociétés avec états financiers' : 'En attente des états financiers';
    return list.length;
  }

  /* ── Chargement d'un titre ────────────────────────────────────── */

  function load(ticker) {
    if (!ticker) return false;
    S.ticker = String(ticker).toUpperCase();
    S.overrides = read(LS.ov + S.ticker, {}) || {};
    var a = C.analyse(S.ticker, S.overrides);
    S.analyse = a;
    if (!a.enough) {
      S.hypotheses = null; S.resultats = null;
      render();
      return false;
    }
    var saved = read(LS.hyp + S.ticker, null);
    S.hypotheses = Object.assign(V.hypothesesInitiales(a), saved || {});
    S.poids = read(LS.poids, null) || Object.assign({}, V.POIDS_DEFAUT);
    try { S.comparables = C.comparables(S.ticker, { memeSecteur: false }); }
    catch (e) { S.comparables = null; }
    recompute();
    render();
    return true;
  }

  /* ── Recalcul de toutes les valorisations ─────────────────────── */

  function recompute() {
    if (!S.analyse || !S.analyse.enough || !S.hypotheses) { S.resultats = null; return; }
    var H = S.hypotheses;
    var a = S.analyse;

    var w = V.wacc(H);
    S.wacc = w;
    var taux = fin(H.tauxManuel) ? H.tauxManuel : w.valeur;

    var base = Object.assign({}, H, { taux: taux });
    var D = V.dcf(base);
    var med = S.comparables ? S.comparables.medianes : {};
    var mu = V.multiples(Object.assign({}, H, {
      perRef: fin(H.perRef) ? H.perRef : med.per,
      pbrRef: fin(H.pbrRef) ? H.pbrRef : med.pbr,
      psrRef: fin(H.psrRef) ? H.psrRef : med.psr,
      evEbitdaRef: fin(H.evEbitdaRef) ? H.evEbitdaRef : med.evEbitda,
      pfcfRef: fin(H.pfcfRef) ? H.pfcfRef : NaN
    }));
    var dd = V.ddm(Object.assign({}, H, {
      rendementExige: fin(H.rendementExige) ? H.rendementExige : w.coutFondsPropres,
      croissance: fin(H.croissanceDividende) ? H.croissanceDividende : 0.03,
      cours: a.data.price
    }));
    var rr = V.revenuResiduel(Object.assign({}, H, {
      rendementExige: fin(H.rendementExige) ? H.rendementExige : w.coutFondsPropres,
      croissance: H.croissance, annees: H.annees
    }));
    var gr = V.graham(H.bpa, H.anpa, H.facteurGraham);

    S.resultats = {
      taux: taux,
      dcf: D,
      sensibilite: D.ok ? V.sensibilite(base) : null,
      inverse: D.ok ? V.dcfInverse(base, a.data.price) : null,
      scenarios: D.ok ? V.scenarios(base, a.data.price) : null,
      multiples: mu,
      ddm: dd,
      residuel: rr,
      graham: gr,
      synthese: V.synthese({
        dcf: D.ok ? D.parAction : NaN,
        ddm: dd.ok ? dd.valeur : NaN,
        multiples: mu.mediane,
        residuel: rr.ok ? rr.valeur : NaN,
        graham: gr.ok ? gr.valeur : NaN
      }, S.poids, a.data.price)
    };
  }

  function saveHyp() { if (S.ticker) store(LS.hyp + S.ticker, S.hypotheses); }
  function saveOv() { if (S.ticker) store(LS.ov + S.ticker, S.overrides); }

  /* ── Onglets ──────────────────────────────────────────────────── */

  var TABS = [
    { id: 'synthese', l: 'Synthèse' },
    { id: 'etats', l: 'États financiers' },
    { id: 'ratios', l: 'Ratios' },
    { id: 'croissance', l: 'Croissance' },
    { id: 'valorisation', l: 'Valorisation' },
    { id: 'sensibilite', l: 'Sensibilité' },
    { id: 'comparables', l: 'Comparables' },
    { id: 'qualite', l: 'Qualité' },
    { id: 'donnees', l: 'Données & hypothèses' }
  ];

  function render() {
    var host = $('afPanel');
    if (!host) return;
    var t = $('afTabs');
    if (t) t.innerHTML = TABS.map(function (x) {
      return '<button type="button" class="af-tab' + (x.id === S.tab ? ' on' : '') + '" data-aftab="' + x.id + '">' + x.l + '</button>';
    }).join('');

    renderHeader();

    if (!S.ticker) { host.innerHTML = vide('Aucun titre sélectionné', 'Choisissez une société dans le sélecteur pour afficher ses états financiers, ses ratios et sa valorisation.'); return; }
    if (!S.analyse || !S.analyse.enough) {
      host.innerHTML = vide('Données indisponibles', S.analyse && S.analyse.raison ? S.analyse.raison.charAt(0).toUpperCase() + S.analyse.raison.slice(1) + '.' : 'Aucun exercice annuel n\'a été trouvé pour ce titre.');
      return;
    }
    var fn = {
      synthese: paneSynthese, etats: paneEtats, ratios: paneRatios, croissance: paneCroissance,
      valorisation: paneValorisation, sensibilite: paneSensibilite, comparables: paneComparables,
      qualite: paneQualite, donnees: paneDonnees
    }[S.tab] || paneSynthese;
    host.innerHTML = fn();
  }

  function vide(titre, txt) {
    return '<div class="af-empty"><div class="af-empty-t">' + esc(titre) + '</div><p>' + esc(txt) + '</p></div>';
  }
  function groupe(l, cle) { return '<div class="af-group">' + esc(l) + (cle ? memo(cle) : '') + '</div>'; }
  function note(txt) { return '<p class="af-note">' + txt + '</p>'; }

  function renderHeader() {
    var h = $('afHeader');
    if (!h) return;
    if (!S.analyse || !S.analyse.enough) { h.innerHTML = ''; return; }
    var d = S.analyse.data, r = S.analyse.dernier;
    var syn = S.resultats && S.resultats.synthese;
    function cell(l, v, cls) {
      return '<div class="af-h"><span class="af-h-l">' + l + '</span><span class="af-h-v ' + (cls || '') + '">' + v + '</span></div>';
    }
    h.innerHTML =
      '<div class="af-h-head"><strong>' + esc(d.ticker) + '</strong>' +
      (d.nom ? '<span class="af-h-nom">' + esc(d.nom) + '</span>' : '') +
      (d.secteur ? '<span class="af-h-sec">' + esc(d.secteur) + '</span>' : '') + '</div>' +
      cell('Cours', or(n0(d.price)) + ' FCFA', 'af-gold') +
      cell('Capitalisation', or(mont(d.marketCap))) +
      cell('Exercices', S.analyse.rows.length + ' (' + S.analyse.years[0] + '–' + S.analyse.years[S.analyse.years.length - 1] + ')') +
      cell('PER', or(n2(r.per)), tone(r.per, 15, true)) +
      cell('ROE', or(pc(r.roe)), tone(r.roe, 0.12)) +
      cell('Rendement', or(pc(r.rendement, 2)), tone(r.rendement, 0.04)) +
      (syn && fin(syn.valeur) ? cell('Valeur estimée', n0(syn.valeur) + ' FCFA', 'af-gold') : '') +
      (syn && fin(syn.potentiel) ? cell('Potentiel', pcs(syn.potentiel), syn.potentiel >= 0 ? 'af-up' : 'af-down') : '');
  }

  /* ── Onglet Synthèse ──────────────────────────────────────────── */

  function paneSynthese() {
    var a = S.analyse, r = a.dernier, ex = a.dernierExercice, q = a.qualite;
    var syn = S.resultats && S.resultats.synthese;
    var html = '';

    if (q.enough) {
      var pct = q.note100;
      html += '<div class="af-verdict ' + (pct >= 65 ? 'af-t-bon' : pct >= 45 ? 'af-t-moyen' : 'af-t-faible') + '">' +
        '<div class="af-verdict-n">' + Math.round(pct) + '<small>/100</small></div>' +
        '<div><div class="af-verdict-l">' + esc(q.mention.charAt(0).toUpperCase() + q.mention.slice(1)) + '</div>' +
        '<div class="af-verdict-s">Note construite sur ' + q.piliers.filter(function (p) { return fin(p.note); }).length +
        ' piliers, détaillée dans l\'onglet Qualité.</div></div></div>';
      html += '<div class="af-piliers">' + q.piliers.map(function (p) {
        var w = fin(p.note) ? p.note / p.sur * 100 : 0;
        return '<div class="af-pilier"><div class="af-pilier-t"><span>' + esc(p.nom) + '</span>' +
          '<span>' + (fin(p.note) ? Math.round(p.note) + '/' + p.sur : '—') + '</span></div>' +
          '<div class="af-bar"><div style="width:' + w + '%"></div></div></div>';
      }).join('') + '</div>';
    }

    if (syn && fin(syn.valeur)) {
      html += groupe('Valorisation de synthèse', 'dcf');
      html += '<div class="af-val-head">' +
        '<div><div class="af-val-l">Valeur estimée</div><div class="af-val-v">' + n0(syn.valeur) + ' <small>FCFA</small></div></div>' +
        '<div><div class="af-val-l">Cours</div><div class="af-val-v af-dim">' + or(n0(syn.cours)) + '</div></div>' +
        '<div><div class="af-val-l">Potentiel</div><div class="af-val-v ' + (syn.potentiel >= 0 ? 'af-up' : 'af-down') + '">' + or(pcs(syn.potentiel)) + '</div></div>' +
        '</div>';
      if (syn.fourchette) {
        html += note('Les ' + syn.retenues + ' méthodes exploitables donnent une fourchette de <strong>' +
          n0(syn.fourchette.bas) + '</strong> à <strong>' + n0(syn.fourchette.haut) + '</strong> FCFA. ' +
          'La valeur retenue est leur moyenne pondérée, les poids étant modifiables dans l\'onglet Valorisation.');
      }
      if (syn.avertissement) html += '<div class="af-warn">' + esc(syn.avertissement) + '</div>';
      if (fin(syn.margeSecurite)) {
        html += '<div class="af-mini"><span>Marge de sécurité' + memo('marge-securite') + '</span><strong class="' +
          (syn.margeSecurite >= 0.3 ? 'af-up' : syn.margeSecurite >= 0 ? '' : 'af-down') + '">' + pc(syn.margeSecurite) + '</strong></div>';
      }
    }

    html += groupe('Dernier exercice publié · ' + ex.annee);
    html += '<div class="af-stats">' +
      st('Chiffre d\'affaires', or(mont(ex.ca)), pcs(r.croissanceCa) ? 'variation de ' + pcs(r.croissanceCa) : '', 'ca') +
      st('Résultat brut d\'exploitation', or(mont(ex.rbe)), or(pc(r.margeBrute), '') + ' de marge', 'marge-exploitation') +
      st('Résultat net', or(mont(ex.rn)), or(pc(r.margeNette), '') + ' de marge', 'marge-nette') +
      st('Flux de trésorerie libre', or(mont(ex.fcf)), or(pc(r.margeFcf), '') + ' du chiffre d\'affaires', 'fcf') +
      st('Capitaux propres', or(mont(ex.cp)), or(pc(r.autonomie), '') + ' du bilan', 'autonomie') +
      st('Dette financière', or(mont(ex.dette)), 'levier de ' + or(n2(r.gearing), '—'), 'gearing') +
      '</div>';

    html += groupe('Signaux de lecture');
    html += lectures();

    if (a.alertes.length) {
      var graves = a.alertes.filter(function (x) { return x.niveau === 'grave'; });
      var moyens = a.alertes.filter(function (x) { return x.niveau === 'moyen'; });
      if (graves.length || moyens.length) {
        html += groupe('Points de vigilance sur les données');
        graves.concat(moyens).forEach(function (al) {
          html += '<div class="af-alerte af-a-' + al.niveau + '">' + esc(al.txt) + '</div>';
        });
      }
      html += note('<button type="button" class="af-lien" data-aftab="donnees">Voir les ' + a.alertes.length +
        ' remarques sur la qualité des données</button>');
    }

    html += '<p class="af-disclaimer">Cette analyse est produite à partir des états financiers publiés et des hypothèses ' +
      'affichées dans l\'onglet Valorisation. Elle ne constitue pas un conseil en investissement et ne remplace pas la ' +
      'lecture des rapports annuels.</p>';
    return html;
  }

  function st(l, v, s, cle) {
    return '<div class="af-stat"><div class="af-stat-l">' + esc(l) + (cle ? memo(cle) : '') + '</div>' +
      '<div class="af-stat-v">' + v + '</div>' + (s ? '<div class="af-stat-s">' + s + '</div>' : '') + '</div>';
  }

  /* Quelques lectures automatiques, chacune motivée par une phrase. */
  function lectures() {
    var a = S.analyse, r = a.dernier, m = a.moyennes, cr = a.croissances;
    var out = [];
    function dire(ton, txt) { out.push({ ton: ton, txt: txt }); }

    if (fin(r.roe)) {
      if (r.roe >= 0.15) dire('bon', 'La société dégage ' + pc(r.roe) + ' de rentabilité sur ses capitaux propres. Au-delà de 15 % durablement, une entreprise crée de la valeur pour ses actionnaires.');
      else if (r.roe < 0.05) dire('mauvais', 'La rentabilité des capitaux propres est de ' + pc(r.roe) + '. En dessous du coût du capital, la société détruit de la valeur, même si elle est bénéficiaire comptablement.');
    }
    if (fin(r.dupont.levier) && fin(r.roe) && r.dupont.levier > 2.5 && r.roe > 0.12) {
      dire('vigilance', 'Le ROE de ' + pc(r.roe) + ' repose sur un levier de ' + n2(r.dupont.levier) + ' : une part importante vient de l\'endettement, pas de la performance industrielle.');
    }
    if (fin(r.conversionCash)) {
      if (r.conversionCash >= 1) dire('bon', 'Chaque franc de résultat net se traduit par ' + n2(r.conversionCash) + ' franc de trésorerie opérationnelle : les bénéfices sont réels.');
      else if (r.conversionCash < 0.7) dire('mauvais', 'Seuls ' + pc(r.conversionCash, 0) + ' du résultat net se retrouvent en trésorerie. Une part des bénéfices reste immobilisée en créances ou en stocks, ou relève d\'écritures comptables.');
    }
    if (fin(cr.ca.value)) {
      if (cr.ca.value >= 0.10) dire('bon', 'Le chiffre d\'affaires progresse de ' + pc(cr.ca.value) + ' par an sur ' + cr.ca.annees + ' ans, en hausse ' + cr.regularite.exercicesHausse + ' exercices sur ' + cr.regularite.exercices + '.');
      else if (cr.ca.value < 0) dire('mauvais', 'Le chiffre d\'affaires recule de ' + pc(Math.abs(cr.ca.value)) + ' par an sur la période. Toute valorisation par croissance devient hasardeuse.');
    } else if (cr.ca.raison) {
      dire('vigilance', 'Le taux de croissance du chiffre d\'affaires n\'est pas calculable : ' + cr.ca.raison + '.');
    }
    if (fin(r.detteEbitda) && r.detteEbitda > 4) dire('mauvais', 'La dette représente ' + n2(r.detteEbitda) + ' années de résultat brut d\'exploitation. Au-delà de quatre, elle contraint sérieusement l\'investissement comme la distribution.');
    if (fin(r.payout)) {
      if (r.payout > 1) dire('mauvais', 'Le dividende dépasse le bénéfice de l\'exercice : il est financé par la trésorerie ou par la dette, ce qui ne peut pas durer.');
      else if (r.payout > 0.85) dire('vigilance', 'Le taux de distribution atteint ' + pc(r.payout, 0) + '. La marge de manœuvre est mince : un exercice difficile suffirait à contraindre une coupe.');
      else if (r.payout > 0 && r.payout < 0.5 && fin(r.rendement) && r.rendement > 0.04) dire('bon', 'Un rendement de ' + pc(r.rendement, 2) + ' avec un taux de distribution de seulement ' + pc(r.payout, 0) + ' : le dividende est confortablement couvert.');
    }
    if (fin(r.per) && fin(m.per) && r.per > 0 && m.per > 0) {
      var ecart = r.per / m.per - 1;
      if (Math.abs(ecart) > 0.25) dire(ecart > 0 ? 'vigilance' : 'bon', 'Le PER de ' + n2(r.per) + ' se situe ' + pc(Math.abs(ecart), 0) + (ecart > 0 ? ' au-dessus' : ' en dessous') + ' de sa médiane historique de ' + n2(m.per) + '.');
    }
    var inv = S.resultats && S.resultats.inverse;
    if (inv && inv.ok && fin(inv.croissanceImplicite)) {
      dire('info', 'Au cours actuel, le marché suppose une croissance des flux de ' + pc(inv.croissanceImplicite) + ' par an. ' + inv.lecture);
    }

    if (!out.length) return note('Les données disponibles ne permettent pas de dégager de signal marquant.');
    return out.map(function (o) {
      return '<div class="af-lecture af-l-' + o.ton + '">' + esc(o.txt) + '</div>';
    }).join('');
  }

  /* ── Onglet États financiers ──────────────────────────────────── */

  function paneEtats() {
    var a = S.analyse;
    var lignes = [
      { k: 'ca', l: 'Chiffre d\'affaires', memo: 'ca', gras: true },
      { k: 'rbe', l: 'Résultat brut d\'exploitation', memo: 'marge-exploitation' },
      { k: 'ebit', l: 'Résultat d\'exploitation', saisi: true },
      { k: 'rn', l: 'Résultat net', gras: true },
      { sep: 'Bilan' },
      { k: 'actif', l: 'Total du bilan' },
      { k: 'cp', l: 'Capitaux propres', gras: true },
      { k: 'dette', l: 'Dettes financières', memo: 'gearing' },
      { k: 'treso', l: 'Trésorerie', saisi: true, memo: 'dette-nette' },
      { sep: 'Flux de trésorerie' },
      { k: 'cfo', l: 'Flux opérationnel' },
      { k: 'capex', l: 'Investissements', memo: 'capex-ca' },
      { k: 'fcf', l: 'Flux de trésorerie libre', memo: 'fcf', gras: true },
      { sep: 'Données par action' },
      { k: 'actions', l: 'Nombre d\'actions', brut: true },
      { k: 'bpa', l: 'Bénéfice par action', brut: true },
      { k: 'dpa', l: 'Dividende par action', brut: true, memo: 'rendement' }
    ];

    var html = groupe('États financiers annuels · ' + a.rows.length + ' exercices');
    html += note('Les montants sont exprimés en francs CFA. Les valeurs sur fond ambré ont été saisies dans l\'onglet ' +
      'Données et ne proviennent pas des états publiés. Les cellules vides correspondent à des postes non publiés par la source.');
    html += '<div class="af-scroll"><table class="af-table af-etats"><thead><tr><th></th>' +
      a.years.map(function (y) { return '<th class="r">' + y + '</th>'; }).join('') + '</tr></thead><tbody>';

    lignes.forEach(function (li) {
      if (li.sep) {
        html += '<tr class="af-sep"><td colspan="' + (a.years.length + 1) + '">' + esc(li.sep) + '</td></tr>';
        return;
      }
      html += '<tr' + (li.gras ? ' class="af-gras"' : '') + '><td>' + esc(li.l) + (li.memo ? memo(li.memo) : '') + '</td>' +
        a.rows.map(function (r) {
          var v = r[li.k];
          var saisi = r['_saisi_' + li.k];
          var txt = fin(v) ? (li.brut ? n0(v) : mont(v)) : '—';
          return '<td class="r' + (saisi ? ' af-saisi' : '') + (fin(v) ? '' : ' af-vide') + '">' + txt + '</td>';
        }).join('') + '</tr>';
    });
    html += '</tbody></table></div>';

    var sources = a.rows.filter(function (r) { return r.source || r.sourceUrl; });
    if (sources.length) {
      html += groupe('Sources');
      html += '<div class="af-sources">' + sources.map(function (r) {
        return '<div class="af-source"><span>' + r.annee + '</span>' +
          (r.sourceUrl ? '<a href="' + esc(r.sourceUrl) + '" target="_blank" rel="noopener">' + esc(r.source || 'document') + '</a>'
            : '<span>' + esc(r.source) + '</span>') +
          (r.sourcePage ? '<small>page ' + esc(r.sourcePage) + '</small>' : '') + '</div>';
      }).join('') + '</div>';
    }
    return html;
  }

  /* ── Onglet Ratios ────────────────────────────────────────────── */

  function paneRatios() {
    var a = S.analyse;
    var blocs = [
      {
        t: 'Rentabilité', l: [
          ['margeBrute', 'Marge brute', 'pc', 'marge-exploitation'],
          ['margeNette', 'Marge nette', 'pc', 'marge-nette'],
          ['roe', 'Rentabilité des capitaux propres', 'pc', 'roe'],
          ['roa', 'Rentabilité des actifs', 'pc', 'roa'],
          ['roce', 'Rentabilité des capitaux employés', 'pc']
        ]
      },
      {
        t: 'Structure financière', l: [
          ['gearing', 'Levier financier', 'n2', 'gearing'],
          ['autonomie', 'Autonomie financière', 'pc', 'autonomie'],
          ['detteActif', 'Dette rapportée au bilan', 'pc'],
          ['detteEbitda', 'Dette nette sur excédent brut', 'n2', 'dette-ebitda'],
          ['levier', 'Multiplicateur des capitaux propres', 'n2']
        ]
      },
      {
        t: 'Efficacité et flux', l: [
          ['rotationActifs', 'Rotation des actifs', 'n2'],
          ['margeFcf', 'Marge de flux libre', 'pc', 'fcf'],
          ['conversionCash', 'Conversion en trésorerie', 'n2', 'conversion-cash'],
          ['capexCa', 'Intensité capitalistique', 'pc', 'capex-ca']
        ]
      },
      {
        t: 'Par action', l: [
          ['bpa', 'Bénéfice par action', 'n0'],
          ['dpa', 'Dividende par action', 'n0'],
          ['anpa', 'Actif net par action', 'n0'],
          ['fcfpa', 'Flux libre par action', 'n0']
        ]
      },
      {
        t: 'Valorisation au cours actuel', l: [
          ['per', 'Cours sur bénéfice', 'n2', 'per'],
          ['pbr', 'Cours sur actif net', 'n2', 'pbr'],
          ['psr', 'Cours sur chiffre d\'affaires', 'n2'],
          ['evEbitda', 'Valeur d\'entreprise sur excédent brut', 'n2', 'ev-ebitda'],
          ['pfcf', 'Cours sur flux libre', 'n2'],
          ['rendement', 'Rendement du dividende', 'pc2', 'rendement'],
          ['payout', 'Taux de distribution', 'pc', 'payout']
        ]
      }
    ];

    var html = note('Chaque ratio est calculé pour tous les exercices disponibles. Les multiples de valorisation ' +
      'rapportent le <strong>cours d\'aujourd\'hui</strong> aux comptes de chaque exercice : ils servent à situer la ' +
      'valorisation actuelle par rapport à l\'histoire de la société, pas à reconstituer une valorisation passée.');

    blocs.forEach(function (b) {
      html += groupe(b.t);
      html += '<div class="af-scroll"><table class="af-table"><thead><tr><th></th>' +
        a.years.map(function (y) { return '<th class="r">' + y + '</th>'; }).join('') + '</tr></thead><tbody>';
      b.l.forEach(function (row) {
        var k = row[0], lbl = row[1], fmt = row[2], mk = row[3];
        html += '<tr><td>' + esc(lbl) + (mk ? memo(mk) : '') + '</td>' +
          a.ratios.map(function (r) {
            var v = r[k];
            var txt = !fin(v) ? '—'
              : fmt === 'pc' ? pc(v) : fmt === 'pc2' ? pc(v, 2) : fmt === 'n0' ? n0(v) : n2(v);
            return '<td class="r' + (fin(v) ? '' : ' af-vide') + '">' + txt + '</td>';
          }).join('') + '</tr>';
      });
      html += '</tbody></table></div>';
    });
    return html;
  }

  /* ── Onglet Croissance ────────────────────────────────────────── */

  function paneCroissance() {
    var a = S.analyse, cr = a.croissances;
    var html = groupe('Taux de croissance annuel moyen');
    html += note('Le taux annuel moyen ne se calcule qu\'entre deux bornes strictement positives. Lorsqu\'un exercice ' +
      'est en perte, le taux n\'existe pas mathématiquement : la raison est affichée plutôt qu\'un chiffre trompeur.');
    html += '<div class="af-stats">';
    [['ca', 'Chiffre d\'affaires'], ['rbe', 'Résultat brut'], ['rn', 'Résultat net'],
    ['fcf', 'Flux libre'], ['bpa', 'Bénéfice par action'], ['dpa', 'Dividende par action'],
    ['cp', 'Capitaux propres']].forEach(function (x) {
      var t = cr[x[0]];
      html += '<div class="af-stat"><div class="af-stat-l">' + x[1] + '</div>' +
        '<div class="af-stat-v ' + (fin(t.value) ? (t.value >= 0 ? 'af-up' : 'af-down') : '') + '">' +
        (fin(t.value) ? pcs(t.value) : '<span class="af-nd">—</span>') + '</div>' +
        '<div class="af-stat-s">' + (fin(t.value) ? 'par an sur ' + t.annees + ' exercices' : esc(t.raison)) + '</div></div>';
    });
    html += '</div>';

    var r = cr.regularite;
    if (fin(r.value)) {
      html += groupe('Régularité');
      html += note('Un chiffre d\'affaires qui progresse chaque année vaut mieux qu\'un chiffre d\'affaires qui double ' +
        'puis s\'effondre, même à taux moyen identique.');
      html += '<div class="af-stats">' +
        st('Exercices en hausse', r.exercicesHausse + ' sur ' + r.exercices, pc(r.value, 0) + ' des exercices') +
        st('Dispersion des variations', or(n2(r.dispersion)), fin(r.dispersion) ? (r.dispersion < 0.5 ? 'croissance très régulière' : r.dispersion < 1.2 ? 'croissance modérément régulière' : 'croissance heurtée') : '') +
        '</div>';
    }

    if (cr.regCa) {
      html += groupe('Tendance linéaire du chiffre d\'affaires');
      html += '<div class="af-stats">' +
        st('Pente', or(mont(cr.regCa.slope)) + ' par an', 'progression moyenne en valeur absolue') +
        st('Qualité de l\'ajustement', or(pc(cr.regCa.r2, 0)), fin(cr.regCa.r2) ? (cr.regCa.r2 > 0.85 ? 'la croissance est presque parfaitement linéaire' : cr.regCa.r2 > 0.6 ? 'la tendance linéaire décrit correctement la série' : 'la série s\'écarte nettement d\'une droite') : '') +
        '</div>';
    }

    html += groupe('Projection');
    html += '<div class="af-form">' +
      champ('Méthode de projection', 'select', 'methodeProj', S.hypotheses.methodeProj || 'tcam',
        [['tcam', 'Taux de croissance annuel moyen'], ['regression', 'Régression linéaire'], ['manuel', 'Taux saisi manuellement']]) +
      champ('Taux retenu si saisi manuellement', 'pct', 'tauxProjManuel', S.hypotheses.tauxProjManuel) +
      champ('Nombre d\'exercices projetés', 'int', 'anneesProj', S.hypotheses.anneesProj || 3) +
      '</div>';

    var proj = projection();
    if (proj) {
      html += '<div class="af-scroll"><table class="af-table"><thead><tr><th></th>' +
        proj.annees.map(function (y) { return '<th class="r">' + y + '</th>'; }).join('') + '</tr></thead><tbody>' +
        ['ca', 'rn', 'fcf'].map(function (k) {
          var lbl = { ca: 'Chiffre d\'affaires', rn: 'Résultat net', fcf: 'Flux libre' }[k];
          return '<tr><td>' + lbl + '</td>' + proj[k].map(function (v) {
            return '<td class="r">' + or(mont(v), '—') + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
      html += note('Projection mécanique, sans jugement sur la stratégie de la société ni sur son marché. ' +
        'Elle sert à cadrer un ordre de grandeur, pas à prédire un résultat. ' + esc(proj.methodeTxt));
    } else {
      html += note('La projection demande au moins trois exercices renseignés pour la grandeur retenue.');
    }
    return html;
  }

  function projection() {
    var a = S.analyse, H = S.hypotheses;
    var n = Math.max(1, Math.min(10, Math.round(H.anneesProj || 3)));
    var methode = H.methodeProj || 'tcam';
    var dernier = a.years[a.years.length - 1];
    var annees = [];
    for (var i = 1; i <= n; i++) annees.push(dernier + i);
    var out = { annees: annees, methodeTxt: '' };
    var ok = false;

    ['ca', 'rn', 'fcf'].forEach(function (k) {
      var serie = a.rows.map(function (r) { return r[k]; });
      var last = null;
      for (var j = serie.length - 1; j >= 0; j--) if (fin(serie[j])) { last = serie[j]; break; }
      var vals = [];
      if (methode === 'regression') {
        var reg = C.regression(a.years, serie);
        for (var i2 = 0; i2 < n; i2++) vals.push(reg ? reg.at(annees[i2]) : NaN);
        if (reg) ok = true;
      } else {
        var g = methode === 'manuel' && fin(H.tauxProjManuel) ? H.tauxProjManuel
          : (a.croissances[k] && fin(a.croissances[k].value) ? a.croissances[k].value : NaN);
        var v = last;
        for (var i3 = 0; i3 < n; i3++) {
          v = fin(v) && fin(g) ? v * (1 + g) : NaN;
          vals.push(v);
        }
        if (fin(g)) ok = true;
      }
      out[k] = vals;
    });
    out.methodeTxt = methode === 'regression' ? 'Méthode retenue : prolongement de la droite des moindres carrés.'
      : methode === 'manuel' ? 'Méthode retenue : taux saisi manuellement, appliqué uniformément.'
        : 'Méthode retenue : prolongement du taux de croissance annuel moyen observé, propre à chaque grandeur.';
    return ok ? out : null;
  }

  /* ── Onglet Valorisation ──────────────────────────────────────── */

  function paneValorisation() {
    var H = S.hypotheses, R = S.resultats, w = S.wacc;
    if (!R) return vide('Valorisation indisponible', 'Les hypothèses n\'ont pas pu être établies.');
    var html = '';

    html += groupe('Coût du capital', 'wacc');
    html += '<div class="af-form">' +
      champ('Taux sans risque', 'pct', 'tauxSansRisque', H.tauxSansRisque) +
      champ('Prime de risque du marché', 'pct', 'primeMarche', H.primeMarche) +
      champ('Beta', 'num', 'beta', H.beta) +
      champ('Prime de taille', 'pct', 'primeTaille', H.primeTaille) +
      champ('Prime d\'illiquidité', 'pct', 'primeLiquidite', H.primeLiquidite) +
      champ('Coût de la dette', 'pct', 'coutDette', H.coutDette) +
      champ('Taux d\'impôt', 'pct', 'tauxImpot', H.tauxImpot) +
      champ('Taux d\'actualisation imposé', 'pct', 'tauxManuel', H.tauxManuel, null, 'laisser vide pour utiliser le calcul ci-dessus') +
      '</div>';
    html += '<div class="af-wacc">' +
      '<div><span>Coût des fonds propres</span><strong>' + pc(w.coutFondsPropres, 2) + '</strong></div>' +
      '<div><span>Coût de la dette après impôt</span><strong>' + pc(w.coutDetteNet, 2) + '</strong></div>' +
      '<div><span>Pondération</span><strong>' + pc(w.poidsCp, 0) + ' / ' + pc(w.poidsDette, 0) + '</strong></div>' +
      '<div class="af-wacc-r"><span>Taux retenu</span><strong>' + pc(R.taux, 2) + '</strong></div>' +
      '</div>';
    if (fin(H.tauxManuel)) html += note('Un taux a été imposé manuellement : le calcul détaillé ci-dessus est conservé pour information mais n\'est pas utilisé.');

    html += groupe('Actualisation des flux', 'dcf');
    html += '<div class="af-form">' +
      champ('Flux de départ', 'mont', 'fcfDepart', H.fcfDepart, null,
        'flux normatif, moyenne des trois derniers exercices : ' + or(mont(H.fcfNormatif), '—')) +
      champ('Croissance de la première année', 'pct', 'croissance', H.croissance) +
      champ('Croissance perpétuelle', 'pct', 'croissancePerpetuelle', H.croissancePerpetuelle) +
      champ('Horizon de projection', 'int', 'annees', H.annees) +
      champ('Dette nette', 'mont', 'detteNette', H.detteNette) +
      '</div>';

    var D = R.dcf;
    if (!D.ok) {
      html += '<div class="af-warn"><strong>Le calcul n\'aboutit pas.</strong><br>' +
        D.erreurs.map(esc).join('<br>') + '</div>';
    } else {
      html += '<div class="af-scroll"><table class="af-table"><thead><tr>' +
        '<th>Exercice</th><th class="r">Croissance</th><th class="r">Flux projeté</th>' +
        '<th class="r">Facteur</th><th class="r">Flux actualisé</th></tr></thead><tbody>' +
        D.flux.map(function (f) {
          return '<tr><td>Année ' + f.annee + '</td><td class="r">' + pc(f.croissance) + '</td>' +
            '<td class="r">' + mont(f.flux) + '</td><td class="r">' + n2(f.facteur, 3) + '</td>' +
            '<td class="r">' + mont(f.actualise) + '</td></tr>';
        }).join('') +
        '<tr class="af-gras"><td colspan="4">Somme des flux actualisés</td><td class="r">' + mont(D.sommeActualisee) + '</td></tr>' +
        '<tr><td colspan="4">Valeur terminale' + memo('valeur-terminale') + ' — ' + esc(D.methodeTerminale) + '</td><td class="r">' + mont(D.valeurTerminale) + '</td></tr>' +
        '<tr><td colspan="4">Valeur terminale actualisée <span class="af-dim">(' + pc(D.partTerminale, 0) + ' du total)</span></td><td class="r">' + mont(D.valeurTerminaleActualisee) + '</td></tr>' +
        '<tr class="af-gras"><td colspan="4">Valeur d\'entreprise</td><td class="r">' + mont(D.valeurEntreprise) + '</td></tr>' +
        '<tr><td colspan="4">Dette nette' + memo('dette-nette') + '</td><td class="r">− ' + mont(D.detteNette) + '</td></tr>' +
        '<tr class="af-gras"><td colspan="4">Valeur des fonds propres</td><td class="r">' + mont(D.valeurFondsPropres) + '</td></tr>' +
        '<tr class="af-total"><td colspan="4">Valeur par action</td><td class="r">' + n0(D.parAction) + ' FCFA</td></tr>' +
        '</tbody></table></div>';
      D.reserves.forEach(function (r) { html += '<div class="af-warn">' + esc(r) + '</div>'; });
    }

    if (R.inverse && R.inverse.ok) {
      html += groupe('Ce que le cours suppose déjà', 'dcf-inverse');
      html += '<div class="af-stats">' +
        st('Croissance implicite', pcs(R.inverse.croissanceImplicite), 'que le cours actuel intègre') +
        st('Croissance réalisée', or(pcs(R.inverse.croissanceHistorique)), 'sur l\'historique disponible') +
        '</div>' + note(esc(R.inverse.lecture));
    }

    html += groupe('Actualisation des dividendes', 'gordon');
    html += '<div class="af-form">' +
      champ('Dividende de référence', 'num', 'dividende', H.dividende) +
      champ('Croissance du dividende', 'pct', 'croissanceDividende', H.croissanceDividende) +
      champ('Rendement exigé', 'pct', 'rendementExige', H.rendementExige, null,
        'par défaut le coût des fonds propres : ' + pc(w.coutFondsPropres, 2)) +
      '</div>';
    if (R.ddm.ok) {
      html += '<div class="af-methode"><span>Gordon-Shapiro</span><strong>' + n0(R.ddm.valeur) + ' FCFA</strong></div>';
      if (R.ddm.deuxPhases && R.ddm.deuxPhases.ok) {
        html += '<div class="af-methode"><span>Deux phases</span><strong>' + n0(R.ddm.deuxPhases.valeur) + ' FCFA</strong></div>';
      }
    } else {
      html += '<div class="af-warn">' + R.ddm.erreurs.map(esc).join('<br>') + '</div>';
    }

    html += groupe('Multiples de comparables', 'per');
    var med = S.comparables ? S.comparables.medianes : {};
    html += note('Les multiples de référence sont par défaut les médianes des autres sociétés cotées disposant ' +
      'd\'états financiers. Vous pouvez leur substituer vos propres multiples.');
    html += '<div class="af-form">' +
      champ('Cours sur bénéfice', 'num', 'perRef', fin(H.perRef) ? H.perRef : med.per, null, 'médiane : ' + or(n2(med.per), '—')) +
      champ('Cours sur actif net', 'num', 'pbrRef', fin(H.pbrRef) ? H.pbrRef : med.pbr, null, 'médiane : ' + or(n2(med.pbr), '—')) +
      champ('Cours sur chiffre d\'affaires', 'num', 'psrRef', fin(H.psrRef) ? H.psrRef : med.psr, null, 'médiane : ' + or(n2(med.psr), '—')) +
      champ('Valeur d\'entreprise sur excédent brut', 'num', 'evEbitdaRef', fin(H.evEbitdaRef) ? H.evEbitdaRef : med.evEbitda, null, 'médiane : ' + or(n2(med.evEbitda), '—')) +
      champ('Cours sur flux libre', 'num', 'pfcfRef', H.pfcfRef) +
      '</div>';
    html += '<div class="af-scroll"><table class="af-table"><thead><tr><th>Méthode</th><th class="r">Multiple</th>' +
      '<th class="r">Base par action</th><th class="r">Valeur</th></tr></thead><tbody>' +
      R.multiples.lignes.map(function (l) {
        return '<tr' + (l.utilisable ? '' : ' class="af-off"') + '><td>' + esc(l.libelle) + '</td>' +
          '<td class="r">' + or(n2(l.multiple), '—') + '</td>' +
          '<td class="r">' + or(n0(l.base), '—') + '</td>' +
          '<td class="r">' + (l.utilisable ? n0(l.valeur) + ' FCFA' : '<span class="af-nd">' + esc(l.note) + '</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    html += groupe('Autres méthodes');
    html += '<div class="af-methode"><span>Revenu résiduel</span><strong>' +
      (R.residuel.ok ? n0(R.residuel.valeur) + ' FCFA' : '<span class="af-nd">' + esc(R.residuel.raison) + '</span>') + '</strong></div>';
    html += '<div class="af-methode"><span>Nombre de Graham' + memo('graham') + '</span><strong>' +
      (R.graham.ok ? n0(R.graham.valeur) + ' FCFA' : '<span class="af-nd">' + esc(R.graham.raison) + '</span>') + '</strong></div>';

    html += groupe('Synthèse pondérée');
    html += note('Les méthodes ne se valent pas selon les sociétés. Sur une banque, relevez le revenu résiduel. ' +
      'Sur une valeur de rendement, l\'actualisation des dividendes. Un poids nul écarte la méthode.');
    html += '<div class="af-poids">' + Object.keys(V.POIDS_DEFAUT).map(function (k) {
      var lbl = { dcf: 'Flux actualisés', ddm: 'Dividendes', multiples: 'Multiples', residuel: 'Revenu résiduel', graham: 'Graham' }[k];
      return '<label>' + lbl + '<input type="number" min="0" max="100" step="5" data-poids="' + k + '" value="' +
        Math.round((S.poids[k] || 0) * 100) + '"><span>%</span></label>';
    }).join('') + '</div>';

    var syn = R.synthese;
    html += '<div class="af-scroll"><table class="af-table"><thead><tr><th>Méthode</th><th class="r">Valeur</th>' +
      '<th class="r">Poids effectif</th></tr></thead><tbody>' +
      syn.lignes.map(function (l) {
        var lbl = { dcf: 'Flux actualisés', ddm: 'Dividendes', multiples: 'Multiples', residuel: 'Revenu résiduel', graham: 'Graham' }[l.cle];
        return '<tr' + (l.retenue ? '' : ' class="af-off"') + '><td>' + lbl + '</td>' +
          '<td class="r">' + (l.retenue ? n0(l.valeur) + ' FCFA' : '<span class="af-nd">écartée</span>') + '</td>' +
          '<td class="r">' + (l.retenue ? pc(l.poidsEffectif, 0) : '—') + '</td></tr>';
      }).join('') +
      (fin(syn.valeur) ? '<tr class="af-total"><td>Valeur retenue</td><td class="r">' + n0(syn.valeur) + ' FCFA</td>' +
        '<td class="r">' + or(pcs(syn.potentiel), '—') + '</td></tr>' : '') +
      '</tbody></table></div>';
    if (syn.avertissement) html += '<div class="af-warn">' + esc(syn.avertissement) + '</div>';

    html += '<div class="af-actions">' +
      '<button type="button" class="af-btn" id="afReset">Rétablir les hypothèses d\'origine</button>' +
      '<button type="button" class="af-btn" id="afRapport">Exporter le rapport</button>' +
      '<button type="button" class="af-btn" id="afCsv">Exporter les données</button>' +
      '</div>';
    return html;
  }

  /* ── Onglet Sensibilité ───────────────────────────────────────── */

  function paneSensibilite() {
    var R = S.resultats;
    if (!R || !R.dcf.ok) return vide('Sensibilité indisponible', 'Le calcul des flux actualisés doit d\'abord aboutir.');
    var s = R.sensibilite;
    var ref = R.dcf.parAction;
    var cours = S.analyse.data.price;

    var html = groupe('Matrice de sensibilité');
    html += note('Valeur par action selon le taux d\'actualisation (en lignes) et la croissance perpétuelle (en colonnes). ' +
      'C\'est le tableau le plus utile de toute la valorisation : il montre à quel point le résultat dépend de deux ' +
      'hypothèses que personne ne peut observer.');
    html += '<div class="af-scroll"><table class="af-table af-matrice"><thead><tr><th>Taux \\ croissance</th>' +
      s.croissances.map(function (g) { return '<th class="r">' + pc(g) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      s.grille.map(function (ligne, i) {
        return '<tr><th>' + pc(s.taux[i]) + '</th>' + ligne.map(function (c) {
          if (c.invalide || !fin(c.valeur)) return '<td class="r af-vide">—</td>';
          var cls = pos(cours) ? (c.valeur > cours * 1.15 ? 'af-cell-bon' : c.valeur < cours * 0.85 ? 'af-cell-mauvais' : 'af-cell-neutre') : '';
          var isRef = Math.abs(c.valeur - ref) < 1;
          return '<td class="r ' + cls + (isRef ? ' af-cell-ref' : '') + '">' + n0(c.valeur) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    html += note('La cellule encadrée correspond aux hypothèses retenues. Les cellules vertes valorisent le titre plus de ' +
      '15 % au-dessus du cours, les rouges plus de 15 % en dessous. Sur cette matrice, la valeur va de <strong>' +
      n0(s.min) + '</strong> à <strong>' + n0(s.max) + '</strong> FCFA, soit un écart de <strong>' + pc(s.etendue, 0) +
      '</strong>. Toute valorisation qui ne s\'accompagne pas de cet ordre de grandeur est incomplète.');

    if (R.scenarios) {
      html += groupe('Scénarios');
      html += note('Un investisseur décide en fonction de ce qu\'il perd dans le mauvais cas, pas de ce qu\'il gagne dans le bon.');
      html += '<div class="af-scenarios">' + R.scenarios.map(function (sc) {
        return '<div class="af-scenario af-sc-' + sc.cle + '">' +
          '<div class="af-sc-t">' + esc(sc.nom) + '</div>' +
          '<div class="af-sc-v">' + (sc.ok ? n0(sc.valeur) + ' <small>FCFA</small>' : '<span class="af-nd">non calculable</span>') + '</div>' +
          '<div class="af-sc-p ' + (sc.ok && sc.potentiel >= 0 ? 'af-up' : 'af-down') + '">' + (sc.ok ? or(pcs(sc.potentiel), '') : '') + '</div>' +
          '<div class="af-sc-n">' + esc(sc.note) + '</div>' +
          '<div class="af-sc-h">croissance ' + pc(sc.hypotheses.croissance) + ' · taux ' + pc(sc.hypotheses.taux) +
          ' · perpétuelle ' + pc(sc.hypotheses.croissancePerpetuelle) + '</div>' +
          '</div>';
      }).join('') + '</div>';
    }
    return html;
  }

  /* ── Onglet Comparables ───────────────────────────────────────── */

  function paneComparables() {
    var cmp = S.comparables;
    if (!cmp || !cmp.pairs.length) return vide('Aucun comparable', 'Aucune autre société ne dispose d\'états financiers exploitables.');
    var base = S.analyse;
    var lignes = [base].concat(cmp.pairs);

    var cols = [
      ['per', 'PER', 'n2', 'per'], ['pbr', 'PBR', 'n2', 'pbr'], ['psr', 'PSR', 'n2'],
      ['evEbitda', 'EV/EBE', 'n2', 'ev-ebitda'], ['roe', 'ROE', 'pc', 'roe'],
      ['margeNette', 'Marge nette', 'pc', 'marge-nette'], ['gearing', 'Levier', 'n2', 'gearing'],
      ['rendement', 'Rendement', 'pc2', 'rendement']
    ];

    var html = groupe('Comparaison sectorielle');
    html += note('Comparaison au dernier exercice publié de chaque société. Les sociétés n\'ayant pas publié la même ' +
      'année, les écarts de calendrier peuvent expliquer une partie des différences.');
    html += '<div class="af-scroll"><table class="af-table af-comp"><thead><tr><th>Titre</th>' +
      cols.map(function (c) { return '<th class="r">' + c[1] + (c[3] ? memo(c[3]) : '') + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      lignes.map(function (a) {
        var r = a.dernier;
        var moi = a.data.ticker === base.data.ticker;
        return '<tr' + (moi ? ' class="af-moi"' : '') + ' data-afgoto="' + esc(a.data.ticker) + '">' +
          '<td><strong>' + esc(a.data.ticker) + '</strong><small>' + esc(a.data.nom || '') + '</small></td>' +
          cols.map(function (c) {
            var v = r[c[0]];
            var txt = !fin(v) ? '—' : c[2] === 'pc' ? pc(v) : c[2] === 'pc2' ? pc(v, 2) : n2(v);
            return '<td class="r">' + txt + '</td>';
          }).join('') + '</tr>';
      }).join('') +
      '<tr class="af-mediane"><td>Médiane des pairs</td>' +
      cols.map(function (c) {
        var v = cmp.medianes[c[0]];
        var txt = !fin(v) ? '—' : c[2] === 'pc' ? pc(v) : c[2] === 'pc2' ? pc(v, 2) : n2(v);
        return '<td class="r">' + txt + '</td>';
      }).join('') + '</tr>' +
      '</tbody></table></div>';

    html += groupe('Position relative');
    var r = base.dernier;
    html += '<div class="af-stats">' + cols.map(function (c) {
      var v = r[c[0]], m = cmp.medianes[c[0]];
      if (!fin(v) || !fin(m) || m === 0) return '';
      var ecart = v / m - 1;
      var inverse = ['per', 'pbr', 'psr', 'evEbitda', 'gearing'].indexOf(c[0]) >= 0;
      return st(c[1], pcs(ecart, 0), inverse
        ? (ecart > 0 ? 'plus cher que la médiane' : 'moins cher que la médiane')
        : (ecart > 0 ? 'au-dessus de la médiane' : 'en dessous de la médiane'));
    }).join('') + '</div>';
    html += note('Un multiple inférieur à la médiane n\'est pas en soi une occasion : il peut refléter une rentabilité ' +
      'plus faible ou un risque plus élevé. Croisez systématiquement les multiples avec le ROE et le levier.');
    return html;
  }

  /* ── Onglet Qualité ───────────────────────────────────────────── */

  function paneQualite() {
    var a = S.analyse, q = a.qualite, p = a.piotroski;
    var html = '';

    if (q.enough) {
      html += groupe('Score de qualité');
      html += note('Grille de lecture assumée, contestable pilier par pilier. Chaque note est décomposée ci-dessous ' +
        'pour que vous puissiez juger de sa pertinence plutôt que d\'accepter un chiffre.');
      html += q.piliers.map(function (pl) {
        var w = fin(pl.note) ? pl.note / pl.sur * 100 : 0;
        return '<div class="af-qpilier">' +
          '<div class="af-qp-head"><span>' + esc(pl.nom) + '</span>' +
          '<strong>' + (fin(pl.note) ? Math.round(pl.note) + ' / ' + pl.sur : '<span class="af-nd">non noté</span>') + '</strong></div>' +
          '<div class="af-bar"><div style="width:' + w + '%"></div></div>' +
          '<div class="af-qp-m">' + esc(pl.motif) + '</div>' +
          (pl.details.length ? '<div class="af-qp-d">' + pl.details.map(function (d) {
            return '<span>' + esc(d.l) + ' <strong>' + (fin(d.n) ? Math.round(d.n) + '/' + d.sur : '—') + '</strong></span>';
          }).join('') + '</div>' : '') +
          '</div>';
      }).join('');
      if (q.pilliersManquants.length) {
        html += note('Piliers non notés faute de données : ' + q.pilliersManquants.map(esc).join(', ') + '. ' +
          'La note globale est ramenée aux seuls piliers évaluables.');
      }
    }

    html += groupe('Score de Piotroski', 'piotroski');
    if (!p.enough) {
      html += '<div class="af-warn">' + esc(p.raison || 'Trop peu de tests évaluables.') + '</div>';
    } else {
      html += '<div class="af-piotro"><div class="af-piotro-n">' + p.score + '<small>/' + p.sur + '</small></div>' +
        '<div><div class="af-piotro-l">' + esc(p.lecture.charAt(0).toUpperCase() + p.lecture.slice(1)) + '</div>' +
        '<div class="af-piotro-s">Comparaison des exercices ' + p.exercices[0] + ' et ' + p.exercices[1] + '.</div></div></div>';
      var grp = {};
      p.tests.forEach(function (t) { (grp[t.groupe] = grp[t.groupe] || []).push(t); });
      Object.keys(grp).forEach(function (g) {
        html += '<div class="af-cat">' + esc(g) + '</div>';
        grp[g].forEach(function (t) {
          html += '<div class="af-test af-test-' + (!t.evaluable ? 'na' : t.reussi ? 'ok' : 'ko') + '">' +
            '<span class="af-test-i">' + (!t.evaluable ? '·' : t.reussi ? '✓' : '✗') + '</span>' +
            '<span class="af-test-l">' + esc(t.libelle) + '</span>' +
            '<span class="af-test-d">' + esc(t.detail) + '</span></div>';
        });
      });
      if (p.manquants.length) {
        html += note('Le score original compte neuf tests. Ici ' + p.sur + ' sont évaluables : ' +
          p.manquants.map(esc).join(', ') + ' ' + (p.manquants.length > 1 ? 'demandent' : 'demande') +
          ' des données absentes des états publiés. Vous pouvez les saisir dans l\'onglet Données pour compléter le score.');
      }
    }
    return html;
  }

  /* ── Onglet Données et hypothèses ─────────────────────────────── */

  function paneDonnees() {
    var a = S.analyse;
    var html = groupe('Remarques sur les données');
    if (!a.alertes.length) html += note('Aucune anomalie détectée dans les états financiers chargés.');
    else html += a.alertes.map(function (al) {
      return '<div class="af-alerte af-a-' + al.niveau + '">' + esc(al.txt) + '</div>';
    }).join('');

    html += groupe('Compléter les données manquantes');
    html += note('Les états publiés ne contiennent ni la trésorerie, ni l\'actif et le passif circulants, ni le résultat ' +
      'd\'exploitation. Plutôt que de les estimer en silence, ils sont laissés vides. En les saisissant ici, vous ' +
      'débloquez la dette nette exacte, le ratio de liquidité générale et le test de Piotroski correspondant. ' +
      'Les valeurs saisies apparaissent sur fond ambré dans les états financiers.');

    var champs = [
      ['treso', 'Trésorerie'], ['ebit', 'Résultat d\'exploitation'],
      ['actifCirculant', 'Actif circulant'], ['passifCirculant', 'Passif circulant']
    ];
    html += '<div class="af-scroll"><table class="af-table af-saisie"><thead><tr><th>Exercice</th>' +
      champs.map(function (c) { return '<th class="r">' + c[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      a.rows.map(function (r) {
        var ov = S.overrides[r.annee] || {};
        return '<tr><td>' + r.annee + '</td>' + champs.map(function (c) {
          return '<td class="r"><input type="number" step="any" data-ov="' + r.annee + ':' + c[0] + '" ' +
            'value="' + (fin(C.num(ov[c[0]])) ? ov[c[0]] : '') + '" placeholder="—"></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    html += '<div class="af-actions"><button type="button" class="af-btn" id="afClearOv">Effacer les données saisies</button></div>';

    html += groupe('Hypothèses de valorisation en vigueur');
    var H = S.hypotheses;
    var liste = [
      ['Flux de départ', or(mont(H.fcfDepart))], ['Croissance initiale', or(pc(H.croissance))],
      ['Croissance perpétuelle', or(pc(H.croissancePerpetuelle))], ['Horizon', H.annees + ' ans'],
      ['Taux sans risque', or(pc(H.tauxSansRisque, 2))], ['Prime de marché', or(pc(H.primeMarche, 2))],
      ['Beta', or(n2(H.beta))], ['Prime de taille', or(pc(H.primeTaille, 2))],
      ['Prime d\'illiquidité', or(pc(H.primeLiquidite, 2))], ['Coût de la dette', or(pc(H.coutDette, 2))],
      ['Taux d\'impôt', or(pc(H.tauxImpot, 0))], ['Dette nette', or(mont(H.detteNette))],
      ['Nombre d\'actions', or(n0(H.actions))],
      ['Taux d\'actualisation retenu', or(pc(S.resultats ? S.resultats.taux : NaN, 2))]
    ];
    html += '<div class="af-scroll"><table class="af-table"><tbody>' + liste.map(function (l) {
      return '<tr><td>' + l[0] + '</td><td class="r">' + l[1] + '</td></tr>';
    }).join('') + '</tbody></table></div>';
    html += note('Ces hypothèses sont mémorisées par titre dans votre navigateur. Elles ne sont ni transmises ni partagées.');
    return html;
  }

  /* ── Champs de saisie ─────────────────────────────────────────── */

  function champ(label, type, cle, valeur, options, aide) {
    var v = '';
    if (type === 'pct') v = fin(valeur) ? (valeur * 100).toFixed(2).replace(/\.?0+$/, '') : '';
    else if (type === 'mont') v = fin(valeur) ? Math.round(valeur) : '';
    else if (fin(valeur)) v = valeur;
    else if (typeof valeur === 'string') v = valeur;

    var input;
    if (type === 'select') {
      input = '<select data-hyp="' + cle + '" data-type="select">' + options.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(valeur) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>';
    } else {
      input = '<input type="number" step="' + (type === 'int' ? '1' : 'any') + '" data-hyp="' + cle + '" ' +
        'data-type="' + type + '" value="' + esc(v) + '" placeholder="—">' +
        (type === 'pct' ? '<span class="af-unit">%</span>' : '');
    }
    return '<label class="af-champ"><span class="af-champ-l">' + esc(label) + '</span>' + input +
      (aide ? '<small>' + esc(aide) + '</small>' : '') + '</label>';
  }

  /* ── Export ───────────────────────────────────────────────────── */

  function download(txt, nom, type) {
    var b = new Blob([txt], { type: type });
    var u = URL.createObjectURL(b);
    var a = document.createElement('a');
    a.href = u; a.download = nom;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
  }

  function exportCsv() {
    var a = S.analyse;
    if (!a || !a.enough) return;
    var lignes = [];
    var head = ['poste'].concat(a.years);
    lignes.push(head.join(';'));
    [['ca', 'chiffre_affaires'], ['rbe', 'resultat_brut'], ['rn', 'resultat_net'], ['cp', 'capitaux_propres'],
    ['actif', 'total_actif'], ['dette', 'dettes_financieres'], ['cfo', 'flux_operationnel'],
    ['capex', 'investissements'], ['fcf', 'flux_libre'], ['actions', 'nombre_actions'],
    ['bpa', 'bpa'], ['dpa', 'dpa']].forEach(function (k) {
      lignes.push([k[1]].concat(a.rows.map(function (r) { return fin(r[k[0]]) ? r[k[0]] : ''; })).join(';'));
    });
    lignes.push('');
    lignes.push(['ratio'].concat(a.years).join(';'));
    ['margeBrute', 'margeNette', 'roe', 'roa', 'gearing', 'autonomie', 'detteEbitda', 'rotationActifs',
      'margeFcf', 'conversionCash', 'per', 'pbr', 'psr', 'evEbitda', 'rendement', 'payout'].forEach(function (k) {
        lignes.push([k].concat(a.ratios.map(function (r) { return fin(r[k]) ? r[k].toFixed(4) : ''; })).join(';'));
      });
    download(lignes.join('\n'), 'fondamentaux_' + S.ticker + '.csv', 'text/csv;charset=utf-8');
    notify('Données exportées.', 'success');
  }

  function exportRapport() {
    var a = S.analyse, R = S.resultats, w = S.wacc, H = S.hypotheses;
    if (!a || !a.enough) return;
    var L = [], sep = function (t) { L.push('', '─'.repeat(68), t.toUpperCase(), '─'.repeat(68)); };
    var P = function (v, d) { return fin(v) ? (v * 100).toFixed(d == null ? 2 : d) + ' %' : 'non calculable'; };
    var N = function (v) { return fin(v) ? Math.round(v).toLocaleString('fr-FR') : 'non calculable'; };

    L.push('THE CAPITAL — RAPPORT D\'ANALYSE FONDAMENTALE');
    L.push('='.repeat(68));
    L.push('Société    : ' + a.data.ticker + (a.data.nom ? ' — ' + a.data.nom : ''));
    if (a.data.secteur) L.push('Secteur    : ' + a.data.secteur);
    L.push('Édité le   : ' + new Date().toLocaleString('fr-FR'));
    L.push('Exercices  : ' + a.rows.length + ' (' + a.years[0] + ' à ' + a.years[a.years.length - 1] + ')');
    L.push('Cours      : ' + N(a.data.price) + ' FCFA');

    sep('Qualité financière');
    if (a.qualite.enough) {
      L.push('Note globale : ' + Math.round(a.qualite.note100) + ' / 100 — ' + a.qualite.mention);
      a.qualite.piliers.forEach(function (p) {
        L.push('  · ' + p.nom + ' : ' + (fin(p.note) ? Math.round(p.note) + '/' + p.sur : 'non noté'));
        L.push('    ' + p.motif);
      });
    }
    if (a.piotroski.enough) {
      L.push('');
      L.push('Piotroski : ' + a.piotroski.score + ' / ' + a.piotroski.sur + ' — ' + a.piotroski.lecture);
      a.piotroski.tests.forEach(function (t) {
        L.push('  ' + (!t.evaluable ? '·' : t.reussi ? '+' : '-') + ' ' + t.libelle + ' — ' + t.detail);
      });
    }

    sep('Ratios du dernier exercice');
    var r = a.dernier;
    [['Marge brute', P(r.margeBrute)], ['Marge nette', P(r.margeNette)], ['ROE', P(r.roe)], ['ROA', P(r.roa)],
    ['Levier financier', fin(r.gearing) ? r.gearing.toFixed(2) : 'non calculable'],
    ['Autonomie financière', P(r.autonomie)], ['Conversion en trésorerie', fin(r.conversionCash) ? r.conversionCash.toFixed(2) : 'non calculable'],
    ['PER', fin(r.per) ? r.per.toFixed(2) : 'non calculable'], ['PBR', fin(r.pbr) ? r.pbr.toFixed(2) : 'non calculable'],
    ['Rendement', P(r.rendement)], ['Taux de distribution', P(r.payout)]].forEach(function (x) {
      L.push('  ' + x[0].padEnd(30) + ' : ' + x[1]);
    });

    sep('Croissance');
    ['ca', 'rbe', 'rn', 'fcf', 'dpa'].forEach(function (k) {
      var t = a.croissances[k];
      var lbl = { ca: 'Chiffre d\'affaires', rbe: 'Résultat brut', rn: 'Résultat net', fcf: 'Flux libre', dpa: 'Dividende' }[k];
      L.push('  ' + lbl.padEnd(24) + ' : ' + (fin(t.value) ? P(t.value) + ' par an sur ' + t.annees + ' ans' : 'non calculable — ' + t.raison));
    });

    if (R) {
      sep('Hypothèses de valorisation');
      L.push('  Flux de départ           : ' + N(H.fcfDepart));
      L.push('  Croissance initiale      : ' + P(H.croissance));
      L.push('  Croissance perpétuelle   : ' + P(H.croissancePerpetuelle));
      L.push('  Horizon                  : ' + H.annees + ' ans');
      L.push('  Taux sans risque         : ' + P(H.tauxSansRisque));
      L.push('  Prime de marché          : ' + P(H.primeMarche));
      L.push('  Beta                     : ' + (fin(H.beta) ? H.beta.toFixed(2) : '—'));
      L.push('  Prime de taille          : ' + P(H.primeTaille));
      L.push('  Prime d\'illiquidité      : ' + P(H.primeLiquidite));
      L.push('  Coût des fonds propres   : ' + P(w.coutFondsPropres));
      L.push('  Taux d\'actualisation     : ' + P(R.taux));

      sep('Résultats de valorisation');
      if (R.dcf.ok) {
        L.push('  Flux actualisés          : ' + N(R.dcf.parAction) + ' FCFA par action');
        L.push('    dont valeur terminale  : ' + P(R.dcf.partTerminale, 0) + ' du total');
        R.dcf.reserves.forEach(function (x) { L.push('    réserve : ' + x); });
      } else {
        L.push('  Flux actualisés          : calcul impossible');
        R.dcf.erreurs.forEach(function (e) { L.push('    ' + e); });
      }
      L.push('  Dividendes actualisés    : ' + (R.ddm.ok ? N(R.ddm.valeur) + ' FCFA' : 'inapplicable'));
      L.push('  Multiples de comparables : ' + (fin(R.multiples.mediane) ? N(R.multiples.mediane) + ' FCFA sur ' + R.multiples.retenues + ' méthodes' : 'inapplicable'));
      L.push('  Revenu résiduel          : ' + (R.residuel.ok ? N(R.residuel.valeur) + ' FCFA' : 'inapplicable'));
      L.push('  Nombre de Graham         : ' + (R.graham.ok ? N(R.graham.valeur) + ' FCFA' : 'inapplicable'));
      L.push('');
      var syn = R.synthese;
      if (fin(syn.valeur)) {
        L.push('  VALEUR RETENUE           : ' + N(syn.valeur) + ' FCFA');
        L.push('  Fourchette               : ' + N(syn.fourchette.bas) + ' à ' + N(syn.fourchette.haut) + ' FCFA');
        L.push('  Potentiel                : ' + P(syn.potentiel, 1));
        L.push('  Marge de sécurité        : ' + P(syn.margeSecurite, 1));
        if (syn.avertissement) L.push('  ' + syn.avertissement);
      }
      if (R.sensibilite) {
        L.push('');
        L.push('  Sur la matrice de sensibilité, la valeur va de ' + N(R.sensibilite.min) +
          ' à ' + N(R.sensibilite.max) + ' FCFA, soit un écart de ' + P(R.sensibilite.etendue, 0) + '.');
      }
      if (R.inverse && R.inverse.ok) {
        L.push('  Croissance implicite du cours actuel : ' + P(R.inverse.croissanceImplicite));
        L.push('  ' + R.inverse.lecture);
      }
      if (R.scenarios) {
        L.push('');
        R.scenarios.forEach(function (s) {
          L.push('  ' + s.nom.padEnd(14) + ' : ' + (s.ok ? N(s.valeur) + ' FCFA (' + P(s.potentiel, 1) + ')' : 'non calculable'));
        });
      }
    }

    if (a.alertes.length) {
      sep('Remarques sur les données');
      a.alertes.forEach(function (x) { L.push('  [' + x.niveau + '] ' + x.txt); });
    }

    L.push('', '='.repeat(68));
    L.push('Rapport produit par The Capital à partir des états financiers publiés.');
    L.push('Les hypothèses de valorisation sont celles affichées ci-dessus et ont été');
    L.push('choisies par l\'utilisateur. Ce document ne constitue pas un conseil en');
    L.push('investissement et ne remplace pas la lecture des rapports annuels.');

    download(L.join('\n'), 'fondamentale_' + S.ticker + '_' + new Date().toISOString().slice(0, 10) + '.txt', 'text/plain;charset=utf-8');
    notify('Rapport exporté.', 'success');
  }

  /* ── Événements ───────────────────────────────────────────────── */

  function bind() {
    var r = root();
    if (!r || r.dataset.afBound === '1') return;
    r.dataset.afBound = '1';

    r.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'afTicker') { load(t.value); return; }

      var hyp = t.getAttribute && t.getAttribute('data-hyp');
      if (hyp) {
        var type = t.getAttribute('data-type');
        if (type === 'select') S.hypotheses[hyp] = t.value;
        else {
          var v = t.value === '' ? NaN : Number(t.value);
          S.hypotheses[hyp] = !isFinite(v) ? NaN : (type === 'pct' ? v / 100 : v);
        }
        saveHyp(); recompute(); render();
        return;
      }

      var poids = t.getAttribute && t.getAttribute('data-poids');
      if (poids) {
        S.poids[poids] = Math.max(0, Number(t.value) || 0) / 100;
        store(LS.poids, S.poids);
        recompute(); render();
        return;
      }

      var ov = t.getAttribute && t.getAttribute('data-ov');
      if (ov) {
        var parts = ov.split(':');
        S.overrides[parts[0]] = S.overrides[parts[0]] || {};
        if (t.value === '') delete S.overrides[parts[0]][parts[1]];
        else S.overrides[parts[0]][parts[1]] = Number(t.value);
        saveOv();
        var keep = S.tab;
        load(S.ticker);
        S.tab = keep;
        render();
      }
    });

    r.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-aftab],[data-afgoto],button') : null;
      if (!t) return;
      var v;
      if ((v = t.getAttribute('data-aftab'))) { S.tab = v; store(LS.tab, v); render(); return; }
      if ((v = t.getAttribute('data-afgoto'))) {
        var sel = $('afTicker');
        if (sel) sel.value = v;
        load(v);
        return;
      }
      switch (t.id) {
        case 'afReset':
          S.hypotheses = V.hypothesesInitiales(S.analyse);
          try { localStorage.removeItem(LS.hyp + S.ticker); } catch (err) { }
          recompute(); render();
          notify('Hypothèses rétablies.', 'success');
          break;
        case 'afClearOv':
          S.overrides = {};
          try { localStorage.removeItem(LS.ov + S.ticker); } catch (err) { }
          var k = S.tab; load(S.ticker); S.tab = k; render();
          notify('Données saisies effacées.', 'success');
          break;
        case 'afRapport': exportRapport(); break;
        case 'afCsv': exportCsv(); break;
        case 'afMemos': if (global.TCMemo) global.TCMemo.index(); break;
      }
    });
  }

  /* ── Amorçage ─────────────────────────────────────────────────── */

  var booted = false;

  function init() {
    if (!$('afPanel')) return false;
    if (!booted) {
      S.tab = read(LS.tab, 'synthese');
      S.poids = read(LS.poids, null) || Object.assign({}, V.POIDS_DEFAUT);
      bind();
      booted = true;
    }
    var n = fillSelect();
    if (!n) { render(); return false; }
    if (!S.ticker) {
      var first = tickers()[0];
      if (first) { var sel = $('afTicker'); if (sel) sel.value = first.ticker; load(first.ticker); }
    } else render();
    return true;
  }

  global.afInit = function () {
    try { return init(); } catch (e) { console.error('[AF]', e); return false; }
  };
  global.renderAnalyseFondamentale = function () {
    if (!booted) { global.afInit(); return; }
    fillSelect();
    render();
  };
  /* Nom historique conservé : d'autres vues l'appellent encore. */
  global.loadFundAnalysis = function () { global.afInit(); };

  global.addEventListener('tc:dataready', function () { if (booted) { fillSelect(); if (S.ticker) load(S.ticker); } });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(global.afInit, 0); }, { once: true });
  }
})(typeof window !== 'undefined' ? window : globalThis);
