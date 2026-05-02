/**
 * Helpers pour construire des réponses HTTP standardisées
 */

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export function error(message, status = 400, code = null) {
  const body = { error: message };
  if (code) body.code = code;
  return json(body, status);
}

export function success(data, message = null) {
  const body = { success: true, ...data };
  if (message) body.message = message;
  return json(body);
}

export function unauthorized(message = 'Non autorisé') {
  return error(message, 401, 'UNAUTHORIZED');
}

export function forbidden(message = 'Accès interdit') {
  return error(message, 403, 'FORBIDDEN');
}

export function notFound(message = 'Ressource non trouvée') {
  return error(message, 404, 'NOT_FOUND');
}

export function tooManyRequests(resetTime) {
  return new Response(
    JSON.stringify({ error: 'Trop de requêtes', retryAfter: Math.ceil((resetTime - Date.now()) / 1000) }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
      },
    }
  );
}

export function noContent() {
  return new Response(null, { status: 204 });
}
