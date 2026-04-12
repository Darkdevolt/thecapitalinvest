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
      // DELETE individuel (si besoin) conservé, mais la suppression groupée utilise delete_cours
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

    // --- SUPPRESSION GROUPÉE DE BOCS ---
    if (type === 'delete_bocs' && req.method === 'DELETE') {
      const { ids, dates, filenames } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Liste d\'IDs requise' });
      }

      let deletedCount = 0;
      const errors = [];

      // 1. Supprimer les enregistrements dans boc_imports
      const { error: dbError, count } = await supabase
        .from('boc_imports')
        .delete()
        .in('id', ids);
      
      if (dbError) {
        errors.push(`Base de données: ${dbError.message}`);
      } else {
        deletedCount = count || ids.length;
      }

      // 2. Supprimer les fichiers du storage
      for (let i = 0; i < ids.length; i++) {
        const date = dates[i];
        const filename = filenames[i];
        try {
          const { data: files, error: listError } = await supabase.storage
            .from('boc_pdfs')
            .list(date);
          
          if (listError) throw listError;
          
          const targetFile = files?.find(f => f.name.includes(filename.replace('.pdf', '')));
          if (targetFile) {
            const { error: removeError } = await supabase.storage
              .from('boc_pdfs')
              .remove([`${date}/${targetFile.name}`]);
            if (removeError) throw removeError;
          }
        } catch (e) {
          errors.push(`Storage (${filename}): ${e.message}`);
        }
      }

      return res.status(200).json({
        success: errors.length === 0,
        deleted_count: deletedCount,
        errors: errors.length ? errors : undefined
      });
    }

    // --- SUPPRESSION GROUPÉE DE COURS (par IDs) ---
    if (type === 'delete_cours' && req.method === 'DELETE') {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Liste d\'IDs requise' });
      }

      const { error, count } = await supabase
        .from('cours_brvm')
        .delete()
        .in('id', ids);

      if (error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ success: true, deleted_count: count || ids.length });
    }

    // --- SUPPRESSION D'UNE SÉANCE ENTIÈRE (cours + indices) ---
    if (type === 'delete_seance' && req.method === 'DELETE') {
      const { date } = req.body;
      if (!date) {
        return res.status(400).json({ error: 'Date requise' });
      }

      let coursDeleted = 0;
      let indicesDeleted = 0;

      const { error: coursError, count: coursCount } = await supabase
        .from('cours_brvm')
        .delete()
        .eq('date_seance', date);
      if (coursError) {
        return res.status(500).json({ error: `Erreur cours: ${coursError.message}` });
      }
      coursDeleted = coursCount || 0;

      const { error: indicesError, count: indicesCount } = await supabase
        .from('indices_brvm')
        .delete()
        .eq('date_seance', date);
      if (indicesError) {
        return res.status(500).json({ error: `Erreur indices: ${indicesError.message}` });
      }
      indicesDeleted = indicesCount || 0;

      return res.status(200).json({
        success: true,
        cours_deleted: coursDeleted,
        indices_deleted: indicesDeleted
      });
    }

    return res.status(400).json({ error: 'Type ou méthode non supporté' });
  } catch (err) {
    console.error('Admin API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
