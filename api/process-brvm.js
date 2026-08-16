import config from '../lib/config.js';
import { matchInstrument, normalizeTicker } from '../lib/market-instrument-matcher.js';

const jsonHeaders = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
function authHeader(req) { return String(req.headers.authorization || ''); }

async function isAdminRequest(req) {
  const auth = authHeader(req);
  if (!auth.startsWith('Bearer ') || !config.supabaseServiceKey || !config.supabaseUrl) return false;
  const token = auth.slice(7).trim();
  if (!token) return false;
  const r = await fetch(`${config.supabaseUrl}/auth/v1/user`, { headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${token}` } });
  if (!r.ok) return false;
  const user = await r.json();
  const ur = await fetch(`${config.supabaseUrl}/rest/v1/users?select=id,is_admin&id=eq.${encodeURIComponent(user.id)}`, { headers: { apikey: config.supabaseServiceKey, Authorization: `Bearer ${config.supabaseServiceKey}` } });
  if (!ur.ok) return false;
  const rows = await ur.json();
  return !!(rows[0] && rows[0].is_admin);
}
function isCronRequest(req) { return !!config.cronSecret && authHeader(req) === `Bearer ${config.cronSecret}`; }

async function db(path, options = {}) {
  const r = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, { ...options, headers: { apikey: config.supabaseServiceKey, Authorization: `Bearer ${config.supabaseServiceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(options.headers || {}) } });
  const text = await r.text(); let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw new Error((data && (data.message || data.details || data.hint)) || `Supabase HTTP ${r.status}`);
  return data;
}

/* Audit trail is deliberately best-effort. A permission/RLS failure on the
 * optional log table must NEVER abort the actual market-data processing. */
async function safeScrapeRunLog(payload) {
  try { await db('brvm_scrape_runs', { method: 'POST', body: JSON.stringify(payload) }); return true; }
  catch (e) { console.warn('[BRVM] brvm_scrape_runs indisponible, traitement continue:', e?.message || e); return false; }
}

async function getSetting() { const rows = await db('admin_settings?select=key,value&key=eq.brvm_processing'); return rows[0]?.value || { mode: 'manual' }; }
async function setSetting(value, actor = 'admin') { return db('admin_settings?key=eq.brvm_processing', { method: 'PATCH', body: JSON.stringify({ value: { ...value, updated_by: actor }, updated_at: new Date().toISOString() }) }); }

async function scrape(req) {
  const host = req.headers.host || 'thecapitalinvest.vercel.app';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const r = await fetch(`${protocol}://${host}/api/scrape-brvm`, { method: 'POST', headers: jsonHeaders, body: '{}' });
  const text = await r.text(); let data;
  try { data = JSON.parse(text); } catch { data = { success: false, error: text }; }
  if (!r.ok || !data.success) throw new Error(data.error || data.details || `Scraper HTTP ${r.status}`);
  return data;
}

async function loadEnterpriseReference() {
  const rows = await db('entreprises?select=ticker,nom,isin,secteur,pays,compartiment&order=ticker.asc');
  return (rows || []).filter(r => r?.ticker && r?.nom);
}

/* Provider rows may contain ticker, symbol, company_name, nom or libelle.
 * Canonical ticker always comes from our entreprises reference. */
async function normalizeRows(data) {
  const rawRows = Array.isArray(data.rows) ? data.rows : [];
  const reference = await loadEnterpriseReference();
  const rows = [];
  const mapping = { matched: 0, ambiguous: [], unmatched: [] };

  for (const r of rawRows) {
    const match = matchInstrument(r, reference);
    if (match.status !== 'matched') {
      const item = { source_ticker: r.ticker || r.symbol || r.code || null, source_name: r.nom || r.name || r.libelle || r.company_name || null, status: match.status, score: match.score, candidates: (match.candidates || []).map(x => ({ ticker: x.ticker, nom: x.nom })) };
      mapping[match.status].push(item);
      continue;
    }
    mapping.matched++;
    const canonical = match.record;
    rows.push({
      ...r,
      ticker: normalizeTicker(canonical.ticker),
      nom: canonical.nom,
      date_seance: r.date_seance || data.date_seance,
      cours: r.cours ?? r.cloture ?? null,
      cloture: r.cloture ?? r.cours ?? null,
      cours_cloture: r.cours_cloture ?? r.cloture ?? r.cours ?? null,
      ouverture: r.ouverture ?? r.cours_ouverture ?? null,
      cours_ouverture: r.cours_ouverture ?? r.ouverture ?? null,
      plus_haut: r.plus_haut ?? null,
      plus_bas: r.plus_bas ?? null,
      volume: r.volume ?? null,
      variation: r.variation ?? r.variation_pct ?? null,
      variation_pct: r.variation_pct ?? r.variation ?? null,
      valeur_transigee: r.valeur_transigee ?? r.valeur ?? null,
      valeur_totale: r.valeur_totale ?? r.valeur_transigee ?? r.valeur ?? null,
      capitalisation: r.capitalisation ?? null,
      transactions: r.transactions ?? null
    });
  }
  return { rows: rows.filter(r => r.ticker && r.date_seance && r.cours_cloture != null), mapping };
}

