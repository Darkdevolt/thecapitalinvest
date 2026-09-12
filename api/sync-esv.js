/**
 * Suiveur des Évènements Sur Valeurs (ESV) BRVM : dividendes, coupons,
 * fractionnements, augmentations/réductions de capital, fusions,
 * consolidations, radiations.
 *
 * Deux déclencheurs :
 *  - GET, secret machine (cron Vercel, 18h Abidjan = 18h UTC, pas de
 *    décalage à gérer) : passage quotidien léger, quelques pages par
 *    catégorie — les nouveautés sont toujours en tête de liste sur brvm.org.
 *  - POST, administrateur : backfill explicite avec sinceYears/maxPages plus
 *    larges, ou relance ciblée sur un sous-ensemble de catégories.
 *
 * Chaque ligne scrapée est identifiée par une clé naturelle stable (le
 * numéro d'avis BRVM DG quand il est extractible du nom du PDF, sinon un
 * hachage des champs significatifs) : un upsert par clé permet de détecter
 * un ajout (première apparition) ou une modification (contenu différent
 * d'un passage à l'autre) sans jamais dupliquer une ligne déjà connue.
 * Chaque passage est journalisé dans esv_scrape_runs, pour un historique
 * consultable depuis l'admin (action=runs).
 */
import { createHash } from 'crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import { scrapeEsv, CATEGORIES } from '../lib/brvm-esv-scraper.js';
import { matchInstrument } from '../lib/market-instrument-matcher.js';
import { authenticateAdmin, isMachineRequest, handlePreflight, rateLimited } from '../lib/middleware.js';
import { json, fail, requestUrl, readBody } from '../lib/http.js';
import config from '../lib/config.js';

const BUCKET = 'evenements-valeurs';
const DAILY_MAX_PAGES = 3;

const safeName = value => String(value || 'document.pdf')
  .normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/^\.+/, '').slice(0, 160) || 'document.pdf';

function publicUrl(path) {
  if (!config.supabaseUrl) throw new Error('SUPABASE_URL non configurée');
  return `${config.supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}

function basenameOf(url) {
  try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || 'document.pdf'); }
  catch { return 'document.pdf'; }
}

/* Le numéro d'avis BRVM DG (ex. "avis_ndeg213") est une séquence unique tous
   types de notice confondus : quand il est présent, c'est un identifiant
   naturel bien plus fiable qu'un hachage de champs qui peuvent légitimement
   changer (une date de paiement reportée par exemple). */
function naturalKey(row) {
  if (row.avis_numero) return `${row.categorie}:avis-${row.avis_numero}`;
  const basis = [
    row.categorie, row.emetteur, row.emetteur_absorbe, row.obligation,
    row.date_paiement, row.date_ex, row.date_evenement, row.montant_net, row.parite
  ].map(v => (v == null ? '' : String(v))).join('|');
  return `${row.categorie}:hash-${createHash('sha1').update(basis).digest('hex').slice(0, 16)}`;
}

async function loadEnterpriseReference() {
  const { data, error } = await supabaseAdmin.from('entreprises').select('ticker,nom').order('ticker');
  if (error) throw error;
  return (data || []).filter(r => r?.ticker && r?.nom);
}

async function downloadAndStore(url, prefix) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 TheCapitalInvest scraper' } });
  if (!response.ok) throw new Error(`PDF HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = safeName(basenameOf(url));
  const path = `${prefix}/${Date.now()}_${filename}`;
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
    contentType: 'application/pdf', upsert: true
  });
  if (error) throw error;
  return publicUrl(path);
}

async function safeRunLog(payload) {
  try {
    const { error } = await supabaseAdmin.from('esv_scrape_runs').insert(payload);
    if (error) throw error;
  } catch (e) {
    console.warn('[SYNC-ESV] journal esv_scrape_runs indisponible :', e?.message || e);
  }
}

/* Champs comparés pour décider si une ligne déjà connue a changé.
   'raw' et les colonnes de suivi (natural_key, first/last_seen_at...) sont
   volontairement exclues : elles ne reflètent pas un changement de contenu. */
const TRACKED_FIELDS = [
  'categorie', 'emetteur_brvm', 'emetteur_absorbe', 'ticker', 'obligation', 'exercice',
  'date_paiement', 'date_ex', 'date_evenement', 'montant_net', 'parite', 'valeur_theorique',
  'nature_droit', 'periode_negociation', 'avis_url', 'avis_numero', 'communique_url'
];

