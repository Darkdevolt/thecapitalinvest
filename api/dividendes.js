// api/dividendes.js — Calendrier des dividendes BRVM (données publiques)
import { createClient } from ‘@supabase/supabase-js’;

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘GET’) return res.status(405).json({ error: ‘Méthode non autorisée’ });

const { ticker, annee } = req.query;

let query = supabase
.from(‘dividendes_calendrier’)
.select(‘ticker, exercice, montant_net, rendement, ex_date, date_paiement’)
.order(‘exercice’, { ascending: false })
.order(‘ticker’, { ascending: true });

if (ticker) query = query.eq(‘ticker’, ticker.toUpperCase());
if (annee) query = query.eq(‘exercice’, parseInt(annee));

const { data, error } = await query;
if (error) return res.status(500).json({ error: error.message });

// Stats agrégées
const rdts = (data || []).filter(d => d.rendement).map(d => parseFloat(d.rendement));
const rdtMoyen = rdts.length ? (rdts.reduce((a, b) => a + b, 0) / rdts.length).toFixed(2) : null;
const societes = […new Set((data || []).map(d => d.ticker))].length;
const today = new Date().toISOString().split(‘T’)[0];
const prochain = (data || [])
.filter(d => d.date_paiement && d.date_paiement >= today)
.sort((a, b) => a.date_paiement.localeCompare(b.date_paiement))[0] || null;

return res.status(200).json({
data: data || [],
stats: { nb_societes: societes, rdt_moyen: rdtMoyen, prochain_paiement: prochain }
});
}