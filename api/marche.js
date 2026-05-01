import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Variables d'environnement SUPABASE_URL et SUPABASE_SERVICE_KEY requises');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { type } = req.query;

  try {
    if (type === 'indices') {
      const { data } = await supabase.from('indices_brvm').select('*').order('date_seance', { ascending: false }).limit(20);
      return res.status(200).json({ data: data || [] });
    }

    if (type === 'cours') {
      const { data } = await supabase.from('cours_brvm').select('*').order('date_seance', { ascending: false });
      const seen = new Set();
      const unique = (data || []).filter(c => seen.has(c.ticker) ? false : seen.add(c.ticker) || true);
      return res.status(200).json({ data: unique });
    }

    return res.status(400).json({ error: 'Type requis: indices|cours' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
