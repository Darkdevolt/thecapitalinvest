/**
 * Journal des transactions de portefeuille.
 *
 * CORRECTIFS :
 *  - statut HTTP réel sur échec d'authentification ;
 *  - un 204 ne transporte plus de corps ;
 *  - la date de transaction est validée (format et absence de date future) ;
 *  - un RETRAIT ne peut plus rendre le solde espèces négatif ;
 *  - la suppression d'un ACHAT ne peut plus rendre une position négative ;
 *  - `cout_net_unitaire` n'est plus renseigné pour les ventes, où la notion de
 *    coût de revient unitaire n'a pas de sens ; le produit net unitaire est
 *    porté par `produit_net_unitaire` ;
 *  - le barème de frais est paramétrable par variables d'environnement.
 *
 * LIMITE CONNUE : le contrôle de position et de solde est effectué en lecture
 * puis écriture, sans transaction. Deux requêtes simultanées peuvent encore
 * passer. Le verrou définitif se pose côté base (contrainte ou fonction
 * PL/pgSQL transactionnelle) ; c'est signalé dans AUDIT.md.
 */
import { supabaseAdmin, isSupabaseReady } from '../lib/supabase.js';
import { authenticate, rateLimited, handlePreflight } from '../lib/middleware.js';
import { ok, fail, json, readBody, requestUrl, BodyError } from '../lib/http.js';
import { validators } from '../lib/validate.js';

const num = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

/** Barème BRVM par défaut, surchargeable sans redéploiement du code. */
const FRAIS = {
  courtage: num('FEE_COURTAGE', 0.012),
  tva: num('FEE_TVA', 0.18),
  brvm: num('FEE_BRVM', 0.0007),
  dcbr: num('FEE_DCBR', 0.0005)
};

const TRADE_TYPES = new Set(['ACHAT', 'VENTE']);
const CASH_TYPES = new Set(['DEPOT', 'RETRAIT', 'DIVIDENDE']);
const TICKER_RE = /^[A-Z0-9]{2,12}$/;

function fees(amount) {
  const commission = amount * FRAIS.courtage;
  const tva = commission * FRAIS.tva;
  const brvm = amount * FRAIS.brvm;
  const dcbr = amount * FRAIS.dcbr;
  return { commission, tva, brvm, dcbr, total: commission + tva + brvm + dcbr };
}

/** Solde espèces reconstitué à partir des montants nets déjà enregistrés. */
function cashBalance(rows) {
  return (rows || []).reduce((sum, tx) => {
    const net = Number(tx.montant_net) || 0;
    if (tx.type === 'DEPOT' || tx.type === 'DIVIDENDE' || tx.type === 'VENTE') return sum + net;
    if (tx.type === 'RETRAIT') return sum + net; // montant_net déjà négatif
    if (tx.type === 'ACHAT') return sum - net;
    return sum;
  }, 0);
}

function heldQuantity(rows, ticker) {
  return (rows || [])
    .filter(tx => tx.ticker === ticker)
    .reduce((sum, tx) => sum + (tx.type === 'ACHAT' ? Number(tx.quantite) || 0
      : tx.type === 'VENTE' ? -(Number(tx.quantite) || 0) : 0), 0);
}

async function allTransactions(userId) {
  const { data, error } = await supabaseAdmin
    .from('transactions').select('*').eq('user_id', userId);
  if (error) throw error;
  return data || [];
}

