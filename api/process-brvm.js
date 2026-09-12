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
import { createHash } from 'crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import { scrapeBrvm } from '../lib/brvm-scraper.js';
import { scrapeBrvmObligations } from '../lib/brvm-obligations-scraper.js';
import { scrapeAnnouncements, CATEGORIES as ANNOUNCEMENT_CATEGORIES } from '../lib/brvm-announcements-scraper.js';
import { scrapeEsv, CATEGORIES as ESV_CATEGORIES } from '../lib/brvm-esv-scraper.js';
import { matchInstrument, normalizeTicker } from '../lib/market-instrument-matcher.js';
import { authenticateAdmin, isMachineRequest, handlePreflight } from '../lib/middleware.js';
import { json, fail, readBody, requestUrl } from '../lib/http.js';
import config from '../lib/config.js';

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

  /* CORRECTIF : le pipeline échouait à chaque exécution, avant même
     d'écrire quoi que ce soit — silencieusement pour le cron (401 côté
     auth), mais aussi pour tout déclenchement manuel réussi. La cause :
     un upsert vers la table `cours`, avec les colonnes de `rows`
     (cours_cloture, cours_ouverture, valeur_totale, nom...) qui ne
     correspondent pas au schéma réel de `cours` (cours, ouverture,
     valeur_transigee — sans nom) ; PostgREST rejette l'upsert entier
     dès qu'une colonne est inconnue. Cette table n'est lue nulle part
     dans le code (grep confirmé) : latestCours(), la seule source des
     cours affichés dans l'app, lit exclusivement `historique`. L'écrire
     n'apportait rien et bloquait la seule écriture qui compte. */
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

/* ── Annonces émetteurs (convocations AG, résultats, dividendes, avis...) ──
   Récupération volontairement bornée par appel (`limit`) : un backfill de
   plusieurs années sur six catégories peut représenter des centaines de PDF,
   au-delà du temps d'exécution d'une fonction Vercel. L'admin relance
   l'action autant que nécessaire ; chaque annonce déjà en base (par
   source_url, contrainte unique) est sautée, donc relancer ne duplique rien
   et reprend là où ça s'est arrêté. */
const ANNOUNCEMENTS_BUCKET = 'annonces-emetteurs';
const annSafeName = value => String(value || 'document.pdf')
  .normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/^\.+/, '').slice(0, 160) || 'document.pdf';

function announcementsPublicUrl(path) {
  if (!config.supabaseUrl) throw new Error('SUPABASE_URL non configurée');
  return `${config.supabaseUrl}/storage/v1/object/public/${ANNOUNCEMENTS_BUCKET}/${path}`;
}

function basenameOf(url) {
  try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || 'document.pdf'); }
  catch { return 'document.pdf'; }
}

async function existingSourceUrls(urls) {
  if (!urls.length) return new Set();
  const { data, error } = await supabaseAdmin.from('documents_emetteurs').select('source_url').in('source_url', urls);
  if (error) throw error;
  return new Set((data || []).map(r => r.source_url));
}

