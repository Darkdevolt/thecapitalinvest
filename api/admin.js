// api/admin.js — API admin centralisée (toutes les actions admin)
import { createClient } from '@supabase/supabase-js';

// ── VALIDATION DES VARIABLES D'ENVIRONNEMENT ──
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Variables d\'environnement SUPABASE_URL et SUPABASE_SERVICE_KEY requises');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function isAdmin(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error ||
