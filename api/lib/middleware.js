import { checkRateLimit } from './ratelimit.js';
import { extractBearer } from './jwt.js';
import { unauthorized, tooManyRequests, error } from './response.js';
import { supabaseAdmin } from './supabase.js';

// Helper : Vercel Functions utilisent req.headers comme objet plain (Node.js)
// pas comme instance Headers (Web API). Cette fonction gère les deux cas.
function getHeader(req, name) {
  // Cas 1 : Web API (Headers instance avec .get())
  if (req.headers && typeof req.headers.get === 'function') {
    return req.headers.get(name);
  }
  // Cas 2 : Node.js / Vercel (objet plain)
  const lowerName = name.toLowerCase();
  return req.headers?.[lowerName] || req.headers?.[name];
}

export function rateLimit(req) {
  const forwarded = getHeader(req, 'x-forwarded-for');
  const ip = typeof forwarded === 'string'
    ? forwarded.split(',')[0]?.trim()
    : 'unknown';
  const result = checkRateLimit(ip);
  if (!result.allowed) {
    return tooManyRequests(result.resetTime);
  }
  return null;
}

export async function authenticate(req) {
  const token = extractBearer(getHeader(req, 'authorization'));
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
