/* ═══════════════════════════════════════════════════════════════════
   THE CAPITAL INSTITUTE
   outils.js : calculateurs.

   Sept outils, tous conçus selon le même principe : le résultat
   s'accompagne toujours d'une phrase qui dit comment le lire et de
   ce que le calcul ne prend pas en compte. Un chiffre sans mode
   d'emploi enseigne une fausse certitude.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  function n(v) { var x = Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : NaN; }
  function fin(v) { return typeof v === 'number' && isFinite(v); }
  function f0(v) { return fin(v) ? Math.round(v).toLocaleString('fr-FR') : '—'; }
  function f2(v, d) { return fin(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d }) : '—'; }
  function pc(v, d) { return fin(v) ? (v * 100).toFixed(d == null ? 1 : d) + ' %' : '—'; }

  global.TCI_OUTILS = [

    {
      id: 'position',
      titre: 'Dimensionnement de position',
      resume: 'Combien de titres acheter pour ne risquer qu\'une part définie de son capital.',
      memo: 'C\'est la décision la plus importante de toute opération, plus importante que le choix du titre.',
      champs: [
        { k: 'capital', l: 'Capital total', unite: 'FCFA', def: 5000000, pas: 100000 },
        { k: 'risque', l: 'Risque accepté par opération', unite: '%', def: 2, pas: 0.5 },
        { k: 'entree', l: 'Prix d\'entrée', unite: 'FCFA', def: 5000, pas: 50 },
        { k: 'stop', l: 'Niveau d\'invalidation', unite: 'FCFA', def: 4600, pas: 50 },
        { k: 'objectif', l: 'Objectif de cours', unite: 'FCFA', def: 6200, pas: 50 },
        { k: 'volume', l: 'Volume moyen quotidien du titre', unite: 'titres', def: 800, pas: 100 }
      ],
      calcule: function (v) {
        var capital = n(v.capital), risque = n(v.risque) / 100;
        var entree = n(v.entree), stop = n(v.stop), objectif = n(v.objectif), volume = n(v.volume);
        if (!fin(capital) || !fin(entree) || !fin(stop)) return { erreur: 'Capital, prix d\'entrée et invalidation sont nécessaires.' };
        if (entree === stop) return { erreur: 'Le prix d\'entrée et l\'invalidation ne peuvent pas être identiques.' };

        var risqueParTitre = Math.abs(entree - stop);
        var budget = capital * risque;
        var quantite = Math.floor(budget / risqueParTitre);
        var engage = quantite * entree;
        var partCapital = capital ? engage / capital : NaN;
        var rr = fin(objectif) ? Math.abs(objectif - entree) / risqueParTitre : NaN;

        /* Second plafond : la liquidité. C'est la contrainte la plus
           stricte des deux qui s'applique, toujours. */
        var plafondLiquidite = fin(volume) && volume > 0 ? Math.floor(volume * 3) : NaN;
        var limiteParLiquidite = fin(plafondLiquidite) && quantite > plafondLiquidite;
        var retenue = limiteParLiquidite ? plafondLiquidite : quantite;

        var lignes = [
          { l: 'Risque par titre', v: f0(risqueParTitre) + ' FCFA', s: 'écart entre l\'entrée et l\'invalidation' },
          { l: 'Perte maximale acceptée', v: f0(budget) + ' FCFA', s: pc(risque) + ' du capital' },
          { l: 'Quantité selon le risque', v: f0(quantite) + ' titres', s: '' },
          { l: 'Quantité retenue', v: f0(retenue) + ' titres', s: limiteParLiquidite ? 'plafonnée par la liquidité' : 'aucune contrainte de liquidité', fort: true },
          { l: 'Capital engagé', v: f0(retenue * entree) + ' FCFA', s: pc(capital ? retenue * entree / capital : NaN, 0) + ' du capital' }
        ];
        if (fin(rr)) lignes.push({ l: 'Rapport gain sur risque', v: f2(rr), s: rr >= 2 ? 'favorable' : rr >= 1 ? 'acceptable' : 'défavorable', ton: rr >= 2 ? 'bon' : rr >= 1 ? '' : 'mauvais' });

        var lecture = [];
        if (fin(rr) && rr < 1) lecture.push('L\'objectif rapporte moins que le risque encouru. Quel que soit votre taux de réussite, cette opération ne vaut pas la peine dans sa configuration actuelle.');
        else if (fin(rr) && rr >= 3) lecture.push('Avec un rapport de ' + f2(rr) + ', vous pouvez vous tromper deux fois sur trois et rester à l\'équilibre.');
        if (limiteParLiquidite) lecture.push('Le calcul de risque autorise ' + f0(quantite) + ' titres, mais la liquidité n\'en permet que ' + f0(plafondLiquidite) + ' — soit trois jours de volume moyen. C\'est cette limite qui s\'applique : une position qu\'on ne peut pas liquider n\'est pas correctement dimensionnée.');
        if (fin(partCapital) && partCapital > 0.15) lecture.push('Cette position représenterait ' + pc(partCapital, 0) + ' de votre capital. Au-delà de 10 à 15 %, une seule erreur pèse trop lourd, quelle que soit la conviction.');
        if (retenue < 1) lecture.push('Le risque autorisé ne permet pas d\'acheter un seul titre à ce niveau d\'invalidation. Rapprochez l\'invalidation ou augmentez le risque accepté — en connaissance de cause.');

        return {
          lignes: lignes,
          lecture: lecture,
          reserve: 'Le calcul suppose une sortie effective au niveau d\'invalidation. Sur un titre peu liquide, la sortie réelle peut être nettement plus basse. Les frais de courtage ne sont pas déduits.'
        };
      }
    },

    {
      id: 'composes',
      titre: 'Intérêts composés',
      resume: 'Ce que devient une somme placée, avec ou sans versements réguliers.',
      memo: 'La durée fait plus que le taux. C\'est la seule variable dont l\'effet est exponentiel.',
      champs: [
        { k: 'initial', l: 'Capital de départ', unite: 'FCFA', def: 1000000, pas: 100000 },
        { k: 'mensuel', l: 'Versement mensuel', unite: 'FCFA', def: 50000, pas: 10000 },
        { k: 'taux', l: 'Rendement annuel espéré', unite: '%', def: 8, pas: 0.5 },
        { k: 'annees', l: 'Durée', unite: 'ans', def: 15, pas: 1 },
        { k: 'inflation', l: 'Inflation annuelle', unite: '%', def: 2.5, pas: 0.5 }
      ],
      calcule: function (v) {
        var c0 = n(v.initial) || 0, m = n(v.mensuel) || 0;
        var t = n(v.taux) / 100, a = Math.round(n(v.annees)), inf = n(v.inflation) / 100;
        if (!fin(t) || !fin(a) || a < 1) return { erreur: 'Indiquez un taux et une durée d\'au moins un an.' };
        if (a > 60) return { erreur: 'Au-delà de soixante ans, la projection n\'a plus aucun sens pratique.' };

        var tm = Math.pow(1 + t, 1 / 12) - 1;
        var capital = c0, verse = c0, table = [];
        for (var an = 1; an <= a; an++) {
          for (var k = 0; k < 12; k++) { capital = capital * (1 + tm) + m; verse += m; }
          if (an <= 3 || an % 5 === 0 || an === a) {
            table.push({ annee: an, capital: capital, verse: verse, gains: capital - verse });
          }
        }
        var reel = fin(inf) ? capital / Math.pow(1 + inf, a) : NaN;
        var gains = capital - verse;

        return {
          lignes: [
            { l: 'Capital final', v: f0(capital) + ' FCFA', s: 'après ' + a + ' ans', fort: true },
            { l: 'Total versé', v: f0(verse) + ' FCFA', s: 'apport initial et versements' },
            { l: 'Gains cumulés', v: f0(gains) + ' FCFA', s: verse ? pc(gains / verse, 0) + ' de l\'argent versé' : '', ton: 'bon' },
            { l: 'Pouvoir d\'achat équivalent', v: f0(reel) + ' FCFA', s: 'en francs d\'aujourd\'hui, inflation à ' + pc(inf) }
          ],
          table: {
            entetes: ['Année', 'Capital', 'Versé', 'Gains'],
            lignes: table.map(function (r) { return [r.annee, f0(r.capital), f0(r.verse), f0(r.gains)]; })
          },
          lecture: [
            'Les gains représentent ' + (verse ? pc(gains / verse, 0) : '—') + ' des sommes versées. Cette proportion croît de façon exponentielle avec la durée : c\'est le seul mécanisme financier où le temps travaille seul.',
            fin(reel) ? 'En pouvoir d\'achat, le capital final équivaut à ' + f0(reel) + ' francs d\'aujourd\'hui. L\'inflation prélève silencieusement ' + f0(capital - reel) + ' francs sur le résultat nominal.' : ''
          ].filter(Boolean),
          reserve: 'Le calcul suppose un rendement constant, ce qui n\'existe pas. Un marché qui rapporte 8 % en moyenne le fait avec des années à +30 % et des années à −20 %. Les frais et la fiscalité ne sont pas déduits.'
        };
      }
    },

    {
      id: 'dividende',
      titre: 'Rendement et soutenabilité du dividende',
      resume: 'Évaluer un dividende au-delà de son rendement affiché.',
      memo: 'Un rendement anormalement élevé n\'est pas une aubaine mais un avertissement.',
      champs: [
        { k: 'cours', l: 'Cours de l\'action', unite: 'FCFA', def: 5600, pas: 50 },
        { k: 'dpa', l: 'Dividende par action', unite: 'FCFA', def: 420, pas: 10 },
        { k: 'bpa', l: 'Bénéfice par action', unite: 'FCFA', def: 700, pas: 10 },
        { k: 'fcfpa', l: 'Flux de trésorerie libre par action', unite: 'FCFA', def: 560, pas: 10 },
        { k: 'quantite', l: 'Nombre de titres détenus', unite: 'titres', def: 200, pas: 10 }
      ],
      calcule: function (v) {
        var cours = n(v.cours), dpa = n(v.dpa), bpa = n(v.bpa), fcf = n(v.fcfpa), q = n(v.quantite) || 0;
        if (!fin(cours) || cours <= 0 || !fin(dpa)) return { erreur: 'Le cours et le dividende par action sont nécessaires.' };

        var rendement = dpa / cours;
        var payout = fin(bpa) && bpa > 0 ? dpa / bpa : NaN;
        var payoutFcf = fin(fcf) && fcf > 0 ? dpa / fcf : NaN;
        var revenu = dpa * q;

        var ton = !fin(payout) ? '' : payout <= 0.5 ? 'bon' : payout <= 0.8 ? '' : 'mauvais';
        var lignes = [
          { l: 'Rendement', v: pc(rendement, 2), s: 'dividende rapporté au cours', fort: true },
          { l: 'Revenu annuel brut', v: f0(revenu) + ' FCFA', s: 'pour ' + f0(q) + ' titres' },
          { l: 'Taux de distribution', v: pc(payout, 0), s: 'part du bénéfice reversée', ton: ton },
          { l: 'Couverture par le flux libre', v: pc(payoutFcf, 0), s: 'part du flux libre reversée', ton: !fin(payoutFcf) ? '' : payoutFcf <= 0.8 ? 'bon' : 'mauvais' },
          { l: 'Capital nécessaire pour 1 M de revenu', v: fin(rendement) && rendement > 0 ? f0(1000000 / rendement) + ' FCFA' : '—', s: 'au rendement actuel' }
        ];

        var lecture = [];
        if (rendement > 0.12) lecture.push('Un rendement de ' + pc(rendement, 1) + ' est très supérieur à la moyenne du marché. Il grimpe soit parce que le dividende augmente, soit parce que le cours s\'effondre. Vérifiez lequel des deux avant toute décision.');
        if (fin(payout)) {
          if (payout > 1) lecture.push('Le dividende dépasse le bénéfice de l\'exercice : il est financé par la trésorerie accumulée ou par la dette. Cela peut se justifier une année, jamais trois.');
          else if (payout > 0.8) lecture.push('Avec ' + pc(payout, 0) + ' du bénéfice distribué, la marge de manœuvre est mince. Un exercice difficile suffirait à contraindre une coupe.');
          else if (payout < 0.5) lecture.push('Avec ' + pc(payout, 0) + ' du bénéfice distribué, la société conserve de quoi financer sa croissance. Le dividende est confortablement couvert.');
        }
        if (fin(payoutFcf) && payoutFcf > 1) lecture.push('Le dividende n\'est pas couvert par le flux de trésorerie libre : il est versé avec de l\'argent que l\'activité ne produit pas. C\'est le signal le plus fiable d\'une coupe à venir.');
        lecture.push('Un rendement de 5 % versé sans interruption depuis quinze ans vaut infiniment mieux qu\'un rendement de 12 % versé une seule fois. Cherchez l\'historique de versement avant de conclure.');

        return {
          lignes: lignes, lecture: lecture,
          reserve: 'Un dividende n\'est jamais garanti : il est décidé chaque année par l\'assemblée générale et peut être supprimé sans préavis. La fiscalité applicable n\'est pas déduite.'
        };
      }
    },

    {
      id: 'gordon',
      titre: 'Valorisation par les dividendes',
      resume: 'Estimer une action mature par ses dividendes futurs, et voir ce que le cours suppose.',
      memo: 'La vertu du modèle est de rendre explicite ce que le cours actuel suppose implicitement.',
      champs: [
        { k: 'dpa', l: 'Dividende de l\'année écoulée', unite: 'FCFA', def: 420, pas: 10 },
        { k: 'croissance', l: 'Croissance annuelle du dividende', unite: '%', def: 4, pas: 0.5 },
        { k: 'exige', l: 'Rendement exigé', unite: '%', def: 13, pas: 0.5 },
        { k: 'cours', l: 'Cours actuel', unite: 'FCFA', def: 5600, pas: 50 }
      ],
      calcule: function (v) {
        var d0 = n(v.dpa), g = n(v.croissance) / 100, r = n(v.exige) / 100, cours = n(v.cours);
        if (!fin(d0) || d0 <= 0) return { erreur: 'Le modèle est inapplicable sans dividende positif.' };
        if (!fin(r) || r <= 0) return { erreur: 'Le rendement exigé doit être strictement positif.' };
        if (g >= r) return { erreur: 'La croissance du dividende (' + pc(g) + ') atteint ou dépasse le rendement exigé (' + pc(r) + ') : la formule diverge vers l\'infini. Abaissez la croissance ou relevez le rendement exigé.' };

        var d1 = d0 * (1 + g);
        var valeur = d1 / (r - g);
        var potentiel = fin(cours) && cours > 0 ? valeur / cours - 1 : NaN;
        /* Croissance implicite : celle que le cours actuel suppose déjà. */
        var gImplicite = fin(cours) && cours > 0 ? (r * cours - d0) / (cours + d0) : NaN;

        var lecture = [];
        if (fin(potentiel)) {
          if (potentiel > 0.3) lecture.push('Avec ces hypothèses, le titre ressort ' + pc(potentiel, 0) + ' au-dessus de son cours. Avant de conclure, demandez-vous si un rendement exigé de ' + pc(r) + ' est réaliste sur ce titre : c\'est l\'hypothèse la plus contestable du calcul.');
          else if (potentiel < -0.2) lecture.push('Le titre ressort ' + pc(Math.abs(potentiel), 0) + ' en dessous de son cours. Soit le marché anticipe une croissance du dividende supérieure à ' + pc(g) + ', soit le titre est effectivement cher.');
        }
        if (fin(gImplicite)) lecture.push('Au cours actuel et avec un rendement exigé de ' + pc(r) + ', le marché suppose une croissance perpétuelle du dividende de ' + pc(gImplicite, 1) + '. C\'est la question à trancher : cette société peut-elle tenir ce rythme indéfiniment ?');

        return {
          lignes: [
            { l: 'Dividende de l\'an prochain', v: f0(d1) + ' FCFA', s: 'après croissance de ' + pc(g) },
            { l: 'Valeur estimée', v: f0(valeur) + ' FCFA', s: 'par le modèle de Gordon-Shapiro', fort: true },
            { l: 'Cours actuel', v: f0(cours) + ' FCFA', s: '' },
            { l: 'Écart', v: fin(potentiel) ? (potentiel > 0 ? '+' : '') + pc(potentiel, 0) : '—', s: 'potentiel théorique', ton: potentiel > 0 ? 'bon' : 'mauvais' },
            { l: 'Croissance implicite du cours', v: pc(gImplicite, 2), s: 'ce que le marché suppose déjà' }
          ],
          lecture: lecture,
          reserve: 'Le modèle suppose un dividende croissant indéfiniment à taux constant, ce qu\'aucune société ne fait réellement. Il ne convient qu\'aux sociétés matures et distributrices, et devient absurde dès que la croissance approche le rendement exigé.'
        };
      }
    },

    {
      id: 'per',
      titre: 'Multiples et valorisation relative',
      resume: 'Situer un titre par rapport à ses bénéfices, son actif net et ses pairs.',
      memo: 'Un multiple bas appelle une explication, jamais un ordre d\'achat.',
      champs: [
        { k: 'cours', l: 'Cours de l\'action', unite: 'FCFA', def: 5600, pas: 50 },
        { k: 'bpa', l: 'Bénéfice par action', unite: 'FCFA', def: 700, pas: 10 },
        { k: 'anpa', l: 'Actif net par action', unite: 'FCFA', def: 4200, pas: 50 },
        { k: 'croissance', l: 'Croissance attendue des bénéfices', unite: '%', def: 9, pas: 0.5 },
        { k: 'perSecteur', l: 'PER médian du secteur', unite: '×', def: 8, pas: 0.5 }
      ],
      calcule: function (v) {
        var cours = n(v.cours), bpa = n(v.bpa), anpa = n(v.anpa);
        var g = n(v.croissance), perRef = n(v.perSecteur);
        if (!fin(cours) || cours <= 0) return { erreur: 'Le cours est nécessaire.' };
        if (!fin(bpa) || bpa <= 0) return { erreur: 'Le PER n\'a aucun sens avec un bénéfice nul ou négatif. Utilisez un autre multiple pour cette société.' };

        var per = cours / bpa;
        var pbr = fin(anpa) && anpa > 0 ? cours / anpa : NaN;
        var peg = fin(g) && g > 0 ? per / g : NaN;
        var roe = fin(anpa) && anpa > 0 ? bpa / anpa : NaN;
        var graham = fin(anpa) && anpa > 0 ? Math.sqrt(22.5 * bpa * anpa) : NaN;
        var valeurSecteur = fin(perRef) && perRef > 0 ? perRef * bpa : NaN;
        var rendementBenefice = bpa / cours;

        var lecture = [];
        if (fin(peg)) {
          if (peg < 1) lecture.push('Avec un PEG de ' + f2(peg) + ', la croissance attendue n\'est pas entièrement payée par le cours actuel. C\'est la configuration recherchée — sous réserve que la croissance annoncée se réalise.');
          else if (peg > 2) lecture.push('Avec un PEG de ' + f2(peg) + ', la croissance est largement payée d\'avance. Le titre ne progressera que si la société dépasse les attentes.');
        }
        if (fin(pbr) && fin(roe)) {
          if (pbr < 1 && roe < 0.08) lecture.push('Un rapport cours sur actif net inférieur à 1 avec un ROE de seulement ' + pc(roe) + ' n\'est pas une occasion : un actif net faiblement rentable mérite d\'être décoté. La décote est justifiée.');
          else if (pbr < 1 && roe > 0.13) lecture.push('Un rapport cours sur actif net de ' + f2(pbr) + ' avec un ROE de ' + pc(roe) + ' est une configuration intéressante : le marché valorise moins que la valeur comptable un actif net pourtant bien rentable. Cherchez pourquoi.');
        }
        if (fin(valeurSecteur)) lecture.push('Au multiple médian du secteur, le titre vaudrait ' + f0(valeurSecteur) + ' FCFA, soit ' + pc(valeurSecteur / cours - 1, 0) + ' d\'écart avec son cours. Cet écart doit s\'expliquer par une différence de qualité, de croissance ou de risque — sinon il constitue une anomalie à examiner.');
        lecture.push('Le rendement des bénéfices, inverse du PER, ressort à ' + pc(rendementBenefice, 1) + '. Comparez-le au taux des obligations d\'État : c\'est ce que vous exigez en plus pour accepter le risque actions.');

        return {
          lignes: [
            { l: 'PER', v: f2(per) + ' ×', s: 'années de bénéfice actuel', fort: true },
            { l: 'Rendement des bénéfices', v: pc(rendementBenefice, 1), s: 'inverse du PER' },
            { l: 'Cours sur actif net', v: f2(pbr) + (fin(pbr) ? ' ×' : ''), s: '' },
            { l: 'ROE implicite', v: pc(roe), s: 'bénéfice rapporté à l\'actif net' },
            { l: 'PEG', v: f2(peg), s: 'PER rapporté à la croissance' },
            { l: 'Nombre de Graham', v: f0(graham) + ' FCFA', s: 'borne de valorisation prudente' },
            { l: 'Valeur au multiple sectoriel', v: f0(valeurSecteur) + ' FCFA', s: 'PER médian de ' + f2(perRef) + ' ×' }
          ],
          lecture: lecture,
          reserve: 'Les multiples ignorent totalement la dette : deux sociétés au même PER peuvent présenter des risques opposés. Le nombre de Graham a été conçu pour des industriels à forte assise d\'actifs et convient mal aux sociétés de services.'
        };
      }
    },

    {
      id: 'frais',
      titre: 'Impact des frais',
      resume: 'Ce que coûte l\'activité sur un portefeuille, année après année.',
      memo: 'La fréquence des opérations est le premier destructeur de performance individuelle.',
      champs: [
        { k: 'capital', l: 'Capital', unite: 'FCFA', def: 5000000, pas: 100000 },
        { k: 'operations', l: 'Allers-retours par an', unite: 'fois', def: 12, pas: 1 },
        { k: 'frais', l: 'Frais par aller-retour', unite: '%', def: 2, pas: 0.25 },
        { k: 'rendement', l: 'Rendement brut annuel', unite: '%', def: 9, pas: 0.5 },
        { k: 'annees', l: 'Durée', unite: 'ans', def: 10, pas: 1 }
      ],
      calcule: function (v) {
        var capital = n(v.capital), ops = n(v.operations), frais = n(v.frais) / 100;
        var brut = n(v.rendement) / 100, a = Math.round(n(v.annees));
        if (!fin(capital) || !fin(ops) || !fin(frais) || !fin(brut) || !fin(a) || a < 1)
          return { erreur: 'Tous les champs sont nécessaires, avec une durée d\'au moins un an.' };

        var coutAnnuel = ops * frais;
        var net = brut - coutAnnuel;
        var finalBrut = capital * Math.pow(1 + brut, a);
        var finalNet = capital * Math.pow(1 + Math.max(-0.99, net), a);
        var perdu = finalBrut - finalNet;

        var comparaisons = [1, 2, 4, 12, 24, 52].map(function (o) {
          var c = o * frais, nt = brut - c;
          return { ops: o, cout: c, net: nt, final: capital * Math.pow(1 + Math.max(-0.99, nt), a) };
        });

        var lecture = [];
        lecture.push('À raison de ' + f0(ops) + ' allers-retours par an à ' + pc(frais) + ' chacun, les frais consomment ' + pc(coutAnnuel) + ' par an, soit ' + (brut > 0 ? pc(coutAnnuel / brut, 0) : '—') + ' du rendement brut.');
        if (net <= 0) lecture.push('Le rendement net est négatif : à ce rythme d\'opérations, la stratégie perd de l\'argent quelle que soit la qualité des choix de titres. Ce n\'est pas un défaut d\'analyse, c\'est un excès d\'activité.');
        lecture.push('Sur ' + a + ' ans, l\'écart entre le résultat brut et le résultat net atteint ' + f0(perdu) + ' FCFA, soit ' + (capital ? pc(perdu / capital, 0) : '—') + ' du capital de départ.');

        return {
          lignes: [
            { l: 'Coût annuel des frais', v: pc(coutAnnuel), s: f0(capital * coutAnnuel) + ' FCFA la première année' },
            { l: 'Rendement net', v: pc(net), s: 'contre ' + pc(brut) + ' brut', ton: net > 0 ? '' : 'mauvais' },
            { l: 'Capital final sans frais', v: f0(finalBrut) + ' FCFA', s: 'après ' + a + ' ans' },
            { l: 'Capital final réel', v: f0(finalNet) + ' FCFA', s: 'frais déduits', fort: true },
            { l: 'Écart', v: f0(perdu) + ' FCFA', s: 'consommé par les frais', ton: 'mauvais' }
          ],
          table: {
            entetes: ['Allers-retours/an', 'Coût annuel', 'Rendement net', 'Capital après ' + a + ' ans'],
            lignes: comparaisons.map(function (c) { return [f0(c.ops), pc(c.cout), pc(c.net), f0(c.final)]; })
          },
          lecture: lecture,
          reserve: 'Le calcul suppose que chaque aller-retour porte sur la totalité du capital, ce qui majore l\'effet si vous n\'arbitrez qu\'une partie du portefeuille. L\'écart entre offre et demande, qui n\'apparaît sur aucun relevé, s\'ajoute à ces frais.'
        };
      }
    },

    {
      id: 'objectif',
      titre: 'Atteindre un objectif',
      resume: 'Combien épargner chaque mois pour atteindre une somme à une échéance donnée.',
      memo: 'Fixer l\'objectif avant de choisir les placements évite de prendre un risque inutile.',
      champs: [
        { k: 'objectif', l: 'Somme visée', unite: 'FCFA', def: 20000000, pas: 1000000 },
        { k: 'initial', l: 'Capital déjà disponible', unite: 'FCFA', def: 2000000, pas: 100000 },
        { k: 'annees', l: 'Échéance', unite: 'ans', def: 12, pas: 1 },
        { k: 'taux', l: 'Rendement annuel espéré', unite: '%', def: 8, pas: 0.5 }
      ],
      calcule: function (v) {
        var cible = n(v.objectif), c0 = n(v.initial) || 0;
        var a = Math.round(n(v.annees)), t = n(v.taux) / 100;
        if (!fin(cible) || cible <= 0 || !fin(a) || a < 1) return { erreur: 'Indiquez une somme visée et une échéance d\'au moins un an.' };

        var tm = Math.pow(1 + t, 1 / 12) - 1;
        var mois = a * 12;
        var valeurInitial = c0 * Math.pow(1 + tm, mois);
        var reste = cible - valeurInitial;
        var mensuel = reste <= 0 ? 0
          : (tm === 0 ? reste / mois : reste * tm / (Math.pow(1 + tm, mois) - 1));
        var totalVerse = c0 + mensuel * mois;

        var scenarios = [0.04, 0.06, 0.08, 0.10, 0.12].map(function (r) {
          var m = Math.pow(1 + r, 1 / 12) - 1;
          var vi = c0 * Math.pow(1 + m, mois);
          var res = cible - vi;
          return { taux: r, mensuel: res <= 0 ? 0 : res * m / (Math.pow(1 + m, mois) - 1) };
        });

        var lecture = [];
        if (reste <= 0) lecture.push('Votre capital actuel suffit à atteindre l\'objectif à l\'échéance, sans aucun versement supplémentaire.');
        else {
          lecture.push('Il faut verser ' + f0(mensuel) + ' FCFA par mois pendant ' + a + ' ans. Sur ce total, ' + f0(totalVerse) + ' FCFA sortent de votre poche et ' + f0(cible - totalVerse) + ' FCFA viennent du rendement.');
          lecture.push('Regardez le tableau des scénarios : entre un rendement de 4 % et de 12 %, l\'effort mensuel varie du simple au double environ. Choisir un rendement optimiste dans un tableur ne le rend pas plus probable — il ne fait que réduire l\'effort affiché.');
        }

        return {
          lignes: [
            { l: 'Versement mensuel nécessaire', v: f0(mensuel) + ' FCFA', s: 'pendant ' + a + ' ans', fort: true },
            { l: 'Apport initial à l\'échéance', v: f0(valeurInitial) + ' FCFA', s: 'capital actuel capitalisé' },
            { l: 'Total versé', v: f0(totalVerse) + ' FCFA', s: 'apport et versements cumulés' },
            { l: 'Part venant du rendement', v: f0(cible - totalVerse) + ' FCFA', s: cible ? pc((cible - totalVerse) / cible, 0) + ' de l\'objectif' : '', ton: 'bon' }
          ],
          table: {
            entetes: ['Rendement retenu', 'Versement mensuel'],
            lignes: scenarios.map(function (s) { return [pc(s.taux, 0), f0(s.mensuel) + ' FCFA']; })
          },
          lecture: lecture,
          reserve: 'Le calcul suppose un rendement régulier, ce qui n\'existe pas. Si l\'échéance est inférieure à cinq ans, les actions ne conviennent pas : le marché peut parfaitement être en baisse le jour où vous avez besoin de l\'argent.'
        };
      }
    }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
