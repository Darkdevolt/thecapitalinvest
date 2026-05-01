import { createClient } from '@supabase/supabase-js';

// ── VALIDATION DES VARIABLES D'ENVIRONNEMENT ──
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Variables d\'environnement SUPABASE_URL et SUPABASE_SERVICE_KEY requises');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
  // Accès public sans authentification
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode GET requise' });
  }

  try {
    const { data, error } = await supabase
      .from('boc_imports')
      .select('*')
      .order('date_seance', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data || []);
  } catch (err) {
    console.error('BOC public error:', err);
    return res.status(500).json({ error: err.message });
  }
}
