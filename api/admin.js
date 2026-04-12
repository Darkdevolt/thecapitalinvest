import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ADMIN_TOKEN = "thecapital_admin:TheCapital@BRVM2026!";

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Vérification token admin
  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const { type } = req.query;

  try {
    // --- ENTREPRISES ---
    if (type === 'entreprises') {
      if (req.method === 'GET') {
        const { data, error } = await supabase.from('entreprises').select('*').order('ticker');
        if (error) throw error;
        return res.status(200).json(data || []);
      }
      if (req.method === 'POST') {
        const { ticker, nom, secteur, pays, compartiment, description } = req.body;
        if (!ticker || !nom) return res.status(400).json({ error: 'ticker et nom requis' });
        const { data, error } = await supabase.from('entreprises').insert({
          ticker: ticker.toUpperCase(), nom, secteur, pays, compartiment, description
        }).select().single();
        if (error) throw error;
        return res.status(200).json(data);
      }
      if (req.method === 'PUT') {
        const { ticker } = req.query;
        if (!ticker) return res.status(400).json({ error: 'ticker requis' });
        const updates = req.body;
        delete updates.ticker;
        const { data, error } = await supabase.from('entreprises').update(updates).eq('ticker', ticker.toUpperCase()).select().single();
        if (error) throw error;
        return res.status(200).json(data);
      }
      if (req.method === 'DELETE') {
        const { ticker } = req.query;
        if (!ticker) return res.status(400).json({ error: 'ticker requis' });
        const { error } = await supabase.from('entreprises').delete().eq('ticker', ticker.toUpperCase());
        if (error) throw error;
        return res.status(200).json({ success: true });
      }
    }

    // --- COURS ---
    if (type === 'cours') {
      if (req.method === 'GET') {
        const { data, error } = await supabase.from('cours_brvm').select('*').order('date_seance', { ascending: false }).limit(200);
        if (error) throw error;
        return res.status(200).json(data || []);
      }
      if (req.method === 'POST') {
        const { ticker, date_seance, cours, variation, volume, ouverture, plus_haut, plus_bas } = req.body;
        if (!ticker || !date_seance || cours == null) return res.status(400).json({ error: 'champs requis' });
        const { data, error } = await supabase.from('cours_brvm').upsert({
          ticker: ticker.toUpperCase(), date_seance, cours, variation, volume, ouverture, plus_haut, plus_bas
        }, { onConflict: 'ticker,date_seance' }).select();
        if (error) throw error;
        return res.status(200).json(data);
      }
      if (req.method === 'DELETE') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'id requis' });
        const { error } = await supabase.from('cours_brvm').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }
    }

    // --- INDICES ---
    if (type === 'indices') {
      if (req.method === 'GET') {
        const { data, error } = await supabase.from('indices_brvm').select('*').order('date_seance', { ascending: false }).limit(100);
        if (error) throw error;
        return res.status(200).json(data || []);
      }
      if (req.method === 'POST') {
        const { indice, date_seance, valeur, variation } = req.body;
        if (!indice || !date_seance || valeur == null) return res.status(400).json({ error: 'champs requis' });
        const { data, error } = await supabase.from('indices_brvm').upsert({ indice, date_seance, valeur, variation }, { onConflict: 'indice,date_seance' }).select();
        if (error) throw error;
        return res.status(200).json(data);
      }
    }

    // --- USERS ---
    if (type === 'users') {
      if (req.method === 'GET') {
        const { data, error } = await supabase.auth.admin.listUsers();
        if (error) throw error;
        const users = data.users.map(u => ({ id: u.id, email: u.email, created_at: u.created_at, raw_user_meta_data: u.user_metadata }));
        return res.status(200).json(users);
      }
    }

    // --- ANALYSES ---
    if (type === 'analyses') {
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
        if (!ticker || !date_analyse || !recommandation) return res.status(400).json({ error: 'champs requis' });
        const { data, error } = await supabase.from('analyses').insert({
          ticker: ticker.toUpperCase(), date_analyse, recommandation, objectif_cours, commentaire
        }).select().single();
        if (error) throw error;
        return res.status(200).json(data);
      }
      if (req.method === 'DELETE') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'id requis' });
        const { error } = await supabase.from('analyses').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }
    }

    // --- BOC LIST ---
    if (type === 'boc_list') {
      if (req.method === 'GET') {
        const { data, error } = await supabase.from('boc_imports').select('*').order('date_seance', { ascending: false });
        if (error) throw error;
        return res.status(200).json(data || []);
      }
    }

    return res.status(400).json({ error: 'Type ou méthode non supporté' });
  } catch (err) {
    console.error('Admin API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
