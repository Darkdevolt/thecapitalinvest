/* Market API — optimized public reads and CDN caching. */
import { supabase, supabaseAdmin } from '../lib/supabase.js';
import { json, fail, applyCors, requestUrl } from '../lib/http.js';
import { rateLimited } from '../lib/middleware.js';
import { getPublicMarketSnapshot } from '../lib/market-snapshot.js';

const db = supabaseAdmin || supabase;
const PAGE_SIZE = 1000;
const CURRENT_SESSION_LIMIT = 500;
const PUBLIC_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';
const PUBLIC_CDN_CACHE = 'public, s-maxage=60, stale-while-revalidate=300';

function table(name, build) {
  if (!db) throw new Error('Supabase non configuré');
  let q = db.from(name).select('*');
  return typeof build === 'function' ? build(q) : q;
}

async function latestDateFor(name) {
  const { data, error } = await db.from(name)
    .select('date_seance')
    .not('date_seance', 'is', null)
    .order('date_seance', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.date_seance || null;
}

function splitVariation(row) {
  const pct = row.variation_pct ?? row.variation ?? null;
  const raw = row.variation ?? null;
  const abs = raw != null && pct != null && Number(raw) === Number(pct) ? null : raw;
  return { pct, abs };
}

async function latestCours(sessionDate = null) {
  const latestDate = sessionDate || await latestDateFor('historique');
  if (!latestDate) return { data: [], latestDate: null, source: 'historique', dates: {} };

  const columns = 'id,ticker,date_seance,cours_cloture,cloture,cours_normal,cours_ouverture,plus_haut,plus_bas,volume,valeur_totale,variation,variation_pct';
  const { data, error } = await db.from('historique')
    .select(columns)
    .eq('date_seance', latestDate)
    .order('ticker', { ascending: true })
    .limit(CURRENT_SESSION_LIMIT);
  if (error) throw error;

  const rows = (data || []).map(r => {
    const ticker = String(r.ticker || '').trim().toUpperCase();
    const close = r.cours_cloture ?? r.cloture ?? r.cours_normal ?? null;
    const { pct, abs } = splitVariation(r);
    return {
      id: r.id,
      ticker,
      date_seance: r.date_seance,
      cours: close,
      cours_cloture: close,
      ouverture: r.cours_ouverture,
      cours_ouverture: r.cours_ouverture,
      plus_haut: r.plus_haut,
      plus_bas: r.plus_bas,
      variation: pct,
      variation_pct: pct,
      variation_abs: abs,
      volume: r.volume,
      valeur_transigee: r.valeur_totale,
      valeur_totale: r.valeur_totale,
      transactions: null,
      capitalisation: null
    };
  }).filter(r => r.ticker);

  const { data: prevDates, error: prevErr } = await db.from('historique')
    .select('date_seance')
    .lt('date_seance', latestDate)
    .not('date_seance', 'is', null)
    .order('date_seance', { ascending: false })
    .limit(1);
  if (prevErr) throw prevErr;

  const previousSession = prevDates?.[0]?.date_seance || null;
  if (previousSession && rows.length) {
    const tickers = [...new Set(rows.map(r => r.ticker))].slice(0, CURRENT_SESSION_LIMIT);
    const { data: previous, error } = await db.from('historique')
      .select('ticker,cours_cloture,cloture,cours_normal')
      .eq('date_seance', previousSession)
      .in('ticker', tickers);
    if (error) throw error;

    const map = new Map((previous || []).map(r => [
      String(r.ticker || '').trim().toUpperCase(),
      r.cours_cloture ?? r.cloture ?? r.cours_normal ?? null
    ]));

    for (const r of rows) {
      const b = Number(map.get(r.ticker));
      const a = Number(r.cours);
      if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) {
        const pct = ((a - b) / b) * 100;
        r.variation = pct;
        r.variation_pct = pct;
        r.variation_abs = null;
        r.variation_reference = previousSession;
        r.variation_reference_close = b;
        r.variation_reference_status = 'ok';
      } else {
        r.variation = null;
        r.variation_pct = null;
        r.variation_abs = null;
        r.variation_reference = previousSession;
        r.variation_reference_close = map.get(r.ticker) ?? null;
        r.variation_reference_status = map.has(r.ticker) ? 'previous_close_missing' : 'previous_session_missing_for_ticker';
      }
    }
  } else {
    for (const r of rows) {
      r.variation = null;
      r.variation_pct = null;
      r.variation_abs = null;
      r.variation_reference = previousSession;
      r.variation_reference_status = previousSession ? 'previous_close_missing' : 'no_previous_market_session';
    }
  }

  rows.sort((a, b) => String(a.ticker).localeCompare(String(b.ticker)));
  return { data: rows, latestDate, source: 'historique', dates: { [latestDate]: rows.length } };
}

async function latestIndices(sessionDate = null) {
  const latestDate = sessionDate || await latestDateFor('indices');
  if (!latestDate) return { data: [], latestDate: null, source: 'indices', dates: {} };

  const { data, error } = await db.from('indices')
    .select('id,indice,date_seance,valeur,variation,variation_pct,created_at')
    .eq('date_seance', latestDate)
    .order('indice', { ascending: true })
    .limit(PAGE_SIZE);
  if (error) throw error;

  return {
    data: (data || []).map(r => {
      const { pct } = splitVariation(r);
      const value = Number(r.valeur);
      const p = Number(pct);
      return {
        ...r,
        indice: String(r.indice || '').trim(),
        variation: Number.isFinite(value) && Number.isFinite(p) ? value * p / 100 : null,
        variation_pct: pct
      };
    }),
    latestDate,
    source: 'indices',
    dates: { [latestDate]: (data || []).length }
  };
}

