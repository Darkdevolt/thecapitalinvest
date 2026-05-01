import { createClient } from '@supabase/supabase-js';

// ── VALIDATION DES VARIABLES D'ENVIRONNEMENT ──
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Variables d\'environnement SUPABASE_URL et SUPABASE_SERVICE_KEY requises');
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
    // GET - Positions
    if (req.method === 'GET' &&
