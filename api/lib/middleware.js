import { checkRateLimit } from './ratelimit.js';
import { verifyToken, extractBearer } from './jwt.js';
import { unauthorized, tooManyRequests, error } from './response.js';

/**
 * Applique le rate limiting
 */
export function rateLimit(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const result = checkRateLimit(ip);
  if (!result.allowed) {
    return tooManyRequests(result.resetTime);
  }
  return null; // continue
}

/**
 * Vérifie l'authentification JWT
 * @returns {Promise<{user: Object}|Response>}
 */
export async function authenticate(req) {
  const token = extractBearer(req.headers.get('authorization'));
  if (!token) return { response: unauthorized('Token manquant') };

  try {
    const payload = await verifyToken(token);
    return { user: payload };
  } catch (e) {
    return { response: unauthorized('Token invalide ou expiré') };
  }
}

/**
 * Vérifie que l'utilisateur est admin
 */
export async function requireAdmin(req) {
  const auth = await authenticate(req);
  if (auth.response) return auth;

  if (!auth.user?.is_admin) {
    return { response: forbidden('Accès réservé aux administrateurs') };
  }
  return auth;
}

/**
 * Parse le body JSON avec gestion d'erreur
 */
export async function parseBody(req) {
  try {
    const body = await req.json();
    return { data: body };
  } catch (e) {
    return { response: error('Body JSON invalide', 400, 'INVALID_JSON') };
  }
}

/**
 * Gère les requêtes OPTIONS (CORS preflight)
 */
export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Requested-With',
      'Access-Control-Max-Age': '86400',
    },
  });
}
