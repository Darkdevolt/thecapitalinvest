# The Capital Invest — Rapport d'audit et de correction

Périmètre : 216 fichiers, environ 26 000 lignes de JavaScript, HTML et CSS.
Date de l'audit : 21 août 2026.

Ce document recense ce qui a été trouvé, ce qui a été corrigé, et ce qui reste à
traiter de votre côté. Il est classé par gravité, pas par ordre de découverte.

---

## Lecture d'ensemble

Le projet ne souffre pas d'une série d'étourderies isolées. Il souffre d'une
accumulation : des correctifs empilés les uns sur les autres, sans que les
couches précédentes ne soient retirées. On en trouve la trace partout — un
dossier `server/lib/` intégralement dupliqué que rien n'importait, une dizaine de
fichiers suffixés `-patch`, `-fixes` ou `-hardening` qui redéfinissent à
l'exécution des fonctions déjà définies ailleurs, deux clés Supabase différentes
selon les pages, deux styles de handler serverless incompatibles dans le même
dossier `api/`.

La conséquence la plus coûteuse n'est pas l'inélégance : c'est que **du code mort
ressemblait à du code vivant**. Sept fichiers ne se parsaient même pas, dont
trois chargés directement par les pages principales. Trois modules
d'administration étaient appelés sur un chemin qui n'existait pas. Un cron
tournait à vide depuis sa mise en place. Rien de tout cela ne produit d'erreur
visible : le navigateur rejette le fichier en silence, la fonctionnalité
n'apparaît simplement pas, et on conclut à un problème d'affichage.

C'est probablement ce que vous ressentiez en parlant d'« éléments défaillants et
non logiques ».

---

## 1. Pannes silencieuses — du code qui ne s'exécutait jamais

### 1.1 Sept fichiers JavaScript ne se parsaient pas

Un fichier JavaScript comportant une erreur de syntaxe est rejeté **en entier**
par le navigateur. Aucune de ses fonctions n'existe à l'exécution. Chaque bouton
qui les appelle lève une `ReferenceError` dans la console, et ne fait rien.

| Fichier | Nature de l'erreur | Conséquence |
|---|---|---|
| `app/js/views/portefeuille/portefeuille-crud.js` | 15 déclarations de fonctions avalées par un commentaire (`//, TITRE, window.addPosition = function() {`) | **Tout le CRUD du portefeuille** : achat, vente, édition, suppression, cash, dividendes, watchlist, alertes de prix, objectif, rééquilibrage |
| `admin/js/cours.js` (37 Ko, chargé par `admin.html`) | Apostrophes françaises non échappées (`ce n'est pas`) | Onglet Cours de l'administration |
| `admin/js/scraper.js` (chargé par `admin.html`) | Ternaire tronqué : `Array.isArray(d&&d.data)?d.data,` sans branche `:` | Onglet Scraper |
| `admin/js/seances-annuel.js` | Chaîne non fermée (`&limit=5000)` au lieu de `&limit=5000')`) **et** sélecteur mal formé (`'[data-annual-body']` au lieu de `'[data-annual-body]'`) | Audit annuel des séances |
| `admin/js/seances-globales.js` (23 Ko) | Échappement doublé dans un sélecteur CSS | Navigation entre séances |
| `admin/js/boc-admin.js` | Apostrophes non échappées | Gestion des bulletins BOC |
| `admin/js/clientele-advanced.js` | Apostrophe non échappée | Customer Intelligence |

**Corrigé.** Les sept fichiers se parsent. Pour `cours.js`, `boc-admin.js` et
`clientele-advanced.js`, j'ai vérifié par comparaison que seul l'échappement des
apostrophes a changé, aucune autre ligne.

### 1.2 Le cron ne traitait rien

`vercel.json` planifie `/api/process-brvm` à 16 h 05 du lundi au vendredi. Vercel
déclenche les tâches planifiées par une requête **GET**. Or le handler renvoyait
simplement les réglages sur GET, et ne traitait que sur POST :

```js
if (req.method === 'GET') return res.status(200).json({ success: true, settings: current });
```

Le traitement automatique des séances n'a donc jamais fonctionné, quel que soit
le mode configuré dans l'interface.

**Corrigé.** Un GET porteur du secret machine déclenche le pipeline ; un GET
administrateur continue de renvoyer les réglages, ce qui préserve le
fonctionnement de l'interface d'administration.

### 1.3 `/api/capital-ai` ne pouvait pas répondre

