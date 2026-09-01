import config from '../lib/config.js';
import { json, fail, applyCors } from '../lib/http.js';

export default async function handler(req, res) {
  applyCors(req, res, { scope: 'public', methods: 'POST,OPTIONS' });
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');

  const supabaseUrl = String(config.supabaseUrl || '').replace(/\/+$/, '');
  const publishableKey = String(config.supabasePublishableKey || '').trim();
  if (!supabaseUrl || !publishableKey) {
    return fail(res, 503, 'Service de connexion temporairement indisponible.', 'AUTH_CONFIG_MISSING');
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  if (!email || !password) return fail(res, 400, 'Email et mot de passe requis.', 'AUTH_INPUT_INVALID');

  try {
    const upstream = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': publishableKey,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const contentType = upstream.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await upstream.json() : { msg: await upstream.text() };
    if (!upstream.ok) {
      const status = upstream.status === 400 || upstream.status === 401 ? 401 : upstream.status;
      return json(res, status, data || { error: 'AUTH_FAILED' });
    }

    return json(res, 200, data);
  } catch (error) {
    return fail(res, 502, 'Le service de connexion est momentanément inaccessible.', 'AUTH_UPSTREAM_UNAVAILABLE', error);
  }
}
