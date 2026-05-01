import { supabase } from './lib/supabase.js';
import { json, error, success } from './lib/response.js';
import { rateLimit } from './lib/middleware.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'GET') return error('Méthode non autorisée', 405);

  const limit = rateLimit(req);
  if (limit) return limit;

  try {
    const { data, error: dbError } = await supabase
      .from('boc')
      .select('*')
      .order('date_seance', { ascending: false })
      .limit(100);

    if (dbError) throw dbError;
    return success({ data: data || [] });
  } catch (e) {
    console.error('BOC API error:', e);
    return error('Erreur serveur', 500, 'SERVER_ERROR');
  }
}
