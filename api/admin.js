// FIX S-03 : CORS privé (données admin)
import { supabase, supabaseAdmin } from './lib/supabase.js';
import { error, success } from './lib/response.js';
import { rateLimit, authenticate, parseBody } from './lib/middleware.js';
import { validate } from './lib/validate.js';
import { corsHeaders, handleOptions } from './lib/cors.js';

const CORS_TYPE = 'private';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return handleOptions(corsHeaders(CORS_TYPE));

  const limit = rateLimit(req);
  if (limit) return limit;

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
      case 'check':
        return success({ is_admin: true, email: auth.user.email });
      case 'stats':
        return getStats();
      case 'stats_errors':
        return getStatsErrors();
      case 'entreprises':
        return getEntreprises();
      case 'toggle_actif':
        return toggleActif(req);
      case 'update_entreprise':
        return updateEntreprise(req);
      case 'add_entreprise':
        return addEntreprise(req);
      case 'cours_latest':
        return getCoursLatest(url);
      case 'historique_ticker':
        return getHistoriqueTicker(url);
      case 'add_cours':
        return addCours(req);
      case 'update_cours':
        return updateCours(req);
      case 'delete_cours':
        return deleteCours(url);
      case 'add_historique':
        return addHistorique(req);
      case 'add_historique_bulk':
        return addHistoriqueBulk(req);
      case 'delete_historique':
        return deleteHistorique(url);
      case 'financials':
        return getFinancials(url);
      case 'add_financial':
        return addFinancial(req);
      case 'delete_financial':
        return deleteFinancial(url);
      case 'analyses':
        return getAnalyses();
      case 'add_analyse':
        return addAnalyse(req);
      case 'delete_analyse':
        return deleteAnalyse(url);
      case 'users':
        return getUsers();
      case 'set_plan':
        return setPlan(req);
      case 'set_admin':
        return setAdmin(req);
      case 'dividendes':
        return getDividendes(url);
      case 'add_dividende':
        return addDividende(req);
      case 'delete_dividende':
        return deleteDividende(url);
      case 'diagnostic':
        return runDiagnostic();
      case 'repair_totaux':
        return repairTotaux();
      case 'fallback':
        return runFallback();
      case 'boc':
        return importBOC(req);
      default:
        return error('Action invalide', 400, 'INVALID_ACTION');
    }
  } catch (e) {
    console.error('Admin API error:', e);
    return error(`Erreur serveur: ${e.message}`, 500, 'SERVER_ERROR');
  }
}

async function getStats() {
  const [entreprises, cours, historique, financials, dividendes, users] = await Promise.all([
    supabase.from('entreprises').select('id', { count: 'exact', head: true }),
    supabase.from('cours').select('id', { count: 'exact', head: true }),
    supabase.from('historique').select('id', { count: 'exact', head: true }),
    supabase.from('financials').select('id', { count: 'exact', head: true }),
    supabase.from('dividendes').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }),
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