async function historiqueIndices(limit = 30, dateFrom = null, dateTo = null) {
  const safe = Math.min(Math.max(Number(limit) || 30, 1), 365);
  let q = db.from('indices').select('date_seance').not('date_seance', 'is', null);
  if (dateFrom) q = q.gte('date_seance', dateFrom);
  if (dateTo) q = q.lte('date_seance', dateTo);

  const { data, error } = await q.order('date_seance', { ascending: false }).limit(safe * 20);
  if (error) throw error;

  const sessions = [...new Set((data || []).map(r => r.date_seance).filter(Boolean))]
    .sort().reverse().slice(0, safe).sort();
  if (!sessions.length) return { data: [], source: 'indices', sessions: 0 };

  const { data: rows, error: e } = await db.from('indices')
    .select('id,indice,date_seance,valeur,variation,variation_pct,created_at')
    .in('date_seance', sessions)
    .order('date_seance', { ascending: true })
    .order('indice', { ascending: true });
  if (e) throw e;

  return {
    data: (rows || []).map(r => String(r.indice || '').trim().toUpperCase() === 'BRVM COMPOSITE' ? { ...r, indice: 'BRVM C' } : r),
    source: 'indices',
    sessions: sessions.length
  };
}

async function historique(ticker, limit, dateFrom, dateTo, offset) {
  const safe = Math.min(Math.max(Number(limit) || PAGE_SIZE, 1), PAGE_SIZE);
  const off = Math.max(Number(offset) || 0, 0);
  let q = db.from('historique').select('*');
  if (ticker) q = q.eq('ticker', ticker);
  if (dateFrom) q = q.gte('date_seance', dateFrom);
  if (dateTo) q = q.lte('date_seance', dateTo);
  return q.order('date_seance', { ascending: false }).range(off, off + safe - 1);
}

async function entreprises(search) {
  let q = db.from('entreprises').select('*').eq('actif', true).order('ticker', { ascending: true }).limit(search ? 25 : 250);
  if (search) {
    const s = String(search).trim().replace(/[%_,]/g, ' ');
    if (s) q = q.or(`ticker.ilike.%${s}%,nom.ilike.%${s}%,nom_court.ilike.%${s}%`);
  }
  return q;
}

export default async function handler(req, res) {
  applyCors(req, res, { scope: 'public', methods: 'GET,OPTIONS' });
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'GET') return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
  if (rateLimited(req, res, 'marche')) return;
  if (!db) return fail(res, 503, 'Service temporairement indisponible.', 'SERVICE_UNAVAILABLE');

  try {
    const url = requestUrl(req);
    const type = url.searchParams.get('type') || 'cours';
    const ticker = (url.searchParams.get('ticker') || '').trim().toUpperCase();
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 30, 1), PAGE_SIZE);
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
    const dateFrom = url.searchParams.get('date_from');
    const dateTo = url.searchParams.get('date_to');
    const search = url.searchParams.get('search');

    let result;
    switch (type) {
      case 'cours': result = await latestCours(); break;
      case 'indices': result = await latestIndices(); break;
      case 'indices_historique': result = await historiqueIndices(limit, dateFrom, dateTo); break;
      case 'historique': result = await historique(ticker, limit, dateFrom, dateTo, offset); break;
      case 'entreprises': result = await entreprises(search); break;
      case 'financials': result = await db.from('financials').select('*').order('validation_status', { ascending: true }).order('annee', { ascending: false }).limit(2000); break;
      case 'analyses': result = await db.from('analyses').select('*').order('date_analyse', { ascending: false }).limit(500); break;
      case 'dividendes': result = await db.from('dividendes_calendrier').select('*').order('date_detachement', { ascending: true, nullsLast: true }).order('date_paiement', { ascending: true, nullsLast: true }).limit(2000); break;
      case 'coupons': result = await db.from('coupons_calendrier').select('*').order('date_detachement', { ascending: true, nullsLast: true }).order('date_paiement', { ascending: true, nullsLast: true }).limit(2000); break;
      case 'apercu': {
        const snapshot = await getPublicMarketSnapshot();
        res.setHeader('Vercel-CDN-Cache-Control', PUBLIC_CDN_CACHE);
        res.setHeader('CDN-Cache-Control', PUBLIC_CDN_CACHE);
        return json(res, 200, snapshot, { cache: PUBLIC_CACHE });
      }
      default: return fail(res, 400, `Type de données inconnu : ${type}`, 'UNKNOWN_TYPE');
    }

    if (result?.error) throw result.error;
    const data = result?.data || result || [];
    if (type === 'historique' && Array.isArray(data)) data.reverse();

    res.setHeader('Vercel-CDN-Cache-Control', PUBLIC_CDN_CACHE);
    res.setHeader('CDN-Cache-Control', PUBLIC_CDN_CACHE);
    return json(res, 200, data, { cache: PUBLIC_CACHE });
  } catch (error) {
    return fail(res, 500, 'Erreur serveur.', 'MARCHE_ERROR', error);
  }
}
