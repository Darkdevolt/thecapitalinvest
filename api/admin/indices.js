import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ADMIN_TOKEN = "thecapital_admin:TheCapital@BRVM2026!";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('indices_brvm')
        .select('*')
        .order('date_seance', { ascending: false })
        .limit(100);
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const { indice, date_seance, valeur, variation } = req.body;
      if (!indice || !date_seance || valeur == null) {
        return res.status(400).json({ error: 'indice, date_seance et valeur requis' });
      }
      const { data, error } = await supabase
        .from('indices_brvm')
        .upsert({ indice, date_seance, valeur, variation }, { onConflict: 'indice,date_seance' })
        .select();
      if (error) throw error;
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    console.error('Admin indices error:', err);
    return res.status(500).json({ error: err.message });
  }
}
