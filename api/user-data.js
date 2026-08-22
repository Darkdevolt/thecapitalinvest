/**
 * Données personnelles : alertes de cours et liste de suivi.
 *
 * CORRECTIFS :
 *  - statut HTTP réel sur échec d'authentification (200 auparavant) ;
 *  - identifiants de ressource validés comme UUID avant d'atteindre la base ;
 *  - le PUT n'écrase plus une note ou un état avec `undefined` quand le champ
 *    est absent du corps envoyé ;
 *  - les messages d'erreur internes de Postgres ne sont plus renvoyés au client.
 */
import { supabaseAdmin, isSupabaseReady } from '../lib/supabase.js';
import { authenticate, rateLimited, handlePreflight } from '../lib/middleware.js';
import { ok, fail, json, readBody, requestUrl, BodyError } from '../lib/http.js';
import { validators } from '../lib/validate.js';

const TABLES = { alerts: 'alertes_cours', watchlist: 'watchlist' };
const TICKER_RE = /^[A-Z0-9]{2,12}$/;

function normalizeAlertType(value) {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'above' || type === 'hausse') return 'HAUSSE';
  if (type === 'below' || type === 'baisse') return 'BAISSE';
  return null;
}

/** Expose la condition sous la forme attendue par le client (above / below). */
function toApiAlert(row) {
  if (!row) return row;
  const condition = row.type_alerte === 'HAUSSE' ? 'above'
    : row.type_alerte === 'BAISSE' ? 'below'
    : row.type_alerte;
  return { ...row, condition };
}

export default async function handler(req, res) {
  if (handlePreflight(req, res, { methods: 'GET,POST,PUT,DELETE,OPTIONS' })) return;
  if (rateLimited(req, res, 'user-data')) return;
  if (!isSupabaseReady() || !supabaseAdmin) {
    return fail(res, 503, 'Service temporairement indisponible.', 'SERVICE_UNAVAILABLE');
  }

  const user = await authenticate(req, res);
  if (!user) return;
  const userId = user.sub;

  const url = requestUrl(req);
  const mode = url.searchParams.get('mode');
  const table = TABLES[mode];
  if (!table) return fail(res, 400, 'Mode invalide (attendu : alerts ou watchlist).', 'INVALID_MODE');

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from(table).select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (error) throw error;
      const rows = data || [];
      return ok(res, mode === 'alerts' ? rows.map(toApiAlert) : rows);
    }

    if (req.method === 'POST') {
      let body;
      try { body = await readBody(req); }
      catch (e) { return fail(res, e instanceof BodyError ? 400 : 500, 'Requête illisible.', 'INVALID_BODY', e); }

      const ticker = String(body?.ticker || '').trim().toUpperCase();
      if (!TICKER_RE.test(ticker)) return fail(res, 400, 'Ticker invalide.', 'INVALID_TICKER');

      let row;
      if (mode === 'alerts') {
        const alertType = normalizeAlertType(body?.condition ?? body?.type_alerte);
        if (!alertType) return fail(res, 400, "Condition d'alerte invalide.", 'INVALID_CONDITION');
        const threshold = Number(body?.price ?? body?.seuil);
        if (!Number.isFinite(threshold) || threshold <= 0) {
          return fail(res, 400, "Seuil d'alerte invalide.", 'INVALID_THRESHOLD');
        }
        row = {
          user_id: userId, ticker, type_alerte: alertType, seuil: threshold,
          active: body?.active !== false, note: body?.note ?? null
        };
      } else {
        row = { user_id: userId, ticker, note: body?.note ?? null };
      }

      const { data, error } = await supabaseAdmin.from(table).insert(row).select('*').single();
      if (error) throw error;
      return json(res, 201, { success: true, data: mode === 'alerts' ? toApiAlert(data) : data });
    }

    if (req.method === 'PUT') {
      const id = url.searchParams.get('id') || '';
      if (!validators.uuid(id)) return fail(res, 400, 'Identifiant invalide.', 'INVALID_ID');

      let body;
      try { body = await readBody(req); }
      catch (e) { return fail(res, e instanceof BodyError ? 400 : 500, 'Requête illisible.', 'INVALID_BODY', e); }

      // Seuls les champs réellement transmis sont modifiés.
      const update = {};
      if (Object.prototype.hasOwnProperty.call(body, 'note')) update.note = body.note ?? null;
      if (mode === 'alerts' && Object.prototype.hasOwnProperty.call(body, 'active')) {
        update.active = body.active !== false;
      }
      if (mode === 'alerts' && Object.prototype.hasOwnProperty.call(body, 'seuil')) {
        const seuil = Number(body.seuil);
        if (!Number.isFinite(seuil) || seuil <= 0) return fail(res, 400, 'Seuil invalide.', 'INVALID_THRESHOLD');
        update.seuil = seuil;
      }
      if (!Object.keys(update).length) return fail(res, 400, 'Aucune modification fournie.', 'EMPTY_UPDATE');

      const { data, error } = await supabaseAdmin
        .from(table).update(update).eq('id', id).eq('user_id', userId).select('*').maybeSingle();
      if (error) throw error;
      if (!data) return fail(res, 404, 'Élément introuvable.', 'NOT_FOUND');
      return ok(res, mode === 'alerts' ? toApiAlert(data) : data);
    }

    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id') || '';
      if (!validators.uuid(id)) return fail(res, 400, 'Identifiant invalide.', 'INVALID_ID');
      const { data, error } = await supabaseAdmin
        .from(table).delete().eq('id', id).eq('user_id', userId).select('id');
      if (error) throw error;
      if (!data?.length) return fail(res, 404, 'Élément introuvable.', 'NOT_FOUND');
      return ok(res, { id });
    }

    return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
  } catch (error) {
    return fail(res, 500, 'Erreur serveur.', 'USER_DATA_ERROR', error);
  }
}
