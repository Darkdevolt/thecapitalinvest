/**
 * Administration des comptes clients et des options de l'application.
 *
 *   mode=admin-users     GET  liste enrichie (connexion, suspension, activité)
 *                        GET  ?id=<uuid> : fiche client complète
 *                        POST actions sur un compte (compte maître uniquement)
 *   mode=admin-settings  GET  options de l'application + formules
 *                        POST enregistrer les options ou une formule (compte maître)
 *   mode=public-config   GET  options publiques lues par l'application (sans jeton)
 *
 * Les champs protégés de public.users (offre, rôle, dates d'essai) ne sont pas
 * modifiés ici : l'administration les écrit avec la session de l'administrateur,
 * seule autorisée par les déclencheurs de protection.
 */
import { supabaseAdmin } from './supabase.js';
import { fail, ok, json, readBody, requestUrl, BodyError } from './http.js';
import { validators } from './validate.js';

const MASTER = 'diopibrahimabdallah@gmail.com';
const USER = 'id,email,nom,plan,plan_expire_at,is_admin,created_at,updated_at,last_sign_in_at,trial_started_at,trial_ends_at,legal_consent_at,legal_version';
const SUB = 'id,user_id,plan_code,status,started_at,current_period_start,current_period_end,canceled_at,cancel_reason,provider,created_at,updated_at';
const uuid = v => validators.uuid(String(v || ''));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function audit(actor, action, id, oldData, newData) {
  const { error } = await supabaseAdmin.from('admin_audit_log').insert({
    actor_id: actor, action, table_name: 'users', record_id: String(id || ''),
    old_data: oldData || null, new_data: newData || null
  });
  if (error) console.warn('[ADMIN_USERS] audit', error.message);
}

/* Comptes d'authentification (connexion, confirmation, suspension). */
async function authUsers() {
  const out = {};
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const list = data?.users || [];
    list.forEach(u => {
      out[u.id] = {
        email_confirmed_at: u.email_confirmed_at || u.confirmed_at || null,
        last_sign_in_at: u.last_sign_in_at || null,
        banned_until: u.banned_until || null,
        providers: u.app_metadata?.providers || (u.app_metadata?.provider ? [u.app_metadata.provider] : []),
        phone: u.phone || null
      };
    });
    if (list.length < 1000) break;
  }
  return out;
}

function countBy(rows) {
  const m = {};
  (rows || []).forEach(r => { if (r.user_id) m[r.user_id] = (m[r.user_id] || 0) + 1; });
  return m;
}

function isSuspended(a) {
  return !!(a && a.banned_until && Date.parse(a.banned_until) > Date.now());
}

