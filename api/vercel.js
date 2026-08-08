// THE CAPITAL — Vercel Node.js API adapter
import router from './index.js';
import { supabase, supabaseAdmin } from './lib/supabase.js';

const db = supabaseAdmin || supabase;
const BRVM_BOC_PAGE = 'https://bfin.brvm.org/boc.aspx';
const BRVM_BOC_BASE = 'https://bfin.brvm.org/boc/BOC_JOUR/';

function header(req, name) {
  const value = req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value.join(', ') : (value || '');
}
function absoluteUrl(req) {
  return `${header(req, 'x-forwarded-proto') || 'https'}://${header(req, 'x-forwarded-host') || header(req, 'host') || 'localhost'}${req.url || '/'}`;
}
async function readBody(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return undefined;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}
async function webRequest(req) {
  const body = await readBody(req);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers || {})) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  const options = { method: req.method || 'GET', headers };
  if (body !== undefined) { options.body = body; options.duplex = 'half'; }
  return new Request(absoluteUrl(req), options);
}
function json(payload, status = 200, cache = 'public, s-maxage=300, stale-while-revalidate=600') {
  return new Response(JSON.stringify(payload), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cache,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Requested-With,X-Cron-Secret',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS'
  }});
}
async function send(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}
function timed(promise, ms, label) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout ${label} après ${ms}ms`)), ms))]);
}
function bocUrl(date) { return `${BRVM_BOC_BASE}BOC_${date.replaceAll('-', '')}.pdf`; }
function normalizeDate(value) { const m = String(value).match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; }

async function handleBoc(url) {
  if (url.pathname !== '/api/boc') return null;
  try {
    let data = [];
    if (db) {
      try {
        const result = await timed(db.from('boc').select('id,date_seance,fichier_nom,fichier_url,created_at').order('date_seance', { ascending: false }).limit(100), 4500, 'Supabase BOC');
        if (!result.error) data = (result.data || []).map(row => ({ ...row, annee: row.date_seance ? Number(String(row.date_seance).slice(0, 4)) : null, numero_seance: null, pdf_url: row.fichier_url, source: 'database' }));
      } catch (e) { console.warn('[BOC] DB timeout/error:', e.message); }
    }
    if (!data.length) {
      const response = await timed(fetch(BRVM_BOC_PAGE, { headers: { 'User-Agent': 'TheCapital/1.0 BOC reader' } }), 6500, 'BRVM BOC');
      if (!response.ok) throw new Error(`BRVM BOC HTTP ${response.status}`);
      const html = await response.text();
      const dates = [], seen = new Set();
      for (const m of html.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)) { const d = normalizeDate(m[1]); if (d && !seen.has(d)) { seen.add(d); dates.push(d); } if (dates.length >= 100) break; }
      if (!dates.length) for (const m of html.matchAll(/BOC[_-](\d{8})\.pdf/gi)) { const r = m[1], d = `${r.slice(0,4)}-${r.slice(4,6)}-${r.slice(6,8)}`; if (!seen.has(d)) { seen.add(d); dates.push(d); } if (dates.length >= 100) break; }
      data = dates.map((date, i) => ({ id: `brvm-${date}`, date_seance: date, annee: Number(date.slice(0,4)), numero_seance: null, fichier_nom: `BOC_${date.replaceAll('-', '')}.pdf`, fichier_url: bocUrl(date), pdf_url: bocUrl(date), source: 'BRVM', source_url: BRVM_BOC_PAGE, rang: i + 1 }));
    }
    return json({ success: true, data: { data, count: data.length, source: data[0]?.source || 'database', source_url: BRVM_BOC_PAGE } });
  } catch (error) {
    console.error('[BOC] error:', error);
    return json({ success: false, error: 'Impossible de récupérer les Bulletins Officiels de la Cote', code: 'BOC_SOURCE_ERROR' }, 502, 'no-store');
  }
}

async function handleSync(url, req) {
  if (url.pathname !== '/api/sync-brvm') return null;
  if (!['GET', 'POST'].includes(req.method)) return json({ success: false, error: 'Method not allowed' }, 405, 'no-store');
  const cron = header(req, 'x-vercel-cron') || header(req, 'x-vercel-cron-schedule');
  const provided = header(req, 'x-cron-secret') || url.searchParams.get('secret') || '';
  const secret = process.env.CRON_SECRET || '';
  if (!cron && (!secret || provided !== secret)) return json({ success: false, error: 'Unauthorized' }, 401, 'no-store');
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !supabaseKey) return json({ success: false, error: 'Supabase URL/secret key not configured' }, 503, 'no-store');
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/scrape-brvm`, { method: 'POST', headers: { Authorization: `Bearer ${supabaseKey}`, apikey: supabaseKey, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(25000) });
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return json(data, response.status, 'no-store');
  } catch (error) { return json({ success: false, error: error.message || 'BRVM sync failed' }, 502, 'no-store'); }
}

const TABLES = {
  indices: ['indices', '*', 'date_seance'],
  financials: ['financials', '*', 'annee'],
  financials_annuels: ['financials_annuels', '*', 'annee'],
  financials_infrannuels: ['financials_infrannuels', '*', 'annee'],
  etats_financiers: ['etats_financiers', '*', 'annee'],
  analyses: ['analyses', '*', 'date_analyse'],
  entreprises: ['entreprises', '*', 'ticker'],
  dividendes_calendrier: ['dividendes_calendrier', '*', 'date_detachement'],
  forecasts: ['forecasts', '*', 'annee_forecast'],
  cours_brvm: ['cours_brvm', '*', 'date_seance'],
  indices_brvm: ['indices_brvm', '*', 'date_seance']
};

