/**
 * Récupération du marché obligataire BRVM et écriture en base.
 *
 * POST — réservé à une session administrateur ou au secret machine (comme
 * api/scrape-brvm.js). Lit brvm.org/fr/cours-obligations/0, met à jour la
 * table `obligations` (clé : code) et `obligations_marche` (clé : date_seance).
 * Aucune donnée n'est estimée : une ligne sans cours reste écrite avec cours
 * null, une source illisible renvoie une erreur 502 sans rien toucher.
 */
import { scrapeBrvmObligations } from '../lib/brvm-obligations-scraper.js';
import { authenticateAdmin, isMachineRequest, rateLimited, handlePreflight } from '../lib/middleware.js';
import { json, fail } from '../lib/http.js';
import { supabaseAdmin, isSupabaseReady } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (handlePreflight(req, res, { methods: 'GET,POST,OPTIONS' })) return;
  // GET est réservé au cron Vercel (secret machine) ; POST à l'administrateur
  // ou à la machine. Toute autre méthode est refusée.
  const machine = isMachineRequest(req);
  if (req.method === 'GET' && !machine) return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
  if (req.method !== 'GET' && req.method !== 'POST') return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
  if (rateLimited(req, res, 'scrape')) return;

  if (!machine) {
    const admin = await authenticateAdmin(req, res);
    if (!admin) return;
  }

  if (!isSupabaseReady() || !supabaseAdmin) {
    return fail(res, 503, 'Service temporairement indisponible.', 'SERVICE_UNAVAILABLE');
  }

  let scraped;
  try {
    scraped = await scrapeBrvmObligations();
  } catch (error) {
    console.error('[OBLIGATIONS-SYNC] source', error);
    return json(res, 502, {
      success: false,
      error: 'Source BRVM obligations indisponible ou non lisible.',
      code: 'BRVM_SOURCE_ERROR'
    });
  }

  try {
    const now = new Date().toISOString();
    const rows = scraped.rows.map(r => ({ ...r, updated_at: now }));

    const { error: e1 } = await supabaseAdmin
      .from('obligations')
      .upsert(rows, { onConflict: 'code' });
    if (e1) throw e1;

    const { error: e2 } = await supabaseAdmin
      .from('obligations_marche')
      .upsert({ ...scraped.marche, updated_at: now }, { onConflict: 'date_seance' });
    if (e2) throw e2;

    return json(res, 200, {
      success: true,
      date_seance: scraped.date_seance,
      lignes: rows.length,
      marche: scraped.marche,
      source: scraped.source
    });
  } catch (error) {
    console.error('[OBLIGATIONS-SYNC] write', error);
    return fail(res, 500, 'Écriture des obligations impossible.', 'OBLIGATIONS_WRITE_ERROR', error);
  }
}
