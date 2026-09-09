# The Capital — Audit du tableau de bord et des écrans liés

**Date :** 9 septembre 2026
**Périmètre demandé :** `public/app/app.html`, `public/app/architecture.html`,
`public/app/account.html`, `public/app/login.html` + toute la couche « tableau de bord ».
**Source analysée :** archive `thecapitalinvest-main` (téléchargement ZIP, pas de `.git`).
**Livrables joints :** `public/app/_corrige/` (versions corrigées, non appliquées) +
`public/app/_corrige/tokens.css` (nouveau fichier).

---

## 0. Résumé en une page

Le tableau de bord n'est pas « mal codé » ligne à ligne. Il est **enseveli sous ses
propres correctifs** : chaque fois qu'il a paru cassé, une nouvelle feuille de style
ou un nouveau script « fix / polish / runtime / patch » a été ajouté par-dessus, sans
retirer la couche précédente ni chercher la cause.

Trois causes racines expliquent l'essentiel de ce que vous décrivez comme
« illisible » et « plein de conflits » :

| # | Cause racine | Effet visible |
|---|---|---|
| **1** | **Les variables de thème sombre ne sont définies nulle part** pour l'app. `app.html` ne charge jamais le fichier qui définit `--bg`, `--surface`, `--gold`, `--cream`, `--border`, `--sans`… | Cartes transparentes, bordures absentes, polices système. Chaque `dashboard-*.css` (il y en a 8) tente de repeindre la zone en dur avec des `!important`. |
| **2** | **Deux systèmes de jetons qui ne se croisent jamais** : le shell utilise `--tc-*` (`variables.css`), les vues utilisent `--*` (jamais défini). Et `:root` est redéfini dans ≥ 5 fichiers avec des valeurs différentes (2 « or » : `#B8964E` et `#c9a24a`). | Incohérence de couleur entre l'en-tête et le corps ; règles qui s'annulent. |
| **3** | **`app.html` a perdu 8 de ses ~17 écrans.** Le routeur annonce 17 destinations ; le HTML n'en contient que 5, et seuls 3 modules JS savent se monter seuls. | « Marché », « Screener », « Alertes », « États financiers », « Calendrier », « Fiche », « Analyse technique », « Analyse fondamentale » : le menu clique, rien ne s'affiche. |

À cela s'ajoutent : navigation absente entre `app.html` et `account.html` /
`architecture.html` (le point que vous soulevez), deux `MutationObserver` permanents
sur tout le document, du CSS qui vise un en-tête supprimé, et des fichiers morts à la
racine.

**Le correctif à plus fort levier est le n° 1** : un seul fichier `tokens.css` chargé
en premier rétablit la palette et rend applicable une grande partie du CSS existant —
ce qui permet ensuite de *supprimer* des couches de patch au lieu d'en ajouter.

---

## 1. Cause racine n° 1 — les jetons de thème sombre sont introuvables

### Constat

`app.html` charge, dans l'ordre : `overview-insights.css`, `financials-documents.css`,
`variables.css`, `base.css`, `components.css`, `views.css`, `technique.css`,
`technique-pro.css`, `fondamentale-pro.css`, `style.css`, `marche.css`,
`dashboard-unified.css`, `global-unified.css`.

- `components.css` / `views.css` / `marche.css` écrivent partout
  `background: var(--surface)`, `color: var(--cream)`, `border: 1px solid var(--border)`,
  `font-family: var(--sans)` **sans valeur de repli**.
- Ces variables (`--bg`, `--surface`, `--card`, `--card2`, `--border`, `--border2`,
  `--gold`, `--gold-light`, `--gold-dim`, `--cream`, `--muted`, `--dim`, `--green`,
  `--red`, `--blue`, `--sans`, `--serif`, `--mono`) **ne sont définies que dans**
  `/public/style.css` — la feuille du site vitrine, **que `app.html` ne charge pas** —
  et dans des blocs `:root[data-theme="light"]` (`theme-system.css`,
  `dashboard-utility.css`).
