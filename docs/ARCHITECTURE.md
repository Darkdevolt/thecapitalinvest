# The Capital Invest — Architecture

## Objective

Keep the current application behaviour stable while progressively separating code by responsibility. No Supabase schema, market-data endpoint, authentication flow, or business rule is changed by this architecture refactor.

## Repository boundaries

```text
api/                 Serverless HTTP endpoints
lib/                 Shared server-side infrastructure
public/              Browser application
public/admin.html    Admin shell and tab markup
public/admin/js/     Admin feature modules (legacy flat layer being migrated)
public/app/          Main application UI
public/js/           Shared/public browser modules
ARCHIVE/             Retired code and historical manifests
.github/workflows/   CI / maintenance automation
```

## Target feature-oriented structure

```text
public/admin/js/
├── core/             Shared admin infrastructure
├── dashboard/        Dashboard and overview
├── cours/            Current market quotations
├── historique/       Historical quotations
├── seances/          Trading-session lifecycle
├── calendrier/       Calendar/date navigation
├── entreprises/      Companies/security master
├── financials/       Financial statements
├── dividendes/       Dividends
├── analyses/         Research/analysis administration
├── utilisateurs/     User administration
├── scraper/          BRVM scraping and source controls
├── imports/           Excel/CSV imports
├── diagnostic/       Diagnostics and data-quality tools
├── indices/           Market indices
└── boc/               BOC administration/import
```

## Server-side target structure

The existing `api/` endpoints remain public entry points. Internal reusable logic should progressively move to domain-oriented services under `lib/` rather than duplicating Supabase, auth, validation, or market-data code inside each endpoint.

```text
api/
├── market/            Market/BRVM endpoints
├── portfolio/         Portfolio endpoints
├── users/             User/preferences endpoints
└── content/           BOC / AI / content endpoints

lib/
├── infrastructure/    Supabase, JWT, CORS, rate limiting, responses
├── market/            Instrument matching and market rules
├── validation/        Shared validation
└── services/          Reusable business services
```

## Migration rules

1. One feature owns its UI logic, validation and orchestration.
2. Shared API/auth/utilities are not copied into feature modules.
3. `admin.html` remains a shell; feature behaviour belongs in JS modules.
4. Existing global functions may remain temporarily as compatibility adapters during migration.
5. A legacy file is deleted only after every runtime reference has been migrated and the feature has been verified.
6. `ARCHIVE/` is never loaded by production runtime.
7. Supabase tables, columns, data and authentication are preserved.
8. Existing HTTP endpoints are preserved unless a separate migration explicitly changes them.

## Current admin migration status

The admin tree already contains both active modules and retired/overlapping implementations. The legacy manifest records `dashboard.js` and `scraper-legacy.js` as retired from runtime. The remaining course/history/session modules require dependency-aware migration rather than blind deletion.

## Verification checklist

Before deleting any legacy module:

- search all HTML/JS references;
- verify exported/global functions used by markup;
- verify API endpoints called by the module;
- verify event listeners are not duplicated;
- verify Supabase reads/writes;
- test the corresponding admin tab;
- test create/edit/delete/import paths;
- test calendar → session navigation;
- check browser console for errors;
- only then delete the old file.
