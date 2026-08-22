/**
 * Couche HTTP unifiée — runtime Node de Vercel.
 *
 * Toutes les fonctions serverless du projet utilisent la signature (req, res).
 * Ce module remplace lib/response.js et lib/cors.js, qui produisaient des objets
 * `Response` (API Web / runtime Edge) incompatibles avec ce runtime : les codes
 * de statut y étaient silencieusement perdus et une erreur 401 partait en 200.
 */
import config from './config.js';

const ALLOWED = String(config.allowedOrigin || '*')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

const ALLOW_ANY = ALLOWED.includes('*');

/**
 * Détermine l'origine à renvoyer.
 * Routes publiques : '*' accepté (lecture de données de marché non nominatives).
 * Routes authentifiées : jamais '*' quand une origine est présente, sinon
 * n'importe quel site tiers peut exploiter le jeton de l'utilisateur.
 */
function resolveOrigin(req, scope) {
  const origin = req.headers?.origin || '';
  if (scope === 'public' && ALLOW_ANY) return '*';
  if (!origin) return ALLOW_ANY ? '*' : ALLOWED[0] || '';
  if (ALLOW_ANY || ALLOWED.includes(origin)) return origin;
  return '';
}

export function applyCors(req, res, { scope = 'private', methods = 'GET,POST,PUT,PATCH,DELETE,OPTIONS' } = {}) {
  const origin = resolveOrigin(req, scope);
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  if (origin && origin !== '*') res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With, X-Cron-Secret');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/** Réponse JSON. Un 204 ne doit jamais transporter de corps (RFC 9110 §15.3.5). */
export function json(res, status, payload, { cache = 'no-store' } = {}) {
  res.statusCode = status;
  res.setHeader('Cache-Control', cache);
  if (status === 204 || payload === undefined) return res.end();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(payload));
}

export function ok(res, data, extra = {}) {
  return json(res, 200, { success: true, data, ...extra });
}

/**
 * Erreur normalisée. Le message technique reste dans les logs serveur :
 * le renvoyer au client expose la structure de la base et des règles RLS.
 */
export function fail(res, status, message, code = 'ERROR', internal) {
  if (internal) console.error(`[${code}]`, internal?.message || internal);
  return json(res, status, { success: false, error: message, code });
}

export function noContent(res) {
  res.statusCode = 204;
  return res.end();
}

/** Lecture du corps avec plafond de taille, pour éviter l'épuisement mémoire. */
export function readBody(req, { limit = 1024 * 1024 } = {}) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(req.body ? JSON.parse(req.body) : {}); }
    catch { return Promise.reject(new BodyError('Corps JSON invalide')); }
  }
  return new Promise((resolve, reject) => {
    let raw = '';
    let aborted = false;
    const stop = err => { if (aborted) return; aborted = true; req.destroy(); reject(err); };
    req.on('data', chunk => {
      if (aborted) return;
      raw += chunk;
      if (raw.length > limit) stop(new BodyError('Corps de requête trop volumineux'));
    });
    req.on('end', () => {
      if (aborted) return;
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new BodyError('Corps JSON invalide')); }
    });
    req.on('error', stop);
  });
}

export class BodyError extends Error {
  constructor(message) { super(message); this.name = 'BodyError'; this.status = 400; }
}

/** URL absolue de la requête, utile pour lire les query params. */
export function requestUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || 'localhost';
  return new URL(req.url, `${proto}://${host}`);
}
