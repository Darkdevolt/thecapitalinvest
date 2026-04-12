import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { type } = req.query;

  try {
    if (type === 'indices') {
      const { data } = await supabase
        .from('indices_brvm')
        .select('*')
        .order('date_seance', { ascending: false })
        .limit(20);
      return res.status(200).json({ data: data || [] });
    }

    if (type === 'cours') {
      const { data } = await supabase
        .from('cours_brvm')
        .select('*')
        .order('date_seance', { ascending: false });
      
      // Dédoublonner par ticker (dernier cours)
      const seen = new Set();
      const unique = (data || []).filter(c => {
        if (seen.has(c.ticker)) return false;
        seen.add(c.ticker);
        return true;
      });
      
      return res.status(200).json({ data: unique });
    }

    return res.status(400).json({ error: 'Type requis: indices|cours' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
