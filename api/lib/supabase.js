// ═══════════════════════════════════════════════════════════════════════════════
// THE CAPITAL — Supabase clients
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import config from './config.js';

// SUPABASE_URL is normalized by config.js to the project origin only.
// The Supabase SDK itself appends /rest/v1, /auth/v1, etc. as required.
const supabaseUrl = config.supabaseUrl;

// ─────────────────────────────────────────────────────────────────────────────
// Public client
// ─────────────────────────────────────────────────────────────────────────────

export const supabase =
  supabaseUrl && config.supabasePublishableKey
    ? createClient(
        supabaseUrl,
        config.supabasePublishableKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      )
    : null;

// ─────────────────────────────────────────────────────────────────────────────
// Admin / secret client
// ─────────────────────────────────────────────────────────────────────────────

export const supabaseAdmin =
  supabaseUrl && config.supabaseSecretKey
    ? createClient(
        supabaseUrl,
        config.supabaseSecretKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      )
    : null;

// ─────────────────────────────────────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────────────────────────────────────

export function isSupabaseReady() {
  return !!supabase;
}

export function isSupabaseAdminReady() {
  return !!supabaseAdmin;
}

// ─────────────────────────────────────────────────────────────────────────────
// Required clients
// ─────────────────────────────────────────────────────────────────────────────

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase public client is not configured.');
  }

  return supabase;
}

export function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not configured.');
  }

  return supabaseAdmin;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backward compatibility
// ─────────────────────────────────────────────────────────────────────────────

export default supabase;
