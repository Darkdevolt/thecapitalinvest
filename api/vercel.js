// ═══════════════════════════════════════════════════════════════════════════════
// THE CAPITAL — Vercel Node.js Adapter
// ═══════════════════════════════════════════════════════════════════════════════
// Bridges Vercel's Node.js (req, res) handler model to the Web Request/Response
// router used by api/index.js. Public BOC and market compatibility paths are
// handled here so the project stays within Vercel Hobby's function limit.
// ═══════════════════════════════════════════════════════════════════════════════

import router from './index.js';
import { supabase } from './lib/supabase.js';

const BRVM_BOC_PAGE = 'https://bfin.brvm.org/boc.aspx';
const BRVM_BOC_BASE = 'https://bfin.brvm.org/boc/BOC_JOUR/';

function getHeaderValue(req, name) {
  const value = req.headers?.[name.toLowerCase()];
  if (Array.isArray(value)) return value.join(', ');
  return value || '';
}

async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return undefined;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return undefined;
  return Buffer.concat(chunks);
}

function buildAbsoluteUrl(req) {
  const protocol = getHeaderValue(req, 'x-forwarded-proto') || 'https';
  const host = getHeaderValue(req, 'x-forwarded-host') || getHeaderValue(req, 'host') || 'localhost';
  return `${protocol}://${host}${req.url || '/'}`;
}

async function createWebRequest(req) {
  const body = await readBody(req);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  }
  const options = { method: req.method || 'GET', headers };
  if (body !== undefined) {
    options.body = body;
    options.duplex = 'half';
  }
  return new Request(buildAbsoluteUrl(req), options);
}