Le fichier était écrit pour le **runtime Edge** — signature `handler(req)`,
`req.json()`, retour d'un objet `Response` — alors que le projet tourne en
runtime Node et qu'aucune déclaration `export const config = { runtime: 'edge' }`
n'était présente. En Node, `req.json()` n'existe pas et l'objet `Response`
retourné n'est jamais émis.

**Corrigé.** Réécrit selon la signature `(req, res)` du reste du projet.

### 1.4 Trois modules d'administration chargés sur un chemin inexistant

`admin.html` est servi à la racine du site. Un chemin relatif y est donc résolu
depuis `/`, pas depuis `/admin/`. Ces trois chargements pointaient dans le vide :

```js
s.src = 'js/seance.js'              // → /js/seance.js       (le fichier est /admin/js/seance.js, 95 Ko)
s.src = 'js/clientele-advanced.js'  // → /js/clientele-advanced.js
s.src = 'js/historique-quality.js'  // → /js/historique-quality.js
```

**Corrigé** en chemins absolus, ainsi que quatre autres chargements relatifs qui
ne fonctionnaient que par chance selon l'URL d'entrée.

### 1.5 Deux scripts référencés mais absents du dépôt

`app.html` chargeait `app/js/api.js` et `app/js/table-sort.js`, aucun des deux ne
figurant dans le dépôt. Le second est appelé par six en-têtes de colonne
(`onclick="sortTable('coursTable', n)"`) : **le tri du tableau des cours ne
fonctionnait sur aucune colonne**.

**Corrigé.** `api.js` était redondant — `window.api` et `apiGet` sont définis par
`fetch.js` — sa balise a été retirée. `table-sort.js` a été implémenté, avec
gestion du format numérique français (`12 345,67`), des pourcentages et des
montants en FCFA.

---

## 2. Sécurité

### 2.1 Un jeton invalide renvoyait un HTTP 200

Dans `preferences.js`, `user-data.js` et `portfolio-transactions.js` :

```js
if (auth.response) return res.end(Buffer.from(await auth.response.arrayBuffer()));
```

`auth.response` était un objet `Response` (API Web) produit par un middleware
écrit pour le runtime Edge. En Node, `res.end()` émet le corps avec le
**statut 200 par défaut**, sans `Content-Type`. Le client recevait donc un
`{"success":false,"error":"Token invalide"}` en HTTP 200 : impossible de détecter
une session expirée et de rediriger vers la connexion.

**Corrigé.** Nouveau middleware Node natif : les codes 401, 403, 429 et 503 sont
réellement émis.

### 2.2 `/api/scrape-brvm` était ouvert à tous

La route acceptait n'importe quel POST anonyme et déclenchait quatre requêtes
vers `brvm.org`. Exploitable en boucle : coût de fonction, et risque de blocage
de l'IP sortante de votre déploiement par la source de données.

**Corrigé.** Session administrateur ou secret machine désormais exigés. Même
traitement pour `/api/sync-brvm`, qui acceptait en plus les GET anonymes.

### 2.3 CORS permissif sur les routes authentifiées

`vercel.json` imposait `Access-Control-Allow-Origin: *` sur **toutes** les routes
`/api/*`, y compris celles qui acceptent un en-tête `Authorization`. La variable
`ALLOWED_ORIGIN` existait dans la configuration mais n'était utilisée nulle part.

**Corrigé.** L'en-tête global a été retiré de `vercel.json`. Chaque handler
applique désormais la politique adaptée : `*` toléré sur les lectures publiques
(`/api/marche`, `/api/boc`), liste blanche stricte partout ailleurs. Renseignez
`ALLOWED_ORIGIN` avec votre domaine en production.

### 2.4 Secret JWT forgeable

`lib/config.js` déclarait `jwtSecret: getEnv([...]) || 'unused'`. Tout jeton signé
avec cette valeur de repli aurait été reproductible par quiconque lisait le
dépôt.

**Corrigé.** L'authentification étant entièrement déléguée à Supabase, les
fonctions `signToken` / `verifyToken` ont été retirées, ainsi que la dépendance
`jose` devenue inutile. Seul `extractBearer` subsiste.

### 2.5 Fuite de messages d'erreur internes

Plusieurs routes renvoyaient `detail: error.message` au client — messages
Postgres révélant noms de tables, contraintes et règles RLS.

**Corrigé.** Message générique côté client, message technique dans les logs
serveur via `fail(res, status, message, code, error)`.

### 2.6 En-têtes de sécurité absents