- `variables.css` (pourtant nommé « Canonical design tokens ») ne définit que le
  jeu **`--tc-*`**, jamais utilisé par les vues.

### Conséquence

En thème sombre (le défaut), toutes ces déclarations sont invalides et retombent sur
`initial` / la valeur héritée :

- `background: var(--surface)` → transparent
- `border: 1px solid var(--border)` → déclaration entièrement invalide → pas de bordure
- `color: var(--cream)` → couleur héritée
- `font-family: var(--sans)` → police système

Seuls s'affichent correctement : le `<style id="tc-command-shell">` intégré à
`app.html` (ses propres `--tc-*` locaux), `dashboard-unified.css` et
`dashboard-final-polish.css` (valeurs `rgba(184,150,78,…)` **en dur**), et
`financials-documents.css` (son propre `:root` avec des `--tc-*` encore différents).
D'où l'impression d'un en-tête soigné posé sur un corps de page cassé.

### C'est l'origine de l'empilement

`dashboard-polish.css`, `dashboard-final-polish.css`, `dashboard-presentation-v2.css`,
`dashboard-presentation-v3.css`, `dashboard-runtime.css`, `dashboard-final-runtime.css`,
`dashboard-unified.css`, `dashboard-utility.css`, `visual-contrast.css`,
`mobile-polish.css`, `mobile-polish-v2.css` + les `<style>` injectés par
`router.js`, `overview-fixes.js`, `fundamental-ratios.js`… : autant de tentatives de
recolorier à la main une zone dont la palette manquait.

### Correctif proposé (livré)

`public/app/_corrige/tokens.css` : un `:root` sombre canonique + le bloc
`[data-theme="light"]` consolidé, **avec les deux jeux de noms (`--x` et `--tc-x`)
pointant sur les mêmes valeurs**. Palette retenue : celle de `/public/style.css`
(or `#B8964E`), déjà supposée partout via les `rgba(184,150,78,…)`.

À charger **en première position** dans `app.html` (fait dans
`_corrige/app.html`). Effet attendu : la majorité de `components.css` / `views.css` /
`marche.css` s'applique enfin comme prévu ; plusieurs `dashboard-*.css` et
`visual-contrast.css` deviennent alors **supprimables** (à faire écran par écran,
avec contrôle visuel).

---

## 2. Cause racine n° 2 — jetons dupliqués et `:root` en conflit

| Fichier | Redéfinit sur `:root` | Valeur de l'« or » |
|---|---|---|
| `variables.css` | `--tc-gold`, `--tc-line`, `--tc-panel`… | `#c9a24a` |
| `app.html` `<style>` intégré | `--tc-gold`, `--tc-ink`… | `#c9a24a` |
| `global-unified.css` | `--tc-line`, `--tc-panel`, `--tc-radius`… (valeurs **différentes** de `variables.css`) | — |
| `financials-documents.css` | `--tc-bg`, `--tc-surface`, `--tc-gold`… (3ᵉ jeu de valeurs) | `#B8964E` |
| `/public/style.css` (non chargé par l'app) | `--gold`, `--surface`, `--cream`… | `#B8964E` |
| `dashboard-unified.css` | — mais `rgba(184,150,78,…)` en dur | `#B8964E` |

Deux « or » cohabitent (`#B8964E` majoritaire, `#c9a24a` dans le shell), et
`--tc-line` vaut `rgba(255,255,255,.09)` dans `variables.css` mais
`rgba(184,150,78,.14)` dans `global-unified.css` — le dernier fichier chargé gagne, de
façon non intentionnelle.

**Commentaires d'« ownership » périmés :** `style.css`, `global-unified.css` et
`dashboard-unified.css` renvoient tous à un fichier **`header-final.css` qui n'existe
pas** dans le dépôt. La règle d'or annoncée (« Header geometry is owned exclusively by
header-final.css ») ne s'applique à rien.

### Correctif proposé

- `tokens.css` (livré) devient la source unique.
- Ensuite : vider le `:root` de `variables.css` et `global-unified.css` (ne garder que
  les règles de mise en page), aligner le `:root` intégré de `app.html` (fait dans
  `_corrige/app.html` : `#c9a24a` → `#B8964E`), supprimer les commentaires renvoyant à
  `header-final.css`.

