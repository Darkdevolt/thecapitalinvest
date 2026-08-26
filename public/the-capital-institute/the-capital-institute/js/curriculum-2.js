/* ═══════════════════════════════════════════════════════════════════
   THE CAPITAL INSTITUTE
   curriculum-2.js : parcours 4 à 6.

   Analyse fondamentale, analyse technique, puis gestion du risque et
   psychologie. Le dernier parcours est délibérément placé en fin de
   cursus mais il est le plus déterminant : on peut réussir avec une
   analyse médiocre et une bonne gestion du risque, jamais l'inverse.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var C = global.TCI_CURRICULUM = global.TCI_CURRICULUM || [];

  /* ═══════════════════════════════════════════════════════════════
     PARCOURS 4 — L'ANALYSE FONDAMENTALE
     ═══════════════════════════════════════════════════════════════ */

  C.push({
    id: 'fondamentale',
    titre: 'L\'analyse fondamentale',
    sous_titre: 'Estimer ce qu\'une entreprise vaut, et le comparer à ce qu\'elle coûte',
    niveau: 'Intermédiaire',
    duree: '3 h 30',
    resume: 'Des ratios aux méthodes de valorisation. Le but n\'est pas de trouver le bon chiffre — il n\'existe pas — ' +
      'mais de construire un raisonnement dont on peut discuter chaque hypothèse.',
    lecons: [

      {
        id: 'f1',
        titre: 'Rentabilité : ce que l\'entreprise sait faire',
        objectifs: [
          'Distinguer les différents niveaux de marge',
          'Comprendre le ROE et sa décomposition',
          'Éviter les comparaisons trompeuses entre secteurs'
        ],
        sections: [
          {
            t: 'Les marges, et pourquoi elles ne se comparent qu\'entre pairs',
            p: [
              'Une marge rapporte un niveau de résultat au chiffre d\'affaires. La marge brute d\'exploitation mesure la rentabilité du métier avant financement et impôt. La marge nette mesure ce qui reste in fine pour les actionnaires.',
              'Le niveau absolu n\'a aucun sens hors de son secteur. Une distribution alimentaire à 2 % de marge nette peut être remarquablement gérée ; un opérateur télécom à 15 % peut être en difficulté. Ce qui compte, c\'est la comparaison avec les concurrents directs et l\'évolution dans le temps.',
              'La stabilité vaut souvent mieux que le niveau. Une marge de 8 % tenue pendant dix ans révèle un pouvoir de fixation des prix et une maîtrise des coûts. Une marge qui oscille entre 3 et 18 % révèle une entreprise à la merci de facteurs qu\'elle ne contrôle pas.'
            ]
          },
          {
            t: 'Le ROE, ratio central',
            p: [
              'La rentabilité des capitaux propres rapporte le résultat net à ce que les actionnaires ont laissé dans l\'entreprise. Elle répond à la question la plus directe qui soit : que rapporte annuellement l\'argent des actionnaires ?',
              'Au-dessus de 15 % durablement, l\'entreprise crée de la valeur. En dessous du coût du capital — souvent 12 à 15 % sur un marché émergent — elle en détruit, même si elle est bénéficiaire comptablement. Une société qui gagne 5 % là où ses actionnaires exigent 14 % appauvrit ses propriétaires chaque année.',
              'Le ROE souffre cependant d\'un défaut majeur : il peut être gonflé artificiellement par la dette. C\'est pourquoi on ne le lit jamais seul.'
            ]
          },
          {
            t: 'La décomposition de DuPont',
            p: [
              'Le ROE se décompose en trois facteurs : la marge nette, la rotation des actifs, et le levier financier. Autrement dit : combien je gagne sur chaque franc vendu, combien je vends avec chaque franc d\'actif, et combien d\'actifs je contrôle avec chaque franc de capitaux propres.',
              'Deux sociétés au ROE identique de 18 % peuvent être radicalement différentes. La première dégage 15 % de marge avec peu de dette ; la seconde dégage 3 % de marge avec un levier de six. La première mérite une prime, la seconde une décote, et le ROE seul ne permet pas de les distinguer.',
              'Cette décomposition est l\'outil le plus efficace pour comprendre d\'où vient réellement une performance. Elle prend trois minutes et évite des erreurs coûteuses.'
            ]
          }
        ],
        attention: 'Un ROE spectaculaire obtenu avec un levier élevé n\'est pas une performance mais un pari. En cas de retournement, le même levier amplifie les pertes exactement comme il amplifiait les gains.',
        retenir: [
          'Les marges ne se comparent qu\'entre concurrents du même secteur.',
          'La stabilité d\'une marge vaut souvent mieux que son niveau.',
          'Le ROE mesure ce que rapporte l\'argent des actionnaires ; sous le coût du capital, il détruit de la valeur.',
          'La décomposition de DuPont révèle si le ROE vient de la marge, de la rotation ou de la dette.'
        ]
      },

      {
        id: 'f2',
        titre: 'Solidité : l\'entreprise peut-elle encaisser un choc',
        objectifs: [
          'Mesurer l\'endettement avec les bons ratios',
          'Comprendre le lien entre dette et cyclicité',
          'Repérer les structures financières fragiles'
        ],
        sections: [
          {
            t: 'Trois ratios suffisent',
            p: [
              'Le levier financier rapporte la dette aux capitaux propres. En dessous de 0,5, la structure est prudente. Au-delà de 1, la dette dépasse les fonds propres et la société devient sensible aux taux comme aux à-coups d\'activité.',
              'L\'autonomie financière rapporte les capitaux propres au total du bilan. Au-dessus de 40 %, l\'indépendance est confortable. Sous 20 %, la société dépend étroitement de ses créanciers pour survivre.',
              'La dette nette rapportée au résultat brut d\'exploitation indique combien d\'années de résultat seraient nécessaires pour tout rembourser. Sous deux ans, c\'est confortable. Au-delà de quatre, la marge de manœuvre disparaît.'
            ]
          },
          {
            t: 'Dette et cyclicité, la combinaison dangereuse',
            p: [
              'Le niveau d\'endettement acceptable dépend entièrement de la régularité des flux. Un opérateur télécom encaisse des abonnements chaque mois : il peut porter une dette importante sans risque excessif. Un producteur agricole dépend des cours mondiaux et de la pluviométrie : la même dette devient une menace.',
              'La question à se poser n\'est jamais « cette dette est-elle élevée ? » mais « que se passe-t-il si le chiffre d\'affaires baisse de 30 % pendant deux ans ? ». Si la réponse est que la société ne peut plus payer ses intérêts, la dette est trop élevée, quel que soit le ratio affiché.',
              'C\'est un exercice mental qui prend une minute et qui a évité davantage de pertes que n\'importe quel modèle sophistiqué.'
            ]
          },
          {
            t: 'Le cas particulier des banques',
            p: [
              'Une banque affiche structurellement une autonomie financière de 8 à 12 %, ce qui affolerait pour un industriel. C\'est normal : son métier consiste à collecter des dépôts, qui sont des dettes, pour les prêter.',
              'On l\'évalue donc avec d\'autres critères : le ratio de solvabilité réglementaire, la qualité du portefeuille de crédits mesurée par la part des créances douteuses, le coût du risque et la marge d\'intérêt.',
              'Transposer les critères industriels à une banque conduit à conclure qu\'elle est au bord de la faillite alors qu\'elle est parfaitement saine. C\'est une erreur fréquente sur la BRVM, où le secteur financier occupe une place importante.'
            ]
          }
        ],
        retenir: [
          'Trois ratios : levier, autonomie financière, dette nette sur résultat brut.',
          'Le niveau acceptable dépend de la régularité des flux, pas d\'un seuil universel.',
          'Testez mentalement une baisse de 30 % du chiffre d\'affaires sur deux ans.',
          'Les banques s\'évaluent avec d\'autres critères que les industriels.'
        ]
      },

      {
        id: 'f3',
        titre: 'Les multiples de valorisation',
        objectifs: [
          'Utiliser le PER sans se tromper',
          'Connaître les multiples alternatifs et leurs usages',
          'Comprendre pourquoi un multiple bas n\'est pas une occasion'
        ],
        sections: [
          {
            t: 'Le PER et ses pièges',
            p: [
              'Le rapport cours sur bénéfice indique combien d\'années de bénéfice actuel représente le prix payé. Un PER de 12 signifie qu\'au rythme actuel, il faudrait douze ans de bénéfices pour rembourser le prix de l\'action.',
              'C\'est le multiple le plus utilisé et le plus mal utilisé. Il n\'a aucun sens si le bénéfice est négatif ou exceptionnel. Il ignore totalement la dette : deux sociétés au même PER peuvent présenter des risques opposés. Et il compare mal des sociétés dont les perspectives de croissance diffèrent.',
              'Le seul PER qui informe est celui qu\'on compare à trois références : les concurrents directs, l\'historique du titre lui-même, et le taux de croissance attendu des bénéfices. Isolé, il ne dit rien.'
            ]
          },
          {
            t: 'Les multiples alternatifs',
            p: [
              'La valeur d\'entreprise rapportée au résultat brut d\'exploitation neutralise les différences de structure financière et de fiscalité. C\'est le multiple des professionnels du rachat, plus rigoureux que le PER pour comparer deux sociétés.',
              'Le cours rapporté à l\'actif net convient aux sociétés à forte assise d\'actifs, notamment les banques. Il faut impérativement le croiser avec le ROE : un actif net faiblement rentable mérite d\'être décoté, et un rapport inférieur à 1 est alors justifié plutôt qu\'aubaine.',
              'Le cours rapporté au flux de trésorerie libre est sans doute le plus honnête, puisqu\'il rapporte le prix à de l\'argent réel plutôt qu\'à un résultat comptable. Son défaut est la volatilité du flux libre d\'une année à l\'autre.'
            ]
          },
          {
            t: 'Pourquoi un multiple bas n\'est pas un signal d\'achat',
            p: [
              'Un titre se paie peu cher pour une raison. Parfois cette raison est mauvaise et le marché se trompe : c\'est l\'occasion recherchée. Le plus souvent la raison est excellente : la société perd des parts de marché, son secteur décline, sa gouvernance inquiète, sa liquidité est nulle.',
              'On appelle piège de valeur ces sociétés perpétuellement bon marché qui le restent, et dont le cours baisse aussi vite que les bénéfices. Le multiple ne se normalise jamais parce que le dénominateur s\'effondre.',
              'La question n\'est donc jamais « ce titre est-il bon marché ? » mais « pourquoi est-il bon marché, et cette raison est-elle appelée à disparaître ? ». Si vous ne savez pas répondre, vous ne savez pas ce que vous achetez.'
            ]
          }
        ],
        attention: 'Un PER de 4 sur une valeur qui ne cote que deux jours par semaine n\'est pas une occasion : c\'est le prix de l\'illiquidité. Le marché escompte correctement le fait que vous ne pourrez pas sortir.',
        retenir: [
          'Le PER ne s\'interprète que par comparaison : concurrents, historique, croissance.',
          'La valeur d\'entreprise sur résultat brut neutralise la structure financière.',
          'Le cours sur actif net doit toujours être croisé avec le ROE.',
          'Un multiple bas appelle une explication, pas un ordre d\'achat.'
        ]
      },

      {
        id: 'f4',
        titre: 'L\'actualisation des flux',
        objectifs: [
          'Comprendre le principe de l\'actualisation',
          'Construire un DCF et identifier ses hypothèses critiques',
          'Utiliser la sensibilité plutôt que le résultat'
        ],
        sections: [
          {
            t: 'Pourquoi actualiser',
            p: [
              'Mille francs aujourd\'hui valent plus que mille francs dans cinq ans, parce qu\'on peut les placer, parce que l\'inflation les érode, et parce que la promesse future peut ne pas être tenue. Actualiser consiste à ramener un montant futur à sa valeur d\'aujourd\'hui en le divisant par un taux qui reflète ces trois éléments.',
              'La valeur d\'une entreprise est donc la somme actualisée de toute la trésorerie qu\'elle produira à l\'avenir. C\'est la seule méthode qui raisonne en valeur intrinsèque plutôt qu\'en comparaison : elle ne demande à personne d\'autre ce que la société vaut.',
              'C\'est aussi la plus exigeante, parce qu\'elle oblige à formuler explicitement ce qu\'on croit de l\'avenir. C\'est précisément là son intérêt pédagogique.'
            ]
          },
          {
            t: 'Les trois hypothèses qui décident de tout',
            p: [
              'Le taux d\'actualisation, d\'abord. Il représente le rendement exigé compte tenu du risque, et se construit à partir du taux sans risque, du beta et de la prime de risque du marché. Sur une place étroite, on y ajoute une prime d\'illiquidité et une prime de taille, faute de quoi on surévalue systématiquement les petites capitalisations.',
              'La croissance des flux ensuite, sur l\'horizon de prévision. Cinq ans est un compromis raisonnable : au-delà, personne ne sait rien.',
              'La croissance perpétuelle enfin, celle qu\'on suppose au-delà de l\'horizon. Elle ne peut pas excéder durablement la croissance de l\'économie, sans quoi la société finirait mathématiquement par représenter le produit intérieur brut entier. Deux à trois pour cent est la fourchette usuelle.'
            ]
          },
          {
            t: 'La valeur terminale, éléphant dans la pièce',
            p: [
              'La valeur terminale, c\'est-à-dire tout ce qui vient après l\'horizon explicite, représente couramment 60 à 80 % du résultat total. Autrement dit, l\'essentiel de la valorisation repose sur une période qu\'on n\'a même pas modélisée.',
              'Ce n\'est pas un défaut de la méthode, c\'est une réalité économique : une entreprise durable produit l\'essentiel de sa trésorerie au-delà de cinq ans. Mais il faut le savoir et l\'afficher. Au-delà de 85 %, le DCF n\'apporte presque rien de plus qu\'un multiple appliqué à la dernière année.',
              'La conclusion pratique est que le chiffre final d\'un DCF ne doit jamais être présenté seul. Ce qui compte, c\'est la matrice de sensibilité : comment la valeur bouge quand on fait varier le taux et la croissance perpétuelle. Un point de taux déplace couramment la valeur de 20 à 30 %.'
            ]
          },
          {
            t: 'Le DCF inversé, l\'exercice le plus utile',
            p: [
              'Plutôt que de calculer une valeur et de la comparer au cours, on peut retourner la démarche : quelle croissance le cours actuel suppose-t-il déjà ?',
              'La question devient alors concrète et vérifiable. Si le cours suppose 18 % de croissance annuelle pendant cinq ans, on peut se demander si cette société, sur ce marché, avec ces concurrents, peut réellement tenir ce rythme. C\'est une question d\'industrie, pas de finance.',
              'Cet exercice a un mérite supplémentaire : il évite l\'illusion de précision. On ne prétend plus savoir ce que la société vaut, on constate ce que le marché suppose, et on juge cette supposition.'
            ]
          }
        ],
        attention: 'Un DCF ne prouve rien. Il structure une réflexion et rend explicites des hypothèses. Quiconque vous présente une valeur issue d\'un DCF sans sa matrice de sensibilité vous cache l\'essentiel de l\'information.',
        retenir: [
          'Actualiser ramène des flux futurs à leur valeur d\'aujourd\'hui.',
          'Trois hypothèses décident de tout : taux, croissance, croissance perpétuelle.',
          'La valeur terminale pèse 60 à 80 % du total ; au-delà de 85 %, la méthode perd son intérêt.',
          'La matrice de sensibilité est plus utile que le chiffre final.',
          'Le DCF inversé transforme une question de finance en question d\'industrie.'
        ]
      },

      {
        id: 'f5',
        titre: 'Valoriser par les dividendes',
        objectifs: [
          'Appliquer le modèle de Gordon-Shapiro',
          'Juger la soutenabilité d\'un dividende',
          'Reconnaître les rendements qui sont des avertissements'
        ],
        sections: [
          {
            t: 'Le modèle de Gordon-Shapiro',
            p: [
              'Si l\'on suppose qu\'une société versera indéfiniment un dividende croissant à un rythme constant, sa valeur se ramène à une formule d\'une simplicité désarmante : le dividende de l\'année prochaine divisé par la différence entre le rendement exigé et le taux de croissance.',
              'Cette méthode convient particulièrement aux sociétés matures qui distribuent régulièrement, ce qui décrit une bonne partie de la cote BRVM. Elle est transparente : trois paramètres, aucun modèle caché.',
              'Elle devient absurde dès que la croissance approche le rendement exigé — la valeur tend alors vers l\'infini — et inapplicable aux sociétés qui ne distribuent pas.'
            ]
          },
          {
            t: 'La soutenabilité avant le rendement',
            p: [
              'Le taux de distribution, part du bénéfice reversée aux actionnaires, est l\'indicateur clé. Sous 40 %, la société conserve de quoi financer sa croissance et son dividende est sécurisé. Au-delà de 80 %, la marge de manœuvre disparaît : un exercice difficile suffit à contraindre une coupe.',
              'Au-dessus de 100 %, le dividende est financé par la trésorerie accumulée ou par la dette. Cela peut se justifier une année ; sur trois ans, c\'est intenable.',
              'Vérifiez aussi la couverture par le flux de trésorerie libre, pas seulement par le bénéfice. Un dividende couvert par un bénéfice comptable mais pas par de l\'argent réel est un dividende emprunté.'
            ]
          },
          {
            t: 'Un rendement élevé est souvent un avertissement',
            p: [
              'Le rendement se calcule en divisant le dividende par le cours. Il peut donc grimper pour deux raisons opposées : parce que le dividende augmente, ce qui est excellent, ou parce que le cours s\'effondre, ce qui l\'est beaucoup moins.',
              'Un rendement de 15 % sur une place où la moyenne tourne autour de 6 % signale presque toujours que le marché anticipe une coupe. Les investisseurs qui achètent pour ce rendement encaissent un dividende, puis subissent la coupe et la baisse du cours qui l\'accompagne.',
              'Le réflexe est de toujours regarder le rendement avec le taux de distribution et l\'historique de versement. Un rendement de 5 % versé sans interruption depuis quinze ans vaut infiniment mieux qu\'un rendement de 12 % versé une fois.'
            ]
          }
        ],
        attention: 'Un dividende n\'est jamais garanti. Il est décidé chaque année par l\'assemblée générale et peut être supprimé sans préavis. Construire un revenu sur un seul titre à haut rendement est la manière la plus courante de perdre à la fois le revenu et le capital.',
        retenir: [
          'Gordon-Shapiro convient aux sociétés matures et distributrices.',
          'Le taux de distribution mesure la soutenabilité mieux que le rendement.',
          'Vérifiez la couverture par le flux libre, pas seulement par le bénéfice.',
          'Un rendement anormalement élevé signale généralement une coupe anticipée.'
        ]
      },

      {
        id: 'f6',
        titre: 'Construire une thèse d\'investissement',
        objectifs: [
          'Structurer un raisonnement d\'achat en quelques points vérifiables',
          'Définir à l\'avance ce qui invaliderait la thèse',
          'Tenir un journal de décision'
        ],
        sections: [
          {
            t: 'Cinq questions, pas davantage',
            p: [
              'Comment cette société gagne-t-elle de l\'argent, en trois phrases ? Qu\'est-ce qui la protège de ses concurrents ? Sa situation financière lui permet-elle de traverser deux mauvaises années ? Le prix payé suppose-t-il des choses raisonnables ? Puis-je sortir de cette position si je change d\'avis ?',
              'Si l\'une de ces réponses manque, la thèse n\'est pas prête. Ce n\'est pas une question de temps passé : on peut y répondre en une heure sur une société simple, et jamais sur une société qu\'on ne comprend pas.',
              'La dernière question est celle qu\'on oublie le plus souvent, et c\'est la plus importante sur un marché étroit.'
            ]
          },
          {
            t: 'Définir l\'invalidation avant d\'acheter',
            p: [
              'Une thèse solide énonce ce qui la démentirait. « Je vends si la marge d\'exploitation passe sous 8 % deux exercices de suite » est une invalidation. « Je vends si ça baisse trop » n\'en est pas une.',
              'L\'écrire avant d\'acheter change tout, parce qu\'on ne raisonne plus de la même façon une fois qu\'on est engagé. Après l\'achat, chaque mauvaise nouvelle trouve une explication rassurante : c\'est le biais de confirmation, et personne n\'y échappe par la seule force de la volonté.',
              'L\'invalidation doit être vérifiable sans interprétation. Un chiffre, un seuil, une durée.'
            ]
          },
          {
            t: 'Le journal de décision',
            p: [
              'Notez pour chaque opération la date, le titre, le prix, la thèse en cinq lignes, l\'invalidation, et le degré de confiance. Rien de plus.',
              'Au bout de deux ans, relisez. Vous découvrirez des régularités que vous n\'auriez jamais soupçonnées : peut-être que vos meilleures opérations sont celles où vous étiez le moins confiant, ou que vous perdez systématiquement sur un certain type de dossier.',
              'C\'est le seul outil qui permette de progresser réellement, parce que la mémoire réécrit systématiquement le passé en notre faveur. Sans trace écrite, on se souvient d\'avoir eu raison.'
            ]
          }
        ],
        retenir: [
          'Cinq questions : le métier, la protection, la solidité, le prix, la sortie.',
          'L\'invalidation s\'écrit avant l\'achat et doit être vérifiable sans interprétation.',
          'Le biais de confirmation s\'installe dès qu\'on est engagé.',
          'Le journal de décision est le seul outil de progression réel.'
        ]
      }
    ]
  });

  /* ═══════════════════════════════════════════════════════════════
     PARCOURS 5 — L'ANALYSE TECHNIQUE
     ═══════════════════════════════════════════════════════════════ */

  C.push({
    id: 'technique',
    titre: 'L\'analyse technique',
    sous_titre: 'Lire un graphique sans lui faire dire n\'importe quoi',
    niveau: 'Intermédiaire',
    duree: '3 h',
    resume: 'Les outils graphiques, ce qu\'ils mesurent réellement, et les limites qu\'il faut connaître ' +
      'avant de leur confier une décision.',
    lecons: [

      {
        id: 't1',
        titre: 'Ce que l\'analyse technique prétend faire',
        objectifs: [
          'Comprendre les postulats de l\'analyse technique',
          'Situer honnêtement sa valeur et ses limites',
          'Savoir quand elle est utile et quand elle ne l\'est pas'
        ],
        sections: [
          {
            t: 'Trois postulats',
            p: [
              'Le premier : tout ce qui est connu est déjà dans le prix. Inutile de chercher l\'information, elle est intégrée. Le second : les prix évoluent en tendances plutôt qu\'aléatoirement. Le troisième : les configurations se répètent, parce que les comportements humains face à la peur et à l\'avidité se répètent.',
              'Ces postulats sont discutables et discutés. Le premier est une version forte de l\'efficience des marchés, que les bulles contredisent régulièrement. Le second est partiellement vérifié statistiquement. Le troisième relève davantage de l\'observation que de la démonstration.',
              'Il faut donc aborder l\'analyse technique pour ce qu\'elle est : un ensemble d\'outils de lecture, utile pour situer un mouvement et calibrer une décision, mais qui ne constitue pas une science prédictive.'
            ]
          },
          {
            t: 'Ce qu\'elle fait bien',
            p: [
              'Elle situe un cours dans son propre historique : proche d\'un plus haut, d\'un support, dans une zone d\'indécision. Cette information est objective et utile.',
              'Elle discipline. Définir à l\'avance un niveau d\'invalidation, une taille de position et un objectif transforme une intuition en décision structurée. Ce bénéfice-là est réel, quelle que soit la valeur prédictive des indicateurs.',
              'Elle gère le timing. On peut avoir raison sur une société et acheter au pire moment. Un cadrage graphique évite d\'entrer sur un titre en chute libre simplement parce qu\'il paraît bon marché.'
            ]
          },
          {
            t: 'Ce qu\'elle ne fait pas',
            p: [
              'Elle ne prédit pas l\'avenir. Aucun indicateur ne connaît la suite ; tous décrivent le passé sous une forme condensée.',
              'Elle ne remplace pas l\'analyse de l\'entreprise. Un graphique parfait sur une société qui perd de l\'argent reste une société qui perd de l\'argent.',
              'Et elle fonctionne mal sur les marchés étroits, ce qui est une limite majeure sur la BRVM. La plupart des indicateurs supposent une cotation continue et des volumes réguliers. Sur un titre qui ne cote que trois jours sur dix, un RSI à 14 séances couvre presque deux mois calendaires, et son interprétation habituelle ne tient plus.'
            ]
          }
        ],
        attention: 'Sur un titre qui ne cote pas tous les jours, la plupart des indicateurs techniques perdent leur sens. Vérifiez toujours la part de séances effectivement traitées avant d\'appliquer une grille de lecture importée de marchés liquides.',
        retenir: [
          'Trois postulats : le prix intègre tout, les tendances existent, les configurations se répètent.',
          'Elle situe, discipline et cadre le timing.',
          'Elle ne prédit pas et ne remplace pas l\'analyse de l\'entreprise.',
          'Elle fonctionne mal sur les titres peu liquides.'
        ]
      },

      {
        id: 't2',
        titre: 'Chandeliers, tendances et niveaux',
        objectifs: [
          'Lire un chandelier japonais',
          'Identifier une tendance et ses degrés',
          'Repérer supports et résistances'
        ],
        sections: [
          {
            t: 'Le chandelier, quatre chiffres en une figure',
            p: [
              'Chaque chandelier résume une séance par quatre chiffres : ouverture, plus haut, plus bas, clôture. Le corps relie l\'ouverture à la clôture, les mèches marquent les extrêmes atteints en séance.',
              'Un long corps traduit une direction assumée du début à la fin. Une longue mèche basse traduit un rejet : les vendeurs ont fait baisser le cours, les acheteurs ont repris la main avant la clôture. Un corps minuscule traduit l\'indécision.',
              'Les configurations nommées — marteau, avalement, étoile du soir — ne sont que des combinaisons de ces éléments. Leur valeur prédictive isolée est faible ; leur valeur augmente nettement lorsqu\'elles apparaissent sur un niveau technique important et avec un volume significatif.'
            ]
          },
          {
            t: 'Tendance : trois degrés',
            p: [
              'Une tendance haussière se définit par une succession de sommets et de creux de plus en plus hauts. La définition est mécanique et ne demande aucune interprétation : elle est vraie ou fausse.',
              'Il faut distinguer trois horizons. La tendance de fond se lit sur plusieurs années, la tendance intermédiaire sur quelques mois, la tendance courte sur quelques semaines. Elles peuvent être contradictoires, et c\'est même la situation la plus fréquente.',
              'La règle pratique consiste à identifier la tendance de fond avant tout, puis à n\'utiliser les horizons courts que pour affiner le timing. Aller contre la tendance de fond en se fondant sur un signal de court terme est la source d\'erreur la plus banale.'
            ]
          },
          {
            t: 'Supports et résistances',
            p: [
              'Un support est un niveau où les acheteurs se sont manifestés à plusieurs reprises, arrêtant la baisse. Une résistance est son symétrique à la hausse. Ce ne sont pas des lignes magiques : ce sont des zones où des ordres se concentrent, souvent parce que des intervenants y ont acheté ou vendu par le passé.',
              'Plus un niveau a été touché sans céder, plus il est significatif. Mais attention au paradoxe : un niveau très souvent testé finit généralement par céder, chaque test consommant une partie des ordres qui le défendaient.',
              'Une fois cassé, un support devient fréquemment une résistance, et réciproquement. Ce basculement s\'explique simplement : ceux qui ont acheté au support et subi la baisse cherchent à revendre à l\'équilibre lorsque le cours y revient.'
            ]
          }
        ],
        retenir: [
          'Le chandelier résume quatre chiffres ; les mèches racontent le rapport de force en séance.',
          'Une tendance haussière est une succession de sommets et creux plus hauts.',
          'Trois horizons coexistent et se contredisent souvent : privilégiez la tendance de fond.',
          'Un support cassé devient une résistance, et réciproquement.'
        ]
      },

      {
        id: 't3',
        titre: 'Moyennes mobiles et suivi de tendance',
        objectifs: [
          'Choisir une moyenne mobile adaptée à son horizon',
          'Interpréter les croisements sans excès de confiance',
          'Comprendre pourquoi elles échouent en marché latéral'
        ],
        sections: [
          {
            t: 'Lisser pour voir la direction',
            p: [
              'Une moyenne mobile calcule la moyenne des cours sur les N dernières séances, recalculée chaque jour. Elle efface le bruit quotidien pour ne garder que la direction de fond.',
              'La moyenne simple traite toutes les séances de façon égale. La moyenne exponentielle donne plus de poids aux séances récentes, ce qui la rend plus réactive mais aussi plus bruitée. Le choix entre les deux relève du compromis entre réactivité et fiabilité, pas de la supériorité de l\'une sur l\'autre.',
              'La longueur détermine l\'horizon : vingt séances pour le court terme, cinquante pour l\'intermédiaire, deux cents pour le fond. La moyenne à deux cents séances est particulièrement suivie et acquiert de ce fait un caractère partiellement auto-réalisateur.'
            ]
          },
          {
            t: 'Croisements et empilement',
            p: [
              'Quand une moyenne courte passe au-dessus d\'une moyenne longue, on parle de croisement doré ; l\'inverse est le croisement de la mort. Ces signaux sont lents mais structurants : ils confirment un changement de régime plutôt qu\'ils ne l\'anticipent.',
              'L\'empilement est plus informatif que le croisement isolé. Cours au-dessus de la moyenne à vingt, elle-même au-dessus de celle à cinquante, elle-même au-dessus de celle à deux cents : la hiérarchie est haussière sur tous les horizons, ce qui est une configuration solide.',
              'À l\'inverse, des moyennes enchevêtrées et plates signalent qu\'il n\'y a pas de tendance. C\'est une information en soi, et souvent la meilleure raison de ne rien faire.'
            ]
          },
          {
            t: 'Le talon d\'Achille',
            p: [
              'En marché sans direction, les moyennes se croisent sans cesse et génèrent des signaux contradictoires. Chaque faux signal coûte des frais et un peu de confiance.',
              'C\'est pourquoi on ne les utilise jamais seules. Un filtre de force de tendance — l\'ADX par exemple — permet d\'écarter les périodes où le suivi de tendance n\'a aucune chance de fonctionner. Sous 20 d\'ADX, la règle est de ne pas suivre les croisements.',
              'Une moyenne mobile regarde en arrière par construction. Elle ne peut donc jamais anticiper un retournement : elle le constate avec retard. C\'est le prix du lissage, et aucun réglage ne le supprime.'
            ]
          }
        ],
        retenir: [
          'Vingt séances pour le court terme, cinquante pour l\'intermédiaire, deux cents pour le fond.',
          'L\'empilement des moyennes est plus informatif qu\'un croisement isolé.',
          'Des moyennes plates et enchevêtrées signalent l\'absence de tendance.',
          'Un filtre de force de tendance évite les faux signaux en marché latéral.'
        ]
      },

      {
        id: 't4',
        titre: 'Oscillateurs et divergences',
        objectifs: [
          'Interpréter le RSI et le MACD correctement',
          'Comprendre pourquoi surachat ne signifie pas vendre',
          'Repérer et utiliser une divergence'
        ],
        sections: [
          {
            t: 'Le RSI et le contresens le plus fréquent',
            p: [
              'Le RSI compare l\'ampleur moyenne des hausses à celle des baisses sur quatorze séances, sur une échelle de 0 à 100. Au-dessus de 70, les acheteurs se sont beaucoup dépensés ; sous 30, les vendeurs.',
              'Le contresens universel consiste à vendre parce que le RSI dépasse 70. En tendance haussière forte, le RSI peut rester au-dessus de 70 pendant des mois : c\'est même la signature d\'une tendance saine. Vendre à ce signal revient à sortir systématiquement des meilleures hausses.',
              'Le seuil ne devient exploitable qu\'en marché sans tendance, où le cours oscille effectivement entre deux bornes. En tendance, le RSI se lit autrement : par ses divergences.'
            ]
          },
          {
            t: 'Le MACD et l\'histogramme',
            p: [
              'Le MACD mesure l\'écart entre deux moyennes exponentielles et le compare à sa propre moyenne. Le croisement des deux lignes donne le signal classique, avec le même défaut que tous les croisements : il arrive tard.',
              'L\'histogramme, différence entre les deux lignes, est plus précieux. Il mesure l\'accélération : quand il se rétrécit alors que le cours continue de monter, le mouvement perd de sa force avant même que le cours ne se retourne.',
              'Ses valeurs dépendent du niveau du cours : on ne compare jamais le MACD de deux titres entre eux, uniquement sa forme sur un même titre.'
            ]
          },
          {
            t: 'Les divergences',
            p: [
              'Une divergence baissière apparaît quand le cours fait un sommet plus haut mais que l\'oscillateur fait un sommet plus bas. Le mouvement se poursuit avec moins de force qu\'avant.',
              'C\'est probablement le signal le plus utile de toute l\'analyse technique, et le plus mal employé. Une divergence est un avertissement, jamais un ordre de vente : elle peut se prolonger très longtemps avant de se résoudre, et certaines ne se résolvent jamais.',
              'La règle est d\'attendre la confirmation par une cassure de niveau. La divergence prépare l\'attention, la cassure déclenche l\'action. Prises isolément, les divergences font perdre de l\'argent.'
            ]
          }
        ],
        attention: 'Un RSI au-dessus de 70 dans une tendance haussière établie n\'est pas un signal de vente. C\'est la marque d\'une tendance en bonne santé. Le seuil ne s\'interprète que dans un marché sans direction.',
        retenir: [
          'Le RSI en zone extrême ne s\'interprète qu\'en marché sans tendance.',
          'L\'histogramme du MACD mesure l\'accélération et se retourne avant les lignes.',
          'Une divergence est un avertissement, pas un signal d\'entrée.',
          'La divergence prépare l\'attention, la cassure de niveau déclenche l\'action.'
        ]
      },

      {
        id: 't5',
        titre: 'Volume et volatilité',
        objectifs: [
          'Utiliser le volume comme validation',
          'Comprendre l\'ATR et son usage pour les stops',
          'Repérer les compressions de volatilité'
        ],
        sections: [
          {
            t: 'Le volume valide le prix',
            p: [
              'Une cassure de résistance accompagnée d\'un volume double de la moyenne est crédible : de l\'argent réel a changé de mains à ce niveau. La même cassure sans volume est suspecte.',
              'Le chiffre brut ne dit rien : c\'est le rapport au volume moyen des vingt dernières séances qui informe. Un volume de dix mille titres est énorme sur une valeur qui en traite mille, et négligeable sur une valeur qui en traite cent mille.',
              'Sur la BRVM, une précaution supplémentaire s\'impose : un volume nul n\'est pas une information de marché, il signifie qu\'aucune transaction n\'a eu lieu. Et un volume exceptionnel peut correspondre à une seule transaction de bloc négociée hors marché, sans rapport avec un mouvement de fond.'
            ]
          },
          {
            t: 'L\'ATR, mesure du bruit ordinaire',
            p: [
              'L\'amplitude vraie moyenne mesure de combien un titre bouge en moyenne dans une séance, écarts d\'ouverture compris. C\'est la mesure de référence du bruit normal.',
              'Son usage principal est le calibrage des stops. Un stop placé plus près que la moyenne des variations quotidiennes sera emporté par le mouvement ordinaire du titre, sans qu\'aucune thèse ait été invalidée. On raisonne donc en multiples d\'ATR, typiquement deux à trois.',
              'Rapporté au cours, il permet aussi de comparer le risque de deux titres de prix très différents. Un titre à 2 % d\'ATR est deux fois plus agité qu\'un titre à 1 %, quel que soit son cours.'
            ]
          },
          {
            t: 'Les compressions',
            p: [
              'Quand les bandes de Bollinger se resserrent fortement, la volatilité s\'est comprimée. Historiquement, ces phases de compression précèdent des phases d\'expansion : le marché accumule de l\'énergie.',
              'La compression ne dit rien du sens de la sortie. C\'est une information sur l\'amplitude à venir, pas sur la direction. Ceux qui parient sur un sens pendant une compression parient à pile ou face avec un enjeu amplifié.',
              'L\'usage correct consiste à préparer les deux scénarios, à définir les niveaux qui déclencheraient chacun, et à attendre. C\'est frustrant et c\'est efficace.'
            ]
          }
        ],
        retenir: [
          'Le volume se lit en rapport à sa moyenne, jamais en valeur absolue.',
          'Un volume nul signifie absence de transaction, pas stabilité.',
          'Un stop se calibre en multiples d\'ATR, deux à trois typiquement.',
          'Une compression annonce une expansion d\'amplitude, jamais un sens.'
        ]
      },

      {
        id: 't6',
        titre: 'Tester une stratégie honnêtement',
        objectifs: [
          'Comprendre ce qu\'un backtest peut et ne peut pas démontrer',
          'Identifier les biais qui faussent les résultats',
          'Interpréter les indicateurs de performance d\'une stratégie'
        ],
        sections: [
          {
            t: 'Ce qu\'un backtest démontre',
            p: [
              'Un backtest applique mécaniquement des règles à des données passées et compte le résultat. Il donne un ordre de grandeur du taux de réussite, du rapport entre gains et pertes, et de la perte maximale subie.',
              'Ce dernier chiffre est le plus utile de tous. Une stratégie qui rapporte 20 % par an mais impose de traverser une baisse de 45 % ne sera pas tenue par la plupart des gens. Connaître ce chiffre avant de commencer évite d\'abandonner au pire moment.',
              'La comparaison à l\'achat-conservation est indispensable et rarement faite. Beaucoup de stratégies actives, une fois les frais déduits, font moins bien que de ne rien faire. Ce n\'est pas une critique de l\'analyse technique : c\'est un fait empirique qu\'il faut regarder en face.'
            ]
          },
          {
            t: 'Les biais qui faussent tout',
            p: [
              'Le biais d\'optimisation d\'abord : à force d\'essayer des réglages sur les mêmes données, on finit toujours par en trouver un qui produit d\'excellents résultats. Cette découverte ne vaut rien : elle décrit le passé, elle ne prédit rien.',
              'Le biais du survivant ensuite : tester sur les sociétés cotées aujourd\'hui, c\'est ignorer celles qui ont disparu, ce qui embellit mécaniquement les résultats.',
              'Le biais d\'anticipation enfin, plus insidieux : utiliser une information qui n\'était pas disponible au moment de la décision. Entrer à la clôture du jour du signal suppose qu\'on connaissait le signal avant la clôture, ce qui est faux. L\'entrée doit se faire à la séance suivante.'
            ]
          },
          {
            t: 'Lire les résultats',
            p: [
              'Le taux de réussite seul ne dit rien : une stratégie qui gagne huit fois sur dix mais perd gros les deux autres fois peut être perdante. Il faut le croiser avec le rapport entre gain moyen et perte moyenne.',
              'Le facteur de profit rapporte la somme des gains à celle des pertes. Au-dessus de 1,5, la stratégie a une marge. En dessous de 1,2, elle est trop fragile pour survivre à des frais réels.',
              'Enfin, le nombre d\'opérations conditionne toute interprétation. Un taux de réussite calculé sur huit opérations n\'a aucune valeur statistique. En dessous de trente, les résultats relèvent largement du hasard.'
            ]
          }
        ],
        attention: 'Une stratégie testée sur un seul titre et une seule période ne prouve rien, même avec des résultats spectaculaires. Il faut la retrouver sur plusieurs valeurs et plusieurs périodes pour y voir autre chose qu\'un accident.',
        retenir: [
          'La perte maximale est le chiffre le plus utile d\'un backtest.',
          'Comparez systématiquement à l\'achat-conservation.',
          'Trois biais majeurs : optimisation, survivant, anticipation.',
          'En dessous de trente opérations, les résultats relèvent du hasard.'
        ]
      }
    ]
  });

  /* ═══════════════════════════════════════════════════════════════
     PARCOURS 6 — RISQUE, PORTEFEUILLE ET PSYCHOLOGIE
     ═══════════════════════════════════════════════════════════════ */

  C.push({
    id: 'risque',
    titre: 'Risque, portefeuille et psychologie',
    sous_titre: 'Le parcours qui décide réellement du résultat',
    niveau: 'Essentiel',
    duree: '3 h',
    resume: 'On peut réussir avec une analyse médiocre et une bonne gestion du risque. Jamais l\'inverse. ' +
      'C\'est le parcours le plus important du cursus, et celui qu\'on saute le plus souvent.',
    lecons: [

      {
        id: 'r1',
        titre: 'Le dimensionnement des positions',
        objectifs: [
          'Calculer la taille d\'une position en fonction du risque accepté',
          'Comprendre pourquoi cette décision prime sur le choix du titre',
          'Adapter la taille à la liquidité disponible'
        ],
        sections: [
          {
            t: 'La formule',
            p: [
              'La taille d\'une position se calcule, elle ne se décide pas au feeling. Fixez d\'abord le pourcentage de capital que vous acceptez de perdre sur cette opération, typiquement 1 à 2 %. Divisez ce montant par l\'écart entre votre prix d\'entrée et votre niveau d\'invalidation. Le résultat est le nombre de titres.',
              'Sur un capital de cinq millions, en acceptant de risquer 2 %, on accepte de perdre cent mille francs. Si l\'invalidation se situe à cinq cents francs sous le prix d\'entrée, on achète deux cents titres. Pas trois cents parce qu\'on y croit beaucoup, pas cent parce qu\'on hésite.',
              'La conséquence est contre-intuitive : plus l\'invalidation est éloignée, plus la position doit être petite. Un titre volatil, qui demande un stop large, justifie une position réduite, pas une position normale.'
            ]
          },
          {
            t: 'Pourquoi c\'est la décision la plus importante',
            p: [
              'Deux investisseurs peuvent choisir exactement les mêmes titres et obtenir des résultats opposés selon la taille qu\'ils leur donnent. Celui qui met 40 % de son capital sur sa meilleure idée sera éliminé par une seule erreur. Celui qui répartit survivra à une longue série d\'échecs.',
              'La mathématique est brutale : perdre 50 % impose de gagner 100 % pour revenir à l\'équilibre. Perdre 20 % n\'impose que 25 %. Éviter les pertes profondes compte davantage que capter les hausses.',
              'En risquant 2 % par position, on peut se tromper vingt fois de suite et n\'avoir perdu qu\'un tiers de son capital. En risquant 20 %, cinq erreurs suffisent à tout emporter.'
            ]
          },
          {
            t: 'La contrainte de liquidité',
            p: [
              'Sur un marché étroit, un second plafond s\'impose : ne jamais détenir plus de quelques jours de volume moyen sur une valeur. Le calcul de risque peut autoriser mille titres, la liquidité n\'en permettre que trois cents.',
              'C\'est la contrainte la plus contraignante des deux qui s\'applique, toujours. Une position correctement dimensionnée en risque mais impossible à liquider n\'est pas correctement dimensionnée.',
              'Cette règle exclut de fait certaines valeurs des portefeuilles importants. C\'est une limite réelle du marché, qu\'il vaut mieux accepter que contourner.'
            ]
          }
        ],
        attention: 'Le dimensionnement est la seule variable que vous contrôlez entièrement. Vous ne contrôlez ni le marché, ni les résultats des sociétés, ni votre chance. Vous contrôlez combien vous engagez.',
        retenir: [
          'Quantité = (capital × risque accepté) ÷ (entrée − invalidation).',
          'Plus l\'invalidation est éloignée, plus la position doit être petite.',
          'Perdre 50 % impose de gagner 100 % pour revenir à l\'équilibre.',
          'La contrainte de liquidité prime toujours quand elle est plus stricte.'
        ]
      },

      {
        id: 'r2',
        titre: 'Diversifier, vraiment',
        objectifs: [
          'Comprendre ce que la diversification réduit et ce qu\'elle ne réduit pas',
          'Éviter la fausse diversification',
          'Calibrer le nombre de lignes d\'un portefeuille'
        ],
        sections: [
          {
            t: 'Ce qu\'elle réduit',
            p: [
              'Diversifier réduit le risque spécifique, celui qui tient à une entreprise particulière : un incendie d\'usine, une fraude, la perte d\'un contrat majeur. Réparti sur quinze lignes, un accident sur l\'une d\'elles coûte quelques pourcents plutôt que la moitié du capital.',
              'Elle ne réduit pas le risque de marché. Si toute la place baisse de 25 %, un portefeuille diversifié baisse de 25 %. Aucune répartition entre actions ne protège d\'une baisse générale.',
              'C\'est une distinction fondamentale et rarement expliquée. Beaucoup d\'investisseurs se croient protégés par la diversification et découvrent le contraire lors de la première baisse d\'ensemble.'
            ]
          },
          {
            t: 'La fausse diversification',
            p: [
              'Détenir huit banques n\'est pas diversifier. Elles réagissent aux mêmes taux, aux mêmes défauts de crédit, à la même conjoncture régionale. Le portefeuille se comporte comme une seule position, en plus coûteux en frais.',
              'La vraie diversification suppose des activités qui ne réagissent pas aux mêmes facteurs. Sur la BRVM, l\'exercice est difficile : la cote est concentrée sur quelques secteurs, et les économies de l\'union sont corrélées entre elles.',
              'Il faut donc l\'admettre : la diversification sectorielle atteint vite ses limites sur cette place. Cela renforce l\'importance des deux autres protections, le dimensionnement des positions et la détention d\'actifs hors actions.'
            ]
          },
          {
            t: 'Combien de lignes',
            p: [
              'L\'essentiel du bénéfice de la diversification est obtenu vers douze à vingt lignes. Au-delà, chaque ligne supplémentaire n\'apporte presque rien et complique le suivi.',
              'En dessous de huit, le portefeuille reste très dépendant de quelques paris. Au-delà de trente, on ne peut plus suivre sérieusement chaque société, et on se rapproche d\'un indice, en payant des frais individuels.',
              'Une règle complémentaire : aucune ligne ne devrait dépasser 10 à 15 % du portefeuille, quelle que soit la conviction. Les convictions les plus fortes sont statistiquement celles où l\'on se trompe le plus lourdement.'
            ]
          }
        ],
        retenir: [
          'La diversification réduit le risque spécifique, jamais le risque de marché.',
          'Huit banques ne constituent pas un portefeuille diversifié.',
          'Douze à vingt lignes captent l\'essentiel du bénéfice.',
          'Aucune ligne au-delà de 10 à 15 %, quelle que soit la conviction.'
        ]
      },

      {
        id: 'r3',
        titre: 'Horizon, objectifs et fonds d\'urgence',
        objectifs: [
          'Définir un horizon avant de choisir des titres',
          'Comprendre pourquoi le fonds d\'urgence précède tout investissement',
          'Adapter l\'allocation à son échéance'
        ],
        sections: [
          {
            t: 'L\'horizon détermine tout',
            p: [
              'Avant de choisir un titre, il faut savoir quand on aura besoin de cet argent. Un capital dont on aura besoin dans dix-huit mois n\'a rien à faire en actions, quelle que soit la qualité de l\'analyse : dix-huit mois est une durée sur laquelle un marché peut parfaitement baisser de 30 %.',
              'Les actions demandent un horizon d\'au moins cinq ans, idéalement dix. C\'est la durée nécessaire pour que la logique des bénéfices l\'emporte sur celle des humeurs.',
              'Cette règle n\'a rien de théorique. La plupart des pertes définitives ne viennent pas de mauvais choix de titres mais d\'une vente forcée au mauvais moment, par quelqu\'un qui avait besoin de son argent.'
            ]
          },
          {
            t: 'Le fonds d\'urgence est prioritaire',
            p: [
              'Avant tout investissement en actions, il faut disposer de trois à six mois de dépenses courantes, en épargne immédiatement disponible et sans risque.',
              'Ce n\'est pas une précaution morale mais une nécessité mécanique. Sans ce coussin, le premier imprévu — une réparation, une hospitalisation, une perte d\'emploi — vous obligera à vendre vos actions, et statistiquement au pire moment, puisque les difficultés personnelles coïncident souvent avec les difficultés économiques générales.',
              'Un investisseur avec un fonds d\'urgence peut traverser une baisse de 40 % sans rien vendre. Le même sans fonds d\'urgence vend au plus bas. Ce n\'est pas une différence de compétence, c\'est une différence de préparation.'
            ]
          },
          {
            t: 'Ce qu\'on ne devrait jamais investir',
            p: [
              'L\'argent emprunté, d\'abord. Investir à crédit ajoute une contrainte de remboursement à un actif dont les rendements sont incertains dans leur montant comme dans leur calendrier.',
              'L\'argent dont on connaît déjà l\'échéance : frais de scolarité de l\'an prochain, apport pour un logement, mariage prévu.',
              'Et l\'argent dont la perte compromettrait des besoins essentiels. Le montant investi doit pouvoir baisser de moitié sans changer votre vie quotidienne. Si ce n\'est pas le cas, le montant est trop élevé.'
            ]
          }
        ],
        attention: 'Un investisseur contraint de vendre n\'est plus un investisseur : il est un vendeur forcé, et le marché le sait. La préparation financière personnelle compte davantage que la qualité de la sélection.',
        retenir: [
          'Les actions demandent un horizon d\'au moins cinq ans.',
          'Le fonds d\'urgence de trois à six mois précède tout investissement.',
          'Ne jamais investir de l\'argent emprunté ni de l\'argent à échéance connue.',
          'Le montant investi doit pouvoir baisser de moitié sans changer votre quotidien.'
        ]
      },

      {
        id: 'r4',
        titre: 'Les biais qui coûtent le plus cher',
        objectifs: [
          'Identifier les principaux biais cognitifs de l\'investisseur',
          'Comprendre pourquoi la volonté ne suffit pas à les corriger',
          'Mettre en place des garde-fous concrets'
        ],
        sections: [
          {
            t: 'Aversion à la perte et effet de disposition',
            p: [
              'Une perte fait environ deux fois plus mal qu\'un gain équivalent ne fait plaisir. Cette asymétrie a une conséquence directe et coûteuse : on vend ses gagnants pour matérialiser un gain agréable, et on garde ses perdants pour ne pas matérialiser une perte douloureuse.',
              'Le résultat est exactement l\'inverse de ce qu\'il faudrait faire. Un portefeuille se remplit progressivement de mauvaises positions pendant que les bonnes en sortent.',
              'Le garde-fou est mécanique : décider de l\'invalidation avant d\'acheter, et l\'appliquer sans renégocier. Une décision prise à froid vaut mieux qu\'une décision prise en regardant son relevé.'
            ]
          },
          {
            t: 'Ancrage et biais de confirmation',
            p: [
              'L\'ancrage attache l\'esprit à un chiffre arbitraire, généralement son propre prix d\'achat. « Je vendrai quand je serai revenu à mon prix » est la phrase la plus coûteuse de l\'investissement : le marché ignore totalement votre prix d\'achat, qui n\'est une information que pour vous.',
              'Le biais de confirmation fait chercher ce qui conforte l\'opinion qu\'on a déjà. Une fois engagé sur un titre, on lit les nouvelles favorables avec attention et on écarte les défavorables comme du bruit. Personne n\'y échappe par la seule volonté.',
              'Le garde-fou consiste à écrire, avant d\'acheter, ce qui vous ferait changer d\'avis, puis à relire cette note à chaque publication de résultats. C\'est laborieux, et c\'est le seul procédé qui fonctionne.'
            ]
          },
          {
            t: 'Excès de confiance et suivisme',
            p: [
              'L\'excès de confiance croît avec l\'expérience récente. Après trois opérations réussies, on se croit compétent alors qu\'on a peut-être été chanceux. C\'est généralement à ce moment qu\'on augmente les positions, juste avant l\'erreur qui annule les trois gains.',
              'Le suivisme est le biais inverse : acheter parce que tout le monde achète. Il est particulièrement puissant sur les marchés étroits, où quelques recommandations relayées suffisent à créer un emballement sans fondement.',
              'Les deux se combattent par la même méthode : le journal de décision. Écrire ce qu\'on pensait, ce qu\'on a fait, et relire deux ans plus tard. La mémoire, laissée à elle-même, réécrit systématiquement le passé en notre faveur.'
            ]
          }
        ],
        retenir: [
          'On vend ses gagnants et garde ses perdants : c\'est l\'effet de disposition.',
          'Le marché ignore votre prix d\'achat ; lui seul vous ancre.',
          'Le biais de confirmation s\'installe dès qu\'on est engagé.',
          'Les garde-fous sont écrits et mécaniques, jamais volontaires.'
        ]
      },

      {
        id: 'r5',
        titre: 'Construire et suivre un portefeuille',
        objectifs: [
          'Définir une allocation cible',
          'Comprendre l\'intérêt du rééquilibrage',
          'Mettre en place un suivi périodique sans excès'
        ],
        sections: [
          {
            t: 'L\'allocation cible',
            p: [
              'Avant de choisir des titres, on décide de la répartition entre grandes catégories : actions, obligations ou placements à terme, liquidités. Cette décision explique l\'essentiel de la performance et du risque d\'un portefeuille, bien davantage que le choix des titres individuels.',
              'La répartition dépend de l\'horizon, de la tolérance aux baisses et de la situation personnelle. Une règle ancienne et grossière suggère de détenir en obligations un pourcentage égal à son âge ; elle vaut ce que valent les règles grossières, mais elle a le mérite de rappeler que l\'horizon se raccourcit avec le temps.',
              'L\'important est d\'écrire cette allocation et de s\'y tenir, plutôt que de la laisser dériver au gré des humeurs de marché.'
            ]
          },
          {
            t: 'Le rééquilibrage',
            p: [
              'Avec le temps, les proportions dérivent : la poche qui a monté prend plus de place. Rééquilibrer consiste à revenir périodiquement à la répartition cible, ce qui revient mécaniquement à vendre ce qui a monté et acheter ce qui a baissé.',
              'C\'est psychologiquement pénible et statistiquement bénéfique. Cela impose une discipline contraire à l\'intuition, et cela maintient le niveau de risque à celui qu\'on avait choisi.',
              'Une fois par an suffit. Rééquilibrer plus souvent multiplie les frais pour un bénéfice marginal, et sur un marché peu liquide, cela peut même coûter davantage que cela ne rapporte.'
            ]
          },
          {
            t: 'Suivre sans s\'agiter',
            p: [
              'Regarder son portefeuille tous les jours augmente le stress et la fréquence des opérations, sans améliorer les décisions. Sur un marché qui monte en moyenne mais fluctue quotidiennement, plus on regarde souvent, plus on voit de pertes, et plus on est tenté d\'agir.',
              'Un rythme trimestriel convient pour l\'examen des positions, avec une revue annuelle complète : allocation, performance comparée à l\'indice, thèses toujours valides, invalidations atteintes.',
              'La règle de fond est simple : agir quand la thèse change, pas quand le cours bouge. Ce sont deux événements distincts, et les confondre est la source de la plupart des opérations inutiles.'
            ]
          }
        ],
        attention: 'La performance d\'un portefeuille se compare à un indice de référence, jamais à zéro. Gagner 6 % dans un marché qui monte de 15 % n\'est pas une réussite, et perdre 5 % dans un marché qui baisse de 20 % n\'est pas un échec.',
        retenir: [
          'L\'allocation entre grandes catégories explique l\'essentiel du risque et de la performance.',
          'Rééquilibrer une fois par an suffit et maintient le risque choisi.',
          'Un suivi trimestriel vaut mieux qu\'un suivi quotidien.',
          'Agir quand la thèse change, pas quand le cours bouge.'
        ]
      },

      {
        id: 'r6',
        titre: 'Reconnaître les arnaques',
        objectifs: [
          'Identifier les signaux caractéristiques d\'une escroquerie financière',
          'Vérifier l\'agrément d\'un intermédiaire',
          'Comprendre le mécanisme des pyramides'
        ],
        sections: [
          {
            t: 'Les signaux qui ne trompent pas',
            p: [
              'Un rendement garanti et élevé. Le rendement et la garantie sont contradictoires : ce qui est garanti rapporte peu, ce qui rapporte beaucoup n\'est pas garanti. Cette contradiction est la signature la plus fiable d\'une escroquerie.',
              'L\'urgence. « L\'offre ferme ce soir », « il ne reste que quelques places ». Un placement légitime ne dépend pas de votre rapidité de décision. L\'urgence sert uniquement à empêcher la vérification.',
              'L\'opacité sur la stratégie. Si l\'on ne peut pas vous expliquer d\'où vient le rendement en termes compréhensibles, c\'est qu\'il ne vient de nulle part. « Algorithme propriétaire » et « trading haute fréquence sur les marchés internationaux » ne sont pas des explications.',
              'Et la rémunération du parrainage. Dès qu\'on vous paie pour amener d\'autres participants, l\'argent des nouveaux entrants sert à payer les anciens. C\'est la définition d\'une pyramide, et elle s\'effondre nécessairement.'
            ]
          },
          {
            t: 'Vérifier avant d\'engager',
            p: [
              'Toute société habilitée à recevoir votre argent pour investir sur la BRVM est agréée par le régulateur régional, et la liste est publique. Cette vérification prend cinq minutes.',
              'Vérifiez aussi que la société existe physiquement : adresse, immatriculation, dirigeants identifiables. Une entité qui ne communique que par messagerie instantanée n\'est pas un intermédiaire financier.',
              'Enfin, méfiez-vous des promesses relayées par des connaissances de confiance. Les escroqueries les plus efficaces circulent par les réseaux d\'affinité — famille, collègues, communauté religieuse — précisément parce que la confiance personnelle court-circuite la vérification.'
            ]
          },
          {
            t: 'Que faire si c\'est arrivé',
            p: [
              'Cessez immédiatement tout versement supplémentaire, y compris si l\'on vous demande de payer des frais pour débloquer vos fonds. Cette demande est elle-même une seconde escroquerie, généralement menée par les mêmes.',
              'Rassemblez toutes les preuves : messages, virements, contrats, identités. Signalez au régulateur et déposez plainte. Les chances de récupération sont faibles mais le signalement protège d\'autres personnes.',
              'Et parlez-en. La honte est le meilleur allié des escrocs : elle empêche les victimes de prévenir leur entourage, ce qui laisse le champ libre pour les suivantes.'
            ]
          }
        ],
        attention: 'Aucun placement sérieux ne garantit un rendement à deux chiffres. Sur la BRVM, le rendement moyen à long terme se situe dans l\'ordre de 8 à 10 % par an, avec des années négatives. Toute promesse largement supérieure et sans risque est un mensonge.',
        retenir: [
          'Rendement garanti et élevé : contradiction qui signale l\'escroquerie.',
          'L\'urgence sert à empêcher la vérification.',
          'La rémunération du parrainage définit une pyramide.',
          'Ne jamais payer de frais pour débloquer des fonds : c\'est une seconde escroquerie.'
        ]
      }
    ]
  });
})(typeof window !== 'undefined' ? window : globalThis);
