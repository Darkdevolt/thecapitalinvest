// ═══════════════════════════════════════════════════════════════════════════════
// THE CAPITAL — Vercel Node.js Adapter
// ═══════════════════════════════════════════════════════════════════════════════
//
// Bridges Vercel's Node.js (req, res) handler model to the Web Request/Response
// router used by api/index.js. A small compatibility path is also kept here for
// public market endpoints whose legacy SQL projection referenced columns that
// do not exist in the real Supabase schema.
// ═══════════════════════════════════════════════════════════════════════════════

import router from './index.js';
import { supabase } from './lib/supabase.js';

function getHeaderValue(req, name) {
  const value = req.headers?.[name.toLowerCase()];

  if (Array.isArray(value)) return value.join(', ');
  return value || '';
}

async function readBody(req) {
  if (
    req.method === 'GET' ||
    req.method === 'HEAD' ||
    req.method === 'OPTIONS'
  ) {
    return undefined;
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    );
  }

  if (chunks.length === 0) return undefined;
  return Buffer.concat(chunks);
}

function buildAbsoluteUrl(req) {
  const protocol = getHeaderValue(req, 'x-forwarded-proto') || 'https';
  const host =
    getHeaderValue(req, 'x-forwarded-host') ||
    getHeaderValue(req, 'host') ||
    'localhost';

  return `${protocol}://${host}${req.url || '/'}`;
}

async function createWebRequest(req) {
  const body = await readBody(req);
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers || {})) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  }

  const options = {
    method: req.method || 'GET',
    headers,
  };

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

async function handlePublicMarketCompatibility(requestUrl) {
  const type = requestUrl.searchParams.get('type') || 'apercu';

  // Only intercept the failing public projections. Other /api/marche modes keep
  // using the main router unchanged.
  if (type !== 'apercu' && type !== 'cours') return null;

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout marche/${type} après 8000ms`)), 8000)
  );

  try {
    if (type === 'cours') {
      const query = supabase
        .from('cours')
        .select('ticker, cours, variation, volume, capitalisation, date_seance, plus_haut, plus_bas')
        .order('date_seance', { ascending: false })
        .limit(50);

      const { data, error } = await Promise.race([query, timeout]);
      if (error) throw error;

      const tickers = [...new Set((data || []).map(row => row.ticker).filter(Boolean))];
      let names = [];

      if (tickers.length > 0) {
        const companyQuery = supabase
          .from('entreprises')
          .select('ticker, nom, nom_court')
          .in('ticker', tickers);

        const companyResult = await Promise.race([companyQuery, timeout]);
        if (!companyResult.error) names = companyResult.data || [];
      }

      const nameMap = new Map(
        names.map(company => [company.ticker, company.nom || company.nom_court || company.ticker])
      );

      return jsonResponse({
        success: true,
        data: (data || []).map(row => ({
          ...row,
          nom: nameMap.get(row.ticker) || row.ticker,
        })),
      });
    }

    const indicesQuery = supabase
      .from('indices')
      .select('*')
      .order('date_seance', { ascending: false })
      .limit(20);

    const coursQuery = supabase
      .from('cours')
      .select('ticker, cours, variation, volume, capitalisation, date_seance, plus_haut, plus_bas')
      .order('date_seance', { ascending: false })
      .limit(200);

    const [indicesResult, coursResult] = await Promise.race([
      Promise.all([indicesQuery, coursQuery]),
      timeout,
    ]);

    if (indicesResult.error) throw indicesResult.error;
    if (coursResult.error) throw coursResult.error;

    const coursRows = coursResult.data || [];
    const tickers = [...new Set(coursRows.map(row => row.ticker).filter(Boolean))];

    let companies = [];
    if (tickers.length > 0) {
      const companyQuery = supabase
        .from('entreprises')
        .select('ticker, nom, nom_court')
        .in('ticker', tickers);

      const companyResult = await Promise.race([companyQuery, timeout]);
      if (companyResult.error) throw companyResult.error;
      companies = companyResult.data || [];
    }

    const nameMap = new Map(
      companies.map(company => [company.ticker, company.nom || company.nom_court || company.ticker])
    );

    const seen = new Set();
    const uniqueCours = [];

    for (const row of coursRows) {
      if (!seen.has(row.ticker)) {
        seen.add(row.ticker);
        uniqueCours.push({
          ...row,
          nom: nameMap.get(row.ticker) || row.ticker,
        });
      }
    }

    const sorted = [...uniqueCours].sort((a, b) => (b.variation || 0) - (a.variation || 0));
    const topHausses = sorted.filter(row => (row.variation || 0) > 0).slice(0, 5);
    const topBaisses = sorted.filter(row => (row.variation || 0) < 0).slice(0, 5).reverse();
    const topVolumes = [...uniqueCours]
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, 5);

    return jsonResponse({
      success: true,
      data: {
        indices: (indicesResult.data || []).slice(0, 3),
        cours: uniqueCours.slice(0, 15),
        topHausses,
        topBaisses,
        topVolumes,
        dateSeance: uniqueCours[0]?.date_seance || new Date().toISOString().split('T')[0],
        totalValeurs: uniqueCours.length,
      },
    });
  } catch (error) {
    console.error('[VERCEL ADAPTER] Market compatibility error:', error);
    return jsonResponse(
      {
        success: false,
        error: `Erreur serveur: ${error.message}`,
        code: 'SERVER_ERROR',
      },
      500,
      'no-store'
    );
  }
}

async function sendWebResponse(res, response) {
  if (!(response instanceof Response)) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ success: false, error: 'Invalid API response' }));
  }

  res.statusCode = response.status;

  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const body = await response.arrayBuffer();
  return res.end(Buffer.from(body));
}

export default async function handler(req, res) {
  try {
    console.log('[VERCEL ADAPTER] Request:', req.method, req.url);

    const requestUrl = new URL(buildAbsoluteUrl(req));

    if (req.method === 'OPTIONS') {
      return await sendWebResponse(
        res,
        jsonResponse({ success: true }, 204)
      );
    }

    if (requestUrl.pathname === '/api/marche') {
      const compatibilityResponse = await handlePublicMarketCompatibility(requestUrl);
      if (compatibilityResponse) {
        return await sendWebResponse(res, compatibilityResponse);
      }
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

    return res.end(JSON.stringify({
      success: false,
      error: 'Internal server error',
    }));
  }
}
