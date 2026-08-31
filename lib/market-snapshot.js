import { supabase, supabaseAdmin } from './supabase.js';

const db = supabaseAdmin || supabase;
const PAGE_SIZE = 1000;

function table(name, build) {
  if (!db) throw new Error('Supabase non configuré');
  let q = db.from(name).select('*');
  if (typeof build === 'function') q = build(q);
  return q;
}

async function latestDateFor(name) {
  const { data, error } = await db
    .from(name)
    .select('date_seance')
    .not('date_seance', 'is', null)
    .order('date_seance', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.date_seance || null;
}

async function previousSession(date) {
  const { data, error } = await db
    .from('historique')
    .select('date_seance')
    .lt('date_seance', date)
    .not('date_seance', 'is', null)
    .order('date_seance', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.date_seance || null;
}

function closeOf(row) {
  return row?.cours_cloture ?? row?.cloture ?? row?.cours_normal ?? null;
}

function publicCourse(row, previousClose, previousDate) {
  const close = closeOf(row);
  const current = Number(close);
  const previous = Number(previousClose);
  const valid = Number.isFinite(current) && Number.isFinite(previous) && previous !== 0;
  const pct = valid ? ((current - previous) / previous) * 100 : null;

  return {
    id: row.id,
    ticker: String(row.ticker || '').trim().toUpperCase(),
    date_seance: row.date_seance,
    cours: close,
    cours_cloture: close,
    ouverture: row.cours_ouverture,
    cours_ouverture: row.cours_ouverture,
    plus_haut: row.plus_haut,
    plus_bas: row.plus_bas,
    variation: pct,
    variation_pct: pct,
    variation_abs: null,
    volume: row.volume,
    valeur_transigee: row.valeur_totale,
    valeur_totale: row.valeur_totale,
    transactions: null,
    capitalisation: null,
    variation_reference: previousDate || null,
    variation_reference_close: valid ? previous : null,
    variation_reference_status: valid
      ? 'ok'
      : previousDate
        ? 'previous_close_missing'
        : 'no_previous_market_session',
  };
}

/**
 * Public, lightweight market snapshot shared by the public cache endpoint
 * and /api/marche?type=apercu. All values originate from Supabase.
 */
export async function getPublicMarketSnapshot() {
  if (!db) throw new Error('Supabase non configuré');

  const [latestCoursDate, latestIndicesDate] = await Promise.all([
    latestDateFor('historique'),
    latestDateFor('indices'),
  ]);

  const sessionDate = [latestCoursDate, latestIndicesDate]
    .filter(Boolean)
    .sort()
    .reverse()[0] || null;

  if (!sessionDate) {
    return {
      success: true,
      cours: [],
      indices: [],
      session_date: null,
      cours_date: latestCoursDate || null,
      indices_date: latestIndicesDate || null,
      generated_at: new Date().toISOString(),
    };
  }

  const previousDate = latestCoursDate ? await previousSession(latestCoursDate) : null;

  const [coursResult, previousResult, indicesResult] = await Promise.all([
    latestCoursDate
      ? table('historique', q => q
          .select('id,ticker,cours_cloture,cloture,cours_normal,cours_ouverture,plus_haut,plus_bas,volume,valeur_totale,date_seance')
          .eq('date_seance', latestCoursDate)
          .order('ticker', { ascending: true })
          .range(0, PAGE_SIZE - 1))
      : Promise.resolve({ data: [], error: null }),
    previousDate
      ? table('historique', q => q
          .select('ticker,cours_cloture,cloture,cours_normal')
          .eq('date_seance', previousDate)
          .range(0, PAGE_SIZE - 1))
      : Promise.resolve({ data: [], error: null }),
    latestIndicesDate
      ? table('indices', q => q
          .select('*')
          .eq('date_seance', latestIndicesDate)
          .order('indice', { ascending: true })
          .limit(20))
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (coursResult.error) throw coursResult.error;
  if (previousResult.error) throw previousResult.error;
  if (indicesResult.error) throw indicesResult.error;

  const previousByTicker = new Map();
  for (const row of previousResult.data || []) {
    const ticker = String(row.ticker || '').trim().toUpperCase();
    if (ticker) previousByTicker.set(ticker, closeOf(row));
  }

  const cours = (coursResult.data || [])
    .map(row => publicCourse(row, previousByTicker.get(String(row.ticker || '').trim().toUpperCase()), previousDate))
    .filter(row => row.ticker && Number.isFinite(Number(row.cours)));

  const indices = (indicesResult.data || []).map(row => {
    const value = Number(row.valeur);
    const pct = Number(row.variation_pct ?? row.variation);
    return {
      ...row,
      indice: String(row.indice || '').trim(),
      valeur: row.valeur,
      variation: Number.isFinite(value) && Number.isFinite(pct) ? value * pct / 100 : null,
      variation_pct: Number.isFinite(pct) ? pct : null,
    };
  });

  return {
    success: true,
    cours,
    indices,
    session_date: sessionDate,
    cours_date: latestCoursDate || null,
    indices_date: latestIndicesDate || null,
    cours_source: 'historique',
    indices_source: 'indices',
    cours_dates: latestCoursDate ? { [latestCoursDate]: cours.length } : {},
    indices_dates: latestIndicesDate ? { [latestIndicesDate]: indices.length } : {},
    generated_at: new Date().toISOString(),
  };
}
