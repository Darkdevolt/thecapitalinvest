import { supabase, supabaseAdmin } from '../lib/supabase.js';
import { json, fail, applyCors, requestUrl } from '../lib/http.js';

const db = supabaseAdmin || supabase;
const CACHE_TTL_MS = 60 * 1000;
let memoryCache = null;

const safeNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function latestDateFor(tableName) {
  const { data, error } = await db.from(tableName).select('date_seance').not('date_seance', 'is', null).order('date_seance', { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0]?.date_seance || null;
}

async function loadSnapshot() {
  if (!db) throw new Error('Supabase non configuré');
  const latestCoursDate = await latestDateFor('historique');
  const latestIndicesDate = await latestDateFor('indices');
  const sessionDate = [latestCoursDate, latestIndicesDate].filter(Boolean).sort().reverse()[0] || null;
  if (!sessionDate) return { success: true, cours: [], indices: [], session_date: null };

  const [coursResult, indicesResult] = await Promise.all([
    db.from('historique')
      .select('id,ticker,cours_cloture,cloture,cours_normal,variation_pct,variation,volume,valeur_totale,date_seance')
      .eq('date_seance', latestCoursDate)
      .order('ticker', { ascending: true })
      .limit(1000),
    db.from('indices')
      .select('*')
      .eq('date_seance', latestIndicesDate)
      .order('indice', { ascending: true })
      .limit(20),
  ]);

  if (coursResult.error) throw coursResult.error;
  if (indicesResult.error) throw indicesResult.error;

  const cours = (coursResult.data || []).map(r => {
    const close = r.cours_cloture ?? r.cloture ?? r.cours_normal ?? null;
    const pct = safeNumber(r.variation_pct ?? r.variation);
    return {
      id: r.id,
      ticker: String(r.ticker || '').trim().toUpperCase(),
      cours: close,
      cours_cloture: close,
      variation_pct: pct,
      variation: pct,
      volume: r.volume,
      valeur_transigee: r.valeur_totale,
      valeur_totale: r.valeur_totale,
      date_seance: r.date_seance,
    };
  }).filter(r => r.ticker && safeNumber(r.cours) !== null && r.variation_pct !== null);

  const indices = (indicesResult.data || []).map(r => ({
    ...r,
    indice: String(r.indice || '').trim().toUpperCase(),
    valeur: r.valeur,
    variation_pct: safeNumber(r.variation_pct ?? r.variation),
  }));

  return {
    success: true,
    cours,
    indices,
    session_date: sessionDate,
    cours_date: latestCoursDate,
    indices_date: latestIndicesDate,
    cached_at: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  applyCors(req, res, { scope: 'public', methods: 'GET,OPTIONS' });
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'GET') return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
  if (!db) return fail(res, 503, 'Service temporairement indisponible.', 'SERVICE_UNAVAILABLE');

  try {
    const force = requestUrl(req).searchParams.get('refresh') === '1';
    const fresh = memoryCache && (Date.now() - memoryCache.time < CACHE_TTL_MS);
    if (!force && fresh) return json(res, 200, memoryCache.data, { cache: 'public, s-maxage=60, stale-while-revalidate=300' });

    const data = await loadSnapshot();
    memoryCache = { time: Date.now(), data };
    return json(res, 200, data, { cache: 'public, s-maxage=60, stale-while-revalidate=300' });
  } catch (error) {
    if (memoryCache?.data) {
      return json(res, 200, memoryCache.data, { cache: 'public, s-maxage=60, stale-while-revalidate=300' });
    }
    return fail(res, 500, 'Service temporairement indisponible.', 'MARCHE_CACHE_ERROR', error);
  }
}
