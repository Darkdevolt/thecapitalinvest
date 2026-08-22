# Journal des modifications

## 1.1.0 — 21 août 2026

Audit complet et correction. Le détail et la justification de chaque point
figurent dans `AUDIT.md`.

### Corrigé — fonctionnalités qui ne s'exécutaient pas

- **Portefeuille** : `portefeuille-crud.js` ne se parsait pas — quinze
  déclarations de fonctions avaient été avalées par un commentaire. Achat,
  vente, édition, suppression, cash, dividendes, watchlist, alertes de prix,
  objectif et rééquilibrage étaient tous hors service.
- **Administration** : `cours.js`, `scraper.js`, `seances-annuel.js`,
  `seances-globales.js`, `boc-admin.js` et `clientele-advanced.js` ne se
  parsaient pas non plus — apostrophes non échappées, ternaire tronqué, chaîne
  non fermée, sélecteur mal formé.
- **Cron BRVM** : le traitement planifié ne s'est jamais déclenché. Vercel envoie
  une requête GET, que le handler traitait comme une simple consultation des
  réglages.
- **The Capital AI** : la route était écrite pour le runtime Edge alors que le
  projet tourne en Node. Réécrite.
- **Tri des colonnes** : `sortTable()` était appelé par six en-têtes mais
  `table-sort.js` n'existait pas. Implémenté, avec gestion des formats
  numériques français et des montants en FCFA.
- **Modules admin** : `seance.js` (95 Ko), `clientele-advanced.js` et
  `historique-quality.js` étaient chargés sur un chemin relatif se résolvant vers
  `/js/` au lieu de `/admin/js/`. Passés en chemins absolus, ainsi que quatre
  autres chargements dynamiques fragiles.

### Corrigé — sécurité

- Un jeton invalide renvoyait un **HTTP 200** sur `/api/preferences`,
  `/api/user-data` et `/api/portfolio-transactions` : le middleware produisait un
  objet `Response` du runtime Edge, réémis en Node sans son code de statut.
- `/api/scrape-brvm` et `/api/sync-brvm` étaient **ouverts à tous**. Session
  administrateur ou secret machine désormais exigés.
- CORS `*` appliqué globalement aux routes authentifiées. Politique différenciée
  désormais : `*` sur les lectures publiques, liste blanche `ALLOWED_ORIGIN`
  ailleurs.
- Secret JWT dont la valeur de repli littérale était `'unused'`. Retiré avec les
  fonctions de signature et la dépendance `jose`.
- Messages d'erreur Postgres renvoyés au client. Remplacés par des messages
  génériques, le détail restant dans les logs.
- En-têtes de sécurité ajoutés : `X-Content-Type-Options`, `X-Frame-Options`,
  `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`.

### Corrigé — logique métier

- `/api/marche` renvoyait une liste de cours **vide** dès que les indices d'une
  séance étaient publiés avant les cours. La dernière date est maintenant
  déterminée table par table.
- `variation_abs` exposait un pourcentage comme s'il s'agissait d'un montant en
  FCFA. Renvoie `null` tant que le schéma ne distingue pas les deux grandeurs.
- Le contrôle de variation exécutait une requête par valeur cotée, en série.
  Remplacé par une lecture groupée unique.
- `process-brvm` et `sync-brvm` s'appelaient par HTTP vers leur propre domaine.
  Le scraper est extrait dans `lib/brvm-scraper.js` et appelé directement.
- Expression morte dans le scraper : `idx.length ? idx : (resumeR.ok ? [] : [])`.
- Portefeuille : refus des dates futures, vérification du solde espèces avant
  retrait, refus de supprimer un achat dont dépendent des ventes (HTTP 409),
  `cout_net_unitaire` laissé vide sur les ventes.
- Historique des indices : bornage par liste de séances réelles au lieu d'une
  approximation `limit × 20` qui pouvait tronquer la séance la plus ancienne.
- Réponses 204 émises avec un corps, contraire à la RFC 9110.

### Corrigé — cohérence

