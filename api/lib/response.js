// ═══════════════════════════════════════════════════════════════════════════════
// THE CAPITAL — Response helpers avec CORS intégré
// ═══════════════════════════════════════════════════════════════════════════════

import config from './config.js';

const ALLOWED_ORIGIN = config.allowedOrigin || '*';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

export function success(data, message) {
  return jsonResponse({ success: true, data, message });
}

export function error(message, status = 400, code = 'ERROR') {
  return jsonResponse({ success: false, error: message, code }, status);
}

export function unauthorized(message = 'Non autorisé') {
  return jsonResponse({ success: false, error: message, code: 'UNAUTHORIZED' }, 401);
}

export function tooManyRequests(resetTime) {
  return jsonResponse({
    success: false,
    error: 'Trop de requêtes',
    code: 'RATE_LIMITED',
    resetTime,
  }, 429);
}
