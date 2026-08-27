/**
 * Gestion administrative de l'abonnement The Capital Institute.
 * Les abonnements Institute sont stockés dans `subscriptions` et non dans
 * `users.plan`, car l'Institute est un produit séparé de The Capital Invest.
 */
import { supabaseAdmin } from '../lib/supabase.js';
import { authenticateAdmin, rateLimited, handlePreflight } from '../lib/middleware.js';
import { fail, ok, readBody, BodyError } from '../lib/http.js';

function validUserId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function validDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default async function handler(req, res) {
  if (handlePreflight(req, res, { methods: 'GET,POST,OPTIONS' })) return;
  if (rateLimited(req, res, 'admin-institute-subscription')) return;
  if (!supabaseAdmin) return fail(res, 503, 'Service temporairement indisponible.', 'SERVICE_UNAVAILABLE');

  const admin = await authenticateAdmin(req, res);
  if (!admin) return;

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const userId = url.searchParams.get('user_id') || '';
      if (!validUserId(userId)) return fail(res, 400, 'Identifiant utilisateur invalide.', 'INVALID_USER_ID');

      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .select('id,user_id,plan_code,status,started_at,current_period_start,current_period_end,canceled_at,provider,provider_subscription_id,created_at,updated_at')
        .eq('user_id', userId)
        .eq('plan_code', 'institute')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return ok(res, data || []);
    }

    if (req.method !== 'POST') return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');

    let body;
    try { body = await readBody(req); }
    catch (e) { return fail(res, e instanceof BodyError ? 400 : 500, 'Requête illisible.', 'INVALID_BODY', e); }

    const userId = String(body?.user_id || '');
    if (!validUserId(userId)) return fail(res, 400, 'Identifiant utilisateur invalide.', 'INVALID_USER_ID');

    const action = String(body?.action || 'assign');
    if (!['assign', 'revoke'].includes(action)) return fail(res, 400, 'Action invalide.', 'INVALID_ACTION');

    const { data: target, error: targetError } = await supabaseAdmin
      .from('users').select('id,email').eq('id', userId).maybeSingle();
    if (targetError) throw targetError;
    if (!target) return fail(res, 404, 'Utilisateur introuvable.', 'USER_NOT_FOUND');

    if (action === 'revoke') {
      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'canceled', canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('plan_code', 'institute')
        .eq('status', 'active')
        .select('id,user_id,plan_code,status,current_period_end,canceled_at');
      if (error) throw error;
      return ok(res, { action, user: target.email, subscriptions: data || [] });
    }

    const expiry = validDate(body?.expires_at);
    if (!expiry) return fail(res, 400, 'Date d’échéance invalide.', 'INVALID_EXPIRY');
    if (new Date(expiry) <= new Date()) return fail(res, 400, 'La date d’échéance doit être future.', 'EXPIRY_IN_PAST');

    const now = new Date().toISOString();
    const { data: active, error: activeError } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('plan_code', 'institute')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);
    if (activeError) throw activeError;

    let data;
    if (active?.[0]?.id) {
      const result = await supabaseAdmin.from('subscriptions')
        .update({ current_period_end: expiry, current_period_start: now, updated_at: now, canceled_at: null, provider: 'admin' })
        .eq('id', active[0].id)
        .select('id,user_id,plan_code,status,started_at,current_period_start,current_period_end,provider,updated_at')
        .single();
      if (result.error) throw result.error;
      data = result.data;
    } else {
      const result = await supabaseAdmin.from('subscriptions').insert({
        user_id: userId,
        plan_code: 'institute',
        status: 'active',
        started_at: now,
        current_period_start: now,
        current_period_end: expiry,
        provider: 'admin',
        provider_subscription_id: null,
        canceled_at: null
      }).select('id,user_id,plan_code,status,started_at,current_period_start,current_period_end,provider,created_at').single();
      if (result.error) throw result.error;
      data = result.data;
    }

    return ok(res, { action, user: target.email, subscription: data });
  } catch (error) {
    console.error('[ADMIN-INSTITUTE] subscription error', error);
    return fail(res, 500, 'Impossible de gérer l’abonnement The Capital Institute.', 'INSTITUTE_SUBSCRIPTION_ERROR', error);
  }
}
