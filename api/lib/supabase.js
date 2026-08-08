// ═══════════════════════════════════════════════════════════════════════════════
// THE CAPITAL — Supabase clients
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import config from './config.js';

// ─────────────────────────────────────────────────────────────────────────────
// Public client
// ─────────────────────────────────────────────────────────────────────────────

export const supabase =
  config.supabaseUrl && config.supabaseAnonKey
    ? createClient(
        config.supabaseUrl,
        config.supabaseAnonKey,
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
// Admin / service-role client
// ─────────────────────────────────────────────────────────────────────────────

export const supabaseAdmin =
  config.supabaseUrl && config.supabaseServiceKey
    ? createClient(
        config.supabaseUrl,
        config.supabaseServiceKey,
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
    throw new Error(
      'Supabase public client is not configured.'
    );
  }

  return supabase;
}

export function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error(
      'Supabase admin client is not configured.'
    );
  }

  return supabaseAdmin;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backward compatibility
// ─────────────────────────────────────────────────────────────────────────────

export default supabase;