function jsonResponse(payload, status = 200, cache = 'public, s-maxage=300, stale-while-revalidate=600') {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cache,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Requested-With',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    },
  });
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout ${label} après ${ms}ms`)), ms)),
  ]);
}

function bocPdfUrl(date) {
  return `${BRVM_BOC_BASE}BOC_${date.replaceAll('-', '')}.pdf`;
}

function normalizeDate(value) {
  const match = String(value).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

async function fetchOfficialBoc(limit = 100) {
  const response = await withTimeout(fetch(BRVM_BOC_PAGE, {
    headers: { 'User-Agent': 'TheCapital/1.0 BOC reader' },
  }), 7000, 'BRVM BOC');

  if (!response.ok) throw new Error(`BRVM BOC HTTP ${response.status}`);
  const html = await response.text();
  const dates = [];
  const seen = new Set();

  for (const match of html.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)) {
    const date = normalizeDate(match[1]);
    if (!date || seen.has(date)) continue;
    seen.add(date);
    dates.push(date);
    if (dates.length >= limit) break;
  }

  if (!dates.length) {
    for (const match of html.matchAll(/BOC[_-](\d{8})\.pdf/gi)) {
      const raw = match[1];
      const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      if (seen.has(date)) continue;
      seen.add(date);
      dates.push(date);
      if (dates.length >= limit) break;
    }
  }

  return dates.map((date, index) => {
    const pdf = bocPdfUrl(date);
    return {
      id: `brvm-${date}`,
      date_seance: date,
      annee: Number(date.slice(0, 4)),
      numero_seance: null,
      fichier_nom: `BOC_${date.replaceAll('-', '')}.pdf`,
      fichier_url: pdf,
      pdf_url: pdf,
      source: 'BRVM',
      source_url: BRVM_BOC_PAGE,
      rang: index + 1,
    };
  });
}

async function readBocDatabase() {
  try {
    const result = await withTimeout(
      supabase.from('boc').select('id,date_seance,fichier_nom,fichier_url,created_at').order('date_seance', { ascending: false }).limit(100),
      5000,
      'Supabase BOC'
    );
    if (result.error) throw result.error;
    return (result.data || []).map(row => ({
      ...row,
      annee: row.date_seance ? Number(String(row.date_seance).slice(0, 4)) : null,
      numero_seance: null,
      pdf_url: row.fichier_url,
      source: 'database',
    }));
  } catch (error) {
    console.warn('[VERCEL ADAPTER] BOC database unavailable:', error.message);
    return [];
  }
}

async function handleBoc(requestUrl) {
  if (requestUrl.pathname !== '/api/boc') return null;
  if (requestUrl.searchParams.get('method') === 'POST') return null;

  try {
    let data = await readBocDatabase();
    let source = 'database';

    if (!data.length) {
      data = await fetchOfficialBoc(100);
      source = 'brvm';
    }

    return jsonResponse({
      success: true,
      data: { data, count: data.length, source, source_url: BRVM_BOC_PAGE },
    });
  } catch (error) {
    console.error('[VERCEL ADAPTER] BOC error:', error);
    return jsonResponse({
      success: false,
      error: 'Impossible de récupérer les Bulletins Officiels de la Cote',
      code: 'BOC_SOURCE_ERROR',
    }, 502, 'no-store');
  }
}

async function handlePublicMarketCompatibility(requestUrl) {
  const type = requestUrl.searchParams.get('type') || 'apercu';
  if (type !== 'apercu' && type !== 'cours') return null;

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout marche/${type} après 8000ms`)), 8000)
  );

  try {
    if (type === 'cours') {
      const query = supabase.from('cours')
        .select('ticker, cours, variation, volume, capitalisation, date_seance, plus_haut, plus_bas')
        .order('date_seance', { ascending: false }).limit(50);
      const { data, error } = await Promise.race([query, timeout]);
      if (error) throw error;

      const tickers = [...new Set((data || []).map(row => row.ticker).filter(Boolean))];
      let names = [];
      if (tickers.length > 0) {
        const companyResult = await Promise.race([
          supabase.from('entreprises').select('ticker, nom, nom_court').in('ticker', tickers),
          timeout,
        ]);
        if (!companyResult.error) names = companyResult.data || [];
      }
      const nameMap = new Map(names.map(company => [company.ticker, company.nom || company.nom_court || company.ticker]));
      return jsonResponse({ success: true, data: (data || []).map(row => ({ ...row, nom: nameMap.get(row.ticker) || row.ticker })) });
    }

    const indicesQuery = supabase.from('indices').select('*').order('date_seance', { ascending: false }).limit(20);
    const coursQuery = supabase.from('cours').select('ticker, cours, variation, volume, capitalisation, date_seance, plus_haut, plus_bas').order('date_seance', { ascending: false }).limit(200);
    const [indicesResult, coursResult] = await Promise.race([Promise.all([indicesQuery, coursQuery]), timeout]);
    if (indicesResult.error) throw indicesResult.error;
    if (coursResult.error) throw coursResult.error;

    const coursRows = coursResult.data || [];
    const tickers = [...new Set(coursRows.map(row => row.ticker).filter(Boolean))];
    let companies = [];
    if (tickers.length > 0) {
      const companyResult = await Promise.race([supabase.from('entreprises').select('ticker, nom, nom_court').in('ticker', tickers), timeout]);
      if (companyResult.error) throw companyResult.error;
      companies = companyResult.data || [];
    }
    const nameMap = new Map(companies.map(company => [company.ticker, company.nom || company.nom_court || company.ticker]));
    const seen = new Set();
    const uniqueCours = [];
    for (const row of coursRows) {
      if (!seen.has(row.ticker)) {
        seen.add(row.ticker);
        uniqueCours.push({ ...row, nom: nameMap.get(row.ticker) || row.ticker });
      }
    }
    const sorted = [...uniqueCours].sort((a, b) => (b.variation || 0) - (a.variation || 0));
    return jsonResponse({
      success: true,
      data: {
        indices: (indicesResult.data || []).slice(0, 3),
        cours: uniqueCours.slice(0, 15),
        topHausses: sorted.filter(row => (row.variation || 0) > 0).slice(0, 5),
        topBaisses: sorted.filter(row => (row.variation || 0) < 0).slice(0, 5).reverse(),
        topVolumes: [...uniqueCours].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 5),
        dateSeance: uniqueCours[0]?.date_seance || new Date().toISOString().split('T')[0],
        totalValeurs: uniqueCours.length,
      },
    });
  } catch (error) {
    console.error('[VERCEL ADAPTER] Market compatibility error:', error);
    return jsonResponse({ success: false, error: `Erreur serveur: ${error.message}`, code: 'SERVER_ERROR' }, 500, 'no-store');
  }
}

async function sendWebResponse(res, response) {
  if (!(response instanceof Response)) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ success: false, error: 'Invalid API response' }));
  }
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  const body = await response.arrayBuffer();
  return res.end(Buffer.from(body));
}

export default async function handler(req, res) {
  try {
    console.log('[VERCEL ADAPTER] Request:', req.method, req.url);
    const requestUrl = new URL(buildAbsoluteUrl(req));

    if (req.method === 'OPTIONS') {
      return await sendWebResponse(res, jsonResponse({ success: true }, 204));
    }

    const bocResponse = await handleBoc(requestUrl);
    if (bocResponse) return await sendWebResponse(res, bocResponse);

    if (requestUrl.pathname === '/api/marche') {
      const compatibilityResponse = await handlePublicMarketCompatibility(requestUrl);
      if (compatibilityResponse) return await sendWebResponse(res, compatibilityResponse);
    }

    const webRequest = await createWebRequest(req);
    const webResponse = await router(webRequest);
    return await sendWebResponse(res, webResponse);
  } catch (error) {
    console.error('[VERCEL ADAPTER] Fatal error:', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    return res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
  }
}
