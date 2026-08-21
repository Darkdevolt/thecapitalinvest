# The Capital Invest — Refactor map

This document is the authoritative map for the repository reorganization. It is intentionally non-destructive: existing runtime paths remain valid until their consumers are migrated.

## Admin

| Current path | Target domain | Action |
|---|---|---|
| `public/admin/js/api.js` | `core` | central shared API client |
| `public/admin/js/config.js` | `core` | configuration/auth bootstrap |
| `public/admin/js/main.js` | `core` | admin shell/bootstrap |
| `public/admin/js/dashboard-overview.js` | `dashboard` | active dashboard implementation |
| `public/admin/js/dashboard.js` | `dashboard` | compatibility/legacy wrapper; do not delete blindly |
| `public/admin/js/cours.js` | `cours` | current quotations orchestration |
| `public/admin/js/cours-control.js` | `cours` | quotation validation/control |
| `public/admin/js/cours-control-editor.js` | `cours` | quotation editor |
| `public/admin/js/cours-historique.js` | `historique` + `seances` | split by responsibility before deletion |
| `public/admin/js/cours-history-entry-delete.js` | `historique` | historical-row deletion |
| `public/admin/js/historique.js` | `historique` | historical data UI |
| `public/admin/js/historique-session-delete.js` | `seances` | session deletion |
| `public/admin/js/seance.js` | `seances` | session UI |
| `public/admin/js/analyses.js` | `analyses` | analyses admin |
| `public/admin/js/boc-admin.js` | `boc` | BOC admin |
| `public/admin/js/boc-importer.js` | `boc` | BOC import |
| `public/admin/js/diagnostic.js` | `diagnostic` | diagnostics |

## Public application

The main app already has a substantially better feature hierarchy under `public/app/js/views/`. Keep that hierarchy. Do not flatten it into a generic `public/js` bucket.

```text
public/app/js/
├── components/
├── views/
│   ├── technique/
│   └── portefeuille/
├── init.js
├── loader.js
├── fetch.js
├── ui.js
├── utils.js
└── ...
```

## Public shared JS

`public/js` contains cross-page/public functionality. It should only contain truly shared modules. Feature-specific modules such as session management should progressively move to a feature folder with a compatibility loader at the old path until all consumers are migrated.

## API

Keep public API filenames stable because Vercel maps them to HTTP routes. Reorganization of internal logic should happen under `lib/` without changing route names.

```text
api/
├── market/       process-brvm, scrape-brvm, sync-brvm, marche
├── boc/          boc, boc-upload
├── portfolio/    portfolio-transactions
├── users/        user-data, preferences
└── ai/           capital-ai
```

The physical move of Vercel API entrypoints is deliberately deferred unless `vercel.json`/routing is updated in the same change.

## Server library

```text
lib/
├── infrastructure/  config, cors, jwt, middleware, ratelimit, response, supabase
├── market/          market-instrument-matcher
└── validation/      validate
```

The current files remain in place until all imports are migrated; server paths are runtime-sensitive.

## CSS

Use the same feature boundaries as JS where possible:

```text
public/admin/css/
├── core/
├── cours/
├── historique/
├── seances/
├── dashboard/
├── boc/
└── ...
```

Do not duplicate global variables or reset rules into feature CSS.

## Deletion policy

A file is eligible for deletion only when:

1. repository-wide search finds no runtime reference;
2. no inline HTML handler depends on a global it defines;
3. its API calls have an equivalent active owner;
4. its CSS is still loaded or deliberately migrated;
5. the feature passes browser verification;
6. the replacement has been live for at least one verification cycle.

## Known retired code

`ARCHIVE/admin-legacy-manifest.md` records `dashboard.js` and `scraper-legacy.js` as retired from runtime. The archive itself must never be loaded in production.
