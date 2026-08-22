/**
 * Pipeline de traitement d'une séance BRVM : récupération, rapprochement au
 * référentiel entreprises, contrôles de cohérence, puis écriture.
 *
 * CORRECTIFS MAJEURS :
 *
 *  1. Le cron ne traitait rien. Vercel déclenche les tâches planifiées par une
 *     requête GET ; or le handler renvoyait simplement les réglages sur GET et
 *     ne traitait que sur POST. La planification « 5 16 * * 1-5 » n'a donc
 *     jamais rien produit. Un GET authentifié par le secret machine déclenche
 *     désormais le traitement ; un GET administrateur continue de renvoyer les
 *     réglages, ce qui préserve le comportement de l'interface d'administration.
 *
 *  2. Le contrôle de variation exécutait une requête par valeur cotée, en série
 *     (une quarantaine d'allers-retours). Il est remplacé par une seule lecture
 *     groupée.
 *
 *  3. Le scraping était appelé par une requête HTTP de la fonction vers
 *     elle-même. Il est maintenant invoqué directement.
 *
 *  4. Deux mécanismes d'accès à la base coexistaient (client Supabase et appels
 *     PostgREST bruts) avec deux vérifications d'administrateur distinctes.
 *     Le client Supabase est désormais le seul chemin.
 */
import { supabaseAdmin } from '../lib/supabase.js';
import { scrapeBrvm } from '../lib/brvm-scraper.js';
import { matchInstrument, normalizeTicker } from '../lib/market-instrument-matcher.js';
import { authenticateAdmin, isMachineRequest, handlePreflight } from '../lib/middleware.js';
import { json, fail, readBody } from '../lib/http.js';

/** Variation maximale autorisée sur une séance, en pourcentage. */
const VARIATION_LIMIT = 7.5;
/** Écart toléré entre la variation publiée et la variation recalculée. */
const VARIATION_TOLERANCE = 0.25;
/** Profondeur de recherche du cours de référence précédent. */
const LOOKBACK_DAYS = 45;

async function getSetting() {
  const { data, error } = await supabaseAdmin
    .from('admin_settings').select('key,value').eq('key', 'brvm_processing').maybeSingle();
  if (error) throw error;
  return data?.value || { mode: 'manual' };
}

async function setSetting(value, actor = 'admin') {
  const { data, error } = await supabaseAdmin
    .from('admin_settings')
    .update({ value: { ...value, updated_by: actor }, updated_at: new Date().toISOString() })
    .eq('key', 'brvm_processing').select('value');
  if (error) throw error;
  return data?.[0]?.value || value;
}

/**
 * Journal d'audit volontairement non bloquant : une table absente ou une règle
 * RLS restrictive ne doit jamais interrompre le traitement des données.
 */
async function safeRunLog(payload) {
  try {
    const { error } = await supabaseAdmin.from('brvm_scrape_runs').insert(payload);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('[BRVM] journal brvm_scrape_runs indisponible :', e?.message || e);
    return false;
  }
}

async function loadEnterpriseReference() {
  const { data, error } = await supabaseAdmin
    .from('entreprises').select('ticker,nom,isin,secteur,pays,compartiment')
    .order('ticker', { ascending: true });
  if (error) throw error;
  return (data || []).filter(r => r?.ticker && r?.nom);
}

/**
 * Les fournisseurs exposent le libellé sous ticker, symbol, company_name, nom
 * ou libelle. Le ticker canonique provient toujours du référentiel entreprises.
 */
