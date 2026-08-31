import { json, fail, applyCors } from '../lib/http.js';
import { rateLimited } from '../lib/middleware.js';
import { getPublicMarketSnapshot } from '../lib/market-snapshot.js';

const CACHE_CONTROL = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';
let memoryCache = null;

export default async function handler(req, res) {
  applyCors(req, res, { scope: 'public', methods: 'GET,OPTIONS' });
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'GET') return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
  if (rateLimited(req, res, 'marche-public')) return;

  try {
    const now = Date.now();
    if (memoryCache && now - memoryCache.time < 60_000) {
      return json(res, 200, memoryCache.data, { cache: CACHE_CONTROL });
    }

    const data = await getPublicMarketSnapshot();
    memoryCache = { time: now, data };
    return json(res, 200, data, { cache: CACHE_CONTROL });
  } catch (error) {
    if (memoryCache?.data) {
      return json(res, 200, memoryCache.data, { cache: CACHE_CONTROL });
    }
    return fail(res, 503, 'Service marché temporairement indisponible.', 'MARKET_UNAVAILABLE', error);
  }
}
