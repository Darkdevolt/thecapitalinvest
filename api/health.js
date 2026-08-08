// ═══════════════════════════════════════════════════════════════════════════════
// THE CAPITAL — Health Check
// ═══════════════════════════════════════════════════════════════════════════════

import config from './lib/config.js';
import {
  supabase,
  supabaseAdmin,
  isSupabaseReady,
  isSupabaseAdminReady,
} from './lib/supabase.js';

const HEALTH_TIMEOUT_MS = 5000;

function sendJson(res, status, body) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res.json(body);
}

async function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`${label} timeout after ${HEALTH_TIMEOUT_MS}ms`)),
        HEALTH_TIMEOUT_MS
      );
    }),
  ]);
}

async function checkClient(client, label) {
  if (!client) {
    return {
      configured: false,
      connected: false,
      error: 'Client non configuré',
    };
  }

  try {
    const { data, error } = await withTimeout(
      client.from('indices').select('id').limit(1),
      label
    );

    if (error) {
      return {
        configured: true,
        connected: false,
        error: error.message,
        code: error.code || null,
      };
    }

    return {
      configured: true,
      connected: true,
      table: 'indices',
      rows: Array.isArray(data) ? data.length : 0,
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      error: error?.message || String(error),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, {
      ok: false,
      error: 'Method not allowed',
    });
  }

  const publicCheck = await checkClient(supabase, 'supabase-public');
  const adminCheck = await checkClient(supabaseAdmin, 'supabase-admin');

  const result = {
    ok:
      config.isPublicValid &&
      publicCheck.connected &&
      config.isAdminValid &&
      adminCheck.connected,

    timestamp: new Date().toISOString(),
    service: 'thecapital-api',

    supabase: {
      url_configured: Boolean(config.supabaseUrl),
      url_origin: config.supabaseUrl || null,
      public_client: publicCheck,
    },

    supabaseAdmin: {
      secret_configured: Boolean(config.supabaseSecretKey),
      admin_client: adminCheck,
    },

    configuration: {
      public_valid: config.isPublicValid,
      admin_valid: config.isAdminValid,
      missing_public: config.missingPublicVars,
      missing_admin: config.missingAdminVars,
    },
  };

  return sendJson(res, result.ok ? 200 : 503, result);
}