async function normalizeRows(payload) {
  const rawRows = Array.isArray(payload.rows) ? payload.rows : [];
  const reference = await loadEnterpriseReference();
  const rows = [];
  const mapping = { matched: 0, ambiguous: [], unmatched: [] };

  for (const r of rawRows) {
    const match = matchInstrument(r, reference);
    if (match.status !== 'matched') {
      mapping[match.status].push({
        source_ticker: r.ticker || r.symbol || r.code || null,
        source_name: r.nom || r.name || r.libelle || r.company_name || null,
        status: match.status,
        score: match.score,
        candidates: (match.candidates || []).map(c => ({ ticker: c.ticker, nom: c.nom }))
      });
      continue;
    }
    mapping.matched++;
    const canonical = match.record;
    rows.push({
      ...r,
      ticker: normalizeTicker(canonical.ticker),
      nom: canonical.nom,
      date_seance: r.date_seance || payload.date_seance,
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

  return {
    rows: rows.filter(r => r.ticker && r.date_seance && r.cours_cloture != null),
    mapping
  };
}

/** Cours de clôture précédent pour chaque ticker, en une seule lecture. */
async function previousCloses(tickers, sessionDate) {
  const floor = new Date(sessionDate);
  floor.setDate(floor.getDate() - LOOKBACK_DAYS);
  const { data, error } = await supabaseAdmin
    .from('historique')
    .select('ticker,date_seance,cours_cloture,cloture')
    .in('ticker', tickers)
    .lt('date_seance', sessionDate)
    .gte('date_seance', floor.toISOString().slice(0, 10))
    .order('date_seance', { ascending: false });
  if (error) throw error;

  const latest = new Map();
  for (const row of data || []) {
    if (latest.has(row.ticker)) continue; // trié décroissant : le premier est le bon
    latest.set(row.ticker, {
      date: row.date_seance,
      close: Number(row.cours_cloture ?? row.cloture)
    });
  }
  return latest;
}

async function validateVariations(rows) {
  const violations = [];
  const sessionDate = rows[0]?.date_seance;
  if (!sessionDate) return violations;

  const previous = await previousCloses([...new Set(rows.map(r => r.ticker))], sessionDate);
  const previousSessionDate = [...previous.values()]
    .map(p => p.date).filter(Boolean).sort().reverse()[0] || null;

  for (const row of rows) {
    const prev = previous.get(row.ticker);
    const prevClose = prev ? prev.close : NaN;
    const close = Number(row.cours_cloture);
    const reported = row.variation == null ? null : Number(row.variation);
    const computed = (Number.isFinite(prevClose) && prevClose > 0 && Number.isFinite(close))
      ? ((close - prevClose) / prevClose) * 100
      : null;
    const effective = Number.isFinite(reported) ? reported : computed;

    if (Number.isFinite(effective) && Math.abs(effective) > VARIATION_LIMIT + 1e-9) {
      violations.push({
        ticker: row.ticker, date: row.date_seance, variation: effective,
        previous_close: Number.isFinite(prevClose) ? prevClose : null, close,
        type: 'variation_hors_limite'
      });
    }

    // La comparaison publié / recalculé n'a de sens que si le cours de
    // référence est bien celui de la séance immédiatement précédente.
    if (prev && prev.date === previousSessionDate
      && Number.isFinite(reported) && Number.isFinite(computed)
      && Math.abs(reported - computed) > VARIATION_TOLERANCE) {
      violations.push({
        ticker: row.ticker, date: row.date_seance,
        variation: reported, computed_variation: computed,
        type: 'variation_incoherente'
      });
    }
  }
  return violations;
}

async function writeSession(payload, rows) {
  const histRows = rows.map(r => ({
    ticker: r.ticker, date_seance: r.date_seance,
    cloture: r.cloture, cours_cloture: r.cours_cloture, cours_ouverture: r.cours_ouverture,
    plus_haut: r.plus_haut, plus_bas: r.plus_bas, volume: r.volume,
    variation: r.variation, variation_pct: r.variation_pct, valeur_totale: r.valeur_totale
  }));

  const cours = await supabaseAdmin.from('cours')
    .upsert(rows, { onConflict: 'ticker,date_seance' });
  if (cours.error) throw cours.error;

  const historique = await supabaseAdmin.from('historique')
    .upsert(histRows, { onConflict: 'ticker,date_seance' });
  if (historique.error) throw historique.error;

  let indicesCount = 0;
  if (Array.isArray(payload.indices) && payload.indices.length) {
    const indices = payload.indices.map(x => ({
      indice: x.indice,
      date_seance: x.date_seance || payload.date_seance,
      valeur: x.valeur,
      variation: x.variation,
      variation_pct: x.variation_pct ?? x.variation
    }));
    const result = await supabaseAdmin.from('indices')
      .upsert(indices, { onConflict: 'indice,date_seance' });
    if (result.error) throw result.error;
    indicesCount = indices.length;
  }

  return { courses: rows.length, historique: histRows.length, indices: indicesCount };
}

async function runPipeline(res, mode) {
  const startedAt = new Date().toISOString();
  const payload = await scrapeBrvm();
  const { rows, mapping } = await normalizeRows(payload);

  if (!rows.length) {
    return json(res, 422, {
      success: false, blocked: true, reason: 'NO_MATCHED_MARKET_ROWS',
      mapping, date_seance: payload.date_seance
    });
  }
  if (mapping.ambiguous.length || mapping.unmatched.length) {
    return json(res, 422, {
      success: false, blocked: true, reason: 'INSTRUMENT_MAPPING_REVIEW_REQUIRED',
      date_seance: payload.date_seance, mapping, matched_rows: rows.length
    });
  }

  const violations = await validateVariations(rows);
  if (violations.length) {
    await safeRunLog({
      started_at: startedAt, finished_at: new Date().toISOString(),
      status: 'blocked_validation',
      result: { date_seance: payload.date_seance, count: rows.length, violations },
      error: 'Contrôle BRVM : variation hors limite ou incohérente'
    });
    return json(res, 422, {
      success: false, blocked: true, reason: 'BRVM_VARIATION_CONTROL',
      limit: VARIATION_LIMIT, violations, date_seance: payload.date_seance
    });
  }

  const result = await writeSession(payload, rows);
  await safeRunLog({
    started_at: startedAt, finished_at: new Date().toISOString(), status: 'success',
    result: { ...result, date_seance: payload.date_seance, source: 'BRVM', mapping }
  });

  return json(res, 200, {
    success: true, processed: true, mode,
    date_seance: payload.date_seance, mapping, ...result
  });
}

export default async function handler(req, res) {
  if (handlePreflight(req, res, { methods: 'GET,POST,PATCH,OPTIONS' })) return;
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
  }
  if (!supabaseAdmin) return fail(res, 503, 'Service temporairement indisponible.', 'SERVICE_UNAVAILABLE');

  const machine = isMachineRequest(req);
  let admin = null;
  if (!machine) {
    admin = await authenticateAdmin(req, res);
    if (!admin) return;
  }

  try {
    const current = await getSetting();

    // Cron Vercel : requête GET portant le secret machine.
    if (req.method === 'GET' && machine) {
      if (current.mode !== 'auto') {
        return json(res, 200, { success: true, skipped: true, reason: 'automatic_processing_disabled' });
      }
      return await runPipeline(res, current.mode);
    }

    // Consultation des réglages par l'interface d'administration.
    if (req.method === 'GET') return json(res, 200, { success: true, settings: current });

    if (req.method === 'PATCH') {
      if (!admin) return fail(res, 403, 'Accès administrateur requis.', 'ADMIN_REQUIRED');
      const body = await readBody(req).catch(() => ({}));
      const mode = body?.mode === 'auto' ? 'auto' : 'manual';
      const next = await setSetting({ mode }, 'admin');
      return json(res, 200, { success: true, settings: next });
    }

    // POST : déclenchement manuel par un administrateur, ou relance machine.
    if (machine && !admin && current.mode !== 'auto') {
      return json(res, 200, { success: true, skipped: true, reason: 'automatic_processing_disabled' });
    }
    return await runPipeline(res, current.mode);
  } catch (error) {
    return fail(res, 500, 'Traitement de la séance impossible.', 'PROCESS_BRVM_ERROR', error);
  }
}
