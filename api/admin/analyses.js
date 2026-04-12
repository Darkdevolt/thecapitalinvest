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
      const { ticker } = req.query;
      let query = supabase.from('analyses').select('*').order('date_analyse', { ascending: false });
      if (ticker) query = query.eq('ticker', ticker.toUpperCase());
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const { ticker, date_analyse, recommandation, objectif_cours, commentaire } = req.body;
      if (!ticker || !date_analyse || !recommandation) {
        return res.status(400).json({ error: 'ticker, date_analyse et recommandation requis' });
      }
      const { data, error } = await supabase
        .from('analyses')
        .insert({
          ticker: ticker.toUpperCase(),
          date_analyse,
          recommandation,
          objectif_cours,
          commentaire
        })
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id requis' });
      const { error } = await supabase
        .from('analyses')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
