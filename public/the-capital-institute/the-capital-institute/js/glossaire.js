/* ═══════════════════════════════════════════════════════════════════
   THE CAPITAL INSTITUTE
   glossaire.js : dictionnaire et banque de questions.

   Le glossaire vise l'usage réel : chaque définition est écrite pour
   quelqu'un qui vient de rencontrer le mot dans un document et veut
   comprendre ce qu'il change à sa décision.

   Les questions sont rattachées aux leçons par leur identifiant. Une
   mauvaise réponse renvoie une explication, jamais un simple verdict :
   se tromper est le moment où l'on apprend le plus, à condition qu'on
   vous dise pourquoi.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ── Glossaire ────────────────────────────────────────────────── */

  global.TCI_GLOSSAIRE = [
    { t: 'Action', c: 'Base', d: 'Part du capital d\'une société. Le détenteur est copropriétaire de l\'entreprise, avec ses actifs et ses dettes, et perçoit une part du bénéfice distribué.' },
    { t: 'Actif circulant', c: 'Comptabilité', d: 'Éléments du bilan destinés à être transformés en argent dans l\'année : stocks, créances clients, trésorerie.' },
    { t: 'Actif net comptable', c: 'Comptabilité', d: 'Capitaux propres du bilan. Ce qui resterait aux actionnaires si tous les actifs étaient vendus à leur valeur comptable et toutes les dettes remboursées.' },
    { t: 'Actualisation', c: 'Valorisation', d: 'Ramener un montant futur à sa valeur d\'aujourd\'hui en le divisant par un taux qui reflète le temps, l\'inflation et le risque.' },
    { t: 'ADX', c: 'Technique', d: 'Indicateur de force d\'une tendance, sans indication de sens. Sous 20, il n\'y a pas de tendance exploitable.' },
    { t: 'Amortissement', c: 'Comptabilité', d: 'Constatation comptable de l\'usure d\'un équipement, étalée sur sa durée d\'utilisation. C\'est une charge qui ne correspond à aucune sortie d\'argent de l\'année.' },
    { t: 'Annexes', c: 'Comptabilité', d: 'Partie des états financiers qui explique les chiffres : méthodes retenues, échéances des dettes, litiges, engagements hors bilan. Souvent plus informative que les chiffres eux-mêmes.' },
    { t: 'ATR', c: 'Technique', d: 'Amplitude vraie moyenne. Mesure de combien un titre bouge dans une séance ordinaire, écarts d\'ouverture compris. Sert à calibrer les stops.' },
    { t: 'Augmentation de capital', c: 'Opérations', d: 'Émission d\'actions nouvelles par la société. Les actionnaires qui n\'y participent pas voient leur part relative diminuer.' },
    { t: 'Autonomie financière', c: 'Ratios', d: 'Capitaux propres rapportés au total du bilan. Au-dessus de 40 %, l\'indépendance vis-à-vis des créanciers est confortable.' },
    { t: 'Backtest', c: 'Technique', d: 'Simulation d\'une stratégie sur des données passées. Utile pour l\'ordre de grandeur du risque, trompeur si l\'on optimise les réglages sur les mêmes données.' },
    { t: 'Bénéfice par action', c: 'Ratios', d: 'Résultat net divisé par le nombre d\'actions. Base du calcul du PER.' },
    { t: 'Beta', c: 'Risque', d: 'Sensibilité d\'un titre aux mouvements du marché. Un beta de 1,3 signifie qu\'historiquement le titre amplifiait de 30 % les variations de l\'indice.' },
    { t: 'Bilan', c: 'Comptabilité', d: 'Photographie du patrimoine à une date donnée : ce que la société possède à gauche, d\'où vient l\'argent qui l\'a financé à droite.' },
    { t: 'Bollinger (bandes de)', c: 'Technique', d: 'Enveloppe à deux écarts-types autour de la moyenne mobile. Leur resserrement signale une compression de volatilité, sans indiquer le sens de la sortie.' },
    { t: 'BRVM', c: 'Marché', d: 'Bourse Régionale des Valeurs Mobilières, place unique commune aux huit pays de l\'UEMOA, siège à Abidjan.' },
    { t: 'BRVM Composite', c: 'Marché', d: 'Indice couvrant l\'ensemble des sociétés cotées, référence générale du marché régional.' },
    { t: 'Capitalisation boursière', c: 'Marché', d: 'Cours multiplié par le nombre d\'actions. Ce que le marché estime valoir la totalité des fonds propres de la société.' },
    { t: 'Capitaux propres', c: 'Comptabilité', d: 'Argent apporté par les actionnaires augmenté des bénéfices conservés. Matelas qui absorbe les pertes avant que les créanciers ne soient touchés.' },
    { t: 'Chandelier japonais', c: 'Technique', d: 'Représentation graphique d\'une séance par quatre chiffres : ouverture, plus haut, plus bas, clôture.' },
    { t: 'Chiffre d\'affaires', c: 'Comptabilité', d: 'Total des ventes de l\'exercice, avant toute charge. Point de départ du compte de résultat.' },
    { t: 'Commissaire aux comptes', c: 'Comptabilité', d: 'Professionnel indépendant qui certifie que les comptes sont réguliers et sincères. Ses réserves éventuelles constituent une information de premier ordre.' },
    { t: 'Compte de résultat', c: 'Comptabilité', d: 'Document retraçant l\'activité d\'une période, du chiffre d\'affaires jusqu\'au résultat net.' },
    { t: 'Coupon', c: 'Base', d: 'Intérêt versé au détenteur d\'une obligation, à échéances fixées à l\'avance.' },
    { t: 'Créance douteuse', c: 'Banque', d: 'Crédit dont le remboursement est compromis. Sa part dans le portefeuille mesure la qualité du risque d\'une banque.' },
    { t: 'Croisement doré', c: 'Technique', d: 'Passage d\'une moyenne mobile courte au-dessus d\'une moyenne longue. Signal de tendance lent mais structurant.' },
    { t: 'Croissance perpétuelle', c: 'Valorisation', d: 'Taux de croissance supposé au-delà de l\'horizon de prévision d\'un DCF. Ne peut excéder durablement la croissance de l\'économie.' },
    { t: 'DCF', c: 'Valorisation', d: 'Actualisation des flux de trésorerie. Estime la valeur d\'une société par la somme actualisée de la trésorerie qu\'elle produira.' },
    { t: 'DCF inversé', c: 'Valorisation', d: 'Démarche retournée : chercher quelle croissance le cours actuel suppose déjà, plutôt que calculer une valeur.' },
    { t: 'Dépositaire central', c: 'Marché', d: 'Institution qui assure le règlement des espèces et la livraison des titres après une transaction.' },
    { t: 'Détachement', c: 'Opérations', d: 'Date à partir de laquelle le titre se négocie sans droit au dividende. Le cours baisse mécaniquement du montant détaché.' },
    { t: 'Dette nette', c: 'Ratios', d: 'Dette financière diminuée de la trésorerie disponible. C\'est la dette qui compte réellement.' },
    { t: 'Dilution', c: 'Opérations', d: 'Diminution de la part relative d\'un actionnaire après une émission d\'actions nouvelles à laquelle il n\'a pas participé.' },
    { t: 'Divergence', c: 'Technique', d: 'Désaccord entre la direction du cours et celle d\'un oscillateur. Avertissement d\'essoufflement, jamais signal d\'entrée à lui seul.' },
    { t: 'Dividende', c: 'Base', d: 'Part du bénéfice distribuée aux actionnaires, décidée chaque année par l\'assemblée générale. Jamais garanti.' },
    { t: 'DuPont (décomposition)', c: 'Ratios', d: 'Décomposition du ROE en marge nette, rotation des actifs et levier financier. Révèle si la rentabilité vient de la performance ou de la dette.' },
    { t: 'Effet de levier', c: 'Risque', d: 'Amplification des résultats par la dette. Elle amplifie les gains et les pertes dans les mêmes proportions.' },
    { t: 'Engagement hors bilan', c: 'Comptabilité', d: 'Obligation qui n\'apparaît pas au bilan mais expose la société : cautions, garanties, litiges. Figure en annexe.' },
    { t: 'Fixing', c: 'Marché', d: 'Mode de cotation où les ordres sont accumulés puis confrontés à un instant donné pour déterminer un prix unique. Mode dominant sur la BRVM.' },
    { t: 'Flux de trésorerie libre', c: 'Comptabilité', d: 'Argent restant après financement de l\'activité et des investissements. Le chiffre le plus difficile à maquiller.' },
    { t: 'Fonds d\'urgence', c: 'Gestion', d: 'Épargne immédiatement disponible équivalant à trois à six mois de dépenses. Doit précéder tout investissement en actions.' },
    { t: 'Gearing', c: 'Ratios', d: 'Dette financière rapportée aux capitaux propres. Sous 0,5, structure prudente ; au-delà de 1, sensibilité accrue aux à-coups.' },
    { t: 'Gordon-Shapiro', c: 'Valorisation', d: 'Modèle valorisant une action par ses dividendes futurs supposés croître à taux constant. Adapté aux sociétés matures et distributrices.' },
    { t: 'Graham (nombre de)', c: 'Valorisation', d: 'Borne de valorisation prudente : racine carrée de 22,5 fois le bénéfice par action fois l\'actif net par action.' },
    { t: 'Hurst (exposant de)', c: 'Risque', d: 'Mesure si une série prolonge ses mouvements ou revient vers sa moyenne. Au-dessus de 0,55, les tendances persistent.' },
    { t: 'Ichimoku', c: 'Technique', d: 'Système japonais combinant deux lignes rapides et un nuage projeté en avant qui matérialise le support futur.' },
    { t: 'Indice', c: 'Marché', d: 'Chiffre résumant l\'évolution d\'un ensemble de valeurs. Sert de référence pour juger une performance.' },
    { t: 'Introduction en bourse', c: 'Marché', d: 'Première cotation des actions d\'une société. C\'est l\'occasion où l\'argent des investisseurs va effectivement à l\'entreprise.' },
    { t: 'Liquidité', c: 'Marché', d: 'Capacité à acheter ou vendre une quantité donnée sans déplacer le cours. Sur un marché étroit, c\'est le premier critère de sélection.' },
    { t: 'MACD', c: 'Technique', d: 'Écart entre deux moyennes exponentielles comparé à sa propre moyenne. L\'histogramme mesure l\'accélération et se retourne avant les lignes.' },
    { t: 'Marché primaire', c: 'Marché', d: 'Marché où les titres sont créés et vendus pour la première fois. L\'argent va à la société émettrice.' },
    { t: 'Marché secondaire', c: 'Marché', d: 'Marché où les titres existants s\'échangent entre investisseurs. L\'argent ne va pas à la société.' },
    { t: 'Marge de sécurité', c: 'Valorisation', d: 'Écart entre la valeur estimée et le cours payé. Protection contre ses propres erreurs d\'estimation.' },
    { t: 'Marge nette', c: 'Ratios', d: 'Résultat net rapporté au chiffre d\'affaires. Ne se compare qu\'à l\'intérieur d\'un même secteur.' },
    { t: 'Moyenne mobile', c: 'Technique', d: 'Moyenne des cours sur les N dernières séances, recalculée chaque jour. Lisse le bruit pour dégager la direction.' },
    { t: 'Obligation', c: 'Base', d: 'Titre de créance. Le porteur a prêté de l\'argent et perçoit un intérêt fixe, avec remboursement à une date connue.' },
    { t: 'OBV', c: 'Technique', d: 'Cumul des volumes affectés du signe de la séance. Seule sa direction compte, jamais son niveau.' },
    { t: 'Ordre à cours limité', c: 'Pratique', d: 'Ordre fixant le prix maximal à l\'achat ou minimal à la vente. Prix maîtrisé, exécution incertaine.' },
    { t: 'Ordre au marché', c: 'Pratique', d: 'Ordre exécuté immédiatement au meilleur prix disponible. Exécution certaine, prix incertain.' },
    { t: 'Payout', c: 'Ratios', d: 'Taux de distribution : part du bénéfice reversée en dividende. Au-delà de 80 %, la marge de manœuvre devient mince.' },
    { t: 'PEG', c: 'Ratios', d: 'PER divisé par le taux de croissance attendu des bénéfices. Sous 1, la croissance n\'est pas entièrement payée.' },
    { t: 'PER', c: 'Ratios', d: 'Cours rapporté au bénéfice par action. Ne s\'interprète que par comparaison aux concurrents, à l\'historique et à la croissance.' },
    { t: 'Piège de valeur', c: 'Valorisation', d: 'Société perpétuellement bon marché dont le cours baisse aussi vite que les bénéfices. Le multiple ne se normalise jamais.' },
    { t: 'Piotroski (score de)', c: 'Ratios', d: 'Neuf tests binaires sur la qualité financière. À partir de 7, la santé s\'améliore sur tous les fronts.' },
    { t: 'Plus-value', c: 'Base', d: 'Différence positive entre le prix de vente et le prix d\'achat d\'un titre.' },
    { t: 'Prime de risque', c: 'Valorisation', d: 'Surcroît de rendement exigé pour détenir des actions plutôt qu\'un placement sans risque.' },
    { t: 'Provision', c: 'Comptabilité', d: 'Charge constatée pour un risque probable dont le montant ou l\'échéance est incertain. Sa reprise gonfle le résultat sans activité nouvelle.' },
    { t: 'Rendement du dividende', c: 'Ratios', d: 'Dividende annuel rapporté au cours. Un rendement anormalement élevé signale souvent une coupe anticipée.' },
    { t: 'Rééquilibrage', c: 'Gestion', d: 'Retour périodique à l\'allocation cible. Revient mécaniquement à vendre ce qui a monté et acheter ce qui a baissé.' },
    { t: 'Résistance', c: 'Technique', d: 'Niveau où les vendeurs se sont manifestés à plusieurs reprises, arrêtant la hausse. Une fois cassée, elle devient souvent un support.' },
    { t: 'Résultat brut d\'exploitation', c: 'Comptabilité', d: 'Ce que le métier rapporte avant amortissements, financement et impôt. Le niveau le plus comparable entre sociétés.' },
    { t: 'Résultat net', c: 'Comptabilité', d: 'Ce qui reste après toutes les charges, intérêts et impôts. Le poste le plus facile à habiller comptablement.' },
    { t: 'ROA', c: 'Ratios', d: 'Rentabilité des actifs : résultat net rapporté au total du bilan. Insensible à la structure de financement.' },
    { t: 'ROE', c: 'Ratios', d: 'Rentabilité des capitaux propres. Au-dessus de 15 % durablement, la société crée de la valeur pour ses actionnaires.' },
    { t: 'RSI', c: 'Technique', d: 'Force relative des hausses face aux baisses, de 0 à 100. En tendance forte, un RSI élevé peut le rester longtemps.' },
    { t: 'SGI', c: 'Marché', d: 'Société de gestion et d\'intermédiation, seule habilitée à transmettre les ordres d\'un particulier au marché.' },
    { t: 'Sharpe (ratio de)', c: 'Risque', d: 'Rendement au-delà du taux sans risque, rapporté à la volatilité. Autour de 1, la rémunération du risque est correcte.' },
    { t: 'Sortino (ratio de)', c: 'Risque', d: 'Variante du Sharpe qui ne pénalise que la volatilité baissière. Plus juste du point de vue d\'un investisseur.' },
    { t: 'Split', c: 'Opérations', d: 'Division du nominal : une action est remplacée par plusieurs, sans changement de valeur totale. Améliore parfois la liquidité.' },
    { t: 'Stop', c: 'Pratique', d: 'Niveau d\'invalidation défini à l\'avance, au-delà duquel on sort de la position. Doit être calibré en multiples d\'ATR.' },
    { t: 'Support', c: 'Technique', d: 'Niveau où les acheteurs se sont manifestés à plusieurs reprises, arrêtant la baisse.' },
    { t: 'SuperTrend', c: 'Technique', d: 'Ligne de suivi calée sur l\'ATR qui bascule au retournement de tendance. Fournit un stop suiveur objectif.' },
    { t: 'TCAM', c: 'Ratios', d: 'Taux de croissance annuel moyen. Ne se calcule qu\'entre deux bornes strictement positives.' },
    { t: 'UEMOA', c: 'Marché', d: 'Union Économique et Monétaire Ouest-Africaine, huit États partageant une monnaie et une bourse commune.' },
    { t: 'Valeur d\'entreprise', c: 'Valorisation', d: 'Capitalisation boursière augmentée de la dette nette. Ce que coûterait le rachat de la totalité de l\'activité.' },
    { t: 'Valeur terminale', c: 'Valorisation', d: 'Valeur attribuée à tout ce qui vient après l\'horizon de prévision. Pèse couramment 60 à 80 % d\'un DCF.' },
    { t: 'VaR', c: 'Risque', d: 'Valeur en risque : perte quotidienne dépassée dans un faible pourcentage des séances. Ne dit rien de ce qui se passe au-delà du seuil.' },
    { t: 'Volatilité', c: 'Risque', d: 'Ampleur typique des variations, généralement annualisée. Traite hausses et baisses de la même façon.' },
    { t: 'Volume', c: 'Marché', d: 'Nombre de titres échangés dans la séance. Un volume nul signifie absence de transaction, pas stabilité.' },
    { t: 'WACC', c: 'Valorisation', d: 'Coût moyen pondéré du capital. Taux de rentabilité exigé collectivement par les actionnaires et les créanciers.' }
  ];

  /* ── Banque de questions ──────────────────────────────────────── */

  global.TCI_QUESTIONS = {

    /* Parcours 1 */
    d1: [
      { q: 'Vous détenez 1 000 actions d\'une société qui en a émis 10 millions. Que possédez-vous ?', r: ['Un dix-millième de l\'entreprise, dettes comprises', 'Un droit sur 1 000 francs de son capital', 'Le droit de récupérer votre mise à tout moment', 'Une créance sur la société'], b: 0, e: 'Une action est une fraction du capital. Vous êtes copropriétaire de tout : les actifs comme les dettes. Vous n\'avez aucun droit de remboursement, contrairement à un créancier.' },
      { q: 'En cas de faillite, dans quel ordre les parties sont-elles servies ?', r: ['Les actionnaires d\'abord, puis les créanciers', 'Les créanciers d\'abord, les actionnaires en dernier', 'Tous au même rang, au prorata', 'L\'ordre dépend de la décision du tribunal'], b: 1, e: 'Les actionnaires passent en dernier, souvent avec rien. C\'est précisément cette position qui justifie qu\'une action rapporte davantage en moyenne : le surcroît de rendement est le prix du risque.' },
      { q: 'Sur la BRVM, quelle particularité concerne le rendement de l\'actionnaire ?', r: ['Les plus-values dominent le rendement total', 'Le dividende y pèse souvent plus lourd qu\'ailleurs', 'Le rendement est garanti par le régulateur', 'Il n\'y a pas de dividendes sur ce marché'], b: 1, e: 'Le marché étant peu liquide et les plus-values lentes à se matérialiser, le dividende constitue souvent la majeure partie du rendement total sur plusieurs années.' }
    ],
    d2: [
      { q: 'Vous achetez une action Sonatel en séance. Où va votre argent ?', r: ['À Sonatel, qui l\'utilise pour investir', 'À l\'actionnaire qui vous vend son titre', 'À la BRVM au titre des frais', 'Il est bloqué jusqu\'au versement du dividende'], b: 1, e: 'C\'est le marché secondaire : les titres circulent entre investisseurs. Seule une introduction en bourse ou une augmentation de capital apporte de l\'argent à la société.' },
      { q: 'Quel est le service central rendu par une bourse ?', r: ['Garantir la hausse des cours', 'Fixer la valeur des entreprises', 'La liquidité : pouvoir vendre sans casser le prix', 'Protéger les investisseurs contre les pertes'], b: 2, e: 'Sans bourse, revendre une part d\'entreprise supposerait de trouver soi-même un acheteur et de négocier sans référence de prix. La liquidité est le service, et elle varie énormément d\'un titre à l\'autre.' },
      { q: 'Comment faut-il considérer le prix de marché ?', r: ['Il a toujours raison', 'Il ne veut rien dire', 'Il contient beaucoup d\'information, sans être infaillible', 'Il reflète exactement la valeur comptable'], b: 2, e: 'Le mépriser conduit à se croire plus malin que tout le monde ; le sacraliser conduit à ignorer les bulles. La position raisonnable : il faut de bonnes raisons, explicitement formulées, pour s\'en écarter.' }
    ],
    d3: [
      { q: 'Que représente exactement le cours affiché d\'un titre ?', r: ['La valeur de la société divisée par le nombre d\'actions', 'Le prix de la dernière transaction conclue', 'La moyenne des offres d\'achat et de vente', 'Le prix fixé par le régulateur'], b: 1, e: 'Le cours est le point où deux personnes se sont mises d\'accord, pour une quantité donnée. Si la dernière transaction a porté sur dix titres, le cours repose sur dix titres.' },
      { q: 'Selon la formule attribuée à Benjamin Graham, le marché est…', r: ['Une machine à voter à long terme, à peser à court terme', 'Une machine à voter à court terme, à peser à long terme', 'Toujours une machine à peser', 'Toujours imprévisible'], b: 1, e: 'À court terme les cours suivent les anticipations, qui sont bruyantes et changeantes. À long terme ils suivent les bénéfices, lentement et implacablement.' },
      { q: 'Une valeur peu liquide varie de 6 % dans la séance. Que faut-il vérifier en premier ?', r: ['L\'actualité du secteur', 'Le volume échangé', 'Le PER du titre', 'La tendance de l\'indice'], b: 1, e: 'Sur un titre étroit, une variation importante peut ne refléter qu\'une seule transaction de faible volume. Sans volume, le mouvement n\'a pas de contenu informatif.' }
    ],
    d4: [
      { q: 'Quel est le risque principal d\'un ordre au marché sur une valeur étroite ?', r: ['Ne pas être exécuté', 'Être exécuté à un prix bien supérieur à celui affiché', 'Être annulé par la SGI', 'Payer des frais plus élevés'], b: 1, e: 'L\'ordre au marché consomme le carnet ligne par ligne. Sur un titre étroit, il n\'y a que quelques titres au prix affiché et le reste se paie beaucoup plus cher.' },
      { q: 'Quel ordre privilégier par défaut sur la BRVM ?', r: ['L\'ordre au marché, pour être sûr d\'être servi', 'L\'ordre à cours limité', 'Aucun des deux, il faut passer par téléphone', 'Cela dépend uniquement du montant'], b: 1, e: 'L\'ordre limité protège contre une exécution aberrante et oblige à décider à l\'avance ce que le titre vaut pour vous. Sur un marché étroit, il devrait être le réflexe par défaut.' },
      { q: 'Comment acheter une quantité importante sans déplacer le cours ?', r: ['Passer un ordre au marché pour tout d\'un coup', 'Fractionner l\'ordre sur plusieurs séances', 'Acheter uniquement à l\'ouverture', 'Passer par plusieurs SGI simultanément'], b: 1, e: 'Fractionner fait perdre du temps mais évite de consommer tout le carnet et de faire monter le cours contre soi.' }
    ],
    d5: [
      { q: 'Un aller-retour coûte environ 2 % sur la BRVM. Que faut-il en conclure ?', r: ['Que les frais sont négligeables', 'Qu\'un titre doit progresser de 2 % rien que pour rentrer dans ses frais', 'Que seuls les gros ordres sont rentables', 'Que les frais sont remboursés au dividende'], b: 1, e: 'Une stratégie qui gagne 1,5 % par opération en moyenne perd en réalité de l\'argent une fois les frais déduits. Ce seuil change complètement l\'évaluation d\'une méthode.' },
      { q: 'Quelle est la cause la plus banale des mauvaises performances individuelles ?', r: ['Une mauvaise sélection de titres', 'Un excès d\'activité', 'La fiscalité', 'Le manque d\'information'], b: 1, e: 'Deux opérations par an coûtent environ 4 % de frais ; une par mois en coûte vingt-quatre, soit davantage que le rendement historique du marché. Ce n\'est pas un défaut d\'analyse, c\'est un excès d\'agitation.' },
      { q: 'Quel coût n\'apparaît sur aucun relevé ?', r: ['La commission de la SGI', 'Les frais de marché', 'L\'écart entre les meilleures offres d\'achat et de vente', 'Les droits de garde'], b: 2, e: 'Acheter à 5 100 alors qu\'on ne pourrait revendre qu\'à 4 900 fait perdre 4 % à l\'instant de la transaction. Sur les valeurs étroites, cet écart dépasse souvent les frais officiels.' }
    ],

    /* Parcours 2 */
    b1: [
      { q: 'Combien de pays partagent la BRVM ?', r: ['Cinq', 'Huit', 'Douze', 'Un seul, la Côte d\'Ivoire'], b: 1, e: 'Bénin, Burkina Faso, Côte d\'Ivoire, Guinée-Bissau, Mali, Niger, Sénégal et Togo, avec un siège à Abidjan et une antenne dans chaque État.' },
      { q: 'Que supprime l\'union monétaire pour un investisseur de la zone ?', r: ['Le risque politique', 'Le risque de change entre les huit pays', 'Le risque de faillite des sociétés', 'La corrélation entre les économies'], b: 1, e: 'Un Sénégalais achète une société ivoirienne sans risque de change ni formalité. En revanche, les risques politiques et la corrélation des économies demeurent entiers.' },
      { q: 'Pourquoi la diversification est-elle difficile sur la BRVM ?', r: ['Les frais sont trop élevés', 'La cote est concentrée sur peu de valeurs et de secteurs', 'Le régulateur limite le nombre de lignes', 'Il n\'y a qu\'un seul secteur coté'], b: 1, e: 'Un petit nombre de valeurs représente l\'essentiel de la capitalisation et des échanges, et les huit économies réagissent souvent aux mêmes chocs.' }
    ],
    b2: [
      { q: 'Par qui un particulier passe-t-il pour transmettre un ordre en bourse ?', r: ['Directement par la BRVM', 'Par une société de gestion et d\'intermédiation agréée', 'Par sa banque commerciale uniquement', 'Par le dépositaire central'], b: 1, e: 'La SGI est l\'interlocuteur unique : ouverture de compte, ordres, conservation des titres, versement des dividendes. Vérifiez toujours son agrément auprès du régulateur.' },
      { q: 'Une plateforme non agréée promet 20 % garantis. Que faire ?', r: ['Investir un petit montant pour tester', 'Vérifier auprès du régulateur puis, en l\'absence d\'agrément, s\'abstenir', 'Demander un contrat écrit et investir', 'Investir si un proche l\'a déjà fait'], b: 1, e: 'Un rendement garanti à deux chiffres sur un marché dont le rendement moyen est de 8 à 10 % est un mensonge. Les escroqueries circulent par les réseaux d\'affinité, précisément parce que la confiance court-circuite la vérification.' }
    ],
    b3: [
      { q: 'Qu\'est-ce que la cotation par fixing ?', r: ['Une cotation en continu toute la journée', 'Une accumulation d\'ordres puis détermination d\'un prix unique', 'Une cotation fixée par le régulateur', 'Une cotation réservée aux gros ordres'], b: 1, e: 'Concentrer les échanges à un instant précis crée davantage de contrepartie que de les disperser, ce qui convient à un marché où les ordres sont peu nombreux.' },
      { q: 'Que fait réellement une limite de variation quotidienne ?', r: ['Elle empêche les baisses importantes', 'Elle étale les mouvements sur plusieurs séances', 'Elle garantit un prix minimum', 'Elle annule les ordres excessifs'], b: 1, e: 'Une valeur qui doit corriger de 30 % enchaînera plusieurs séances de baisse limitée, pendant lesquelles vous ne trouverez pas d\'acheteur. La limite ne supprime pas la baisse.' },
      { q: 'L\'indice monte de 2 % mais la majorité des valeurs baisse. Est-ce possible ?', r: ['Non, c\'est contradictoire', 'Oui, si les plus grosses capitalisations progressent', 'Oui, mais uniquement en cas d\'erreur de calcul', 'Non, sauf suspension de cotation'], b: 1, e: 'Un indice pondéré par la capitalisation reflète surtout ses plus lourdes composantes. Une hausse de l\'indice peut masquer une baisse générale.' }
    ],
    b4: [
      { q: 'Quels indicateurs mesurent la liquidité d\'un titre ?', r: ['Le PER et le rendement', 'Volume moyen, part de séances traitées, écart offre-demande', 'La capitalisation et le nombre d\'actionnaires', 'La volatilité et le beta'], b: 1, e: 'Un titre qui ne cote que trois jours sur dix pose un problème que le volume moyen masque. Les trois indicateurs se lisent ensemble.' },
      { q: 'Un titre n\'échange rien pendant cinq séances. Que faut-il en conclure ?', r: ['Que le cours est stable et le risque faible', 'Qu\'aucune transaction n\'a eu lieu et que le cours n\'a plus de contenu informatif', 'Que le titre va monter', 'Que la cotation est suspendue'], b: 1, e: 'Ne jamais confondre absence de mouvement et absence de risque. Le cours affiché n\'a simplement pas été confronté au marché.' },
      { q: 'Quand faut-il décider de la taille d\'une position ?', r: ['Au moment de la vente, selon son besoin', 'À l\'achat, en fonction de la liquidité', 'Après les premiers résultats', 'Quand le cours atteint l\'objectif'], b: 1, e: 'La liquidité disparaît précisément quand on en a besoin. Ne détenez jamais plus de quelques jours de volume moyen sur une valeur.' }
    ],
    b5: [
      { q: 'Pourquoi le cours baisse-t-il à la date de détachement du dividende ?', r: ['Parce que les investisseurs vendent massivement', 'Parce que la société a sorti de la trésorerie de son bilan', 'Parce que le régulateur l\'impose', 'C\'est un mauvais signal sur les résultats'], b: 1, e: 'Vous n\'avez rien perdu : une partie de votre valeur a simplement changé de poche. Acheter juste avant le détachement n\'apporte donc rien.' },
      { q: 'Une société procède à une augmentation de capital. Que vérifier en priorité ?', r: ['Le nombre d\'actions créées uniquement', 'À quoi sert l\'argent levé', 'Le cours du jour', 'La date de l\'assemblée générale'], b: 1, e: 'Financer une croissance rentable n\'a rien à voir avec combler des pertes. Si vous ne participez pas, votre part relative diminue dans les deux cas.' }
    ],

    /* Parcours 3 */
    e1: [
      { q: 'Dans quel ordre est-il recommandé de lire les états financiers ?', r: ['Résultat, bilan, flux', 'Flux, bilan, résultat', 'Bilan, résultat, flux', 'Peu importe'], b: 1, e: 'Commencer par les flux protège contre l\'effet de séduction d\'un beau bénéfice. La question première est de savoir si l\'activité produit de l\'argent.' },
      { q: 'Lequel des trois documents est le plus difficile à habiller comptablement ?', r: ['Le compte de résultat', 'Le bilan', 'Le tableau des flux de trésorerie', 'Les trois autant'], b: 2, e: 'On peut habiller un bénéfice par des écritures ; on ne peut pas habiller un compte en banque. C\'est le document le moins commenté et le plus important.' }
    ],
    e2: [
      { q: 'Pourquoi le résultat brut d\'exploitation est-il le plus comparable entre sociétés ?', r: ['Parce qu\'il inclut les amortissements', 'Parce qu\'il neutralise la structure de dette et la fiscalité', 'Parce qu\'il est certifié séparément', 'Parce qu\'il inclut les investissements'], b: 1, e: 'Deux sociétés du même métier peuvent afficher des résultats nets très différents pour des raisons de financement ou de fiscalité. Attention toutefois : il ignore complètement les investissements nécessaires.' },
      { q: 'Le résultat net bondit de 40 % alors que le chiffre d\'affaires stagne. Que faire ?', r: ['Se réjouir et acheter', 'Chercher l\'élément non récurrent dans les annexes', 'Extrapoler cette croissance sur cinq ans', 'Vendre immédiatement'], b: 1, e: 'Une cession d\'immeuble, une indemnité ou une reprise de provision gonflent un résultat sans rien dire de la performance opérationnelle. Ces éléments ne se reproduisent pas.' }
    ],
    e3: [
      { q: 'Que signifient des capitaux propres négatifs ?', r: ['Que la société n\'a pas encore distribué de dividende', 'Que les pertes accumulées ont dépassé tout ce que les actionnaires ont apporté', 'Que la société est très rentable', 'Que le bilan est mal présenté'], b: 1, e: 'La société ne vaut plus rien comptablement et survit par la tolérance de ses créanciers. C\'est un signal d\'alarme, pas une nuance.' },
      { q: 'Une banque affiche une autonomie financière de 9 %. Faut-il s\'inquiéter ?', r: ['Oui, c\'est très en dessous du seuil de 40 %', 'Non, c\'est structurel : son métier est de collecter des dépôts pour les prêter', 'Oui, elle est en faillite technique', 'Impossible à dire sans le PER'], b: 1, e: 'Les critères industriels ne sont pas transposables aux banques. On les évalue par le ratio de solvabilité réglementaire, la part des créances douteuses et le coût du risque.' }
    ],
    e4: [
      { q: 'Comment calcule-t-on le flux de trésorerie libre ?', r: ['Résultat net moins dividendes', 'Flux d\'exploitation moins investissements', 'Chiffre d\'affaires moins charges', 'Trésorerie de fin moins trésorerie de début'], b: 1, e: 'C\'est l\'argent réellement disponible une fois l\'activité financée et l\'outil entretenu. Il se lit sur plusieurs années, jamais sur une seule.' },
      { q: 'Le flux d\'exploitation représente 0,5 fois le résultat net depuis trois ans. Que suggère ce ratio ?', r: ['Une excellente conversion des bénéfices', 'Qu\'une part importante du résultat reste immobilisée en créances ou en stocks', 'Que la société investit beaucoup', 'Que le dividende est trop élevé'], b: 1, e: 'Durablement en dessous de 0,7, ce ratio signale que les bénéfices ne se transforment pas en argent. C\'est l\'indicateur qui a détecté par avance la plupart des grandes défaillances comptables.' }
    ],
    e5: [
      { q: 'Où trouve-t-on les engagements hors bilan ?', r: ['Dans le compte de résultat', 'Dans les annexes', 'Dans le rapport de gestion uniquement', 'Ils ne sont jamais publiés'], b: 1, e: 'Cautions, garanties, contrats de location longue durée et litiges peuvent représenter des montants comparables à la dette inscrite au bilan.' },
      { q: 'Quelle mention du commissaire aux comptes est la plus grave ?', r: ['Une certification sans réserve', 'Une observation sur la continuité de l\'exploitation', 'Un changement de méthode signalé', 'Un retard de publication'], b: 1, e: 'Cette mention signifie que la capacité de la société à poursuivre son activité est mise en doute. Elle ne demande aucune compétence technique pour être comprise, seulement la peine de lire deux pages.' }
    ],
    e6: [
      { q: 'Vous relevez un signal d\'alerte comptable isolé. Que conclure ?', r: ['Vendre immédiatement', 'Rien : un signal isolé peut avoir une explication légitime', 'Que les comptes sont truqués', 'Ignorer complètement'], b: 1, e: 'Des stocks qui gonflent peuvent préparer une saison forte. C\'est l\'accumulation de signaux concordants qui doit alerter, pas leur présence isolée.' },
      { q: 'Que faire si l\'on ne trouve aucune explication à une anomalie dans les documents publiés ?', r: ['Considérer que tout va bien', 'Considérer que l\'absence d\'explication est elle-même une information', 'Contacter directement le dirigeant', 'Attendre l\'exercice suivant'], b: 1, e: 'Une société qui publie une anomalie sans l\'expliquer choisit de ne pas l\'expliquer. Ce choix vous renseigne.' }
    ],

    /* Parcours 4 */
    f1: [
      { q: 'Deux sociétés affichent un ROE de 18 %. La première a une marge de 15 % et peu de dette, la seconde une marge de 3 % et un levier de six. Que conclure ?', r: ['Elles se valent, le ROE est identique', 'La première mérite une prime, la seconde une décote', 'La seconde est meilleure car plus efficace', 'Le ROE ne veut rien dire'], b: 1, e: 'C\'est exactement ce que révèle la décomposition de DuPont. Un ROE obtenu par le levier n\'est pas une performance mais un pari : en cas de retournement, le levier amplifie les pertes.' },
      { q: 'Une société dégage 5 % de ROE alors que ses actionnaires exigent 14 %. Que se passe-t-il ?', r: ['Elle crée de la valeur car elle est bénéficiaire', 'Elle détruit de la valeur malgré son bénéfice comptable', 'Elle est à l\'équilibre', 'Le calcul est nécessairement faux'], b: 1, e: 'Sous le coût du capital, une société appauvrit ses propriétaires chaque année, même en affichant un bénéfice. C\'est une distinction que le compte de résultat ne fait pas apparaître.' }
    ],
    f2: [
      { q: 'Quelle question poser pour juger si une dette est trop élevée ?', r: ['Est-elle supérieure à la moyenne du secteur ?', 'Que se passe-t-il si le chiffre d\'affaires baisse de 30 % pendant deux ans ?', 'Le taux d\'intérêt est-il élevé ?', 'La dette est-elle à long terme ?'], b: 1, e: 'Le niveau acceptable dépend entièrement de la régularité des flux. Un opérateur télécom porte sans risque ce qui menacerait un producteur agricole.' },
      { q: 'La dette nette représente 5 années de résultat brut d\'exploitation. Comment le lire ?', r: ['C\'est confortable', 'La marge de manœuvre a disparu et contraint investissement comme distribution', 'C\'est impossible à interpréter', 'Cela dépend du cours de bourse'], b: 1, e: 'Sous deux ans, la dette est confortable. Entre deux et trois, elle est surveillée. Au-delà de quatre, elle devient contraignante.' }
    ],
    f3: [
      { q: 'À quoi doit-on comparer un PER pour qu\'il informe ?', r: ['À la moyenne mondiale', 'Aux concurrents, à l\'historique du titre et à sa croissance attendue', 'Au taux d\'intérêt de la banque centrale', 'À rien, il se lit seul'], b: 1, e: 'Isolé, un PER ne dit rien. Il ignore la dette et n\'a aucun sens si le bénéfice est négatif ou exceptionnel.' },
      { q: 'Qu\'est-ce qu\'un piège de valeur ?', r: ['Un titre dont le PER augmente sans cesse', 'Une société perpétuellement bon marché dont les bénéfices s\'effondrent aussi vite que le cours', 'Une action interdite à la vente', 'Un titre dont le dividende est trop élevé'], b: 1, e: 'Le multiple ne se normalise jamais parce que le dénominateur s\'effondre. La bonne question n\'est pas « est-ce bon marché ? » mais « pourquoi, et cette raison va-t-elle disparaître ? ».' },
      { q: 'Un titre affiche un PER de 4 et ne cote que deux jours par semaine. Comment l\'interpréter ?', r: ['C\'est une occasion exceptionnelle', 'C\'est en grande partie le prix de l\'illiquidité', 'Le PER est mal calculé', 'Il faut acheter au maximum'], b: 1, e: 'Le marché escompte correctement le fait que vous ne pourrez pas sortir. Sur un marché étroit, la décote de liquidité est réelle et justifiée.' }
    ],
    f4: [
      { q: 'Quelle part du résultat d\'un DCF représente couramment la valeur terminale ?', r: ['Moins de 20 %', 'Entre 30 et 40 %', 'Entre 60 et 80 %', 'Elle est toujours nulle'], b: 2, e: 'L\'essentiel de la valorisation repose donc sur une période qu\'on n\'a même pas modélisée. Au-delà de 85 %, le DCF n\'apporte presque rien de plus qu\'un multiple.' },
      { q: 'Pourquoi une croissance perpétuelle de 8 % est-elle inacceptable ?', r: ['Parce que c\'est trop faible', 'Parce que la société finirait par représenter le PIB entier', 'Parce que le calcul ne converge pas mathématiquement', 'Parce que les régulateurs l\'interdisent'], b: 1, e: 'La croissance perpétuelle ne peut excéder durablement celle de l\'économie. Deux à trois pour cent est la fourchette usuelle.' },
      { q: 'Quel est l\'intérêt principal du DCF inversé ?', r: ['Il donne une valeur plus précise', 'Il transforme une question de finance en question d\'industrie vérifiable', 'Il supprime le besoin d\'hypothèses', 'Il remplace la matrice de sensibilité'], b: 1, e: 'Si le cours suppose 18 % de croissance annuelle pendant cinq ans, on peut se demander si cette société peut réellement tenir ce rythme. C\'est une question concrète, pas un calcul.' }
    ],
    f5: [
      { q: 'Un titre affiche 15 % de rendement alors que la moyenne du marché est de 6 %. Que suspecter ?', r: ['Une excellente occasion', 'Que le marché anticipe une coupe du dividende', 'Une erreur de calcul du régulateur', 'Que la société est très rentable'], b: 1, e: 'Le rendement grimpe soit parce que le dividende monte, soit parce que le cours s\'effondre. Vérifiez le taux de distribution et la couverture par les flux de trésorerie.' },
      { q: 'Quel indicateur mesure le mieux la soutenabilité d\'un dividende ?', r: ['Le rendement', 'Le taux de distribution et la couverture par le flux libre', 'Le PER', 'La capitalisation'], b: 1, e: 'Un rendement de 5 % versé sans interruption depuis quinze ans vaut infiniment mieux qu\'un rendement de 12 % versé une fois. Au-delà de 80 % de distribution, la marge de manœuvre est mince.' }
    ],
    f6: [
      { q: 'Laquelle de ces formulations constitue une invalidation valable ?', r: ['Je vends si ça baisse trop', 'Je vends si la marge d\'exploitation passe sous 8 % deux exercices de suite', 'Je vends quand je serai revenu à mon prix d\'achat', 'Je vends si le marché devient nerveux'], b: 1, e: 'Une invalidation doit être vérifiable sans interprétation : un chiffre, un seuil, une durée. Elle s\'écrit avant l\'achat, parce qu\'on ne raisonne plus de la même façon une fois engagé.' },
      { q: 'Pourquoi tenir un journal de décision ?', r: ['Pour des raisons fiscales', 'Parce que la mémoire réécrit le passé en notre faveur', 'Pour le montrer à sa SGI', 'Pour calculer sa performance'], b: 1, e: 'Sans trace écrite, on se souvient d\'avoir eu raison. Relire deux ans plus tard révèle des régularités qu\'on n\'aurait jamais soupçonnées.' }
    ],

    /* Parcours 5 */
    t1: [
      { q: 'Que fait bien l\'analyse technique ?', r: ['Prédire les cours futurs', 'Situer un cours dans son historique et discipliner la décision', 'Remplacer l\'analyse des états financiers', 'Garantir un taux de réussite'], b: 1, e: 'Elle situe, discipline et cadre le timing. Elle ne prédit pas : tous les indicateurs décrivent le passé sous une forme condensée.' },
      { q: 'Pourquoi l\'analyse technique fonctionne-t-elle mal sur la BRVM ?', r: ['Les données ne sont pas publiées', 'Beaucoup d\'indicateurs supposent une cotation continue et des volumes réguliers', 'Le régulateur l\'interdit', 'Les graphiques sont trop courts'], b: 1, e: 'Sur un titre qui ne cote que trois jours sur dix, un RSI à 14 séances couvre presque deux mois calendaires, et son interprétation habituelle ne tient plus.' }
    ],
    t2: [
      { q: 'Comment se définit mécaniquement une tendance haussière ?', r: ['Par un cours au-dessus de sa moyenne mobile', 'Par une succession de sommets et de creux de plus en plus hauts', 'Par un RSI supérieur à 50', 'Par un volume croissant'], b: 1, e: 'Cette définition ne demande aucune interprétation : elle est vraie ou fausse. Trois horizons coexistent souvent en se contredisant.' },
      { q: 'Que devient fréquemment un support une fois cassé ?', r: ['Il disparaît', 'Il devient une résistance', 'Il double de valeur', 'Il reste un support plus fort'], b: 1, e: 'Ceux qui ont acheté au support et subi la baisse cherchent à revendre à l\'équilibre lorsque le cours y revient, ce qui crée une pression vendeuse à ce niveau.' },
      { q: 'Un niveau testé dix fois sans céder est-il plus solide ?', r: ['Oui, chaque test le renforce', 'Non : chaque test consomme les ordres qui le défendaient et il finit souvent par céder', 'Cela n\'a aucune influence', 'Il devient infranchissable'], b: 1, e: 'C\'est le paradoxe des niveaux très sollicités. Plus ils sont testés, plus les ordres qui les défendaient s\'épuisent.' }
    ],
    t3: [
      { q: 'Quelle configuration de moyennes mobiles est la plus solide ?', r: ['Un croisement isolé de la moyenne à 20', 'L\'empilement : cours au-dessus de MM20, au-dessus de MM50, au-dessus de MM200', 'Des moyennes plates et enchevêtrées', 'Une seule moyenne à 200 séances'], b: 1, e: 'L\'empilement signale une hiérarchie haussière sur tous les horizons, ce qui est bien plus informatif qu\'un croisement isolé.' },
      { q: 'Que faire quand l\'ADX est inférieur à 20 ?', r: ['Suivre les croisements de moyennes', 'Ne pas suivre les croisements : il n\'y a pas de tendance exploitable', 'Doubler les positions', 'Vendre à découvert'], b: 1, e: 'En marché sans direction, les moyennes se croisent sans cesse et génèrent des signaux contradictoires, chacun coûtant des frais et un peu de confiance.' }
    ],
    t4: [
      { q: 'Le RSI dépasse 70 dans une tendance haussière établie. Que faut-il faire ?', r: ['Vendre immédiatement', 'Rien de particulier : c\'est la marque d\'une tendance en bonne santé', 'Vendre la moitié de la position', 'Renforcer massivement'], b: 1, e: 'C\'est le contresens le plus fréquent. En tendance forte, le RSI peut rester au-dessus de 70 pendant des mois. Le seuil ne s\'interprète qu\'en marché sans direction.' },
      { q: 'Comment utiliser correctement une divergence ?', r: ['Vendre dès qu\'elle apparaît', 'Attendre la confirmation par une cassure de niveau', 'L\'ignorer complètement', 'Doubler la position'], b: 1, e: 'La divergence prépare l\'attention, la cassure déclenche l\'action. Prises isolément, les divergences font perdre de l\'argent : certaines ne se résolvent jamais.' },
      { q: 'Quelle partie du MACD se retourne en premier ?', r: ['La ligne de signal', 'L\'histogramme', 'La ligne MACD', 'Les trois simultanément'], b: 1, e: 'L\'histogramme mesure l\'accélération. Son rétrécissement annonce que le mouvement perd de sa force avant même que le cours ne se retourne.' }
    ],
    t5: [
      { q: 'Comment lire un volume de 10 000 titres ?', r: ['C\'est toujours un volume élevé', 'Il faut le rapporter au volume moyen des vingt dernières séances', 'C\'est faible par définition', 'Le volume ne s\'interprète pas'], b: 1, e: 'Dix mille titres sont énormes sur une valeur qui en traite mille, et négligeables sur une valeur qui en traite cent mille.' },
      { q: 'Les bandes de Bollinger se resserrent fortement. Que faut-il en conclure ?', r: ['Le cours va monter', 'Le cours va baisser', 'Une expansion d\'amplitude se prépare, sans indication de sens', 'Le titre est suracheté'], b: 2, e: 'La compression informe sur l\'amplitude à venir, jamais sur la direction. Parier sur un sens pendant une compression revient à jouer à pile ou face avec un enjeu amplifié.' },
      { q: 'Comment calibrer un stop ?', r: ['À 5 % du prix d\'achat systématiquement', 'En multiples d\'ATR, typiquement deux à trois', 'Au plus bas de l\'année', 'Au prix d\'achat'], b: 1, e: 'Un stop plus serré que le mouvement ordinaire du titre sera emporté par le bruit, sans qu\'aucune thèse ait été invalidée.' }
    ],
    t6: [
      { q: 'Quel est le chiffre le plus utile d\'un backtest ?', r: ['Le rendement annuel', 'La perte maximale subie', 'Le nombre d\'opérations', 'Le taux de réussite'], b: 1, e: 'Une stratégie qui rapporte 20 % par an mais impose de traverser une baisse de 45 % ne sera pas tenue. Connaître ce chiffre avant de commencer évite d\'abandonner au pire moment.' },
      { q: 'Qu\'est-ce que le biais d\'anticipation dans un backtest ?', r: ['Anticiper une hausse future', 'Utiliser une information non disponible au moment de la décision', 'Tester sur trop peu d\'opérations', 'Optimiser les réglages'], b: 1, e: 'Entrer à la clôture du jour du signal suppose qu\'on connaissait le signal avant la clôture, ce qui est faux. L\'entrée doit se faire à la séance suivante.' },
      { q: 'En dessous de combien d\'opérations un taux de réussite est-il sans valeur statistique ?', r: ['Dix', 'Trente', 'Cent', 'Mille'], b: 1, e: 'En dessous de trente opérations, les résultats relèvent largement du hasard. Un taux calculé sur huit opérations n\'a aucune valeur.' }
    ],

    /* Parcours 6 */
    r1: [
      { q: 'Capital de 5 millions, risque accepté de 2 %, invalidation à 500 francs sous l\'entrée. Combien de titres ?', r: ['100', '200', '500', '1 000'], b: 1, e: '5 000 000 × 2 % = 100 000 francs de perte acceptée, divisés par 500 francs de risque par titre, soit 200 titres. Pas 300 parce qu\'on y croit, pas 100 parce qu\'on hésite.' },
      { q: 'Après une perte de 50 %, quel gain faut-il pour revenir à l\'équilibre ?', r: ['50 %', '75 %', '100 %', '150 %'], b: 2, e: 'La mathématique est brutale et asymétrique. Éviter les pertes profondes compte davantage que capter les hausses.' },
      { q: 'Plus l\'invalidation est éloignée du prix d\'entrée, la position doit être…', r: ['Plus grande', 'Plus petite', 'Identique', 'Doublée'], b: 1, e: 'Un titre volatil, qui demande un stop large, justifie une position réduite. C\'est contre-intuitif et c\'est la règle.' }
    ],
    r2: [
      { q: 'Que ne réduit pas la diversification ?', r: ['Le risque spécifique à une entreprise', 'Le risque de marché', 'Le risque de fraude sur un titre', 'Le risque de perte d\'un contrat'], b: 1, e: 'Si toute la place baisse de 25 %, un portefeuille diversifié baisse de 25 %. Beaucoup d\'investisseurs se croient protégés et découvrent le contraire à la première baisse d\'ensemble.' },
      { q: 'Un portefeuille de huit banques est-il diversifié ?', r: ['Oui, huit lignes suffisent', 'Non : elles réagissent toutes aux mêmes facteurs', 'Oui si elles sont dans huit pays différents', 'Cela dépend de leur taille'], b: 1, e: 'Le portefeuille se comporte comme une seule position, en plus coûteux en frais. La vraie diversification suppose des activités qui ne réagissent pas aux mêmes facteurs.' },
      { q: 'Quelle part maximale une seule ligne devrait-elle représenter ?', r: ['30 à 40 %', '10 à 15 %', '50 %', 'Aucune limite si la conviction est forte'], b: 1, e: 'Les convictions les plus fortes sont statistiquement celles où l\'on se trompe le plus lourdement.' }
    ],
    r3: [
      { q: 'Quel horizon minimum les actions demandent-elles ?', r: ['Six mois', 'Deux ans', 'Au moins cinq ans', 'Il n\'y a pas de minimum'], b: 2, e: 'C\'est la durée nécessaire pour que la logique des bénéfices l\'emporte sur celle des humeurs. Dix-huit mois est une durée sur laquelle un marché peut parfaitement baisser de 30 %.' },
      { q: 'Que faut-il constituer avant tout investissement en actions ?', r: ['Un portefeuille diversifié', 'Un fonds d\'urgence de trois à six mois de dépenses', 'Une assurance-vie', 'Un compte chez plusieurs SGI'], b: 1, e: 'Sans ce coussin, le premier imprévu vous obligera à vendre, statistiquement au pire moment. Ce n\'est pas une précaution morale mais une nécessité mécanique.' },
      { q: 'Quel argent ne doit jamais être investi en actions ?', r: ['L\'épargne de long terme', 'L\'argent emprunté et celui dont l\'échéance est connue', 'Les revenus du travail', 'Les dividendes reçus'], b: 1, e: 'Le montant investi doit pouvoir baisser de moitié sans changer votre vie quotidienne. Si ce n\'est pas le cas, il est trop élevé.' }
    ],
    r4: [
      { q: 'Qu\'est-ce que l\'effet de disposition ?', r: ['Vendre ses perdants et garder ses gagnants', 'Vendre ses gagnants et garder ses perdants', 'Acheter au plus haut', 'Suivre les recommandations'], b: 1, e: 'Une perte fait environ deux fois plus mal qu\'un gain équivalent ne fait plaisir. Le portefeuille se remplit de mauvaises positions pendant que les bonnes en sortent.' },
      { q: 'Pourquoi « je vendrai quand je serai revenu à mon prix » est-il coûteux ?', r: ['Parce que c\'est fiscalement défavorable', 'Parce que le marché ignore totalement votre prix d\'achat', 'Parce que les frais augmentent', 'Parce que c\'est interdit'], b: 1, e: 'Votre prix d\'achat n\'est une information que pour vous. C\'est le biais d\'ancrage, et il immobilise des capitaux dans des positions sans avenir.' },
      { q: 'Comment combattre efficacement les biais cognitifs ?', r: ['Par la volonté et la discipline mentale', 'Par des garde-fous écrits et mécaniques', 'En lisant davantage d\'analyses', 'En suivant un professionnel'], b: 1, e: 'Personne n\'échappe au biais de confirmation par la seule force de la volonté. Écrire avant d\'acheter ce qui vous ferait changer d\'avis est le seul procédé qui fonctionne.' }
    ],
    r5: [
      { q: 'Qu\'est-ce qui explique l\'essentiel de la performance et du risque d\'un portefeuille ?', r: ['Le choix des titres individuels', 'L\'allocation entre grandes catégories d\'actifs', 'Le moment des achats', 'Le nombre de lignes'], b: 1, e: 'La répartition entre actions, obligations et liquidités pèse bien davantage que la sélection des titres. C\'est la décision qu\'on écrit et à laquelle on se tient.' },
      { q: 'À quelle fréquence rééquilibrer un portefeuille ?', r: ['Chaque semaine', 'Une fois par an', 'Jamais', 'Dès qu\'une ligne bouge de 5 %'], b: 1, e: 'Rééquilibrer plus souvent multiplie les frais pour un bénéfice marginal, et sur un marché peu liquide, cela peut coûter davantage que cela ne rapporte.' },
      { q: 'Quand faut-il agir sur une position ?', r: ['Quand le cours bouge', 'Quand la thèse change', 'Chaque trimestre systématiquement', 'Quand un analyste le recommande'], b: 1, e: 'Ce sont deux événements distincts, et les confondre est la source de la plupart des opérations inutiles.' }
    ],
    r6: [
      { q: 'Quelle est la signature la plus fiable d\'une escroquerie financière ?', r: ['Un site internet mal conçu', 'Un rendement à la fois garanti et élevé', 'Des frais de gestion importants', 'Une société étrangère'], b: 1, e: 'Le rendement et la garantie sont contradictoires : ce qui est garanti rapporte peu, ce qui rapporte beaucoup n\'est pas garanti.' },
      { q: 'On vous rémunère pour amener d\'autres participants. De quoi s\'agit-il ?', r: ['D\'un programme de fidélité classique', 'D\'une pyramide qui s\'effondrera nécessairement', 'D\'un placement collectif réglementé', 'D\'une pratique courante en gestion'], b: 1, e: 'L\'argent des nouveaux entrants sert à payer les anciens. C\'est la définition d\'une pyramide, et l\'effondrement n\'est qu\'une question de temps.' },
      { q: 'On vous demande de payer des frais pour débloquer vos fonds bloqués. Que faire ?', r: ['Payer pour récupérer son argent', 'Refuser : c\'est une seconde escroquerie, généralement menée par les mêmes', 'Négocier le montant', 'Payer la moitié'], b: 1, e: 'Cessez tout versement supplémentaire, rassemblez les preuves, signalez au régulateur et parlez-en. La honte est le meilleur allié des escrocs.' }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