async function validateLimit(rows) {
  const violations = [];
  const sessionDate = rows[0]?.date_seance;
  let previousSessionDate = null;
  if (sessionDate) {
    const previousRows = await db(`historique?select=date_seance&date_seance=lt.${encodeURIComponent(sessionDate)}&order=date_seance.desc&limit=1`);
    previousSessionDate = previousRows[0]?.date_seance || null;
  }
  for (const row of rows) {
    const prevRows = await db(`historique?select=cours_cloture,cloture,date_seance&ticker=eq.${encodeURIComponent(row.ticker)}&date_seance=lt.${encodeURIComponent(row.date_seance)}&order=date_seance.desc&limit=1`);
    const prevDate = prevRows[0]?.date_seance || null;
    const prev = Number(prevRows[0]?.cours_cloture ?? prevRows[0]?.cloture);
    const close = Number(row.cours_cloture);
    const reported = row.variation == null ? null : Number(row.variation);
    const computed = Number.isFinite(prev) && prev > 0 && Number.isFinite(close) ? ((close - prev) / prev) * 100 : null;
    const effective = Number.isFinite(reported) ? reported : computed;
    if (Number.isFinite(effective) && Math.abs(effective) > 7.5 + 1e-9) violations.push({ ticker: row.ticker, date: row.date_seance, variation: effective, previous_close: Number.isFinite(prev) ? prev : null, close });
    if (prevDate === previousSessionDate && Number.isFinite(reported) && Number.isFinite(computed) && Math.abs(reported - computed) > 0.25) violations.push({ ticker: row.ticker, date: row.date_seance, variation: reported, computed_variation: computed, type: 'variation_incoherente' });
  }
  return violations;
}

async function writeSession(data, rows) {
  const courseRows = rows.map(r => ({ ...r }));
  const histRows = rows.map(r => ({ ticker: r.ticker, date_seance: r.date_seance, cloture: r.cloture, cours_cloture: r.cours_cloture, cours_ouverture: r.cours_ouverture, plus_haut: r.plus_haut, plus_bas: r.plus_bas, volume: r.volume, variation: r.variation, variation_pct: r.variation_pct, valeur_totale: r.valeur_totale }));
  await db('cours?on_conflict=ticker,date_seance', { method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' }, body: JSON.stringify(courseRows) });
  await db('historique?on_conflict=ticker,date_seance', { method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' }, body: JSON.stringify(histRows) });
  if (Array.isArray(data.indices) && data.indices.length) {
    const indices = data.indices.map(x => ({ indice: x.indice, date_seance: x.date_seance || data.date_seance, valeur: x.valeur, variation: x.variation, variation_pct: x.variation_pct ?? x.variation }));
    await db('indices?on_conflict=indice,date_seance', { method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' }, body: JSON.stringify(indices) });
  }
  return { courses: courseRows.length, historique: histRows.length, indices: Array.isArray(data.indices) ? data.indices.length : 0 };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) return res.status(405).json({ success: false, error: 'Method not allowed' });
  try {
    const admin = await isAdminRequest(req); const cron = isCronRequest(req);
    if (!admin && !cron) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const current = await getSetting();
    if (req.method === 'GET') return res.status(200).json({ success: true, settings: current });
    if (req.method === 'PATCH') { if (!admin) return res.status(403).json({ success: false, error: 'Admin required' }); const mode = req.body?.mode === 'auto' ? 'auto' : 'manual'; const next = await setSetting({ mode }, 'admin'); return res.status(200).json({ success: true, settings: next?.[0]?.value || { mode } }); }
    if (cron && current.mode !== 'auto') return res.status(200).json({ success: true, skipped: true, reason: 'automatic_processing_disabled' });

    const data = await scrape(req);
    const normalized = await normalizeRows(data);
    const rows = normalized.rows;
    if (!rows.length) return res.status(422).json({ success: false, blocked: true, reason: 'NO_MATCHED_MARKET_ROWS', mapping: normalized.mapping, date_seance: data.date_seance });
    if (normalized.mapping.ambiguous.length || normalized.mapping.unmatched.length) {
      return res.status(422).json({ success: false, blocked: true, reason: 'INSTRUMENT_MAPPING_REVIEW_REQUIRED', date_seance: data.date_seance, mapping: normalized.mapping, matched_rows: rows.length });
    }
    const violations = await validateLimit(rows);
    if (violations.length) {
      await safeScrapeRunLog({ started_at: new Date().toISOString(), finished_at: new Date().toISOString(), status: 'blocked_validation', result: { date_seance: data.date_seance, count: rows.length, violations }, error: 'Contrôle BRVM : variation hors limite ou incohérente' });
      return res.status(422).json({ success: false, blocked: true, reason: 'BRVM_VARIATION_CONTROL', limit: 7.5, violations, date_seance: data.date_seance });
    }
    const result = await writeSession(data, rows);
    await safeScrapeRunLog({ started_at: new Date().toISOString(), finished_at: new Date().toISOString(), status: 'success', result: { ...result, date_seance: data.date_seance, source: 'BRVM', mapping: normalized.mapping } });
    return res.status(200).json({ success: true, processed: true, mode: current.mode, date_seance: data.date_seance, mapping: normalized.mapping, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error?.message || error) });
  }
}
