// ═══════════════════════════════════════════════════════════════════════════════
// THE CAPITAL — Health Check
// ═══════════════════════════════════════════════════════════════════════════════

import {
  supabase,
  supabaseAdmin,
  isSupabaseReady,
  isSupabaseAdminReady,
} from './lib/supabase.js';

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE
// ═══════════════════════════════════════════════════════════════════════════════

function sendJson(res, status, body) {
  res.status(status);

  res.setHeader(
    'Content-Type',
    'application/json; charset=utf-8'
  );

  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate'
  );

  return res.json(body);
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

  const result = {
    ok: false,

    timestamp:
      new Date().toISOString(),

    service:
      'thecapital-api',

    supabase: {
      configured:
        isSupabaseReady(),

      connected:
        false,
    },

    supabaseAdmin: {
      configured:
        isSupabaseAdminReady(),

      connected:
        false,
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC SUPABASE TEST
  // ═══════════════════════════════════════════════════════════════════════════

  if (supabase) {
    try {
      /*
       * On utilise une requête minimale.
       *
       * IMPORTANT :
       * Cette table doit exister dans ton projet Supabase.
       * "indices" est utilisée car elle fait partie des tables de ton projet.
       */

      const {
        data,
        error,
      } = await supabase
        .from('indices')
        .select('*')
        .limit(1);

      if (error) {
        result.supabase.error =
          error.message;
      } else {
        result.supabase.connected =
          true;

        result.supabase.rows =
          Array.isArray(data)
            ? data.length
            : 0;
      }
    } catch (error) {
      result.supabase.error =
        error?.message ||
        String(error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN SUPABASE TEST
  // ═══════════════════════════════════════════════════════════════════════════

  if (supabaseAdmin) {
    try {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from('indices')
        .select('*')
        .limit(1);

      if (error) {
        result.supabaseAdmin.error =
          error.message;
      } else {
        result.supabaseAdmin.connected =
          true;

        result.supabaseAdmin.rows =
          Array.isArray(data)
            ? data.length
            : 0;
      }
    } catch (error) {
      result.supabaseAdmin.error =
        error?.message ||
        String(error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  result.ok =
    result.supabase.configured &&
    result.supabase.connected;

  return sendJson(
    res,
    result.ok ? 200 : 503,
    result
  );
}
