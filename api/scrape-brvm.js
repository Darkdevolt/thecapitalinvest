const SUPABASE_URL = 'https://otsiwiwlnowxeolbbgvm.supabase.co';
const SIKA_URL = 'https://www.sikafinance.com/marches/aaz';
const DEFAULT_TIMEOUT_MS = 25000;

function withTimeout(promise, ms, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return Promise.race([
    promise(controller.signal),
    new Promise((_, reject) => setTimeout(() => reject(new Error(label || 'Timeout')), ms + 50))
  ]).finally(() => clearTimeout(timer));
}

function cleanText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).replace(/\u00a0/g, ' ').trim();
  if (!s || s === '-' || s === '—') return null;
  const normalized = s.replace(/\s/g, '').replace(/%$/, '').replace(/,/g, '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function parsePercent(value) {
  const n = parseNumber(value);
  return n === null ? null : n;
}

function normalizeName(value) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function extractTicker(html) {
  const m = String(html || '').match(/href=["'][^"']*\/cotation_([A-Z0-9_-]+)(?:\.[a-z]{2})?[^"']*["']/i);
  return m ? m[1].toUpperCase() : null;
}

function parseSikaRows(html) {
  const rows = [];
  const trMatches = String(html || '').match(/<tr[\\s\\S]*?<\\/tr>/gi) || [];
  for (const tr of trMatches) {
    const cells = tr.match(/<t[dh][^>]*>[\\s\\S]*?<\\/t[dh]>/gi) || [];
    if (cells.length < 7) continue;
    const texts = cells.map(cleanText);
    const header = texts.join(' ').toLowerCase();
    if (header.includes('ouverture') && header.includes('dernier') && header.includes('variation')) continue;
    const firstCell = cells[0];
    const name = texts[0];
    if (!name || /^BRVM\s*-|^INDICE|^CAPITALISATION|^SIKA TOTAL/i.test(name)) continue;
    const ticker = extractTicker(firstCell);
    if (texts.length >= 8) {
      rows.push({
        ticker,
        nom: name,
        ouverture: parseNumber(texts[1]),
        plus_haut: parseNumber(texts[2]),
        plus_bas: parseNumber(texts[3]),
        volume: parseNumber(texts[4]),
        valeur: parseNumber(texts[5]),
        cours: parseNumber(texts[6]),
        variation: parsePercent(texts[7])
      });
    }
  }
  return rows.filter(r => r.cours !== null);
}

function extractSessionDate(html) {
  const text = cleanText(html);
  const patterns = [
    /(?:séance|seance|cotations?|cours)[^0-9]{0,80}(\d{2}[\\/-]\d{2}[\\/-]\d{4})/i,
    /(\d{2}[\\/-]\d{2}[\\/-]\d{4})[^0-9]{0,80}(?:séance|seance|cotations?)/i
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const parts = m[1].split(/[\\/-]/);
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return new Date().toISOString().slice(0, 10);
}

async function fetchJson(url, options = {}, timeout = DEFAULT_TIMEOUT_MS) {
  return withTimeout(async (signal) => {
    const response = await fetch(url, { ...options, signal });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { response, text, data };
  }, timeout, `Timeout lors de ${url}`);
}

function validBrvmResponse(response, data) {
  if (!response.ok) return false;
  if (data === null || data === undefined) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === 'object') {
    if (data.success === false || data.error) return false;
    const candidates = [data.data, data.rows, data.cours, data.results, data.items];
    if (candidates.some(Array.isArray) && !candidates.some(a => Array.isArray(a) && a.length)) return false;
  }
  return true;
}

function authHeaders(req) {
  const authorization = req.headers.authorization || req.headers.Authorization;
  const apikey = req.headers['x-supabase-api-key'] || req.headers.apikey || '';
  return { authorization, apikey };
}

async function supabaseRequest(req, table, options = {}) {
  const { authorization, apikey } = authHeaders(req);
  if (!authorization) throw new Error('Session Supabase absente');
  if (!apikey) throw new Error('Clé Supabase publique absente');
  const url = `${SUPABASE_URL}/rest/v1/${table}${options.query ? `?${options.query}` : ''}`;
  const headers = {
    apikey,
    Authorization: authorization,
    'Content-Type': 'application/json',
    Prefer: options.prefer || 'return=minimal'
  };
  const { response, text, data } = await fetchJson(url, { method: options.method || 'GET', headers, body: options.body ? JSON.stringify(options.body) : undefined }, DEFAULT_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Supabase ${table}: HTTP ${response.status} ${text.slice(0, 300)}`);
  return data;
}

async function runSikaFallback(req) {
  const { response, text } = await fetchJson(SIKA_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; TheCapitalInvest BRVM fallback)',
      Accept: 'text/html,application/xhtml+xml'
    }
  }, DEFAULT_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Sika Finance HTTP ${response.status}`);
  if (!text || text.length < 1000) throw new Error('Réponse Sika Finance vide ou invalide');

  const parsed = parseSikaRows(text);
  if (!parsed.length) throw new Error('Aucune cotation exploitable trouvée sur Sika Finance');

  const entreprises = await supabaseRequest(req, 'entreprises', { query: 'select=*' });
  const byTicker = new Map();
  const byName = new Map();
  for (const e of Array.isArray(entreprises) ? entreprises : []) {
    if (e && e.ticker) {
      byTicker.set(String(e.ticker).toUpperCase(), e);
      if (e.nom) byName.set(normalizeName(e.nom), String(e.ticker).toUpperCase());
    }
  }

  const date = extractSessionDate(text);
  const mapped = [];
  for (const row of parsed) {
    const ticker = row.ticker || byName.get(normalizeName(row.nom));
    if (!ticker || !byTicker.has(ticker)) continue;
    mapped.push({ ticker, date_seance: date, cours: row.cours, ouverture: row.ouverture, plus_haut: row.plus_haut, plus_bas: row.plus_bas, volume: row.volume, variation: row.variation });
  }

  if (!mapped.length) throw new Error('Sika Finance a répondu, mais aucun ticker ne correspond au référentiel entreprises');

  const cours = await supabaseRequest(req, 'cours', {
    method: 'POST',
    query: 'on_conflict=ticker,date_seance',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: mapped
  });

  const historique = mapped.map(r => ({ ticker: r.ticker, date_seance: r.date_seance, cours_cloture: r.cours, cours_ouverture: r.ouverture, plus_haut: r.plus_haut, plus_bas: r.plus_bas, volume: r.volume, variation: r.variation }));
  await supabaseRequest(req, 'historique', {
    method: 'POST',
    query: 'on_conflict=ticker,date_seance',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: historique
  });

  return { source: 'Sika Finance', date_seance: date, count: mapped.length, skipped: parsed.length - mapped.length, success: true, cours, message: `${mapped.length} titres récupérés et synchronisés` };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { authorization, apikey } = authHeaders(req);
  if (!authorization || !apikey) return res.status(401).json({ success: false, error: 'Authentification Supabase manquante' });

  const result = { success: false, source: null, attempts: [] };

  try {
    try {
      const { response, text, data } = await fetchJson(`${SUPABASE_URL}/functions/v1/scrape-brvm`, {
        method: 'POST',
        headers: { Authorization: authorization, apikey, 'Content-Type': 'application/json' },
        body: '{}'
      }, 45000);
      if (validBrvmResponse(response, data)) {
        result.success = true;
        result.source = 'BRVM';
        result.data = data;
        result.attempts.push({ source: 'BRVM', ok: true, status: response.status });
        return res.status(200).json(result);
      }
      result.attempts.push({ source: 'BRVM', ok: false, status: response.status, error: (data && (data.error || data.message)) || text.slice(0, 250) });
    } catch (error) {
      result.attempts.push({ source: 'BRVM', ok: false, error: error.name === 'AbortError' ? 'timeout' : String(error.message || error) });
    }

    const fallback = await runSikaFallback(req);
    result.success = true;
    result.source = fallback.source;
    result.data = fallback;
    result.attempts.push({ source: 'Sika Finance', ok: true, count: fallback.count });
    return res.status(200).json(result);
  } catch (error) {
    result.attempts.push({ source: 'Sika Finance', ok: false, error: String(error.message || error) });
    return res.status(502).json({ ...result, error: 'BRVM indisponible et fallback Sika Finance échoué' });
  }
}
