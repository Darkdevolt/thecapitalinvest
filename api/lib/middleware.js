import { checkRateLimit } from './ratelimit.js';
import { extractBearer } from './jwt.js';
import { unauthorized, tooManyRequests, error } from './response.js';
import { supabaseAdmin } from './supabase.js';

export function rateLimit(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const result = checkRateLimit(ip);
  if (!result.allowed) {
    return tooManyRequests(result.resetTime);
  }
  return null;
}

export async function authenticate(req) {
  const token = extractBearer(req.headers.get('authorization'));
  if (!token) return { response: unauthorized('Token manquant') };

  try {
    const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !data?.user) {
      return { response: unauthorized('Token invalide ou expiré') };
    }
    return { user: { ...data.user, sub: data.user.id } };
  } catch (e) {
    return { response: unauthorized('Token invalide ou expiré') };
  }
}

export async function parseBody(req) {
  try {
    const body = await req.json();
    return { data: body };
  } catch (e) {
    return { response: error('Body JSON invalide', 400, 'INVALID_JSON') };
  }
}

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
