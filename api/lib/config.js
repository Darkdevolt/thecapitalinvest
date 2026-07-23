// ═══════════════════════════════════════════════════════════════════════════════
// THE CAPITAL — Config (compatibilité avec les noms de variables Vercel existants)
// ═══════════════════════════════════════════════════════════════════════════════

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

// Mapping des noms alternatifs
function getEnv(keys) {
  for (const k of keys) {
    if (process.env[k]) return process.env[k];
  }
  return '';
}

const config = {
  supabaseUrl: getEnv(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']),
  supabaseAnonKey: getEnv(['SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']),
  supabaseServiceKey: getEnv(['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY']),
  jwtSecret: getEnv(['JWT_SECRET', 'SUPABASE_JWT_SECRET']) || 'unused',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  adminEmail: process.env.ADMIN_EMAIL,
  cronSecret: process.env.CRON_SECRET,
  allowedOrigin: process.env.ALLOWED_ORIGIN || '*',
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    maxRequests: parseInt(process.env.RATE_MAX_REQUESTS) || 100,
  },
  isValid: true, // On vérifie après
  missingVars: [],
};

// Vérification finale
const missing = [];
if (!config.supabaseUrl) missing.push('SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL)');
if (!config.supabaseAnonKey) missing.push('SUPABASE_ANON_KEY (ou équivalent)');
if (!config.supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY (ou équivalent)');

config.isValid = missing.length === 0;
config.missingVars = missing;

if (missing.length) {
  console.error("[CONFIG] Variables d'environnement manquantes :", missing.join(', '));
}

export default config;
