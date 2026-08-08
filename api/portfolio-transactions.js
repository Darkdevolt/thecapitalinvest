import { supabaseAdmin, isSupabaseReady } from './lib/supabase.js';
import { authenticate, parseBody } from './lib/middleware.js';

const FRAIS = { courtage: 0.012, tva: 0.18, brvm: 0.0007, dcbr: 0.0005 };

function fees(amount) {
  const commission = amount * FRAIS.courtage;
  const tva = commission * FRAIS.tva;
  const brvm = amount * FRAIS.brvm;
  const dcbr = amount * FRAIS.dcbr;
  return { commission, tva, brvm, dcbr, total: commission + tva + brvm + dcbr };
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Requested-With');
  return res.end(JSON.stringify(payload));
}

function body(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, null);
  if (!isSupabaseReady() || !supabaseAdmin) return json(res, 503, { success: false, error: 'Supabase non configuré' });

  const auth = await authenticate(req);
  if (auth.response) return res.end(Buffer.from(await auth.response.arrayBuffer()));
  const userId = auth.user.sub;

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date_transaction', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return json(res, 200, { success: true, data: data || [] });
    }

    if (req.method === 'POST') {
      const input = await body(req);
      const type = String(input.type || '').toUpperCase();
      const ticker = String(input.ticker || '').toUpperCase().trim();
      const quantity = Number(input.quantity ?? input.quantite);
      const price = Number(input.price ?? input.cours ?? input.prix_unitaire);
      const date = String(input.date || input.date_transaction || new Date().toISOString().slice(0, 10));

      if (!['ACHAT', 'VENTE'].includes(type)) return json(res, 400, { success: false, error: 'Type de transaction invalide' });
      if (!ticker || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
        return json(res, 400, { success: false, error: 'Ticker, quantité et prix sont obligatoires' });
      }

      if (type === 'VENTE') {
        const { data: existing, error: existingError } = await supabaseAdmin
          .from('transactions').select('type,quantite').eq('user_id', userId).eq('ticker', ticker);
        if (existingError) throw existingError;
        const held = (existing || []).reduce((sum, tx) => sum + (tx.type === 'ACHAT' ? Number(tx.quantite) : -Number(tx.quantite)), 0);
        if (quantity > held) return json(res, 400, { success: false, error: `Quantité détenue insuffisante (${held})` });
      }

      const amount = quantity * price;
      const f = fees(amount);
      const row = {
        user_id: userId,
        ticker,
        type,
        quantite: quantity,
        cours: price,
        prix_unitaire: price,
        date_transaction: date,
        commission: f.commission,
        tva_commission: f.tva,
        redevance_brvm: f.brvm,
        redevance_dcbr: f.dcbr,
        total_frais: f.total,
        montant_brut: amount,
        frais_total: f.total,
        montant_net: type === 'ACHAT' ? amount + f.total : amount - f.total,
        cout_net_unitaire: type === 'ACHAT' ? (amount + f.total) / quantity : (amount - f.total) / quantity,
        societe: input.societe || null,
        remarque: input.note || input.remarque || null,
      };

      const { data, error } = await supabaseAdmin.from('transactions').insert(row).select('*').single();
      if (error) throw error;
      return json(res, 201, { success: true, data });
    }

    if (req.method === 'DELETE') {
      const id = String(new URL(req.url, `https://${req.headers.host || 'localhost'}`).searchParams.get('id') || '');
      if (!id) return json(res, 400, { success: false, error: 'ID manquant' });
      const { error } = await supabaseAdmin.from('transactions').delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
      return json(res, 200, { success: true });
    }

    return json(res, 405, { success: false, error: 'Méthode non autorisée' });
  } catch (error) {
    console.error('[PORTFOLIO TRANSACTIONS]', error);
    return json(res, 500, { success: false, error: 'Erreur serveur', detail: error.message });
  }
}
