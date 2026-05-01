import { createClient } from '@supabase/supabase-js';

// ── VALIDATION DES VARIABLES D'ENVIRONNEMENT ──
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Variables d\'environnement SUPABASE_URL et SUPABASE_SERVICE_KEY requises');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const getUser = async (authHeader) => {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const user = await getUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  const { type, id } = req.query;

  try {
    // WATCHLIST
    if (type === 'watchlist') {
      if (req.method === 'GET') {
        const { data } = await supabase.from('watchlist').select('*').eq('user_id', user.id);
        return res.status(200).json({ data: data || [] });
      }
      if (req.method === 'POST') {
        const { ticker, note } = req.body;
        const { data, error } = await supabase.from('watchlist').insert({ user_id: user.id, ticker, note }).select().single();
        if (error?.code === '23505') return res.status(409).json({ error: 'Déjà en watchlist' });
        return res.status(200).json({ data });
      }
      if (req.method === 'DELETE' && id) {
        await supabase.from('watchlist').delete().eq('id', id).eq('user_id', user.id);
        return res.status(200).json({ success: true });
      }
    }

    // ALERTES
    if (type === 'alertes') {
      if (req.method === 'GET') {
        const { data } = await supabase.from('alertes_cours').select('*').eq('user_id', user.id);
        return res.status(200).json({ data: data || [] });
      }
      if (req.method === 'POST') {
        const { ticker, type_alerte, seuil, note } = req.body;
        const { data } = await supabase.from('alertes_cours').insert({ 
          user_id: user.id, ticker, type_alerte, seuil, note, active: true 
        }).select().single();
        return res.status(200).json({ data });
      }
      if (req.method === 'DELETE' && id) {
        await supabase.from('alertes_cours').delete().eq('id', id).eq('user_id', user.id);
        return res.status(200).json
