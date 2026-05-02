import config from './config.js';

// Stockage en mémoire (suffisant pour serverless Vercel avec Fluid Compute)
// En production à grande échelle, remplacer par Redis
const store = new Map();

/**
 * Nettoie les entrées expirées périodiquement
 */
function cleanup() {
  const now = Date.now();
  for (const [key, data] of store.entries()) {
    if (now > data.resetTime) store.delete(key);
  }
}

// Nettoyage toutes les 5 minutes
setInterval(cleanup, 300_000);

/**
 * Vérifie si une IP a dépassé sa limite de requêtes
 * @param {string} ip — Adresse IP
 * @returns {{allowed: boolean, remaining: number, resetTime: number}}
 */
export function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = config.rateLimit.windowMs;
  const maxRequests = config.rateLimit.maxRequests;

  const data = store.get(ip);

  if (!data || now > data.resetTime) {
    // Nouvelle fenêtre
    store.set(ip, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
  }

  if (data.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: data.resetTime };
  }

  data.count++;
  return { allowed: true, remaining: maxRequests - data.count, resetTime: data.resetTime };
}
