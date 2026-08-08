// ═══════════════════════════════════════════════════════════════════════════════
// THE CAPITAL — Configuration
// ═══════════════════════════════════════════════════════════════════════════════

function getEnv(keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }

  return '';
}

function normalizeSupabaseUrl(value) {
  if (!value) return '';

  try {
    const url = new URL(String(value).trim());

    // SUPABASE_URL must always be the project origin only.
    // This deliberately removes /rest/v1, /auth/v1, /storage/v1,
    // /realtime/v1, /functions/v1 and any other accidental path/query.
    return url.origin.replace(/\/$/, '');
  } catch {
    // Keep an invalid value visible to validation rather than silently
    // inventing a URL.
    return String(value).trim().replace(/\/$/, '');
  }
}

const config = {
  // ─────────────────────────────────────────────────────────────────────────────
  // Supabase public
  // Canonical: SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY
  // Legacy aliases are retained only for backward compatibility.
  // ─────────────────────────────────────────────────────────────────────────────
  supabaseUrl: normalizeSupabaseUrl(
    getEnv([
      'SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
    ])
  ),

  supabasePublishableKey: getEnv([
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]),

  // Backward-compatible property used by existing application code.
  supabaseAnonKey: getEnv([
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]),

  // ─────────────────────────────────────────────────────────────────────────────
  // Supabase privileged / server-side
  // Canonical: SUPABASE_SECRET_KEY
  // Legacy service-role alias remains supported during migration.
  // ─────────────────────────────────────────────────────────────────────────────
  supabaseSecretKey: getEnv([
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]),

  // Backward-compatible property used by existing application code.
  supabaseServiceKey: getEnv([
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
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

if (!config.supabasePublishableKey) {
  missingPublicVars.push('SUPABASE_PUBLISHABLE_KEY');
}

const missingAdminVars = [];

if (!config.supabaseSecretKey) {
  missingAdminVars.push('SUPABASE_SECRET_KEY');
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
// Logs — never log secret values.
// ─────────────────────────────────────────────────────────────────────────────

if (missingPublicVars.length > 0) {
  console.error(
    '[CONFIG] Supabase public configuration incomplete:',
    missingPublicVars.join(', ')
  );
}

if (missingAdminVars.length > 0) {
  console.warn(
    '[CONFIG] Supabase secret key missing. Privileged routes will be unavailable.'
  );
}

export default config;
