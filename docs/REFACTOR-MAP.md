# The Capital Invest — Refactor map

Cette carte décrit la stratégie de réorganisation. La branche de refactor ne modifie ni Supabase, ni les routes API publiques, ni les données métier.

## Admin — structure cible

```text
public/admin/js/
├── core/           API, configuration, utilitaires, bootstrap, diagnostics
├── dashboard/      dashboard d'administration
├── cours/          cotations et historique
├── marche/         indices et scraping BRVM
├── entreprises/    référentiel sociétés
├── financials/     états financiers + schema/excel
├── analyses/       analyses et recommandations
├── dividendes/     calendrier des dividendes
├── boc/            Bulletins Officiels de la Cote
├── imports/        imports
├── utilisateurs/   comptes, abonnements, clientèle
├── reporting/      reporting et exports
├── diagnostic/     diagnostics
└── institute/      The Capital Institute
```

Le shell `public/admin.html` charge désormais ces chemins par domaine. Les gros
modules administratifs ont été déplacés sans changement de contenu afin de
réduire le risque : le déplacement est donc réversible et n'altère pas la
logique métier.

## Deuxième étape : factorisation interne

Les fichiers encore volumineux ne doivent pas être découpés arbitrairement.
Pour chaque candidat, suivre cette séquence :

1. identifier les responsabilités distinctes ;
2. identifier les globals exposés et les dépendances implicites ;
3. extraire `view/`, `data/`, `actions/`, `validation/` ou `services/` selon le cas ;
4. conserver un point d'entrée unique par domaine ;
5. vérifier les références dans HTML, JS et CSS ;
6. parser/tester chaque module ;
7. vérifier le navigateur avant suppression de l'ancien code.

Priorité initiale : modules > 30 Ko, puis les fichiers contenant plusieurs
responsabilités ou des correctifs suffixés `-fix`, `-patch`, `-polish`.

## Application publique

Conserver la hiérarchie existante de `public/app/js/views/`. Les sous-domaines
`technique/`, `technique/pro/`, `technique/ind/`, `portefeuille/` et
`fondamentale/` sont déjà la bonne direction. Il faut poursuivre cette
factorisation plutôt que recréer un dossier global fourre-tout.

## API

Les fichiers `api/*.js` restent des entrypoints Vercel. Ils ne doivent pas être
renommés ou déplacés tant que `vercel.json` et tous les consommateurs n'ont pas
été migrés ensemble. La factorisation interne se fait dans `lib/`.

## CSS

Les styles doivent progressivement suivre les mêmes frontières fonctionnelles
que le JS. Aucun nouveau fichier CSS ne doit recopier le reset, les variables
ou les règles globales existantes.

## Règle de suppression

Un ancien fichier ne peut être supprimé que si :

- aucune référence runtime ne subsiste ;
- aucun global ou handler inline n'en dépend ;
- ses appels API ont un propriétaire actif ;
- son CSS est migré ou explicitement inutile ;
- le build/parsing passe ;
- la fonctionnalité a été vérifiée dans le navigateur.
