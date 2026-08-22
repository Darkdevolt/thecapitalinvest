/**
 * Préférences utilisateur (mode d'affichage simple / pro).
 *
 * CORRECTIF : l'échec d'authentification était renvoyé via
 * res.end(Buffer.from(await auth.response.arrayBuffer())) — le corps partait
 * avec le statut 200 par défaut, sans Content-Type. Le client ne pouvait donc
 * pas distinguer une session expirée d'une réponse valide.
 */
import { supabaseAdmin, isSupabaseReady } from '../lib/supabase.js';
import { authenticate, rateLimited, handlePreflight } from '../lib/middleware.js';
import { ok, fail, readBody, BodyError } from '../lib/http.js';

const MODES = ['simple', 'pro'];
const COLUMNS = 'user_id,display_mode,created_at,updated_at';

export default async function handler(req, res) {
  if (handlePreflight(req, res, { methods: 'GET,PUT,OPTIONS' })) return;
  if (rateLimited(req, res, 'preferences')) return;
  if (!isSupabaseReady() || !supabaseAdmin) {
    return fail(res, 503, 'Service temporairement indisponible.', 'SERVICE_UNAVAILABLE');
  }

  const user = await authenticate(req, res);
  if (!user) return;
  const userId = user.sub;

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('user_preferences').select(COLUMNS).eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return ok(res, data || { user_id: userId, display_mode: 'simple' });
    }

    if (req.method === 'PUT') {
      let body;
      try { body = await readBody(req); }
      catch (e) { return fail(res, e instanceof BodyError ? 400 : 500, 'Requête illisible.', 'INVALID_BODY', e); }

      const displayMode = String(body?.display_mode || '').toLowerCase();
      if (!MODES.includes(displayMode)) {
        return fail(res, 400, "Mode d'affichage invalide (attendu : simple ou pro).", 'INVALID_DISPLAY_MODE');
      }
      const { data, error } = await supabaseAdmin
        .from('user_preferences')
        .upsert({ user_id: userId, display_mode: displayMode }, { onConflict: 'user_id' })
        .select(COLUMNS).single();
      if (error) throw error;
      return ok(res, data);
    }

    return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
  } catch (error) {
    return fail(res, 500, 'Erreur serveur.', 'PREFERENCES_ERROR', error);
  }
}