async function runSync({ sinceYears, maxPages, categories, downloadDocs }) {
  const startedAt = new Date().toISOString();
  const catList = categories?.length ? CATEGORIES.filter(c => categories.includes(c.categorie)) : CATEGORIES;
  const { rows, errors: scrapeErrors, hasMore } = await scrapeEsv({ categories: catList, sinceYears, maxPages });

  const reference = await loadEnterpriseReference();
  const keyed = rows.map(row => ({ ...row, natural_key: naturalKey(row) }));
  const uniqueRows = [...new Map(keyed.map(row => [row.natural_key, row])).values()];

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from('evenements_valeurs').select('*').in('natural_key', uniqueRows.map(r => r.natural_key));
  if (existingError) throw existingError;
  const existingByKey = new Map((existingRows || []).map(r => [r.natural_key, r]));

  let created = 0, updated = 0, unchanged = 0;
  const docErrors = [];
  const now = new Date().toISOString();

  for (const row of uniqueRows) {
    const match = matchInstrument({ nom: row.emetteur || row.emetteur_absorbe }, reference);
    const ticker = match.status === 'matched' ? match.record.ticker : null;
    const existing = existingByKey.get(row.natural_key);

    let avisStoredUrl = existing?.avis_stored_url || null;
    let communiqueStoredUrl = existing?.communique_stored_url || null;
    if (downloadDocs) {
      if (row.avis_url && !avisStoredUrl) {
        try { avisStoredUrl = await downloadAndStore(row.avis_url, `${row.categorie}/avis`); }
        catch (e) { docErrors.push({ natural_key: row.natural_key, doc: 'avis', error: String(e?.message || e) }); }
      }
      if (row.communique_url && !communiqueStoredUrl) {
        try { communiqueStoredUrl = await downloadAndStore(row.communique_url, `${row.categorie}/communique`); }
        catch (e) { docErrors.push({ natural_key: row.natural_key, doc: 'communique', error: String(e?.message || e) }); }
      }
    }

    const fields = {
      categorie: row.categorie,
      emetteur_brvm: row.emetteur || null,
      emetteur_absorbe: row.emetteur_absorbe || null,
      ticker,
      obligation: row.obligation || null,
      exercice: row.exercice ? parseInt(row.exercice, 10) : null,
      date_paiement: row.date_paiement || null,
      date_ex: row.date_ex || null,
      date_evenement: row.date_evenement || null,
      montant_net: row.montant_net ?? null,
      parite: row.parite || null,
      valeur_theorique: row.valeur_theorique ?? null,
      nature_droit: row.nature_droit || null,
      periode_negociation: row.periode_negociation || null,
      avis_url: row.avis_url || null,
      avis_numero: row.avis_numero || null,
      avis_stored_url: avisStoredUrl,
      communique_url: row.communique_url || null,
      communique_stored_url: communiqueStoredUrl,
      raw: row
    };

    if (!existing) {
      const { error } = await supabaseAdmin.from('evenements_valeurs').insert({
        ...fields, natural_key: row.natural_key,
        first_seen_at: now, last_seen_at: now, last_changed_at: now, updated_at: now
      });
      if (error) throw error;
      created++;
      continue;
    }

    const changed = TRACKED_FIELDS.some(k => String(fields[k] ?? '') !== String(existing[k] ?? ''));
    const { error } = await supabaseAdmin.from('evenements_valeurs')
      .update({ ...fields, last_seen_at: now, updated_at: now, ...(changed ? { last_changed_at: now } : {}) })
      .eq('id', existing.id);
    if (error) throw error;
    if (changed) updated++; else unchanged++;
  }

  const result = {
    total: uniqueRows.length, created, updated, unchanged,
    scrape_errors: scrapeErrors, doc_errors: docErrors, has_more: hasMore
  };
  await safeRunLog({ started_at: startedAt, finished_at: new Date().toISOString(), status: 'success', result });
  return result;
}

export default async function handler(req, res) {
  if (handlePreflight(req, res, { methods: 'GET,POST,OPTIONS' })) return;
  if (!['GET', 'POST'].includes(req.method)) return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
  if (!supabaseAdmin) return fail(res, 503, 'Service temporairement indisponible.', 'SERVICE_UNAVAILABLE');

  const machine = isMachineRequest(req);
  let admin = null;
  if (!machine) {
    if (rateLimited(req, res, 'sync-esv')) return;
    admin = await authenticateAdmin(req, res);
    if (!admin) return;
  }

  const url = requestUrl(req);

  if (req.method === 'GET' && url.searchParams.get('action') === 'runs') {
    if (!admin) return fail(res, 403, 'Accès administrateur requis.', 'ADMIN_REQUIRED');
    const { data, error } = await supabaseAdmin.from('esv_scrape_runs')
      .select('*').order('started_at', { ascending: false }).limit(20);
    if (error) return fail(res, 500, 'Lecture du journal impossible.', 'RUNS_READ_ERROR', error);
    return json(res, 200, { success: true, runs: data || [] });
  }

  try {
    let params;
    if (req.method === 'POST') {
      const body = await readBody(req).catch(() => ({}));
      params = {
        sinceYears: Number(body.sinceYears) || 5,
        maxPages: Math.min(60, Number(body.maxPages) || 15),
        categories: Array.isArray(body.categories) ? body.categories : null,
        downloadDocs: body.downloadDocs !== false
      };
    } else {
      // GET machine (cron quotidien) : passage volontairement léger.
      params = { sinceYears: 5, maxPages: DAILY_MAX_PAGES, categories: null, downloadDocs: true };
    }

    const result = await runSync(params);
    return json(res, 200, { success: true, ...result });
  } catch (error) {
    console.error('[SYNC-ESV]', error);
    await safeRunLog({
      started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
      status: 'error', error: String(error?.message || error)
    });
    return json(res, 502, { success: false, error: 'Synchronisation ESV impossible.', code: 'SYNC_ESV_ERROR' });
  }
}
