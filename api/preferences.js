import { supabaseAdmin, isSupabaseReady } from '../lib/supabase.js';
import { authenticate } from '../lib/middleware.js';

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With');
  return res.end(JSON.stringify(payload));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, null);
  if (!isSupabaseReady() || !supabaseAdmin) return json(res, 503, { success: false, error: 'Supabase non configuré' });

  const auth = await authenticate(req);
  if (auth.response) return res.end(Buffer.from(await auth.response.arrayBuffer()));
  const userId = auth.user.sub;

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('user_preferences')
        .select('user_id,display_mode,created_at,updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return json(res, 200, { success: true, data: data || { user_id: userId, display_mode: 'simple' } });
    }

    if (req.method === 'PUT') {
      const input = await readBody(req);
      const displayMode = String(input.display_mode || '').toLowerCase();
      if (!['simple', 'pro'].includes(displayMode)) {
        return json(res, 400, { success: false, error: 'Mode d’affichage invalide' });
      }
      const { data, error } = await supabaseAdmin
        .from('user_preferences')
        .upsert({ user_id: userId, display_mode: displayMode }, { onConflict: 'user_id' })
        .select('user_id,display_mode,created_at,updated_at')
        .single();
      if (error) throw error;
      return json(res, 200, { success: true, data });
    }

    return json(res, 405, { success: false, error: 'Méthode non autorisée' });
  } catch (error) {
    console.error('[PREFERENCES]', error);
    return json(res, 500, { success: false, error: 'Erreur serveur', detail: error.message });
  }
}