**Corrigé.** `X-Content-Type-Options`, `X-Frame-Options`,
`Strict-Transport-Security`, `Referrer-Policy` et `Permissions-Policy` ajoutés
dans `vercel.json`, plus un cache long sur `/assets/`.

---

## 3. Erreurs de logique métier

### 3.1 La liste des cours pouvait revenir vide sans raison

`api/marche.js` calculait la « dernière séance » comme le maximum global entre
les tables `historique` et `indices`, puis filtrait `historique` sur cette date.
Dès que les indices d'une séance étaient publiés avant les cours — cas courant —
le filtre portait sur une date absente de `historique` et **retournait zéro
ligne**, alors que des cours récents existaient.

**Corrigé.** Chaque table détermine sa propre dernière date.

### 3.2 Un pourcentage exposé comme un montant

`api/process-brvm.js` écrit la même valeur dans les colonnes `variation` et
`variation_pct`. `api/marche.js` exposait ensuite `variation_abs: r.variation` —
c'est-à-dire un pourcentage présenté comme une variation en FCFA.

**Corrigé.** Tant que les deux colonnes portent la même valeur, `variation_abs`
renvoie `null` plutôt qu'un chiffre faux. Pour les indices, la variation absolue
reste calculable (valeur × pourcentage) et l'est effectivement.

> **À décider de votre côté** : le schéma de la base devrait distinguer les deux
> grandeurs. Soit `variation` devient la variation absolue en FCFA et le pipeline
> la calcule, soit la colonne est supprimée au profit de `variation_pct` seule.

### 3.3 Le contrôle de variation faisait une requête par valeur cotée

`validateLimit()` exécutait une lecture HTTP par ticker, en série — environ
quarante allers-retours séquentiels avant chaque écriture, avec un risque réel de
dépassement du délai d'exécution de la fonction.

**Corrigé.** Une seule lecture groupée avec fenêtre de recherche de 45 jours.

### 3.4 Une fonction serverless qui s'appelait elle-même par HTTP

`process-brvm` invoquait `scrape-brvm` par une requête HTTP sortante vers son
propre domaine, et `sync-brvm` faisait de même. Un aller-retour réseau facturé,
soumis au délai d'exécution et à l'authentification de la route publique, pour un
traitement qui se déroule dans le même processus.

**Corrigé.** Le scraper est extrait dans `lib/brvm-scraper.js` et appelé
directement.

### 3.5 Expression morte dans le scraper

```js
const idxFinal = idx.length ? idx : (resumeR.ok ? [] : []);
```

Les deux branches de la condition interne sont identiques. L'expression n'avait
aucun effet.

**Corrigé** lors de la réécriture.

### 3.6 Contrôles manquants sur le portefeuille

L'API acceptait une transaction datée dans le futur, un retrait supérieur au
solde disponible, et la suppression d'un achat dont dépendaient des ventes —
laissant une position négative. Par ailleurs `cout_net_unitaire` était renseigné
pour les ventes, où la notion de coût de revient unitaire n'a pas de sens.

**Corrigé.** Date validée et bornée à aujourd'hui, solde espèces vérifié avant
retrait, suppression refusée en cas de dépendance (HTTP 409), champ de coût
laissé vide sur les ventes.

> **Limite assumée** : ces contrôles lisent puis écrivent, sans transaction. Deux
> requêtes simultanées peuvent encore passer. Le verrou définitif se pose côté
> base, dans une fonction PL/pgSQL transactionnelle.

> **À vérifier** : le barème de courtage est appliqué à taux plat (1,2 %). Le
> barème réel de la BRVM est dégressif par tranche et comporte une commission
> minimale. Les taux sont désormais paramétrables par variables d'environnement
> (`FEE_COURTAGE`, `FEE_TVA`, `FEE_BRVM`, `FEE_DCBR`), mais la structure par
> tranche reste à implémenter si elle vous concerne.

### 3.7 Réponses 204 avec un corps

`json(res, 204, null)` émettait le texte `null` avec un statut 204, ce que la
RFC 9110 interdit. Certains proxies rejettent ces réponses.

**Corrigé.**

---

## 4. Cohérence et configuration

### 4.1 Deux clés Supabase coexistaient

`login.html` et l'espace d'administration utilisaient la clé « publishable »
récente ; `payment.html` et `admin-payments.html` utilisaient encore l'ancienne
clé anonyme au format JWT. La révocation de la clé historique aurait coupé le
parcours de paiement sans que rien d'autre ne bouge — panne difficile à
diagnostiquer.

