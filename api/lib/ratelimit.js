// Rate limiter simple en mémoire (compatible Vercel serverless)
const requests = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;

function cleanup() {
  const now = Date.now();
  for (const [ip, data] of requests) {
    if (now - data.firstRequest > WINDOW_MS) {
      requests.delete(ip);
    }
  }
}

export function checkRateLimit(ip) {
  cleanup(); // Nettoyage synchrone à chaque appel

  const now = Date.now();
  const data = requests.get(ip);

  if (!data) {
    requests.set(ip, { count: 1, firstRequest: now });
    return { allowed: true };
  }

  if (now - data.firstRequest > WINDOW_MS) {
    requests.set(ip, { count: 1, firstRequest: now });
    return { allowed: true };
  }

  if (data.count >= MAX_REQUESTS) {
    return { 
      allowed: false, 
      resetTime: new Date(data.firstRequest + WINDOW_MS).toISOString() 
    };
  }

  data.count++;
  return { allowed: true };
}
