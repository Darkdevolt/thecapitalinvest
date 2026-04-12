import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ADMIN_TOKEN = "thecapital_admin:TheCapital@BRVM2026!";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('cours_brvm')
        .select('*')
        .order('date_seance', { ascending: false })
        .limit(200);
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const { ticker, date_seance, cours, variation, volume, ouverture, plus_haut, plus_bas } = req.body;
      if (!ticker || !date_seance || cours == null) {
        return res.status(400).json({ error: 'ticker, date_seance et cours requis' });
      }
      const { data, error } = await supabase
        .from('cours_brvm')
        .upsert({
          ticker: ticker.toUpperCase(),
          date_seance,
          cours,
          variation,
          volume,
          ouverture,
          plus_haut,
          plus_bas
        }, { onConflict: 'ticker,date_seance' })
        .select();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id requis' });
      const { error } = await supabase
        .from('cours_brvm')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    console.error('Admin cours error:', err);
    return res.status(500).json({ error: err.message });
  }
}