async function handleMarche(url) {
  if (url.pathname !== '/api/marche') return null;
  const type = (url.searchParams.get('type') || 'apercu').toLowerCase();
  const ticker = url.searchParams.get('ticker')?.trim().toUpperCase() || null;
  const requestedLimit = Number(url.searchParams.get('limit') || 500);
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 500, 1), 1000);

  try {
    if (!db) return json({ success: false, error: 'Supabase non configuré', code: 'SUPABASE_NOT_CONFIGURED' }, 503, 'no-store');

    if (type === 'cours' || type === 'apercu') {
      // Keep the public market request small and independent. One slow auxiliary query
      // must never block the actual prices.
      const priceQuery = db.from('cours_latest').select('ticker,cours,variation,variation_pct,volume,valeur_transigee,transactions,capitalisation,date_seance,ouverture,plus_haut,plus_bas,cloture').order('date_seance', { ascending: false }).limit(type === 'cours' ? limit : 500);
      const priceResult = await timed(priceQuery, 8000, 'cours_latest');
      if (priceResult.error) throw priceResult.error;
      const rows = priceResult.data || [];

      let companies = [];
      try {
        const companyResult = await timed(db.from('entreprises').select('ticker,nom,nom_court').limit(1000), 3000, 'entreprises');
        if (!companyResult.error) companies = companyResult.data || [];
      } catch (e) { console.warn('[MARCHE] companies unavailable:', e.message); }
      const names = new Map(companies.map(c => [String(c.ticker).toUpperCase(), c.nom || c.nom_court || c.ticker]));
      const data = rows.map(row => { const t = String(row.ticker || '').toUpperCase(); return { ...row, ticker: t, nom: names.get(t) || t }; });

      if (type === 'cours') return json({ success: true, data, count: data.length, dateSeance: data[0]?.date_seance || null });

      let indices = [];
      try {
        const indexResult = await timed(db.from('indices').select('*').order('date_seance', { ascending: false }).limit(20), 3000, 'indices');
        if (!indexResult.error) indices = indexResult.data || [];
      } catch (e) { console.warn('[MARCHE] indices unavailable:', e.message); }
      const sorted = [...data].sort((a, b) => Number(b.variation_pct ?? b.variation ?? 0) - Number(a.variation_pct ?? a.variation ?? 0));
      return json({ success: true, data: {
        indices: indices.slice(0, 3), cours: data.slice(0, 15),
        topHausses: sorted.filter(r => Number(r.variation_pct ?? r.variation ?? 0) > 0).slice(0, 5),
        topBaisses: sorted.filter(r => Number(r.variation_pct ?? r.variation ?? 0) < 0).slice(-5).reverse(),
        topVolumes: [...data].sort((a, b) => Number(b.volume || 0) - Number(a.volume || 0)).slice(0, 5),
        dateSeance: data[0]?.date_seance || null, totalValeurs: data.length
      }});
    }

    if (type === 'historique' || type === 'historique_cours') {
      if (!ticker) return json({ success: false, error: 'Ticker requis', code: 'MISSING_TICKER' }, 400, 'no-store');
      const table = type === 'historique' ? 'historique' : 'historique_cours';
      const result = await timed(db.from(table).select('*').eq('ticker', ticker).order('date_seance', { ascending: false }).limit(limit), 8000, type);
      if (result.error) throw result.error;
      return json({ success: true, data: result.data || [], ticker, count: (result.data || []).length });
    }

    const cfg = TABLES[type];
    if (!cfg) return json({ success: false, error: `Type de données inconnu: ${type}`, code: 'UNKNOWN_DATASET' }, 404, 'no-store');
    let query = db.from(cfg[0]).select(cfg[1]);
    if (ticker && ['financials','financials_annuels','financials_infrannuels','analyses','dividendes_calendrier','forecasts'].includes(type)) query = query.eq('ticker', ticker);
    query = query.order(cfg[2], { ascending: false }).limit(limit);
    const result = await timed(query, 8000, type);
    if (result.error) throw result.error;
    return json({ success: true, data: result.data || [], type, count: (result.data || []).length });
  } catch (error) {
    console.error('[MARCHE] error:', type, error);
    const timeout = String(error.message || '').toLowerCase().includes('timeout');
    return json({ success: false, error: timeout ? `La source ${type} met trop de temps à répondre` : `Erreur ${type}: ${error.message}`, code: timeout ? 'DATASET_TIMEOUT' : 'DATASET_ERROR' }, timeout ? 504 : 500, 'no-store');
  }
}

export default async function handler(req, res) {
  try {
    const url = new URL(absoluteUrl(req));
    console.log('[VERCEL ADAPTER] Request:', req.method, req.url);
    if (req.method === 'OPTIONS') return send(res, json({ success: true }, 204));

    const sync = await handleSync(url, req); if (sync) return send(res, sync);
    const boc = await handleBoc(url); if (boc) return send(res, boc);
    const marche = await handleMarche(url); if (marche) return send(res, marche);

    const response = await router(await webRequest(req));
    return send(res, response);
  } catch (error) {
    console.error('[VERCEL ADAPTER] Fatal error:', error);
    if (!res.headersSent) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json; charset=utf-8'); }
    res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
  }
}