- Deux clés Supabase coexistaient. Configuration unique dans `public/js/env.js`.
- Trois formes d'objet de session selon les modules ; `fetch.js` n'en gérait
  qu'une et perdait le jeton en silence dans les deux autres cas.
- Dossier `server/lib/` intégralement dupliqué et jamais importé. Archivé.
- Logo de 2,2 Mo réduit à 214 Ko.
- SheetJS chargé deux fois dans `admin.html`.

### Ajouté

- `scripts/check-assets.mjs`, exécuté à chaque build : bloque le déploiement en
  cas de référence cassée, de chemin dynamique non résolu ou d'erreur de syntaxe.
- `lib/http.js` : couche HTTP Node unifiée (CORS, réponses, lecture de corps
  plafonnée).
- `lib/brvm-scraper.js` : scraper partagé entre les routes.
- Barème de frais paramétrable : `FEE_COURTAGE`, `FEE_TVA`, `FEE_BRVM`,
  `FEE_DCBR`.

### Retiré

`public/assets/12`, `indices.html` (racine), `public/test.html`,
`DEPLOY_TRIGGER.md`, `public/admin/.deploy-trigger`, `public/.vercelignore`,
dépendance `jose`, redirection `/` → `/index.html`.

Le code retiré de l'arborescence active est conservé dans `ARCHIVE/code-retire/`.

### Avant de déployer

1. Renseigner `CRON_SECRET` dans les variables Vercel — sans elle, le traitement
   automatique reste désactivé et `/api/scrape-brvm` n'accepte qu'un
   administrateur authentifié.
2. Renseigner `ALLOWED_ORIGIN` avec votre domaine de production.
3. Vérifier dans Supabase les points 6.1 et 6.2 d'`AUDIT.md` : contrôle
   d'`auth.uid()` dans les fonctions de paiement, et policies RLS conditionnées à
   `is_admin()` sur les tables de marché.

---

## 1.2.0 — 22 août 2026

Activation des fonctionnalités développées mais jamais branchées, et outillage
de vérification de la base.

### Sections activées

Quatre modules terminés dormaient dans le dépôt sans être chargés par aucune
page. Les conteneurs HTML et les entrées de menu qu'ils exigeaient n'avaient
jamais été créés — les scripts seuls n'auraient donc rien affiché.

- **Comparateur de valeurs** (`comparison.js`) : confrontation de 2 à 4 sociétés
  sur PER, ROE, rendement, endettement et croissance du chiffre d'affaires.
  Vue `view-comparison`, entrée de menu, route et fil d'Ariane créés.
- **Screener de dividendes** (`dividend-screener.js`) : filtrage par rendement
  minimum et maximum, croissance et exercice, alimenté par
  `dividendes_calendrier`. Vue `view-dividend-screener` créée.
- **Mode d'affichage Simple / Pro** (`mode.js`) : la route `/api/preferences`
  gérait déjà ce réglage côté serveur, et le module client existait. Seul le
  chargement manquait. Le sélecteur apparaît dans la barre supérieure et se
  synchronise avec le compte.
- **Ratios fondamentaux avancés** (`fundamental-ratios.js`) : enrichit la vue
  Analyse fondamentale existante, dont les conteneurs étaient déjà en place.

### Non activé volontairement

- `recommandation.js` (28 Ko) : implémentation parallèle de la vue
  Recommandations, exigeant un balisage incompatible avec celui en place. Deux
  versions de la même vue coexistaient. Choix produit, pas correction.
- `presets.js` : préréglages d'analyse technique qu'aucune fonction ne lit.
- `Portefeuille.css` : doublon de `portefeuille.css`.

Ces trois fichiers sont dans `ARCHIVE/code-retire/modules-supplantes/`, avec un
README expliquant pourquoi et comment les reprendre le cas échéant.

### Ajouté

- `supabase/VERIFICATION.sql` : six requêtes en lecture seule qui confrontent
  votre base à ce que le code attend réellement — tables manquantes, tables sans
  RLS, policies d'écriture non conditionnées à `is_admin()`, et corps des deux
  fonctions de paiement. L'inventaire des tables a été extrait des requêtes du
  code, pas supposé.

### Nettoyé

