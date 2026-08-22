// ═══════════════════════════════════════════════════════════════════════════════
// THE CAPITAL — Configuration
// ═══════════════════════════════════════════════════════════════════════════════

function getEnv(keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && String(value).trim()) return String(value).trim();
  }
  return '';
}

function normalizeSupabaseUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(String(value).trim());
    return url.origin.replace(/\/$/, '');
  } catch {
    return String(value).trim().replace(/\/$/, '');
  }
}

const config = {
  supabaseUrl: normalizeSupabaseUrl(getEnv(['SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL'])),
  supabasePublishableKey: getEnv(['SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY']),
  supabaseAnonKey: getEnv(['SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY']),
  supabaseSecretKey: getEnv(['SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY']),
  supabaseServiceKey: getEnv(['SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY']),
  // JWT_SECRET a été retiré : l'authentification est entièrement déléguée à
  // Supabase. La valeur de repli 'unused' rendait tout jeton signé localement
  // forgeable par quiconque lisait le dépôt.
  adminEmail: process.env.ADMIN_EMAIL || '',
  cronSecret: process.env.CRON_SECRET || '',
  // Liste blanche d'origines, séparées par des virgules. '*' n'est acceptable
  // que pour les routes de lecture publiques (voir lib/http.js).
  allowedOrigin: process.env.ALLOWED_ORIGIN || '*',
  rateLimit: { windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS,10) || 60000, maxRequests: parseInt(process.env.RATE_MAX_REQUESTS,10) || 100 },
};
const missingPublicVars=[];
if(!config.supabaseUrl) missingPublicVars.push('SUPABASE_URL');
if(!config.supabasePublishableKey) missingPublicVars.push('SUPABASE_PUBLISHABLE_KEY');
const missingAdminVars=[];
if(!config.supabaseSecretKey) missingAdminVars.push('SUPABASE_SECRET_KEY');
config.isPublicValid=missingPublicVars.length===0;
config.isAdminValid=config.isPublicValid&&missingAdminVars.length===0;
config.isValid=config.isPublicValid;
config.missingPublicVars=missingPublicVars;
config.missingAdminVars=missingAdminVars;
config.missingVars=[...missingPublicVars,...missingAdminVars];
if(missingPublicVars.length>0) console.error('[CONFIG] Supabase public configuration incomplete:',missingPublicVars.join(', '));
if(missingAdminVars.length>0) console.warn('[CONFIG] Supabase secret key missing. Privileged routes will be unavailable.');
export default config;
