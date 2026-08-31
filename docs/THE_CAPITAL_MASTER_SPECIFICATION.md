# THE CAPITAL — MASTER PRODUCT SPECIFICATION

**Version:** 1.0  
**Date:** 31 août 2026  
**Statut:** source de vérité produit

## 0. Principe directeur

The Capital est une plateforme institutionnelle d’intelligence financière africaine centrée sur la BRVM. Chaque fonctionnalité doit avoir une source canonique, une destination claire et une donnée vérifiable.

**Règles absolues**
- Une seule landing publique canonique : `public/index.html`.
- Pas de landing parallèle ni de couche d’injection qui réécrit la landing.
- Les API, Supabase, authentification et logique métier existantes sont protégées.
- Aucune donnée fictive ne doit être présentée comme réelle.

## 1. Architecture produit

### The Capital
- Accueil public
- Marchés
- Titres
- Analyse fondamentale et technique
- Screener
- Financials
- Portfolio
- Authentification
- Administration

### The Capital Institute
- Landing pédagogique
- Six parcours existants
- Leçons et progression
- Glossaire
- Questions/évaluations
- Calculateurs
- Premium
- Espace apprenant à faire évoluer sans casser le cursus existant

## 2. Landing canonique

### Header
Logo lisible, navigation courte, Connexion, Créer un compte, menu mobile.

### Hero
- Comprendre le marché. Décider avec clarté.
- Données + information + analyse.
- Salle des marchés institutionnelle, sobre et réaliste.
- CTA vers inscription et BRVM.
- Données dynamiques uniquement depuis `/api/marche`.

### Sections
1. Solution : Observer → Comprendre → Décider.
2. Fonctionnalités : marché, analyse, financials, screener, portfolio.
3. Marchés : BRVM et UEMOA.
4. The Capital Institute : rôle pédagogique et accès aux parcours.
5. À propos : positionnement institutionnel africain.
6. Contact.
7. Accès / tarifs sans prix inventés.
8. CTA final.

## 3. The Capital Institute

L’Institute est une institution pédagogique de l’écosystème, pas un simple bloc marketing.

Le dossier actuel contient six parcours, 34 leçons, un glossaire, 88 questions et sept calculateurs. La progression locale et les outils existants doivent être conservés pendant toute refonte.

La prochaine évolution doit couvrir : catalogue de programmes, parcours, espace apprenant, progression, évaluations, ressources, certification si réellement disponible et offres premium.

## 4. Données à exposer

### Marché
- BRVM Composite
- BRVM 30
- autres indices réellement disponibles
- cours et variations
- volumes
- valeur échangée
- activité de séance
- BOC/bulletins lorsqu’ils sont disponibles

### Analyse
- PER
- chiffre d’affaires
- résultat net
- dividendes
- ratios
- historiques
- analyse fondamentale
- analyse technique
- recommandations
- screener

### Règles
Toute donnée dynamique doit avoir une source. Les calculs historiques suivent les règles métier définies par The Capital.

## 5. Direction artistique

- Noir/brun profond
- Doré institutionnel
- Ivoire/blanc cassé
- DM Sans
- DM Mono
- Playfair Display
- Premium, institutionnel, africain, contemporain
- Pas de cyberpunk, néons ou hologrammes gratuits
- Pas de taureau cliché comme symbole principal
- Logo suffisamment grand et lisible

## 6. UX / responsive

- Lisibilité prioritaire.
- Échelle typographique contrôlée.
- Aucun élément critique sous une surcouche.
- Desktop, tablette et mobile explicitement testés.
- Navigation mobile fonctionnelle.
- Animations non bloquantes.
- `prefers-reduced-motion` respecté.

## 7. Architecture technique

- Landing canonique : `/index.html`.
- Application métier : `/app.html` → `/app/app.html`.
- Admin : `/admin.html`.
- Institute : `/the-capital-institute/`.
- API marché : `/api/marche`.
- Authentification et Supabase préservés.
- Les anciennes landings ne doivent plus être des sources concurrentes.

## 8. Consolidation

À éviter absolument :
- `index-new.html` concurrent
- `landing-v4.html` concurrent
- CSS de landing dupliqué
- scripts d’enhancement injectant du HTML concurrent
- plusieurs sources de navigation
- faux fallback qui masque les erreurs

## 9. Feuille de route d’exécution

### Phase 0 — Audit
Cartographier fichiers, routes, scripts, API, données et dépendances.

### Phase 1 — Architecture
Définir les entrées canoniques et éliminer les concurrents.

### Phase 2 — Landing
Finaliser structure, contenu, design, responsive et CTA.

### Phase 3 — Institute
Préserver le cursus existant et construire l’expérience pédagogique complète autour de lui.

### Phase 4 — Données
Vérifier chaque donnée dynamique, son endpoint et son fallback.

### Phase 5 — Application
Vérifier les liens landing → application et les routes métier.

### Phase 6 — Admin
Vérifier les flux de gestion sans altérer les données existantes.

### Phase 7 — QA
Build, navigation, console, API, auth, desktop, tablette, mobile.

### Phase 8 — Production
Déploiement Vercel, smoke tests, vérification du domaine et des routes critiques.

## 10. Definition of Done

- `/` affiche uniquement la landing canonique.
- Aucun lien critique n’est mort.
- Aucun doublon de landing n’intervient.
- Build Vercel `READY`.
- Landing responsive.
- Logo correctement dimensionné.
- Données dynamiques réelles.
- Institute accessible et fonctionnel.
- Authentification fonctionnelle.
- Dashboard fonctionnel.
- Admin fonctionnel.
- Supabase préservé.
- API et logique métier préservées.
- Aucune erreur console critique sur les parcours testés.
