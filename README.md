# The Capital — Intelligence Financière Africaine

Plateforme d'intelligence financière dédiée à la BRVM et aux marchés africains.

## Architecture

- **Frontend** : HTML/CSS/JS vanilla, hébergé statiquement
- **Backend** : Vercel Serverless Functions (`api/`)
- **Base de données** : Supabase (PostgreSQL)
- **Auth** : JWT avec `jose` (Ed25519)
- **Scraping** : Cron Vercel quotidien

## Structure

```
the-capital/
├── api/                    # Serverless functions
│   ├── auth.js            # Authentification
│   ├── admin.js           # Administration
│   ├── marche.js          # Données de marché
│   ├── portefeuille.js    # Gestion portefeuille
│   ├── fiche.js           # Fiches entreprises
│   ├── contact.js         # Formulaire contact
│   ├── boc.js             # Archives BOC
│   └── scraper.js         # Scraper BRVM
├── public/                 # Fichiers statiques
│   ├── index.html
│   ├── app.html
│   ├── admin.html
│   ├── login.html
│   ├── style.css
│   └── ...
├── vercel.json            # Configuration Vercel
├── package.json
└── .env.example
```

## Développement

```bash
# Installer les dépendances
npm install

# Lancer en local
vercel dev
```

## Déploiement

```bash
# Déployer en production
vercel --prod
```

## Variables d'environnement

Copier `.env.example` vers `.env` et remplir les valeurs dans le dashboard Vercel.

## Sécurité

- JWT signés avec Ed25519
- Rate limiting par IP
- Validation des entrées
- Headers de sécurité (CSP, HSTS, etc.)
- Pas de secrets en dur dans le code