function redirectBase(req) {
  const origin = req.headers?.origin;
  if (origin && /^https:\/\//.test(origin)) return origin;
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
  return host ? 'https://' + host : '';
}

async function listUsers(res) {
  const [u, a, tx, al, wl, subs] = await Promise.all([
    supabaseAdmin.from('users').select(USER).order('created_at', { ascending: false }).limit(5000),
    authUsers(),
    supabaseAdmin.from('transactions').select('user_id').limit(50000),
    supabaseAdmin.from('alertes_cours').select('user_id').limit(50000),
    supabaseAdmin.from('watchlist').select('user_id').limit(50000),
    supabaseAdmin.from('subscriptions').select(SUB).order('created_at', { ascending: false }).limit(5000)
  ]);
  for (const x of [u, tx, al, wl, subs]) if (x.error) throw x.error;
  const txc = countBy(tx.data), alc = countBy(al.data), wlc = countBy(wl.data);
  const subsBy = {};
  (subs.data || []).forEach(s => { (subsBy[s.user_id] = subsBy[s.user_id] || []).push(s); });
  const rows = (u.data || []).map(r => {
    const auth = a[r.id] || null;
    return {
      ...r,
      last_sign_in_at: auth?.last_sign_in_at || r.last_sign_in_at || null,
      email_confirmed_at: auth?.email_confirmed_at || null,
      banned_until: auth?.banned_until || null,
      suspended: isSuspended(auth),
      has_auth: !!auth,
      counts: { transactions: txc[r.id] || 0, alertes: alc[r.id] || 0, watchlist: wlc[r.id] || 0 },
      subscriptions: subsBy[r.id] || []
    };
  });
  return ok(res, { rows });
}

async function userDetail(res, id) {
  const [u, subs, pays, orders, proofs, tx, al, wl, ev, notes, log, inst] = await Promise.all([
    supabaseAdmin.from('users').select(USER).eq('id', id).maybeSingle(),
    supabaseAdmin.from('subscriptions').select(SUB).eq('user_id', id).order('created_at', { ascending: false }),
    supabaseAdmin.from('payments').select('id,amount,currency,status,paid_at,provider,invoice_reference,created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('payment_orders').select('id,plan_code,billing_period,amount,currency,provider,status,paid_at,created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('payment_proofs').select('id,payment_order_id,proof_type,transaction_reference,claimed_amount,status,reviewer_note,created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('transactions').select('id,ticker,type,quantite,cours,prix_unitaire,date_transaction,montant_net').eq('user_id', id).order('date_transaction', { ascending: false }).limit(200),
    supabaseAdmin.from('alertes_cours').select('id,ticker,type_alerte,seuil,active,created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('watchlist').select('id,ticker,note,created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('user_events').select('event_name,occurred_at,metadata').eq('user_id', id).order('occurred_at', { ascending: false }).limit(50),
    supabaseAdmin.from('user_admin_notes').select('id,note,author_id,created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('admin_audit_log').select('action,table_name,created_at,actor_id').eq('record_id', id).order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('institute_progress').select('completed_courses,completed_lessons,xp,streak_days,last_activity_at').eq('user_id', id).maybeSingle()
  ]);
  if (u.error) throw u.error;
  if (!u.data) return fail(res, 404, 'Compte introuvable.', 'NOT_FOUND');
  let auth = null;
  const au = await supabaseAdmin.auth.admin.getUserById(id);
  if (!au.error && au.data?.user) {
    const x = au.data.user;
    auth = {
      email_confirmed_at: x.email_confirmed_at || x.confirmed_at || null,
      last_sign_in_at: x.last_sign_in_at || null,
      banned_until: x.banned_until || null,
      suspended: isSuspended(x),
      providers: x.app_metadata?.providers || [],
      created_at: x.created_at || null
    };
  }
  const pick = r => (r && !r.error ? r.data || [] : []);
  return ok(res, {
    user: u.data, auth,
    subscriptions: pick(subs), payments: pick(pays), payment_orders: pick(orders), payment_proofs: pick(proofs),
    transactions: pick(tx), alertes: pick(al), watchlist: pick(wl), events: pick(ev),
    notes: pick(notes), history: pick(log), institute: inst && !inst.error ? inst.data : null
  });
}

export async function handleAdminUsers(req, res, admin) {
  try {
    const url = requestUrl(req);
    if (req.method === 'GET') {
      const id = url.searchParams.get('id');
      if (id) {
        if (!uuid(id)) return fail(res, 400, 'Identifiant invalide.', 'INVALID_ID');
        return await userDetail(res, id);
      }
      return await listUsers(res);
    }
    if (req.method !== 'POST') return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
    let b;
    try { b = await readBody(req); } catch (e) { return fail(res, e instanceof BodyError ? 400 : 500, 'Requête illisible.', 'INVALID_BODY'); }
    const action = String(b?.action || '').toLowerCase();

    if (action === 'invite') {
      const email = String(b?.email || '').trim().toLowerCase();
      const nom = String(b?.nom || '').trim().slice(0, 120) || null;
      if (!EMAIL_RE.test(email)) return fail(res, 400, 'Adresse e-mail invalide.', 'INVALID_EMAIL');
      const { data: exists } = await supabaseAdmin.from('users').select('id').eq('email', email).maybeSingle();
      if (exists) return fail(res, 409, 'Un compte existe déjà avec cette adresse.', 'ALREADY_EXISTS');
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { nom }, redirectTo: redirectBase(req) + '/login.html'
      });
      if (error) return fail(res, 400, 'Invitation impossible : ' + error.message, 'INVITE_FAILED', error);
      const id = data?.user?.id;
      if (id) {
        const { error: ie } = await supabaseAdmin.from('users').upsert({ id, email, nom }, { onConflict: 'id', ignoreDuplicates: true });
        if (ie) console.warn('[ADMIN_USERS] profil', ie.message);
      }
      await audit(admin.id, 'user_invite', id, null, { email, nom });
      return ok(res, { id, email });
    }

    const id = String(b?.user_id || '');
    if (!uuid(id)) return fail(res, 400, 'Utilisateur invalide.', 'INVALID_USER_ID');
    const { data: cur, error: ce } = await supabaseAdmin.from('users').select(USER).eq('id', id).maybeSingle();
    if (ce) throw ce;
    if (!cur) return fail(res, 404, 'Compte introuvable.', 'NOT_FOUND');
    const isMasterTarget = String(cur.email || '').toLowerCase() === MASTER;
    const isSelf = String(admin.id) === id;

    if (action === 'profile') {
      const nom = String(b?.nom ?? '').trim().slice(0, 120) || null;
      const { data, error } = await supabaseAdmin.from('users').update({ nom }).eq('id', id).select(USER).single();
      if (error) throw error;
      await audit(admin.id, 'user_profile', id, { nom: cur.nom }, { nom });
      return ok(res, data);
    }

    if (action === 'reset_password' || action === 'magic_link') {
      const type = action === 'reset_password' ? 'recovery' : 'magiclink';
      const redirectTo = redirectBase(req) + (type === 'recovery' ? '/login.html?reset=1' : '/app/app.html');
      let sent = false;
      if (type === 'recovery') {
        const r = await supabaseAdmin.auth.resetPasswordForEmail(cur.email, { redirectTo });
        sent = !r.error;
      }
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type, email: cur.email, options: { redirectTo } });
      if (error && !sent) return fail(res, 400, 'Lien impossible à générer : ' + error.message, 'LINK_FAILED', error);
      await audit(admin.id, 'user_' + action, id, null, { email_sent: sent });
      return ok(res, { email_sent: sent, link: data?.properties?.action_link || null });
    }

    if (action === 'suspend' || action === 'unsuspend') {
      if (action === 'suspend' && (isMasterTarget || isSelf)) return fail(res, 400, 'Ce compte ne peut pas être suspendu.', 'PROTECTED_ACCOUNT');
      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: action === 'suspend' ? '876000h' : 'none' });
      if (error) return fail(res, 400, 'Action impossible : ' + error.message, 'AUTH_UPDATE_FAILED', error);
      await audit(admin.id, 'user_' + action, id, null, { reason: String(b?.reason || '').slice(0, 500) || null });
      return ok(res, { suspended: action === 'suspend' });
    }

    if (action === 'confirm_email') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { email_confirm: true });
      if (error) return fail(res, 400, 'Confirmation impossible : ' + error.message, 'AUTH_UPDATE_FAILED', error);
      await audit(admin.id, 'user_confirm_email', id, null, null);
      return ok(res, { confirmed: true });
    }

    if (action === 'note') {
      const note = String(b?.note || '').trim().slice(0, 4000);
      if (!note) return fail(res, 400, 'Note vide.', 'EMPTY_NOTE');
      const { data, error } = await supabaseAdmin.from('user_admin_notes').insert({ user_id: id, author_id: admin.id, note }).select('id,note,author_id,created_at').single();
      if (error) throw error;
      return ok(res, data);
    }

    if (action === 'note_delete') {
      const nid = Number(b?.note_id);
      if (!Number.isInteger(nid)) return fail(res, 400, 'Note invalide.', 'INVALID_NOTE');
      const { error } = await supabaseAdmin.from('user_admin_notes').delete().eq('id', nid).eq('user_id', id);
      if (error) throw error;
      return ok(res, { deleted: nid });
    }

    if (action === 'delete') {
      if (isMasterTarget || isSelf) return fail(res, 400, 'Ce compte ne peut pas être supprimé.', 'PROTECTED_ACCOUNT');
      if (String(b?.confirm_email || '').trim().toLowerCase() !== String(cur.email || '').toLowerCase()) {
        return fail(res, 400, 'Confirmation incorrecte : saisissez l’adresse exacte du compte.', 'CONFIRMATION_MISMATCH');
      }
      await audit(admin.id, 'user_delete', id, cur, null);
      const { error: ae } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (ae && !/not.?found/i.test(ae.message || '')) return fail(res, 400, 'Suppression impossible : ' + ae.message, 'AUTH_DELETE_FAILED', ae);
      const { error: de } = await supabaseAdmin.from('users').delete().eq('id', id);
      if (de) console.warn('[ADMIN_USERS] suppression profil', de.message);
      return ok(res, { deleted: id });
    }

    return fail(res, 400, 'Action inconnue.', 'INVALID_ACTION');
  } catch (e) {
    return fail(res, 500, 'Erreur serveur.', 'ADMIN_USERS_ERROR', e);
  }
}

