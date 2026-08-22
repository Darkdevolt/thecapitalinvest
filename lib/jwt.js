/**
 * Extraction du jeton porteur.
 *
 * Les fonctions signToken/verifyToken (jose) ont été retirées : l'application
 * délègue entièrement l'authentification à Supabase, et elles s'appuyaient sur
 * un secret dont la valeur de repli littérale était 'unused' — un jeton signé
 * avec ce secret aurait été forgeable par quiconque lisait le dépôt.
 */
export function extractBearer(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}
