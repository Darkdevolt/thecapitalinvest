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
        .from('entreprises')
        .select('*')
        .order('ticker');
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const { ticker, nom, secteur, pays, compartiment, description } = req.body;
      if (!ticker || !nom) {
        return res.status(400).json({ error: 'ticker et nom requis' });
      }
      const { data, error } = await supabase
        .from('entreprises')
        .insert({
          ticker: ticker.toUpperCase(),
          nom,
          secteur,
          pays,
          compartiment,
          description
        })
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'PUT') {
      const { ticker } = req.query;
      if (!ticker) return res.status(400).json({ error: 'ticker requis' });
      const updates = req.body;
      delete updates.ticker;
      const { data, error } = await supabase
        .from('entreprises')
        .update(updates)
        .eq('ticker', ticker.toUpperCase())
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { ticker } = req.query;
      if (!ticker) return res.status(400).json({ error: 'ticker requis' });
      const { error } = await supabase
        .from('entreprises')
        .delete()
        .eq('ticker', ticker.toUpperCase());
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    console.error('Admin entreprises error:', err);
    return res.status(500).json({ error: err.message });
  }
}