/* ── Options de l'application ─────────────────────────────── */

export const CONFIG_DEFAULTS = {
  maintenance: false,
  maintenance_message: 'The Capital est en maintenance. Nous revenons très vite.',
  banner_enabled: false,
  banner_text: '',
  banner_level: 'info',
  banner_link: '',
  banner_until: null,
  signups_open: true,
  trial_days: 14,
  support_email: '',
  support_whatsapp: ''
};

function cleanConfig(input) {
  const c = { ...CONFIG_DEFAULTS };
  const s = (v, n) => String(v ?? '').trim().slice(0, n);
  c.maintenance = input?.maintenance === true;
  c.maintenance_message = s(input?.maintenance_message, 400) || CONFIG_DEFAULTS.maintenance_message;
  c.banner_enabled = input?.banner_enabled === true;
  c.banner_text = s(input?.banner_text, 280);
  c.banner_level = ['info', 'success', 'warning', 'danger'].includes(input?.banner_level) ? input.banner_level : 'info';
  const link = s(input?.banner_link, 300);
  c.banner_link = /^(https:\/\/|\/)/.test(link) ? link : '';
  const until = input?.banner_until ? new Date(input.banner_until) : null;
  c.banner_until = until && !Number.isNaN(until.getTime()) ? until.toISOString() : null;
  c.signups_open = input?.signups_open !== false;
  const d = Math.trunc(Number(input?.trial_days));
  c.trial_days = Number.isFinite(d) ? Math.max(0, Math.min(365, d)) : 14;
  const mail = s(input?.support_email, 160);
  c.support_email = !mail || EMAIL_RE.test(mail) ? mail : '';
  c.support_whatsapp = s(input?.support_whatsapp, 30).replace(/[^\d+ ]/g, '');
  return c;
}

