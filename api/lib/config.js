// ═══════════════════════════════════════════════════════════════════════════════
// THE CAPITAL — Config (sans throw au chargement pour éviter les 504 silencieux)
// ═══════════════════════════════════════════════════════════════════════════════

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter((k) => !process.env[k]);

// NE PAS throw ici — ça fait planter tout le module et Vercel retourne 504
// On log l'erreur et on continue avec des valeurs null
if (missing.length) {
  console.error("[CONFIG] Variables d'environnement manquantes :", missing.join(', '));
}

const config = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  jwtSecret: process.env.JWT_SECRET || 'unused',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  adminEmail: process.env.ADMIN_EMAIL,
  cronSecret: process.env.CRON_SECRET,
  allowedOrigin: process.env.ALLOWED_ORIGIN || '*',
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },
  // Helper pour vérifier si la config est valide
  isValid: missing.length === 0,
  missingVars: missing,
};

export default config;