---

## 3. Cause racine n° 3 — `app.html` a perdu la plupart de ses écrans

### Constat

`js/router.js` déclare ces routes : `overview, titres, fiche, boc, marche, analyses,
analyse-detail, analyse-technique, analyse-fondamentale, screener, portefeuille,
alertes, financials, financials-detail, publications, comparison, dividend-screener`.

`app.html` ne contient que **5** conteneurs : `#view-overview`, `#view-titres`,
`#view-boc`, `#view-analyses`, `#view-analyse-detail`.

Comportement des modules pour les 12 autres :

| Écran | Le module crée-t-il son conteneur ? | État |
|---|---|---|
| `portefeuille` | Oui — `mountView()` construit `#view-portefeuille` + squelette | ✅ fonctionne |
| `comparison` | Oui | ✅ |
| `dividend-screener` | Oui | ✅ |
| `fiche` | Non — `getElementById('view-fiche')`, sinon abandon | ❌ rien |
| `marche` | Non — `if (!container) return;` | ❌ rien |
| `screener` | Non — attend `#view-screener .screener-filters`, `#scrSector`… | ❌ rien |
| `alertes` | Non — attend `#alertsList` | ❌ rien |
| `financials` | Non — attend `#searchFin`, `#finGrid`, `#finDetailContent` | ❌ rien |
| `publications` | Non — attend `#searchPubs`, `#publicationsGrid` | ❌ rien |
| `analyse-fondamentale` | Non — attend `#fundTickerSelect`, `#fundContent` | ❌ rien |
| `analyse-technique` | `js/views/analyse-technique.js` **n'existe pas** (chargé par `loader.js`, `onerror` silencieux) ; le rendu vient de `js/views/technique/…` et attend aussi un squelette | ❌ à vérifier |

Recherche dans **tout le dépôt** : `id="finGrid"`, `id="alertsList"`,
`id="publicationsGrid"`, `id="view-marche"`, `id="scrSector"`, `id="searchFin"`
→ **présents nulle part** (hors 2 workflows GitHub `.yml`). Les squelettes n'ont pas
été déplacés ailleurs : ils ont disparu.

`nav()` sur une route sans conteneur logge `[ROUTER] Vue introuvable: <id>` et ne fait
rien — le clic paraît mort.

### C'est probablement « les éléments défaillants et non logiques »

Le menu et le rail affichent 12 entrées ; ~8 ne mènent nulle part. `architecture.html`
pointe fièrement vers `#marche`, `#screener`, `#analyse-fondamentale`, `#financials`,
`#publications` — tous cassés.

### Correctif — à trancher ensemble

Deux options, ni l'une ni l'autre appliquée dans les fichiers livrés (elles méritent
votre arbitrage) :

- **A. Re-livrer les squelettes dans `app.html`** : reconstruire les `<div class="view"
  id="view-…">` avec les identifiants internes attendus par chaque module (liste
  ci-dessus). Fidèle à l'architecture actuelle, mais rallonge `app.html`.
- **B. Rendre chaque module auto-montant** : dupliquer la logique `mountView()` de
  `portefeuille.js` dans `marche.js`, `screener.js`, etc. `app.html` reste court, la
  responsabilité passe au module. Plus propre à terme.

Un commentaire pointant vers cette section a été ajouté dans `_corrige/app.html`.

---

## 4. Navigation entre les 4 écrans (le point soulevé)

### Constat

| Depuis → vers | Lien existant ? |
|---|---|
| `app.html` → `account.html` | **Non.** La pastille utilisateur `#topnavUser` est un `<div>` sans action. |
| `app.html` → `architecture.html` | **Non.** Le pied du rail ne pointe que vers `/admin.html`. |
| `architecture.html` → `app.html` | Oui, mais `href="app.html"` **relatif** → dépend de l'URL servie. |
| `account.html` → `app.html` | Oui, `/app/app.html` absolu. |
| `account.html` → `architecture.html` | Non. |
| `login.html` (`/app/`) | Redirection JS unique vers `/login.html` — OK, mais **rien si JS désactivé**. |

