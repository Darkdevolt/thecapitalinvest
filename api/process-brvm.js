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
import { scrapeBrvm, fetchHtml } from '../lib/brvm-scraper.js';
import { scrapeBrvmObligations } from '../lib/brvm-obligations-scraper.js';
import { scrapeAnnouncements, CATEGORIES as ANNOUNCEMENT_CATEGORIES } from '../lib/brvm-announcements-scraper.js';
import { scrapeEsv, CATEGORIES as ESV_CATEGORIES } from '../lib/brvm-esv-scraper.js';
import { scrapeRapports } from '../lib/brvm-rapports-scraper.js';
import { listDcbrFiches, fetchDcbrFicheDetails } from '../lib/dcbr-scraper.js';
import { matchInstrument, normalizeTicker } from '../lib/market-instrument-matcher.js';
import { authenticateAdmin, isMachineRequest, handlePreflight } from '../lib/middleware.js';
import { looksLikeGithubOidc, verifyGithubOidc } from '../lib/github-oidc.js';
import { ingestBoc, bocTelegramText, bocPublicUrl } from '../lib/boc-extract.js';
import { json, fail, readBody, requestUrl } from '../lib/http.js';
import appConfig from '../lib/config.js';

/* Plafond Hobby Vercel (défaut sans config : 10 s, largement insuffisant dès
   qu'un scope lit plusieurs dizaines de pages une par une — constaté sur
   scope 'dcbr' : "signal is aborted without reason" après un lot de fiches
   trop grand). S'applique à tous les scopes de ce fichier. */
export const config = { maxDuration: 60 };

/** Variation maximale autorisée sur une séance, en pourcentage. */
const VARIATION_LIMIT = 7.5;
/* Écart toléré entre la variation publiée et la variation recalculée. Le
   cours de référence utilisé par BRVM pour publier sa propre variation peut
   différer légèrement de notre dernière clôture enregistrée (suspension
   temporaire, bulletin pas encore stabilisé en cours de séance...) — un
   écart courant de bruit, pas une anomalie de saisie. 0,25 % s'est révélé
   bien trop strict en pratique : constaté en production le 2026-09-18, où
   près de la moitié des titres d'une séance parfaitement normale (aucun
   dépassement de VARIATION_LIMIT) étaient rejetés en bloc pour des écarts
   de l'ordre de 0,3 à 1,5 point, retardant toute la séance de plusieurs
   heures alors que rien n'était réellement anormal. */
const VARIATION_TOLERANCE = 1.5;
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

/**
 * Détachements de dividende tombant sur la séance traitée : le cours recule
 * mécaniquement du montant distribué, ce qui n'a rien d'une anomalie de
 * cotation. `dividendes_calendrier` porte l'un ou l'autre des deux noms de
 * colonne pour la date de détachement selon la façon dont la ligne a été
 * saisie (import historique vs saisie admin) ; les deux sont donc lues.
 */
async function exDividendAmounts(tickers, sessionDate) {
  if (!tickers.length) return new Map();
  const { data, error } = await supabaseAdmin
    .from('dividendes_calendrier')
    .select('ticker,montant,montant_net,ex_date,date_detachement')
    .in('ticker', tickers);
  if (error) {
    console.warn('[BRVM] dividendes_calendrier illisible, contrôle de variation sans exception ex-dividende :', error.message);
    return new Map();
  }
  const map = new Map();
  for (const row of data || []) {
    const exDate = row.ex_date || row.date_detachement;
    if (exDate !== sessionDate) continue;
    const montant = Number(row.montant ?? row.montant_net);
    if (Number.isFinite(montant) && montant > 0) map.set(row.ticker, montant);
  }
  return map;
}

async function validateVariations(rows) {
  const violations = [];
  const sessionDate = rows[0]?.date_seance;
  if (!sessionDate) return violations;

  const tickers = [...new Set(rows.map(r => r.ticker))];
  const previous = await previousCloses(tickers, sessionDate);
  const exDividend = await exDividendAmounts(tickers, sessionDate);
  const previousSessionDate = [...previous.values()]
    .map(p => p.date).filter(Boolean).sort().reverse()[0] || null;

  for (const row of rows) {
    const prev = previous.get(row.ticker);
    const prevCloseRaw = prev ? prev.close : NaN;
    const close = Number(row.cours_cloture);
    const reported = row.variation == null ? null : Number(row.variation);

    const dividende = exDividend.get(row.ticker);
    const exDividende = Number.isFinite(dividende) && dividende > 0;
    /* Référence ex-dividende : le cours de la veille diminué du montant
       distribué. Sans ce recalage, une action à bon rendement détachant
       son dividende franchirait systématiquement le seuil de variation, et
       bloquerait l'écriture de toute la séance pour un mouvement attendu. */
    const prevClose = exDividende && Number.isFinite(prevCloseRaw) ? prevCloseRaw - dividende : prevCloseRaw;
    const computed = (Number.isFinite(prevClose) && prevClose > 0 && Number.isFinite(close))
      ? ((close - prevClose) / prevClose) * 100
      : null;
    /* La variation publiée par BRVM reste toujours brute (non ajustée du
       dividende) : sur un jour de détachement, elle ne dit rien d'une
       anomalie et on lui préfère notre propre calcul, rapporté à la
       référence ex-dividende. */
    const effective = exDividende ? computed : (Number.isFinite(reported) ? reported : computed);

    if (Number.isFinite(effective) && Math.abs(effective) > VARIATION_LIMIT + 1e-9) {
      violations.push({
        ticker: row.ticker, date: row.date_seance, variation: effective,
        previous_close: Number.isFinite(prevClose) ? prevClose : null, close,
        type: 'variation_hors_limite',
        ...(exDividende ? { ex_dividende: dividende } : {})
      });
    }

    // La comparaison publié / recalculé n'a de sens que si le cours de
    // référence est bien celui de la séance immédiatement précédente, et
    // seulement hors détachement : brut contre ajusté divergeraient sinon
    // systématiquement d'environ le montant du dividende.
    if (!exDividende && prev && prev.date === previousSessionDate
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
  if (!appConfig.supabaseUrl) throw new Error('SUPABASE_URL non configurée');
  return `${appConfig.supabaseUrl}/storage/v1/object/public/${ANNOUNCEMENTS_BUCKET}/${path}`;
}

function basenameOf(url) {
  try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || 'document.pdf'); }
  catch { return 'document.pdf'; }
}

/* Lecture par paquets d'un filtre in.(...) : des centaines de valeurs dans
   une seule requête dépassent la longueur d'URL admise par l'API Supabase
   (« Bad Request »), constaté au premier passage du scope 'rapports' le
   2026-09-24. */
