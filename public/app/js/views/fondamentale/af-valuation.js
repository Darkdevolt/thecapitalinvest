/* ═══════════════════════════════════════════════════════════════════
   THE CAPITAL — ANALYSE FONDAMENTALE PRO
   af-valuation.js : moteur de valorisation.

   Cinq méthodes indépendantes, toutes paramétrables, aucune imposée :
   actualisation des flux, actualisation des dividendes, multiples de
   comparables, revenu résiduel et nombre de Graham.

   Deux règles gouvernent ce module.

   La première : aucune hypothèse n'est cachée. Chaque taux, chaque
   durée, chaque multiple utilisé est renvoyé avec le résultat, et
   l'interface les affiche. Une valorisation dont on ignore les
   hypothèses ne vaut rien.

   La seconde : le chiffre final compte moins que sa sensibilité. Une
   matrice de sensibilité accompagne systématiquement le DCF, parce
   que savoir qu'un point de taux d'actualisation déplace la valeur de
   trente pour cent est plus utile que la valeur elle-même.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.AFValuation) return;

  var C = global.AFCore;
  var fin = C.fin, pos = C.pos;

  /* ── Coût du capital ──────────────────────────────────────────── */

  /* Modèle d'équilibre des actifs financiers, augmenté d'une prime de
     taille et d'une prime d'illiquidité que l'utilisateur fixe. Sur un
     marché étroit, ignorer ces deux primes revient à surévaluer
     systématiquement les petites capitalisations. */
  function wacc(p) {
    var rf = fin(p.tauxSansRisque) ? p.tauxSansRisque : 0.06;
    var prime = fin(p.primeMarche) ? p.primeMarche : 0.075;
    var beta = fin(p.beta) ? p.beta : 1;
    var primeTaille = fin(p.primeTaille) ? p.primeTaille : 0;
    var primeLiquidite = fin(p.primeLiquidite) ? p.primeLiquidite : 0;

    var coutFondsPropres = rf + beta * prime + primeTaille + primeLiquidite;

    var coutDette = fin(p.coutDette) ? p.coutDette : rf + 0.025;
    var tauxIs = fin(p.tauxImpot) ? p.tauxImpot : 0.30;
    var coutDetteNet = coutDette * (1 - tauxIs);

    var cp = fin(p.capitauxPropres) ? p.capitauxPropres : NaN;
    var dette = fin(p.dette) ? p.dette : NaN;
    var total = fin(cp) && fin(dette) ? cp + dette : NaN;
    /* Des capitaux propres négatifs ou nuls rendent la pondération sans
       objet : la part de dette dépasserait 100 % et celle des fonds
       propres deviendrait négative, ce qui abaisserait mécaniquement le
       coût du capital d'une société précisément la plus fragile — le
       contraire de ce que la prime de risque est censée traduire. On se
       replie alors sur un coût des fonds propres pur, la mesure la plus
       prudente disponible. */
    var poidsCp = pos(cp) && pos(total) ? cp / total : 1;
    var poidsDette = pos(cp) && pos(total) ? dette / total : 0;

    return {
      valeur: coutFondsPropres * poidsCp + coutDetteNet * poidsDette,
      coutFondsPropres: coutFondsPropres,
      coutDette: coutDette,
      coutDetteNet: coutDetteNet,
      poidsCp: poidsCp, poidsDette: poidsDette,
      composants: [
        { l: 'Taux sans risque', v: rf, note: 'rendement des emprunts d\'État de la zone' },
        { l: 'Beta', v: beta, brut: true, note: 'sensibilité au marché, 1 = suit l\'indice' },
        { l: 'Prime de risque du marché', v: prime, note: 'surcroît de rendement exigé pour détenir des actions' },
        { l: 'Prime de taille', v: primeTaille, note: 'supplément exigé sur les petites capitalisations' },
        { l: 'Prime d\'illiquidité', v: primeLiquidite, note: 'supplément exigé quand la sortie est difficile' },
        { l: 'Coût de la dette avant impôt', v: coutDette, note: 'taux moyen des emprunts' },
        { l: 'Taux d\'impôt', v: tauxIs, note: 'la charge d\'intérêts étant déductible' }
      ],
      hypotheses: p
    };
  }

  /* ── Actualisation des flux de trésorerie ─────────────────────── */

  /* Croissance en deux phases : un rythme explicite sur l'horizon de
     prévision, qui converge linéairement vers le rythme perpétuel.
     Une rupture brutale entre les deux serait une invraisemblance
     économique que la matrice de sensibilité ne rattraperait pas. */
  function dcf(p) {
    var fcf0 = p.fcfDepart;
    var taux = p.taux;
    var n = Math.max(1, Math.min(15, Math.round(p.annees || 5)));
    var g1 = fin(p.croissance) ? p.croissance : 0.05;
    var gInf = fin(p.croissancePerpetuelle) ? p.croissancePerpetuelle : 0.02;
    var convergence = p.convergence !== false;

    var erreurs = [];
    if (!fin(fcf0)) erreurs.push('Le flux de départ n\'est pas déterminé : sans lui, aucune actualisation n\'est possible.');
    else if (fcf0 <= 0) erreurs.push('Le flux de départ est négatif ou nul. Un DCF construit sur un flux négatif produit une valeur négative sans signification : retenez un flux normatif, moyenne de plusieurs exercices, ou changez de méthode.');
    if (!fin(taux) || taux <= 0) erreurs.push('Le taux d\'actualisation doit être strictement positif.');
    if (fin(taux) && fin(gInf) && gInf >= taux) erreurs.push('La croissance perpétuelle (' + (gInf * 100).toFixed(1) + ' %) atteint ou dépasse le taux d\'actualisation (' + (taux * 100).toFixed(1) + ' %). La formule de la valeur terminale devient infinie ou négative : abaissez la croissance ou relevez le taux.');
    if (fin(gInf) && gInf > 0.06) erreurs.push('Une croissance perpétuelle de ' + (gInf * 100).toFixed(1) + ' % dépasse durablement la croissance de l\'économie. À l\'infini, la société finirait par représenter le produit intérieur brut entier.');
    if (erreurs.length) return { ok: false, erreurs: erreurs };

    var flux = [], vaFlux = [], cumul = 0, f = fcf0;
    for (var i = 1; i <= n; i++) {
      var g = convergence && n > 1 ? g1 + (gInf - g1) * ((i - 1) / (n - 1)) : g1;
      f = f * (1 + g);
      var va = f / Math.pow(1 + taux, i);
      flux.push({ annee: i, croissance: g, flux: f, actualise: va, facteur: 1 / Math.pow(1 + taux, i) });
      vaFlux.push(va);
      cumul += va;
    }

    var dernierFlux = flux[flux.length - 1].flux;
    var vt, methodeVt;
    if (p.methodeTerminale === 'multiple' && fin(p.multipleSortie) && fin(p.ebitdaTerminal)) {
      vt = p.ebitdaTerminal * p.multipleSortie;
      methodeVt = 'multiple de sortie de ' + p.multipleSortie.toFixed(1) + '× l\'excédent brut';
    } else {
      vt = dernierFlux * (1 + gInf) / (taux - gInf);
      methodeVt = 'croissance perpétuelle de ' + (gInf * 100).toFixed(1) + ' %';
    }
    var vaVt = vt / Math.pow(1 + taux, n);
    var valeurEntreprise = cumul + vaVt;
    var detteNette = fin(p.detteNette) ? p.detteNette : 0;
    var valeurFondsPropres = valeurEntreprise - detteNette;
    var actions = p.actions;
    var parAction = pos(actions) ? valeurFondsPropres / actions : NaN;
    var partVt = valeurEntreprise !== 0 ? vaVt / valeurEntreprise : NaN;

    var reserves = [];
    if (fin(partVt) && partVt > 0.85) reserves.push('La valeur terminale représente ' + (partVt * 100).toFixed(0) + ' % du total. Au-delà de 85 %, la valorisation ne repose plus sur les prévisions mais sur une hypothèse d\'éternité : le DCF n\'apporte alors presque rien de plus qu\'un multiple.');
    else if (fin(partVt) && partVt > 0.75) reserves.push('La valeur terminale pèse ' + (partVt * 100).toFixed(0) + ' % du total, ce qui est courant mais rappelle que l\'essentiel du résultat tient à une hypothèse au-delà de l\'horizon prévisible.');
    if (valeurFondsPropres < 0) reserves.push('La dette nette dépasse la valeur d\'entreprise calculée : les fonds propres ressortent à une valeur négative, ce qui traduit soit un endettement critique, soit des hypothèses trop pessimistes.');

    return {
      ok: true,
      flux: flux,
      sommeActualisee: cumul,
      valeurTerminale: vt,
      valeurTerminaleActualisee: vaVt,
      methodeTerminale: methodeVt,
      partTerminale: partVt,
      valeurEntreprise: valeurEntreprise,
      detteNette: detteNette,
      valeurFondsPropres: valeurFondsPropres,
      parAction: parAction,
      reserves: reserves,
      hypotheses: {
        fcfDepart: fcf0, taux: taux, annees: n,
        croissance: g1, croissancePerpetuelle: gInf,
        convergence: convergence, detteNette: detteNette, actions: actions
      }
    };
  }

  /* ── Matrice de sensibilité ───────────────────────────────────── */

  /* Le tableau que tout analyste regarde en premier. Deux axes, le taux
     d'actualisation et la croissance perpétuelle, parce que ce sont les
     deux hypothèses qui ne s'observent pas et qui décident de tout. */
  function sensibilite(base, opts) {
    opts = opts || {};
    var pasT = fin(opts.pasTaux) ? opts.pasTaux : 0.01;
    var pasG = fin(opts.pasCroissance) ? opts.pasCroissance : 0.005;
    var n = opts.taille || 5;
    var demi = Math.floor(n / 2);
    var taux = [], gs = [];
    for (var i = -demi; i <= demi; i++) {
      taux.push(base.taux + i * pasT);
      gs.push(base.croissancePerpetuelle + i * pasG);
    }
    var grille = taux.map(function (t) {
      return gs.map(function (g) {
        if (g >= t) return { valeur: NaN, invalide: true };
        var r = dcf(Object.assign({}, base, { taux: t, croissancePerpetuelle: g }));
        return { valeur: r.ok ? r.parAction : NaN, invalide: !r.ok };
      });
    });
    var valeurs = [];
    grille.forEach(function (l) { l.forEach(function (c2) { if (fin(c2.valeur)) valeurs.push(c2.valeur); }); });
    return {
      taux: taux, croissances: gs, grille: grille,
      min: valeurs.length ? Math.min.apply(null, valeurs) : NaN,
      max: valeurs.length ? Math.max.apply(null, valeurs) : NaN,
      etendue: valeurs.length ? Math.max.apply(null, valeurs) / Math.min.apply(null, valeurs) - 1 : NaN
    };
  }

  /* ── DCF inversé ──────────────────────────────────────────────── */

  /* Au lieu de produire une valeur, on cherche la croissance que le
     cours actuel suppose déjà. C'est souvent l'exercice le plus
     éclairant : il transforme une question d'évaluation en une question
     industrielle, celle société peut-elle tenir ce rythme ? */
  function dcfInverse(base, cours) {
    if (!pos(cours) || !pos(base.actions)) return { ok: false, raison: 'cours ou nombre d\'actions indisponible' };
    var cible = cours * base.actions + (fin(base.detteNette) ? base.detteNette : 0);
    var BAS0 = -0.30, HAUT0 = 0.60;
    var bas = BAS0, haut = HAUT0, mid = 0, valeur = NaN, convergeance = false;
    for (var i = 0; i < 80; i++) {
      mid = (bas + haut) / 2;
      var r = dcf(Object.assign({}, base, { croissance: mid }));
      if (!r.ok) { haut = mid; continue; }
      valeur = r.valeurEntreprise;
      if (valeur > cible) haut = mid; else bas = mid;
      if (Math.abs(valeur - cible) / cible < 0.0005) { convergeance = true; break; }
    }
    if (!fin(valeur)) return { ok: false, raison: 'la recherche n\'a pas convergé avec ces hypothèses' };
    /* Une recherche qui s'arrête sur le bord de l'intervalle exploré
       (−30 % / +60 %) sans avoir atteint la tolérance ne mesure pas une
       croissance implicite : elle dit seulement que le cours actuel
       exige plus que ce que l'intervalle permet de représenter. Afficher
       ce nombre sans le distinguer d'un résultat convergé donnerait une
       fausse précision. */
    var enButee = !convergeance && (mid <= BAS0 + 0.005 || mid >= HAUT0 - 0.005);
    var histo = fin(base.croissanceHistorique) ? base.croissanceHistorique : NaN;
    return {
      ok: true,
      croissanceImplicite: mid,
      convergeance: convergeance,
      enButee: enButee,
      croissanceHistorique: histo,
      ecart: fin(histo) ? mid - histo : NaN,
      lecture: enButee
        ? (mid >= 0 ? 'Le cours actuel exige une croissance supérieure à ' + (HAUT0 * 100).toFixed(0) + ' % par an sur tout l\'horizon pour être justifié par les flux : la recherche a buté sur cette borne sans converger, le chiffre affiché n\'est qu\'un plancher.' : 'Même une contraction de ' + (BAS0 * 100).toFixed(0) + ' % par an ne suffit pas à ramener la valeur au niveau du cours : la recherche a buté sur cette borne sans converger.')
        : !fin(histo)
        ? 'Aucune croissance historique comparable n\'est disponible.'
        : mid > histo + 0.04
          ? 'Le cours suppose une croissance nettement supérieure à celle réalisée jusqu\'ici. Le marché anticipe une accélération qu\'il reste à justifier.'
          : mid < histo - 0.04
            ? 'Le cours suppose une croissance inférieure à celle réalisée jusqu\'ici. Soit le marché doute de la poursuite du rythme, soit le titre est délaissé.'
            : 'Le cours suppose à peu près la croissance déjà réalisée : la valorisation prolonge le passé sans pari particulier.',
      hypotheses: base
    };
  }

  /* ── Actualisation des dividendes ─────────────────────────────── */

  function ddm(p) {
    var d0 = p.dividende;
    var r = p.rendementExige;
    var g = fin(p.croissance) ? p.croissance : 0.03;
    var erreurs = [];
    if (!pos(d0)) erreurs.push('Aucun dividende n\'a été identifié sur le dernier exercice : la méthode est inapplicable.');
    if (!fin(r) || r <= 0) erreurs.push('Le rendement exigé doit être strictement positif.');
    if (fin(r) && g >= r) erreurs.push('La croissance du dividende (' + (g * 100).toFixed(1) + ' %) atteint ou dépasse le rendement exigé (' + (fin(r) ? (r * 100).toFixed(1) : '—') + ' %) : la formule diverge.');
    if (erreurs.length) return { ok: false, erreurs: erreurs };

    var valeur = d0 * (1 + g) / (r - g);
    var out = {
      ok: true, methode: 'Gordon-Shapiro',
      valeur: valeur, dividende: d0, croissance: g, rendementExige: r,
      dividendeProchain: d0 * (1 + g),
      rendementImplicite: pos(p.cours) ? d0 * (1 + g) / p.cours + 0 : NaN
    };

    /* Variante à deux phases, si l'utilisateur fournit une croissance
       forte de départ et sa durée. */
    if (fin(p.croissanceForte) && fin(p.anneesForte) && p.anneesForte > 0) {
      var gf = p.croissanceForte, nf = Math.min(20, Math.round(p.anneesForte));
      if (gf >= r) {
        out.deuxPhases = { ok: false, raison: 'la croissance forte dépasse le rendement exigé sur la première phase' };
      } else {
        var somme = 0, d = d0, detail = [];
        for (var i = 1; i <= nf; i++) {
          d = d * (1 + gf);
          var va = d / Math.pow(1 + r, i);
          somme += va;
          detail.push({ annee: i, dividende: d, actualise: va });
        }
        var terminal = d * (1 + g) / (r - g);
        var vaTerm = terminal / Math.pow(1 + r, nf);
        out.deuxPhases = {
          ok: true, valeur: somme + vaTerm,
          phase1: somme, phase2Actualisee: vaTerm, detail: detail,
          partPhase2: (somme + vaTerm) ? vaTerm / (somme + vaTerm) : NaN,
          croissanceForte: gf, annees: nf
        };
      }
    }
    return out;
  }

  /* ── Valorisation par les multiples ───────────────────────────── */

  /* On ne retient un multiple que si le dénominateur est positif :
     appliquer un PER à une société en perte n'a aucun sens, et le faire
     silencieusement produit des valorisations absurdes. */
  function multiples(p) {
    var lignes = [];
    function ajoute(cle, libelle, multiple, base, parAction, note) {
      var utilisable = fin(multiple) && multiple > 0 && fin(base) && base > 0;
      lignes.push({
        cle: cle, libelle: libelle, multiple: multiple, base: base,
        valeur: utilisable ? parAction : NaN,
        utilisable: utilisable,
        note: note || (utilisable ? '' : 'base négative ou multiple de référence indisponible')
      });
    }
    var act = p.actions;
    var dn = fin(p.detteNette) ? p.detteNette : 0;

    ajoute('per', 'Cours sur bénéfice', p.perRef, p.bpa, fin(p.perRef) && fin(p.bpa) ? p.perRef * p.bpa : NaN,
      'applique le multiple de référence au bénéfice par action');
    ajoute('pbr', 'Cours sur actif net', p.pbrRef, p.anpa, fin(p.pbrRef) && fin(p.anpa) ? p.pbrRef * p.anpa : NaN,
      'applique le multiple de référence à l\'actif net par action');
    ajoute('psr', 'Cours sur chiffre d\'affaires', p.psrRef, p.capa, fin(p.psrRef) && fin(p.capa) ? p.psrRef * p.capa : NaN,
      'applique le multiple de référence au chiffre d\'affaires par action');
    ajoute('evEbitda', 'Valeur d\'entreprise sur excédent brut', p.evEbitdaRef, p.rbe,
      fin(p.evEbitdaRef) && fin(p.rbe) && pos(act) ? (p.evEbitdaRef * p.rbe - dn) / act : NaN,
      'valorise l\'entreprise entière puis retranche la dette nette');
    ajoute('pfcf', 'Cours sur flux de trésorerie libre', p.pfcfRef, p.fcfpa,
      fin(p.pfcfRef) && fin(p.fcfpa) ? p.pfcfRef * p.fcfpa : NaN,
      'applique le multiple de référence au flux libre par action');

    var valides = lignes.filter(function (l) { return l.utilisable && fin(l.valeur) && l.valeur > 0; });
    return {
      lignes: lignes,
      retenues: valides.length,
      mediane: valides.length ? C.median(valides.map(function (l) { return l.valeur; })) : NaN,
      moyenne: valides.length ? C.mean(valides.map(function (l) { return l.valeur; })) : NaN,
      min: valides.length ? Math.min.apply(null, valides.map(function (l) { return l.valeur; })) : NaN,
      max: valides.length ? Math.max.apply(null, valides.map(function (l) { return l.valeur; })) : NaN,
      source: p.sourceMultiples || 'médianes des comparables'
    };
  }

  /* ── Revenu résiduel ──────────────────────────────────────────── */

  /* La valeur comptable augmentée des sur-profits futurs actualisés.
     Utile quand les flux de trésorerie sont erratiques mais que les
     capitaux propres sont fiables, ce qui est fréquent dans la banque.

     Deux hypothèses implicites corrigées : la croissance qui alimente le
     bénéfice pendant l'horizon explicite N'EST PAS celle qu'on peut
     supposer à l'infini dans la valeur terminale (même logique que le
     DCF, qui fait converger sa croissance vers un rythme perpétuel
     plafonné plutôt que de prolonger le taux observé indéfiniment — une
     société qui grossit de 10 %/an pour toujours finirait par peser le
     PIB mondial). Et la part du bénéfice réinvestie chaque année suit le
     taux de distribution connu de la société plutôt qu'une mise en
     réserve à 100 % non dite : sans dividende de référence, le modèle
     supposait silencieusement qu'aucun bénéfice n'était jamais distribué,
     ce qui gonfle la trajectoire des capitaux propres et fausse le calcul
     pour toute société qui verse — même partiellement — un dividende. */
  function revenuResiduel(p) {
    var anpa = p.anpa, bpa = p.bpa, r = p.rendementExige;
    var g1 = fin(p.croissance) ? p.croissance : 0.02;
    var gInf = fin(p.croissancePerpetuelle) ? p.croissancePerpetuelle : Math.min(g1, 0.02);
    var n = Math.max(1, Math.min(15, Math.round(p.annees || 5)));
    if (!pos(anpa) || !fin(bpa) || !fin(r) || r <= 0)
      return { ok: false, raison: 'actif net par action, bénéfice par action et rendement exigé sont tous requis' };
    if (gInf >= r) return { ok: false, raison: 'la croissance perpétuelle dépasse le rendement exigé' };
    if (gInf > 0.06) return { ok: false, raison: 'une croissance perpétuelle au-delà de 6 % par an n\'est pas soutenable à l\'infini' };

    /* Taux de distribution appliqué à chaque exercice projeté : celui
       fourni explicitement, sinon celui qu'impliquent le dividende et le
       bénéfice de référence, sinon aucune distribution supposée (le cas
       le plus défavorable, jamais un chiffre inventé). */
    var payout = fin(p.payoutRef) ? p.payoutRef
      : (fin(p.dpa) && pos(bpa) ? Math.max(0, p.dpa / bpa) : 0);

    /* e démarre au bénéfice constaté (année 0) et est mis à croître avant
       chaque usage, comme fcf0 dans le DCF : sans cela, l'année 1 du
       modèle utilisait le bénéfice déjà publié sans lui appliquer la
       croissance retenue, une année de croissance disparaissait par
       rapport au DCF construit sur les mêmes hypothèses. */
    var vc = anpa, somme = 0, detail = [];
    var e = bpa;
    for (var i = 1; i <= n; i++) {
      var g = n > 1 ? g1 + (gInf - g1) * ((i - 1) / (n - 1)) : g1;
      e = e * (1 + g);
      var rr = e - r * vc;
      var va = rr / Math.pow(1 + r, i);
      somme += va;
      detail.push({ annee: i, croissance: g, valeurComptable: vc, benefice: e, revenuResiduel: rr, actualise: va });
      vc = vc + e * (1 - payout);
    }
    var dernierRr = detail[detail.length - 1].revenuResiduel;
    var terminal = dernierRr * (1 + gInf) / (r - gInf) / Math.pow(1 + r, n);
    return {
      ok: true,
      valeur: anpa + somme + terminal,
      valeurComptable: anpa,
      surProfitsActualises: somme,
      terminalActualise: terminal,
      payoutRetenu: payout,
      croissancePerpetuelle: gInf,
      detail: detail,
      lecture: anpa ? 'La valeur ressort à ' + ((anpa + somme + terminal) / anpa).toFixed(2) + ' fois l\'actif net comptable.' : ''
    };
  }

  /* ── Nombre de Graham ─────────────────────────────────────────── */

  function graham(bpa, anpa, facteur) {
    var f = fin(facteur) ? facteur : 22.5;
    if (!pos(bpa) || !pos(anpa))
      return { ok: false, raison: 'bénéfice par action et actif net par action doivent être positifs' };
    return {
      ok: true,
      valeur: Math.sqrt(f * bpa * anpa),
      facteur: f,
      note: 'Le facteur ' + f + ' correspond aux limites que Graham s\'imposait : un PER de ' +
        (f === 22.5 ? '15' : (f / 1.5).toFixed(1)) + ' et un rapport cours sur actif net de 1,5.'
    };
  }

  /* ── Synthèse pondérée ────────────────────────────────────────── */

  /* Les méthodes ne se valent pas selon les sociétés. Les poids par
     défaut reflètent une pratique courante, mais restent modifiables :
     sur une banque on relèvera le revenu résiduel, sur une société de
     croissance le DCF, sur une valeur de rendement l'actualisation des
     dividendes.

     Pondération fine, méthode par méthode plutôt que par famille : les
     cinq multiples de comparables (PER, PBR, PSR, VE/EBE, cours sur flux
     libre) étaient jusqu'ici fondus dans une seule case « Multiples »,
     réduite en interne à leur médiane — impossible d'y faire porter
     davantage de poids sur, par exemple, le PER que sur le PSR. Chaque
     multiple est désormais une méthode à part entière, avec son propre
     poids, exactement comme le DCF ou Graham. La somme des neuf poids
     n'a pas besoin de faire 100 % : synthese() ne considère que les
     méthodes exploitables (valeur calculable, poids non nul) et
     renormalise sur elles seules. */
  var POIDS_DEFAUT = {
    dcf: 0.35, ddm: 0.20, dyMarche: 0.02,
    per: 0.15, pbr: 0.06, psr: 0.04, evEbitda: 0.02, pfcf: 0.01,
    vcpa: 0.04, residuel: 0.08, graham: 0.03
  };

  /* Pour une banque ou une assurance, le DCF classique n'a pas de sens :
     le flux de trésorerie disponible (CFO − capex) ne représente rien
     d'économique pour un établissement dont le métier est de transformer
     des dépôts en crédits, et dont le « capex » publié est anecdotique au
     regard de ce qui consomme réellement ses fonds propres (le risque de
     crédit, la réglementation prudentielle). La pratique de place — et le
     commentaire ci-dessus, déjà présent dans ce fichier — pointe vers le
     revenu résiduel (fondé sur les capitaux propres et leur rentabilité)
     et l'actualisation des dividendes comme méthodes de référence pour
     les établissements financiers. Ce n'est qu'un point de départ :
     l'utilisateur reste libre de tout repondérer. */
  var POIDS_DEFAUT_FINANCIER = {
    dcf: 0.10, ddm: 0.20, dyMarche: 0.05,
    per: 0.10, pbr: 0.08, psr: 0.01, evEbitda: 0.01, pfcf: 0.00,
    vcpa: 0.15, residuel: 0.25, graham: 0.05
  };

  /* Source unique : af-core.js (partagée avec le score de qualité, qui a
     besoin de la même détection pour adapter le pilier « Solidité
     financière » aux banques et assureurs). */
  var estFinancier = C.estFinancier;

  function poidsDefaut(data) {
    var secteur = (data && (data.secteur || data.sousSecteur)) || '';
    return Object.assign({}, estFinancier(secteur) ? POIDS_DEFAUT_FINANCIER : POIDS_DEFAUT);
  }

  function synthese(valeurs, poids, cours) {
    var p = Object.assign({}, POIDS_DEFAUT, poids || {});
    var lignes = [];
    Object.keys(p).forEach(function (k) {
      var v = valeurs[k];
      lignes.push({
        cle: k, valeur: fin(v) && v > 0 ? v : NaN,
        poids: p[k], retenue: fin(v) && v > 0 && p[k] > 0
      });
    });
    var retenues = lignes.filter(function (l) { return l.retenue; });
    var sommePoids = retenues.reduce(function (s, l) { return s + l.poids; }, 0);
    /* Les poids sont renormalisés sur les seules méthodes exploitables,
       sinon écarter une méthode reviendrait à valoriser à zéro. */
    retenues.forEach(function (l) { l.poidsEffectif = sommePoids ? l.poids / sommePoids : 0; });
    var valeur = retenues.reduce(function (s, l) { return s + l.valeur * l.poidsEffectif; }, 0);

    var vals = retenues.map(function (l) { return l.valeur; });
    var dispersion = vals.length > 1 ? (Math.max.apply(null, vals) / Math.min.apply(null, vals) - 1) : NaN;

    return {
      lignes: lignes,
      retenues: retenues.length,
      valeur: retenues.length ? valeur : NaN,
      fourchette: vals.length ? { bas: Math.min.apply(null, vals), haut: Math.max.apply(null, vals) } : null,
      dispersion: dispersion,
      cours: cours,
      potentiel: pos(cours) && retenues.length ? valeur / cours - 1 : NaN,
      margeSecurite: retenues.length && valeur > 0 && pos(cours) ? (valeur - cours) / valeur : NaN,
      avertissement: fin(dispersion) && dispersion > 1.5
        ? 'Les méthodes retenues aboutissent à des valeurs qui vont du simple au ' + (1 + dispersion).toFixed(1) + '. Une telle dispersion signifie que la valeur de cette société dépend massivement de la méthode choisie : la moyenne pondérée n\'a alors qu\'une valeur indicative, et il vaut mieux raisonner en fourchette.'
        : null
    };
  }

  /* ── Scénarios ────────────────────────────────────────────────── */

  /* Trois jeux d'hypothèses plutôt qu'un seul chiffre. Un investisseur
     décide en fonction de ce qu'il perd dans le mauvais cas, pas de ce
     qu'il gagne dans le bon. */
  function scenarios(base, cours) {
    var defs = [
      { cle: 'pessimiste', nom: 'Défavorable', dg: -0.04, dt: 0.02, dgi: -0.005, note: 'croissance amputée de quatre points, taux d\'actualisation relevé de deux points' },
      { cle: 'central', nom: 'Central', dg: 0, dt: 0, dgi: 0, note: 'hypothèses retenues telles quelles' },
      { cle: 'optimiste', nom: 'Favorable', dg: 0.04, dt: -0.01, dgi: 0.005, note: 'croissance majorée de quatre points, taux d\'actualisation abaissé d\'un point' }
    ];
    return defs.map(function (s) {
      var h = Object.assign({}, base, {
        croissance: base.croissance + s.dg,
        taux: base.taux + s.dt,
        croissancePerpetuelle: Math.max(0, base.croissancePerpetuelle + s.dgi)
      });
      var r = dcf(h);
      return {
        cle: s.cle, nom: s.nom, note: s.note,
        ok: r.ok,
        valeur: r.ok ? r.parAction : NaN,
        potentiel: r.ok && pos(cours) ? r.parAction / cours - 1 : NaN,
        hypotheses: h,
        erreurs: r.erreurs || []
      };
    });
  }

  /* ── Hypothèses de départ déduites de l'historique ────────────── */

  /* Le point de départ le plus honnête n'est pas un chiffre rond mais
     ce que la société a réellement fait. L'utilisateur reste libre de
     tout modifier, mais il part d'un socle observé. */
  function hypothesesInitiales(a) {
    var d = a.dernier, ex = a.dernierExercice, croiss = a.croissances;
    var fcfs = a.rows.map(function (r) { return r.fcf; }).filter(fin);
    /* Flux normatif : moyenne des trois derniers exercices, pour éviter
       qu'un exercice d'investissement exceptionnel ne fausse tout. */
    var fcfNormatif = fcfs.length >= 3 ? C.mean(fcfs.slice(-3)) : (fcfs.length ? fcfs[fcfs.length - 1] : NaN);

    var g = fin(croiss.ca.value) ? croiss.ca.value : (fin(croiss.rn.value) ? croiss.rn.value : 0.04);
    g = Math.max(-0.10, Math.min(0.25, g));

    var beta = 1;
    var primeLiquidite = 0.02;
    var primeTaille = fin(a.data.marketCap) && a.data.marketCap < 50e9 ? 0.02 : 0;

    return {
      fcfDepart: fin(fcfNormatif) && fcfNormatif > 0 ? fcfNormatif : (fin(ex.fcf) ? ex.fcf : NaN),
      fcfDernier: ex.fcf,
      fcfNormatif: fcfNormatif,
      croissance: g,
      croissancePerpetuelle: 0.02,
      annees: 5,
      tauxSansRisque: 0.06,
      primeMarche: 0.075,
      beta: beta,
      primeTaille: primeTaille,
      primeLiquidite: primeLiquidite,
      coutDette: 0.085,
      tauxImpot: 0.30,
      capitauxPropres: ex.cp,
      dette: ex.dette,
      detteNette: fin(d.detteNette) ? d.detteNette : 0,
      actions: a.data.shares,
      dividende: ex.dpa,
      bpa: ex.bpa,
      anpa: d.anpa,
      capa: d.capa,
      fcfpa: d.fcfpa,
      rbe: ex.rbe,
      dpa: ex.dpa,
      croissanceHistorique: fin(croiss.ca.value) ? croiss.ca.value : NaN,
      croissanceDividende: fin(croiss.dpa.value) ? Math.max(0, Math.min(0.12, croiss.dpa.value)) : 0.03
    };
  }

  global.AFValuation = {
    wacc: wacc,
    dcf: dcf,
    sensibilite: sensibilite,
    dcfInverse: dcfInverse,
    ddm: ddm,
    multiples: multiples,
    revenuResiduel: revenuResiduel,
    graham: graham,
    synthese: synthese,
    scenarios: scenarios,
    hypothesesInitiales: hypothesesInitiales,
    POIDS_DEFAUT: POIDS_DEFAUT,
    POIDS_DEFAUT_FINANCIER: POIDS_DEFAUT_FINANCIER,
    estFinancier: estFinancier,
    poidsDefaut: poidsDefaut
  };
})(typeof window !== 'undefined' ? window : globalThis);
