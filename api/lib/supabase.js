import { createClient } from '@supabase/supabase-js';
import config from './config.js';

// Client avec clé anonyme (lecture publique)
export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

// Client avec service role (admin uniquement)
export const supabaseAdmin = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