async function selectIn(table, columns, column, values, size = 40) {
  const unique = [...new Set(values.filter(v => v != null))];
  const out = [];
  for (let i = 0; i < unique.length; i += size) {
    const { data, error } = await supabaseAdmin.from(table).select(columns).in(column, unique.slice(i, i + size));
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
}

async function existingSourceUrls(urls) {
  const rows = await selectIn('documents_emetteurs', 'source_url', 'source_url', urls);
  return new Set(rows.map(r => r.source_url));
}

async function downloadAndStoreAnnouncement(row) {
  const response = await fetch(row.source_url, {
    headers: { 'User-Agent': 'Mozilla/5.0 TheCapitalInvest scraper' }, signal: AbortSignal.timeout(15000)
  });
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
  if (!appConfig.supabaseUrl) throw new Error('SUPABASE_URL non configurée');
  return `${appConfig.supabaseUrl}/storage/v1/object/public/${ESV_BUCKET}/${path}`;
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

async function safeDcbrRunLog(payload) {
  try {
    const { error } = await supabaseAdmin.from('dcbr_scrape_runs').insert(payload);
    if (error) throw error;
  } catch (e) {
    console.warn('[PROCESS-BRVM] journal dcbr_scrape_runs indisponible :', e?.message || e);
  }
}

/**
 * Écrit une extraction obligataire. Les erreurs d'upsert sont remontées (un
 * passage n'est journalisé « success » que si les données sont réellement
 * écrites). En repli BFIN, `obligations_marche` n'est pas touché : cette
 * source ne donne ni valeur des transactions ni capitalisations, et un upsert
 * de null écraserait les agrégats déjà connus pour la séance.
 */
async function persistObligations(scraped) {
  const now = new Date().toISOString();
  const { error: e1 } = await supabaseAdmin.from('obligations')
    .upsert(scraped.rows.map(r => ({ ...r, updated_at: now })), { onConflict: 'code' });
  if (e1) throw e1;
  if (!scraped.fallback) {
    const { error: e2 } = await supabaseAdmin.from('obligations_marche')
      .upsert({ ...scraped.marche, updated_at: now }, { onConflict: 'date_seance' });
    if (e2) throw e2;
  }
}

async function safeObligationsRunLog(payload) {
  try {
    const { error } = await supabaseAdmin.from('obligations_scrape_runs').insert(payload);
    if (error) throw error;
  } catch (e) {
    console.warn('[PROCESS-BRVM] journal obligations_scrape_runs indisponible :', e?.message || e);
  }
}

/* ── Rapports des sociétés cotées (états financiers, rapports d'activités) ──
   Même stockage que les annonces (documents_emetteurs + bucket), avec en plus
   la période couverte (exercice, periode) pour savoir quels comptes publiés
   ne sont pas encore chiffrés dans `financials` (veille Telegram). Bornée par
   `limit` et par un budget de temps : chaque passage reprend là où le
   précédent s'est arrêté (source_url unique), rien n'est dupliqué. */
const RAPPORTS_TIME_BUDGET_MS = 38000;
// Lecture des listes d'émetteurs bornée à 22 s ; le point de départ tourne
// toutes les 10 min pour que des passages successifs couvrent tout le monde.
const RAPPORTS_SCRAPE_BUDGET_MS = 22000;

async function runRapportsSync({ sinceYears, limit, maxPages }) {
  const started = Date.now();
  const { rows, errors: scrapeErrors, skipped } = await scrapeRapports({
    sinceYears, maxPages, concurrency: 6,
    deadline: started + RAPPORTS_SCRAPE_BUDGET_MS,
    startOffset: Math.floor(started / 600000) * 6
  });
  const known = await existingSourceUrls(rows.map(r => r.source_url));
  // Les plus récents d'abord : un nouveau rapport passe avant l'historique.
  const fresh = rows.filter(r => !known.has(r.source_url))
    .sort((a, b) => String(b.date_publication || '').localeCompare(String(a.date_publication || '')));
  const batch = fresh.slice(0, limit);

  let imported = 0;
  const writeErrors = [];
  const importedDocs = [];
  let next = 0;
  async function worker() {
    while (next < batch.length && Date.now() - started < RAPPORTS_TIME_BUDGET_MS) {
      const row = batch[next++];
      try {
        const stored = await downloadAndStoreAnnouncement(row);
        const { error } = await supabaseAdmin.from('documents_emetteurs').upsert({
          ticker: row.ticker, societe_nom: row.societe_nom, categorie: row.categorie, titre: row.titre,
          date_publication: row.date_publication, source_url: row.source_url,
          exercice: row.annee || null, periode: row.periode || null, ...stored
        }, { onConflict: 'source_url', ignoreDuplicates: true });
        if (error) throw error;
        imported++;
        importedDocs.push({ ticker: row.ticker, titre: row.titre, periode: row.periode, exercice: row.annee });
      } catch (error) {
        writeErrors.push({ source_url: row.source_url, error: String(error?.message || error) });
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));

  return {
    found: rows.length, already_stored: rows.length - fresh.length, imported,
    remaining: Math.max(0, fresh.length - imported), has_more: fresh.length > imported,
    imported_docs: importedDocs.slice(0, 30), scrape_errors: scrapeErrors, write_errors: writeErrors,
    emetteurs_reportes: skipped.length
  };
}

async function safeRapportsRunLog(payload) {
  try {
    const { error } = await supabaseAdmin.from('rapports_scrape_runs').insert(payload);
    if (error) throw error;
  } catch (e) {
    console.warn('[PROCESS-BRVM] journal rapports_scrape_runs indisponible :', e?.message || e);
  }
}

/* ── Bulletins Officiels de la Cote (BOC) ──
   Deux sources, de la plus rapide à la plus lente :
   1. bfin.brvm.org/boc/boc_jour.aspx — page légère (≈2 s), BOC_AAAAMMJJ.pdf,
      le bulletin du jour y apparaît en fin d'après-midi ;
   2. brvm.org/fr/bulletins-officiels-de-la-cote — boc_AAAAMMJJ_N.pdf, très
      lente pendant la séance ; consultée seulement pour les dates que la
      première source n'a pas (ou si elle est indisponible).
   On copie dans le bucket boc_pdfs (même emplacement que l'import manuel de
   l'admin) chaque bulletin absent de la table boc ; une séance déjà
   enregistrée n'est jamais remplacée. Un bulletin pèse ~20 Mo (≈15-20 s de
   téléchargement) : budget de temps pour rester sous les 60 s de Vercel. */
const BOC_SOURCES = [
  { list: 'https://bfin.brvm.org/boc/boc_jour.aspx', base: 'https://bfin.brvm.org/boc/',
    re: /href="([^"]*BOC_(20\d{2})(\d{2})(\d{2})(?:_(\d+))?\.pdf)"/gi, timeoutMs: 15000 },
  { list: 'https://www.brvm.org/fr/bulletins-officiels-de-la-cote', base: 'https://www.brvm.org',
    re: /href="([^"]*\/boc_(20\d{2})(\d{2})(\d{2})_(\d+)\.pdf)"/gi, timeoutMs: 25000 }
];
const BOC_BUCKET = 'boc_pdfs';
const BOC_TIME_BUDGET_MS = 28000;

function bocUrl(href, base) {
  if (/^https?:/i.test(href)) return href;
  return href.startsWith('/') ? new URL(href, base).href : base + href;
}

async function listBocSource(src) {
  const html = await fetchHtml(src.list, { timeoutMs: src.timeoutMs });
  const seen = new Map();
  for (const m of html.matchAll(src.re)) {
    const date = `${m[2]}-${m[3]}-${m[4]}`;
    const n = Number(m[5] || 0);
    // Plusieurs versions d'un même jour : la plus haute (dernier rectificatif) l'emporte.
    const prev = seen.get(date);
    if (!prev || n > prev.n) seen.set(date, { url: bocUrl(m[1], src.base), n });
  }
  return seen;
}

async function runBocSync({ limit }) {
  const started = Date.now();
  const seen = new Map();
  const sourceErrors = [];
  let have = null;
  for (const [i, src] of BOC_SOURCES.entries()) {
    try {
      for (const [date, v] of await listBocSource(src)) if (!seen.has(date)) seen.set(date, v);
    } catch (e) {
      sourceErrors.push({ source: src.list, error: String(e?.message || e) });
    }
    // La source rapide suffit dès qu'elle répond : brvm.org n'est lue qu'en secours.
    if (i === 0 && seen.size) {
      const dates = [...seen.keys()];
      const { data, error } = await supabaseAdmin.from('boc').select('date_seance').in('date_seance', dates);
      if (error) throw error;
      have = new Set((data || []).map(r => String(r.date_seance).slice(0, 10)));
      break;
    }
  }
  const dates = [...seen.keys()].sort().reverse();
  if (!dates.length) {
    if (sourceErrors.length) throw new Error(`BOC indisponible : ${sourceErrors.map(e => e.error).join(' ; ')}`);
    return { found: 0, imported: 0, errors: [] };
  }
  if (!have) {
    const { data, error } = await supabaseAdmin.from('boc').select('date_seance').in('date_seance', dates);
    if (error) throw error;
    have = new Set((data || []).map(r => String(r.date_seance).slice(0, 10)));
  }
  const todo = dates.filter(d => !have.has(d)).slice(0, limit);
  const errors = [];
  let imported = 0;
  const importedDates = [];
  for (const date of todo) {
    if (Date.now() - started > BOC_TIME_BUDGET_MS) break;
    const { url } = seen.get(date);
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 TheCapitalInvest scraper' },
        signal: AbortSignal.timeout(Math.max(10000, 55000 - (Date.now() - started) - 8000))
      });
      if (!resp.ok) throw new Error(`PDF HTTP ${resp.status}`);
      const buffer = Buffer.from(await resp.arrayBuffer());
      if (buffer.subarray(0, 5).toString() !== '%PDF-') throw new Error('réponse non PDF');
      const filename = annSafeName(basenameOf(url));
      const path = `${date}/${Date.now()}_${filename}`;
      const { error: upErr } = await supabaseAdmin.storage.from(BOC_BUCKET).upload(path, buffer, { contentType: 'application/pdf', upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabaseAdmin.from('boc').insert({
        date_seance: date, fichier_nom: filename,
        fichier_url: `${appConfig.supabaseUrl}/storage/v1/object/public/${BOC_BUCKET}/${path}`
      });
      if (insErr) throw insErr;
      imported++;
      importedDates.push(date);
    } catch (e) {
      errors.push({ date, error: String(e?.message || e) });
    }
  }
  const remaining = dates.filter(d => !have.has(d)).length - imported;
  return { found: dates.length, already_stored: have.size, imported, imported_dates: importedDates,
    remaining, has_more: remaining > 0, errors, source_errors: sourceErrors };
}

