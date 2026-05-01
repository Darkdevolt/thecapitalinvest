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
  res.setHeader('Content-Type', 'application/json');

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Ticker requis' });

  try {
    const [
      { data: entreprise },
      { data: cours },
      { data: historique },
      { data: financials },
      { data: analyses }
    ] = await Promise.all([
      supabase.from('entreprises').select('*').eq('ticker', ticker).single(),
      supabase.from('cours_brvm').select('*').eq('ticker', ticker).order('date_seance', { ascending: false }).limit(1).single(),
      supabase.from('cours_brvm').select('date_seance, cloture, cours').eq('ticker', ticker).order('date_seance', { ascending: false }).limit(252),
      supabase.from('financials_annuels').select('*').eq('ticker', ticker).order('annee', { ascending: false }),
      supabase.from('analyses').select('*').eq('ticker', ticker).order('date_analyse', { ascending: false })
    ]);

    // Valuation
    const lastCours = cours?.cours || cours?.cloture;
    const f = financials?.[0];
    const valuation = {};
    if (lastCours && f) {
      valuation.per = f.bpa > 0 ? (lastCours / f.bpa).toFixed(2) : null;
      valuation.rdt = f.dpa > 0 ? ((f.dpa / lastCours) * 100).toFixed(2) : null;
    }

    return res.status(200).json({
      entreprise,
      cours,
      historique: historique || [],
      financials: financials || [],
      analyses: analyses || [],
      valuation,
      chartData: (historique || []).map(h => ({
        date_seance: h.date_seance,
        cloture: h.cloture || h.cours
      })).reverse()
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
