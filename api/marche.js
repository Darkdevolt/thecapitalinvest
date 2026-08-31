/* PATCH APPLIED BELOW: variation reference is validated by immediate BRVM session. */
/**
 * Lecture des données de marché (public).
 *
 * CORRECTIFS :
 *  - la « dernière séance » est calculée table par table ;
 *  - variation_abs ne recopie plus un pourcentage ;
 *  - l'historique des indices utilise les séances réellement présentes ;
 *  - une variation journalière n'est valide que si le titre possède une
 *    cotation sur la séance BRVM immédiatement précédente ;
 *  - aucune ouverture de séance courante ni séance plus ancienne ne sert de
 *    fallback pour une variation quotidienne.
 */
import { supabase, supabaseAdmin } from '../lib/supabase.js';
import { json, fail, applyCors, requestUrl } from '../lib/http.js';
import { rateLimited } from '../lib/middleware.js';
import { getPublicMarketSnapshot } from '../lib/market-snapshot.js';

const db = supabaseAdmin || supabase;
const PAGE_SIZE = 1000;
const MAX_PAGES = 50;
const MARKET_PREVIEW_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';
const MARKET_PREVIEW_CDN_CACHE = 'public, s-maxage=60, stale-while-revalidate=300';

function table(name, build) {
  if (!db) throw new Error('Supabase non configuré');
  let q = db.from(name).select('*');
  if (typeof build === 'function') q = build(q);
  return q;
}

