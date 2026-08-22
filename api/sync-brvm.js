/**
 * Alias de compatibilité pour les appelants historiques.
 *
 * CORRECTIFS : l'ancienne version relayait la requête vers /api/scrape-brvm par
 * un appel HTTP sortant vers son propre domaine — une fonction serverless qui
 * s'invoque elle-même, avec le coût et la latence correspondants. Elle acceptait
 * en outre les requêtes GET non authentifiées. Le scraping est maintenant appelé
 * en direct, sous les mêmes conditions d'accès que /api/scrape-brvm.
 */
import { scrapeBrvm } from '../lib/brvm-scraper.js';
import { authenticateAdmin, isMachineRequest, rateLimited, handlePreflight } from '../lib/middleware.js';
import { json, fail } from '../lib/http.js';

export default async function handler(req, res) {
  if (handlePreflight(req, res, { methods: 'POST,OPTIONS' })) return;
  if (req.method !== 'POST') return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
  if (rateLimited(req, res, 'scrape')) return;

  if (!isMachineRequest(req)) {
    const admin = await authenticateAdmin(req, res);
    if (!admin) return;
  }

  try {
    const data = await scrapeBrvm();
    return json(res, 200, { success: true, deprecated: 'Utilisez /api/scrape-brvm', ...data });
  } catch (error) {
    console.error('[SYNC-BRVM]', error);
    return json(res, 502, {
      success: false,
      error: 'Source BRVM indisponible ou données non lisibles.',
      code: 'BRVM_SOURCE_ERROR'
    });
  }
}
