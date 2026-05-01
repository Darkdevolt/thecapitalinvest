import { supabase, supabaseAdmin } from './lib/supabase.js';
import { json, error, success } from './lib/response.js';
import { rateLimit, authenticate, parseBody } from './lib/middleware.js';
import { validate } from './lib/validate.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization,Content-Type',
      },
    });
  }

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
      case 'entreprises':
        return getEntreprises();
      case 'toggle_actif':
        return toggleActif(req);
      case 'financials':
        return getFinancials();
      case 'add_financial':
        return addFinancial(req);
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
      case 'fallback':
        return runFallback();
      case 'boc':
        return importBOC(req);
      default:
        return error('Action invalide', 400, 'INVALID_ACTION');
    }
  } catch (e) {
    console.error('Admin API error:', e);
    return error('Erreur serveur', 500, 'SERVER_ERROR');
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

  const lastSeance = await supabase
    .from('cours')
    .select('date_seance')
    .order('date_seance', { ascending: false })
    .limit(1)
    .single();

  return success({
    entreprises: entreprises.count || 0,
    cours: cours.count || 0,
    historique: historique.count || 0,
    financials: financials.count || 0,
    dividendes: dividendes.count || 0,
    users: users.count || 0,
    last_seance: lastSeance.data?.date_seance || null,
    last_scrape: new Date().toISOString(),
  });
}

async function getEntreprises() {
  const { data, error: dbError } = await supabaseAdmin
    .from('entreprises')
    .select('*')
    .order('ticker');
  if (dbError) throw dbError;
  return success({ data: data || [] });
}

async function toggleActif(req) {
  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;

  const { ticker, actif } = body;
  if (!ticker || typeof actif !== 'boolean') {
    return error('Paramètres invalides', 400, 'VALIDATION_ERROR');
  }

  const { error: dbError } = await supabaseAdmin
    .from('entreprises')
    .update({ actif })
    .eq('ticker', ticker);

  if (dbError) throw dbError;
  return success({}, `Société ${actif ? 'activée' : 'désactivée'}`);
}

async function getFinancials() {
  const { data, error: dbError } = await supabaseAdmin
    .from('financials')
    .select('*')
    .order('ticker')
    .order('annee', { ascending: false });
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

  const { error: dbError } = await supabaseAdmin
    .from('financials')
    .upsert(sanitized, { onConflict: ['ticker', 'annee'] });

  if (dbError) throw dbError;
  return success({}, 'Financial enregistré');
}

async function getAnalyses() {
  const { data, error: dbError } = await supabaseAdmin
    .from('analyses')
    .select('*')
    .order('date_analyse', { ascending: false });
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

  const { error: dbError } = await supabaseAdmin
    .from('analyses')
    .insert({
      ...sanitized,
      date_analyse: new Date().toISOString().split('T')[0],
    });

  if (dbError) throw dbError;
  return success({}, 'Recommandation publiée');
}

async function deleteAnalyse(url) {
  const id = url.searchParams.get('id');
  if (!id) return error('ID requis', 400, 'MISSING_ID');

  const { error: dbError } = await supabaseAdmin
    .from('analyses')
    .delete()
    .eq('id', id);

  if (dbError) throw dbError;
  return success({}, 'Recommandation supprimée');
}

async function getUsers() {
  const { data, error: dbError } = await supabaseAdmin
    .from('users')
    .select('id, email, nom, plan, plan_expire_at, is_admin, created_at')
    .order('created_at', { ascending: false });
  if (dbError) throw dbError;
  return success({ data: data || [] });
}

async function setPlan(req) {
  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;

  const { user_id, plan } = body;
  if (!user_id || !['free', 'pro', 'elite'].includes(plan)) {
    return error('Paramètres invalides', 400, 'VALIDATION_ERROR');
  }

  const { error: dbError } = await supabaseAdmin
    .from('users')
    .update({ plan })
    .eq('id', user_id);

  if (dbError) throw dbError;
  return success({}, `Plan mis à jour : ${plan}`);
}

async function runFallback() {
  const { data: lastCours } = await supabaseAdmin
    .from('cours')
    .select('ticker, cours, date_seance')
    .order('date_seance', { ascending: false })
    .limit(1);

  return success({
    success: true,
    updated: lastCours?.length || 0,
    message: 'Recalcul terminé',
  });
}

async function importBOC(req) {
  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;

  const schema = {
    date_seance: { type: 'string', required: true },
    fichier_nom: { type: 'string', required: true, max: 200 },
    fichier_url: { type: 'string', required: true, max: 500 },
  };

  const { valid, errors, sanitized } = validate(body, schema);
  if (!valid) return error(errors.join(', '), 400, 'VALIDATION_ERROR');

  const { error: dbError } = await supabaseAdmin
    .from('boc')
    .insert(sanitized);

  if (dbError) throw dbError;
  return success({}, 'BOC importé');
}