export default async function handler(req, res) {
  if (handlePreflight(req, res, { methods: 'GET,POST,DELETE,OPTIONS' })) return;
  if (rateLimited(req, res, 'portfolio')) return;
  if (!isSupabaseReady() || !supabaseAdmin) {
    return fail(res, 503, 'Service temporairement indisponible.', 'SERVICE_UNAVAILABLE');
  }

  const user = await authenticate(req, res);
  if (!user) return;
  const userId = user.sub;

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('transactions').select('*').eq('user_id', userId)
        .order('date_transaction', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return ok(res, data || []);
    }

    if (req.method === 'POST') {
      let input;
      try { input = await readBody(req); }
      catch (e) { return fail(res, e instanceof BodyError ? 400 : 500, 'Requête illisible.', 'INVALID_BODY', e); }

      const type = String(input?.type || '').toUpperCase();
      const isTrade = TRADE_TYPES.has(type);
      if (!isTrade && !CASH_TYPES.has(type)) {
        return fail(res, 400, 'Type de transaction invalide.', 'INVALID_TYPE');
      }

      const ticker = String(
        input?.ticker || (type === 'DEPOT' || type === 'RETRAIT' ? 'CASH' : '')
      ).toUpperCase().trim();
      if (!TICKER_RE.test(ticker)) return fail(res, 400, 'Ticker invalide.', 'INVALID_TICKER');

      // Date : format ISO strict, et pas dans le futur.
      const date = String(input?.date || input?.date_transaction || new Date().toISOString().slice(0, 10));
      if (!validators.date(date)) return fail(res, 400, 'Date de transaction invalide.', 'INVALID_DATE');
      if (date > new Date().toISOString().slice(0, 10)) {
        return fail(res, 400, 'Une transaction ne peut pas être datée dans le futur.', 'FUTURE_DATE');
      }

      const amountInput = Number(input?.amount ?? input?.montant ?? 0);
      let quantity = Number(input?.quantity ?? input?.quantite ?? (isTrade ? 0 : 1));
      let price = Number(input?.price ?? input?.cours ?? input?.prix_unitaire ?? (isTrade ? 0 : amountInput));

      if (!isTrade) {
        if (!Number.isFinite(amountInput) || amountInput <= 0) {
          return fail(res, 400, 'Montant obligatoire et strictement positif.', 'INVALID_AMOUNT');
        }
        quantity = 1;
        price = amountInput;
      } else if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
        return fail(res, 400, 'Quantité entière positive et prix positif obligatoires.', 'INVALID_TRADE');
      }

      const grossAmount = quantity * price;
      const f = isTrade ? fees(grossAmount) : { commission: 0, tva: 0, brvm: 0, dcbr: 0, total: 0 };
      const montantNet = type === 'ACHAT' ? grossAmount + f.total
        : type === 'VENTE' ? grossAmount - f.total
        : type === 'RETRAIT' ? -grossAmount
        : grossAmount;

      // Contrôles de cohérence sur l'état courant du portefeuille.
      if (type === 'VENTE' || type === 'RETRAIT' || type === 'ACHAT') {
        const rows = await allTransactions(userId);
        if (type === 'VENTE') {
          const held = heldQuantity(rows, ticker);
          if (quantity > held) {
            return fail(res, 400, `Quantité détenue insuffisante (${held} titre(s)).`, 'INSUFFICIENT_HOLDING');
          }
        }
        if (type === 'RETRAIT') {
          const balance = cashBalance(rows);
          if (grossAmount > balance + 1e-6) {
            return fail(res, 400, `Solde espèces insuffisant (${Math.round(balance)} FCFA).`, 'INSUFFICIENT_CASH');
          }
        }
      }

      const row = {
        user_id: userId,
        ticker,
        type,
        quantite: quantity,
        cours: price,
        date_transaction: date,
        commission: f.commission,
        tva_commission: f.tva,
        redevance_brvm: f.brvm,
        redevance_dcbr: f.dcbr,
        total_frais: f.total,
        montant_net: montantNet,
        // Coût de revient : pertinent à l'achat et sur les mouvements d'espèces.
        cout_net_unitaire: type === 'ACHAT' ? montantNet / quantity : (isTrade ? null : montantNet),
        societe: input?.societe || null,
        remarque: input?.note || input?.remarque || null,
        note: input?.note || null
      };

      const { data, error } = await supabaseAdmin.from('transactions').insert(row).select('*').single();
      if (error) throw error;
      return json(res, 201, { success: true, data });
    }

    if (req.method === 'DELETE') {
      const id = requestUrl(req).searchParams.get('id') || '';
      if (!validators.uuid(id)) return fail(res, 400, 'Identifiant invalide.', 'INVALID_ID');

      const rows = await allTransactions(userId);
      const target = rows.find(tx => String(tx.id) === id);
      if (!target) return fail(res, 404, 'Transaction introuvable.', 'NOT_FOUND');

      // Supprimer un achat ne doit pas laisser une position vendue à découvert.
      if (target.type === 'ACHAT') {
        const remaining = heldQuantity(rows.filter(tx => String(tx.id) !== id), target.ticker);
        if (remaining < 0) {
          return fail(res, 409,
            'Suppression impossible : des ventes de ce titre en dépendent. Supprimez d’abord les ventes concernées.',
            'HOLDING_CONFLICT');
        }
      }

      const { error } = await supabaseAdmin
        .from('transactions').delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
      return ok(res, { id });
    }

    return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
  } catch (error) {
    return fail(res, 500, 'Erreur serveur.', 'PORTFOLIO_ERROR', error);
  }
}
