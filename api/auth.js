import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ADMIN_TOKEN = Buffer.from("thecapital_admin:TheCapital@BRVM2026!").toString('base64').replace(/=/g, "");

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { action, email, password, nom } = req.body || {};

  try {
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
      return res.status(200).json({ 
        message: 'Compte créé !', 
        session: data.session 
      });
    }

    return res.status(400).json({ error: 'Action inconnue' });

  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}
