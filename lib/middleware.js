/**
 * Middleware d'authentification et de limitation de débit — runtime Node.
 */
import { checkRateLimit } from './ratelimit.js';
import { extractBearer } from './jwt.js';
import { fail, applyCors } from './http.js';
import { supabaseAdmin, isSupabaseReady } from './supabase.js';
import config from './config.js';

const MASTER_ADMIN_EMAIL = 'diopibrahimabdallah@gmail.com';

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

export function rateLimited(req, res, bucket = 'default') {
  const result = checkRateLimit(`${bucket}:${clientIp(req)}`);
  if (result.allowed) return false;
  const retry = Math.max(1, Math.ceil((new Date(result.resetTime) - Date.now()) / 1000));
  res.setHeader('Retry-After', String(retry));
  fail(res, 429, 'Trop de requêtes. Réessayez dans un instant.', 'RATE_LIMITED');
  return true;
}

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
 * Administration financière et gestion des accès : seul le compte maître
 * peut attribuer, modifier, suspendre ou retirer un abonnement.
 */
export async function authenticateMasterAdmin(req, res) {
  const user = await authenticateAdmin(req, res);
  if (!user) return null;
  if (String(user.email || '').trim().toLowerCase() !== MASTER_ADMIN_EMAIL) {
    fail(res, 403, 'Seul le compte maître peut gérer les abonnements et les accès.', 'MASTER_ADMIN_REQUIRED');
    return null;
  }
  return user;
}

export function isMachineRequest(req) {
  if (!config.cronSecret) return false;
  const auth = String(header(req, 'authorization') || '');
  const internal = String(header(req, 'x-cron-secret') || '');
  return auth === `Bearer ${config.cronSecret}` || internal === config.cronSecret;
}

export function handlePreflight(req, res, options) {
  applyCors(req, res, options);
  if (req.method !== 'OPTIONS') return false;
  res.statusCode = 204;
  res.end();
  return true;
}
