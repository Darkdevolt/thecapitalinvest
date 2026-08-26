/* ═══════════════════════════════════════════════════════════════════
   THE CAPITAL INSTITUTE
   curriculum-1.js : parcours 1 à 3.

   Chaque leçon suit la même architecture : ce qu'on va apprendre, le
   corps du texte, un encadré de mise en garde lorsque la matière s'y
   prête, et trois questions pour vérifier qu'on a compris.

   Le parti pris rédactionnel : partir de la BRVM plutôt que d'un
   marché américain qu'on transposerait ensuite. Un débutant d'Abidjan
   ou de Dakar n'a pas à traduire mentalement des exemples de Wall
   Street pour comprendre sa propre place financière.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var C = global.TCI_CURRICULUM = global.TCI_CURRICULUM || [];

  /* ═══════════════════════════════════════════════════════════════
     PARCOURS 1 — DÉCOUVRIR LA BOURSE
     ═══════════════════════════════════════════════════════════════ */

  C.push({
    id: 'decouvrir',
    titre: 'Découvrir la bourse',
    sous_titre: 'Ce qu\'est une action, à quoi sert un marché, et pourquoi les prix bougent',
    niveau: 'Débutant',
    duree: '2 h 30',
    resume: 'Le socle. À la fin de ce parcours, vous saurez ce que vous achetez quand vous achetez une action, ' +
      'qui se trouve en face de vous, et d\'où vient le prix affiché.',
    lecons: [

      {
        id: 'd1',
        titre: 'Qu\'est-ce qu\'une action',
        objectifs: [
          'Comprendre ce qu\'on possède réellement quand on détient une action',
          'Distinguer une action d\'une obligation',
          'Savoir d\'où vient le rendement d\'un actionnaire'
        ],
        sections: [
          {
            t: 'Une part d\'entreprise, pas un billet de loterie',
            p: [
              'Une action est une fraction du capital d\'une société. Si une entreprise a émis dix millions d\'actions et que vous en détenez mille, vous possédez un dix-millième de cette entreprise : un dix-millième de ses immeubles, de ses camions, de ses contrats, de sa marque, et un dix-millième de ses dettes.',
              'Cette phrase paraît évidente. Elle ne l\'est pas. La plupart des pertes en bourse viennent de gens qui ont oublié qu\'ils achetaient une entreprise et se sont mis à acheter un cours. Quand vous achetez une action Sonatel, vous ne pariez pas sur une courbe : vous devenez copropriétaire d\'un opérateur télécom qui a des abonnés, des antennes, des concurrents et un directeur général.',
              'Le corollaire est libérateur. Si vous ne pouvez pas expliquer en trois phrases comment la société gagne de l\'argent, vous n\'êtes pas en train d\'investir. Vous spéculez, ce qui est un autre métier, avec d\'autres règles.'
            ]
          },
          {
            t: 'Deux façons de gagner, deux façons de perdre',
            p: [
              'Un actionnaire est rémunéré de deux manières. Le dividende, d\'abord : une partie du bénéfice que la société décide de distribuer, généralement une fois par an après l\'assemblée générale. La plus-value ensuite : si vous revendez plus cher que vous n\'avez acheté, la différence vous revient.',
              'Symétriquement, il perd de deux manières. Le cours peut baisser, et le dividende peut être supprimé. Ces deux risques ne sont pas indépendants : une société qui coupe son dividende voit presque toujours son cours chuter dans la foulée, parce que la coupe révèle des difficultés que le marché n\'avait pas encore intégrées.',
              'Sur la BRVM, le dividende compte beaucoup plus qu\'ailleurs. Le marché est peu liquide, les plus-values sont lentes à se matérialiser, et le rendement du dividende constitue souvent la majeure partie du rendement total sur plusieurs années. C\'est une différence structurelle avec les marchés où l\'essentiel du gain vient de la hausse du cours.'
            ]
          },
          {
            t: 'Action et obligation, la différence qui change tout',
            p: [
              'Une obligation est un prêt. Vous prêtez de l\'argent à un État ou à une entreprise, qui s\'engage à vous verser un intérêt fixe et à vous rembourser à une date connue. Vous savez donc à l\'avance ce que vous toucherez, sauf défaut de l\'emprunteur.',
              'Une action ne promet rien. Aucune date de remboursement, aucun montant garanti. En contrepartie, votre gain n\'est pas plafonné : si la société triple ses bénéfices, l\'obligataire touche toujours son même coupon tandis que l\'actionnaire voit la valeur de sa part progresser.',
              'En cas de faillite, cette hiérarchie se retourne contre l\'actionnaire. Les créanciers sont remboursés d\'abord, les actionnaires en dernier, souvent avec rien. C\'est pourquoi une action rapporte davantage en moyenne : ce surcroît de rendement est le prix du risque d\'être servi en dernier.'
            ]
          }
        ],
        attention: 'Détenir une action ne donne aucun droit sur les actifs de la société. Vous ne pouvez pas vous présenter au siège pour réclamer votre dix-millième de camion. Votre droit porte sur le bénéfice distribué et sur le produit d\'une éventuelle liquidation, après paiement de tous les créanciers.',
        retenir: [
          'Une action est une part d\'entreprise, avec ses actifs et ses dettes.',
          'On gagne par le dividende et par la plus-value ; on perd par les deux mêmes canaux.',
          'Sur la BRVM, le dividende pèse souvent plus lourd que la plus-value.',
          'L\'actionnaire est servi en dernier en cas de faillite : c\'est la contrepartie de son rendement potentiel.'
        ]
      },

      {
        id: 'd2',
        titre: 'À quoi sert une bourse',
        objectifs: [
          'Comprendre la fonction économique d\'un marché boursier',
          'Distinguer marché primaire et marché secondaire',
          'Savoir pourquoi la liquidité est un service en soi'
        ],
        sections: [
          {
            t: 'Financer et faire circuler',
            p: [
              'Une bourse remplit deux fonctions distinctes qu\'on confond souvent. La première est de permettre à une entreprise de lever des capitaux : elle vend des actions nouvelles à des investisseurs et encaisse l\'argent. C\'est le marché primaire, et il ne se produit qu\'à l\'introduction ou lors d\'augmentations de capital.',
              'La seconde fonction, celle qui occupe 99 % de l\'activité quotidienne, est de permettre à ceux qui détiennent déjà des actions de les revendre à d\'autres. C\'est le marché secondaire. Quand vous achetez une action Sonatel en séance, votre argent ne va pas à Sonatel : il va à l\'actionnaire qui vous vend son titre.',
              'Cette distinction a une conséquence pratique. Le cours de bourse n\'enrichit pas directement la société. Il compte pourtant beaucoup pour elle, parce qu\'il détermine à quel prix elle pourra lever de nouveaux capitaux, et parce qu\'il constitue un jugement permanent du marché sur sa gestion.'
            ]
          },
          {
            t: 'La liquidité est le vrai service',
            p: [
              'Si les bourses n\'existaient pas, acheter une part d\'entreprise resterait possible, mais la revendre deviendrait un cauchemar : il faudrait trouver soi-même un acheteur, négocier un prix sans référence, organiser le transfert. Les rares transactions se feraient avec d\'énormes décotes.',
              'Une bourse organise la rencontre. Elle centralise les ordres, publie les prix, garantit le règlement et la livraison des titres. Ce service porte un nom : la liquidité, c\'est-à-dire la capacité de transformer un titre en argent rapidement et sans casser le prix.',
              'La liquidité n\'est jamais acquise, et elle varie énormément d\'un titre à l\'autre. Sur la BRVM, quelques valeurs s\'échangent tous les jours pour des montants significatifs, tandis que d\'autres peuvent rester plusieurs séances sans la moindre transaction. Sur ces dernières, vous pouvez vous retrouver propriétaire d\'un titre parfaitement analysé, parfaitement valorisé, et parfaitement invendable.'
            ]
          },
          {
            t: 'Le prix comme information',
            p: [
              'Un marché produit un chiffre qui n\'existerait pas autrement : le prix auquel des gens informés, engageant leur propre argent, acceptent d\'échanger. Ce prix agrège en permanence les anticipations de milliers d\'intervenants.',
              'Il ne faut ni le mépriser ni le sacraliser. Le mépriser conduit à croire qu\'on sait mieux que tout le monde. Le sacraliser conduit à penser que le marché a toujours raison, ce que dément l\'histoire de toutes les bulles. La position raisonnable est intermédiaire : le prix contient beaucoup d\'information, il faut de bonnes raisons pour s\'en écarter, et ces raisons doivent être formulées explicitement.'
            ]
          }
        ],
        retenir: [
          'Le marché primaire finance l\'entreprise ; le marché secondaire fait circuler les titres entre investisseurs.',
          'Acheter en séance n\'apporte pas d\'argent à la société.',
          'La liquidité est le service central d\'une bourse, et elle varie fortement d\'un titre à l\'autre.',
          'Le prix de marché est une information dense, ni infaillible ni négligeable.'
        ]
      },

      {
        id: 'd3',
        titre: 'Pourquoi les prix montent et descendent',
        objectifs: [
          'Comprendre le mécanisme de formation du prix par le carnet d\'ordres',
          'Distinguer ce qui fait bouger un cours à court et à long terme',
          'Reconnaître le rôle des anticipations'
        ],
        sections: [
          {
            t: 'Le carnet d\'ordres, mécanique élémentaire',
            p: [
              'À chaque instant, des acheteurs indiquent le prix maximal qu\'ils acceptent de payer et les quantités souhaitées ; des vendeurs indiquent leur prix minimal. L\'ensemble constitue le carnet d\'ordres. Une transaction a lieu quand le meilleur acheteur et le meilleur vendeur se rejoignent.',
              'Le cours affiché n\'est rien d\'autre que le prix de la dernière transaction conclue. Il ne représente pas la valeur de la société : il représente le point où deux personnes se sont mises d\'accord, à un instant donné, pour une quantité donnée.',
              'Cette précision compte sur un marché étroit. Si le dernier échange a porté sur dix titres, le cours affiché repose sur dix titres. Vouloir en vendre cinq mille au même prix relève de l\'illusion : vous consommerez tout le carnet et obtiendrez un prix moyen bien inférieur.'
            ]
          },
          {
            t: 'Court terme : les anticipations. Long terme : les bénéfices',
            p: [
              'À court terme, un cours bouge parce que les anticipations changent. Une rumeur, un communiqué, une décision politique, un résultat trimestriel meilleur que prévu suffisent à déplacer le point d\'équilibre. Rien de tangible n\'a changé dans l\'entreprise ce jour-là, mais l\'idée que s\'en font les intervenants s\'est modifiée.',
              'À long terme, les cours suivent les bénéfices. Sur dix ans, une société qui multiplie son résultat par trois verra son cours progresser fortement, quelles que soient les péripéties intermédiaires. Une société dont les bénéfices stagnent verra son cours stagner, malgré tous les emballements passagers.',
              'Benjamin Graham a résumé cela d\'une formule devenue classique : à court terme le marché est une machine à voter, à long terme c\'est une machine à peser. Le vote est bruyant et changeant ; la pesée est lente et implacable.'
            ]
          },
          {
            t: 'Ce qui n\'explique rien',
            p: [
              'Les commentaires de marché attribuent chaque jour une cause à chaque mouvement. Il faut s\'en méfier : ces explications sont construites après coup, et la même nouvelle sert souvent à justifier une hausse un jour et une baisse le lendemain.',
              'Beaucoup de mouvements quotidiens n\'ont aucune cause identifiable. Un gros ordre passé pour des raisons de trésorerie, un rééquilibrage de portefeuille, une simple absence de contrepartie suffisent à faire varier un cours de plusieurs pourcents sur un marché peu profond, sans que rien de significatif ne se soit produit.',
              'La discipline consiste à distinguer le bruit du signal. Une variation de 3 % un mardi sur un titre peu liquide est du bruit. Une baisse de 25 % après l\'annonce d\'une perte annuelle est un signal.'
            ]
          }
        ],
        attention: 'Sur les valeurs peu échangées de la BRVM, une variation quotidienne importante peut ne refléter qu\'une seule transaction de faible volume. Regardez toujours le volume avant de conclure quoi que ce soit d\'un mouvement de cours.',
        retenir: [
          'Le cours est le prix de la dernière transaction, pas la valeur de la société.',
          'À court terme les cours suivent les anticipations, à long terme les bénéfices.',
          'Beaucoup de mouvements quotidiens sont du bruit sans cause identifiable.',
          'Le volume conditionne la crédibilité d\'un mouvement de cours.'
        ]
      },

      {
        id: 'd4',
        titre: 'Les grands types d\'ordres',
        objectifs: [
          'Choisir entre un ordre au marché et un ordre à cours limité',
          'Comprendre les risques propres à chaque type d\'ordre',
          'Adapter son ordre à la liquidité du titre'
        ],
        sections: [
          {
            t: 'Ordre au marché : la rapidité contre le prix',
            p: [
              'Un ordre au marché s\'exécute immédiatement, au meilleur prix disponible dans le carnet. Vous êtes certain d\'être servi, mais vous ne savez pas à quel prix. Sur un titre très liquide, l\'écart avec le cours affiché est négligeable. Sur un titre étroit, il peut être considérable.',
              'C\'est l\'ordre qui cause le plus de mauvaises surprises aux débutants. Vous voyez un cours à 5 000 francs, vous passez un ordre au marché pour mille titres, et vous êtes exécuté à 5 000 pour dix titres, 5 200 pour cinquante, 5 600 pour le reste, parce que le carnet ne contenait rien de plus au prix affiché.'
            ]
          },
          {
            t: 'Ordre à cours limité : le prix contre la certitude',
            p: [
              'Un ordre à cours limité fixe le prix maximal que vous acceptez de payer à l\'achat, ou le prix minimal que vous acceptez de recevoir à la vente. Vous maîtrisez donc votre prix, mais vous n\'avez aucune garantie d\'être exécuté : si le marché ne vient pas à votre niveau, votre ordre reste en attente.',
              'C\'est l\'ordre à privilégier presque systématiquement sur un marché peu liquide. Il vous protège contre l\'exécution à un prix aberrant, et il vous oblige à décider à l\'avance ce que le titre vaut pour vous, ce qui est une discipline saine.',
              'Son inconvénient est réel : vous pouvez rater complètement un mouvement en attendant quelques francs de mieux. Beaucoup d\'investisseurs ont manqué une hausse de 40 % pour avoir refusé de payer 2 % de plus.'
            ]
          },
          {
            t: 'Choisir selon la liquidité',
            p: [
              'La règle pratique tient en une phrase : plus le titre est étroit, plus l\'ordre doit être limité. Sur une valeur qui traite quelques dizaines de titres par séance, un ordre au marché revient à signer un chèque en blanc.',
              'Un deuxième réflexe consiste à fractionner. Plutôt que de passer un ordre unique portant sur toute la quantité voulue, on l\'étale sur plusieurs séances. On accepte de mettre plus de temps, on évite de déplacer le cours contre soi.',
              'Enfin, gardez à l\'esprit que sur la BRVM la cotation se fait par fixing, avec des limites de variation quotidienne. Un titre qui atteint sa limite ne cotera plus ce jour-là, et vous pouvez rester bloqué avec un ordre non exécuté pendant plusieurs séances.'
            ]
          }
        ],
        attention: 'Un ordre au marché sur une valeur peu liquide est la manière la plus rapide de payer un titre 15 % trop cher. Sur la BRVM, l\'ordre limité devrait être votre réflexe par défaut, et l\'ordre au marché l\'exception réfléchie.',
        retenir: [
          'Ordre au marché : exécution certaine, prix incertain.',
          'Ordre à cours limité : prix maîtrisé, exécution incertaine.',
          'Plus le titre est étroit, plus l\'ordre limité s\'impose.',
          'Fractionner un gros ordre sur plusieurs séances évite de déplacer le cours contre soi.'
        ]
      },

      {
        id: 'd5',
        titre: 'Les frais, l\'ennemi silencieux',
        objectifs: [
          'Identifier tous les frais qui pèsent sur une opération',
          'Mesurer leur effet cumulé sur la performance',
          'Adapter sa fréquence d\'opérations en conséquence'
        ],
        sections: [
          {
            t: 'Ce que coûte un aller-retour',
            p: [
              'Acheter puis revendre une action déclenche plusieurs prélèvements : la commission de la société de gestion et d\'intermédiation, les frais de marché, les frais du dépositaire, et selon les pays une fiscalité sur les plus-values ou les dividendes.',
              'Pris isolément, chacun paraît modeste. Cumulés sur un aller-retour, ils représentent couramment 2 % du montant engagé sur la BRVM. Cela signifie qu\'un titre doit progresser de 2 % rien que pour que vous rentriez dans vos frais.',
              'Ce seuil change complètement l\'évaluation d\'une stratégie. Une méthode qui gagne 1,5 % par opération en moyenne, ce qui semble honorable, perd en réalité de l\'argent une fois les frais déduits.'
            ]
          },
          {
            t: 'L\'effet de la fréquence',
            p: [
              'Un investisseur qui fait deux opérations par an supporte environ 4 % de frais annuels. Le même, avec une opération par mois, en supporte vingt-quatre. Sur un marché dont le rendement historique tourne autour de 8 à 10 % par an, la seconde approche consomme la totalité du rendement et davantage.',
              'C\'est la raison la plus banale et la plus universelle des mauvaises performances individuelles. Ce n\'est pas un défaut d\'analyse, c\'est un excès d\'activité.',
              'Le corollaire est encourageant : ne rien faire est souvent la meilleure décision disponible. Un portefeuille bien construit qu\'on laisse travailler bat régulièrement un portefeuille brillamment analysé mais constamment remanié.'
            ]
          },
          {
            t: 'Le coût invisible : l\'écart entre offre et demande',
            p: [
              'Au-delà des frais facturés, il existe un coût qui n\'apparaît sur aucun relevé : l\'écart entre le meilleur prix d\'achat et le meilleur prix de vente. Si l\'on achète à 5 100 alors qu\'on ne pourrait revendre qu\'à 4 900, on a perdu 4 % à l\'instant même de la transaction.',
              'Sur les valeurs liquides, cet écart est faible. Sur les valeurs étroites, il peut dépasser les frais officiels. Il faut donc l\'intégrer mentalement au coût de l\'opération, même s\'il ne figure nulle part.'
            ]
          }
        ],
        attention: 'Avant d\'adopter une stratégie, calculez ce qu\'elle coûte en frais sur un an au rythme d\'opérations qu\'elle suppose. Beaucoup de méthodes séduisantes sur le papier ne survivent pas à ce calcul.',
        retenir: [
          'Un aller-retour coûte couramment 2 % sur la BRVM, frais officiels compris.',
          'La fréquence des opérations est le premier destructeur de performance individuelle.',
          'L\'écart entre offre et demande est un coût réel qui n\'apparaît sur aucun relevé.',
          'Ne rien faire est souvent la décision la plus rentable.'
        ]
      }
    ]
  });

  /* ═══════════════════════════════════════════════════════════════
     PARCOURS 2 — LA BRVM ET L'UEMOA
     ═══════════════════════════════════════════════════════════════ */

  C.push({
    id: 'brvm',
    titre: 'La BRVM et l\'UEMOA',
    sous_titre: 'La place régionale, ses acteurs, ses règles et ses particularités',
    niveau: 'Débutant',
    duree: '2 h',
    resume: 'Comprendre le marché sur lequel on intervient réellement, plutôt que de transposer des habitudes ' +
      'importées de places qui ne lui ressemblent pas.',
    lecons: [

      {
        id: 'b1',
        titre: 'Une bourse pour huit pays',
        objectifs: [
          'Situer la BRVM dans l\'architecture financière de l\'UEMOA',
          'Comprendre l\'organisation en antennes nationales',
          'Mesurer ce que l\'intégration régionale change pour un investisseur'
        ],
        sections: [
          {
            t: 'Une place unique, huit États',
            p: [
              'La Bourse Régionale des Valeurs Mobilières est une institution commune aux huit pays de l\'Union Économique et Monétaire Ouest-Africaine : Bénin, Burkina Faso, Côte d\'Ivoire, Guinée-Bissau, Mali, Niger, Sénégal et Togo. Son siège se trouve à Abidjan, et chaque État dispose d\'une antenne nationale.',
              'Cette architecture est rare dans le monde. La plupart des pays ont leur propre bourse ; ici, huit États partagent une seule place, un seul système de cotation, une seule chambre de compensation et un seul régulateur régional.',
              'Pour l\'investisseur, la conséquence immédiate est qu\'un Sénégalais achète une société ivoirienne exactement comme il achèterait une société sénégalaise, dans la même monnaie et avec les mêmes règles. Il n\'y a ni risque de change ni formalité supplémentaire entre les huit pays.'
            ]
          },
          {
            t: 'Ce que l\'intégration apporte, ce qu\'elle ne supprime pas',
            p: [
              'L\'union monétaire supprime le risque de change à l\'intérieur de la zone, ce qui est un avantage considérable. Elle mutualise aussi les coûts d\'infrastructure : une seule bourse pour huit pays coûte beaucoup moins cher que huit bourses.',
              'Elle ne supprime en revanche ni le risque politique, ni le risque économique, ni la concentration sectorielle. Les huit économies restent exposées aux mêmes chocs : cours des matières premières, conditions climatiques, stabilité régionale. Diversifier entre plusieurs pays de l\'union protège moins qu\'il n\'y paraît, parce que ces économies évoluent souvent ensemble.',
              'Il faut également garder à l\'esprit que la cote reste concentrée. Un petit nombre de valeurs représente une part très importante de la capitalisation et de l\'essentiel des échanges. Un portefeuille prétendument diversifié sur la BRVM peut se révéler très exposé à quelques secteurs.'
            ]
          }
        ],
        retenir: [
          'La BRVM est commune aux huit pays de l\'UEMOA, avec un siège à Abidjan et des antennes nationales.',
          'Aucun risque de change ni formalité entre les huit pays.',
          'L\'intégration ne supprime ni le risque politique ni la corrélation des économies.',
          'La cote est concentrée : la diversification y est plus difficile qu\'ailleurs.'
        ]
      },

      {
        id: 'b2',
        titre: 'Les acteurs et leur rôle',
        objectifs: [
          'Identifier qui fait quoi dans la chaîne d\'une transaction',
          'Comprendre le rôle du régulateur',
          'Savoir à qui s\'adresser pour intervenir sur le marché'
        ],
        sections: [
          {
            t: 'La chaîne d\'une transaction',
            p: [
              'Un particulier ne passe jamais d\'ordre directement en bourse. Il s\'adresse à une société de gestion et d\'intermédiation, seule habilitée à transmettre les ordres au marché. C\'est votre interlocuteur unique : ouverture de compte, passage d\'ordres, conservation des titres, versement des dividendes.',
              'L\'ordre transmis rejoint le système de cotation de la BRVM, qui confronte les ordres d\'achat et de vente. Une fois la transaction conclue, le dépositaire central assure le règlement des espèces et la livraison des titres, opération qui prend quelques jours ouvrés.',
              'Au-dessus de l\'ensemble se trouve le régulateur régional, chargé d\'agréer les acteurs, de contrôler l\'information publiée par les sociétés cotées et de sanctionner les manquements.'
            ]
          },
          {
            t: 'Ce que vous devez attendre de votre intermédiaire',
            p: [
              'Un bon intermédiaire vous communique clairement sa grille tarifaire, exécute vos ordres dans les délais annoncés, vous fournit un relevé de portefeuille lisible et vous informe des opérations sur titres qui vous concernent.',
              'Il n\'a pas vocation à décider à votre place. Méfiez-vous des conseils insistants sur un titre particulier, surtout s\'ils s\'accompagnent d\'un sentiment d\'urgence. La décision d\'investissement vous appartient, et c\'est vous qui en supportez les conséquences.',
              'Vérifiez toujours que l\'établissement auquel vous confiez votre argent est effectivement agréé par le régulateur. Cette vérification prend cinq minutes et vous épargne les seuls risques qu\'aucune analyse financière ne peut couvrir.'
            ]
          }
        ],
        attention: 'Aucune plateforme non agréée ne devrait recevoir votre argent, quelles que soient les promesses de rendement affichées. Les rendements garantis à deux chiffres sur une place où le rendement moyen tourne autour de 8 % ne sont jamais une bonne affaire.',
        retenir: [
          'Le particulier passe par une société de gestion et d\'intermédiation agréée.',
          'Le dépositaire central assure le règlement et la livraison.',
          'Le régulateur régional agrée les acteurs et contrôle l\'information.',
          'La décision d\'investissement reste la vôtre, jamais celle de l\'intermédiaire.'
        ]
      },

      {
        id: 'b3',
        titre: 'Cotation, indices et compartiments',
        objectifs: [
          'Comprendre le mécanisme de cotation par fixing',
          'Connaître les principaux indices de la place',
          'Situer une valeur dans la structure de la cote'
        ],
        sections: [
          {
            t: 'La cotation par fixing',
            p: [
              'Contrairement aux grandes places où les transactions s\'enchaînent en continu, la BRVM fonctionne largement par fixing : les ordres s\'accumulent pendant une période donnée, puis un prix unique est déterminé, celui qui permet d\'échanger le plus grand nombre de titres possible.',
              'Ce mécanisme convient bien à un marché où les ordres sont peu nombreux : concentrer les échanges à un instant précis crée davantage de contrepartie que de les disperser sur une journée entière.',
              'Il a une conséquence pratique. Vous ne pouvez pas suivre un cours minute par minute et réagir dans l\'instant. La bonne pratique consiste à réfléchir avant la séance, à passer un ordre limité, et à accepter de ne pas connaître le résultat immédiatement.'
            ]
          },
          {
            t: 'Les limites de variation',
            p: [
              'Pour éviter les mouvements désordonnés, un cours ne peut varier que dans une fourchette limitée d\'une séance à l\'autre. Si l\'écart entre l\'offre et la demande dépasse cette limite, la cotation est suspendue et reprend à la séance suivante.',
              'Ce garde-fou protège contre la panique, mais il crée une illusion dangereuse. Une valeur qui doit corriger de 30 % n\'y parviendra pas en une séance : elle enchaînera plusieurs séances de baisse limitée, pendant lesquelles vous ne trouverez tout simplement pas d\'acheteur. La limite ne supprime pas la baisse, elle l\'étale.'
            ]
          },
          {
            t: 'Les indices',
            p: [
              'Un indice résume l\'évolution d\'un ensemble de valeurs en un seul chiffre. Le BRVM Composite couvre l\'ensemble des sociétés cotées et sert de référence générale du marché. D\'autres indices suivent des sous-ensembles : les valeurs les plus actives, ou des regroupements sectoriels.',
              'Un indice sert à trois choses. Mesurer la tendance générale du marché, comparer la performance de son portefeuille à celle du marché, et calculer la sensibilité d\'un titre aux mouvements d\'ensemble.',
              'Attention toutefois : un indice concentré sur quelques grosses capitalisations reflète surtout leur comportement. Une hausse de l\'indice peut masquer une baisse de la majorité des valeurs si les plus lourdes progressent.'
            ]
          }
        ],
        retenir: [
          'La cotation se fait par fixing : les ordres sont confrontés à un instant donné.',
          'Les limites de variation étalent les mouvements, elles ne les suppriment pas.',
          'Le BRVM Composite est la référence générale du marché.',
          'Un indice concentré reflète surtout ses plus grosses composantes.'
        ]
      },

      {
        id: 'b4',
        titre: 'La liquidité, contrainte centrale',
        objectifs: [
          'Mesurer la liquidité d\'un titre avec des critères objectifs',
          'Adapter la taille de ses positions à la liquidité disponible',
          'Comprendre pourquoi la liquidité prime sur la valorisation'
        ],
        sections: [
          {
            t: 'Mesurer la liquidité',
            p: [
              'Trois indicateurs suffisent. Le volume moyen quotidien, d\'abord, qui donne un ordre de grandeur des quantités échangeables. La part de séances effectivement traitées ensuite : un titre qui ne cote que trois jours sur dix pose un problème que le volume moyen masque. L\'écart entre les meilleures offres d\'achat et de vente enfin, qui mesure le coût immédiat d\'un aller-retour.',
              'Une règle empirique consiste à ne jamais détenir plus de quelques jours de volume moyen sur une valeur. Si un titre échange mille actions par séance et que vous en détenez vingt mille, vous mettrez des semaines à sortir, et votre propre vente fera baisser le cours pendant toute la durée de l\'opération.'
            ]
          },
          {
            t: 'Pourquoi elle prime sur tout le reste',
            p: [
              'Une analyse fondamentale impeccable démontrant qu\'un titre vaut le double de son cours ne sert à rien si personne n\'achète quand vous voulez vendre. La liquidité n\'est pas un critère parmi d\'autres : c\'est la condition qui rend les autres critères utiles.',
              'C\'est particulièrement vrai dans les moments qui comptent. La liquidité disparaît précisément quand on en a besoin : lors des baisses générales, les acheteurs se retirent et les titres étroits deviennent invendables à tout prix raisonnable.',
              'La conséquence pratique est qu\'il faut décider de la taille de sa position au moment de l\'achat, en fonction de la liquidité, et non au moment de la vente en fonction de son besoin.'
            ]
          }
        ],
        attention: 'Un volume nul sur plusieurs séances ne signifie pas que le titre est stable. Il signifie qu\'aucune transaction n\'a eu lieu, donc que le cours affiché n\'a plus de contenu informatif. Ne confondez jamais absence de mouvement et absence de risque.',
        retenir: [
          'Trois mesures : volume moyen, part de séances traitées, écart offre-demande.',
          'Ne pas détenir plus de quelques jours de volume moyen.',
          'La liquidité disparaît au moment précis où on en a besoin.',
          'La taille d\'une position se décide à l\'achat, pas à la vente.'
        ]
      },

      {
        id: 'b5',
        titre: 'Dividendes et opérations sur titres',
        objectifs: [
          'Comprendre le calendrier d\'un dividende',
          'Anticiper l\'effet du détachement sur le cours',
          'Identifier les principales opérations sur titres'
        ],
        sections: [
          {
            t: 'Le parcours d\'un dividende',
            p: [
              'Le conseil d\'administration propose un dividende, l\'assemblée générale des actionnaires l\'approuve, puis une date de détachement est fixée. À cette date, le titre se négocie sans le droit au dividende, et son cours baisse mécaniquement du montant détaché. Le paiement intervient quelques jours ou semaines plus tard.',
              'Cette baisse mécanique surprend beaucoup de débutants, qui croient à un mauvais signal. Il n\'en est rien : la société a simplement sorti de la trésorerie de son bilan pour la verser à ses actionnaires. Vous n\'avez rien perdu, une partie de votre valeur a changé de poche.',
              'Il en découle qu\'acheter juste avant le détachement pour toucher le dividende n\'apporte rien. Vous payez le dividende dans le cours, vous le recevez, et vous vous retrouvez au même point, frais et fiscalité en moins.'
            ]
          },
          {
            t: 'Les autres opérations sur titres',
            p: [
              'Une augmentation de capital consiste pour la société à émettre des actions nouvelles. Si vous ne participez pas, votre part relative diminue : c\'est la dilution. Regardez toujours à quoi sert l\'argent levé — financer une croissance rentable n\'a rien à voir avec combler des pertes.',
              'Une division du nominal multiplie le nombre d\'actions sans changer la valeur totale. Une action à 100 000 francs devient dix actions à 10 000. Rien n\'a changé économiquement, mais le titre devient accessible à des porteurs plus modestes, ce qui améliore parfois sa liquidité.',
              'Un dividende exceptionnel, une distribution d\'actions gratuites ou un regroupement de titres relèvent de la même logique : vérifiez toujours si l\'opération modifie la valeur de votre patrimoine ou seulement sa présentation.'
            ]
          }
        ],
        retenir: [
          'Le cours baisse mécaniquement du montant du dividende à la date de détachement.',
          'Acheter juste avant le détachement n\'apporte aucun gain.',
          'Une augmentation de capital dilue les actionnaires qui n\'y participent pas.',
          'Une division du nominal ne change rien économiquement.'
        ]
      }
    ]
  });

  /* ═══════════════════════════════════════════════════════════════
     PARCOURS 3 — LIRE LES ÉTATS FINANCIERS
     ═══════════════════════════════════════════════════════════════ */

  C.push({
    id: 'etats',
    titre: 'Lire les états financiers',
    sous_titre: 'Compte de résultat, bilan et flux de trésorerie sans jargon',
    niveau: 'Intermédiaire',
    duree: '3 h',
    resume: 'Les trois documents que publie toute société cotée, ce qu\'ils disent, ce qu\'ils cachent, ' +
      'et dans quel ordre les lire.',
    lecons: [

      {
        id: 'e1',
        titre: 'Les trois documents et leur logique',
        objectifs: [
          'Distinguer le rôle de chacun des trois états financiers',
          'Comprendre comment ils s\'articulent',
          'Savoir par lequel commencer'
        ],
        sections: [
          {
            t: 'Un film, une photo, un relevé bancaire',
            p: [
              'Le compte de résultat est un film : il retrace ce qui s\'est passé pendant l\'année, des ventes réalisées jusqu\'au bénéfice final. Il couvre une période.',
              'Le bilan est une photo : il montre ce que la société possède et ce qu\'elle doit à une date précise, généralement le 31 décembre. Il ne couvre aucune période, il fige un instant.',
              'Le tableau des flux de trésorerie est un relevé bancaire : il indique l\'argent réellement entré et sorti pendant l\'année. C\'est le document le moins commenté et le plus important, parce que c\'est le plus difficile à habiller.'
            ]
          },
          {
            t: 'Comment ils s\'articulent',
            p: [
              'Le bénéfice du compte de résultat vient augmenter les capitaux propres du bilan, sauf s\'il est distribué en dividende. Une société qui gagne de l\'argent et ne le distribue pas voit donc ses capitaux propres grossir année après année.',
              'Le tableau des flux part du bénéfice comptable et le corrige de tout ce qui n\'est pas de la trésorerie : amortissements, variations de stocks, créances clients non encaissées. Il aboutit à la variation réelle du compte en banque.',
              'L\'écart entre le bénéfice et la trésorerie générée est l\'un des signaux les plus révélateurs de toute l\'analyse financière. Une société durablement bénéficiaire qui ne génère pas de trésorerie mérite qu\'on regarde de très près pourquoi.'
            ]
          },
          {
            t: 'Dans quel ordre lire',
            p: [
              'Commencez par le tableau des flux de trésorerie. Il vous dit si l\'activité produit de l\'argent, ce qui est la question première.',
              'Passez ensuite au bilan : la société est-elle solide, endettée, dépendante de ses créanciers ?',
              'Finissez par le compte de résultat, qui explique la rentabilité de l\'exercice. Cet ordre est l\'inverse de celui des présentations habituelles, et c\'est précisément pour cela qu\'il est utile : il vous protège contre l\'effet de séduction d\'un beau bénéfice.'
            ]
          }
        ],
        retenir: [
          'Compte de résultat : un film sur une période. Bilan : une photo à une date. Flux : un relevé bancaire.',
          'Le bénéfice non distribué augmente les capitaux propres.',
          'L\'écart entre bénéfice et trésorerie est un signal majeur.',
          'Lire dans l\'ordre flux, bilan, résultat protège de la séduction du bénéfice.'
        ]
      },

      {
        id: 'e2',
        titre: 'Le compte de résultat ligne à ligne',
        objectifs: [
          'Suivre le chemin du chiffre d\'affaires jusqu\'au résultat net',
          'Distinguer les niveaux de résultat et leur signification',
          'Repérer les éléments non récurrents'
        ],
        sections: [
          {
            t: 'La cascade',
            p: [
              'Tout part du chiffre d\'affaires, le total des ventes de l\'année. On en retire les achats et les charges externes, puis les charges de personnel, pour obtenir le résultat brut d\'exploitation : ce que le métier rapporte avant toute considération de financement, d\'amortissement et d\'impôt.',
              'On retire ensuite les amortissements, qui constatent l\'usure des équipements, pour obtenir le résultat d\'exploitation. Puis les charges financières, c\'est-à-dire le coût de la dette, pour obtenir le résultat courant. Enfin l\'impôt, pour aboutir au résultat net.',
              'Chaque niveau répond à une question différente. Le résultat brut d\'exploitation dit si le métier est rentable. Le résultat d\'exploitation dit s\'il l\'est encore une fois l\'outil industriel renouvelé. Le résultat net dit ce qui revient effectivement aux actionnaires.'
            ]
          },
          {
            t: 'Pourquoi le résultat brut d\'exploitation est le plus comparable',
            p: [
              'Deux sociétés du même métier peuvent afficher des résultats nets très différents pour des raisons qui n\'ont rien à voir avec leur performance industrielle : l\'une est endettée et paie des intérêts, l\'autre pas ; l\'une est implantée dans un pays à forte fiscalité, l\'autre non.',
              'Le résultat brut d\'exploitation neutralise ces différences. C\'est pourquoi les professionnels l\'utilisent pour comparer des sociétés, et pourquoi les multiples fondés sur lui sont plus robustes que le rapport cours sur bénéfice.',
              'Il a toutefois un défaut majeur, qu\'il ne faut jamais oublier : il ignore complètement les investissements nécessaires pour maintenir l\'activité. Une société très capitalistique et une société légère peuvent afficher le même résultat brut sans avoir du tout le même intérêt.'
            ]
          },
          {
            t: 'Se méfier de l\'exceptionnel',
            p: [
              'Une cession d\'immeuble, une indemnité d\'assurance, une reprise de provision peuvent gonfler un résultat net d\'une année sans rien dire de la performance opérationnelle. Ces éléments sont par définition non reproductibles.',
              'Le réflexe consiste à toujours comparer la progression du résultat net à celle du chiffre d\'affaires et du résultat brut. Si le résultat net bondit de 40 % alors que le chiffre d\'affaires stagne, cherchez l\'explication avant de vous réjouir.',
              'Le même raisonnement vaut dans l\'autre sens : une perte due à une dépréciation exceptionnelle n\'a pas la même gravité qu\'une perte d\'exploitation récurrente.'
            ]
          }
        ],
        attention: 'Un résultat net en forte hausse sans progression du chiffre d\'affaires ni du résultat brut d\'exploitation vient presque toujours d\'un élément non récurrent. Cherchez-le dans les annexes avant d\'extrapoler.',
        retenir: [
          'La cascade va du chiffre d\'affaires au résultat net, chaque niveau répondant à une question distincte.',
          'Le résultat brut d\'exploitation est le plus comparable entre sociétés.',
          'Il ignore cependant les investissements nécessaires.',
          'Les éléments exceptionnels ne se reproduisent pas : ne les extrapolez jamais.'
        ]
      },

      {
        id: 'e3',
        titre: 'Le bilan, ce qu\'on possède et ce qu\'on doit',
        objectifs: [
          'Lire la structure d\'un bilan',
          'Évaluer la solidité financière d\'une société',
          'Comprendre le rôle des capitaux propres'
        ],
        sections: [
          {
            t: 'Deux colonnes qui s\'équilibrent',
            p: [
              'À gauche, l\'actif : ce que la société possède, des immeubles et machines jusqu\'aux stocks, aux créances clients et à la trésorerie. À droite, le passif : d\'où vient l\'argent qui a financé tout cela, entre les capitaux propres apportés par les actionnaires et les dettes contractées auprès de tiers.',
              'Les deux colonnes s\'équilibrent nécessairement, puisque tout ce qui est possédé a bien été financé d\'une manière ou d\'une autre. Cette égalité n\'est pas une performance, c\'est une identité comptable.',
              'La question intéressante n\'est donc jamais le total du bilan mais sa composition : quelle part des actifs est financée par les actionnaires, et quelle part par les créanciers ?'
            ]
          },
          {
            t: 'Les capitaux propres, matelas de sécurité',
            p: [
              'Les capitaux propres représentent ce qui resterait aux actionnaires si l\'on vendait tous les actifs à leur valeur comptable et qu\'on remboursait toutes les dettes. C\'est le matelas qui absorbe les pertes avant que les créanciers ne soient touchés.',
              'Plus ce matelas est épais rapporté au total du bilan, plus la société peut encaisser un mauvais exercice sans se retrouver en difficulté. C\'est ce que mesure le ratio d\'autonomie financière.',
              'Des capitaux propres négatifs signifient que les pertes accumulées ont dépassé tout ce que les actionnaires avaient apporté. La société ne vaut plus rien comptablement et survit par la tolérance de ses créanciers. C\'est un signal d\'alarme, pas une nuance.'
            ]
          },
          {
            t: 'La dette, ni bonne ni mauvaise en soi',
            p: [
              'La dette est un outil. Empruntée à 7 % pour financer un investissement qui rapporte 15 %, elle enrichit les actionnaires : c\'est l\'effet de levier. Empruntée pour combler un déficit d\'exploitation, elle ne fait que reporter le problème en l\'aggravant.',
              'Le bon réflexe consiste à toujours demander à quoi sert la dette, et à mesurer combien d\'années de résultat brut d\'exploitation seraient nécessaires pour la rembourser. Au-delà de trois ou quatre années, la marge de manœuvre devient étroite.',
              'Attention à une particularité : les banques travaillent structurellement avec des ratios d\'endettement qui affoleraient s\'ils concernaient un industriel. Leur métier consiste précisément à collecter des dépôts, qui sont des dettes, pour les prêter. Les critères habituels de solidité ne leur sont pas transposables.'
            ]
          }
        ],
        retenir: [
          'L\'actif dit ce qu\'on possède, le passif d\'où vient l\'argent.',
          'Les capitaux propres absorbent les pertes avant les créanciers.',
          'Des capitaux propres négatifs sont un signal d\'alarme majeur.',
          'La dette est bonne ou mauvaise selon ce qu\'elle finance ; les banques échappent aux critères habituels.'
        ]
      },

      {
        id: 'e4',
        titre: 'Les flux de trésorerie, le document le plus honnête',
        objectifs: [
          'Comprendre les trois catégories de flux',
          'Calculer le flux de trésorerie libre',
          'Détecter les écarts entre bénéfice et trésorerie'
        ],
        sections: [
          {
            t: 'Trois robinets',
            p: [
              'Les flux d\'exploitation retracent l\'argent produit par l\'activité courante. C\'est le robinet principal : s\'il est durablement négatif, la société consomme de l\'argent pour fonctionner et ne tiendra que tant qu\'on lui en prêtera.',
              'Les flux d\'investissement retracent l\'argent consacré à l\'achat d\'équipements ou reçu de la vente d\'actifs. Ils sont normalement négatifs : une société qui n\'investit pas consomme son outil de production.',
              'Les flux de financement retracent les emprunts contractés ou remboursés, les augmentations de capital et les dividendes versés. Ils indiquent comment la société équilibre le reste.'
            ]
          },
          {
            t: 'Le flux de trésorerie libre',
            p: [
              'En retranchant les investissements du flux d\'exploitation, on obtient le flux de trésorerie libre : l\'argent réellement disponible une fois l\'activité financée et l\'outil entretenu. C\'est ce qui peut servir à rembourser la dette, verser un dividende ou racheter des actions.',
              'C\'est aussi la grandeur qu\'utilisent les méthodes de valorisation les plus rigoureuses, parce qu\'elle est difficile à maquiller. On peut habiller un bénéfice par des écritures comptables ; on ne peut pas habiller un compte en banque.',
              'Il faut cependant le lire sur plusieurs années. Un exercice de forte expansion peut afficher un flux libre négatif parce que la société investit massivement, sans que ce soit un mauvais signe. C\'est la tendance sur cinq ans qui compte.'
            ]
          },
          {
            t: 'Quand le bénéfice et l\'argent divergent',
            p: [
              'Une vente est enregistrée en résultat dès la facture émise, même si le client n\'a pas encore payé. Une société qui vend beaucoup à des clients mauvais payeurs affichera donc de beaux bénéfices sans voir arriver l\'argent.',
              'Le rapport entre le flux d\'exploitation et le résultat net mesure ce décalage. Durablement au-dessus de 1, les bénéfices se transforment bien en trésorerie. Durablement en dessous de 0,7, une part importante du résultat reste immobilisée en créances ou en stocks.',
              'Ce ratio est l\'un des rares indicateurs qui ait détecté par avance la plupart des grandes défaillances comptables. Ce n\'est pas un hasard : c\'est précisément parce qu\'il est difficile à manipuler.'
            ]
          }
        ],
        attention: 'Une société qui affiche des bénéfices croissants et une trésorerie d\'exploitation stagnante depuis trois ans doit être examinée avec la plus grande attention. C\'est la configuration qui précède la plupart des mauvaises surprises.',
        retenir: [
          'Trois catégories : exploitation, investissement, financement.',
          'Flux libre = flux d\'exploitation moins investissements.',
          'Le flux libre se lit sur plusieurs années, jamais sur une seule.',
          'Le rapport flux d\'exploitation sur résultat net révèle les bénéfices qui ne se transforment pas en argent.'
        ]
      },

      {
        id: 'e5',
        titre: 'Les annexes et ce qu\'elles cachent',
        objectifs: [
          'Savoir où chercher l\'information qui n\'est pas dans les chiffres',
          'Identifier les engagements hors bilan',
          'Lire le rapport du commissaire aux comptes'
        ],
        sections: [
          {
            t: 'Le vrai contenu est souvent en annexe',
            p: [
              'Les états financiers proprement dits tiennent en trois pages. Les annexes en font souvent trente. C\'est là que se trouvent les explications : méthodes comptables retenues, détail des dettes et de leurs échéances, litiges en cours, engagements donnés, événements survenus après la clôture.',
              'Un investisseur pressé lit les chiffres et saute les annexes. C\'est exactement l\'inverse qu\'il faudrait faire : les chiffres se résument en dix lignes, les annexes contiennent ce qui ne se résume pas.'
            ]
          },
          {
            t: 'Les engagements hors bilan',
            p: [
              'Certains engagements n\'apparaissent pas au bilan alors qu\'ils exposent réellement la société : cautions données à des filiales, garanties accordées, contrats de location de longue durée, litiges susceptibles de se solder par des indemnités.',
              'Ils peuvent représenter des montants comparables à la dette inscrite au bilan. Les ignorer revient à sous-estimer significativement le risque.'
            ]
          },
          {
            t: 'Le rapport du commissaire aux comptes',
            p: [
              'Ce document, souvent survolé, contient une information binaire d\'une grande valeur. Une certification sans réserve signifie que les comptes sont réguliers et sincères. Une certification avec réserves signale un désaccord sur un point précis, et ce point est nommé.',
              'Un refus de certifier, ou une observation sur la continuité de l\'exploitation, constitue le signal le plus grave qu\'un investisseur puisse rencontrer. Il ne demande aucune compétence technique pour être compris, seulement la peine de lire deux pages.'
            ]
          }
        ],
        retenir: [
          'Les annexes contiennent l\'information qui ne se résume pas en chiffres.',
          'Les engagements hors bilan peuvent égaler la dette inscrite.',
          'Une réserve du commissaire aux comptes nomme précisément le désaccord.',
          'Une observation sur la continuité d\'exploitation est le signal le plus grave qui soit.'
        ]
      },

      {
        id: 'e6',
        titre: 'Repérer les signaux d\'alerte',
        objectifs: [
          'Connaître les configurations comptables qui doivent alerter',
          'Croiser plusieurs indices plutôt que d\'en isoler un',
          'Adopter une méthode de vérification systématique'
        ],
        sections: [
          {
            t: 'Les configurations classiques',
            p: [
              'Un bénéfice qui progresse pendant que la trésorerie d\'exploitation stagne. Des créances clients qui augmentent plus vite que le chiffre d\'affaires, signe que la société vend à des clients qui ne paient pas. Des stocks qui gonflent sans croissance des ventes, signe que la marchandise ne s\'écoule pas.',
              'Un changement de méthode comptable qui améliore opportunément le résultat de l\'exercice. Une modification de la durée d\'amortissement qui allège les charges. Un dividende maintenu alors que le résultat s\'effondre.',
              'Un commissaire aux comptes qui change en cours de mandat sans explication claire. Des délais de publication qui s\'allongent d\'année en année.'
            ]
          },
          {
            t: 'Un seul indice ne prouve rien',
            p: [
              'Chacun de ces signaux peut avoir une explication parfaitement légitime. Des stocks qui gonflent peuvent préparer une saison forte. Des créances qui augmentent peuvent refléter un contrat important signé en fin d\'exercice.',
              'C\'est leur accumulation qui doit alerter. Trois signaux concordants valent bien davantage qu\'un seul signal spectaculaire. La méthode consiste à les compter, pas à les hiérarchiser.',
              'Et lorsqu\'ils s\'accumulent, la bonne décision n\'est pas de vendre par réflexe mais de chercher l\'explication. Si vous ne la trouvez pas dans les documents publiés, l\'absence d\'explication est elle-même une information.'
            ]
          },
          {
            t: 'Une méthode en cinq vérifications',
            p: [
              'Le flux d\'exploitation suit-il le résultat net sur trois ans ? Les créances et les stocks progressent-ils au même rythme que le chiffre d\'affaires ? Les capitaux propres augmentent-ils année après année ? Le commissaire aux comptes a-t-il émis des réserves ? Le dividende est-il couvert par le flux de trésorerie libre ?',
              'Cinq questions, cinq minutes, et l\'essentiel du risque comptable est cerné. Cette liste ne remplace pas une analyse complète, mais elle écarte les dossiers les plus douteux avant qu\'on ne leur consacre du temps.'
            ]
          }
        ],
        attention: 'Aucune grille de lecture ne protège d\'une fraude délibérée et bien construite. Ces vérifications réduisent le risque, elles ne l\'annulent pas. C\'est une raison supplémentaire de ne jamais concentrer un portefeuille sur une seule valeur.',
        retenir: [
          'Les signaux classiques : bénéfice sans trésorerie, créances et stocks qui gonflent, changements de méthode opportuns.',
          'Un signal isolé ne prouve rien ; c\'est leur accumulation qui compte.',
          'L\'absence d\'explication dans les documents publiés est elle-même une information.',
          'Cinq vérifications en cinq minutes écartent les dossiers les plus douteux.'
        ]
      }
    ]
  });
})(typeof window !== 'undefined' ? window : globalThis);