async function readConfig() {
  const { data, error } = await supabaseAdmin.from('admin_settings').select('value,updated_at').eq('key', 'app_config').maybeSingle();
  if (error) throw error;
  return { config: { ...CONFIG_DEFAULTS, ...(data?.value || {}) }, updated_at: data?.updated_at || null };
}

const PLAN_PRICES = ['weekly_price', 'monthly_price', 'quarterly_price', 'semiannual_price', 'annual_price'];

export async function handleAdminSettings(req, res, admin) {
  try {
    if (req.method === 'GET') {
      const [cfg, plans, other] = await Promise.all([
        readConfig(),
        supabaseAdmin.from('billing_plans').select('code,name,description,currency,active,display_order,features,' + PLAN_PRICES.join(',') + ',updated_at').order('display_order', { ascending: true }),
        supabaseAdmin.from('admin_settings').select('key,value,updated_at').neq('key', 'app_config').order('key')
      ]);
      if (plans.error) throw plans.error;
      return ok(res, { ...cfg, plans: plans.data || [], other: other.error ? [] : other.data || [] });
    }
    if (req.method !== 'POST') return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
    let b;
    try { b = await readBody(req); } catch (e) { return fail(res, e instanceof BodyError ? 400 : 500, 'Requête illisible.', 'INVALID_BODY'); }
    const action = String(b?.action || '').toLowerCase();

    if (action === 'config') {
      const before = await readConfig();
      const value = cleanConfig(b?.config || {});
      const { error } = await supabaseAdmin.from('admin_settings').upsert({ key: 'app_config', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      await supabaseAdmin.from('admin_audit_log').insert({ actor_id: admin.id, action: 'app_config_update', table_name: 'admin_settings', record_id: 'app_config', old_data: before.config, new_data: value });
      return ok(res, value);
    }

    if (action === 'plan') {
      const code = String(b?.code || '').trim().toLowerCase();
      const { data: cur, error: ce } = await supabaseAdmin.from('billing_plans').select('*').eq('code', code).maybeSingle();
      if (ce) throw ce;
      if (!cur) return fail(res, 404, 'Formule introuvable.', 'NOT_FOUND');
      const p = b?.plan || {};
      const u = { updated_at: new Date().toISOString() };
      if (p.name !== undefined) { const n = String(p.name).trim().slice(0, 80); if (!n) return fail(res, 400, 'Nom requis.', 'INVALID_NAME'); u.name = n; }
      if (p.description !== undefined) u.description = String(p.description || '').trim().slice(0, 600) || null;
      if (p.active !== undefined) u.active = p.active === true;
      if (p.display_order !== undefined) { const o = Math.trunc(Number(p.display_order)); if (Number.isFinite(o)) u.display_order = o; }
      for (const k of PLAN_PRICES) {
        if (p[k] === undefined) continue;
        if (p[k] === null || p[k] === '') { u[k] = null; continue; }
        const v = Number(p[k]);
        if (!Number.isFinite(v) || v < 0 || v > 1e9) return fail(res, 400, 'Prix invalide (' + k + ').', 'INVALID_PRICE');
        u[k] = Math.round(v);
      }
      if (p.features !== undefined) {
        const list = Array.isArray(p.features) ? p.features : String(p.features || '').split('\n');
        u.features = list.map(x => String(x).trim()).filter(Boolean).slice(0, 40).map(x => x.slice(0, 200));
      }
      const { data, error } = await supabaseAdmin.from('billing_plans').update(u).eq('code', code).select('*').single();
      if (error) throw error;
      await supabaseAdmin.from('admin_audit_log').insert({ actor_id: admin.id, action: 'billing_plan_update', table_name: 'billing_plans', record_id: code, old_data: cur, new_data: data });
      return ok(res, data);
    }

    return fail(res, 400, 'Action inconnue.', 'INVALID_ACTION');
  } catch (e) {
    return fail(res, 500, 'Erreur serveur.', 'ADMIN_SETTINGS_ERROR', e);
  }
}

/* Options publiques : bandeau, maintenance, inscriptions, contact. */
export async function handlePublicConfig(req, res) {
  try {
    const [{ config: c }, pl] = await Promise.all([
      readConfig(),
      supabaseAdmin.from('billing_plans').select('code,name,description,features,display_order,' + PLAN_PRICES.join(',')).eq('active', true).order('display_order', { ascending: true })
    ]);
    const plans = (pl.error ? [] : pl.data || []).map(p => ({
      code: p.code, name: p.name, description: p.description || null, features: Array.isArray(p.features) ? p.features : [],
      prices: Object.fromEntries(PLAN_PRICES.map(k => [k.replace('_price', ''), p[k] == null ? null : Number(p[k])]))
    }));
    const bannerLive = c.banner_enabled && c.banner_text && (!c.banner_until || Date.parse(c.banner_until) > Date.now());
    return json(res, 200, {
      success: true,
      data: {
        maintenance: !!c.maintenance,
        maintenance_message: c.maintenance ? c.maintenance_message : '',
        banner: bannerLive ? { text: c.banner_text, level: c.banner_level, link: c.banner_link || null } : null,
        signups_open: c.signups_open !== false,
        trial_days: c.trial_days,
        support: { email: c.support_email || null, whatsapp: c.support_whatsapp || null },
        plans
      }
    }, { cache: 'public, max-age=60, s-maxage=60' });
  } catch (e) {
    return fail(res, 500, 'Configuration indisponible.', 'PUBLIC_CONFIG_ERROR', e);
  }
}
