# Admin legacy manifest

## Retired from runtime — 2026-08-14

### `public/admin/js/dashboard.js` — ancienne implémentation
- L'ancien code Dashboard n'est plus exécuté directement.
- Le fichier actif est maintenant un chargeur unique vers `dashboard-overview.js`.
- L'historique complet de l'ancienne implémentation reste récupérable dans Git via les commits précédents.

### `public/admin/js/scraper-legacy.js`
- Ancien module scraper/BOC conservé dans l'historique Git mais retiré du runtime.
- Le fichier n'était pas référencé par `admin.html`; sa présence ne servait donc qu'à conserver une implémentation historique dans l'arbre actif.
- Les fonctions BRVM actuellement utilisées doivent rester dans les modules actifs (`scraper.js`, `boc-admin.js`, etc.).

## Règle
Le dossier `ARCHIVE/` n'est jamais chargé par `admin.html` ni par les scripts de production.
