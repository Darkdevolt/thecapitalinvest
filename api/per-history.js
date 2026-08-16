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

// A current-year PER is a CURRENT valuation multiple, not a forecast PER.
// Until a new annual BPA is published, it uses the latest available annual BPA.
// Closed years keep their own year-end course and matching annual BPA.
async function applyCurrentYearBpaFallback(rows, ticker) {
  const currentYear = new Date().getUTCFullYear();
  const currentRows = rows.filter(row => Number(row.annee) === currentYear);
  if (!currentRows.length || !db) return rows;

  const { data, error } = await db
    .from('financials')
    .select('id,ticker,annee,periode,bpa,validation_status,updated_at')
    .eq('ticker', ticker)
    .lte('annee', currentYear)
    .not('bpa', 'is', null);
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

  const reference = candidates[0];
  const bpa = Number(reference.bpa);
  const referenceYear = Number(reference.annee);

  return rows.map(row => {
    if (Number(row.annee) !== currentYear || row.bpa != null) return row;
    const course = Number(row.cours_reference);
    const per = bpa > 0 && Number.isFinite(course) ? course / bpa : null;
    return {
      ...row,
      bpa,
      per,
      bpa_reference_year: referenceYear,
      per_type: 'courant',
      per_label: 'PER courant',
      bpa_reference_label: `BPA de référence : exercice ${referenceYear}`,
      cours_reference_label: 'Dernier cours disponible',
      raison: per == null ? (bpa < 0 ? 'BPA négatif' : 'BPA nul') : null
    };
  });
}

function decorateRows(rows) {
  const currentYear = new Date().getUTCFullYear();
  return rows.map(row => {
    const year = Number(row.annee);
    const isCurrent = year === currentYear;
    if (isCurrent) {
      return {
        ...row,
        per_type: row.per_type || 'courant',
        per_label: row.per_label || 'PER courant',
        bpa_reference_year: Number(row.bpa_reference_year || year),
        bpa_reference_label: row.bpa_reference_label || `BPA de référence : exercice ${Number(row.bpa_reference_year || year)}`,
        cours_reference_label: row.cours_reference_label || 'Dernier cours disponible'
      };
    }
    return {
      ...row,
      per_type: 'historique',
      per_label: `PER historique ${year}`,
      bpa_reference_year: year,
      bpa_reference_label: `BPA : exercice ${year}`,
      cours_reference_label: `Cours de clôture ${year}`
    };
  });
}

async function prepareRows(ticker) {
  const rows = await getRows(ticker);
  if (!ticker) return decorateRows(rows);
  return decorateRows(await applyCurrentYearBpaFallback(rows, ticker));
}

export default async function handler(req, res) {
  if (!db) return json(res, 500, { error: 'Supabase non configuré' });

  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const ticker = normalizeTicker(url.searchParams.get('ticker'));

    if (req.method === 'GET') {
      // Closed years stay fixed on their last session. The current year is
      // refreshed on every read and uses the latest available annual BPA.
      await refresh(ticker || null, false);
      const rows = await prepareRows(ticker || null);
      const currentYear = new Date().getUTCFullYear();
      const currentRow = rows.find(row => Number(row.annee) === currentYear) || null;
      return json(res, 200, {
        success: true,
        ticker: ticker || null,
        current_year: currentYear,
        current_per_type: 'courant',
        current_per_label: 'PER courant',
        current_bpa_reference_year: currentRow?.bpa_reference_year || null,
        current_course_date: currentRow?.date_cours_reference || null,
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