**Corrigé.** Configuration unique dans `public/js/env.js`, référencée par les
quatre points d'entrée.

### 4.2 Trois formes d'objet de session

Selon le module, la session était lue comme `{access_token}`, `{session:{...}}`
ou `{data:{session:{...}}}`. `app/js/fetch.js` ne gérait que la première : dans
les deux autres cas, le jeton était perdu en silence et toutes les requêtes
partaient sans authentification.

**Corrigé.** Lecture tolérante centralisée dans `TC_ENV.getSession()`, avec repli
local dans `fetch.js`.

### 4.3 Dossier `server/lib/` intégralement dupliqué

Sept fichiers, copies presque conformes de `lib/`, qu'aucun import ne
référençait. Une correction appliquée d'un côté n'atteignait jamais l'autre.

**Retiré** vers `ARCHIVE/code-retire/` — rien n'est supprimé, tout est
consultable.

### 4.4 Divers

- `.vercelignore` : ligne dupliquée pointant vers un fichier inexistant. Réécrit.
- `public/assets/12` : fichier texte de 3 octets. Retiré.
- `indices.html` à la racine du dépôt, hors de `public/` : jamais servi. Retiré.
- `public/test.html`, `DEPLOY_TRIGGER.md`, `public/admin/.deploy-trigger` :
  artefacts de mise au point. Retirés.
- Redirection `/` → `/index.html` : inutile et pénalisante pour le référencement
  (URL canonique en `.html`). Retirée.
- `admin.html` chargeait la bibliothèque SheetJS **deux fois** depuis le CDN.
- Logo de **2,2 Mo** en 1536 × 1024 servi sur la page d'accueil. Redimensionné en
  512 px : **214 Ko**, soit dix fois moins. Une version WebP ou SVG descendrait
  encore d'un ordre de grandeur.

---

## 5. Garde-fou permanent

`scripts/check-assets.mjs` est désormais branché sur `npm run build`, donc exécuté
à chaque déploiement Vercel. Il échoue — et bloque la mise en ligne — si :

- une page référence un script ou une feuille de style absent du dépôt ;
- un chargement dynamique utilise un chemin relatif qui ne se résout pas ;
- un fichier JavaScript ne se parse pas.

C'est précisément la classe de défauts qui a produit la moitié de ce rapport, et
qui ne se voyait qu'en ouvrant la console du navigateur en production.

État actuel : **21 pages et 116 scripts vérifiés, aucune anomalie**.

---

## 6. Ce qui reste à traiter — hors du dépôt

Ces points ne sont pas corrigeables depuis le code : ils vivent dans votre projet
Supabase. Ils sont classés par urgence.

### 6.1 Le parcours de paiement fait confiance au navigateur — priorité haute

`payment.html` appelle deux fonctions RPC en leur transmettant des paramètres
issus du client :

```js
rpc('create_payment_order', { p_user_id: userId(), p_plan_slug: plan, p_billing_period: period })
rpc('submit_payment_proof',  { p_payment_order_id: order.id, p_user_id: userId(), p_claimed_amount: ... })
```

Deux problèmes en découlent, si — et seulement si — les fonctions ne se protègent
pas elles-mêmes :

- `p_user_id` est fourni par le client. Rien n'empêche un utilisateur connecté de
  créer une commande ou de déposer un justificatif au nom d'un autre compte, sauf
  si la fonction compare ce paramètre à `auth.uid()`.
- `p_claimed_amount` est lu dans un champ du formulaire, et la grille tarifaire
  est définie en JavaScript côté navigateur. Le montant déclaré est modifiable
  depuis les outils de développement. La fonction doit recalculer le prix à
  partir du plan et de la périodicité, sans jamais faire confiance au montant
  transmis.

**À vérifier** : ouvrez `create_payment_order` et `submit_payment_proof` dans
l'éditeur SQL Supabase et confirmez la présence d'un contrôle
`if p_user_id <> auth.uid() then raise exception ...` et d'un recalcul du montant
côté serveur.

### 6.2 Les règles RLS sont votre seule ligne de défense — priorité haute

L'espace d'administration n'appelle presque jamais vos routes `/api/`. Il écrit
**directement dans PostgREST**, avec la clé publique et le jeton de
l'utilisateur :

```js
fetch(SB_REST + '/entreprises?...', { headers: { apikey: SB_ANON, Authorization: 'Bearer ' + TK } })
```

