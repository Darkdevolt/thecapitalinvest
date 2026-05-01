import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Variables d'environnement SUPABASE_URL et SUPABASE_SERVICE_KEY requises');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const calcFrais = (montant) => {
  const commission = montant * 0.012;
  const tva = commission * 0.18;
  const brvm = montant * 0.0007;
  const dcbr = montant * 0.0005;
  return {
    commission, tva, brvm, dcbr,
    total: commission + tva + brvm + dcbr
  };
};

const getUser = async (authHeader) => {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const user = await getUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  const { mode, type, id } = req.query;

  try {
    if (req.method === 'GET' && (mode === 'portefeuille' || type === 'positions')) {
      const { data: txs } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id);

      const positions = {};
      for (const tx of (txs || [])) {
        if (!positions[tx.ticker]) positions[tx.ticker] = { qte: 0, investi: 0 };
        const m = tx.quantite * tx.prix_unitaire;
        if (tx.type === 'ACHAT') {
          positions[tx.ticker].qte += tx.quantite;
          positions[tx.ticker].investi += m + tx.frais_total;
        } else {
          positions[tx.ticker].qte -= tx.quantite;
        }
      }

      const tickers = Object.keys(positions).filter(t => positions[t].qte > 0);
      const { data: cours } = await supabase
        .from('cours_brvm')
        .select('ticker, cours, nom')
        .in('ticker', tickers);

      const coursMap = new Map((cours || []).map(c => [c.ticker, c]));

      const data = tickers.map(t => {
        const p = positions[t];
        const c = coursMap.get(t);
        const valeur = p.qte * (c?.cours || 0);
        const investi = p.investi;
        return {
          ticker: t,
          nom: c?.nom || t,
          quantite: p.qte,
          cmp: investi / p.qte,
          cours_actuel: c?.cours || 0,
          valeur_actuelle: valeur,
          plus_value: valeur - investi,
          plus_value_pct: investi > 0 ? ((valeur - investi) / investi * 100).toFixed(2) : 0
        };
      });

      return res.status(200).json({ 
        data,
        total_investi: data.reduce((s, p) => s + p.investi, 0),
        total_valeur: data.reduce((s, p) => s + p.valeur_actuelle, 0)
      });
    }

    if (req.method === 'GET' && (mode === 'transactions' || type === 'transactions')) {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date_transaction', { ascending: false });
      return res.status(200).json({ data: data || [] });
    }

    if (req.method === 'POST') {
      const { ticker, type: tType, quantite, prix, date_transaction, note } = req.body;
      const montant = quantite * prix;
      const frais = calcFrais(montant);

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          ticker,
          type: tType,
          quantite,
          prix_unitaire: prix,
          montant_brut: montant,
          ...frais,
          montant_net: tType === 'ACHAT' ? montant + frais.total : montant - frais.total,
          date_transaction,
          note
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ data });
    }

    if (req.method === 'DELETE' && id) {
      await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
