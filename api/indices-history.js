import { supabase, supabaseAdmin } from '../lib/supabase.js';

const db = supabaseAdmin || supabase;

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.end(JSON.stringify(payload));
}

function normalizeName(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s_-]+/g, ' ').replace(/\s+/g, ' ');
}

function isWantedIndex(name) {
  const n = normalizeName(name);
  return n === 'BRVM C' || n === 'BRVM COMPOSITE' || n === 'COMPOSITE' ||
    n === 'BRVM 30' || n === 'BRVM30' || n === 'BRVM 30 INDEX' || n === '30' ||
    n === 'BRVM PRESTIGE' || n === 'BRVM PRESTIGE INDEX' || n === 'PRESTIGE';
}

function indexValue(row) {
  for (const candidate of [row?.valeur, row?.value, row?.valeur_indice, row?.cours, row?.cours_cloture, row?.cloture]) {
    const value = Number(candidate);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method Not Allowed' });
  try {
    if (!db) throw new Error('Supabase non configuré');
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 1000, 30), 5000);
    const result = await db.from('indices').select('*').not('date_seance', 'is', null).order('date_seance', { ascending: false }).limit(Math.min(limit * 20, 20000));
    if (result.error) throw result.error;

    const rows = Array.isArray(result.data) ? result.data : [];
    const groups = new Map();
    rows.filter(row => isWantedIndex(row?.indice) && indexValue(row) !== null).forEach(row => {
      const normalized = normalizeName(row.indice);
      if (!groups.has(normalized)) groups.set(normalized, []);
      groups.get(normalized).push({ ...row, valeur: indexValue(row) });
    });

    const selected = [];
    groups.forEach(group => {
      group.sort((a, b) => String(a.date_seance).localeCompare(String(b.date_seance)));
      selected.push(...group.slice(-limit));
    });
    selected.sort((a, b) => String(a.date_seance).localeCompare(String(b.date_seance)));
    return json(res, 200, selected);
  } catch (error) {
    console.error('[API/INDICES-HISTORY]', error);
    return json(res, 500, { error: error.message || 'Erreur serveur' });
  }
}
