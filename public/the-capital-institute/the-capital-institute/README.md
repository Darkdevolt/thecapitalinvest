# The Capital Institute

Académie de formation boursière ancrée sur la BRVM et l'UEMOA.

## Ce que contient le dossier

```
the-capital-institute/
├── index.html              page unique de l'application
├── css/
│   └── institute.css       feuille de style
└── js/
    ├── curriculum-1.js     parcours 1 à 3 (16 leçons)
    ├── curriculum-2.js     parcours 4 à 6 (18 leçons)
    ├── glossaire.js        90 définitions + 88 questions
    ├── outils.js           7 calculateurs
    └── app.js              navigation, progression, rendu
```

Six parcours, trente-quatre leçons, quatre-vingt-huit questions, quatre-vingt-dix
définitions et sept calculateurs. Environ 12 500 mots de contenu rédactionnel.

## Installation

Aucun serveur, aucune base de données, aucune dépendance à installer. Le site est
entièrement statique.

**Sur Vercel.** Créez un nouveau projet, déposez le dossier `the-capital-institute`
à la racine du dépôt, et déployez. Vercel sert `index.html` automatiquement.

**Sur un sous-domaine de la plateforme existante.** Copiez le dossier tel quel dans
votre dépôt actuel. Il sera accessible à l'adresse `/the-capital-institute/`. Vous
pouvez ensuite ajouter un lien depuis la barre latérale de l'application.

**En local, pour vérifier.** Ouvrez `index.html` directement dans un navigateur.
Tout fonctionne sans serveur, y compris la progression et les calculateurs.

## Conservation de la progression

La progression est stockée dans le navigateur de l'utilisateur, sous la clé
`tci-progression-v1`. Elle n'est transmise nulle part et ne demande aucun compte.

Conséquence à connaître : effacer les données du site efface la progression, et
celle-ci ne suit pas l'utilisateur d'un appareil à l'autre. L'onglet « Ma
progression » permet de l'exporter en fichier JSON et de la réimporter ailleurs.

## Ajouter ou modifier du contenu

**Une leçon** s'ajoute dans `curriculum-1.js` ou `curriculum-2.js`, dans le tableau
`lecons` du parcours voulu. La structure est la suivante :

```js
{
  id: 'x1',                        // identifiant unique dans tout le programme
  titre: 'Titre de la leçon',
  objectifs: ['…', '…'],           // ce que le lecteur saura à la fin
  sections: [
    { t: 'Titre de section', p: ['paragraphe', 'paragraphe'] }
  ],
  attention: 'Point de vigilance', // facultatif
  retenir: ['…', '…']              // synthèse en fin de leçon
}
```

**Des questions** s'ajoutent dans `glossaire.js`, dans l'objet `TCI_QUESTIONS`, sous
l'identifiant de la leçon :

```js
x1: [
  { q: 'La question ?', r: ['A', 'B', 'C', 'D'], b: 2, e: 'Pourquoi C est la bonne réponse.' }
]
```

`b` est l'indice de la bonne réponse, à partir de zéro. Le champ `e` est obligatoire :
une mauvaise réponse doit toujours renvoyer une explication, jamais un simple verdict.

**Un terme de glossaire** s'ajoute dans le tableau `TCI_GLOSSAIRE` avec trois champs :
`t` le terme, `c` la catégorie, `d` la définition. Les termes de plus de trois
caractères deviennent automatiquement cliquables dans le corps des leçons.

**Un calculateur** s'ajoute dans `outils.js`. Il déclare ses champs de saisie et une
fonction `calcule(valeurs)` qui renvoie `{ lignes, lecture, reserve }`, ou
`{ erreur }` si les paramètres sont invalides. La rubrique `reserve` est obligatoire :
chaque résultat doit dire ce que le calcul ne prend pas en compte.

## Parti pris rédactionnel

Trois règles ont gouverné l'écriture, et il vaut mieux les connaître avant de
compléter le contenu.

La matière part de la BRVM plutôt que de la transposer depuis un marché américain.
Un débutant d'Abidjan ou de Dakar n'a pas à traduire mentalement des exemples de
Wall Street pour comprendre sa propre place financière. Les limites propres à un
marché étroit — liquidité, cotation par fixing, indicateurs techniques qui perdent
leur sens sur un titre qui ne cote pas tous les jours — sont dites explicitement.

Aucune leçon ne promet de rendement ni ne recommande de titre. Le parcours sur le
risque et la psychologie est placé en fin de cursus mais présenté comme le plus
déterminant : on peut réussir avec une analyse médiocre et une bonne gestion du
risque, jamais l'inverse.

Chaque outil s'accompagne de ses limites. Un chiffre sans mode d'emploi enseigne une
fausse certitude, ce qui est pire que de ne rien enseigner.

## Vérifications effectuées

Testé en environnement simulé : les 34 leçons se rendent sans exception, les 88
questions renvoient leur explication, les 7 calculateurs produisent des résultats
cohérents et refusent proprement les paramètres invalides, la progression s'exporte
et se réimporte, le routage par URL fonctionne, et le certificat de fin de parcours
n'apparaît qu'après 34 leçons terminées avec au moins 70 % de réussite.

Reste à vérifier dans un vrai navigateur ce que seul un navigateur peut dire :
le rendu des polices, le comportement sur écran tactile, et l'impression du
certificat.
