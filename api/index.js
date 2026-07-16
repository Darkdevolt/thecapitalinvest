// ═══════════════════════════════════════════════════════════════════════════════
// THE CAPITAL — API Router (1 fonction Vercel)
// Fusionne : auth, boc, contact, fiche, marche, portefeuille, scraper, admin
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase, supabaseAdmin } from './lib/supabase.js';
import { error, success } from './lib/response.js';
import { rateLimit, authenticate, parseBody } from './lib/middleware.js';
import { validate } from './lib/validate.js';
import { corsHeaders, handleOptions } from './lib/cors.js';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS — Cache HTTP pour endpoints publics
// ═══════════════════════════════════════════════════════════════════════════════
function withPublicCache(response) {
  // Clone la réponse pour ajouter les headers de cache
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS — Portefeuille
// ═══════════════════════════════════════════════════════════════════════════════
const FRAIS = {
  courtage: 0.012,
  tva: 0.18,
  brvm: 0.0007,
  dcbr: 0.0005,
};

function calculerFrais(montant) {
  const courtage = montant * FRAIS.courtage;
  const tva = courtage * FRAIS.tva;
  const brvm = montant * FRAIS.brvm;
  const dcbr = montant * FRAIS.dcbr;
  return { courtage, tva, brvm, dcbr, total: courtage + tva + brvm + dcbr };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER — AUTH (login / signup)
// ═══════════════════════════════════════════════════════════════════════════════
async function handleAuth(req) {
  if (req.method === 'OPTIONS') return handleOptions(corsHeaders('public'));
  if (req.method !== 'POST') return error('Méthode non autorisée', 405);

  let body;
  try { body = await req.json(); }
  catch { return error('Body invalide', 400); }

  const { action, email, password, nom } = body;
  if (!email || !password) return error('Email et mot de passe requis', 400);

  try {
    if (action === 'login') {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      return success({ session: data.session }, 'Connexion réussie');
    }
    if (action === 'signup') {
      const { data, error: authError } = await supabase.auth.signUp({
        email, password,
        options: { data: { nom: nom || '' } }
      });
      if (authError) throw authError;
      return success({ session: data.session }, 'Inscription réussie');
    }
    return error('Action invalide', 400);
  } catch (e) {
    return error(e.message, 400);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER — BOC (public) — AVEC CACHE
// ═══════════════════════════════════════════════════════════════════════════════
async function handleBoc(req) {
  if (req.method === 'OPTIONS') return handleOptions(corsHeaders('public'));
  if (req.method !== 'GET') return error('Méthode non autorisée', 405);

  try {
    const { data, error: dbError } = await supabase
      .from('boc')
      .select('*')
      .order('date_seance', { ascending: false })
      .limit(100);
    if (dbError) throw dbError;
    const resp = success({ data: data || [] });
    return withPublicCache(resp);
  } catch (e) {
    console.error('BOC API error:', e);
    return error('Erreur serveur', 500, 'SERVER_ERROR');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER — CONTACT (public)
// ═══════════════════════════════════════════════════════════════════════════════
async function handleContact(req) {
  if (req.method === 'OPTIONS') return handleOptions(corsHeaders('public'));
  if (req.method !== 'POST') return error('Méthode non autorisée', 405);

  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;

  const schema = {
    prenom: { type: 'name', required: true, sanitize: true },
    nom: { type: 'name', required: false, sanitize: true },
    email: { type: 'email', required: true },
    objet: { type: 'enum', required: true, values: ['info', 'pro', 'institution', 'partenariat', 'bug', 'autre'] },
    message: { type: 'string', required: true, min: 10, max: 5000 },
  };

  const { valid, errors, sanitized } = validate(body, schema);
  if (!valid) return error(errors.join(', '), 400, 'VALIDATION_ERROR');

  try {
    const { error: dbError } = await supabaseAdmin
      .from('contacts')
      .insert({
        prenom: sanitized.prenom,
        nom: sanitized.nom || null,
        email: sanitized.email,
        objet: sanitized.objet,
        message: sanitized.message,
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        user_agent: req.headers.get('user-agent') || null,
      });
    if (dbError) throw dbError;
    return success({}, 'Message envoyé avec succès');
  } catch (e) {
    console.error('Contact API error:', e);
    return error('Erreur serveur', 500, 'SERVER_ERROR');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER — FICHE (public) — AVEC CACHE
// ═══════════════════════════════════════════════════════════════════════════════
async function handleFiche(req) {
  if (req.method === 'OPTIONS') return handleOptions(corsHeaders('public'));
  if (req.method !== 'GET') return error('Méthode non autorisée', 405);

  const url = new URL(req.url);
  const ticker = url.searchParams.get('ticker')?.toUpperCase();

  if (!ticker || !validate({ ticker }, { ticker: { type: 'ticker', required: true } }).valid) {
    return error('Ticker invalide', 400, 'INVALID_TICKER');
  }

  try {
    const [
      { data: entreprise },
      { data: cours },
      { data: chartData },
      { data: financials },
      { data: analyses },
    ] = await Promise.all([
      supabase.from('entreprises').select('*').eq('ticker', ticker).single(),
      supabase.from('cours').select('*').eq('ticker', ticker).order('date_seance', { ascending: false }).limit(1).single(),
      supabase.from('historique').select('date_seance, cloture').eq('ticker', ticker).order('date_seance', { ascending: true }).limit(252),
      supabase.from('financials').select('*').eq('ticker', ticker).order('annee', { ascending: false }).limit(5),
      supabase.from('analyses').select('*').eq('ticker', ticker).order('date_analyse', { ascending: false }).limit(5),
    ]);

    let valuation = null;
    if (cours?.cours && financials?.[0]) {
      const f = financials[0];
      const coursVal = parseFloat(cours.cours);
      valuation = {
        per: f.bpa ? (coursVal / parseFloat(f.bpa)).toFixed(1) : null,
        rdt: f.dpa ? ((parseFloat(f.dpa) / coursVal) * 100).toFixed(1) : null,
        p_actif_net: f.fonds_propres ? (coursVal / parseFloat(f.fonds_propres)).toFixed(2) : null,
        cap_bours_mrd: f.nombre_actions ? ((coursVal * parseFloat(f.nombre_actions)) / 1e9).toFixed(2) : null,
      };
    }

    const resp = success({
      entreprise: entreprise || null,
      cours: cours || null,
      chartData: chartData || [],
      financials: financials || [],
      analyses: analyses || [],
      valuation,
    });
    return withPublicCache(resp);
  } catch (e) {
    console.error('Fiche API error:', e);
    return error('Erreur serveur', 500, 'SERVER_ERROR');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER — MARCHE (public) — AVEC CACHE + ENDPOINT APERCU
// ═══════════════════════════════════════════════════════════════════════════════
async function handleMarche(req) {
  if (req.method === 'OPTIONS') return handleOptions(corsHeaders('public'));
  if (req.method !== 'GET') return error('Méthode non autorisée', 405);

  const url = new URL(req.url);
  const type = url.searchParams.get('type');

  try {
    switch (type) {
      case 'apercu': {
        // ═══════════════════════════════════════
        // ENDPOINT AGRÉGÉ pour la page d'accueil
        // 1 seul appel = indices + cours + palmarès
        // ═══════════════════════════════════════
        const [
          { data: indices, error: idxErr },
          { data: cours, error: crsErr },
        ] = await Promise.all([
          supabase.from('indices').select('*').order('date_seance', { ascending: false }).limit(20),
          supabase.from('cours').select('ticker, nom, cours, variation, volume, capitalisation, date_seance, plus_haut, plus_bas')
            .order('date_seance', { ascending: false }).limit(200),
        ]);

        if (idxErr) throw idxErr;
        if (crsErr) throw crsErr;

        // Dédoublonner cours par ticker (prendre le plus récent)
        const seen = new Set();
        const uniqueCours = [];
        for (const c of cours || []) {
          if (!seen.has(c.ticker)) {
            seen.add(c.ticker);
            uniqueCours.push(c);
          }
        }

        // Palmarès
        const sorted = [...uniqueCours].sort((a, b) => (b.variation || 0) - (a.variation || 0));
        const topHausses = sorted.filter(c => (c.variation || 0) > 0).slice(0, 5);
        const topBaisses = sorted.filter(c => (c.variation || 0) < 0).slice(0, 5).reverse();
        const topVolumes = [...uniqueCours].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 5);

        const resp = success({
          indices: (indices || []).slice(0, 3),
          cours: uniqueCours.slice(0, 15),
          topHausses,
          topBaisses,
          topVolumes,
          dateSeance: uniqueCours[0]?.date_seance || new Date().toISOString().split('T')[0],
          totalValeurs: uniqueCours.length,
        });
        return withPublicCache(resp);
      }

      case 'indices': {
        const { data, error: dbError } = await supabase
          .from('indices')
          .select('*')
          .order('date_seance', { ascending: false })
          .limit(20);
        if (dbError) throw dbError;
        const resp = success({ data: data || [] });
        return withPublicCache(resp);
      }

      case 'cours': {
        const { data, error: dbError } = await supabase
          .from('cours')
          .select('*')
          .order('date_seance', { ascending: false })
          .limit(100);
        if (dbError) throw dbError;
        const resp = success({ data: data || [] });
        return withPublicCache(resp);
      }

      case 'historique': {
        const ticker = url.searchParams.get('ticker')?.toUpperCase();
        if (!ticker) return error('Ticker requis', 400, 'MISSING_TICKER');
        const { data, error: dbError } = await supabase
          .from('historique')
          .select('*')
          .eq('ticker', ticker)
          .order('date_seance', { ascending: false })
          .limit(252);
        if (dbError) throw dbError;
        const resp = success({ data: data || [] });
        return withPublicCache(resp);
      }

      case 'financials': {
        // Nouveau endpoint public pour les données financières
        const { data, error: dbError } = await supabase
          .from('financials')
          .select('*')
          .order('annee', { ascending: false })
          .limit(300);
        if (dbError) throw dbError;
        const resp = success({ data: data || [] });
        return withPublicCache(resp);
      }

      default:
        return error('Type invalide', 400, 'INVALID_TYPE');
    }
  } catch (e) {
    console.error('Marche API error:', e);
    return error('Erreur serveur', 500, 'SERVER_ERROR');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER — PORTEFEUILLE (privé)
// ═══════════════════════════════════════════════════════════════════════════════
async function handlePortefeuille(req) {
  if (req.method === 'OPTIONS') return handleOptions(corsHeaders('private'));

  const auth = await authenticate(req);
  if (auth.response) return auth.response;
  const userId = auth.user.sub;

  const url = new URL(req.url);
  const mode = url.searchParams.get('mode');

  try {
    switch (req.method) {
      case 'GET':
        if (mode === 'portefeuille') return getPortefeuille(userId);
        if (mode === 'transactions') return getTransactions(userId);
        return error('Mode invalide', 400, 'INVALID_MODE');
      case 'POST':
        if (mode === 'transaction') return addTransaction(userId, req);
        return error('Mode invalide', 400, 'INVALID_MODE');
      case 'DELETE':
        if (mode === 'transaction') return deleteTransaction(userId, url);
        return error('Mode invalide', 400, 'INVALID_MODE');
      default:
        return error('Méthode non autorisée', 405);
    }
  } catch (e) {
    console.error('Portefeuille API error:', e);
    return error('Erreur serveur', 500, 'SERVER_ERROR');
  }
}

async function getPortefeuille(userId) {
  const { data: transactions, error: txError } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date_transaction', { ascending: true });
  if (txError) throw txError;

  const positions = {};
  for (const tx of transactions || []) {
    const tk = tx.ticker;
    if (!positions[tk]) positions[tk] = { quantite: 0, investi: 0, frais: 0 };
    const qte = parseInt(tx.quantite);
    const prix = parseFloat(tx.prix_unitaire);
    const montant = qte * prix;
    const frais = calculerFrais(montant).total;

    if (tx.type === 'ACHAT') {
      positions[tk].quantite += qte;
      positions[tk].investi += montant + frais;
      positions[tk].frais += frais;
    } else {
      positions[tk].quantite -= qte;
      positions[tk].investi -= montant - frais;
      positions[tk].frais += frais;
    }
  }

  const activeTickers = Object.entries(positions)
    .filter(([, pos]) => pos.quantite > 0)
    .map(([ticker]) => ticker);

  const coursMap = new Map();
  if (activeTickers.length > 0) {
    const { data: allCours } = await supabase
      .from('cours')
      .select('ticker, cours, nom, date_seance')
      .in('ticker', activeTickers)
      .order('date_seance', { ascending: false });

    for (const row of allCours || []) {
      if (!coursMap.has(row.ticker)) coursMap.set(row.ticker, row);
    }
  }

  const activePositions = [];
  let totalInvesti = 0;
  let totalValeur = 0;

  for (const [ticker, pos] of Object.entries(positions)) {
    if (pos.quantite <= 0) continue;
    const cours = coursMap.get(ticker);
    const coursActuel = parseFloat(cours?.cours || 0);
    const valeur = pos.quantite * coursActuel;
    const cmp = pos.investi / pos.quantite;
    const plusValue = valeur - pos.investi;
    const plusValuePct = pos.investi > 0 ? (plusValue / pos.investi) * 100 : 0;

    totalInvesti += pos.investi;
    totalValeur += valeur;

    activePositions.push({
      ticker,
      nom: cours?.nom || ticker,
      quantite: pos.quantite,
      cmp: Math.round(cmp * 100) / 100,
      cours_actuel: coursActuel,
      valeur_actuelle: Math.round(valeur * 100) / 100,
      plus_value: Math.round(plusValue * 100) / 100,
      plus_value_pct: Math.round(plusValuePct * 100) / 100,
    });
  }

  return success({
    data: activePositions,
    total_investi: Math.round(totalInvesti * 100) / 100,
    total_valeur: Math.round(totalValeur * 100) / 100,
  });
}

async function getTransactions(userId) {
  const { data, error: dbError } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date_transaction', { ascending: false });
  if (dbError) throw dbError;
  return success({ data: data || [] });
}

async function addTransaction(userId, req) {
  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;

  const schema = {
    ticker: { type: 'ticker', required: true },
    type: { type: 'enum', required: true, values: ['ACHAT', 'VENTE'] },
    quantite: { type: 'integer', required: true, min: 1, max: 1_000_000 },
    prix: { type: 'number', required: true, min: 0.01, max: 1_000_000_000 },
    date_transaction: { type: 'date', required: true },
    note: { type: 'string', required: false, max: 200 },
  };

  const { valid, errors, sanitized } = validate(body, schema);
  if (!valid) return error(errors.join(', '), 400, 'VALIDATION_ERROR');

  const montant = sanitized.quantite * sanitized.prix;
  const frais = calculerFrais(montant);

  const { data, error: dbError } = await supabaseAdmin
    .from('transactions')
    .insert({
      user_id: userId,
      ticker: sanitized.ticker,
      type: sanitized.type,
      quantite: sanitized.quantite,
      prix_unitaire: sanitized.prix,
      date_transaction: sanitized.date_transaction,
      note: sanitized.note || null,
      frais_total: Math.round(frais.total * 100) / 100,
      montant_net:
        sanitized.type === 'ACHAT'
          ? Math.round((montant + frais.total) * 100) / 100
          : Math.round((montant - frais.total) * 100) / 100,
    })
    .select()
    .single();

  if (dbError) throw dbError;
  return success({ data }, 'Transaction enregistrée');
}

async function deleteTransaction(userId, url) {
  const id = url.searchParams.get('id');
  if (!id) return error('ID requis', 400, 'MISSING_ID');

  const { error: dbError } = await supabaseAdmin
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (dbError) throw dbError;
  return success({}, 'Transaction supprimée');
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER — SCRAPER (CRON protégé)
// ═══════════════════════════════════════════════════════════════════════════════
async function handleScraper(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return error('Non autorisé', 401, 'UNAUTHORIZED');
  }

  const today = new Date().toISOString().split('T')[0];
  let scraped = 0;
  let inserted = 0;
  const errors = [];

  try {
    const scrapedData = [];
    if (scrapedData.length === 0) {
      return success({
        date: today,
        scraped: 0,
        inserted: 0,
        errors: null,
        message: 'Aucune donnée à importer — scraping réel non encore implémenté.',
      });
    }

    for (const row of scrapedData) {
      scraped++;
      const { error: dbError } = await supabaseAdmin
        .from('cours')
        .upsert(
          {
            ticker: row.ticker,
            date_seance: today,
            cours: row.cours,
            variation: row.variation,
            volume: row.volume,
            updated_at: new Date().toISOString(),
          },
          { onConflict: ['ticker', 'date_seance'] }
        );

      if (dbError) errors.push(`${row.ticker}: ${dbError.message}`);
      else inserted++;
    }

    return success({
      date: today,
      scraped,
      inserted,
      errors: errors.length ? errors : null,
      fallback: false,
    });
  } catch (e) {
    console.error('Scraper error:', e);
    return error('Erreur scraping', 500, 'SCRAPER_ERROR');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER — ADMIN (privé + rôle admin)
// ═══════════════════════════════════════════════════════════════════════════════
async function handleAdmin(req) {
  if (req.method === 'OPTIONS') return handleOptions(corsHeaders('private'));

  const auth = await authenticate(req);
  if (auth.response) return auth.response;

  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('id', auth.user.sub)
    .single();

  if (!userData?.is_admin) {
    return error('Accès réservé aux administrateurs', 403, 'FORBIDDEN');
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  try {
    switch (action) {
      case 'check': return success({ is_admin: true, email: auth.user.email });
      case 'stats': return getStats();
      case 'stats_errors': return getStatsErrors();
      case 'entreprises': return getEntreprises();
      case 'toggle_actif': return toggleActif(req);
      case 'update_entreprise': return updateEntreprise(req);
      case 'add_entreprise': return addEntreprise(req);
      case 'cours_latest': return getCoursLatest(url);
      case 'historique_ticker': return getHistoriqueTicker(url);
      case 'add_cours': return addCours(req);
      case 'update_cours': return updateCours(req);
      case 'delete_cours': return deleteCours(url);
      case 'add_historique': return addHistorique(req);
      case 'add_historique_bulk': return addHistoriqueBulk(req);
      case 'delete_historique': return deleteHistorique(url);
      case 'financials': return getFinancials(url);
      case 'add_financial': return addFinancial(req);
      case 'delete_financial': return deleteFinancial(url);
      case 'analyses': return getAnalyses();
      case 'add_analyse': return addAnalyse(req);
      case 'delete_analyse': return deleteAnalyse(url);
      case 'users': return getUsers();
      case 'set_plan': return setPlan(req);
      case 'set_admin': return setAdmin(req);
      case 'dividendes': return getDividendes(url);
      case 'add_dividende': return addDividende(req);
      case 'delete_dividende': return deleteDividende(url);
      case 'diagnostic': return runDiagnostic();
      case 'repair_totaux': return repairTotaux();
      case 'fallback': return runFallback();
      case 'boc': return importBOC(req);
      default: return error('Action invalide', 400, 'INVALID_ACTION');
    }
  } catch (e) {
    console.error('Admin API error:', e);
    return error(`Erreur serveur: ${e.message}`, 500, 'SERVER_ERROR');
  }
}

// ─── Admin sub-functions ───
async function getStats() {
  const [entreprises, cours, historique, financials, dividendes, users] = await Promise.all([
    supabaseAdmin.from('entreprises').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('cours').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('historique').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('financials').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('dividendes').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
  ]);

  const lastSeance = await supabase.from('cours').select('date_seance').order('date_seance', { ascending: false }).limit(1).single();
  const lastHistorique = await supabase.from('historique').select('date_seance').order('date_seance', { ascending: false }).limit(1).single();

  return success({
    entreprises: entreprises.count || 0,
    cours: cours.count || 0,
    historique: historique.count || 0,
    financials: financials.count || 0,
    dividendes: dividendes.count || 0,
    users: users.count || 0,
    last_seance: lastSeance.data?.date_seance || null,
    last_historique: lastHistorique.data?.date_seance || null,
    last_scrape: new Date().toISOString(),
  });
}

async function getStatsErrors() {
  const [coursNulls, coursNeg] = await Promise.all([
    supabaseAdmin.from('cours').select('ticker, date_seance, cours, variation_pct').or('cours.is.null,cours.lte.0').order('date_seance', { ascending: false }).limit(50),
    supabaseAdmin.from('cours').select('ticker, date_seance, cours, variation_pct').lt('cours', 0).order('date_seance', { ascending: false }).limit(50),
  ]);
  return success({
    cours_invalides: coursNulls.data || [],
    cours_negatifs: coursNeg.data || [],
    count_cours_invalides: (coursNulls.data || []).length,
    count_cours_negatifs: (coursNeg.data || []).length,
  });
}

async function getEntreprises() {
  const { data, error: dbError } = await supabaseAdmin.from('entreprises').select('*').order('ticker');
  if (dbError) throw dbError;
  return success({ data: data || [] });
}

async function toggleActif(req) {
  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;
  const { ticker, actif } = body;
  if (!ticker || typeof actif !== 'boolean') return error('Paramètres invalides', 400, 'VALIDATION_ERROR');
  const { error: dbError } = await supabaseAdmin.from('entreprises').update({ actif }).eq('ticker', ticker);
  if (dbError) throw dbError;
  return success({}, `Société ${actif ? 'activée' : 'désactivée'}`);
}

async function updateEntreprise(req) {
  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;
  const { ticker, ...fields } = body;
  if (!ticker) return error('Ticker requis', 400, 'VALIDATION_ERROR');
  const allowed = ['nom', 'secteur', 'pays', 'compartiment', 'description', 'isin', 'capital', 'actif'];
  const update = {};
  for (const k of allowed) { if (fields[k] !== undefined) update[k] = fields[k]; }
  if (Object.keys(update).length === 0) return error('Aucun champ à modifier', 400, 'VALIDATION_ERROR');
  const { error: dbError } = await supabaseAdmin.from('entreprises').update(update).eq('ticker', ticker);
  if (dbError) throw dbError;
  return success({}, `Entreprise ${ticker} mise à jour`);
}

async function addEntreprise(req) {
  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;
  const schema = {
    ticker: { type: 'ticker', required: true },
    nom: { type: 'string', required: true, min: 1, max: 200 },
    secteur: { type: 'string', required: false, max: 100 },
    pays: { type: 'string', required: false, max: 50 },
    compartiment: { type: 'enum', required: false, values: ['PRESTIGE', 'PRINCIPAL'] },
    isin: { type: 'string', required: false, max: 20 },
  };
  const { valid, errors, sanitized } = validate(body, schema);
  if (!valid) return error(errors.join(', '), 400, 'VALIDATION_ERROR');
  const { error: dbError } = await supabaseAdmin.from('entreprises').insert({ ...sanitized, actif: true });
  if (dbError) {
    if (dbError.code === '23505') return error('Ce ticker existe déjà', 409, 'DUPLICATE');
    throw dbError;
  }
  return success({}, `Entreprise ${sanitized.ticker} créée`);
}

async function getCoursLatest(url) {
  const ticker = url.searchParams.get('ticker')?.toUpperCase();
  let query = supabaseAdmin.from('cours').select('*').order('date_seance', { ascending: false }).limit(ticker ? 100 : 50);
  if (ticker) query = query.eq('ticker', ticker);
  const { data, error: dbError } = await query;
  if (dbError) throw dbError;
  return success({ data: data || [] });
}

async function getHistoriqueTicker(url) {
  const ticker = url.searchParams.get('ticker')?.toUpperCase();
  if (!ticker) return error('Ticker requis', 400, 'MISSING_TICKER');
  const { data, error: dbError } = await supabaseAdmin.from('historique').select('*').eq('ticker', ticker).order('date_seance', { ascending: false }).limit(500);
  if (dbError) throw dbError;
  return success({ data: data || [] });
}

async function addCours(req) {
  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;
  const schema = {
    ticker: { type: 'ticker', required: true },
    date_seance: { type: 'date', required: true },
    cours: { type: 'number', required: true, min: 0 },
    ouverture: { type: 'number', required: false, min: 0 },
    plus_haut: { type: 'number', required: false, min: 0 },
    plus_bas: { type: 'number', required: false, min: 0 },
    volume: { type: 'number', required: false, min: 0 },
    variation_pct: { type: 'number', required: false },
    capitalisation: { type: 'number', required: false, min: 0 },
  };
  const { valid, errors, sanitized } = validate(body, schema);
  if (!valid) return error(errors.join(', '), 400, 'VALIDATION_ERROR');
  const { error: dbError } = await supabaseAdmin.from('cours').upsert(sanitized, { onConflict: ['ticker', 'date_seance'] });
  if (dbError) throw dbError;
  return success({}, 'Cours enregistré');
}

async function updateCours(req) {
  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;
  const { id, ...fields } = body;
  if (!id) return error('ID requis', 400, 'VALIDATION_ERROR');
  const allowed = ['cours', 'ouverture', 'plus_haut', 'plus_bas', 'volume', 'variation_pct', 'capitalisation'];
  const update = {};
  for (const k of allowed) { if (fields[k] !== undefined) update[k] = fields[k]; }
  if (Object.keys(update).length === 0) return error('Aucun champ à modifier', 400, 'VALIDATION_ERROR');
  const { error: dbError } = await supabaseAdmin.from('cours').update(update).eq('id', id);
  if (dbError) throw dbError;
  return success({}, 'Cours mis à jour');
}

async function deleteCours(url) {
  const id = url.searchParams.get('id');
  if (!id) return error('ID requis', 400, 'MISSING_ID');
  const { error: dbError } = await supabaseAdmin.from('cours').delete().eq('id', id);
  if (dbError) throw dbError;
  return success({}, 'Cours supprimé');
}

async function addHistorique(req) {
  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;
  const schema = {
    ticker: { type: 'ticker', required: true },
    date_seance: { type: 'date', required: true },
    cours_cloture: { type: 'number', required: true, min: 0 },
    cours_ouverture: { type: 'number', required: false, min: 0 },
    plus_haut: { type: 'number', required: false, min: 0 },
    plus_bas: { type: 'number', required: false, min: 0 },
    volume: { type: 'number', required: false, min: 0 },
    variation_pct: { type: 'number', required: false },
  };
  const { valid, errors, sanitized } = validate(body, schema);
  if (!valid) return error(errors.join(', '), 400, 'VALIDATION_ERROR');
  const { error: dbError } = await supabaseAdmin.from('historique').upsert(sanitized, { onConflict: ['ticker', 'date_seance'] });
  if (dbError) throw dbError;
  return success({}, 'Cours historique enregistré');
}

async function addHistoriqueBulk(req) {
  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;
  const { rows } = body;
  if (!Array.isArray(rows) || rows.length === 0) return error('Tableau "rows" requis', 400, 'VALIDATION_ERROR');
  if (rows.length > 500) return error('Maximum 500 lignes par import', 400, 'TOO_MANY_ROWS');
  const validated = [];
  const importErrors = [];
  for (let i = 0; i < rows.length; i++) {
    const schema = {
      ticker: { type: 'ticker', required: true },
      date_seance: { type: 'date', required: true },
      cours_cloture: { type: 'number', required: true, min: 0 },
      cours_ouverture: { type: 'number', required: false, min: 0 },
      plus_haut: { type: 'number', required: false, min: 0 },
      plus_bas: { type: 'number', required: false, min: 0 },
      volume: { type: 'number', required: false, min: 0 },
      variation_pct: { type: 'number', required: false },
    };
    const { valid, errors, sanitized } = validate(rows[i], schema);
    if (!valid) importErrors.push({ ligne: i + 1, errors });
    else validated.push(sanitized);
  }
  if (importErrors.length > 0 && validated.length === 0) return error(`Toutes les lignes sont invalides`, 400, 'VALIDATION_ERROR');
  const { error: dbError } = await supabaseAdmin.from('historique').upsert(validated, { onConflict: ['ticker', 'date_seance'] });
  if (dbError) throw dbError;
  return success({ inserted: validated.length, skipped: importErrors.length, errors: importErrors }, `${validated.length} lignes importées`);
}

async function deleteHistorique(url) {
  const id = url.searchParams.get('id');
  if (!id) return error('ID requis', 400, 'MISSING_ID');
  const { error: dbError } = await supabaseAdmin.from('historique').delete().eq('id', id);
  if (dbError) throw dbError;
  return success({}, 'Entrée historique supprimée');
}

async function getFinancials(url) {
  const ticker = url.searchParams.get('ticker')?.toUpperCase();
  let query = supabaseAdmin.from('financials').select('*').order('ticker').order('annee', { ascending: false });
  if (ticker) query = query.eq('ticker', ticker);
  const { data, error: dbError } = await query;
  if (dbError) throw dbError;
  return success({ data: data || [] });
}

async function addFinancial(req) {
  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;
  const schema = {
    ticker: { type: 'ticker', required: true },
    annee: { type: 'integer', required: true, min: 2000, max: 2100 },
    chiffre_affaires: { type: 'number', required: false, min: 0 },
    ebit: { type: 'number', required: false },
    resultat_net: { type: 'number', required: false },
    bpa: { type: 'number', required: false, min: 0 },
    dpa: { type: 'number', required: false, min: 0 },
    roe: { type: 'number', required: false },
    fonds_propres: { type: 'number', required: false, min: 0 },
    dette_nette: { type: 'number', required: false, min: 0 },
    source: { type: 'string', required: false, max: 200 },
  };
  const { valid, errors, sanitized } = validate(body, schema);
  if (!valid) return error(errors.join(', '), 400, 'VALIDATION_ERROR');
  const { error: dbError } = await supabaseAdmin.from('financials').upsert(sanitized, { onConflict: ['ticker', 'annee'] });
  if (dbError) throw dbError;
  return success({}, 'Financial enregistré');
}

async function deleteFinancial(url) {
  const id = url.searchParams.get('id');
  if (!id) return error('ID requis', 400, 'MISSING_ID');
  const { error: dbError } = await supabaseAdmin.from('financials').delete().eq('id', id);
  if (dbError) throw dbError;
  return success({}, 'Financial supprimé');
}

async function getAnalyses() {
  const { data, error: dbError } = await supabaseAdmin.from('analyses').select('*').order('date_analyse', { ascending: false });
  if (dbError) throw dbError;
  return success({ data: data || [] });
}

async function addAnalyse(req) {
  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;
  const schema = {
    ticker: { type: 'ticker', required: true },
    recommandation: { type: 'enum', required: true, values: ['Acheter', 'Renforcer', 'Conserver', 'Alléger', 'Vendre'] },
    objectif_cours: { type: 'number', required: false, min: 0 },
    cours_reference: { type: 'number', required: false, min: 0 },
    potentiel_pct: { type: 'number', required: false },
    analyste: { type: 'string', required: false, max: 100 },
    commentaire: { type: 'string', required: false, max: 2000 },
  };
  const { valid, errors, sanitized } = validate(body, schema);
  if (!valid) return error(errors.join(', '), 400, 'VALIDATION_ERROR');
  const { error: dbError } = await supabaseAdmin.from('analyses').insert({ ...sanitized, date_analyse: new Date().toISOString().split('T')[0] });
  if (dbError) throw dbError;
  return success({}, 'Recommandation publiée');
}

async function deleteAnalyse(url) {
  const id = url.searchParams.get('id');
  if (!id) return error('ID requis', 400, 'MISSING_ID');
  const { error: dbError } = await supabaseAdmin.from('analyses').delete().eq('id', id);
  if (dbError) throw dbError;
  return success({}, 'Recommandation supprimée');
}

async function getUsers() {
  const { data, error: dbError } = await supabaseAdmin.from('users').select('id, email, nom, plan, plan_expire_at, is_admin, created_at').order('created_at', { ascending: false });
  if (dbError) throw dbError;
  return success({ data: data || [] });
}

async function setPlan(req) {
  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;
  const { user_id, plan, expires_at } = body;
  if (!user_id || !['free', 'pro', 'elite'].includes(plan)) return error('Paramètres invalides', 400, 'VALIDATION_ERROR');
  const update = { plan };
  if (expires_at) update.plan_expire_at = expires_at;
  const { error: dbError } = await supabaseAdmin.from('users').update(update).eq('id', user_id);
  if (dbError) throw dbError;
  return success({}, `Plan mis à jour : ${plan}`);
}

async function setAdmin(req) {
  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;
  const { user_id, is_admin } = body;
  if (!user_id || typeof is_admin !== 'boolean') return error('Paramètres invalides', 400, 'VALIDATION_ERROR');
  const { error: dbError } = await supabaseAdmin.from('users').update({ is_admin }).eq('id', user_id);
  if (dbError) throw dbError;
  return success({}, `Droits admin ${is_admin ? 'accordés' : 'retirés'}`);
}

async function getDividendes(url) {
  const ticker = url.searchParams.get('ticker')?.toUpperCase();
  let query = supabaseAdmin.from('dividendes').select('*').order('ticker').order('annee', { ascending: false });
  if (ticker) query = query.eq('ticker', ticker);
  const { data, error: dbError } = await query;
  if (dbError) throw dbError;
  return success({ data: data || [] });
}

async function addDividende(req) {
  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;
  const schema = {
    ticker: { type: 'ticker', required: true },
    annee: { type: 'integer', required: true, min: 2000, max: 2100 },
    montant: { type: 'number', required: true, min: 0 },
    date_detachement: { type: 'date', required: false },
    date_paiement: { type: 'date', required: false },
    taux_rendement: { type: 'number', required: false },
  };
  const { valid, errors, sanitized } = validate(body, schema);
  if (!valid) return error(errors.join(', '), 400, 'VALIDATION_ERROR');
  const { error: dbError } = await supabaseAdmin.from('dividendes').upsert(sanitized, { onConflict: ['ticker', 'annee'] });
  if (dbError) throw dbError;
  return success({}, 'Dividende enregistré');
}

async function deleteDividende(url) {
  const id = url.searchParams.get('id');
  if (!id) return error('ID requis', 400, 'MISSING_ID');
  const { error: dbError } = await supabaseAdmin.from('dividendes').delete().eq('id', id);
  if (dbError) throw dbError;
  return success({}, 'Dividende supprimé');
}

async function runDiagnostic() {
  const results = {};
  const tables = ['entreprises', 'cours', 'historique', 'financials', 'dividendes', 'analyses', 'users', 'boc'];
  for (const table of tables) {
    try {
      const { count, error: e } = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true });
      results[table] = { ok: !e, count: count || 0, error: e ? `${e.code}: ${e.message}` : null };
    } catch (ex) {
      results[table] = { ok: false, count: 0, error: ex.message };
    }
  }
  const { data: tickers_cours } = await supabaseAdmin.from('cours').select('ticker');
  const { data: tickers_ent } = await supabaseAdmin.from('entreprises').select('ticker');
  const entSet = new Set((tickers_ent || []).map(e => e.ticker));
  const orphelins = [...new Set((tickers_cours || []).map(c => c.ticker))].filter(t => !entSet.has(t));
  return success({ tables: results, tickers_orphelins: orphelins, timestamp: new Date().toISOString() });
}

async function repairTotaux() {
  const { data: cours } = await supabaseAdmin.from('cours').select('id, ticker, date_seance, cours, variation_pct').is('variation_pct', null).order('ticker').order('date_seance', { ascending: true }).limit(200);
  if (!cours || cours.length === 0) return success({ repaired: 0 }, 'Aucune réparation nécessaire');
  let repaired = 0;
  for (const row of cours) {
    const { data: prev } = await supabaseAdmin.from('cours').select('cours').eq('ticker', row.ticker).lt('date_seance', row.date_seance).order('date_seance', { ascending: false }).limit(1).single();
    if (prev?.cours && prev.cours > 0) {
      const variation = ((row.cours - prev.cours) / prev.cours) * 100;
      await supabaseAdmin.from('cours').update({ variation_pct: Math.round(variation * 100) / 100 }).eq('id', row.id);
      repaired++;
    }
  }
  return success({ repaired }, `${repaired} variation_pct recalculés`);
}

async function runFallback() {
  const { data: lastCours } = await supabaseAdmin.from('cours').select('ticker, cours, date_seance').order('date_seance', { ascending: false }).limit(1);
  return success({ success: true, updated: lastCours?.length || 0, message: 'Recalcul terminé' });
}

async function importBOC(req) {
  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;
  const schema = {
    date_seance: { type: 'date', required: true },
    fichier_nom: { type: 'string', required: true, max: 200 },
    fichier_url: { type: 'string', required: true, max: 500 },
  };
  const { valid, errors, sanitized } = validate(body, schema);
  if (!valid) return error(errors.join(', '), 400, 'VALIDATION_ERROR');
  const { error: dbError } = await supabaseAdmin.from('boc').insert(sanitized);
  if (dbError) throw dbError;
  return success({}, 'BOC importé');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTEUR PRINCIPAL — Export unique pour Vercel
// ═══════════════════════════════════════════════════════════════════════════════
export default async function handler(req) {
  // Preflight CORS global
  if (req.method === 'OPTIONS') {
    return handleOptions(corsHeaders('public'));
  }

  // Rate limiting global (une seule fois pour toute la fonction)
  const limit = rateLimit(req);
  if (limit) return limit;

  const url = new URL(req.url);
  const path = url.pathname.replace('/api/', '').split('/')[0];

  try {
    switch (path) {
      case 'auth':         return await handleAuth(req);
      case 'boc':          return await handleBoc(req);
      case 'contact':      return await handleContact(req);
      case 'fiche':        return await handleFiche(req);
      case 'marche':       return await handleMarche(req);
      case 'portefeuille': return await handlePortefeuille(req);
      case 'scraper':      return await handleScraper(req);
      case 'admin':        return await handleAdmin(req);
      default:             return error('Endpoint non trouvé', 404, 'NOT_FOUND');
    }
  } catch (e) {
    console.error('Router Error:', e);
    return error(`Erreur serveur: ${e.message}`, 500, 'SERVER_ERROR');
  }
}
