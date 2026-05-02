import { checkRateLimit } from './ratelimit.js';
import { verifyToken, extractBearer } from './jwt.js';
import { unauthorized, tooManyRequests, error, forbidden } from './response.js';
import { supabase } from './supabase.js';

/**
 * Applique le rate limiting
 */
export function rateLimit(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const result = checkRateLimit(ip);
  if (!result.allowed) {
    return tooManyRequests(result.resetTime);
  }
  return null;
}

/**
 * Vérifie l'authentification JWT (token Supabase)
 * FIX S-01 : utilise supabase.auth.getUser() au lieu de verifyToken() custom
 * pour être cohérent avec les tokens émis par auth.js
 */
export async function authenticate(req) {
  const token = extractBearer(req.headers.get('authorization'));
  if (!token) return { response: unauthorized('Token manquant') };

  try {
    const { data, error: authError } = await supabase.auth.getUser(token);
    if (authError || !data?.user) {
      return { response: unauthorized('Token invalide ou expiré') };
    }
    // Expose user avec la même interface qu'avant (sub = id)
    return { user: { ...data.user, sub: data.user.id } };
  } catch (e) {
    return { response: unauthorized('Token invalide ou expiré') };
  }
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
export function handleOptions(headers = {}) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Requested-With',
      'Access-Control-Max-Age': '86400',
      ...headers,
    },
  });
}
