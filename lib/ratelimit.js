/**
 * Limitation de débit à fenêtre glissante, en mémoire.
 * Portée : une instance de fonction serverless. Documenté comme tel.
 */
import config from './config.js';

const WINDOW_MS = config.rateLimit.windowMs;
const MAX_REQUESTS = config.rateLimit.maxRequests;
const MAX_KEYS = 10000; // garde-fou mémoire
const requests = new Map();

function cleanup(now) {
  for (const [key, entry] of requests) {
    if (now - entry.firstRequest > WINDOW_MS) requests.delete(key);
  }
  if (requests.size > MAX_KEYS) requests.clear();
}

export function checkRateLimit(key) {
  const now = Date.now();
  cleanup(now);
  const entry = requests.get(key);
  if (!entry || now - entry.firstRequest > WINDOW_MS) {
    requests.set(key, { count: 1, firstRequest: now });
    return { allowed: true };
  }
  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, resetTime: new Date(entry.firstRequest + WINDOW_MS).toISOString() };
  }
  entry.count++;
  return { allowed: true };
}