async function latestDateFor(name) {
  const { data, error } = await db.from(name).select('date_seance').not('date_seance', 'is', null).order('date_seance', { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0]?.date_seance || null;
}

function splitVariation(row) {
  const pct = row.variation_pct ?? row.variation ?? null;
  const raw = row.variation ?? null;
  const abs = (raw != null && pct != null && Number(raw) === Number(pct)) ? null : raw;
  return { pct, abs };
}

async function immediatePreviousSession(date) {
  const { data, error } = await db.from('historique').select('date_seance').lt('date_seance', date).not('date_seance', 'is', null).order('date_seance', { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0]?.date_seance || null;
}

async function validateDailyVariation(ticker, date, current) {
  const previousSession = await immediatePreviousSession(date);
  if (!previousSession) return { ...current, variation: null, variation_pct: null, variation_abs: null, variation_reference: null, variation_reference_status: 'no_previous_market_session' };
  const { data: previous, error } = await db.from('historique').select('cours_cloture,cloture').eq('ticker', ticker).eq('date_seance', previousSession).limit(1);
  if (error) throw error;
  const previousClose = previous?.[0]?.cours_cloture ?? previous?.[0]?.cloture ?? null;
  const currentClose = current?.cours_cloture ?? current?.cloture ?? current?.cours_normal ?? null;
  const a = Number(currentClose), b = Number(previousClose);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return { ...current, variation: null, variation_pct: null, variation_abs: null, variation_reference: previousSession, variation_reference_close: previousClose, variation_reference_status: previous?.length ? 'previous_close_missing' : 'previous_session_missing_for_ticker' };
  const pct = ((a - b) / b) * 100;
  return { ...current, variation: pct, variation_pct: pct, variation_abs: null, variation_reference: previousSession, variation_reference_close: b, variation_reference_status: 'ok' };
}

async function latestCours(sessionDate = null) {
  const latestDate = sessionDate || await latestDateFor('historique');
  if (!latestDate) return { data: [], latestDate: null, source: 'historique', dates: {} };
  const rows = [];
  let from = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await table('historique', q => q.eq('date_seance', latestDate).order('ticker', { ascending: true }).range(from, from + PAGE_SIZE - 1));
    if (error) throw error;
    const batch = data || [];
    if (!batch.length) break;
    for (const r of batch) {
      const ticker = String(r.ticker || '').trim().toUpperCase();
      if (!ticker) continue;
      const close = r.cours_cloture ?? r.cloture ?? r.cours_normal ?? null;
      const { pct, abs } = splitVariation(r);
      rows.push({ id: r.id, ticker, date_seance: r.date_seance, cours: close, cours_cloture: close, ouverture: r.cours_ouverture, cours_ouverture: r.cours_ouverture, plus_haut: r.plus_haut, plus_bas: r.plus_bas, variation: pct, variation_pct: pct, variation_abs: abs, volume: r.volume, valeur_transigee: r.valeur_totale, valeur_totale: r.valeur_totale, transactions: null, capitalisation: null });
    }
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  /* Corriger la variation à partir de la séance BRVM immédiatement précédente. */
  for (let i = 0; i < rows.length; i++) rows[i] = await validateDailyVariation(rows[i].ticker, latestDate, rows[i]);
  rows.sort((a, b) => String(a.ticker).localeCompare(String(b.ticker)));
  return { data: rows, latestDate, source: 'historique', dates: { [latestDate]: rows.length } };
}

async function latestIndices(sessionDate = null) {
  const latestDate = sessionDate || await latestDateFor('indices');
  if (!latestDate) return { data: [], latestDate: null, source: 'indices', dates: {} };
  const { data, error } = await table('indices', q => q.eq('date_seance', latestDate).order('indice', { ascending: true }).limit(PAGE_SIZE));
  if (error) throw error;
  const rows = (data || []).map(r => { const { pct } = splitVariation(r); const value = Number(r.valeur); const pctNum = Number(pct); const variation = Number.isFinite(value) && Number.isFinite(pctNum) ? value * pctNum / 100 : null; return { ...r, indice: String(r.indice || '').trim(), valeur: r.valeur, variation, variation_pct: pct }; });
  return { data: rows, latestDate, source: 'indices', dates: { [latestDate]: rows.length } };
}

async function historiqueIndices(limit = 30, dateFrom = null, dateTo = null) {
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 365);
  let dateQuery = db.from('indices').select('date_seance').not('date_seance', 'is', null);
  if (dateFrom) dateQuery = dateQuery.gte('date_seance', dateFrom);
  if (dateTo) dateQuery = dateQuery.lte('date_seance', dateTo);
  const { data: dateRows, error: dateError } = await dateQuery.order('date_seance', { ascending: false }).limit(safeLimit * 40);
  if (dateError) throw dateError;
  const sessions = [...new Set((dateRows || []).map(r => r.date_seance).filter(Boolean))].sort().reverse().slice(0, safeLimit).sort();
  if (!sessions.length) return { data: [], source: 'indices', sessions: 0 };
  const { data, error } = await table('indices', q => q.in('date_seance', sessions).order('date_seance', { ascending: true }).order('indice', { ascending: true }));
  if (error) throw error;
  const rows = (data || []).map(r => String(r.indice || '').trim().toUpperCase() === 'BRVM COMPOSITE' ? { ...r, indice: 'BRVM C' } : r);
  return { data: rows, source: 'indices', sessions: sessions.length };
}

async function historique(ticker, limit, dateFrom, dateTo, offset) {
  const safeLimit = Math.min(Math.max(Number(limit) || PAGE_SIZE, 1), PAGE_SIZE);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  return table('historique', q => { if (ticker) q = q.eq('ticker', ticker); if (dateFrom) q = q.gte('date_seance', dateFrom); if (dateTo) q = q.lte('date_seance', dateTo); return q.order('date_seance', { ascending: false }).range(safeOffset, safeOffset + safeLimit - 1); });
}

export default async function handler(req, res) {
  applyCors(req, res, { scope: 'public', methods: 'GET,OPTIONS' });
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'GET') return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
  if (rateLimited(req, res, 'marche')) return;
  if (!db) return fail(res, 503, 'Service temporairement indisponible.', 'SERVICE_UNAVAILABLE');
  try {
    const url = requestUrl(req); const type = url.searchParams.get('type') || 'cours'; const ticker = (url.searchParams.get('ticker') || '').trim().toUpperCase(); const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 30, 1), PAGE_SIZE); const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0); const dateFrom = url.searchParams.get('date_from'); const dateTo = url.searchParams.get('date_to');
    let result;
    switch (type) {
      case 'cours': result = await latestCours(); break;
      case 'indices': result = await latestIndices(); break;
      case 'indices_historique': result = await historiqueIndices(limit, dateFrom, dateTo); break;
      case 'historique': result = await historique(ticker, limit, dateFrom, dateTo, offset); break;
      case 'entreprises': result = await table('entreprises', q => q.eq('actif', true).order('ticker', { ascending: true })); break;
      case 'financials': result = await table('financials', q => q.order('validation_status', { ascending: true }).order('annee', { ascending: false }).limit(2000)); break;
      case 'analyses': result = await table('analyses', q => q.order('date_analyse', { ascending: false }).limit(500)); break;
      case 'dividendes': result = await table('dividendes_calendrier', q => q.order('date_detachement', { ascending: true, nullsLast: true }).order('date_paiement', { ascending: true, nullsLast: true }).limit(2000)); break;
      case 'coupons': try { result = await table('coupons_calendrier', q => q.order('date_detachement', { ascending: true, nullsLast: true }).order('date_paiement', { ascending: true, nullsLast: true }).limit(2000)); } catch (e) { result = { data: [], source: 'coupons', absent: true }; } break;
      case 'apercu':
        result = await getPublicMarketSnapshot();
        res.setHeader('Vercel-CDN-Cache-Control', MARKET_PREVIEW_CDN_CACHE);
        res.setHeader('CDN-Cache-Control', MARKET_PREVIEW_CDN_CACHE);
        return json(res, 200, result, { cache: MARKET_PREVIEW_CACHE });
      default: return fail(res, 400, `Type de données inconnu : ${type}`, 'UNKNOWN_TYPE');
    }
    if (result?.error) throw result.error; const data = result?.data || result || []; if (type === 'historique' && Array.isArray(data)) data.reverse(); return json(res, 200, data);
  } catch (error) { return fail(res, 500, 'Erreur serveur.', 'MARCHE_ERROR', error); }
}
