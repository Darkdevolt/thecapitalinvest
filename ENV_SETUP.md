# ============================================================
# CONFIGURATION ENVIRONNEMENT — The Capital
# ============================================================
# 
# Copiez ces variables dans le dashboard Vercel :
# Project Settings → Environment Variables
#
# OU utilisez la CLI :
# vercel env add SUPABASE_URL
# vercel env add SUPABASE_ANON_KEY
# etc.

# Supabase (obligatoire)
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# JWT (obligatoire — min 32 caractères)
JWT_SECRET=votre-secret-ultra-securise-min-32-caracteres-ici

# Admin (optionnel)
ADMIN_EMAIL=admin@thecapitalinvest.com

# Scraper (optionnel — pour sécuriser le cron)
CRON_SECRET=votre-secret-cron-aleatoire