async function downloadAndStoreAnnouncement(row) {
  const response = await fetch(row.source_url, { headers: { 'User-Agent': 'Mozilla/5.0 TheCapitalInvest scraper' } });
  if (!response.ok) throw new Error(`PDF HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = annSafeName(basenameOf(row.source_url));
  const path = `${row.categorie}/${row.date_publication || 'sans-date'}/${Date.now()}_${filename}`;
  const { error: uploadError } = await supabaseAdmin.storage.from(ANNOUNCEMENTS_BUCKET).upload(path, buffer, {
    contentType: 'application/pdf', upsert: true
  });
  if (uploadError) throw uploadError;
  return { fichier_nom: filename, fichier_url: announcementsPublicUrl(path), taille_octets: buffer.length };
}

async function runAnnouncementsScrape({ categories, sinceYears, limit }) {
  const catList = categories?.length ? ANNOUNCEMENT_CATEGORIES.filter(c => categories.includes(c.slug)) : ANNOUNCEMENT_CATEGORIES;
  const { rows, errors: scrapeErrors } = await scrapeAnnouncements({ categories: catList, sinceYears });

  const known = await existingSourceUrls(rows.map(r => r.source_url));
  const fresh = rows.filter(r => !known.has(r.source_url));
  const batch = fresh.slice(0, limit);

  const reference = await loadEnterpriseReference();
  let imported = 0;
  const writeErrors = [];
  for (const row of batch) {
    try {
      const match = matchInstrument({ nom: row.societe_nom }, reference);
      const ticker = match.status === 'matched' ? match.record.ticker : null;
      const stored = await downloadAndStoreAnnouncement(row);
      const { error } = await supabaseAdmin.from('documents_emetteurs').upsert({
        ticker, societe_nom: row.societe_nom, categorie: row.categorie, titre: row.titre,
        date_publication: row.date_publication, source_url: row.source_url, ...stored
      }, { onConflict: 'source_url' });
      if (error) throw error;
      imported++;
    } catch (error) {
      writeErrors.push({ source_url: row.source_url, error: String(error?.message || error) });
    }
  }

  return {
    found: rows.length, already_stored: rows.length - fresh.length, imported,
    remaining: Math.max(0, fresh.length - batch.length), has_more: fresh.length > batch.length,
    scrape_errors: scrapeErrors, write_errors: writeErrors
  };
}

async function deleteAnnouncement(id) {
  const { data: doc, error: lookupError } = await supabaseAdmin.from('documents_emetteurs').select('fichier_url').eq('id', id).maybeSingle();
  if (lookupError) throw lookupError;
  if (!doc) return null;
  const marker = `/${ANNOUNCEMENTS_BUCKET}/`;
  const position = String(doc.fichier_url || '').indexOf(marker);
  if (position !== -1) {
    const path = doc.fichier_url.slice(position + marker.length);
    const { error: storageError } = await supabaseAdmin.storage.from(ANNOUNCEMENTS_BUCKET).remove([path]);
    if (storageError) console.warn('[PROCESS-BRVM] suppression stockage annonce :', storageError.message);
  }
  const { error } = await supabaseAdmin.from('documents_emetteurs').delete().eq('id', id);
  if (error) throw error;
  return id;
}

/* ── Évènements Sur Valeurs (ESV) : dividendes, coupons, fractionnements,
   augmentations/réductions de capital, fusions, consolidations, radiations.
   Même fichier que le reste (pas de nouvelle fonction serverless : le plan
   Hobby de ce projet plafonne à 12 fonctions par déploiement, déjà atteint),
   déclenché par scope:'esv' — POST (admin, backfill explicite) ou GET avec
   ?scope=esv (cron quotidien 18h Abidjan, secret machine ; le cron marché
   existant utilise la même route sans ce paramètre). */
const ESV_BUCKET = 'evenements-valeurs';
const ESV_DAILY_MAX_PAGES = 3;

const esvSafeName = value => String(value || 'document.pdf')
  .normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/^\.+/, '').slice(0, 160) || 'document.pdf';

function esvPublicUrl(path) {
  if (!config.supabaseUrl) throw new Error('SUPABASE_URL non configurée');
  return `${config.supabaseUrl}/storage/v1/object/public/${ESV_BUCKET}/${path}`;
}

/* Le numéro d'avis BRVM DG (ex. "avis_ndeg213") est une séquence unique tous
   types de notice confondus : quand il est présent, c'est un identifiant
   naturel bien plus fiable qu'un hachage de champs qui peuvent légitimement
   changer (une date de paiement reportée par exemple). */
function esvNaturalKey(row) {
  if (row.avis_numero) return `${row.categorie}:avis-${row.avis_numero}`;
  const basis = [
    row.categorie, row.emetteur, row.emetteur_absorbe, row.obligation,
    row.date_paiement, row.date_ex, row.date_evenement, row.montant_net, row.parite
  ].map(v => (v == null ? '' : String(v))).join('|');
  return `${row.categorie}:hash-${createHash('sha1').update(basis).digest('hex').slice(0, 16)}`;
}

async function downloadAndStoreEsv(url, prefix) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 TheCapitalInvest scraper' } });
  if (!response.ok) throw new Error(`PDF HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = esvSafeName(basenameOf(url));
  const path = `${prefix}/${Date.now()}_${filename}`;
  const { error } = await supabaseAdmin.storage.from(ESV_BUCKET).upload(path, buffer, {
    contentType: 'application/pdf', upsert: true
  });
  if (error) throw error;
  return esvPublicUrl(path);
}

async function safeEsvRunLog(payload) {
  try {
    const { error } = await supabaseAdmin.from('esv_scrape_runs').insert(payload);
    if (error) throw error;
  } catch (e) {
    console.warn('[PROCESS-BRVM] journal esv_scrape_runs indisponible :', e?.message || e);
  }
}

/* Champs comparés pour décider si une ligne déjà connue a changé.
   'raw' et les colonnes de suivi (natural_key, first/last_seen_at...) sont
   volontairement exclues : elles ne reflètent pas un changement de contenu. */
const ESV_TRACKED_FIELDS = [
  'categorie', 'emetteur_brvm', 'emetteur_absorbe', 'ticker', 'obligation', 'exercice',
  'date_paiement', 'date_ex', 'date_evenement', 'montant_net', 'parite', 'valeur_theorique',
  'nature_droit', 'periode_negociation', 'avis_url', 'avis_numero', 'communique_url'
];

async function runEsvSync({ sinceYears, maxPages, categories, downloadDocs }) {
  const startedAt = new Date().toISOString();
  const catList = categories?.length ? ESV_CATEGORIES.filter(c => categories.includes(c.categorie)) : ESV_CATEGORIES;
  const { rows, errors: scrapeErrors, hasMore } = await scrapeEsv({ categories: catList, sinceYears, maxPages });

  const reference = await loadEnterpriseReference();
  const keyed = rows.map(row => ({ ...row, natural_key: esvNaturalKey(row) }));
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
        try { avisStoredUrl = await downloadAndStoreEsv(row.avis_url, `${row.categorie}/avis`); }
        catch (e) { docErrors.push({ natural_key: row.natural_key, doc: 'avis', error: String(e?.message || e) }); }
      }
      if (row.communique_url && !communiqueStoredUrl) {
        try { communiqueStoredUrl = await downloadAndStoreEsv(row.communique_url, `${row.categorie}/communique`); }
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

    const changed = ESV_TRACKED_FIELDS.some(k => String(fields[k] ?? '') !== String(existing[k] ?? ''));
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
  await safeEsvRunLog({ started_at: startedAt, finished_at: new Date().toISOString(), status: 'success', result });
  return result;
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
    // Marché obligataire : chemin distinct du pipeline actions, déclenché par
    // POST { scope: 'obligations' } (admin ou machine). Écriture par upsert
    // dans `obligations` (clé code) et `obligations_marche` (clé date).
    if (req.method === 'POST') {
      const body = await readBody(req).catch(() => ({}));
      if (body && body.scope === 'obligations') {
        let scraped;
        try {
          scraped = await scrapeBrvmObligations(body.date || body.date_seance);
        } catch (e) {
          console.error('[PROCESS-BRVM] obligations source', e);
          return json(res, 502, { success: false, error: 'Source BRVM obligations illisible.', code: 'BRVM_SOURCE_ERROR' });
        }
        const now = new Date().toISOString();
        const rows = scraped.rows.map(r => ({ ...r, updated_at: now }));
        const { error: e1 } = await supabaseAdmin.from('obligations').upsert(rows, { onConflict: 'code' });
        if (e1) throw e1;
        const { error: e2 } = await supabaseAdmin
          .from('obligations_marche').upsert({ ...scraped.marche, updated_at: now }, { onConflict: 'date_seance' });
        if (e2) throw e2;
        return json(res, 200, {
          success: true, scope: 'obligations',
          date_seance: scraped.date_seance, lignes: rows.length, marche: scraped.marche
        });
      }

      // Annonces émetteurs (convocations AG, résultats, dividendes, avis...) :
      // POST { scope:'announcements', categories?, sinceYears?, limit? } déclenche
      // une récupération bornée ; POST { scope:'announcements', action:'delete', id }
      // retire un document (admin uniquement — pas de secret machine ici, ce
      // flux n'a pas vocation à tourner sur cron pour l'instant).
      if (body && body.scope === 'announcements') {
        if (body.action === 'delete') {
          const id = String(body.id || '');
          if (!id) return fail(res, 400, 'Identifiant requis.', 'INVALID_ID');
          const removed = await deleteAnnouncement(id);
          if (!removed) return fail(res, 404, 'Document introuvable.', 'NOT_FOUND');
          return json(res, 200, { success: true, scope: 'announcements', action: 'delete', id: removed });
        }
        const result = await runAnnouncementsScrape({
          categories: Array.isArray(body.categories) ? body.categories : null,
          sinceYears: Number.isFinite(Number(body.sinceYears)) ? Number(body.sinceYears) : 5,
          limit: Math.min(100, Number(body.limit) || 40)
        });
        return json(res, 200, { success: true, scope: 'announcements', ...result });
      }

      // Évènements sur valeurs (ESV) : POST { scope:'esv', categories?,
      // sinceYears?, maxPages?, downloadDocs? } déclenche un backfill explicite
      // depuis l'admin. Le passage automatique quotidien passe par le GET
      // ?scope=esv plus bas (secret machine), avec des pages bornées bas.
      if (body && body.scope === 'esv') {
        try {
          const result = await runEsvSync({
            sinceYears: Number(body.sinceYears) || 5,
            maxPages: Math.min(60, Number(body.maxPages) || 15),
            categories: Array.isArray(body.categories) ? body.categories : null,
            downloadDocs: body.downloadDocs !== false
          });
          return json(res, 200, { success: true, scope: 'esv', ...result });
        } catch (error) {
          console.error('[PROCESS-BRVM] esv', error);
          await safeEsvRunLog({
            started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
            status: 'error', error: String(error?.message || error)
          });
          return json(res, 502, { success: false, error: 'Synchronisation ESV impossible.', code: 'ESV_SYNC_ERROR' });
        }
      }

      // Publication d'un reporting sur le site public (/reporting.html) :
      // POST { scope:'reporting', action:'publish', periode, window_from,
      // window_to, payload }. Toujours réservé à un administrateur — jamais
      // au secret machine, ce chemin n'a pas vocation à tourner sur cron.
      // Une ligne par (periode, window_to) : republier remplace la
      // publication précédente au lieu d'empiler des doublons.
      if (body && body.scope === 'reporting') {
        if (!admin) return fail(res, 403, 'Accès administrateur requis.', 'ADMIN_REQUIRED');
        if (body.action !== 'publish') return fail(res, 400, 'Action de reporting inconnue.', 'UNKNOWN_ACTION');
        const periode = String(body.periode || '');
        if (!['seance', 'hebdo', 'mensuel', 'trimestre', 'annuel'].includes(periode)) {
          return fail(res, 400, 'Période invalide.', 'INVALID_PERIODE');
        }
        const windowFrom = String(body.window_from || '');
        const windowTo = String(body.window_to || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(windowFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(windowTo)) {
          return fail(res, 400, 'Fenêtre de dates invalide.', 'INVALID_WINDOW');
        }
        if (!body.payload || typeof body.payload !== 'object') {
          return fail(res, 400, 'Contenu du reporting manquant.', 'INVALID_PAYLOAD');
        }
        const { data, error } = await supabaseAdmin.from('published_reportings')
          .upsert({
            periode, window_from: windowFrom, window_to: windowTo,
            payload: body.payload, published_by: admin.id, published_at: new Date().toISOString()
          }, { onConflict: 'periode,window_to' })
          .select().single();
        if (error) throw error;
        return json(res, 200, { success: true, scope: 'reporting', action: 'publish', data });
      }

      // Déclencheur d'import automatique (pg_cron Supabase, toutes les 30 min
      // en séance). Ne fait rien si le mode n'est pas « auto » — l'interrupteur
      // reste maître. Importe les obligations (non bloquant) puis les actions.
      if (machine && body && body.scope === 'auto') {
        const cfg = await getSetting();
        if (cfg.mode !== 'auto') {
          return json(res, 200, { success: true, skipped: true, reason: 'automatic_processing_disabled' });
        }
        try {
          const s = await scrapeBrvmObligations();
          const now = new Date().toISOString();
          await supabaseAdmin.from('obligations').upsert(s.rows.map(r => ({ ...r, updated_at: now })), { onConflict: 'code' });
          await supabaseAdmin.from('obligations_marche').upsert({ ...s.marche, updated_at: now }, { onConflict: 'date_seance' });
        } catch (e) {
          console.warn('[PROCESS-BRVM] auto obligations non bloquant :', e && e.message);
        }
        return await runPipeline(res, cfg.mode);
      }
    }

    // Évènements sur valeurs (ESV) : GET ?scope=esv, distinct du cron marché
    // ci-dessous qui utilise la même route sans ce paramètre. Le cron Vercel
    // quotidien (18h Abidjan) pointe vers /api/process-brvm?scope=esv avec le
    // secret machine ; ?scope=esv&action=runs (admin) lit le journal des
    // passages sans en déclencher un nouveau.
    const url = requestUrl(req);
    if (req.method === 'GET' && url.searchParams.get('scope') === 'esv') {
      if (url.searchParams.get('action') === 'runs') {
        if (!admin) return fail(res, 403, 'Accès administrateur requis.', 'ADMIN_REQUIRED');
        const { data, error } = await supabaseAdmin.from('esv_scrape_runs')
          .select('*').order('started_at', { ascending: false }).limit(20);
        if (error) return fail(res, 500, 'Lecture du journal impossible.', 'RUNS_READ_ERROR', error);
        return json(res, 200, { success: true, runs: data || [] });
      }
      try {
        const result = await runEsvSync({
          sinceYears: 5, maxPages: machine ? ESV_DAILY_MAX_PAGES : 15,
          categories: null, downloadDocs: true
        });
        return json(res, 200, { success: true, scope: 'esv', ...result });
      } catch (error) {
        console.error('[PROCESS-BRVM] esv', error);
        await safeEsvRunLog({
          started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
          status: 'error', error: String(error?.message || error)
        });
        return json(res, 502, { success: false, error: 'Synchronisation ESV impossible.', code: 'ESV_SYNC_ERROR' });
      }
    }

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
