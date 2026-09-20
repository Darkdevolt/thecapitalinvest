/* ═══════════════════════════════════════════════════════════════════
   THE CAPITAL — MÉMOS CONTEXTUELS
   memo-data.js : base de connaissances.

   Chaque entrée répond aux quatre questions qu'on se pose devant un
   chiffre qu'on ne maîtrise pas encore : ce que c'est, comment il se
   calcule, comment le lire, et ce qu'il ne dit pas.

   La rubrique « brvm » n'est présente que lorsque le marché régional
   change réellement la lecture de l'indicateur. Elle n'est pas là pour
   faire couleur locale : sur une place où un titre peut ne pas coter
   pendant plusieurs séances, beaucoup de règles importées telles
   quelles deviennent trompeuses, et il faut le dire.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.TCMemoData) return;

  var M = {

    /* ─────────────────────────────────────────────────────────────
       ANALYSE TECHNIQUE — TENDANCE
       ───────────────────────────────────────────────────────────── */

    'ma': {
      titre: 'Moyenne mobile',
      quoi: 'La moyenne des cours sur les N dernières séances, recalculée à chaque séance. Elle efface le bruit quotidien pour ne garder que la direction de fond.',
      formule: 'Simple : somme des N clôtures ÷ N. Exponentielle : chaque nouvelle clôture pèse 2/(N+1), le reste du poids revenant à la moyenne précédente, ce qui la rend plus réactive.',
      lecture: 'La pente donne la direction. La position du cours par rapport à la moyenne donne le rapport de force. Le croisement de deux moyennes de longueurs différentes signale un changement de régime : la courte passant au-dessus de la longue est le « croisement doré », l\'inverse le « croisement de la mort ».',
      limites: 'Une moyenne mobile regarde en arrière par construction. Elle confirme une tendance, elle ne l\'anticipe jamais. En marché sans direction, les croisements se multiplient et se contredisent : c\'est là qu\'elle coûte le plus cher.',
      brvm: 'Sur des titres qui ne cotent pas tous les jours, une moyenne à 20 séances peut couvrir six semaines calendaires. Vérifiez toujours la période réellement couverte avant d\'y lire un signal de court terme.'
    },
    'supertrend': {
      titre: 'SuperTrend',
      quoi: 'Une ligne qui suit le cours à une distance proportionnelle à sa volatilité, et qui bascule d\'un côté à l\'autre quand la tendance se retourne.',
      formule: 'Médiane de la séance ± (multiple × ATR). La ligne retenue est la borne basse en tendance haussière, la borne haute en tendance baissière. Elle ne recule jamais tant que la tendance tient.',
      lecture: 'Tant que la ligne reste sous le cours, la tendance est haussière et la ligne fournit un stop suiveur objectif. Le basculement de la ligne est le signal de sortie.',
      limites: 'Excellent en tendance établie, désastreux en marché latéral où il bascule sans cesse. Le réglage du multiple change tout : plus il est faible, plus les signaux sont nombreux et faux.'
    },
    'adx': {
      titre: 'ADX et DMI',
      quoi: 'L\'ADX mesure la force d\'une tendance sans en indiquer le sens. Les lignes +DI et −DI donnent le sens.',
      formule: 'Les mouvements directionnels haussiers et baissiers sont lissés sur N séances puis rapportés à l\'ATR pour donner +DI et −DI. L\'ADX est la moyenne lissée de leur écart relatif.',
      lecture: 'Sous 20, il n\'y a pas de tendance exploitable : les stratégies de suivi de tendance y perdent de l\'argent. Entre 25 et 40, la tendance est établie. Au-delà de 40, elle est mûre, donc à la fois puissante et proche de son essoufflement. Le sens vient de la position de +DI face à −DI.',
      limites: 'L\'ADX monte aussi bien dans une chute que dans une hausse : lu seul, il ne dit rien de la direction. Il réagit lentement, par construction.'
    },
    'ichimoku': {
      titre: 'Ichimoku Kinkō Hyō',
      quoi: 'Un système complet japonais qui donne d\'un coup d\'œil la tendance, les supports à venir et la confirmation, sans indicateur complémentaire.',
      formule: 'Tenkan : médiane des 9 dernières séances. Kijun : médiane des 26. Le nuage est délimité par la moyenne Tenkan-Kijun et la médiane des 52 séances, projetées 26 séances en avant. Chikou est le cours décalé 26 séances en arrière.',
      lecture: 'Cours au-dessus du nuage : tendance haussière, le nuage devenant le support futur. L\'épaisseur du nuage mesure la solidité de ce support. Le croisement Tenkan/Kijun donne le signal de timing, la position de Chikou par rapport aux cours passés le confirme.',
      limites: 'Ses réglages viennent de la semaine de six jours de la bourse de Tokyo des années trente. Rien ne garantit qu\'ils soient optimaux ailleurs, mais leur popularité en fait des niveaux auto-réalisateurs.'
    },
    'psar': {
      titre: 'SAR parabolique',
      quoi: 'Un semis de points qui se rapproche du cours à mesure que la tendance se prolonge, jusqu\'au retournement.',
      formule: 'Chaque point avance vers l\'extrême de la tendance d\'une fraction croissante de la distance qui l\'en sépare, le facteur d\'accélération augmentant à chaque nouvel extrême.',
      lecture: 'Points sous le cours, tendance haussière. Le retournement du semis marque la sortie. Il sert avant tout de stop suiveur mécanique.',
      limites: 'Il est toujours en position, donc toujours en train de se retourner en marché sans tendance. Utilisé seul, il génère beaucoup de faux signaux.'
    },
    'linreg': {
      titre: 'Canal de régression',
      quoi: 'La droite qui passe au plus près de tous les cours de la période, encadrée par des bornes à N écarts-types des écarts observés.',
      formule: 'Droite des moindres carrés sur les clôtures, bornes à ± N × écart-type des résidus.',
      lecture: 'La pente donne la tendance en francs par séance. Le R² dit dans quelle mesure une droite décrit vraiment ces cours : au-dessus de 70 %, la tendance est nette ; sous 30 %, tracer une droite n\'a pas grand sens.',
      limites: 'Le canal se recalcule à chaque nouvelle séance et se déforme donc rétrospectivement. Un canal parfait sur l\'historique ne prouve rien sur la suite.'
    },
    'pivots': {
      titre: 'Points pivots',
      quoi: 'Des niveaux de support et de résistance dérivés mécaniquement de la séance précédente.',
      formule: 'Pivot = (haut + bas + clôture) ÷ 3. Les résistances et supports s\'en déduisent par symétrie sur l\'amplitude de la séance.',
      lecture: 'Le pivot sépare le biais haussier du biais baissier de la séance. Les niveaux R et S servent de cibles et de zones de retournement.',
      limites: 'Conçus pour l\'intraday sur des marchés très liquides. Sur une place où le carnet est mince, ils valent comme repère mais pas comme point d\'entrée.'
    },

    /* ─────────────────────────────────────────────────────────────
       ANALYSE TECHNIQUE — MOMENTUM ET VOLATILITÉ
       ───────────────────────────────────────────────────────────── */

    'rsi': {
      titre: 'RSI, indice de force relative',
      quoi: 'Compare l\'ampleur moyenne des hausses à celle des baisses sur N séances, sur une échelle de 0 à 100.',
      formule: '100 − 100 ÷ (1 + moyenne des gains ÷ moyenne des pertes), les moyennes étant lissées à la manière de Wilder.',
      lecture: 'Au-dessus de 70, les acheteurs se sont beaucoup dépensés ; sous 30, les vendeurs. Le vrai signal n\'est pas le franchissement du seuil mais la divergence : un nouveau sommet du cours que le RSI ne confirme pas trahit un essoufflement.',
      limites: 'En tendance forte, le RSI peut rester au-dessus de 70 pendant des mois. Vendre parce qu\'un titre est « suracheté » dans une tendance haussière saine est l\'erreur la plus fréquente des débutants.',
      brvm: 'Sur un titre peu échangé, quelques séances sans transaction figent le RSI. Croisez-le toujours avec le volume avant d\'en tirer une conclusion.'
    },
    'macd': {
      titre: 'MACD',
      quoi: 'L\'écart entre deux moyennes exponentielles, comparé à sa propre moyenne. Il mesure l\'accélération de la tendance.',
      formule: 'MACD = EMA(12) − EMA(26). Signal = EMA(9) du MACD. Histogramme = MACD − signal.',
      lecture: 'Le croisement des deux lignes donne le signal classique. L\'histogramme est plus précieux : il se retourne avant le croisement, et son rétrécissement annonce que le mouvement perd de sa force alors même que le cours progresse encore.',
      limites: 'Ses valeurs dépendent du niveau du cours : on ne compare pas le MACD de deux titres entre eux, seulement sa forme sur un même titre.'
    },
    'stoch': {
      titre: 'Oscillateur stochastique',
      quoi: 'Situe la clôture dans l\'amplitude haut-bas des N dernières séances.',
      formule: '%K = (clôture − plus bas de N) ÷ (plus haut de N − plus bas de N) × 100, puis lissé. %D est la moyenne de %K.',
      lecture: 'Clôturer près du haut de l\'amplitude traduit une pression acheteuse. Le croisement %K/%D dans les zones extrêmes fournit le signal usuel.',
      limites: 'Très réactif, donc très bruité. À réserver au timing d\'une entrée dans une tendance déjà identifiée par ailleurs.'
    },
    'bb': {
      titre: 'Bandes de Bollinger',
      quoi: 'Une enveloppe autour de la moyenne mobile, dont la largeur suit la volatilité observée.',
      formule: 'Moyenne à 20 séances ± 2 écarts-types des clôtures sur la même fenêtre.',
      lecture: 'La largeur est l\'information principale : un resserrement extrême signale que la volatilité s\'est comprimée et qu\'une expansion se prépare. Le %B indique où se situe le cours dans les bandes, 0 sur la borne basse, 1 sur la haute.',
      limites: 'Toucher la bande haute n\'est pas un signal de vente : en tendance forte, le cours « marche » le long de la bande. Et le resserrement ne dit jamais dans quel sens la sortie se fera.'
    },
    'atr': {
      titre: 'ATR, amplitude vraie moyenne',
      quoi: 'L\'amplitude moyenne d\'une séance, gaps inclus. C\'est la mesure de référence du bruit ordinaire d\'un titre.',
      formule: 'Moyenne lissée du plus grand des trois écarts : haut-bas, |haut − clôture précédente|, |bas − clôture précédente|.',
      lecture: 'Sert à dimensionner un stop. Un stop plus serré qu\'un ATR sera emporté par le mouvement normal du titre, sans qu\'aucune thèse ait été invalidée. Rapporté au cours, il permet de comparer le risque de deux titres de prix très différents.',
      limites: 'Il mesure l\'amplitude, jamais la direction. Un ATR élevé n\'est ni bon ni mauvais en soi.'
    },
    'divergence': {
      titre: 'Divergence',
      quoi: 'Un désaccord entre la direction du cours et celle d\'un oscillateur.',
      formule: 'Divergence baissière : le cours fait un sommet plus haut, l\'oscillateur un sommet plus bas. Divergence haussière : le cours fait un creux plus bas, l\'oscillateur un creux plus haut. Les divergences dites cachées inversent ces conditions et annoncent une continuation.',
      lecture: 'Une divergence signale que le mouvement se poursuit avec moins de force qu\'avant. C\'est un avertissement, pas un signal d\'entrée : elle doit être confirmée par une cassure de niveau.',
      limites: 'Les divergences peuvent se prolonger très longtemps avant de se résoudre, et certaines ne se résolvent jamais. Prises isolément, elles font perdre de l\'argent.'
    },
    'obv': {
      titre: 'On-Balance Volume',
      quoi: 'Le cumul des volumes affectés du signe de la séance. Il suit l\'argent plutôt que le prix.',
      formule: 'On ajoute le volume les séances de hausse, on le retranche les séances de baisse.',
      lecture: 'Seule sa direction compte, jamais son niveau. Quand le cours monte et que l\'OBV recule, la hausse n\'est pas financée : elle est fragile.',
      limites: 'Il traite de la même façon une hausse de 0,1 % et une hausse de 5 %, ce qui est grossier.'
    },
    'mfi': {
      titre: 'Money Flow Index',
      quoi: 'Un RSI pondéré par les volumes échangés.',
      formule: 'Rapport entre les flux monétaires des séances haussières et ceux des séances baissières sur N séances, ramené sur 0-100.',
      lecture: 'Une divergence MFI pèse plus lourd qu\'une divergence RSI puisqu\'elle intègre l\'engagement financier réel.',
      limites: 'Sur un titre peu liquide, quelques transactions atypiques suffisent à le déformer.'
    },
    'volume': {
      titre: 'Volume',
      quoi: 'Le nombre de titres échangés dans la séance.',
      formule: 'Somme des quantités traitées.',
      lecture: 'Le volume valide le prix. Une cassure de résistance sans volume est suspecte ; la même avec un volume double de la moyenne est crédible. Le rapport au volume moyen à 20 séances est plus parlant que le chiffre brut.',
      limites: 'Un volume peut être gonflé par une seule transaction de bloc sans rapport avec le marché.',
      brvm: 'Un volume nul n\'est pas une information de marché : il signifie simplement qu\'aucune transaction n\'a eu lieu. La part de séances effectivement traitées est un meilleur indicateur de liquidité que le volume moyen.'
    },

    /* ─────────────────────────────────────────────────────────────
       ANALYSE TECHNIQUE — STATISTIQUES
       ───────────────────────────────────────────────────────────── */

    'volatilite': {
      titre: 'Volatilité annualisée',
      quoi: 'L\'ampleur typique des variations du titre, ramenée à une base annuelle.',
      formule: 'Écart-type des rendements journaliers × racine de 252 séances.',
      lecture: 'Une volatilité de 20 % signifie que, dans environ deux cas sur trois, le titre finira l\'année dans une fourchette de plus ou moins 20 % autour de sa tendance. Elle sert surtout à comparer des titres entre eux.',
      limites: 'Elle traite hausses et baisses de la même façon, alors qu\'un investisseur ne les vit pas de la même manière. Et elle suppose une régularité que les marchés n\'ont pas.'
    },
    'parkinson': {
      titre: 'Volatilité de Parkinson',
      quoi: 'Une estimation de la volatilité fondée sur l\'amplitude haut-bas plutôt que sur les seules clôtures.',
      formule: 'Dérivée de la moyenne des carrés du logarithme du rapport haut/bas, annualisée.',
      lecture: 'À nombre d\'observations égal, elle est plus précise que la volatilité de clôture, car une séance contient plus d\'information que son seul point final. Nettement supérieure à la volatilité de clôture, elle révèle des mouvements intra-séance importants qui se referment avant la cloche.',
      limites: 'Elle ignore les écarts d\'ouverture, donc sous-estime le risque des titres qui ouvrent souvent en gap.'
    },
    'sharpe': {
      titre: 'Ratio de Sharpe',
      quoi: 'Le rendement obtenu au-delà du taux sans risque, rapporté au risque pris pour l\'obtenir.',
      formule: '(rendement annualisé − taux sans risque) ÷ volatilité annualisée.',
      lecture: 'Sous 0, le titre a fait moins bien qu\'un placement sans risque. Autour de 1, la rémunération du risque est correcte. Au-delà de 2, elle est remarquable — et mérite qu\'on vérifie la période retenue avant de s\'enthousiasmer.',
      limites: 'Il pénalise la volatilité à la hausse comme à la baisse. Il dépend entièrement de la période choisie : le même titre peut afficher 2,5 sur trois ans et −0,3 sur cinq.'
    },
    'sortino': {
      titre: 'Ratio de Sortino',
      quoi: 'Un Sharpe qui ne pénalise que la volatilité baissière.',
      formule: '(rendement annualisé − taux sans risque) ÷ écart-type des seuls rendements négatifs, annualisé.',
      lecture: 'Plus juste que le Sharpe pour un investisseur, qui ne se plaint jamais d\'une hausse brutale. Un Sortino nettement supérieur au Sharpe indique un titre dont la volatilité est surtout haussière.',
      limites: 'Calculé sur peu d\'observations négatives, il devient instable.'
    },
    'drawdown': {
      titre: 'Perte maximale',
      quoi: 'La plus forte baisse subie entre un sommet et le creux qui l\'a suivi.',
      formule: 'Minimum de (cours ÷ plus haut atteint jusque-là − 1) sur toute la période.',
      lecture: 'C\'est le chiffre le plus concret du risque : la question n\'est pas statistique mais personnelle, sauriez-vous conserver le titre en traversant cela ? La durée de la baisse compte autant que son ampleur.',
      limites: 'C\'est un événement passé unique, pas une probabilité. Rien n\'interdit de faire pire demain.'
    },
    'var': {
      titre: 'Valeur en risque',
      quoi: 'La perte quotidienne qui n\'est dépassée que dans un faible pourcentage des séances.',
      formule: 'Quantile empirique des rendements journaliers observés, à 5 % ou 1 %.',
      lecture: 'Une VaR 95 % de −1,4 % signifie qu\'une séance sur vingt s\'est soldée par une perte supérieure à 1,4 %.',
      limites: 'Elle ne dit rien de ce qui se passe au-delà du seuil : la perte moyenne dans les cas extrêmes se mesure par la VaR conditionnelle. Et elle suppose que l\'avenir ressemble au passé observé.'
    },
    'beta': {
      titre: 'Beta',
      quoi: 'La sensibilité du titre aux mouvements de l\'indice de référence.',
      formule: 'Covariance entre les rendements du titre et ceux de l\'indice, divisée par la variance de l\'indice.',
      lecture: 'Un beta de 1,3 signifie qu\'historiquement le titre amplifiait de 30 % les mouvements du marché. Sous 1, il les amortit. Le R² dit quelle part des variations du titre s\'explique réellement par le marché : un beta associé à un R² de 5 % ne veut rien dire.',
      limites: 'Il n\'a de sens que si l\'indice retenu est vraiment le marché du titre, et il se calcule sur des séances communes, jamais sur des dates approximatives.',
      brvm: 'Sur des titres qui ne cotent pas tous les jours, l\'appariement date à date réduit fortement le nombre d\'observations exploitables et le beta perd de sa fiabilité.'
    },
    'hurst': {
      titre: 'Exposant de Hurst',
      quoi: 'Mesure si une série a tendance à prolonger ses mouvements ou à revenir vers sa moyenne.',
      formule: 'Pente de la régression du logarithme du ratio étendue/écart-type sur le logarithme de la taille des sous-périodes.',
      lecture: 'Au-dessus de 0,55, la série est persistante : les tendances se prolongent, et les stratégies de suivi de tendance y ont leur place. Sous 0,45, elle revient vers sa moyenne : les stratégies de retour à la moyenne conviennent mieux. Autour de 0,5, on est proche d\'une marche aléatoire.',
      limites: 'Il demande plusieurs centaines d\'observations pour être stable, et il change de valeur selon l\'horizon examiné.'
    },
    'score-technique': {
      titre: 'Score de synthèse',
      quoi: 'L\'agrégation pondérée d\'une quinzaine de tests techniques indépendants, sur une échelle de −100 à +100.',
      formule: 'Chaque test renvoie une note de −2 à +2 assortie d\'un poids. Le score est la moyenne pondérée ramenée sur cent.',
      lecture: 'La cohérence compte davantage que le score. Un score de +30 porté par douze signaux unanimes est plus solide qu\'un score de +55 issu de signaux qui se contredisent. Lisez toujours la ligne de cohérence avant le chiffre.',
      limites: 'La pondération est un choix, discutable comme tout choix. Ce score ignore entièrement les fondamentaux, l\'actualité de la société et l\'état réel du carnet d\'ordres.'
    },

    /* ─────────────────────────────────────────────────────────────
       ANALYSE FONDAMENTALE — RENTABILITÉ
       ───────────────────────────────────────────────────────────── */

    'ca': {
      titre: 'Chiffre d\'affaires',
      quoi: 'Le total des ventes de l\'exercice, avant toute charge.',
      formule: 'Somme des produits d\'exploitation facturés.',
      lecture: 'C\'est le point de départ de tout. Une croissance du résultat sans croissance du chiffre d\'affaires vient d\'économies de coûts, et les économies ont une fin.',
      limites: 'Un chiffre d\'affaires peut être gonflé par des acquisitions ou par une reconnaissance de revenu agressive. Regardez la croissance organique quand elle est disponible.'
    },
    'marge-nette': {
      titre: 'Marge nette',
      quoi: 'La part du chiffre d\'affaires qui reste après toutes les charges, tous les intérêts et tous les impôts.',
      formule: 'Résultat net ÷ chiffre d\'affaires.',
      lecture: 'Elle ne se compare qu\'à l\'intérieur d\'un même secteur. Une distribution alimentaire à 2 % peut être excellente, une banque à 15 % médiocre. Sa stabilité dans le temps compte plus que son niveau.',
      limites: 'Le résultat net est le poste le plus facile à habiller comptablement, notamment par les éléments exceptionnels.'
    },
    'marge-exploitation': {
      titre: 'Marge d\'exploitation',
      quoi: 'La rentabilité du métier lui-même, avant les effets du financement et de la fiscalité.',
      formule: 'Résultat brut d\'exploitation ÷ chiffre d\'affaires.',
      lecture: 'Plus révélatrice que la marge nette pour juger la performance opérationnelle, parce qu\'elle ne dépend ni de la structure de dette ni du régime fiscal.',
      limites: 'Les périmètres d\'un résultat d\'exploitation varient d\'une société à l\'autre : vérifiez ce qui y est inclus avant de comparer.'
    },
    'roe': {
      titre: 'ROE, rentabilité des capitaux propres',
      quoi: 'Ce que la société rapporte annuellement à ses actionnaires, rapporté à ce qu\'ils y ont laissé.',
      formule: 'Résultat net ÷ capitaux propres.',
      lecture: 'C\'est le ratio central de l\'analyse fondamentale. Au-dessus de 15 % durablement, la société crée de la valeur. Sa décomposition de DuPont révèle d\'où il vient : de la marge, de la rotation des actifs, ou simplement de l\'endettement.',
      limites: 'Un ROE élevé obtenu par un fort endettement n\'est pas une performance mais un pari. Il peut aussi refléter des capitaux propres faibles après des pertes passées.'
    },
    'roa': {
      titre: 'ROA, rentabilité des actifs',
      quoi: 'Ce que la société tire de l\'ensemble de ses moyens, quelle qu\'en soit l\'origine.',
      formule: 'Résultat net ÷ total du bilan.',
      lecture: 'Insensible à la structure de financement, il mesure l\'efficacité industrielle pure. L\'écart entre ROE et ROA mesure l\'effet de levier de la dette.',
      limites: 'Il compare mal des secteurs aux intensités capitalistiques différentes.'
    },
    'dupont': {
      titre: 'Décomposition de DuPont',
      quoi: 'Une façon d\'ouvrir le ROE pour voir de quoi il est fait.',
      formule: 'ROE = marge nette × rotation des actifs × levier financier, où la rotation est le chiffre d\'affaires rapporté au total du bilan et le levier le total du bilan rapporté aux capitaux propres.',
      lecture: 'Deux sociétés au même ROE peuvent être radicalement différentes. L\'une le tire d\'une marge élevée, l\'autre d\'un endettement massif. La première mérite une prime, la seconde une décote.',
      limites: 'Chaque facteur peut être manipulé indépendamment ; la décomposition éclaire, elle ne juge pas.'
    },
    'piotroski': {
      titre: 'Score de Piotroski',
      quoi: 'Neuf tests binaires sur la qualité financière, chacun valant un point.',
      formule: 'Quatre tests de rentabilité, trois de structure financière, deux d\'efficacité opérationnelle. Le score va de 0 à 9.',
      lecture: 'À partir de 7, la santé financière s\'améliore sur tous les fronts. Sous 3, elle se dégrade. Le score a été conçu pour trier les titres décotés : c\'est là qu\'il est le plus utile, en séparant les vraies affaires des sociétés bon marché pour de bonnes raisons.',
      limites: 'Il demande deux exercices complets et comparables. Il ne dit rien de la valorisation ni de la qualité du métier.'
    },
    'altman': {
      titre: 'Score Z d\'Altman',
      quoi: 'Une note synthétique du risque de défaillance à deux ans.',
      formule: 'Combinaison pondérée de cinq ratios : fonds de roulement, réserves accumulées, résultat d\'exploitation, capitaux propres rapportés aux dettes, et rotation des actifs.',
      lecture: 'Au-dessus de 2,9 la société est en zone sûre, sous 1,23 en zone de détresse, entre les deux en zone grise. Sa trajectoire compte plus que son niveau ponctuel.',
      limites: 'Calibré sur des industriels américains cotés des années soixante. Il ne s\'applique ni aux banques ni aux assurances, et sa transposition à d\'autres marchés reste indicative.'
    },

    /* ─────────────────────────────────────────────────────────────
       ANALYSE FONDAMENTALE — STRUCTURE ET LIQUIDITÉ
       ───────────────────────────────────────────────────────────── */

    'gearing': {
      titre: 'Gearing, levier financier',
      quoi: 'Le poids de la dette financière face aux capitaux apportés par les actionnaires.',
      formule: 'Dettes financières ÷ capitaux propres.',
      lecture: 'Sous 0,5 la structure est prudente, au-delà de 1 la dette dépasse les fonds propres et la société devient sensible aux taux comme aux à-coups d\'activité.',
      limites: 'Le niveau acceptable dépend entièrement du secteur : un opérateur télécom aux flux réguliers supporte ce qu\'un industriel cyclique ne supporterait pas.'
    },
    'dette-nette': {
      titre: 'Dette nette',
      quoi: 'La dette financière diminuée de la trésorerie disponible.',
      formule: 'Dettes financières − trésorerie et équivalents.',
      lecture: 'C\'est la dette qui compte vraiment. Une dette nette négative signifie que la société détient plus de liquidités qu\'elle ne doit.',
      limites: 'Toute la trésorerie n\'est pas immédiatement mobilisable, notamment dans les groupes multi-pays.'
    },
    'dette-ebitda': {
      titre: 'Dette nette sur excédent brut',
      quoi: 'Le nombre d\'années d\'excédent brut d\'exploitation nécessaires pour rembourser la dette nette.',
      formule: 'Dette nette ÷ résultat brut d\'exploitation.',
      lecture: 'Sous 2, la dette est confortable. Entre 2 et 3, elle est surveillée. Au-delà de 4, elle devient contraignante et limite la capacité d\'investissement comme de distribution.',
      limites: 'L\'excédent brut n\'est pas de la trésorerie : une société peut afficher un bon ratio et manquer de liquidités.'
    },
    'autonomie': {
      titre: 'Autonomie financière',
      quoi: 'La part du bilan financée par les actionnaires plutôt que par des tiers.',
      formule: 'Capitaux propres ÷ total du bilan.',
      lecture: 'Au-dessus de 40 %, l\'indépendance est confortable. Sous 20 %, la société dépend étroitement de ses créanciers.',
      limites: 'Les banques travaillent structurellement avec des ratios très bas : ce critère ne leur est pas applicable.'
    },

    /* ─────────────────────────────────────────────────────────────
       ANALYSE FONDAMENTALE — FLUX
       ───────────────────────────────────────────────────────────── */

    'fcf': {
      titre: 'Flux de trésorerie disponible',
      quoi: 'La trésorerie qui reste une fois l\'exploitation payée et les investissements réalisés. C\'est l\'argent réellement libre.',
      formule: 'Flux de trésorerie opérationnel − investissements.',
      lecture: 'C\'est le chiffre le plus difficile à maquiller et le plus important. Un résultat net durablement supérieur au flux disponible doit alerter : les bénéfices ne se transforment pas en argent.',
      limites: 'Il est volatil d\'un exercice à l\'autre selon le rythme des investissements. Il se lit sur plusieurs années, jamais sur une seule.'
    },
    'conversion-cash': {
      titre: 'Conversion en trésorerie',
      quoi: 'La proportion du résultat net qui se retrouve effectivement en flux de trésorerie opérationnel.',
      formule: 'Flux de trésorerie opérationnel ÷ résultat net.',
      lecture: 'Durablement au-dessus de 1, les bénéfices sont bien réels. Durablement en dessous de 0,7, une part du résultat reste immobilisée en stocks ou en créances clients, ou relève d\'écritures comptables.',
      limites: 'Un exercice isolé ne signifie rien : un investissement en fonds de roulement peut être le signe d\'une forte croissance.'
    },
    'capex-ca': {
      titre: 'Intensité capitalistique',
      quoi: 'La part du chiffre d\'affaires réinvestie chaque année dans l\'outil de production.',
      formule: 'Investissements ÷ chiffre d\'affaires.',
      lecture: 'Une intensité faible et stable caractérise les métiers qui génèrent beaucoup de trésorerie libre. Une intensité élevée n\'est pas mauvaise si elle finance la croissance, elle l\'est si elle sert seulement à maintenir l\'existant.',
      limites: 'La distinction entre investissement de maintien et de croissance est rarement publiée.'
    },

    /* ─────────────────────────────────────────────────────────────
       ANALYSE FONDAMENTALE — VALORISATION
       ───────────────────────────────────────────────────────────── */

    'per': {
      titre: 'PER, cours sur bénéfice',
      quoi: 'Le nombre d\'années de bénéfice actuel que représente le prix payé.',
      formule: 'Cours ÷ bénéfice par action.',
      lecture: 'C\'est le multiple le plus utilisé et le plus mal utilisé. Un PER élevé traduit soit une croissance attendue, soit un excès d\'optimisme. Un PER bas traduit soit une occasion, soit un problème. Le seul PER qui informe est celui qu\'on compare aux concurrents et à l\'historique du titre.',
      limites: 'Il n\'a aucun sens si le bénéfice est négatif ou exceptionnel. Il ignore totalement la dette : deux sociétés au même PER peuvent avoir des risques opposés.'
    },
    'peg': {
      titre: 'PEG, PER rapporté à la croissance',
      quoi: 'Le PER divisé par le taux de croissance attendu des bénéfices.',
      formule: 'PER ÷ croissance annuelle des bénéfices en pourcentage.',
      lecture: 'Sous 1, la croissance n\'est pas entièrement payée. Au-dessus de 2, elle l\'est largement. Il permet de comparer une société en forte croissance à une société mature.',
      limites: 'Il repose entièrement sur une croissance future estimée. Changez l\'hypothèse de croissance et le verdict s\'inverse.'
    },
    'pbr': {
      titre: 'Cours sur actif net',
      quoi: 'Le rapport entre le prix de l\'action et la valeur comptable des capitaux propres par action.',
      formule: 'Cours ÷ (capitaux propres ÷ nombre d\'actions).',
      lecture: 'Sous 1, le marché valorise la société moins que la somme comptable de ses fonds propres. À croiser impérativement avec le ROE : un actif net faiblement rentable mérite d\'être décoté.',
      limites: 'La valeur comptable reflète mal les actifs immatériels. Pour une société de services, ce ratio n\'apprend presque rien.'
    },
    'ev-ebitda': {
      titre: 'Valeur d\'entreprise sur excédent brut',
      quoi: 'Le multiple qui compare la valeur totale de la société, dette incluse, à sa génération brute de résultat.',
      formule: '(Capitalisation + dette nette) ÷ résultat brut d\'exploitation.',
      lecture: 'Plus rigoureux que le PER pour comparer deux sociétés, car il neutralise les différences de structure financière et de fiscalité. C\'est le multiple des professionnels du rachat.',
      limites: 'L\'excédent brut ignore les investissements nécessaires. Deux sociétés au même multiple peuvent avoir des besoins d\'investissement très différents.'
    },
    'rendement': {
      titre: 'Rendement du dividende',
      quoi: 'Le dividende annuel rapporté au cours actuel.',
      formule: 'Dividende par action ÷ cours.',
      lecture: 'Un rendement anormalement élevé n\'est pas une aubaine mais un avertissement : soit le cours a chuté, soit le marché anticipe une coupe du dividende. Vérifiez toujours le taux de distribution et la couverture par les flux de trésorerie.',
      limites: 'Il ne dit rien de la pérennité du dividende. Un rendement de 12 % versé une fois vaut moins qu\'un rendement de 5 % versé depuis quinze ans.'
    },
    'payout': {
      titre: 'Taux de distribution',
      quoi: 'La part du bénéfice reversée aux actionnaires.',
      formule: 'Dividende par action ÷ bénéfice par action.',
      lecture: 'Sous 40 %, la société conserve de quoi financer sa croissance et son dividende est sécurisé. Au-delà de 80 %, la marge de manœuvre disparaît : un exercice difficile suffit à contraindre une coupe. Au-dessus de 100 %, le dividende est financé par la trésorerie ou la dette, ce qui ne dure pas.',
      limites: 'Un taux élevé peut être normal dans un métier mature sans besoin d\'investissement.'
    },
    'dcf': {
      titre: 'Actualisation des flux de trésorerie',
      quoi: 'Une valorisation qui estime la société par la somme actualisée de la trésorerie qu\'elle produira à l\'avenir.',
      formule: 'Somme des flux prévisionnels actualisés au coût du capital, plus une valeur terminale actualisée, moins la dette nette, le tout divisé par le nombre d\'actions.',
      lecture: 'C\'est la seule méthode qui raisonne en valeur intrinsèque plutôt qu\'en comparaison. Son intérêt véritable n\'est pas le chiffre final mais la matrice de sensibilité : elle montre à quel point la valeur dépend d\'hypothèses que personne ne connaît.',
      limites: 'La valeur terminale représente souvent plus des deux tiers du résultat. Un écart d\'un point sur le taux d\'actualisation peut déplacer la valeur de 30 %. Un DCF ne prouve rien, il structure une réflexion.'
    },
    'wacc': {
      titre: 'Coût moyen pondéré du capital',
      quoi: 'Le taux de rentabilité qu\'exigent collectivement les actionnaires et les créanciers.',
      formule: 'Coût des fonds propres × part des fonds propres + coût de la dette après impôt × part de la dette.',
      lecture: 'C\'est le taux d\'actualisation du DCF, et l\'hypothèse la plus déterminante de toute la valorisation. Le coût des fonds propres se construit par le modèle d\'équilibre : taux sans risque + beta × prime de risque du marché.',
      limites: 'Chacun de ses composants est une estimation. Sur un marché émergent, la prime de risque est particulièrement discutée et les écarts entre praticiens sont considérables.'
    },
    'gordon': {
      titre: 'Modèle de Gordon-Shapiro',
      quoi: 'Une valorisation par les dividendes, en supposant qu\'ils croissent indéfiniment à un rythme constant.',
      formule: 'Valeur = dividende de l\'année prochaine ÷ (rendement exigé − taux de croissance).',
      lecture: 'Simple et transparent, adapté aux sociétés matures qui distribuent régulièrement. Sa vertu est de rendre explicite ce que le cours actuel suppose implicitement de croissance.',
      limites: 'Il devient absurde dès que le taux de croissance approche le rendement exigé, et inapplicable aux sociétés qui ne distribuent pas.'
    },
    'valeur-terminale': {
      titre: 'Valeur terminale',
      quoi: 'La valeur attribuée à tout ce qui vient après l\'horizon de prévision explicite.',
      formule: 'Par croissance perpétuelle : dernier flux × (1 + croissance) ÷ (taux − croissance). Par multiple de sortie : dernier excédent brut × un multiple observé sur le marché.',
      lecture: 'Elle pèse en général entre 60 et 80 % de la valeur totale. Sa part doit toujours être affichée : au-delà de 85 %, la valorisation ne repose plus sur les prévisions mais sur une hypothèse d\'éternité.',
      limites: 'La croissance perpétuelle retenue ne peut excéder durablement la croissance de l\'économie, faute de quoi la société finirait par représenter le PIB entier.'
    },
    'dcf-inverse': {
      titre: 'DCF inversé',
      quoi: 'La démarche retournée : au lieu de calculer une valeur, on cherche quelle croissance le cours actuel suppose déjà.',
      formule: 'On résout l\'équation du DCF en fixant la valeur au cours de marché et en cherchant le taux de croissance qui l\'égalise.',
      lecture: 'C\'est souvent l\'exercice le plus éclairant. Si le cours suppose 18 % de croissance annuelle pendant cinq ans, la question devient concrète : cette société peut-elle réellement tenir ce rythme ?',
      limites: 'Le résultat dépend autant du taux d\'actualisation retenu que de la croissance recherchée.'
    },
    'graham': {
      titre: 'Nombre de Graham',
      quoi: 'Une borne de valorisation prudente proposée par Benjamin Graham pour les sociétés défensives.',
      formule: 'Racine carrée de (22,5 × bénéfice par action × actif net par action).',
      lecture: 'Le facteur 22,5 vient de la double limite que Graham s\'imposait : PER maximal de 15 et rapport cours sur actif net maximal de 1,5. Le résultat donne une valeur au-delà de laquelle il refusait d\'acheter.',
      limites: 'Conçu dans les années quarante pour des industriels à forte assise d\'actifs. Inapplicable aux sociétés de services ou de technologie.'
    },
    'marge-securite': {
      titre: 'Marge de sécurité',
      quoi: 'L\'écart entre la valeur estimée et le cours payé.',
      formule: '(Valeur estimée − cours) ÷ valeur estimée.',
      lecture: 'C\'est la protection contre ses propres erreurs d\'estimation. Les investisseurs prudents n\'achètent qu\'au-delà de 30 %, précisément parce qu\'ils savent que leur estimation est fausse.',
      limites: 'Une marge de sécurité calculée sur une valeur elle-même erronée ne protège de rien. Elle vaut ce que valent les hypothèses.'
    },

    /* ─────────────────────────────────────────────────────────────
       MARCHÉ ET PRATIQUE
       ───────────────────────────────────────────────────────────── */

    'brvm': {
      titre: 'La BRVM',
      quoi: 'La Bourse Régionale des Valeurs Mobilières, place unique commune aux huit États de l\'UEMOA, dont le siège est à Abidjan.',
      formule: 'Antennes nationales au Bénin, Burkina Faso, Côte d\'Ivoire, Guinée-Bissau, Mali, Niger, Sénégal et Togo. Cotation en francs CFA, règlement-livraison à J+3.',
      lecture: 'Un marché unique pour huit pays, ce qui supprime le risque de change entre eux mais concentre les risques régionaux. La cotation se fait par fixing, avec des limites de variation quotidienne.',
      limites: 'La liquidité reste concentrée sur une poignée de valeurs. Sur beaucoup de titres, passer un ordre significatif déplace le cours : c\'est le premier facteur à intégrer avant toute analyse.'
    },
    'liquidite': {
      titre: 'Liquidité',
      quoi: 'La capacité à acheter ou vendre une quantité donnée sans déplacer le cours.',
      formule: 'S\'apprécie par le volume moyen, la part de séances effectivement traitées et l\'écart entre les meilleures offres d\'achat et de vente.',
      lecture: 'Sur un marché étroit, c\'est le premier critère, avant même la valorisation. Une analyse parfaite sur un titre qu\'on ne peut pas vendre ne sert à rien.',
      limites: 'Le volume moyen masque de fortes irrégularités : quelques séances de blocs peuvent créer l\'illusion d\'un marché actif.'
    },
    'gain-risque': {
      titre: 'Rapport gain sur risque',
      quoi: 'Ce que rapporte l\'objectif visé, rapporté à ce que coûte l\'invalidation du scénario.',
      formule: '(Objectif − entrée) ÷ (entrée − niveau d\'invalidation).',
      lecture: 'En dessous de 1, l\'opération ne vaut pas la peine quel que soit le taux de réussite espéré. Un rapport de 3 permet de se tromper deux fois sur trois en restant à l\'équilibre.',
      limites: 'Il n\'a de sens que si le niveau d\'invalidation est vraiment respecté. Déplacer un stop annule tout le raisonnement.'
    },
    'dimensionnement': {
      titre: 'Dimensionnement de position',
      quoi: 'Le nombre de titres à acheter pour que la perte, en cas d\'invalidation, reste limitée à une part définie du capital.',
      formule: 'Quantité = (capital × pourcentage de risque accepté) ÷ (prix d\'entrée − niveau d\'invalidation).',
      lecture: 'C\'est la décision la plus importante de toute opération, plus importante que le choix du titre. Risquer 1 à 2 % du capital par position permet d\'enchaîner une longue série d\'échecs sans être éliminé.',
      limites: 'Le calcul suppose une sortie au niveau prévu. Sur un titre peu liquide, la sortie réelle peut être nettement plus basse.'
    },
    'backtest': {
      titre: 'Backtest',
      quoi: 'La simulation d\'une stratégie sur des données passées.',
      formule: 'Application mécanique des règles d\'entrée et de sortie à l\'historique, en comptabilisant frais et décalages.',
      lecture: 'Son intérêt n\'est pas le rendement affiché mais l\'ordre de grandeur du taux de réussite, du facteur de profit et de la perte maximale. La comparaison à l\'achat-conservation est indispensable : beaucoup de stratégies actives font moins bien que ne rien faire.',
      limites: 'Le passé n\'est pas un échantillon de l\'avenir. Multiplier les essais sur les mêmes données finit toujours par produire une stratégie brillante et sans valeur. Un résultat obtenu sur un seul titre et une seule période ne prouve rien.'
    },
    /* ─────────────────────────────────────────────────────────────
       DIVIDENDES — SOUTENABILITÉ, RÉSERVES, COUSSINS, RISQUE BANCAIRE
       ───────────────────────────────────────────────────────────── */

    'dps-brut-net': {
      titre: 'Dividende par action, brut et net',
      quoi: 'Le brut est le dividende voté par l\'assemblée. Le net est ce que l\'actionnaire encaisse après l\'impôt sur le revenu des valeurs mobilières (IRVM), retenu à la source.',
      formule: 'Net = brut × (1 − taux d\'IRVM). Brut = net ÷ (1 − taux d\'IRVM).',
      lecture: 'Le rendement et le taux de distribution se calculent sur le brut : c\'est la vraie décision de la société. Le revenu réel de l\'investisseur est le net.',
      limites: 'Le taux d\'IRVM dépend du pays de la société (10 % au Sénégal, 12 % en Côte d\'Ivoire ; d\'autres taux restent à vérifier). La BRVM ne publie que le net : le brut est reconstitué.',
      brvm: 'Une même société peut avoir un brut différent de celui qu\'affichent certaines sources qui recopient le net. Le recoupement avec les états financiers (DPA) lève le doute.'
    },
    'couverture-dividende': {
      titre: 'Couverture du dividende',
      quoi: 'Combien de fois le bénéfice de l\'exercice couvre le dividende versé.',
      formule: 'Bénéfice par action ÷ dividende par action (l\'inverse du taux de distribution).',
      lecture: 'Au-dessus de 1,5 fois, le dividende est confortablement financé par le résultat courant. Entre 1 et 1,2 fois, il n\'y a plus de marge : un mauvais exercice suffit à le remettre en cause. Sous 1 fois, la société puise dans ses réserves.',
      limites: 'Le bénéfice comptable n\'est pas de la trésorerie. Une banque peut avoir un bénéfice couvrant son dividende tout en voyant son coût du risque exploser l\'année suivante : regardez aussi la couverture avant risque.'
    },
    'croissance-dps': {
      titre: 'Croissance du dividende (TCAM)',
      quoi: 'Le rythme annuel moyen auquel le dividende par action a progressé sur 3 ou 5 exercices.',
      formule: '(dernier dividende ÷ dividende d\'il y a n exercices) puissance 1/n, moins 1. Les dividendes antérieurs à une attribution gratuite sont ramenés à la base d\'actions actuelle.',
      lecture: 'Une croissance régulière signale une politique de distribution qui suit les résultats. Une croissance forte avec un taux de distribution qui monte ne peut pas durer : elle consomme la marge de sécurité.',
      limites: 'Deux dates seulement : un exercice exceptionnel au début ou à la fin fausse le résultat. Comparez-la à la croissance du bénéfice par action.'
    },
    'regularite-dividende': {
      titre: 'Régularité du dividende',
      quoi: 'Le nombre d\'exercices consécutifs, jusqu\'au dernier, pour lesquels un dividende a été versé.',
      formule: 'Compte des années successives avec un dividende strictement positif, en s\'arrêtant à la première interruption.',
      lecture: 'Une longue série montre une culture de distribution. Une interruption, même ancienne, signale que la société coupe quand les résultats se dégradent.',
      limites: 'Elle ne mesure pas le montant : un dividende symbolique compte autant qu\'un dividende élevé. Elle dépend aussi de la profondeur de l\'historique disponible dans la base.'
    },
    'rendement-prospectif': {
      titre: 'Rendement prospectif',
      quoi: 'Le rendement que donnerait le prochain dividende annoncé, rapporté au cours actuel.',
      formule: 'Prochain dividende brut annoncé ÷ dernier cours.',
      lecture: 'Il montre ce que rapportera l\'achat aujourd\'hui, alors que le rendement courant regarde le dividende déjà versé. Un écart marqué entre les deux dit si la distribution monte ou baisse.',
      limites: 'Il n\'existe que si un détachement futur figure au calendrier. Le montant annoncé peut être modifié par l\'assemblée générale.'
    },
    'reserves': {
      titre: 'Réserves accumulées',
      quoi: 'Les bénéfices des années passées que la société a gardés plutôt que distribués, avec les primes d\'émission et le report à nouveau.',
      formule: 'Primes liées au capital + réserves + report à nouveau (soit les fonds propres, moins le capital social, moins le résultat de l\'exercice).',
      lecture: 'C\'est le matelas qui permet de maintenir un dividende les années où le résultat baisse. Plus il est épais par rapport au dividende annuel, moins une mauvaise année menace la distribution.',
      limites: 'Une partie n\'est pas distribuable : la réserve légale est obligatoire et certaines réserves sont réglementées. Les réserves peuvent aussi être incorporées au capital (attribution d\'actions gratuites), elles ne disparaissent pas mais changent de nature.',
      brvm: 'Les banques de l\'UMOA doivent conserver des fonds propres pour respecter les ratios prudentiels fixés par la BCEAO : leurs réserves servent d\'abord à cela, ensuite à la distribution.'
    },
    'reserves-annees': {
      titre: 'Réserves en années de dividendes',
      quoi: 'Pendant combien d\'années les réserves accumulées pourraient financer le dividende actuel sans aucun bénéfice.',
      formule: 'Réserves accumulées ÷ dividendes totaux versés au titre de l\'exercice (DPS brut × nombre d\'actions).',
      lecture: 'Plus de 3 ans : un coussin large. Moins de 1 an : la distribution repose presque entièrement sur le résultat de l\'année. C\'est un indicateur de résistance, pas de prévision.',
      limites: 'Toutes les réserves ne sont pas distribuables, et une banque ne peut pas les dépenser sans toucher à ses ratios réglementaires : le chiffre est un maximum théorique.'
    },
    'coussin-fp': {
      titre: 'Coussin de fonds propres',
      quoi: 'La part du total du bilan financée par les fonds propres : ce qui absorbe les pertes avant que les déposants soient touchés.',
      formule: 'Fonds propres ÷ total du bilan.',
      lecture: 'Plus il est haut, plus la banque encaisse de pertes sans fragiliser ses dépôts. Une baisse d\'année en année alors que le bilan grossit signale un levier qui monte.',
      limites: 'Ce n\'est pas le ratio de solvabilité réglementaire, qui rapporte les fonds propres aux actifs pondérés des risques et n\'est pas publié dans les états financiers. Il reste un indicateur de levier comptable.'
    },
    'coussin-apres-distribution': {
      titre: 'Coussin après distribution',
      quoi: 'Le coussin de fonds propres tel qu\'il serait si le dividende de l\'exercice était payé sur les fonds propres actuels, sans bénéfice de l\'année suivante.',
      formule: '(Fonds propres − dividendes totaux) ÷ total du bilan.',
      lecture: 'L\'écart avec le coussin avant distribution montre ce que le dividende « coûte » en solidité. Si le coussin remonte l\'année suivante, c\'est que la banque remet en réserve plus qu\'elle ne distribue.',
      limites: 'Photo à un instant donné : la banque reconstitue ses fonds propres avec son résultat, et le bilan varie. À lire avec le taux de distribution.'
    },
    'cout-du-risque': {
      titre: 'Coût du risque',
      quoi: 'Ce que la banque provisionne chaque année pour les crédits qu\'elle pense ne pas récupérer, net des reprises de provisions.',
      formule: 'Résultat brut d\'exploitation − résultat d\'exploitation (les deux sont publiés ; un négatif signifie qu\'il y a eu plus de reprises que de dotations).',
      lecture: 'C\'est la ligne qui fait le plus varier le bénéfice d\'une banque. Rapporté au produit net bancaire, un coût du risque élevé (au-delà de 15 % environ) ou qui double en un an annonce un bénéfice en baisse, donc un dividende sous pression.',
      limites: 'Une année à faible coût du risque peut cacher des provisions insuffisantes : la normalisation arrive souvent d\'un coup. Un coût très élevé peut aussi être un nettoyage ponctuel du bilan.',
      brvm: 'Dans les états financiers des banques de l\'UMOA, le coût du risque figure entre le résultat brut d\'exploitation et le résultat d\'exploitation.'
    },
    'pnb': {
      titre: 'Produit net bancaire (PNB)',
      quoi: 'Le « chiffre d\'affaires » d\'une banque : ses intérêts et commissions encaissés, moins les intérêts qu\'elle paie sur les dépôts et les autres charges directes.',
      formule: 'Intérêts et produits assimilés − intérêts et charges assimilées + commissions nettes + résultat des opérations de marché + autres produits d\'exploitation bancaire.',
      lecture: 'La croissance du PNB dit si la banque grandit. Comparé aux frais généraux (coefficient d\'exploitation) et au coût du risque, il montre où passe la marge.',
      limites: 'Un PNB en hausse peut venir de gains ponctuels sur titres. Il ne dit rien de la qualité du portefeuille de crédits.'
    },
    'rbe': {
      titre: 'Résultat brut d\'exploitation (banque)',
      quoi: 'Ce que la banque gagne avant de provisionner ses crédits douteux et avant impôt : sa capacité bénéficiaire « normale ».',
      formule: 'Produit net bancaire − charges générales d\'exploitation − dotations aux amortissements.',
      lecture: 'C\'est le bénéfice avant l\'aléa du risque de crédit. Stable et large, il donne à la banque de quoi absorber une hausse du coût du risque sans toucher au dividende.',
      limites: 'Il ne tient pas compte des pertes sur crédits, qui sont la vraie menace : à lire toujours avec le coût du risque.'
    },
    'couverture-avant-risque': {
      titre: 'Couverture du dividende avant risque',
      quoi: 'Combien de fois le résultat brut d\'exploitation (avant coût du risque) couvre le dividende total.',
      formule: 'Résultat brut d\'exploitation ÷ dividendes totaux versés.',
      lecture: 'Au-dessus de 2 fois, la banque a de la marge pour absorber une hausse du coût du risque. Vers 1 fois, le moindre sinistre de crédit se paie directement sur le dividende.',
      limites: 'Avant impôt : l\'impôt sur les bénéfices réduit la marge réelle. C\'est une mesure de résistance, pas une prévision de résultat.'
    },
    'marge-securite-risque': {
      titre: 'Marge de sécurité face au risque',
      quoi: 'Combien de fois le coût du risque actuel pourrait être supporté avant que le résultat brut d\'exploitation ne couvre plus le dividende.',
      formule: '(Résultat brut d\'exploitation − dividendes totaux) ÷ coût du risque de l\'exercice. Calcul avant impôt.',
      lecture: 'Un chiffre élevé signifie que le coût du risque devrait fortement augmenter pour menacer le dividende. Sous 1, une simple répétition du coût du risque actuel suffirait à découvrir le dividende.',
      limites: 'Non calculable quand le coût du risque est nul ou négatif. C\'est un test de résistance simple, sans fiscalité ni évolution du PNB.'
    },
    'tresorerie-dividende': {
      titre: 'Trésorerie face au dividende',
      quoi: 'Combien d\'années de dividendes la trésorerie disponible permettrait de financer.',
      formule: 'Trésorerie à l\'actif ÷ dividendes totaux versés.',
      lecture: 'Un dividende adossé à une trésorerie confortable n\'a pas besoin de dette pour être payé, même un mauvais exercice.',
      limites: 'La trésorerie sert aussi à l\'exploitation et aux investissements ; la dette éventuelle à rembourser n\'apparaît pas ici.'
    },
    'fcf-dividendes': {
      titre: 'Flux de trésorerie libre et dividendes',
      quoi: 'La comparaison entre l\'argent réellement dégagé par l\'activité après investissements et l\'argent versé aux actionnaires.',
      formule: 'Flux d\'exploitation − investissements, comparé au dividende total (DPS brut × nombre d\'actions).',
      lecture: 'Un dividende durablement supérieur au flux libre est financé par la dette ou par la trésorerie accumulée : il ne peut pas croître indéfiniment.',
      limites: 'Non calculable pour les banques (pas de tableau de flux dans les données) : on y utilise le résultat et les réserves.'
    },
    'retraitement-actions': {
      titre: 'Dividendes retraités des opérations sur le capital',
      quoi: 'Quand une société distribue des actions gratuites ou fractionne son capital, chaque action « ancienne » devient plusieurs actions. Les dividendes passés sont ramenés à la nouvelle base pour rester comparables.',
      formule: 'Dividende historique ÷ ratio de l\'opération (par exemple 1 action gratuite pour 1 : ratio 2, dividende divisé par 2).',
      lecture: 'Sans ce retraitement, le dividende semble s\'effondrer l\'année de l\'opération alors que l\'actionnaire n\'a rien perdu : il a simplement deux fois plus d\'actions.',
      limites: 'Les montants publiés à l\'époque restent la référence légale ; seul l\'affichage est retraité.'
    },
    'soutenabilite-dividende': {
      titre: 'Soutenabilité du dividende',
      quoi: 'La capacité de la société à maintenir son dividende, jugée sur le bénéfice, les réserves, les fonds propres et, pour une banque, le risque de crédit.',
      formule: 'Aucune formule unique : la lecture rassemble le taux de distribution, la couverture, les réserves en années de dividendes, le coussin de fonds propres, le coût du risque et le flux de trésorerie libre.',
      lecture: 'Les alertes sont comptées : aucune, le dividende est solide ; une, à surveiller ; deux ou plus, fragile. Les seuils sont des repères usuels, pas des règles.',
      limites: 'Un verdict n\'est pas une recommandation. Il ne remplace pas la lecture des rapports, en particulier pour comprendre l\'origine d\'un coût du risque exceptionnel.'
    },
    /* ─────────────────────────────────────────────────────────────
       OPÉRATIONS SUR TITRES — FRACTIONNEMENT, ATTRIBUTION GRATUITE, AUGMENTATION DE CAPITAL
       ───────────────────────────────────────────────────────────── */

    'operations-sur-titres': {
      titre: 'Opérations sur titres',
      quoi: 'Les décisions d\'une société qui changent le nombre de ses actions : fractionnement, attribution d\'actions gratuites, regroupement, augmentation de capital en numéraire, fusion.',
      formule: 'Fractionnement, attribution gratuite et regroupement : nouveau nombre d\'actions = ancien × ratio, sans apport d\'argent. Augmentation en numéraire : nouvelles actions souscrites contre de l\'argent frais.',
      lecture: 'Les trois premières ne changent rien à la valeur de la société : le cours est mécaniquement divisé (ou multiplié) par le ratio, le bénéfice par action et le dividende par action aussi. Le site retraite donc tous les BPA, DPA et cours d\'avant l\'opération pour qu\'ils restent comparables à ceux d\'après. Une augmentation en numéraire, elle, dilue ou finance la société : rien n\'est retraité.',
      limites: 'Sans retraitement, un fractionnement 1 pour 1 fait croire que le dividende et le bénéfice par action ont été divisés par deux, et que le cours a chuté de 50 %. Une opération non enregistrée dans la base fausse les PER, rendements et graphiques : un contrôle automatique repère les sauts de cours quotidiens supérieurs à 25 % sans opération connue.',
      brvm: 'Sur la BRVM, ces opérations sont fréquentes : un cours devenu très élevé pousse la société à distribuer des actions gratuites ou à fractionner pour rendre le titre plus liquide (les banques du groupe BOA en 2024, par exemple). Le cours affiché le jour du détachement chute d\'autant, sans perte pour l\'actionnaire.'
    },
    'fractionnement': {
      titre: 'Fractionnement d\'actions',
      quoi: 'Chaque action ancienne est remplacée par plusieurs actions nouvelles de moindre valeur nominale (10 pour 1, par exemple).',
      formule: 'Nombre d\'actions × ratio ; cours, BPA et DPA ÷ ratio.',
      lecture: 'Rend un titre au cours élevé plus accessible et plus liquide. Neutre pour la valeur : la capitalisation ne change pas.',
      limites: 'Ne crée aucune richesse. Comparer un cours d\'avant à un cours d\'après sans ajustement donne une baisse fictive.'
    },
    'attribution-gratuite': {
      titre: 'Attribution d\'actions gratuites',
      quoi: 'La société incorpore une partie de ses réserves ou primes au capital et distribue des actions nouvelles aux actionnaires, sans qu\'ils paient (1 pour 2 : une action nouvelle pour deux anciennes).',
      formule: 'Ratio = 1 + parité (1 pour 2 → 1,5 ; 1 pour 1 → 2). Cours, BPA, DPA d\'avant ÷ ratio.',
      lecture: 'La valeur des fonds propres est inchangée : les réserves deviennent du capital. Le cours baisse du ratio, mais l\'actionnaire détient plus d\'actions.',
      limites: 'Les réserves incorporées ne sont plus distribuables sous forme de dividende. Ce n\'est ni un dividende ni un signal de résultat : c\'est une opération de bilan.'
    },
    'regroupement-actions': {
      titre: 'Regroupement d\'actions',
      quoi: 'L\'inverse d\'un fractionnement : plusieurs actions anciennes sont échangées contre une action nouvelle (1 pour 10, par exemple).',
      formule: 'Ratio < 1 (1 pour 10 → 0,1). Cours d\'avant ÷ ratio, donc multiplié.',
      lecture: 'Utilisé pour relever un cours devenu trop bas. Neutre pour la valeur.',
      limites: 'Un regroupement est parfois le signe d\'un titre en difficulté : lisez l\'historique du cours avant de conclure.'
    },
    'augmentation-capital-numeraire': {
      titre: 'Augmentation de capital en numéraire',
      quoi: 'La société émet des actions nouvelles contre de l\'argent frais, souvent proposées d\'abord aux actionnaires existants (droits de souscription).',
      formule: 'Nouvelles actions × prix d\'émission (nominal + prime). Le nombre d\'actions augmente et les fonds propres aussi.',
      lecture: 'Renforce les fonds propres (utile pour respecter les ratios prudentiels d\'une banque). Si l\'actionnaire ne souscrit pas, sa part diminue : c\'est une dilution.',
      limites: 'Contrairement à un fractionnement, le BPA et le cours d\'avant ne sont pas retraités : l\'entreprise a réellement reçu des fonds et le bénéfice se répartit sur plus d\'actions.'
    }
  };

  global.TCMemoData = M;
})(typeof window !== 'undefined' ? window : globalThis);
