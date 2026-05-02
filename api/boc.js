// FIX Q-01 : suppression de l'import 'json' inutilisé
// FIX S-03 : CORS public (BOC = données publiques)
import { supabase } from './lib/supabase.js';
import { error, success } from './lib/response.js';
import { rateLimit } from './lib/middleware.js';
import { corsHeaders, handleOptions } from './lib/cors.js';

const CORS_TYPE = 'public';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return handleOptions(corsHeaders(CORS_TYPE));
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
