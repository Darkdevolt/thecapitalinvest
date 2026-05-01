import { supabase } from './lib/supabase.js';
import { json, error, success } from './lib/response.js';
import { rateLimit } from './lib/middleware.js';
import { validate } from './lib/validate.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization,Content-Type',
      },
    });
  }

  if (req.method !== 'GET') return error('Méthode non autorisée', 405);

  const limit = rateLimit(req);
  if (limit) return limit;

  const url = new URL(req.url);
  const ticker = url.searchParams.get('ticker')?.toUpperCase();

  if (!ticker || !validate({ ticker }, { ticker: { type: 'ticker', required: true } }).valid) {
    return error('Ticker invalide', 400, 'INVALID_TICKER');
  }

  try {
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
  } catch (e) {
    console.error('Fiche API error:', e);
    return error('Erreur serveur', 500, 'SERVER_ERROR');
  }
}
