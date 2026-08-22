/**
 * Liste des Bulletins Officiels de la Cote (lecture publique).
 * CORRECTIFS : en-têtes CORS cohérents, méthode OPTIONS traitée, pagination
 * bornée et message d'erreur interne non divulgué.
 */
import { supabase, supabaseAdmin } from '../lib/supabase.js';
import { json, fail, applyCors } from '../lib/http.js';
import { rateLimited } from '../lib/middleware.js';

const db = supabaseAdmin || supabase;

/** Numéro de séance déduit du nom de fichier (BOC_20260814_123.pdf). */
function sessionNumber(filename) {
  const match = String(filename || '').match(/(?:boc[_-]?20\d{6}[_-]?)(\d+)/i);
  return match ? Number(match[1]) : null;
}

export default async function handler(req, res) {
  applyCors(req, res, { scope: 'public', methods: 'GET,OPTIONS' });
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'GET') return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
  if (rateLimited(req, res, 'boc')) return;
  if (!db) return fail(res, 503, 'Service temporairement indisponible.', 'SERVICE_UNAVAILABLE');

  try {
    const { data, error } = await db.from('boc').select('*')
      .order('date_seance', { ascending: false }).limit(500);
    if (error) throw error;
    const rows = (data || []).map(r => ({
      ...r,
      pdf_url: r.fichier_url,
      numero_seance: sessionNumber(r.fichier_nom),
      annee: String(r.date_seance || '').slice(0, 4)
    }));
    return json(res, 200, { success: true, data: rows });
  } catch (error) {
    return fail(res, 500, 'Erreur serveur.', 'BOC_ERROR', error);
  }
}