/* ── Lecture automatique des BOC (tableaux de résultats des émetteurs) ──
   action 'pending' : BOC des 10 derniers jours pas encore analysés (ou en
   échec, 3 essais au plus) ; action 'ingest' : intègre les candidats lus
   par scripts/boc_extract.py (voir lib/boc-extract.js), journalise dans
   boc_extractions et envoie le récapitulatif Telegram. */
const BOC_OIDC = {
  audience: 'thecapitalinvest-boc',
  repository: 'Darkdevolt/thecapitalinvest',
  ref: 'refs/heads/main',
  workflow: '.github/workflows/boc-extract.yml'
};

async function runBocExtract(body) {
  if (body.action === 'pending') {
    const since = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    const { data: bocs, error } = await supabaseAdmin.from('boc')
      .select('date_seance, fichier_url').gte('date_seance', since).order('date_seance', { ascending: false });
    if (error) throw error;
    const dates = (bocs || []).map(b => String(b.date_seance).slice(0, 10));
    const { data: done, error: e2 } = dates.length
      ? await supabaseAdmin.from('boc_extractions').select('date_seance, status, attempts').in('date_seance', dates)
      : { data: [] };
    if (e2) throw e2;
    const state = new Map((done || []).map(d => [String(d.date_seance).slice(0, 10), d]));
    const pending = (bocs || []).filter(b => {
      const st = state.get(String(b.date_seance).slice(0, 10));
      return !st || (st.status !== 'done' && (st.attempts || 0) < 3);
    }).slice(0, 3).map(b => {
      const date = String(b.date_seance).slice(0, 10);
      // Édition bfin.brvm.org d'abord : celle de brvm.org (anciennes copies en
      // base) est parfois publiée sans les annexes des émetteurs.
      return { date_seance: date, fichier_url: bocPublicUrl(date), urls: [bocPublicUrl(date), b.fichier_url].filter(Boolean) };
    });
    return { pending };
  }
  if (body.action === 'ingest') {
    const bocDate = String(body.date_seance || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bocDate)) throw new Error('date_seance invalide');
    const candidates = Array.isArray(body.candidates) ? body.candidates.slice(0, 60) : [];
    const { data: prev } = await supabaseAdmin.from('boc_extractions').select('attempts').eq('date_seance', bocDate).maybeSingle();
    const attempts = (prev?.attempts || 0) + 1;
    let result;
    try {
      result = await ingestBoc(supabaseAdmin, {
        bocDate, pagesTotal: Number(body.pages_total) || null, pagesScanned: Number.isFinite(Number(body.pages_scanned)) ? Number(body.pages_scanned) : null, candidates
      });
    } catch (error) {
      await supabaseAdmin.from('boc_extractions').upsert({
        date_seance: bocDate, status: 'error', attempts, error: String(error?.message || error), updated_at: new Date().toISOString()
      }, { onConflict: 'date_seance' });
      throw error;
    }
    const message = bocTelegramText({
      bocDate, pagesTotal: body.pages_total, pagesScanned: body.pages_scanned,
      inserted: result.inserted, promotions: result.promoted, report: result.report
    });
    const { error: logErr } = await supabaseAdmin.from('boc_extractions').upsert({
      date_seance: bocDate, status: 'done', attempts, error: null,
      pages_total: Number(body.pages_total) || null, pages_scanned: Number.isFinite(Number(body.pages_scanned)) ? Number(body.pages_scanned) : null,
      candidates: candidates.length, inserted: result.inserted.length, promoted: result.promoted.length,
      result: { ...result, source_url: bocPublicUrl(bocDate) }, message, updated_at: new Date().toISOString()
    }, { onConflict: 'date_seance' });
    if (logErr) console.warn('[PROCESS-BRVM] journal boc_extractions :', logErr.message);
    // Telegram seulement si le BOC apporte quelque chose (ou signale un problème).
    const worth = result.inserted.length || result.promoted.length || result.errors.length ||
      result.report.some(r => ['mismatch', 'review_needed'].includes(r.status));
    if (worth) {
      const { error: tgErr } = await supabaseAdmin.rpc('tc_send_telegram', { msg: message });
      if (tgErr) console.warn('[PROCESS-BRVM] Telegram BOC :', tgErr.message);
    }
    return { date_seance: bocDate, message, ...result };
  }
  throw new Error('action inconnue');
}