Quinze dossiers vides sous `admin/js/` (`cours/`, `seances/`, `historique/`…),
vestiges d'une modularisation commencée puis abandonnée : ils ne contenaient
qu'un README et aucun code.

---

## 1.3.0 — 22 août 2026

Outillage de mise en service. L'audit avait montré que presque toutes les pannes
de ce projet se manifestaient de la même façon : une section vide, aucun message.
Cette version s'attaque à ce silence.

### Ajouté — `/api/health` et la page Diagnostic

Nouvelle route réservée aux administrateurs, et page `diagnostic.html` accessible
depuis l'en-tête de l'administration.

Elle interroge les vingt-et-une tables dont dépend l'application et distingue
quatre situations : table alimentée, table lisible mais vide, table absente du
schéma, lecture refusée par une règle RLS. Chaque table est reliée aux sections
qu'elle alimente, si bien que le rapport se lit directement en clair — par
exemple « Screener Dividendes ne peut rien afficher : dividendes_calendrier est
vide ».

La configuration serveur est vérifiée dans la foulée : présence de `CRON_SECRET`
sans laquelle le traitement automatique BRVM reste inactif, valeur de
`ALLOWED_ORIGIN`, présence de la clé du moteur IA.

C'est le premier écran à ouvrir après un déploiement : il répond en quelques
secondes à la question de savoir quelles sections sont réellement opérationnelles.

### Ajouté — remontée visible des erreurs

`app/js/error-reporter.js`, chargé en tête de l'application, capte les exceptions
JavaScript, les promesses rejetées et les ressources qui ne se chargent pas. Une
bannière discrète affiche le message réel, avec un bouton pour copier le rapport
complet.

Les sept fichiers qui ne se parsaient pas seraient apparus immédiatement avec ce
mécanisme, au lieu de rester invisibles. `TCErrors.rapport()` reste consultable
depuis la console.

Aucun comportement existant n'est modifié.

---

## 1.4.0 — 22 août 2026

Réorganisation de l'arborescence.

### Administration rangée par domaine métier

Les 34 fichiers de `public/admin/js/` étaient à plat, sans regroupement, avec des
noms qui se chevauchaient — six fichiers portant sur les cours, sept sur les
séances, sans qu'on puisse deviner lequel faisait autorité.

Ils sont désormais répartis en quatorze domaines : `core/`, `dashboard/`,
`cours/`, `seances/`, `historique/`, `marche/`, `entreprises/`, `financials/`,
`analyses/`, `dividendes/`, `boc/`, `imports/`, `utilisateurs/`, `diagnostic/`.

Cette structure était d'ailleurs celle qu'un développement précédent avait
commencé à mettre en place : les quinze dossiers vides supprimés en 1.2.0 en
portaient les noms et les README. L'intention est reprise et menée à terme.

Chaque dossier porte un README décrivant son périmètre et listant ses fichiers.

Les 34 déplacements ont été suivis d'une mise à jour de toutes les références,
qu'elles soient écrites en chemin absolu ou relatif, avec ou sans paramètre de
version : huit fichiers modifiés, aucune référence orpheline.

### Application

`overview-fixes.js` et `titres-navigation-fixes.js` corrigent des vues précises
mais étaient rangés au niveau du socle. Déplacés dans `views/`.

### Documentation

`docs/ARBORESCENCE.md` décrit l'organisation complète — racine, routes API,
socle serveur, front — et précise en fin de document ce que cette réorganisation
n'a délibérément pas fait.

### Limite assumée

Les fichiers ont été rangés, leur contenu n'a pas été fusionné. Le domaine
`cours/` compte toujours six fichiers issus de correctifs successifs, et les
modules `-patch`, `-fixes` et `-hardening` redéfinissent encore des fonctions à
l'exécution.

Ranger est mécanique et vérifiable par le contrôle d'intégrité. Fusionner suppose
de trancher quelle version d'une fonction redéfinie plusieurs fois fait autorité,
ce qui ne se vérifie qu'en exécutant l'application. Cette étape se mènera domaine
par domaine, après mise en service, en s'appuyant sur `/diagnostic.html` et sur
la bannière de remontée d'erreurs.
