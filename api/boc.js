import { supabase, supabaseAdmin } from '../server/lib/supabase.js';

const db = supabaseAdmin || supabase;

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { success: false, error: 'Method Not Allowed' });
  if (!db) return json(res, 503, { success: false, error: 'Supabase non configuré' });

  try {
    const { data, error } = await db.from('boc').select('*').order('date_seance', { ascending: false }).limit(500);
    if (error) throw error;
    return json(res, 200, { success: true, data: data || [] });
  } catch (error) {
    console.error('[API/BOC]', error);
    return json(res, 500, { success: false, error: error.message || 'Erreur serveur' });
  }
}