Chemins incohérents : `app.html` (relatif) vs `/app/app.html` vs `/app.html`
(la réécriture Vercel `/app.html → /app/app.html` masque le problème mais les liens
relatifs internes restent ambigus — `init.js` a d'ailleurs un `normalizeDocument()`
qui retire les `<base>` et les `target`/`rel` : rustine pour ce même souci).

Trois langages visuels : `architecture.html` (`--gold:#b8964e`),
`account.html` (`--gold:#b8964e`, `--gold2:#e0c176`),
`app.html` shell (`--tc-gold:#c9a24a`). Trois pages censées être « le même produit ».

### Correctif (livré dans `_corrige/`)

- `app.html` : `#topnavUser` devient un `<a href="/app/account.html">` ; le pied du
  rail reçoit **« Guide de navigation »** (→ `architecture.html`) et **« Mon compte »**
  (→ `account.html`) à côté d'Administration.
- `architecture.html` : tous les liens passés en **absolu** (`/app/app.html#…`) ;
  ajout de `<meta name="robots" content="noindex,nofollow">` (zone authentifiée) ;
  palette alignée sur `tokens.css`.
- `account.html` : ajout d'un lien **« Guide »** dans l'en-tête ; palette alignée
  (`--gold2` `#e0c176` → `#d4af6a`) ; `tokens.css` chargé ; garde `theme-system.css`.
- `login.html` : ajout d'un `<meta http-equiv="refresh">` et d'un `<noscript>` de
  repli ; conserve `?redirect=` et le `#hash`.

### Point ouvert : thème clair

`account.html` écrit `tc_theme=light` dans `localStorage`. Au chargement suivant,
`theme.js` applique `data-theme="light"` — mais le shell actuel (`.tc-commandbar`,
`.tc-navstrip`, `.tc-rail`) **n'a quasi aucune règle claire** (`theme-system.css` et
`visual-contrast.css` visent `.tc-simple-header`, un en-tête **supprimé**). Résultat :
en thème clair, l'en-tête de l'app reste sombre / illisible. `tokens.css` livré couvre
les **jetons** en clair, mais pas la mise en page du shell — à compléter (§6).

---

## 5. Hygiène d'exécution du tableau de bord

- **Deux `MutationObserver` permanents sur `document.body` en `subtree:true`** :
  - `overview.js` → `installEmojiGuard()` : parcourt tout le DOM à chaque mutation pour
    retirer les emoji.
  - `dashboard-presentation-v2.js` → `observePortfolio()` : observe tout le document en
    permanence… pour masquer une seule ligne « détracteur ».
  Sur une page qui re-rend souvent, c'est un coût constant et invisible. À remplacer
  par des observers ciblés (`#view-overview`) ou un simple appel après rendu.

- **`renderOverview` est *monkey-patché*** par `overview-insights.js` (`greffer()` +
  `setInterval` de rattrapage 40 × 150 ms). Ça marche, mais l'ordre de chargement
  devient un pari : `init.js` charge `dashboard-presentation-v2.js` en dernier, lequel
  charge `dashboard-calendar-runtime.js`, qui…

- **Course de données assumée dans le code** : commentaires de `overview.js` —
  « `allIndices` est écrasé par un chargeur concurrent qui n'y met que la dernière
  séance » ; `serieIndices()` prend « la source la plus fournie des deux » pour
  contourner. `loader.js` publie `window.all*` en globals mutables, réécrits à chaque
  phase (`critical` / `enrichment` / `ondemand`). La donnée devrait être immuable par
  ressource, pas un global partagé.

- **`loader.js` charge `js/views/analyse-technique.js` et
  `js/views/header-institute-link.js` qui n'existent pas** — `onerror` avale l'échec.

- **CSS chargé mais orphelin** : `shell-overhaul.css`, `dashboard-polish.css`,
  `dashboard-runtime.css`, `dashboard-presentation-v2.css`, `scale-100.css`,
  `visual-contrast.css` — soit jamais référencés, soit référençant `.tc-simple-header`
  (en-tête supprimé). `theme-system.css` : ~60 % des règles ciblent cet en-tête mort.

