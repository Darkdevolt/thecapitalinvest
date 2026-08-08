import router from './index.js';
import { supabaseAdmin, isSupabaseReady } from './lib/supabase.js';
import { authenticate } from './lib/middleware.js';

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

function buildAbsoluteUrl(req) {
  const protocol = req.headers?.['x-forwarded-proto'] || 'https';
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host || 'localhost';
  return `${protocol}://${host}${req.url || '/api/portefeuille'}`;
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Requested-With');
  return res.end(JSON.stringify(payload));
}

async function getPortefeuille(userId) {
  if (!isSupabaseReady() || !supabaseAdmin) throw new Error('Supabase non configuré');

  const { data: transactions, error: txError } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date_transaction', { ascending: true });

  if (txError) throw txError;

  const positions = {};
  for (const tx of transactions || []) {
    const ticker = String(tx.ticker || '').toUpperCase();
    if (!ticker) continue;

    if (!positions[ticker]) {
      positions[ticker] = { quantite: 0, investi: 0, frais: 0 };
    }

    const qte = Number.parseInt(tx.quantite, 10) || 0;
    const prix = Number.parseFloat(tx.prix_unitaire) || 0;
    const montant = qte * prix;
    const frais = calculerFrais(montant).total;

    if (tx.type === 'ACHAT') {
      positions[ticker].quantite += qte;
      positions[ticker].investi += montant + frais;
      positions[ticker].frais += frais;
    } else if (tx.type === 'VENTE') {
      positions[ticker].quantite -= qte;
      positions[ticker].investi -= montant - frais;
      positions[ticker].frais += frais;
    }
  }

  const activeTickers = Object.entries(positions)
    .filter(([, position]) => position.quantite > 0)
    .map(([ticker]) => ticker);

  const coursMap = new Map();

  if (activeTickers.length > 0) {
    // The real schema has no cours.nom column. Fetch prices from cours and
    // company names separately from entreprises, then merge in application code.
    const [{ data: allCours, error: coursError }, { data: companies, error: companyError }] = await Promise.all([
      supabaseAdmin
        .from('cours')
        .select('ticker, cours, date_seance')
        .in('ticker', activeTickers)
        .order('date_seance', { ascending: false }),
      supabaseAdmin
        .from('entreprises')
        .select('ticker, nom, nom_court')
        .in('ticker', activeTickers),
    ]);

    if (coursError) throw coursError;
    if (companyError) throw companyError;

    const nameMap = new Map(
      (companies || []).map(company => [
        company.ticker,
        company.nom || company.nom_court || company.ticker,
      ])
    );

    for (const row of allCours || []) {
      if (!coursMap.has(row.ticker)) {
        coursMap.set(row.ticker, {
          ...row,
          nom: nameMap.get(row.ticker) || row.ticker,
        });
      }
    }
  }

  const activePositions = [];
  let totalInvesti = 0;
  let totalValeur = 0;

  for (const [ticker, position] of Object.entries(positions)) {
    if (position.quantite <= 0) continue;

    const cours = coursMap.get(ticker);
    const coursActuel = Number.parseFloat(cours?.cours || 0);
    const valeur = position.quantite * coursActuel;
    const cmp = position.quantite > 0 ? position.investi / position.quantite : 0;
    const plusValue = valeur - position.investi;
    const plusValuePct = position.investi > 0 ? (plusValue / position.investi) * 100 : 0;

    totalInvesti += position.investi;
    totalValeur += valeur;

    activePositions.push({
      ticker,
      nom: cours?.nom || ticker,
      quantite: position.quantite,
      cmp: Math.round(cmp * 100) / 100,
      cours_actuel: coursActuel,
      valeur_actuelle: Math.round(valeur * 100) / 100,
      plus_value: Math.round(plusValue * 100) / 100,
      plus_value_pct: Math.round(plusValuePct * 100) / 100,
    });
  }

  return {
    success: true,
    data: activePositions,
    total_investi: Math.round(totalInvesti * 100) / 100,
    total_valeur: Math.round(totalValeur * 100) / 100,
  };
}

function toWebRequest(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  }

  return new Request(buildAbsoluteUrl(req), {
    method: req.method,
    headers,
    ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: req } : {}),
    duplex: 'half',
  });
}

async function sendWebResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  return res.end(Buffer.from(await response.arrayBuffer()));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return json(res, 204, null);
  }

  try {
    const url = new URL(buildAbsoluteUrl(req));
    const mode = url.searchParams.get('mode');

    // Only the portfolio valuation path needs the schema compatibility fix.
    // Other portfolio modes remain on the existing business router.
    if (req.method === 'GET' && mode === 'portefeuille') {
      const auth = await authenticate(req);
      if (auth.response) return sendWebResponse(res, auth.response);

      const result = await getPortefeuille(auth.user.sub);
      res.setHeader('Cache-Control', 'private, no-store');
      return json(res, 200, result);
    }

    const webRequest = toWebRequest(req);
    const webResponse = await router(webRequest);
    return sendWebResponse(res, webResponse);
  } catch (error) {
    console.error('[PORTFOLIO ADAPTER] Fatal error:', error);
    return json(res, 500, {
      success: false,
      error: 'Internal server error',
    });
  }
}
