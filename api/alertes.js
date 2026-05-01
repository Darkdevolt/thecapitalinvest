// api/alertes.js — Gestion des alertes de cours
import { createClient } from '@supabase/supabase-js';

// ── VALIDATION DES VARIABLES D'ENVIRONNEMENT ──
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Variables d\'environnement SUPABASE_URL et SUPABASE_SERVICE_KEY requises');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Token invalide' });

  // GET — Récupérer toutes les alertes + statut déclenchement vs cours actuel
  if (req.method === 'GET') {
    const { data: alertes, error } = await supabase
      .from('alertes_cours')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Enrichir avec cours actuels
    const tickers = [...new Set((alertes || []).map(a => a.ticker))];
    let cours = [];
    if (tickers.length > 0) {
      const { data: c } = await supabase
        .from('cours_brvm')
        .select('ticker, cours')
        .in('ticker', tickers);
      cours = c || [];
    }

    const enriched = (alertes || []).map(a => {
      const c = cours.find(x => x.ticker === a.ticker);
      const coursCurrent = c ? parseFloat(c.cours) : null;
      const seuil = parseFloat(a.seuil);
      const triggered = coursCurrent !== null && (
        (a.type_alerte === 'HAUSSE' && coursCurrent >= seuil) ||
        (a.type_alerte === 'BAISSE' && coursCurrent <= seuil)
      );
      return { ...a, cours_actuel: coursCurrent, triggered };
    });

    return res.status(200).json({ data: enriched });
  }

  // POST — Créer une alerte
  if (req.method === 'POST') {
    const { ticker, type_alerte, seuil, note } = req.body || {};
    if (!ticker || !type_alerte || !seuil) {
      return res.status(400).json({ error: 'Ticker, type et seuil requis' });
    }
    if (!['HAUSSE', 'BAISSE'].includes(type_alerte)) {
      return res.status(400).json({ error: 'Type invalide : HAUSSE ou BAISSE' });
    }

    const { data, error } = await supabase
      .from('alertes_cours')
      .insert({
        user_id: user.id,
        ticker: ticker.toUpperCase(),
        type_alerte,
        seuil: parseFloat(seuil),
        note: note || null,
        active: true
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ data });
  }

  // DELETE — Supprimer une alerte
  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'ID requis' });

    const { error } = await supabase
      .from('alertes_cours')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}