---

## 6. Dette CSS chiffrée (zone `#view-overview`)

Sources de cascade qui touchent le seul tableau de bord :

1. `overview-insights.css` (lien) · 2. `variables.css` · 3. `base.css` ·
4. `components.css` · 5. `views.css` · 6. `style.css` · 7. `dashboard-unified.css` ·
8. `global-unified.css` · 9. `dashboard-final-polish.css` (via `loader.js`) ·
10. `dashboard-final-runtime.css` (via `loader.js`) · 11. `mobile-polish.css` /
12. `mobile-polish-v2.css` (via `main.js`) · 13. `dashboard-presentation-v3.css` (via
`dashboard-presentation-v2.js`) · 14. `<style id="tc-command-shell">` (intégré) ·
15. `<style id="tc-dashboard-stability">` (injecté par `router.js`, `!important`
partout sur `#overviewStats`).

Les n° 7, 9 et 15 définissent tous une grille `#overviewStats` **concurrente**, la
dernière l'emporte via `!important`. `#view-overview` a une largeur max qui vaut
`1500px` (n° 7), `1440px` (n° 9) et `1440px` (n° 9 encore) selon la règle.

**Cible raisonnable :** `tokens.css` + `base.css` + `components.css` + `views.css` +
**un** `dashboard.css` + **un** `responsive.css`. Soit 6 feuilles au lieu de ~15.
Ne pas fusionner à l'aveugle : procéder écran par écran avec captures avant/après en
sombre **et** clair, mobile **et** desktop.

---

## 7. Divers (hors 4 fichiers, mais dans le champ « nettoyage »)

- `vercel.json.new` : JSON **invalide** (chaîne non terminée ligne `Permissions-Policy`)
  laissé à la racine, à côté de `vercel-fix-note.txt`. À supprimer ou finir.
- `/public/login.html` : le lien « Mot de passe oublié ? » n'appelle aucune API, il
  affiche juste un message. À brancher ou à retirer.
- `AUDIT.md` (21 août) + `AUDIT-2026-09-04.md` : signalent déjà « dette CSS » et
  « nombreuses couches », mais **sans identifier la cause n° 1** (jetons sombres
  absents). Le présent document la nomme.
- Token de session en `localStorage` (`tc_session`) : surface XSS connue, déjà notée
  dans les audits précédents — inchangé.

---

## 8. Plan proposé (ordre de valeur décroissante)

| Étape | Action | Risque | Effet |
|---|---|---|---|
| **1** | Charger `_corrige/tokens.css` en 1re feuille de `app.html` | Faible | Rétablit la palette de tout le corps de page |
| **2** | Appliquer `_corrige/app.html` (nav vers compte + guide, or unifié) | Faible | Résout le point « accès aux autres écrans » |
| **3** | Appliquer `_corrige/{architecture,account,login}.html` | Faible | 3 écrans cohérents et reliés |
| **4** | Trancher §3 option A ou B, puis re-livrer les 8 écrans manquants | Moyen | Le menu redevient entièrement fonctionnel |
| **5** | Supprimer 1 à 1 les `dashboard-*.css` rendus inutiles par l'étape 1 (contrôle visuel) | Moyen | −8 à −10 fichiers CSS |
| **6** | Couvrir le shell (`.tc-commandbar/.tc-navstrip/.tc-rail`) en thème clair, retirer le CSS visant `.tc-simple-header` | Moyen | Thème clair utilisable |
| **7** | Remplacer les 2 `MutationObserver` document par des appels post-rendu ciblés | Faible | Coût d'exécution constant supprimé |
| **8** | Nettoyer `vercel.json.new`, refs mortes `loader.js`, commentaires `header-final.css` | Faible | Lisibilité |

Les étapes 1–3 sont livrées dans `public/app/_corrige/` et **n'ont pas été
appliquées** aux fichiers d'origine — à valider ensemble avant bascule.