async function safeAnnouncementsRunLog(payload) {
  try {
    const { error } = await supabaseAdmin.from('announcements_scrape_runs').insert(payload);
    if (error) throw error;
  } catch (e) {
    console.warn('[PROCESS-BRVM] journal announcements_scrape_runs indisponible :', e?.message || e);
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

  const existingRows = await selectIn('evenements_valeurs', '*', 'natural_key', uniqueRows.map(r => r.natural_key));
  const existingByKey = new Map((existingRows || []).map(r => [r.natural_key, r]));

  let created = 0, updated = 0, unchanged = 0;
  const docErrors = [];
  const rowErrors = [];
  const now = new Date().toISOString();

  /* Chaque ligne est isolée dans son propre try/catch et écrite par upsert
     (on_conflict natural_key) plutôt que par un SELECT préalable suivi d'un
     INSERT/UPDATE séparé : deux déclenchements concurrents (double clic sur
     « Récupérer », ou le cron qui chevauche un lancement manuel) ne peuvent
     plus se marcher dessus avec une erreur de clé dupliquée — Postgres gère
     le conflit de façon atomique. Et une ligne à part (ex. une incohérence
     de dates qui viole la contrainte de cohérence) est simplement écartée
     et signalée dans row_errors, au lieu de faire échouer tout le lot :
     avant ce correctif, une seule ligne à problème annulait la totalité de
     la récupération et donnait l'impression qu'il fallait tout revalider. */
  for (const row of uniqueRows) {
    try {
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

      // La BRVM a déjà publié au moins un avis coupon avec une date ex
      // postérieure à la date de paiement. Le schéma applique volontairement
      // une contrainte date_ex <= date_paiement. On conserve la donnée brute
      // dans raw mais neutralisons uniquement le champ incohérent afin qu'un
      // avis isolé ne bloque pas toute la synchronisation ESV.
      const rawRow = { ...row };
      let datePaiement = row.date_paiement || null;
      let dateEx = row.date_ex || null;
      if (datePaiement && dateEx && dateEx > datePaiement) {
        rawRow.data_quality_warning = 'date_ex_after_date_paiement';
        rawRow.original_date_ex = dateEx;
        dateEx = null;
      }

      const fields = {
        categorie: row.categorie,
        emetteur_brvm: row.emetteur || null,
        emetteur_absorbe: row.emetteur_absorbe || null,
        ticker,
        obligation: row.obligation || null,
        exercice: row.exercice ? parseInt(row.exercice, 10) : null,
        date_paiement: datePaiement,
        date_ex: dateEx,
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
        raw: rawRow
      };

      const changed = existing
        ? ESV_TRACKED_FIELDS.some(k => String(fields[k] ?? '') !== String(existing[k] ?? ''))
        : true;

      const { error } = await supabaseAdmin.from('evenements_valeurs').upsert({
        ...fields,
        natural_key: row.natural_key,
        first_seen_at: existing?.first_seen_at || now,
        last_seen_at: now,
        last_changed_at: changed ? now : (existing?.last_changed_at || now),
        updated_at: now
      }, { onConflict: 'natural_key' });
      if (error) throw error;

      if (!existing) created++;
      else if (changed) updated++;
      else unchanged++;
    } catch (error) {
      rowErrors.push({
        natural_key: row.natural_key, categorie: row.categorie,
        emetteur: row.emetteur || row.emetteur_absorbe || null,
        error: String(error?.message || error)
      });
    }
  }

  const result = {
    total: uniqueRows.length, created, updated, unchanged,
    scrape_errors: scrapeErrors, doc_errors: docErrors, row_errors: rowErrors, has_more: hasMore
  };
  await safeEsvRunLog({
    started_at: startedAt, finished_at: new Date().toISOString(),
    status: rowErrors.length ? 'partial' : 'success', result
  });
  return result;
}

/* ── DC/BR : fiches techniques d'emprunts obligataires (ISIN, caractéristiques
   d'émission), cotées et non cotées. Déclenché par scope:'dcbr' — POST admin
   uniquement, pas de cron : ces fiches changent rarement (une par émission,
   pas par séance), contrairement au marché ou aux ESV. Même fichier que le
   reste pour ne pas dépasser la limite Hobby de fonctions serverless. */
const DCBR_TRACKED_FIELDS = [
  'designation', 'symbole', 'isin', 'code_obligation', 'raison_sociale_emetteur',
  'capital_social', 'registre_commerce', 'siege_social', 'telephone_emetteur',
  'registraire', 'registraire_coordonnees', 'personne_ressource', 'nature_titres',
  'marche_secondaire', 'montant_indicatif', 'montant_effectif', 'valeur_nominale',
  'nombre_titres', 'prix_emission', 'date_jouissance', 'taux_brut', 'taux_net',
  'montant_coupon_brut', 'montant_coupon_net', 'modalite_paiement', 'duree',
  'mode_remboursement', 'prix_remboursement'
];

function normalizeBondText(v) {
  return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

/** Rapprochement au code `obligations` (cours BRVM) par le nom, en best-effort :
    les deux sources n'utilisent pas la même nomenclature de code, seul le nom
    de l'émission est comparable. Laisse null plutôt que de deviner en cas
    d'ambiguïté (plusieurs candidats, ou aucun). */
function matchBondCode(designation, obligationsRef) {
  const norm = normalizeBondText(designation);
  if (!norm) return null;
  const candidates = obligationsRef.filter(o => {
    const on = normalizeBondText(o.nom);
    return on && (norm.includes(on) || on.includes(norm));
  });
  return candidates.length === 1 ? candidates[0].code : null;
}

async function runDcbrSync({ categories, maxPages, limit }) {
  const startedAt = new Date().toISOString();
  const cats = categories?.length ? categories : ['cotee', 'non_cotee'];

  const { data: obligationsRef, error: refError } = await supabaseAdmin.from('obligations').select('code,nom');
  if (refError) throw refError;

  /* Ces fiches ne changent quasiment jamais une fois publiées (une par
     émission, pas par séance) : on ne relit donc que celles jamais vues.
     Lire les ~130+ fiches une par une, séquentiellement, dépassait très
     largement le temps d'exécution d'une fonction serverless — constaté en
     production ("signal is aborted without reason"). La liste (légère) est
     toujours entièrement parcourue pour repérer les nouveautés ; seul le
     détail (un aller-retour par fiche) est borné par `limit` et lu en
     parallèle, avec reprise (« Continuer ») pour le reste. */
  const scrapeErrors = [];
  const hasMoreListing = {};
  const freshByCategorie = {};
  let totalFound = 0;
  let alreadyStored = 0;

  for (const categorie of cats) {
    let listing;
    try {
      listing = await listDcbrFiches({ categorie, maxPages });
    } catch (error) {
      scrapeErrors.push({ categorie, error: String(error?.message || error) });
      continue;
    }
    hasMoreListing[categorie] = listing.hasMore;
    totalFound += listing.links.length;

    const known = await selectIn('obligations_caracteristiques', 'source_url', 'source_url', listing.links.map(l => l.url));
    const knownUrls = new Set(known.map(r => r.source_url));
    const fresh = listing.links.filter(l => !knownUrls.has(l.url));
    alreadyStored += listing.links.length - fresh.length;
    freshByCategorie[categorie] = fresh;
  }

  const allFresh = Object.entries(freshByCategorie).flatMap(([categorie, links]) => links.map(l => ({ ...l, categorie })));
  const batch = allFresh.slice(0, limit);
  const remaining = Math.max(0, allFresh.length - batch.length);

  let allRows = [];
  for (const categorie of cats) {
    const links = batch.filter(l => l.categorie === categorie);
    if (!links.length) continue;
    const result = await fetchDcbrFicheDetails(links, categorie, 6);
    allRows.push(...result.rows);
    scrapeErrors.push(...result.errors.map(e => ({ ...e, categorie })));
  }

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from('obligations_caracteristiques').select('*').in('source_url', allRows.map(r => r.source_url));
  if (existingError) throw existingError;
  const existingByUrl = new Map((existingRows || []).map(r => [r.source_url, r]));

  let created = 0, updated = 0, unchanged = 0;
  const rowErrors = [];
  const now = new Date().toISOString();

  for (const row of allRows) {
    try {
      const existing = existingByUrl.get(row.source_url);
      const codeObligation = matchBondCode(row.designation, obligationsRef || []);

      const fields = {
        source_url: row.source_url,
        designation: row.designation || null,
        categorie: row.categorie || null,
        symbole: row.symbole || null,
        isin: row.isin || null,
        code_obligation: codeObligation,
        raison_sociale_emetteur: row.raison_sociale_emetteur || null,
        capital_social: row.capital_social || null,
        registre_commerce: row.registre_commerce || null,
        siege_social: row.siege_social || null,
        telephone_emetteur: row.telephone_emetteur || null,
        registraire: row.registraire || null,
        registraire_coordonnees: row.registraire_coordonnees || null,
        personne_ressource: row.personne_ressource || null,
        nature_titres: row.nature_titres || null,
        marche_secondaire: row.marche_secondaire || null,
        montant_indicatif: row.montant_indicatif ?? null,
        montant_effectif: row.montant_effectif ?? null,
        valeur_nominale: row.valeur_nominale ?? null,
        nombre_titres: row.nombre_titres ?? null,
        prix_emission: row.prix_emission ?? null,
        date_jouissance: row.date_jouissance || null,
        taux_brut: row.taux_brut ?? null,
        taux_net: row.taux_net ?? null,
        montant_coupon_brut: row.montant_coupon_brut ?? null,
        montant_coupon_net: row.montant_coupon_net ?? null,
        modalite_paiement: row.modalite_paiement || null,
        duree: row.duree || null,
        mode_remboursement: row.mode_remboursement || null,
        prix_remboursement: row.prix_remboursement ?? null,
        raw: row
      };

      const changed = existing
        ? DCBR_TRACKED_FIELDS.some(k => String(fields[k] ?? '') !== String(existing[k] ?? ''))
        : true;

      const { error } = await supabaseAdmin.from('obligations_caracteristiques').upsert({
        ...fields,
        first_seen_at: existing?.first_seen_at || now,
        last_seen_at: now,
        last_changed_at: changed ? now : (existing?.last_changed_at || now),
        updated_at: now
      }, { onConflict: 'source_url' });
      if (error) throw error;

      if (!existing) created++;
      else if (changed) updated++;
      else unchanged++;
    } catch (error) {
      rowErrors.push({ source_url: row.source_url, designation: row.designation, error: String(error?.message || error) });
    }
  }

  const result = {
    found: totalFound, already_stored: alreadyStored, fetched: batch.length,
    created, updated, unchanged, remaining, has_more: remaining > 0 || Object.values(hasMoreListing).some(Boolean),
    scrape_errors: scrapeErrors, row_errors: rowErrors,
    started_at: startedAt, finished_at: new Date().toISOString()
  };
  await safeDcbrRunLog({
    started_at: startedAt, finished_at: result.finished_at,
    status: rowErrors.length || scrapeErrors.length ? 'partial' : 'success', result
  });
  return result;
}

/* Une exception levée dans runPipeline() (scraper en échec, écriture Supabase
   qui échoue, panne inattendue) remontait jusqu'ici sans jamais être écrite
   dans brvm_scrape_runs : le pipeline plantait en silence, une simple réponse
   HTTP 500 que personne ne regarde puisque le cron n'a pas d'observateur.
   Cet enrobage journalise systématiquement le plantage sous status: 'error'
   avant de renvoyer l'erreur, pour que le run apparaisse dans le même journal
   que les séances bloquées — et donc soit couvert par la même alerte. */
async function runPipelineWithLogging(res, mode) {
  const startedAt = new Date().toISOString();
  try {
    return await runPipeline(res, mode);
  } catch (error) {
    console.error('[PROCESS-BRVM] runPipeline', error);
    await safeRunLog({
      started_at: startedAt, finished_at: new Date().toISOString(),
      status: 'error', error: String(error?.message || error)
    });
    return fail(res, 500, 'Traitement de la séance impossible.', 'PROCESS_BRVM_ERROR', error);
  }
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
  /* Un titre inconnu du référentiel (typiquement une nouvelle introduction en
     bourse : BBGC le 2026-09-24) bloquait toute la séance, en silence — le
     retour 422 n'était pas journalisé, donc aucune alerte Telegram. Désormais
     les titres reconnus sont publiés et les inconnus sont signalés (voir
     result.mapping.unmatched, relu par le déclencheur d'alerte). Seul un
     rapprochement ambigu, qui risquerait d'écrire un cours sur le mauvais
     titre, reste bloquant — et il est journalisé. */
  if (mapping.ambiguous.length) {
    await safeRunLog({
      started_at: startedAt, finished_at: new Date().toISOString(),
      status: 'blocked_mapping',
      result: { date_seance: payload.date_seance, mapping },
      error: 'Rapprochement ambigu : ' + mapping.ambiguous.map(a => a.source_ticker || a.source_name).join(', ')
    });
    return json(res, 422, {
      success: false, blocked: true, reason: 'INSTRUMENT_MAPPING_REVIEW_REQUIRED',
      date_seance: payload.date_seance, mapping, matched_rows: rows.length
    });
  }

  const allViolations = await validateVariations(rows);
  /* Seul un dépassement réel du plafond +/-7,5 % bloque désormais l'écriture.
     Le contrôle "incohérente" (variation publiée par BRVM vs recalculée
     depuis notre dernière clôture) reste utile en signal, mais s'est révélé
     trop fragile pour justifier de bloquer 47 titres à cause de 5 -
     constaté en prod le 2026-09-18 : BOAM/CABC/FTSC/SMBC/TTLS ont bloqué
     toute la séance de 10h à 16h, avec des chiffres figés dès le milieu de
     séance (variation recalculée immobile à 0 %) évoquant des titres
     suspendus en cours de journée - une clôture de référence différente
     entre BRVM et nous dans ce cas-là n'a rien d'une anomalie de saisie,
     et 42 titres parfaitement valides n'ont aucune raison d'attendre le
     lendemain pour ça. Dégradé en avertissement, publié avec la séance.
     Un vrai dépassement des +/-7,5 %, lui, reste bloquant sans exception. */
  const violations = allViolations.filter(v => v.type === 'variation_hors_limite');
  const warnings = allViolations.filter(v => v.type !== 'variation_hors_limite');
  if (violations.length) {
    await safeRunLog({
      started_at: startedAt, finished_at: new Date().toISOString(),
      status: 'blocked_validation',
      result: { date_seance: payload.date_seance, count: rows.length, violations, ...(warnings.length ? { warnings } : {}) },
      error: 'Contrôle BRVM : variation hors limite (+/-7,5 %)'
    });
    return json(res, 422, {
      success: false, blocked: true, reason: 'BRVM_VARIATION_LIMIT',
      limit: VARIATION_LIMIT, violations, date_seance: payload.date_seance
    });
  }

  const result = await writeSession(payload, rows);
  await safeRunLog({
    started_at: startedAt, finished_at: new Date().toISOString(), status: 'success',
    result: { ...result, date_seance: payload.date_seance, source: 'BRVM', mapping, ...(warnings.length ? { warnings } : {}) }
  });

  return json(res, 200, {
    success: true, processed: true, mode,
    date_seance: payload.date_seance, mapping, ...result,
    ...(warnings.length ? { warnings } : {})
  });
}

export default async function handler(req, res) {
  if (handlePreflight(req, res, { methods: 'GET,POST,PATCH,OPTIONS' })) return;
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
  }
  if (!supabaseAdmin) return fail(res, 503, 'Service temporairement indisponible.', 'SERVICE_UNAVAILABLE');

  // Lecture automatique des BOC par GitHub Actions (scripts/boc_extract.py) :
  // authentifiée par le jeton OIDC que GitHub signe pour ce workflow précis
  // de ce dépôt, sur main — aucun secret partagé. Ce chemin ne donne accès
  // qu'au scope boc_extract.
  const bearer = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (req.method === 'POST' && looksLikeGithubOidc(bearer)) {
    try {
      await verifyGithubOidc(bearer, BOC_OIDC);
    } catch (error) {
      console.warn('[PROCESS-BRVM] jeton GitHub refusé :', error?.message || error);
      return fail(res, 401, 'Jeton GitHub refusé.', 'OIDC_REJECTED');
    }
    const body = await readBody(req).catch(() => ({}));
    if (body?.scope !== 'boc_extract') return fail(res, 403, 'Scope non autorisé.', 'SCOPE_FORBIDDEN');
    try {
      return json(res, 200, { success: true, scope: 'boc_extract', ...(await runBocExtract(body)) });
    } catch (error) {
      console.error('[PROCESS-BRVM] boc_extract', error);
      return json(res, 502, { success: false, error: String(error?.message || error), code: 'BOC_EXTRACT_ERROR' });
    }
  }

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
        const startedAt = new Date().toISOString();
        let scraped;
        try {
          scraped = await scrapeBrvmObligations(body.date || body.date_seance);
        } catch (e) {
          console.error('[PROCESS-BRVM] obligations source', e);
          await safeObligationsRunLog({
            started_at: startedAt, finished_at: new Date().toISOString(),
            status: 'error', error: String(e?.message || e), triggered_by: admin?.id || null
          });
          return json(res, 502, { success: false, error: 'Source BRVM obligations illisible.', code: 'BRVM_SOURCE_ERROR' });
        }
        const rows = scraped.rows;
        try {
          await persistObligations(scraped);
        } catch (e) {
          await safeObligationsRunLog({
            started_at: startedAt, finished_at: new Date().toISOString(),
            status: 'error', error: String(e?.message || e),
            result: { date_seance: scraped.date_seance, lignes: rows.length },
            triggered_by: admin?.id || null
          });
          throw e;
        }
        await safeObligationsRunLog({
          started_at: startedAt, finished_at: new Date().toISOString(), status: 'success',
          result: {
            date_seance: scraped.date_seance, lignes: rows.length, marche: scraped.marche,
            source: scraped.fallback ? 'bfin' : 'brvm'
          },
          triggered_by: admin?.id || null
        });
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
        // Ajout manuel d'une annonce (admin) : le scraper ne remonte que ce que
        // brvm.org publie sous les six catégories suivies ; un communiqué reçu
        // autrement (email, dépôt direct) se rattache ici, en réutilisant le
        // même téléchargement + copie vers le stockage que la récupération
        // automatique — le document reste hébergé chez nous, pas un simple lien.
        if (body.action === 'add') {
          const sourceUrl = String(body.source_url || '').trim();
          const categorie = String(body.categorie || '').trim();
          if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) return fail(res, 400, 'URL du document invalide.', 'INVALID_URL');
          if (!categorie) return fail(res, 400, 'Catégorie requise.', 'INVALID_CATEGORIE');
          const known = await existingSourceUrls([sourceUrl]);
          if (known.has(sourceUrl)) return fail(res, 409, 'Ce document est déjà enregistré.', 'DUPLICATE');
          let ticker = String(body.ticker || '').trim().toUpperCase() || null;
          const societeNom = String(body.societe_nom || '').trim() || null;
          if (!ticker && societeNom) {
            try {
              const reference = await loadEnterpriseReference();
              const match = matchInstrument({ nom: societeNom }, reference);
              if (match.status === 'matched') ticker = match.record.ticker;
            } catch (e) { /* rapprochement au mieux, pas bloquant */ }
          }
          try {
            const stored = await downloadAndStoreAnnouncement({ source_url: sourceUrl, categorie, date_publication: body.date_publication || null });
            const { data, error } = await supabaseAdmin.from('documents_emetteurs').upsert({
              ticker, societe_nom: societeNom, categorie, titre: String(body.titre || '').trim() || null,
              date_publication: body.date_publication || null, source_url: sourceUrl, ...stored
            }, { onConflict: 'source_url' }).select().single();
            if (error) throw error;
            return json(res, 200, { success: true, scope: 'announcements', action: 'add', document: data });
          } catch (error) {
            console.error('[PROCESS-BRVM] announcements add', error);
            return fail(res, 502, 'Téléchargement ou enregistrement impossible : ' + String(error?.message || error), 'ANNOUNCEMENT_ADD_ERROR');
          }
        }
        const startedAt = new Date().toISOString();
        try {
          const result = await runAnnouncementsScrape({
            categories: Array.isArray(body.categories) ? body.categories : null,
            sinceYears: Number.isFinite(Number(body.sinceYears)) ? Number(body.sinceYears) : 5,
            limit: Math.min(100, Number(body.limit) || 40)
          });
          await safeAnnouncementsRunLog({
            started_at: startedAt, finished_at: new Date().toISOString(),
            status: (result.write_errors || []).length || (result.scrape_errors || []).length ? 'partial' : 'success',
            result, triggered_by: admin?.id || null
          });
          return json(res, 200, { success: true, scope: 'announcements', ...result });
        } catch (error) {
          console.error('[PROCESS-BRVM] announcements', error);
          await safeAnnouncementsRunLog({
            started_at: startedAt, finished_at: new Date().toISOString(),
            status: 'error', error: String(error?.message || error), triggered_by: admin?.id || null
          });
          return json(res, 502, { success: false, error: 'Récupération des annonces impossible.', code: 'ANNOUNCEMENTS_SCRAPE_ERROR' });
        }
      }

      // BOC : POST { scope:'boc', limit? } (admin ou machine — pg_cron quotidien).
      if (body && body.scope === 'boc') {
        try {
          const result = await runBocSync({ limit: Math.min(30, Number(body.limit) || 10) });
          return json(res, 200, { success: true, scope: 'boc', ...result });
        } catch (error) {
          console.error('[PROCESS-BRVM] boc', error);
          return json(res, 502, { success: false, error: 'Récupération des BOC impossible.', code: 'BOC_SYNC_ERROR' });
        }
      }

      // Rapports des sociétés cotées : POST { scope:'rapports', sinceYears?,
      // limit?, maxPages? } (admin ou machine — pg_cron quotidien). Archive
      // les états financiers et rapports d'activités publiés sur brvm.org.
      if (body && body.scope === 'rapports') {
        const startedAt = new Date().toISOString();
        try {
          const result = await runRapportsSync({
            sinceYears: Math.min(10, Number(body.sinceYears) || 2),
            limit: Math.min(60, Number(body.limit) || 20),
            maxPages: Math.min(12, Number(body.maxPages) || (machine ? 3 : 12))
          });
          await safeRapportsRunLog({
            started_at: startedAt, finished_at: new Date().toISOString(),
            status: result.write_errors.length || result.scrape_errors.length ? 'partial' : 'success',
            error: result.write_errors.length || result.scrape_errors.length
              ? `${result.write_errors.length} document(s) non enregistré(s), ${result.scrape_errors.length} émetteur(s) illisible(s)`
              : null,
            result, triggered_by: admin?.id || null
          });
          return json(res, 200, { success: true, scope: 'rapports', ...result });
        } catch (error) {
          console.error('[PROCESS-BRVM] rapports', error);
          await safeRapportsRunLog({
            started_at: startedAt, finished_at: new Date().toISOString(),
            status: 'error', error: String(error?.message || error), triggered_by: admin?.id || null
          });
          return json(res, 502, { success: false, error: 'Récupération des rapports impossible.', code: 'RAPPORTS_SCRAPE_ERROR' });
        }
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

      // DC/BR : POST { scope:'dcbr', categories?, maxPages?, limit? } déclenche
      // une récupération des fiches techniques d'emprunts obligataires (ISIN,
      // caractéristiques d'émission). Admin uniquement, pas de secret machine :
      // ces fiches ne changent pas d'une séance à l'autre, aucun besoin de cron.
      // Bornée par `limit` (fiches jamais vues lues par lot, en parallèle) :
      // relancer reprend là où ça s'est arrêté, rien n'est jamais dupliqué
      // (upsert par source_url).
      if (body && body.scope === 'dcbr') {
        if (!admin) return fail(res, 403, 'Accès administrateur requis.', 'ADMIN_REQUIRED');
        try {
          const result = await runDcbrSync({
            categories: Array.isArray(body.categories) ? body.categories : null,
            maxPages: Math.min(60, Number(body.maxPages) || 15),
            limit: Math.min(150, Number(body.limit) || 40)
          });
          return json(res, 200, { success: true, scope: 'dcbr', ...result });
        } catch (error) {
          console.error('[PROCESS-BRVM] dcbr', error);
          await safeDcbrRunLog({
            started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
            status: 'error', error: String(error?.message || error)
          });
          return json(res, 502, { success: false, error: 'Synchronisation DC/BR impossible.', code: 'DCBR_SYNC_ERROR' });
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

      // Déclencheur d'import automatique (pg_cron Supabase, toutes les 15 min
      // en séance). Ne fait rien si le mode n'est pas « auto » — l'interrupteur
      // reste maître. Importe les obligations (non bloquant) et les actions.
      //
      // Les deux imports tournent désormais en parallèle plutôt qu'en série.
      // Avant ce correctif, `await scrapeBrvmObligations()` s'exécutait en
      // entier (jusqu'à ses 25 s de délai propres en cas de lenteur de
      // brvm.org) avant même que le scraping des cours ne démarre — deux
      // tâches indépendantes, écrivant dans des tables différentes, mais
      // qui se partageaient en série le budget d'exécution de 60 s de cette
      // fonction (voir `export const config = { maxDuration: 60 }` en tête
      // de fichier). Constaté en prod le 2026-09-21 : la page cours-obligations
      // de brvm.org, plus lente et plus instable que cours-actions, dépassait
      // son propre délai et amputait d'autant le temps restant pour la séance
      // — la partie réellement critique (prix, jamais rattrapable après coup
      // sans ressaisie). Les deux tâches sont indépendantes (aucune ne dépend
      // du résultat de l'autre) et chacune journalise déjà son propre échec
      // sans faire échouer l'autre : les exécuter en parallèle ne change rien
      // au comportement observable, seulement le budget de temps disponible
      // pour la séance en cas de lenteur de brvm.org sur l'un des deux flux.
      if (machine && body && body.scope === 'auto') {
        const cfg = await getSetting();
        if (cfg.mode !== 'auto') {
          return json(res, 200, { success: true, skipped: true, reason: 'automatic_processing_disabled' });
        }
        const oblStartedAt = new Date().toISOString();
        const obligationsTask = (async () => {
          try {
            const s = await scrapeBrvmObligations();
            await persistObligations(s);
            await safeObligationsRunLog({
              started_at: oblStartedAt, finished_at: new Date().toISOString(), status: 'success',
              result: {
                date_seance: s.date_seance, lignes: s.rows.length, marche: s.marche, source: 'auto',
                fallback: Boolean(s.fallback)
              }
            });
          } catch (e) {
            console.warn('[PROCESS-BRVM] auto obligations non bloquant :', e && e.message);
            await safeObligationsRunLog({
              started_at: oblStartedAt, finished_at: new Date().toISOString(),
              status: 'error', error: String(e?.message || e), result: { source: 'auto' }
            });
          }
        })();
        const [, response] = await Promise.all([obligationsTask, runPipelineWithLogging(res, cfg.mode)]);
        return response;
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

    // DC/BR : GET ?scope=dcbr&action=runs lit le journal des passages
    // (backfills manuels successifs) — admin uniquement, pas de déclenchement
    // de récupération ici (celle-ci reste réservée au POST ci-dessus).
    if (req.method === 'GET' && url.searchParams.get('scope') === 'dcbr' && url.searchParams.get('action') === 'runs') {
      if (!admin) return fail(res, 403, 'Accès administrateur requis.', 'ADMIN_REQUIRED');
      const { data, error } = await supabaseAdmin.from('dcbr_scrape_runs')
        .select('*').order('started_at', { ascending: false }).limit(20);
      if (error) return fail(res, 500, 'Lecture du journal impossible.', 'RUNS_READ_ERROR', error);
      return json(res, 200, { success: true, runs: data || [] });
    }

    // Cours & séance : GET ?scope=cours&action=runs lit le journal des
    // passages du pipeline actions (safeRunLog, table brvm_scrape_runs) —
    // alimenté par le cron d'import automatique (scope=auto, toutes les
    // 30 min en séance) et par le contrôle de variation qui le bloque le
    // cas échéant. Le scraper manuel (commit() dans scraper.js) écrit
    // directement dans `historique` sans passer par ce pipeline, donc
    // sans y apparaître : ce journal ne couvre que les passages automatiques.
    if (req.method === 'GET' && url.searchParams.get('scope') === 'cours' && url.searchParams.get('action') === 'runs') {
      if (!admin) return fail(res, 403, 'Accès administrateur requis.', 'ADMIN_REQUIRED');
      const { data, error } = await supabaseAdmin.from('brvm_scrape_runs')
        .select('*').order('started_at', { ascending: false }).limit(20);
      if (error) return fail(res, 500, 'Lecture du journal impossible.', 'RUNS_READ_ERROR', error);
      return json(res, 200, { success: true, runs: data || [] });
    }

    // Obligations (cours BRVM) : GET ?scope=obligations&action=runs lit le
    // journal des passages (manuels via l'admin et automatiques via le cron
    // scope=auto) — table obligations_scrape_runs.
    if (req.method === 'GET' && url.searchParams.get('scope') === 'obligations' && url.searchParams.get('action') === 'runs') {
      if (!admin) return fail(res, 403, 'Accès administrateur requis.', 'ADMIN_REQUIRED');
      const { data, error } = await supabaseAdmin.from('obligations_scrape_runs')
        .select('*').order('started_at', { ascending: false }).limit(20);
      if (error) return fail(res, 500, 'Lecture du journal impossible.', 'RUNS_READ_ERROR', error);
      return json(res, 200, { success: true, runs: data || [] });
    }

    // Annonces émetteurs : GET ?scope=announcements&action=runs lit le
    // journal des passages (déclenchement manuel uniquement, pas de cron) —
    // table announcements_scrape_runs.
    if (req.method === 'GET' && url.searchParams.get('scope') === 'announcements' && url.searchParams.get('action') === 'runs') {
      if (!admin) return fail(res, 403, 'Accès administrateur requis.', 'ADMIN_REQUIRED');
      const { data, error } = await supabaseAdmin.from('announcements_scrape_runs')
        .select('*').order('started_at', { ascending: false }).limit(20);
      if (error) return fail(res, 500, 'Lecture du journal impossible.', 'RUNS_READ_ERROR', error);
      return json(res, 200, { success: true, runs: data || [] });
    }

    const current = await getSetting();

    // Cron Vercel : requête GET portant le secret machine.
    if (req.method === 'GET' && machine) {
      if (current.mode !== 'auto') {
        return json(res, 200, { success: true, skipped: true, reason: 'automatic_processing_disabled' });
      }
      return await runPipelineWithLogging(res, current.mode);
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
    return await runPipelineWithLogging(res, current.mode);
  } catch (error) {
    return fail(res, 500, 'Traitement de la séance impossible.', 'PROCESS_BRVM_ERROR', error);
  }
}
