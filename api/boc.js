import { supabase, isSupabaseReady } from './lib/supabase.js';
import { error, success } from './lib/response.js';

const BRVM_BOC_PAGE = 'https://bfin.brvm.org/boc.aspx';
const BRVM_BOC_BASE = 'https://bfin.brvm.org/boc/BOC_JOUR/';
const CACHE_MS = 5 * 60 * 1000;
let memoryCache = { at: 0, data: null };

function jsonResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return new Response(response.body, { status: response.status, headers });
}

function dateFromFrenchOrIso(value) {
  const m = String(value).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function pdfUrl(date) {
  return `${BRVM_BOC_BASE}BOC_${date.replaceAll('-', '')}.pdf`;
}

async function fetchOfficialBoc(limit = 100) {
  const res = await fetch(BRVM_BOC_PAGE, {
    headers: { 'User-Agent': 'TheCapital/1.0 BOC reader' },
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) throw new Error(`BRVM BOC page HTTP ${res.status}`);

  const html = await res.text();
  const dates = [];
  const seen = new Set();

  // The BRVM page exposes the session dates in DD/MM/YYYY format.
  for (const match of html.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)) {
    const date = dateFromFrenchOrIso(match[1]);
    if (!date || seen.has(date)) continue;
    seen.add(date);
    dates.push(date);
    if (dates.length >= limit) break;
  }

  // Fallback for HTML variants that hide the displayed dates in PDF links.
  if (!dates.length) {
    for (const match of html.matchAll(/BOC[_-](\d{8})\.pdf/gi)) {
      const raw = match[1];
      const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      if (!seen.has(date)) {
        seen.add(date);
        dates.push(date);
      }
      if (dates.length >= limit) break;
    }
  }

  return dates.map((date, index) => ({
    id: `brvm-${date}`,
    date_seance: date,
    annee: Number(date.slice(0, 4)),
    numero_seance: null,
    fichier_nom: `BOC_${date.replaceAll('-', '')}.pdf`,
    fichier_url: pdfUrl(date),
    pdf_url: pdfUrl(date),
    source: 'BRVM',
    source_url: BRVM_BOC_PAGE,
    rang: index + 1,
  }));
}

async function readDatabase() {
  if (!isSupabaseReady()) return [];
  const { data, error: dbError } = await supabase
    .from('boc')
    .select('id,date_seance,fichier_nom,fichier_url,created_at')
    .order('date_seance', { ascending: false })
    .limit(100);
  if (dbError) throw dbError;
  return (data || []).map((row) => ({
    ...row,
    annee: row.date_seance ? Number(String(row.date_seance).slice(0, 4)) : null,
    numero_seance: null,
    pdf_url: row.fichier_url,
    source: 'database',
  }));
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    }});
  }
  if (req.method !== 'GET') return error('Méthode non autorisée', 405);

  try {
    const now = Date.now();
    if (memoryCache.data && now - memoryCache.at < CACHE_MS) {
      return jsonResponse(success({ data: memoryCache.data, source: 'cache' }));
    }

    let data = [];
    let source = 'database';

    try {
      data = await readDatabase();
    } catch (dbError) {
      console.warn('[BOC] Database read failed:', dbError.message);
    }

    // The database currently contains no usable BOC rows. Use BRVM as the
    // authoritative source instead of returning an apparently successful empty list.
    if (!data.length) {
      data = await fetchOfficialBoc(100);
      source = 'brvm';
    }

    memoryCache = { at: now, data };
    return jsonResponse(success({ data, source, count: data.length, source_url: BRVM_BOC_PAGE }));
  } catch (e) {
    console.error('[BOC] API error:', e);
    return error('Impossible de récupérer les Bulletins Officiels de la Cote', 502, 'BOC_SOURCE_ERROR');
  }
}
