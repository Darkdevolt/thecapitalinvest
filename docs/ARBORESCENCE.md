# Organisation du projet

## Racine

    api/          Fonctions serverless Vercel (runtime Node, signature (req, res))
    lib/          Code serveur partagé entre les fonctions
    public/       Racine servie par Vercel
    scripts/      Outillage de build
    supabase/     Migrations et script de vérification de la base
    docs/         Documentation
    ARCHIVE/      Code retiré de l'arborescence active, conservé pour référence

## api/ — une route, un fichier

    marche.js                   Lecture des données de marché (public)
    boc.js                      Liste des Bulletins Officiels de la Cote (public)
    boc-upload.js               Dépôt d'un BOC (administrateur)
    scrape-brvm.js              Récupération d'une séance depuis brvm.org (admin ou machine)
    process-brvm.js             Pipeline complet : récupération, contrôles, écriture
    portfolio-transactions.js   Journal des transactions (utilisateur authentifié)
    preferences.js              Mode d'affichage Simple / Pro
    user-data.js                Alertes de cours et liste de suivi
    capital-ai.js               Assistant d'analyse
    health.js                   Diagnostic d'exploitation (administrateur)

## lib/ — socle serveur

    config.js                   Lecture et normalisation des variables d'environnement
    supabase.js                 Clients Supabase (public et service)
    http.js                     Réponses, CORS, lecture de corps plafonnée
    middleware.js               Authentification, rôle admin, limitation de débit
    jwt.js                      Extraction du jeton porteur
    validate.js                 Validateurs de format
    brvm-scraper.js             Extraction des données depuis brvm.org
    market-instrument-matcher.js  Rapprochement au référentiel entreprises

## public/ — front

    index.html                  Page d'accueil publique
    login.html  register.html  confirm-signup.html    Parcours de compte
    payment.html                Souscription
    admin.html                  Console d'administration
    admin-payments.html         Vérification des paiements
    diagnostic.html             État des tables et de la configuration
    capital-ai.html  screener.html  indices.html  suivi.html
    app/app.html                Application (servie à /app.html par réécriture)

    js/env.js                   Configuration client unique — source de vérité
                                pour l'URL Supabase, la clé publique et la session

### public/app/js/ — application

    error-reporter.js           Remontée visible des erreurs (chargé en premier)
    cache.js  fetch.js  loader.js                Accès aux données
    utils.js  components.js  state.js  ui.js     Socle d'interface
    search.js  router.js  navigation-guard.js    Navigation
    mode.js                     Mode d'affichage Simple / Pro
    table-sort.js               Tri des colonnes
    main.js  init.js            Amorçage
    views/                      Une vue par fichier, plus leurs correctifs
    views/portefeuille/         Portefeuille (store, CRUD, calculs, rendu)
    views/technique/            Analyse technique

### public/admin/js/ — administration par domaine métier

Les modules administratifs sont maintenant rangés par domaine. `core/` contient
le socle partagé ; les autres dossiers ne contiennent que les fonctionnalités
du domaine correspondant.

    core/           Configuration, API, utilitaires, amorçage, diagnostics
    dashboard/      Vue d'accueil
    cours/          Cotations et historique
    marche/         Indices et scraping
    entreprises/    Référentiel des sociétés
    financials/     États financiers et sous-modules Excel/schema
    analyses/       Recommandations et analyses
    dividendes/     Calendrier des dividendes
    boc/            Bulletins Officiels de la Cote
    imports/        Import de fichiers
    utilisateurs/   Comptes, abonnements et clientèle
    reporting/      Reporting et exports
    diagnostic/     Contrôles de cohérence
    institute/      Administration de The Capital Institute

### Règle d'organisation front

Un dossier représente un domaine fonctionnel. Un module ne doit pas devenir un
nouveau « correctif global » chargé depuis `app.html` ou `admin.html`. Les
correctifs qui deviennent pérennes doivent être absorbés par le module qu'ils
corrigent, puis supprimés après vérification des références.

## Ce que la réorganisation n'a pas fait

Cette étape est volontairement structurelle : elle déplace les gros modules
administratifs vers leurs domaines sans modifier leur logique métier, leurs
appels API, les tables Supabase ou les routes Vercel.

La seconde étape doit traiter la **factorisation interne** des fichiers encore
volumineux. Les candidats prioritaires sont les modules qui dépassent environ
30 Ko ou mélangent plusieurs responsabilités. Ils doivent être découpés en
`view/`, `data/`, `validation/`, `actions/` ou sous-domaines cohérents, avec un
point d'entrée stable.

Aucun fichier ne doit être supprimé ou fusionné uniquement parce que son nom
semble ancien. Suppression et fusion nécessitent une recherche des références,
un contrôle de parsing et une vérification navigateur.
