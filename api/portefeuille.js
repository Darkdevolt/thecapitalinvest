import { supabase, supabaseAdmin } from './lib/supabase.js';
import { json, error, success } from './lib/response.js';
import { rateLimit, authenticate, parseBody } from './lib/middleware.js';
import { validate } from './lib/validate.js';

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
  return {
    courtage,
    tva,
    brvm,
    dcbr,
    total: courtage + tva + brvm + dcbr,
  };
}

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

  const activePositions = [];
  let totalInvesti = 0;
  let totalValeur = 0;

  for (const [ticker, pos] of Object.entries(positions)) {
    if (pos.quantite <= 0) continue;

    const { data: cours } = await supabase
      .from('cours')
      .select('cours, nom')
      .eq('ticker', ticker)
      .order('date_seance', { ascending: false })
      .limit(1)
      .single();

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
    date_transaction: { type: 'string', required: true },
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
      montant_net: sanitized.type === 'ACHAT'
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
