import { createClient } from '@supabase/supabase-js';

// Fallback pour debug
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://otsiwiwlnowxeolbbgvm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_KEY) {
  throw new Error('SUPABASE_SERVICE_KEY manquant dans les variables d\'environnement');
}

if (!SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY is missing!');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY || 'dummy-key');

export default async function handler(req, res) {
  // Si pas de clé, retourner erreur explicite
  if (!SUPABASE_KEY) {
    return res.status(500).json({ 
      error: 'Configuration error: SUPABASE_SERVICE_KEY missing',
      debug: { url: !!process.env.SUPABASE_URL, key: !!SUPABASE_KEY }
    });
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const { action, email, password, nom } = req.body || {};

    if (action === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return res.status(200).json({ session: data.session });
    }

    if (action === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nom } }
      });
      if (error) throw error;
      return res.status(200).json({ message: 'Compte créé !', session: data.session });
    }

    return res.status(400).json({ error: 'Action inconnue' });

  } catch (err) {
    console.error('Auth error:', err);
    return res.status(400).json({ error: err.message });
  }
}
