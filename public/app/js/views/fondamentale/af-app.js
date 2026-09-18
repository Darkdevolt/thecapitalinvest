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

  var LS = {
    hyp: 'tc-af-hyp:', ov: 'tc-af-data:', tab: 'tc-af-tab', poids: 'tc-af-poids', portee: 'tc-af-portee',
    stat: 'tc-af-stat', exclus: 'tc-af-exclus'
  };

  var PORTEES = [
    { id: 'sousSecteur', l: 'Sous-secteur' },
    { id: 'secteur', l: 'Secteur' },
    { id: 'marche', l: 'Marché entier' }
  ];

  /* Une entrée par méthode de valorisation individuelle, y compris
     chaque multiple pris séparément (PER, PBR, PSR, VE/EBE, cours sur
     flux libre) : source unique du libellé, utilisée par la pondération,
     le tableau de synthèse et le rapport exporté, pour ne jamais avoir
     trois noms différents pour la même méthode. */
  var METHODE_LABELS = {
    dcf: 'Flux actualisés (DCF)',
    ddm: 'Dividendes (Gordon-Shapiro)',
    dyMarche: 'Dividende / rendement de marché',
    per: 'Cours / Bénéfice (PER)',
    pbr: 'Cours / Actif net (PBR)',
    psr: 'Cours / Chiffre d\'affaires (PSR)',
    evEbitda: 'VE / Excédent brut',
    pfcf: 'Cours / Flux libre',
    vcpa: 'Actif net par action (VCPA)',
    residuel: 'Revenu résiduel',
    graham: 'Graham'
  };
  var METHODE_GROUPES = [
    { titre: 'Flux et dividendes', cles: ['dcf', 'ddm', 'dyMarche'] },
    { titre: 'Multiples de comparables', cles: ['per', 'pbr', 'psr', 'evEbitda', 'pfcf'] },
    { titre: 'Valeur comptable et autres', cles: ['vcpa', 'residuel', 'graham'] }
  ];
  var METHODE_COULEURS = ['#c8a24e', '#3fc98a', '#60a5fa', '#f0a72a', '#a78bfa', '#f0645e', '#4ade80', '#e879f9', '#38bdf8'];

  var S = {
    ticker: '', analyse: null, hypotheses: null, wacc: null,
    tab: 'synthese', overrides: {}, poids: null,
    /* Mémorise, en session seulement (pas persisté), le dernier poids
       actif de chaque méthode désactivée par l'interrupteur on/off, pour
       le restaurer tel quel à la réactivation plutôt que de retomber
       sur le poids par défaut du secteur. */
    poidsMemoire: {},
    resultats: null, comparables: null, comparablesMarche: null, unite: 'auto',
    portee: 'sousSecteur',
    /* Statistique (médiane ou moyenne) et pairs exclus du groupe de
       comparables : préférences globales de l'utilisateur, pas propres
       à un titre — exclure une société jugée non représentative (bénéfice
       proche de zéro faussant son PER, par exemple) vaut pour toutes les
       analyses où elle apparaîtrait comme pair. */
    comparablesStat: 'mediane', comparablesExclus: []
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
    S.poids = read(LS.poids, null) || V.poidsDefaut(a.data);
    S.portee = read(LS.portee, null) || 'sousSecteur';
    refreshComparables();
    recompute();
    render();
    return true;
  }

  /* Recalcule le groupe de comparables (portée + statistique + pairs
     exclus, ces deux derniers étant des préférences globales) et le
     rendement médian de marché utilisé par la méthode « dividende /
     rendement de marché ». Centralisé ici pour que la portée, la
     statistique et les exclusions restent toujours cohérentes entre
     elles, quel que soit le réglage modifié. */
  function refreshComparables() {
    var opts = { portee: S.portee, exclus: S.comparablesExclus, stat: S.comparablesStat };
    try { S.comparables = C.comparables(S.ticker, opts); }
    catch (e) { S.comparables = null; }
    /* Rendement de référence pour la méthode « dividende / rendement de
       marché » : toujours calculé sur le marché entier, indépendamment de
       la portée choisie ci-dessus pour les multiples — un rendement
       exigé n'a pas à se limiter au sous-secteur pour rester pertinent,
       à la différence d'un PER ou d'un PBR. Les pairs exclus et la
       statistique choisie restent appliqués. */
    try { S.comparablesMarche = C.comparables(S.ticker, Object.assign({}, opts, { portee: 'marche' })); }
    catch (e) { S.comparablesMarche = null; }
  }

  /* ── Recalcul de toutes les valorisations ─────────────────────── */

  function recompute() {
    if (!S.analyse || !S.analyse.enough || !S.hypotheses) { S.resultats = null; return; }
    var H = S.hypotheses;
    var a = S.analyse;
    var financier = C.estFinancier(a.data.secteur || a.data.sousSecteur);

    var w = V.wacc(H);
    S.wacc = w;
    /* Pour une banque ou un assureur, le WACC classique mélange le coût
       des fonds propres à un coût de la « dette » dont la composition
       réelle (dépôts, refinancement interbancaire...) n'a rien à voir
       avec une dette industrielle destinée à financer des actifs — la
       pondération capitaux propres / dette calculée plus haut (souvent
       très majoritairement « dette ») sous-estimerait alors fortement le
       taux d'actualisation. Le revenu résiduel, méthode de référence pour
       ce secteur, actualise déjà uniquement au coût des fonds propres :
       le DCF (mineur dans la pondération sectorielle mais pas nul) fait
       de même par cohérence, sauf taux imposé manuellement. */
    var taux = fin(H.tauxManuel) ? H.tauxManuel : (financier ? w.coutFondsPropres : w.valeur);

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
      croissance: H.croissance, croissancePerpetuelle: H.croissancePerpetuelle, annees: H.annees,
      /* Le dernier exercice est justement celui où le dividende manque le
         plus souvent (publié après le reste des comptes) : on retient la
         moyenne historique du taux de distribution plutôt que la seule
         dernière année, qui reviendrait à supposer 0 % de distribution
         future pour une société qui distribue depuis toujours. */
      payoutRef: fin(H.payoutRef) ? H.payoutRef : a.moyennes.payout
    }));
    var gr = V.graham(H.bpa, H.anpa, H.facteurGraham);

    function mult(cle) { var l = mu.lignes.filter(function (x) { return x.cle === cle; })[0]; return l && l.utilisable ? l.valeur : NaN; }

    /* Valeur comptable par action retenue telle quelle comme cible (fair
       value = 1× l'actif net), sans passer par un multiple de pairs :
       une méthode à part entière, plus prudente que le PBR (qui suppose
       que le marché a raison de payer plus ou moins que le comptable),
       demandée explicitement pour compléter le PER, l'EV/EBIT et le
       rendement plutôt que d'être noyée dans le multiple de comparables. */
    var vcpaDirect = fin(H.anpa) && H.anpa > 0 ? H.anpa : NaN;

    /* Dividende par action de référence : le dernier connu, même si
       l'exercice le plus récent ne l'a pas encore publié (même logique
       que le revenu résiduel plus haut). */
    var dpaRef = fin(H.dividende) ? H.dividende : NaN;
    if (!fin(dpaRef)) {
      for (var iDpa = a.rows.length - 1; iDpa >= 0; iDpa--) {
        if (fin(a.rows[iDpa].dpa) && a.rows[iDpa].dpa > 0) { dpaRef = a.rows[iDpa].dpa; break; }
      }
    }
    /* Cible par le rendement : le dividende de référence rapporté au
       rendement médian de l'ensemble du marché (pas du seul sous-secteur
       — un rendement exigé se compare à l'éventail des placements
       disponibles, pas seulement aux pairs directs), plutôt qu'à un coût
       des fonds propres calculé par CAPM. Méthode plus simple que le
       Gordon-Shapiro ci-dessus, à dessein : elle sert de recoupement,
       pas de remplacement. */
    var dyMarche = S.comparablesMarche ? S.comparablesMarche.medianes.rendement : NaN;
    var vcDyMarche = pos(dpaRef) && fin(dyMarche) && dyMarche > 0 ? dpaRef / dyMarche : NaN;

    S.resultats = {
      taux: taux, financier: financier,
      dcf: D,
      sensibilite: D.ok ? V.sensibilite(base) : null,
      inverse: D.ok ? V.dcfInverse(base, a.data.price) : null,
      scenarios: D.ok ? V.scenarios(base, a.data.price) : null,
      multiples: mu,
      ddm: dd,
      residuel: rr,
      graham: gr,
      vcpaDirect: vcpaDirect,
      dyMarche: { dpaRef: dpaRef, rendementMarche: dyMarche, valeur: vcDyMarche },
      synthese: V.synthese({
        dcf: D.ok ? D.parAction : NaN,
        ddm: dd.ok ? dd.valeur : NaN,
        per: mult('per'), pbr: mult('pbr'), psr: mult('psr'), evEbitda: mult('evEbitda'), pfcf: mult('pfcf'),
        residuel: rr.ok ? rr.valeur : NaN,
        graham: gr.ok ? gr.valeur : NaN,
        vcpa: vcpaDirect,
        dyMarche: vcDyMarche
      }, S.poids, a.data.price)
    };
  }

  function saveHyp() { if (S.ticker) store(LS.hyp + S.ticker, S.hypotheses); }
  function saveOv() { if (S.ticker) store(LS.ov + S.ticker, S.overrides); }

  /* ── Onglets ──────────────────────────────────────────────────── */

  /* Le "sep" marque le début d'un groupe visuel dans la barre d'onglets
     (simple séparateur, aucune incidence sur le routage : chaque onglet
     garde son data-aftab et son gestionnaire de clic habituels). Sert à
     donner une structure lisible à neuf onglets plutôt qu'une rangée
     plate : vue d'ensemble, données chiffrées, valorisation, évaluation. */
  var TABS = [
    { id: 'synthese', l: 'Synthèse' },
    { id: 'etats', l: 'États financiers', sep: true },
    { id: 'ratios', l: 'Ratios' },
    { id: 'croissance', l: 'Croissance' },
    { id: 'valorisation', l: 'Valorisation', sep: true },
    { id: 'sensibilite', l: 'Sensibilité' },
    { id: 'comparables', l: 'Comparables' },
    { id: 'qualite', l: 'Qualité', sep: true },
    { id: 'donnees', l: 'Données & hypothèses' }
  ];

  function render() {
    var host = $('afPanel');
    if (!host) return;
    var t = $('afTabs');
    if (t) t.innerHTML = TABS.map(function (x) {
      return (x.sep ? '<span class="af-tab-sep"></span>' : '') +
        '<button type="button" class="af-tab' + (x.id === S.tab ? ' on' : '') + '" data-aftab="' + x.id + '">' + x.l + '</button>';
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

  var PORTEE_LABEL = { sousSecteur: 'sous-secteur', secteur: 'secteur', marche: 'marché entier' };

  /* Sélecteur de portée des comparables : trois boutons, la portée
     retenue mémorisée par appareil (pas par titre, le choix relève de
     la méthode, pas de la société consultée). */
  function porteeToggle() {
    return '<div class="af-portee">' + PORTEES.map(function (p) {
      return '<button type="button" class="af-portee-btn' + (S.portee === p.id ? ' on' : '') + '" data-afportee="' + p.id + '">' + p.l + '</button>';
    }).join('') + '</div>';
  }

  var STATS = [{ id: 'mediane', l: 'Médiane' }, { id: 'moyenne', l: 'Moyenne' }];
  function statToggle() {
    return '<div class="af-portee" title="Statistique retenue pour agréger les pairs">' + STATS.map(function (s) {
      return '<button type="button" class="af-portee-btn' + (S.comparablesStat === s.id ? ' on' : '') + '" data-afstat="' + s.id + '">' + s.l + '</button>';
    }).join('') + '</div>';
  }

  /* Avertit quand la portée demandée n'a pas assez de pairs et qu'un
     repli automatique a eu lieu : la médiane affichée ne correspond
     alors pas à ce que le bouton actif laisse penser. */
  function porteeNote(cmp) {
    if (!cmp) return '';
    var retenusTxt = cmp.pairsRetenus && cmp.pairsRetenus.length !== cmp.pairs.length
      ? ' (' + cmp.pairsRetenus.length + ' retenue(s) après exclusions)' : '';
    var txt = 'Comparables : ' + cmp.pairs.length + ' société(s)' + retenusTxt + ' — portée « ' + PORTEE_LABEL[cmp.portee] + ' »' +
      (cmp.sousSecteur ? ' (' + esc(cmp.sousSecteur) + ')' : (cmp.secteur ? ' (' + esc(cmp.secteur) + ')' : '')) + '.';
    if (cmp.repli) {
      txt += ' Repli automatique depuis « ' + PORTEE_LABEL[cmp.repli] + ' », faute d\'au moins deux pairs à ce niveau.';
    }
    return note(txt);
  }

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
          ['margeBrute', 'Marge d\'exploitation (RBE)', 'pc', 'marge-exploitation'],
          ['margeNette', 'Marge nette', 'pc', 'marge-nette'],
          ['roe', 'Rentabilité des capitaux propres', 'pc', 'roe', [0.12]],
          ['roa', 'Rentabilité des actifs', 'pc', 'roa'],
          ['roce', 'Rentabilité des capitaux employés', 'pc']
        ]
      },
      {
        t: 'Structure financière', l: [
          ['gearing', 'Levier financier', 'n2', 'gearing', [1, true]],
          ['autonomie', 'Autonomie financière', 'pc', 'autonomie'],
          ['detteActif', 'Dette rapportée au bilan', 'pc'],
          ['detteEbitda', 'Dette nette sur excédent brut', 'n2', 'dette-ebitda', [3, true]],
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
          ['rendement', 'Rendement du dividende', 'pc2', 'rendement', [0.04]],
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
        var k = row[0], lbl = row[1], fmt = row[2], mk = row[3], seuil = row[4];
        html += '<tr><td>' + esc(lbl) + (mk ? memo(mk) : '') + '</td>' +
          a.ratios.map(function (r, i) {
            var v = r[k];
            var txt = !fin(v) ? '—'
              : fmt === 'pc' ? pc(v) : fmt === 'pc2' ? pc(v, 2) : fmt === 'n0' ? n0(v) : n2(v);
            /* Seul le dernier exercice est colorisé bon/mauvais : sur
               l'historique complet, la couleur guiderait l'œil vers des
               années qui ne représentent plus la situation actuelle. */
            var cls = seuil && i === a.ratios.length - 1 ? ' ' + tone(v, seuil[0], seuil[1]) : '';
            return '<td class="r' + (fin(v) ? '' : ' af-vide') + cls + '">' + txt + '</td>';
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
      html += note(S.hypotheses.methodeProj === 'manuel'
        ? 'Saisissez un taux pour que la projection au taux manuel s\'affiche : elle ne se substitue jamais silencieusement au taux de croissance historique.'
        : 'La projection demande au moins trois exercices renseignés pour la grandeur retenue.');
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
        /* Le mode manuel ne doit jamais se replier en silence sur le TCAM
           historique quand le taux n'est pas encore saisi : ce serait
           appliquer une méthode que l'utilisateur n'a pas choisie sans le
           dire, exactement ce que le reste du module s'interdit ailleurs. */
        var g = methode === 'manuel' ? (fin(H.tauxProjManuel) ? H.tauxProjManuel : NaN)
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
    var H = S.hypotheses, R = S.resultats, w = S.wacc, a = S.analyse;
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
        st(R.inverse.enButee ? 'Croissance implicite (plancher)' : 'Croissance implicite', pcs(R.inverse.croissanceImplicite), 'que le cours actuel intègre') +
        st('Croissance réalisée', or(pcs(R.inverse.croissanceHistorique)), 'sur l\'historique disponible') +
        '</div>' + note(esc(R.inverse.lecture));
      if (R.inverse.enButee) html += '<div class="af-warn">La recherche n\'a pas convergé dans l\'intervalle exploré (−30 % à +60 % par an) : ce chiffre est une borne, pas une valeur précise.</div>';
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

    html += groupe('Dividende / rendement de marché');
    html += note('Cible plus simple que le Gordon-Shapiro : le dividende de référence rapporté au rendement médian de ' +
      '<strong>l\'ensemble du marché</strong> (toutes valeurs BRVM suivies, pas seulement les pairs du secteur), sans ' +
      'hypothèse de croissance ni de coût du capital. Sert de recoupement, pas de remplacement.');
    if (pos(R.dyMarche.valeur)) {
      html += '<div class="af-methode"><span>Dividende ' + or(n0(R.dyMarche.dpaRef), '—') + ' FCFA ÷ rendement marché ' +
        or(pc(R.dyMarche.rendementMarche, 2), '—') + '</span><strong>' + n0(R.dyMarche.valeur) + ' FCFA</strong></div>';
    } else {
      html += '<div class="af-warn">' + (!pos(R.dyMarche.dpaRef) ? 'Aucun dividende connu, même historique, pour ce titre.' : 'Rendement médian du marché indisponible.') + '</div>';
    }

    html += groupe('Multiples de comparables', 'per');
    html += porteeToggle();
    var med = S.comparables ? S.comparables.medianes : {};
    var statLbl = S.comparablesStat === 'moyenne' ? 'moyenne' : 'médiane';
    html += S.comparables ? porteeNote(S.comparables) : note('Aucun comparable disponible pour calculer une ' + statLbl + '.');
    html += note('Les multiples de référence sont par défaut la ' + statLbl + ' du groupe de pairs ci-dessus, pairs ' +
      'exclus et statistique choisis dans l\'onglet Comparables. Vous pouvez leur substituer vos propres multiples.');
    html += '<div class="af-form">' +
      champ('Cours sur bénéfice', 'num', 'perRef', fin(H.perRef) ? H.perRef : med.per, null, statLbl + ' : ' + or(n2(med.per), '—')) +
      champ('Cours sur actif net', 'num', 'pbrRef', fin(H.pbrRef) ? H.pbrRef : med.pbr, null, statLbl + ' : ' + or(n2(med.pbr), '—')) +
      champ('Cours sur chiffre d\'affaires', 'num', 'psrRef', fin(H.psrRef) ? H.psrRef : med.psr, null, statLbl + ' : ' + or(n2(med.psr), '—')) +
      champ('Valeur d\'entreprise sur excédent brut', 'num', 'evEbitdaRef', fin(H.evEbitdaRef) ? H.evEbitdaRef : med.evEbitda, null, statLbl + ' : ' + or(n2(med.evEbitda), '—')) +
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

    html += groupe('Valeur comptable et autres méthodes');
    html += note('L\'actif net par action est ici retenu <strong>tel quel</strong> comme valeur cible — un P/B de 1×, ' +
      'plus prudent que le PBR ci-dessus qui applique le multiple que le marché accorde aux pairs. C\'est une méthode ' +
      'à part entière, pas une variante du PBR : elle ne suppose aucune prime ni décote sur les fonds propres.');
    html += '<div class="af-methode"><span>Actif net par action (VCPA)</span><strong>' +
      (pos(R.vcpaDirect) ? n0(R.vcpaDirect) + ' FCFA' : '<span class="af-nd">non calculable</span>') + '</strong></div>';

    html += note('Le revenu résiduel réutilise la croissance perpétuelle fixée ci-dessus pour l\'actualisation des flux ' +
      '(pas la croissance de départ, économiquement intenable à l\'infini) et suppose, sauf indication contraire, que ' +
      'la société continue à distribuer le même taux de son bénéfice que par le passé plutôt que 0 %.');
    html += '<div class="af-form">' +
      champ('Taux de distribution retenu (projection)', 'pct', 'payoutRef', H.payoutRef, null,
        'par défaut la moyenne historique : ' + or(pc(a.moyennes.payout, 0), '0 % (aucun historique)')) +
      '</div>';
    html += '<div class="af-methode"><span>Revenu résiduel' + memo('revenu-residuel') + '</span><strong>' +
      (R.residuel.ok ? n0(R.residuel.valeur) + ' FCFA' : '<span class="af-nd">' + esc(R.residuel.raison) + '</span>') + '</strong></div>';
    if (R.residuel.ok) html += note('Taux de distribution retenu pour la projection : ' + pc(R.residuel.payoutRetenu, 0) + '. Croissance perpétuelle : ' + pc(R.residuel.croissancePerpetuelle, 1) + '.');
    html += '<div class="af-methode"><span>Nombre de Graham' + memo('graham') + '</span><strong>' +
      (R.graham.ok ? n0(R.graham.valeur) + ' FCFA' : '<span class="af-nd">' + esc(R.graham.raison) + '</span>') + '</strong></div>';

    var syn = R.synthese;
    html += groupe('Valeur cible pondérée', 'dcf');
    var contribs = syn.lignes.filter(function (l) { return l.retenue; });
    html += '<div class="af-cible-hero">' +
      '<div class="af-cible-main"><div class="af-cible-l">Valeur cible pondérée</div><div class="af-cible-v">' +
        (fin(syn.valeur) ? n0(syn.valeur) : '<span class="af-nd">non calculable</span>') + (fin(syn.valeur) ? ' <small>FCFA</small>' : '') + '</div></div>' +
      '<div class="af-cible-side">' +
        '<div class="af-cible-item"><span>Cours actuel</span><strong class="af-dim">' + or(n0(syn.cours), '—') + '</strong></div>' +
        '<div class="af-cible-item"><span>Potentiel</span><strong class="' + (fin(syn.potentiel) ? (syn.potentiel >= 0 ? 'af-up' : 'af-down') : '') + '">' + or(pcs(syn.potentiel), '—') + '</strong></div>' +
        '<div class="af-cible-item"><span>Méthodes retenues</span><strong>' + syn.retenues + ' / ' + syn.lignes.length + '</strong></div>' +
      '</div>' +
      (contribs.length ? '<div class="af-cible-bar">' + contribs.map(function (l, i) {
        return '<span style="width:' + (l.poidsEffectif * 100) + '%;background:' + METHODE_COULEURS[i % METHODE_COULEURS.length] + '" title="' + esc(METHODE_LABELS[l.cle]) + '"></span>';
      }).join('') + '</div>' +
      '<div class="af-cible-legend">' + contribs.map(function (l, i) {
        return '<span><i style="background:' + METHODE_COULEURS[i % METHODE_COULEURS.length] + '"></i>' + esc(METHODE_LABELS[l.cle]) + ' · ' + pc(l.poidsEffectif, 0) + '</span>';
      }).join('') + '</div>' : '') +
      '</div>';
    if (syn.fourchette && contribs.length > 1) {
      html += note('Fourchette des ' + syn.retenues + ' méthodes retenues : <strong>' + n0(syn.fourchette.bas) + '</strong> à <strong>' + n0(syn.fourchette.haut) + '</strong> FCFA.');
    }
    if (syn.avertissement) html += '<div class="af-warn">' + esc(syn.avertissement) + '</div>';

    html += groupe('Pondération par méthode');
    html += note((V.estFinancier(a.data.secteur || a.data.sousSecteur)
      ? 'Établissement financier : les poids de départ favorisent le revenu résiduel, les dividendes et le PBR plutôt ' +
        'que le DCF classique, dont le flux de trésorerie disponible n\'a pas de sens économique pour une banque ou un assureur.'
      : 'Les méthodes ne se valent pas selon les sociétés. Sur une valeur de rendement, privilégiez l\'actualisation ' +
        'des dividendes ; sur une société de croissance, le DCF.') +
      ' Chaque multiple de comparables se pondère désormais individuellement — par exemple 60 % sur le PER et le reste ' +
      'réparti sur les autres méthodes. L\'interrupteur active ou désactive une méthode sans perdre son poids : ' +
      'décochée, elle sort entièrement du calcul et sa valeur reste affichée à titre de repère.');
    METHODE_GROUPES.forEach(function (grp) {
      html += '<div class="af-poids-groupe"><div class="af-poids-groupe-t">' + esc(grp.titre) + '</div>';
      grp.cles.forEach(function (k) {
        var ligne = syn.lignes.filter(function (l) { return l.cle === k; })[0];
        var actif = (S.poids[k] || 0) > 0;
        var pctVal = Math.round((S.poids[k] || 0) * 100);
        var valTxt = ligne && fin(ligne.valeur) ? n0(ligne.valeur) + ' FCFA' : '<span class="af-nd">non calculable</span>';
        html += '<div class="af-poids-row' + (ligne && ligne.retenue ? '' : ' af-off') + '">' +
          '<label class="af-poids-toggle-wrap" title="' + (actif ? 'Désactiver' : 'Activer') + ' cette méthode">' +
            '<input type="checkbox" class="af-poids-toggle" data-poids-on="' + k + '"' + (actif ? ' checked' : '') + ' aria-label="Activer ' + esc(METHODE_LABELS[k]) + '">' +
            '<span class="af-poids-toggle-track"></span>' +
          '</label>' +
          '<div class="af-poids-label">' + esc(METHODE_LABELS[k]) + '</div>' +
          '<input type="range" class="af-poids-slider" min="0" max="60" step="1" data-poids="' + k + '" value="' + pctVal + '"' + (actif ? '' : ' disabled') + ' aria-label="Poids ' + esc(METHODE_LABELS[k]) + '">' +
          '<div class="af-poids-pct"><input type="number" min="0" max="100" step="1" data-poids="' + k + '" value="' + pctVal + '"' + (actif ? '' : ' disabled') + '><span>%</span></div>' +
          '<div class="af-poids-val">' + valTxt + '</div>' +
          '</div>';
      });
      html += '</div>';
    });
    html += '<button type="button" class="af-lien" id="afResetPoids">Rétablir les poids par défaut du secteur</button>';

    html += groupe('Détail des méthodes');
    html += '<div class="af-scroll"><table class="af-table"><thead><tr><th>Méthode</th><th class="r">Valeur</th>' +
      '<th class="r">Poids saisi</th><th class="r">Poids effectif</th></tr></thead><tbody>' +
      syn.lignes.map(function (l) {
        return '<tr' + (l.retenue ? '' : ' class="af-off"') + '><td>' + esc(METHODE_LABELS[l.cle]) + '</td>' +
          '<td class="r">' + (l.retenue ? n0(l.valeur) + ' FCFA' : '<span class="af-nd">écartée</span>') + '</td>' +
          '<td class="r">' + pc(l.poids, 0) + '</td>' +
          '<td class="r">' + (l.retenue ? pc(l.poidsEffectif, 0) : '—') + '</td></tr>';
      }).join('') +
      (fin(syn.valeur) ? '<tr class="af-total"><td>Valeur retenue</td><td class="r">' + n0(syn.valeur) + ' FCFA</td>' +
        '<td class="r"></td><td class="r">' + or(pcs(syn.potentiel), '—') + '</td></tr>' : '') +
      '</tbody></table></div>';

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
    var html = groupe('Comparaison') + porteeToggle();
    if (!cmp || !cmp.pairs.length) {
      html += note('Aucune autre société de cette portée ne dispose d\'états financiers exploitables. Essayez une portée plus large.');
      return html;
    }
    var base = S.analyse;
    var statLabel = S.comparablesStat === 'moyenne' ? 'Moyenne' : 'Médiane';

    var cols = [
      ['per', 'PER', 'n2', 'per'], ['pbr', 'PBR', 'n2', 'pbr'], ['psr', 'PSR', 'n2'],
      ['evEbitda', 'EV/EBE', 'n2', 'ev-ebitda'], ['roe', 'ROE', 'pc', 'roe'],
      ['margeNette', 'Marge nette', 'pc', 'marge-nette'], ['gearing', 'Levier', 'n2', 'gearing'],
      ['rendement', 'Rendement', 'pc2', 'rendement']
    ];

    html += porteeNote(cmp);
    html += groupe('Statistique et pairs retenus');
    html += note('Un pair dont le bénéfice est tombé presque à zéro produit un PER ou un PBR sans signification ' +
      'économique — à décocher au cas par cas plutôt qu\'à subir dans la moyenne ou la médiane du groupe. La médiane ' +
      'reste la statistique recommandée (peu sensible à une valeur extrême isolée) ; la moyenne reste disponible pour ' +
      'qui la préfère.');
    html += statToggle();
    var exclusIci = cmp.pairs.filter(function (a) { return S.comparablesExclus.indexOf(a.data.ticker) >= 0; }).map(function (a) { return a.data.ticker; });
    if (exclusIci.length) {
      html += note(exclusIci.length + ' pair(s) exclu(s) du calcul ici : ' + esc(exclusIci.join(', ')) +
        '. <button type="button" class="af-lien" id="afReinitExclus">Rétablir tous les pairs</button>');
    }
    html += note('Comparaison au dernier exercice publié de chaque société. Les sociétés n\'ayant pas publié la même ' +
      'année, les écarts de calendrier peuvent expliquer une partie des différences.');
    html += '<div class="af-scroll"><table class="af-table af-comp"><thead><tr><th></th><th>Titre</th>' +
      cols.map(function (c) { return '<th class="r">' + c[1] + (c[3] ? memo(c[3]) : '') + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      '<tr class="af-moi"><td></td><td><strong>' + esc(base.data.ticker) + '</strong><small>' + esc(base.data.nom || '') + ' (ce titre)</small></td>' +
      cols.map(function (c) {
        var v = base.dernier[c[0]];
        var txt = !fin(v) ? '—' : c[2] === 'pc' ? pc(v) : c[2] === 'pc2' ? pc(v, 2) : n2(v);
        return '<td class="r">' + txt + '</td>';
      }).join('') + '</tr>' +
      cmp.pairs.map(function (a) {
        var r = a.dernier;
        var tick = a.data.ticker;
        var exclu = S.comparablesExclus.indexOf(tick) >= 0;
        return '<tr' + (exclu ? ' class="af-off"' : '') + '>' +
          '<td><input type="checkbox" data-afexclu="' + esc(tick) + '"' + (exclu ? '' : ' checked') + ' aria-label="Inclure ' + esc(tick) + ' dans le calcul" title="Inclure ou exclure ce pair du calcul"></td>' +
          '<td data-afgoto="' + esc(tick) + '" style="cursor:pointer"><strong>' + esc(tick) + '</strong><small>' + esc(a.data.nom || '') + '</small></td>' +
          cols.map(function (c) {
            var v = r[c[0]];
            var txt = !fin(v) ? '—' : c[2] === 'pc' ? pc(v) : c[2] === 'pc2' ? pc(v, 2) : n2(v);
            return '<td class="r">' + txt + '</td>';
          }).join('') + '</tr>';
      }).join('') +
      '<tr class="af-mediane"><td></td><td>' + statLabel + ' des ' + cmp.pairsRetenus.length + ' pair(s) retenu(s)</td>' +
      cols.map(function (c) {
        var v = cmp.medianes[c[0]];
        var txt = !fin(v) ? '—' : c[2] === 'pc' ? pc(v) : c[2] === 'pc2' ? pc(v, 2) : n2(v);
        return '<td class="r">' + txt + '</td>';
      }).join('') + '</tr>' +
      '</tbody></table></div>';

    html += groupe('Valeur cible par les multiples du groupe de pairs');
    html += note('Équation à l\'inconnue : le multiple (' + statLabel.toLowerCase() + ' des pairs retenus ci-dessus, le ' +
      'fait observé) est appliqué à la grandeur par action de la société (le fait publié) pour déduire le cours ' +
      'qu\'impliquerait un alignement sur ses pairs.');
    var exd = base.dernierExercice, drn = base.dernier;
    var cibles = [
      { l: 'PER × BPA', m: cmp.medianes.per, base: exd.bpa, unite: '×', cle: 'per' },
      { l: 'PBR × actif net par action', m: cmp.medianes.pbr, base: drn.anpa, unite: '×', cle: 'pbr' }
    ];
    html += '<div class="af-scroll"><table class="af-table"><thead><tr><th>Méthode</th>' +
      '<th class="r">Multiple (' + statLabel.toLowerCase() + ')</th><th class="r">Grandeur par action</th><th class="r">Valeur cible</th><th class="r">Potentiel</th></tr></thead><tbody>' +
      cibles.map(function (c) {
        var val = fin(c.m) && fin(c.base) && c.base > 0 ? c.m * c.base : NaN;
        var pot = fin(val) && pos(base.data.price) ? val / base.data.price - 1 : NaN;
        return '<tr><td>' + esc(c.l) + '</td><td class="r">' + or(n2(c.m), '—') + '</td>' +
          '<td class="r">' + or(n0(c.base), '—') + '</td>' +
          '<td class="r">' + (fin(val) ? n0(val) + ' FCFA' : '<span class="af-nd">non calculable</span>') + '</td>' +
          '<td class="r ' + (fin(pot) ? (pot >= 0 ? 'af-up' : 'af-down') : '') + '">' + or(pcs(pot), '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    html += note('Valeurs reportées automatiquement comme multiples de référence par défaut dans l\'onglet Valorisation ' +
      '(section « Multiples de comparables »), où elles peuvent être remplacées par vos propres hypothèses.');

    html += groupe('Position relative');
    var r = base.dernier;
    html += '<div class="af-stats">' + cols.map(function (c) {
      var v = r[c[0]], m = cmp.medianes[c[0]];
      if (!fin(v) || !fin(m) || m === 0) return '';
      var ecart = v / m - 1;
      var inverse = ['per', 'pbr', 'psr', 'evEbitda', 'gearing'].indexOf(c[0]) >= 0;
      return st(c[1], pcs(ecart, 0), inverse
        ? (ecart > 0 ? 'plus cher que la ' + statLabel.toLowerCase() : 'moins cher que la ' + statLabel.toLowerCase())
        : (ecart > 0 ? 'au-dessus de la ' + statLabel.toLowerCase() : 'en dessous de la ' + statLabel.toLowerCase()));
    }).join('') + '</div>';
    html += note('Un multiple inférieur à la ' + statLabel.toLowerCase() + ' n\'est pas en soi une occasion : il peut ' +
      'refléter une rentabilité plus faible ou un risque plus élevé. Croisez systématiquement les multiples avec le ROE et le levier.');
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
    [['Marge d\'exploitation (RBE)', P(r.margeBrute)], ['Marge nette', P(r.margeNette)], ['ROE', P(r.roe)], ['ROA', P(r.roa)],
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
      L.push('  Dividende / rdt marché   : ' + (pos(R.dyMarche.valeur) ? N(R.dyMarche.valeur) + ' FCFA' : 'inapplicable'));
      R.multiples.lignes.forEach(function (l) {
        L.push('  ' + METHODE_LABELS[l.cle].padEnd(26) + ' : ' + (l.utilisable ? N(l.valeur) + ' FCFA (multiple ' + l.multiple.toFixed(2) + ')' : 'inapplicable'));
      });
      L.push('  Actif net par action     : ' + (pos(R.vcpaDirect) ? N(R.vcpaDirect) + ' FCFA' : 'inapplicable'));
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

      var poidsOn = t.getAttribute && t.getAttribute('data-poids-on');
      if (poidsOn) {
        if (t.checked) {
          var restaure = S.poidsMemoire[poidsOn];
          var defaut = (V.poidsDefaut(S.analyse.data) || {})[poidsOn];
          S.poids[poidsOn] = fin(restaure) && restaure > 0 ? restaure : (fin(defaut) && defaut > 0 ? defaut : 0.10);
        } else {
          if (S.poids[poidsOn] > 0) S.poidsMemoire[poidsOn] = S.poids[poidsOn];
          S.poids[poidsOn] = 0;
        }
        store(LS.poids, S.poids);
        recompute(); render();
        return;
      }

      var exclu = t.getAttribute && t.getAttribute('data-afexclu');
      if (exclu) {
        var idx = S.comparablesExclus.indexOf(exclu);
        if (t.checked) { if (idx >= 0) S.comparablesExclus.splice(idx, 1); }
        else { if (idx < 0) S.comparablesExclus.push(exclu); }
        store(LS.exclus, S.comparablesExclus);
        refreshComparables();
        recompute();
        render();
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
      if ((v = t.getAttribute('data-afportee'))) {
        S.portee = v;
        store(LS.portee, v);
        refreshComparables();
        recompute();
        render();
        return;
      }
      if ((v = t.getAttribute('data-afstat'))) {
        S.comparablesStat = v;
        store(LS.stat, v);
        refreshComparables();
        recompute();
        render();
        return;
      }
      switch (t.id) {
        case 'afReset':
          S.hypotheses = V.hypothesesInitiales(S.analyse);
          try { localStorage.removeItem(LS.hyp + S.ticker); } catch (err) { }
          recompute(); render();
          notify('Hypothèses rétablies.', 'success');
          break;
        case 'afResetPoids':
          S.poids = V.poidsDefaut(S.analyse.data);
          store(LS.poids, S.poids);
          recompute(); render();
          notify('Poids rétablis.', 'success');
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
        case 'afReinitExclus':
          S.comparablesExclus = [];
          store(LS.exclus, S.comparablesExclus);
          refreshComparables();
          recompute(); render();
          notify('Tous les pairs sont de nouveau inclus.', 'success');
          break;
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
      S.comparablesStat = read(LS.stat, 'mediane');
      S.comparablesExclus = read(LS.exclus, []);
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
