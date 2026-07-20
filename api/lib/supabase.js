// ═══════════════════════════════════════════════════════════════════════════════
// THE CAPITAL — Supabase Clients (avec vérification de config)
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import config from './config.js';

// Vérification explicite — retourne null si config invalide au lieu de planter
function createSafeClient(url, key, options = {}) {
  if (!url || !key) {
    console.error('[SUPABASE] Impossible de créer le client : URL ou clé manquante');
    return null;
  }
  try {
    return createClient(url, key, options);
  } catch (e) {
    console.error('[SUPABASE] Erreur création client:', e.message);
    return null;
  }
}

// Client avec clé anonyme (lecture publique)
export const supabase = createSafeClient(config.supabaseUrl, config.supabaseAnonKey);

// Client avec service role (admin uniquement)
export const supabaseAdmin = createSafeClient(
  config.supabaseUrl,
  config.supabaseServiceKey,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Helper pour vérifier si les clients sont prêts
export function isSupabaseReady() {
  return !!supabase && !!supabaseAdmin;
}
