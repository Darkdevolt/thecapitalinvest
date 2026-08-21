# Admin JS Architecture

## Organisation cible

- `core/` : services partagés et infrastructure Admin.
- `cours/` : cotations de marché, validation, édition et contrôle.
- `historique/` : archive des cotations et imports historiques.
- `seances/` : gestion d'une séance complète, validation et actions de séance.
- `calendrier/` : navigation calendrier → séance/cours/historique.
- `dashboard/` : composants propres au dashboard Admin.

## Règle

Un module ne doit pas réimplémenter l'accès Supabase ou l'édition d'une même donnée dans plusieurs fichiers.

Les anciens fichiers restent temporairement en place pendant la migration afin de ne pas casser `admin.html`. Ils seront supprimés uniquement après migration et vérification des références.
