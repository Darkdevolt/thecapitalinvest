// api/watchlist.js — Gestion de la watchlist utilisateur
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

  // Récupérer l'utilisateur depuis le token
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Token invalide' });

  // GET — Récupérer la watchlist avec les cours actuels
  if (req.method === 'GET') {
    const { data: wl, error } = await supabase
      .from('watchlist')
      .select('id, ticker, note, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Enrichir avec les cours depuis cours_brvm
    const tickers = wl.map(w => w.ticker);
    let cours = [];
    if (tickers.length > 0) {
      const { data: c } = await supabase
        .from('cours_brvm')
        .select('ticker, societe, cours, variation')
        .in('ticker', tickers);
      cours = c || [];
    }

    const enriched = wl.map(w => {
      const c = cours.find(x => x.ticker === w.ticker);
      return { ...w, nom: c?.societe || null, cours: c?.cours || null, variation: c?.variation || null };
    });

    return res.status(200).json({ data: enriched });
  }

  // POST — Ajouter un titre
  if (req.method === 'POST') {
    const { ticker, note } = req.body || {};
    if (!ticker) return res.status(400).json({ error: 'Ticker requis' });

    // Vérifier que le ticker existe
    const { data: e } = await supabase
     
