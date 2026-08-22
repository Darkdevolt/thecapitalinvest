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
    sync-brvm.js                Alias de compatibilité de la précédente
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

### public/admin/js/ — administration, par domaine métier

Chaque dossier porte un README décrivant son périmètre et listant ses fichiers.

    core/           Configuration, appels API, utilitaires, amorçage
    dashboard/      Vue d'accueil
    cours/          Cotations : saisie, édition, contrôle, historique
    seances/        Séances de bourse : CRUD, vue annuelle, vue globale
    historique/     Historique des cotations, qualité, suppression
    marche/         Indices et scraping
    entreprises/    Référentiel des sociétés
    financials/     États financiers
    analyses/       Recommandations
    dividendes/     Calendrier des dividendes
    boc/            Bulletins Officiels de la Cote
    imports/        Import de fichiers
    utilisateurs/   Comptes, abonnements, analyse de clientèle
    diagnostic/     Contrôles de cohérence

## Ce que la réorganisation n'a pas fait

Les fichiers ont été rangés par domaine ; leur contenu n'a pas été fusionné.

Le domaine `cours/` compte encore six fichiers issus de correctifs successifs, et
plusieurs modules suffixés `-patch`, `-fixes` ou `-hardening` redéfinissent à
l'exécution des fonctions déclarées ailleurs. Ranger des fichiers est une
opération mécanique, vérifiable par le contrôle d'intégrité. Fusionner leur
contenu suppose de décider quelle version d'une fonction redéfinie trois fois
fait autorité — ce qui ne se vérifie qu'en exécutant l'application.

Cette étape reste donc à mener domaine par domaine, après une première mise en
service et en s'appuyant sur la page `/diagnostic.html` et la bannière d'erreurs.
