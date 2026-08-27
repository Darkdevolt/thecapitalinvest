/**
 * Dépôt des états financiers en PDF (réservé aux administrateurs).
 */
import { supabaseAdmin } from '../lib/supabase.js';
import { authenticateAdmin, rateLimited, handlePreflight } from '../lib/middleware.js';
import { ok, fail, json, readBody, requestUrl, BodyError } from '../lib/http.js';
import config from '../lib/config.js';

const BUCKET = 'etats-financiers';
const TYPES = new Set(['etats_financiers', 'rapport_annuel', 'rapport_semestriel', 'communique', 'note_information', 'autre']);
const PERIODES = new Set(['annuel', 'semestriel', 'trimestriel']);
const TICKER_RE = /^[A-Z0-9]{2,12}$/;
const safeName = value => String(value || 'document.pdf').normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/^\.+/, '').slice(0, 160) || 'document.pdf';
function publicUrl(path) {
  if (!config.supabaseUrl) throw new Error('SUPABASE_URL non configurée');
  return `${config.supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}
function validAnnee(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1990 && n <= new Date().getFullYear();
}
function validUserId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}
function validDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default async function handler(req, res) {
  if (handlePreflight(req, res, { methods: 'GET,POST,DELETE,OPTIONS' })) return;
  if (rateLimited(req, res, 'financials-upload')) return;
  if (!supabaseAdmin) return fail(res, 503, 'Service temporairement indisponible.', 'SERVICE_UNAVAILABLE');
  const admin = await authenticateAdmin(req, res);
  if (!admin) return;
  try {
    if (req.method === 'GET') {
      const url = requestUrl(req);
      const ticker = (url.searchParams.get('ticker') || '').trim().toUpperCase();
      let q = supabaseAdmin.from('financials_documents').select('*').order('annee', { ascending: false }).order('created_at', { ascending: false });
      if (ticker) q = q.eq('ticker', ticker);
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return ok(res, data || []);
    }
    if (req.method === 'DELETE') {
      const id = requestUrl(req).searchParams.get('id') || '';
      if (!id) return fail(res, 400, 'Identifiant requis.', 'INVALID_ID');
      const { data: doc, error: lookupError } = await supabaseAdmin.from('financials_documents').select('fichier_url').eq('id', id).maybeSingle();
      if (lookupError) throw lookupError;
      if (!doc) return fail(res, 404, 'Document introuvable.', 'NOT_FOUND');
      const marqueur = `/${BUCKET}/`;
      const position = String(doc.fichier_url || '').indexOf(marqueur);
      if (position !== -1) {
        const chemin = doc.fichier_url.slice(position + marqueur.length);
        const { error: storageError } = await supabaseAdmin.storage.from(BUCKET).remove([chemin]);
        if (storageError) console.warn('[FINDOCS] suppression stockage :', storageError.message);
      }
      const { error } = await supabaseAdmin.from('financials_documents').delete().eq('id', id);
      if (error) throw error;
      return ok(res, { id });
    }
    if (req.method !== 'POST') return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
    let body;
    try { body = await readBody(req); } catch (e) { return fail(res, e instanceof BodyError ? 400 : 500, 'Requête illisible.', 'INVALID_BODY', e); }

    /* Gestion Institute : réutilise cette fonction admin existante afin de ne
       pas dépasser la limite Hobby Vercel de fonctions serverless. */
    if (body?.action === 'institute_status' || body?.action === 'institute_assign' || body?.action === 'institute_revoke') {
      const userId = String(body?.user_id || '');
      if (!validUserId(userId)) return fail(res, 400, 'Identifiant utilisateur invalide.', 'INVALID_USER_ID');
      const { data: target, error: targetError } = await supabaseAdmin.from('users').select('id,email').eq('id', userId).maybeSingle();
      if (targetError) throw targetError;
      if (!target) return fail(res, 404, 'Utilisateur introuvable.', 'USER_NOT_FOUND');

      if (body.action === 'institute_status') {
        const { data, error } = await supabaseAdmin.from('subscriptions')
          .select('id,user_id,plan_code,status,started_at,current_period_start,current_period_end,canceled_at,provider,provider_subscription_id,created_at,updated_at')
          .eq('user_id', userId).eq('plan_code', 'institute')
          .order('created_at', { ascending: false }).limit(10);
        if (error) throw error;
        return ok(res, data || []);
      }

      if (body.action === 'institute_revoke') {
        const now = new Date().toISOString();
        const { data, error } = await supabaseAdmin.from('subscriptions')
          .update({ status: 'canceled', canceled_at: now, updated_at: now })
          .eq('user_id', userId).eq('plan_code', 'institute').eq('status', 'active')
          .select('id,user_id,plan_code,status,current_period_end,canceled_at');
        if (error) throw error;
        return ok(res, { action: 'revoke', user: target.email, subscriptions: data || [] });
      }

      const expiry = validDate(body?.expires_at);
      if (!expiry) return fail(res, 400, 'Date d’échéance invalide.', 'INVALID_EXPIRY');
      if (new Date(expiry) <= new Date()) return fail(res, 400, 'La date d’échéance doit être future.', 'EXPIRY_IN_PAST');
      const now = new Date().toISOString();
      const { data: active, error: activeError } = await supabaseAdmin.from('subscriptions').select('id')
        .eq('user_id', userId).eq('plan_code', 'institute').eq('status', 'active')
        .order('created_at', { ascending: false }).limit(1);
      if (activeError) throw activeError;

      let subscription;
      if (active?.[0]?.id) {
        const result = await supabaseAdmin.from('subscriptions').update({
          current_period_end: expiry, current_period_start: now, updated_at: now,
          canceled_at: null, provider: 'admin'
        }).eq('id', active[0].id).select('*').single();
        if (result.error) throw result.error;
        subscription = result.data;
      } else {
        const result = await supabaseAdmin.from('subscriptions').insert({
          user_id: userId, plan_code: 'institute', status: 'active', started_at: now,
          current_period_start: now, current_period_end: expiry, provider: 'admin',
          provider_subscription_id: null, canceled_at: null
        }).select('*').single();
        if (result.error) throw result.error;
        subscription = result.data;
      }
      return ok(res, { action: 'assign', user: target.email, subscription });
    }

    const ticker = String(body?.ticker || '').trim().toUpperCase();
    const annee = Number(body?.annee);
    const periode = String(body?.periode || 'annuel');
    const type = String(body?.type_document || 'etats_financiers');
    if (!TICKER_RE.test(ticker)) return fail(res, 400, 'Ticker invalide.', 'INVALID_TICKER');
    if (!validAnnee(annee)) return fail(res, 400, 'Exercice invalide.', 'INVALID_YEAR');
    if (!PERIODES.has(periode)) return fail(res, 400, 'Période invalide.', 'INVALID_PERIOD');
    if (!TYPES.has(type)) return fail(res, 400, 'Type de document invalide.', 'INVALID_TYPE');
    if (body?.action === 'prepare') {
      const filename = safeName(body.filename);
      if (!/\.pdf$/i.test(filename)) return fail(res, 400, 'Seuls les fichiers PDF sont acceptés.', 'INVALID_FILE_TYPE');
      const path = `${ticker}/${annee}/${Date.now()}_${filename}`;
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
      if (error) throw error;
      return ok(res, { path, token: data.token, signedUrl: data.signedUrl, publicUrl: publicUrl(path) });
    }
    if (body?.action === 'finalize') {
      if (!body.path || !body.filename) return fail(res, 400, 'Informations de dépôt incomplètes.', 'INCOMPLETE_PAYLOAD');
      const record = {
        ticker, annee, periode, type_document: type,
        titre: body.titre ? String(body.titre).slice(0, 300) : null,
        fichier_nom: safeName(body.filename), fichier_url: publicUrl(body.path),
        taille_octets: Number.isFinite(Number(body.taille)) ? Number(body.taille) : null,
        nb_pages: Number.isInteger(Number(body.nb_pages)) ? Number(body.nb_pages) : null,
        publie: body.publie !== false, notes: body.notes ? String(body.notes).slice(0, 2000) : null
      };
      const { data, error } = await supabaseAdmin.from('financials_documents').upsert(record, { onConflict: 'ticker,annee,periode,type_document' }).select().single();
      if (error) throw error;
      return json(res, 201, { success: true, data, message: 'Document enregistré.' });
    }
    return fail(res, 400, 'Action inconnue.', 'UNKNOWN_ACTION');
  } catch (error) {
    console.error('[FINDOCS] upload error', error);
    return fail(res, 500, 'Enregistrement du document impossible.', 'FINDOCS_ERROR', error);
  }
}
