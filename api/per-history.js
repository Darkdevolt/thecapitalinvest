import { supabase, supabaseAdmin } from '../lib/supabase.js';
import config from '../lib/config.js';

const db = supabaseAdmin || supabase;

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.end(JSON.stringify(payload));
}

function normalizeTicker(value) {
  return String(value || '').trim().toUpperCase();
}

function authHeader(req) {
  return String(req.headers.authorization || '');
}

async function isAdminRequest(req) {
  const auth = authHeader(req);
  if (!auth.startsWith('Bearer ') || !config.supabaseServiceKey || !config.supabaseUrl) return false;
  const token = auth.slice(7).trim();
  if (!token) return false;

  const userResponse = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: config.supabasePublishableKey,
      Authorization: `Bearer ${token}`
    }
  });
  if (!userResponse.ok) return false;

  const user = await userResponse.json();
  const adminResponse = await fetch(
    `${config.supabaseUrl}/rest/v1/users?select=id,is_admin&id=eq.${encodeURIComponent(user.id)}`,
    {
      headers: {
        apikey: config.supabaseServiceKey,
        Authorization: `Bearer ${config.supabaseServiceKey}`
      }
    }
  );
  if (!adminResponse.ok) return false;
  const rows = await adminResponse.json();
  return !!(rows[0] && rows[0].is_admin);
}

async function refresh(ticker, full) {
  if (!db) throw new Error('Supabase non configuré');
  const { data, error } = await db.rpc('refresh_per_history', {
    p_ticker: ticker || null,
    p_full: !!full
  });
  if (error) throw error;
  return Number(data || 0);
}

async function getRows(ticker) {
  let query = db.from('per_history').select('*').order('annee', { ascending: true });
  if (ticker) query = query.eq('ticker', ticker);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// For the current year, the course is dynamic but the latest available BPA is
// valid until a newer BPA is published. The database history function correctly
// selects the latest course for the current year, but it intentionally joins BPA
// by the same fiscal year. This fallback keeps 2026 calculable with the most
// recent available annual BPA (2025 today), without changing closed-year rows.
async function applyCurrentYearBpaFallback(rows, ticker) {
  const currentYear = new Date().getUTCFullYear();
  const currentRows = rows.filter(row => Number(row.annee) === currentYear);
  if (!currentRows.length || !db) return rows;

  let query = db
    .from('financials')
    .select('id,ticker,annee,periode,bpa,validation_status,updated_at')
    .eq('ticker', ticker)
    .lte('annee', currentYear)
    .not('bpa', 'is', null);

  const { data, error } = await query;
  if (error) throw error;

  const candidates = (data || [])
    .filter(row => row.periode == null || String(row.periode).toLowerCase() === 'annuel')
    .filter(row => Number.isFinite(Number(row.bpa)) && Number(row.bpa) !== 0)
    .sort((a, b) => {
      const yearDiff = Number(b.annee) - Number(a.annee);
      if (yearDiff) return yearDiff;
      const validatedDiff = Number(String(b.validation_status || '').toLowerCase() === 'validated') - Number(String(a.validation_status || '').toLowerCase() === 'validated');
      if (validatedDiff) return validatedDiff;
      return String(b.updated_at || '').localeCompare(String(a.updated_at || '')) || Number(b.id || 0) - Number(a.id || 0);
    });

  if (!candidates.length) return rows;

  return rows.map(row => {
    if (Number(row.annee) !== currentYear || row.bpa != null) return row;
    const bpa = Number(candidates[0].bpa);
    const course = Number(row.cours_reference);
    const per = bpa > 0 && Number.isFinite(course) ? course / bpa : null;
    return {
      ...row,
      bpa,
      per,
      raison: per == null ? (bpa < 0 ? 'BPA négatif' : 'BPA nul') : null
    };
  });
}

async function prepareRows(ticker) {
  const rows = await getRows(ticker);
  if (!ticker) return rows;
  return applyCurrentYearBpaFallback(rows, ticker);
}

export default async function handler(req, res) {
  if (!db) return json(res, 500, { error: 'Supabase non configuré' });

  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const ticker = normalizeTicker(url.searchParams.get('ticker'));

    if (req.method === 'GET') {
      // Normal read: closed years remain fixed on their last session of the
      // respective year; the current year is refreshed on every read.
      await refresh(ticker || null, false);
      const rows = await prepareRows(ticker || null);
      return json(res, 200, {
        success: true,
        ticker: ticker || null,
        current_year: new Date().getUTCFullYear(),
        rows
      });
    }

    if (req.method === 'POST') {
      if (!(await isAdminRequest(req))) return json(res, 403, { error: 'Accès administrateur requis' });
      let body = {};
      try {
        body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
      } catch {
        body = {};
      }
      const requestedTicker = normalizeTicker(body.ticker || ticker);
      const full = body.full !== false;
      const refreshed = await refresh(requestedTicker || null, full);
      const rows = await prepareRows(requestedTicker || null);
      return json(res, 200, {
        success: true,
        ticker: requestedTicker || null,
        full,
        refreshed,
        rows
      });
    }

    return json(res, 405, { error: 'Method Not Allowed' });
  } catch (error) {
    console.error('[API/PER-HISTORY]', error);
    return json(res, 500, { error: error?.message || 'Erreur historique PER' });
  }
}