C'est un choix d'architecture défendable, mais il déplace toute la sécurité vers
les règles RLS de Supabase. Si une table comme `cours`, `historique`,
`entreprises`, `financials` ou `users` accepte l'écriture pour le rôle
`authenticated` sans condition `is_admin()`, **n'importe quel utilisateur inscrit
peut modifier vos données de marché**.

Le dépôt ne contient qu'une seule migration SQL, qui définit des fonctions
d'agrégation. Aucune policy n'y figure : elles vivent uniquement dans la console.
Je n'ai donc pas pu les vérifier.

**À vérifier** : dans Supabase, table par table, que RLS est activé et que toute
policy d'écriture est conditionnée à `public.is_admin()`.

### 6.3 Le jeton de session est stocké dans `localStorage`

Conséquence directe : toute faille XSS permet de l'exfiltrer. Le code utilise
`innerHTML` en de nombreux endroits, y compris avec des valeurs venant de la base
(noms d'entreprises, notes utilisateur). Une fonction `esc()` existe et est
appliquée par endroits, pas partout.

Deux pistes, par ordre d'effort croissant : généraliser l'échappement à tous les
`innerHTML` recevant des données externes, ou ajouter une Content-Security-Policy
stricte dans `vercel.json`. Je n'ai pas ajouté de CSP : mal calibrée, elle casse
immédiatement les scripts en ligne et les CDN dont dépendent vos pages. À faire
en mesurant, page par page.

### 6.4 La limitation de débit ne protège qu'une instance

Le compteur est en mémoire : chaque instance de fonction serverless a le sien. Un
plafond réellement global demande un store partagé (Vercel KV ou Upstash Redis).
La limite est documentée dans le code, elle n'est pas masquée.

### 6.5 Le scraping BRVM repose sur des expressions régulières

`lib/brvm-scraper.js` analyse le HTML de `brvm.org` par regex, et déduit les
colonnes de leur ordre supposé (`volume, précédent, ouverture, clôture,
variation`). Une refonte du site casse l'extraction sans avertissement, et
`plus_haut` / `plus_bas` ne sont jamais renseignés. Le contrôle de variation à
7,5 % en aval sert de garde-fou — il bloque l'écriture plutôt que d'enregistrer
des données fausses — mais la solution durable est un flux de données
contractuel.

### 6.6 Architecture de chargement en cascade

Une dizaine de fichiers `-patch`, `-fixes`, `-hardening` se chargent
dynamiquement les uns les autres pour redéfinir des fonctions déjà définies.
L'ordre d'exécution dépend de la latence réseau. Cela fonctionne aujourd'hui,
mais chaque nouveau correctif rend le suivant plus fragile. À terme, il faudrait
fusionner ces correctifs dans les fichiers qu'ils corrigent — c'est un travail de
refonte, à mener module par module, hors du périmètre de cet audit.

---

## Annexe — inventaire des fichiers touchés

**Réécrits** : les dix routes de `api/`, `lib/middleware.js`, `lib/jwt.js`,
`lib/ratelimit.js`, `vercel.json`, `package.json`, `.env.example`, `.vercelignore`.

**Créés** : `lib/http.js`, `lib/brvm-scraper.js`, `public/js/env.js`,
`public/app/js/table-sort.js`, `scripts/check-assets.mjs`, `AUDIT.md`,
`CHANGELOG.md`.

**Corrigés ponctuellement** : `lib/config.js`, `lib/validate.js`,
`public/app/app.html`, `admin.html`, `login.html`, `payment.html`,
`admin-payments.html`, `app/js/fetch.js`, `app/js/loader.js`, `admin/js/config.js`,
`admin/js/main.js`, `admin/js/diagnostic.js`, `admin/js/indices.js`,
`admin/js/scraper.js`, `admin/js/cours.js`, `admin/js/boc-admin.js`,
`admin/js/clientele-advanced.js`, `admin/js/seances-annuel.js`,
`admin/js/seances-globales.js`, les trois fichiers du portefeuille.

**Archivés** dans `ARCHIVE/code-retire/` : `server/` (dossier dupliqué),
`lib/response.js`, `lib/cors.js`, ancien `lib/middleware.js`.

**Retirés** : `public/assets/12`, `indices.html` (racine), `public/test.html`,
`DEPLOY_TRIGGER.md`, `public/admin/.deploy-trigger`, `public/.vercelignore`.

Aucun fichier de code métier n'a été supprimé. Tout ce qui a été retiré de
l'arborescence active reste consultable dans `ARCHIVE/`.
