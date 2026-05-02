// FIX Q-01 : suppression de l'import 'json' inutilisé
// FIX S-03 : CORS public (données de marché publiques)
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

  const url = new URL(req.url);
  const type = url.searchParams.get('type');

  try {
    switch (type) {
      case 'indices': {
        const { data, error: dbError } = await supabase
          .from('indices')
          .select('*')
          .order('date_seance', { ascending: false })
          .limit(20);
        if (dbError) throw dbError;
        return success({ data: data || [] });
      }

      case 'cours': {
        const { data, error: dbError } = await supabase
          .from('cours')
          .select('*')
          .order('date_seance', { ascending: false })
          .limit(100);
        if (dbError) throw dbError;
        return success({ data: data || [] });
      }

      case 'historique': {
        const ticker = url.searchParams.get('ticker')?.toUpperCase();
        if (!ticker) return error('Ticker requis', 400, 'MISSING_TICKER');

        const { data, error: dbError } = await supabase
          .from('historique')
          .select('*')
          .eq('ticker', ticker)
          .order('date_seance', { ascending: false })
          .limit(252);
        if (dbError) throw dbError;
        return success({ data: data || [] });
      }

      default:
        return error('Type invalide', 400, 'INVALID_TYPE');
    }
  } catch (e) {
    console.error('Marche API error:', e);
    return error('Erreur serveur', 500, 'SERVER_ERROR');
  }
}
