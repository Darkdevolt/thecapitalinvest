/**
 * Middleware d'authentification et de limitation de débit — runtime Node.
 *
 * L'ancienne version renvoyait des objets `Response` que les handlers Node
 * réémettaient via res.end(...), ce qui perdait le code HTTP : un jeton invalide
 * produisait un 200 porteur d'un corps d'erreur, et le client ne pouvait donc
 * jamais détecter une session expirée. Les fonctions ci-dessous écrivent
 * directement dans `res` et retournent un résultat explicite.
 */
import { checkRateLimit } from './ratelimit.js';
import { extractBearer } from './jwt.js';
import { fail, applyCors } from './http.js';
import { supabaseAdmin, isSupabaseReady } from './supabase.js';
import config from './config.js';

function header(req, name) {
  if (req.headers && typeof req.headers.get === 'function') return req.headers.get(name);
  const lower = name.toLowerCase();
  return req.headers?.[lower] || req.headers?.[name];
}

export function clientIp(req) {
  const forwarded = header(req, 'x-forwarded-for');
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Retourne true si la requête doit être rejetée (la réponse est déjà écrite).
 * Le compteur est en mémoire : il protège une instance de fonction, pas le
 * déploiement entier. Pour un plafond global il faut un store partagé
 * (Vercel KV, Upstash). Limite documentée, pas masquée.
 */
export function rateLimited(req, res, bucket = 'default') {
  const result = checkRateLimit(`${bucket}:${clientIp(req)}`);
  if (result.allowed) return false;
  const retry = Math.max(1, Math.ceil((new Date(result.resetTime) - Date.now()) / 1000));
  res.setHeader('Retry-After', String(retry));
  fail(res, 429, 'Trop de requêtes. Réessayez dans un instant.', 'RATE_LIMITED');
  return true;
}

/**
 * Vérifie le jeton Supabase. Retourne l'utilisateur, ou null après avoir écrit
 * la réponse d'erreur avec le bon code HTTP.
 */
export async function authenticate(req, res) {
  if (!isSupabaseReady() || !supabaseAdmin) {
    fail(res, 503, 'Service temporairement indisponible.', 'SERVICE_UNAVAILABLE');
    return null;
  }
  const token = extractBearer(header(req, 'authorization'));
  if (!token) {
    fail(res, 401, 'Authentification requise.', 'TOKEN_MISSING');
    return null;
  }
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      fail(res, 401, 'Session invalide ou expirée.', 'TOKEN_INVALID');
      return null;
    }
    return { ...data.user, sub: data.user.id };
  } catch (e) {
    fail(res, 401, 'Session invalide ou expirée.', 'TOKEN_INVALID', e);
    return null;
  }
}

/** Authentifie puis vérifie le drapeau is_admin dans la table users. */
export async function authenticateAdmin(req, res) {
  const user = await authenticate(req, res);
  if (!user) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from('users').select('id,is_admin').eq('id', user.id).maybeSingle();
    if (error) throw error;
    if (!data?.is_admin) {
      fail(res, 403, 'Accès administrateur requis.', 'ADMIN_REQUIRED');
      return null;
    }
    return user;
  } catch (e) {
    fail(res, 500, 'Vérification des droits impossible.', 'ADMIN_CHECK_FAILED', e);
    return null;
  }
}

/**
 * Authentification machine : cron Vercel (Authorization: Bearer <CRON_SECRET>)
 * ou appel interne entre fonctions (en-tête X-Cron-Secret).
 */
export function isMachineRequest(req) {
  if (!config.cronSecret) return false;
  const auth = String(header(req, 'authorization') || '');
  const internal = String(header(req, 'x-cron-secret') || '');
  return auth === `Bearer ${config.cronSecret}` || internal === config.cronSecret;
}

/** Applique les en-têtes CORS et traite le préflight. True = requête terminée. */
export function handlePreflight(req, res, options) {
  applyCors(req, res, options);
  if (req.method !== 'OPTIONS') return false;
  res.statusCode = 204;
  res.end();
  return true;
}
