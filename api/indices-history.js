import { supabase, supabaseAdmin } from '../lib/supabase.js';

const db = supabaseAdmin || supabase;

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method Not Allowed' });
  try {
    if (!db) throw new Error('Supabase non configuré');
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 30, 1), 5000);
    const q = db.from('indices')
      .select('*')
      .not('date_seance', 'is', null)
      .not('valeur', 'is', null)
      .order('date_seance', { ascending: false })
      .limit(limit * 10);
    const result = await q;
    if (result.error) throw result.error;

    const rows = Array.isArray(result.data) ? result.data : [];
    const names = new Map();
    rows.forEach((row) => {
      const name = String(row?.indice || '').trim();
      if (name) names.set(name.toLowerCase(), name);
    });

    const wanted = ['brvm c', 'brvm composite', 'composite', 'brvm_30', 'brvm 30', 'brvm30', 'brvm prestige', 'prestige'];
    const selectedNames = new Set();
    wanted.forEach((candidate) => {
      const exact = names.get(candidate);
      if (exact) selectedNames.add(exact);
    });

    const filtered = rows.filter((row) => selectedNames.has(String(row?.indice || '').trim()));
    return json(res, 200, filtered);
  } catch (error) {
    console.error('[API/INDICES-HISTORY]', error);
    return json(res, 500, { error: error.message || 'Erreur serveur' });
  }
}
