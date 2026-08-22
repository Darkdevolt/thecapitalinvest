/**
 * Récupération d'une séance BRVM (lecture seule, aucune écriture en base).
 *
 * CORRECTIF DE SÉCURITÉ : cette route était ouverte à tous en POST. N'importe
 * qui pouvait déclencher en boucle quatre requêtes vers brvm.org depuis
 * l'infrastructure du site — coût de fonction, et risque de blocage de l'IP
 * sortante par la source. Elle exige désormais une session administrateur ou le
 * secret machine.
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
    return json(res, 200, { success: true, ...data });
  } catch (error) {
    console.error('[SCRAPE-BRVM]', error);
    return json(res, 502, {
      success: false,
      error: 'Source BRVM indisponible ou données non lisibles.',
      code: 'BRVM_SOURCE_ERROR'
    });
  }
}
