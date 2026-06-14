// ═══════════════════════════════════════════════════════
// API — Data Unifiée (fusion de boc.js + fiche.js + marche.js)
// ═══════════════════════════════════════════════════════
import { supabase } from './lib/supabase.js';
import { error, success } from './lib/response.js';
import { rateLimit } from './lib/middleware.js';
import { validate } from './lib/validate.js';
import { corsHeaders, handleOptions } from './lib/cors.js';

const CORS_TYPE = 'public';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return handleOptions(corsHeaders(CORS_TYPE));
  if (req.method !== 'GET') return error('Méthode non autorisée', 405);

  const limit = rateLimit(req);
  if (limit) return limit;

  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint');

  try {
    switch (endpoint) {
      // ─── ANCIEN boc.js ───
      case 'boc': {
        const { data, error: dbError } = await supabase
          .from('boc')
          .select('*')
          .order('date_seance', { ascending: false })
          .limit(100);
        if (dbError) throw dbError;
        return success({ data: data || [] });
      }

      // ─── ANCIEN fiche.js ───
      case 'fiche': {
        const ticker = url.searchParams.get('ticker')?.toUpperCase();
        if (!ticker || !validate({ ticker }, { ticker: { type: 'ticker', required: true } }).valid) {
          return error('Ticker invalide', 400, 'INVALID_TICKER');
        }

        const [
          { data: entreprise },
          { data: cours },
          { data: chartData },
          { data: financials },
          { data: analyses },
        ] = await Promise.all([
          supabase.from('entreprises').select('*').eq('ticker', ticker).single(),
          supabase.from('cours').select('*').eq('ticker', ticker).order('date_seance', { ascending: false }).limit(1).single(),
          supabase.from('historique').select('date_seance, cloture').eq('ticker', ticker).order('date_seance', { ascending: true }).limit(252),
          supabase.from('financials').select('*').eq('ticker', ticker).order('annee', { ascending: false }).limit(5),
          supabase.from('analyses').select('*').eq('ticker', ticker).order('date_analyse', { ascending: false }).limit(5),
        ]);

        let valuation = null;
        if (cours?.cours && financials?.[0]) {
          const f = financials[0];
          const coursVal = parseFloat(cours.cours);
          valuation = {
            per: f.bpa ? (coursVal / parseFloat(f.bpa)).toFixed(1) : null,
            rdt: f.dpa ? ((parseFloat(f.dpa) / coursVal) * 100).toFixed(1) : null,
            p_actif_net: f.fonds_propres ? (coursVal / parseFloat(f.fonds_propres)).toFixed(2) : null,
            cap_bours_mrd: f.nombre_actions ? ((coursVal * parseFloat(f.nombre_actions)) / 1e9).toFixed(2) : null,
          };
        }

        return success({
          entreprise: entreprise || null,
          cours: cours || null,
          chartData: chartData || [],
          financials: financials || [],
          analyses: analyses || [],
          valuation,
        });
      }

      // ─── ANCIEN marche.js ───
      case 'marche': {
        const type = url.searchParams.get('type');

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
      }

      default:
        return error('Endpoint invalide', 400, 'INVALID_ENDPOINT');
    }
  } catch (e) {
    console.error('Data API error:', e);
    return error('Erreur serveur', 500, 'SERVER_ERROR');
  }
}
