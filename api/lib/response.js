export function success(data, message) {
  return new Response(
    JSON.stringify({ success: true, data, message }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

export function error(message, status = 400, code = 'ERROR') {
  return new Response(
    JSON.stringify({ success: false, error: message, code }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

export function unauthorized(message = 'Non autorisé') {
  return new Response(
    JSON.stringify({ success: false, error: message, code: 'UNAUTHORIZED' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );
}

export function tooManyRequests(resetTime) {
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: 'Trop de requêtes', 
      code: 'RATE_LIMITED',
      resetTime 
    }),
    { status: 429, headers: { 'Content-Type': 'application/json' } }
  );
}
