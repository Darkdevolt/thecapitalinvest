// ═══════════════════════════════════════════════════════════════════════════════
// THE CAPITAL — Configuration
// ═══════════════════════════════════════════════════════════════════════════════

function getEnv(keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && String(value).trim()) {
      return String(value).trim();
    }
  }

  return '';
}

const config = {
  // ─────────────────────────────────────────────────────────────────────────────
  // Supabase public
  // ─────────────────────────────────────────────────────────────────────────────
  supabaseUrl: getEnv([
    'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
  ]),

  supabaseAnonKey: getEnv([
    'SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  ]),

  // ─────────────────────────────────────────────────────────────────────────────
  // Supabase privileged / server-side
  // ─────────────────────────────────────────────────────────────────────────────
  supabaseServiceKey: getEnv([
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SECRET_KEY',
  ]),

  // ─────────────────────────────────────────────────────────────────────────────
  // Auth / application
  // ─────────────────────────────────────────────────────────────────────────────
  jwtSecret:
    getEnv([
      'JWT_SECRET',
      'SUPABASE_JWT_SECRET',
    ]) || 'unused',

  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',

  adminEmail: process.env.ADMIN_EMAIL || '',

  cronSecret: process.env.CRON_SECRET || '',

  allowedOrigin: process.env.ALLOWED_ORIGIN || '*',

  rateLimit: {
    windowMs:
      parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60_000,

    maxRequests:
      parseInt(process.env.RATE_MAX_REQUESTS, 10) || 100,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

const missingPublicVars = [];

if (!config.supabaseUrl) {
  missingPublicVars.push('SUPABASE_URL');
}

if (!config.supabaseAnonKey) {
  missingPublicVars.push('SUPABASE_ANON_KEY');
}

const missingAdminVars = [];

if (!config.supabaseServiceKey) {
  missingAdminVars.push('SUPABASE_SERVICE_ROLE_KEY');
}

// Public API
config.isPublicValid = missingPublicVars.length === 0;

// Privileged API
config.isAdminValid =
  config.isPublicValid &&
  missingAdminVars.length === 0;

// Backward compatibility
config.isValid = config.isPublicValid;

config.missingPublicVars = missingPublicVars;
config.missingAdminVars = missingAdminVars;

config.missingVars = [
  ...missingPublicVars,
  ...missingAdminVars,
];

// ─────────────────────────────────────────────────────────────────────────────
// Logs
// ─────────────────────────────────────────────────────────────────────────────

if (missingPublicVars.length > 0) {
  console.error(
    '[CONFIG] Supabase public configuration incomplete:',
    missingPublicVars.join(', ')
  );
}

if (missingAdminVars.length > 0) {
  console.warn(
    '[CONFIG] Supabase service-role key missing. ' +
    'Privileged routes will be unavailable.'
  );
}

export default config;
