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
import { mailerReady, mailerInfo, sendMail, MAILS, SITE_URL } from './mailer.js';

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
    supabaseAdmin.from('payment_proofs').select('id,payment_order_id,proof_type,transaction_reference,claimed_amount,status,reviewer_note,storage_path,note,created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('transactions').select('id,ticker,type,quantite,cours,prix_unitaire,date_transaction,montant_net').eq('user_id', id).order('date_transaction', { ascending: false }).limit(200),
    supabaseAdmin.from('alertes_cours').select('id,ticker,type_alerte,seuil,active,created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('watchlist').select('id,ticker,note,created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('user_events').select('event_name,occurred_at,metadata').eq('user_id', id).order('occurred_at', { ascending: false }).limit(50),
    supabaseAdmin.from('user_admin_notes').select('id,note,author_id,created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
    Promise.resolve({ data: [] }),
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
  const history = await clientHistory(id, pick(subs).map(s => s.id), pick(orders).map(o => o.id));
  return ok(res, {
    user: u.data, auth,
    subscriptions: pick(subs), payments: pick(pays), payment_orders: pick(orders), payment_proofs: pick(proofs),
    transactions: pick(tx), alertes: pick(al), watchlist: pick(wl), events: pick(ev),
    notes: pick(notes), history, institute: inst && !inst.error ? inst.data : null
  });
}

/* ── Journal ─────────────────────────────────────────────────
   Chaque entrée porte l'auteur (e-mail), le client concerné et l'état
   avant / après, pour que l'administration lise « qui a fait quoi ». */
const AUDIT_COLS = 'id,actor_id,action,table_name,record_id,old_data,new_data,created_at';

async function emailsById(ids) {
  const list = [...new Set(ids.filter(x => uuid(x)))];
  if (!list.length) return {};
  const { data } = await supabaseAdmin.from('users').select('id,email,nom').in('id', list);
  return Object.fromEntries((data || []).map(u => [u.id, u]));
}

function targetOf(e) {
  const pick = o => (o && typeof o === 'object' ? o.user_id || null : null);
  if (e.table_name === 'users') return e.record_id || null;
  return pick(e.new_data) || pick(e.old_data) || null;
}

async function decorate(entries) {
  const people = await emailsById(entries.flatMap(e => [e.actor_id, targetOf(e)]));
  return entries.map(e => {
    const t = targetOf(e);
    return { ...e, actor: people[e.actor_id] || null, target_id: t, target: t ? people[t] || null : null };
  });
}

async function clientHistory(id, subIds, orderIds) {
  const ids = [id, ...subIds, ...orderIds].filter(Boolean);
  const [a, b, p] = await Promise.all([
    supabaseAdmin.from('admin_audit_log').select(AUDIT_COLS).in('record_id', ids).order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('admin_audit_log').select(AUDIT_COLS).or('new_data->>user_id.eq.' + id + ',old_data->>user_id.eq.' + id).order('created_at', { ascending: false }).limit(200),
    orderIds.length
      ? supabaseAdmin.from('payment_audit_log').select('id,payment_order_id,actor_user_id,action,from_status,to_status,note,metadata,created_at').in('payment_order_id', orderIds).order('created_at', { ascending: false }).limit(200)
      : Promise.resolve({ data: [] })
  ]);
  const seen = new Set();
  const audit = [...(a.data || []), ...(b.data || [])].filter(e => !seen.has(e.id) && seen.add(e.id));
  const pay = (p.data || []).map(x => ({
    id: 'pay-' + x.id, actor_id: x.actor_user_id, action: 'payment_' + x.action, table_name: 'payment_orders', record_id: x.payment_order_id,
    old_data: { status: x.from_status }, new_data: { status: x.to_status, note: x.note, ...(x.metadata || {}) }, created_at: x.created_at
  }));
  const all = [...audit, ...pay].sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at)).slice(0, 200);
  return decorate(all);
}

async function journal(res, url) {
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 300), 1), 1000);
  let q = supabaseAdmin.from('admin_audit_log').select(AUDIT_COLS).order('created_at', { ascending: false }).limit(limit);
  const before = url.searchParams.get('before');
  if (before && !Number.isNaN(Date.parse(before))) q = q.lt('created_at', before);
  const table = url.searchParams.get('table');
  if (table && /^[a-z_]{2,60}$/.test(table)) q = q.eq('table_name', table);
  const { data, error } = await q;
  if (error) throw error;
  return ok(res, { entries: await decorate(data || []) });
}

export async function handleAdminUsers(req, res, admin) {
  try {
    const url = requestUrl(req);
    if (req.method === 'GET') {
      if (url.searchParams.get('journal')) return await journal(res, url);
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
      let data, error;
      if (mailerReady()) {
        /* Lien d'invitation généré ici et envoyé par notre service d'e-mails : le client
           choisit son mot de passe sur /reset-password.html. */
        ({ data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'invite', email, options: { data: { nom }, redirectTo: SITE_URL + '/reset-password.html' } }));
        if (!error && data?.properties?.action_link) {
          const sent = await sendMail({ to: email, name: nom, subject: 'Votre accès à The Capital', content: {
            title: 'Bienvenue sur The Capital', intro: (nom ? 'Bonjour ' + nom + ', ' : 'Bonjour, ') + 'un compte vient d’être créé pour vous.',
            blocks: [{ text: 'Cliquez sur le bouton ci-dessous pour choisir votre mot de passe et accéder à votre espace.' }],
            cta: { label: 'Activer mon compte', url: data.properties.action_link } } });
          if (!sent.sent) return fail(res, 502, 'Compte créé mais e-mail non envoyé. Utilisez « Créer un lien de connexion » depuis sa fiche.', 'MAIL_FAILED');
        }
      } else {
        ({ data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: { nom }, redirectTo: SITE_URL + '/reset-password.html' }));
      }
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
      const nom = String(b?.nom ?? cur.nom ?? '').trim().slice(0, 120) || null;
      const email = b?.email === undefined ? cur.email : String(b.email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return fail(res, 400, 'Adresse e-mail invalide.', 'INVALID_EMAIL');
      const emailChanged = email !== String(cur.email || '').toLowerCase();
      if (emailChanged) {
        if (isMasterTarget) return fail(res, 400, 'L’adresse du compte maître ne peut pas être modifiée.', 'PROTECTED_ACCOUNT');
        const { data: taken } = await supabaseAdmin.from('users').select('id').eq('email', email).neq('id', id).maybeSingle();
        if (taken) return fail(res, 409, 'Un autre compte utilise déjà cette adresse.', 'ALREADY_EXISTS');
        /* Adresse de connexion changée directement (confirmée) : le client se connecte avec la nouvelle. */
        const { error: ae } = await supabaseAdmin.auth.admin.updateUserById(id, { email, email_confirm: true });
        if (ae) return fail(res, 400, 'Changement d’adresse impossible : ' + ae.message, 'AUTH_UPDATE_FAILED', ae);
      }
      const { data, error } = await supabaseAdmin.from('users').update(emailChanged ? { nom, email } : { nom }).eq('id', id).select(USER).single();
      if (error) throw error;
      await audit(admin.id, 'user_profile', id, { nom: cur.nom, email: cur.email }, { nom, email });
      return ok(res, data);
    }

    if (action === 'trial') {
      /* days > 0 : prolonge (à partir de la fin actuelle si l'essai court encore) ; 0 : termine ; date : fin exacte. */
      const now = Date.now();
      let end;
      if (b?.until) { const d = new Date(b.until); if (Number.isNaN(d.getTime())) return fail(res, 400, 'Date invalide.', 'INVALID_DATE'); end = d; }
      else {
        const n = Math.trunc(Number(b?.days));
        if (!Number.isFinite(n) || n < 0 || n > 365) return fail(res, 400, 'Nombre de jours invalide.', 'INVALID_DAYS');
        const base = cur.trial_ends_at && Date.parse(cur.trial_ends_at) > now ? Date.parse(cur.trial_ends_at) : now;
        end = new Date(n === 0 ? now : base + n * 86400000);
      }
      const upd = { trial_ends_at: end.toISOString() };
      if (!cur.trial_started_at) upd.trial_started_at = new Date(now).toISOString();
      const { data, error } = await supabaseAdmin.from('users').update(upd).eq('id', id).select(USER).single();
      if (error) throw error;
      await audit(admin.id, 'user_trial', id, { trial_started_at: cur.trial_started_at, trial_ends_at: cur.trial_ends_at }, upd);
      return ok(res, data);
    }

    if (action === 'role') {
      const next = b?.is_admin === true;
      if (!next && (isMasterTarget || isSelf)) return fail(res, 400, 'Ce compte doit rester administrateur.', 'PROTECTED_ACCOUNT');
      const { data, error } = await supabaseAdmin.from('users').update({ is_admin: next }).eq('id', id).select(USER).single();
      if (error) throw error;
      await audit(admin.id, 'user_role', id, { is_admin: !!cur.is_admin }, { is_admin: next });
      return ok(res, data);
    }

    if (action === 'reset_password' || action === 'magic_link') {
      const type = action === 'reset_password' ? 'recovery' : 'magiclink';
      const redirectTo = SITE_URL + (type === 'recovery' ? '/reset-password.html' : '/app/app.html');
      let sent = false, link = null;
      if (type === 'recovery' && !mailerReady()) {
        /* Sans service d'e-mails : e-mail Supabase. Ne pas générer de second lien, il
           invaliderait celui qui vient d'être envoyé. */
        const r = await supabaseAdmin.auth.resetPasswordForEmail(cur.email, { redirectTo });
        if (r.error) return fail(res, 400, 'Envoi impossible : ' + r.error.message, 'LINK_FAILED', r.error);
        sent = true;
      } else {
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type, email: cur.email, options: { redirectTo } });
        if (error) return fail(res, 400, 'Lien impossible à générer : ' + error.message, 'LINK_FAILED', error);
        link = data?.properties?.action_link || null;
        if (type === 'recovery' && link) {
          const m = MAILS.recovery(link);
          sent = (await sendMail({ to: cur.email, name: cur.nom, subject: m.subject, content: m.content })).sent;
        }
      }
      await audit(admin.id, 'user_' + action, id, null, { email_sent: sent });
      return ok(res, { email_sent: sent, link });
    }

    if (action === 'email') {
      if (!mailerReady()) return fail(res, 503, 'Aucun service d’e-mails configuré (Brevo ou Resend).', 'MAILER_UNAVAILABLE');
      const subject = String(b?.subject || '').trim().slice(0, 150);
      const message = String(b?.message || '').trim().slice(0, 8000);
      if (!subject || !message) return fail(res, 400, 'Objet et message requis.', 'EMPTY_MESSAGE');
      const m = MAILS.adminMessage(cur.nom, subject, message);
      const r = await sendMail({ to: cur.email, name: cur.nom, subject: m.subject, content: m.content, replyTo: admin.email || undefined });
      if (!r.sent) return fail(res, 502, 'Envoi impossible (' + (r.error || 'erreur') + ').', 'MAIL_FAILED');
      await audit(admin.id, 'user_email', id, null, { subject });
      await supabaseAdmin.from('user_admin_notes').insert({ user_id: id, author_id: admin.id, note: 'E-mail envoyé : « ' + subject + ' »\n' + message.slice(0, 1500) });
      return ok(res, { sent: true });
    }

    if (action === 'notify') {
      const kind = String(b?.kind || '');
      if (!mailerReady()) return ok(res, { sent: false, reason: 'MAILER_UNAVAILABLE' });
      let m = null;
      if (kind === 'subscription_active') m = MAILS.subscriptionActive(cur.nom, String(b?.plan_name || 'The Capital'), b?.end || cur.plan_expire_at);
      else if (kind === 'payment_rejected') m = MAILS.paymentRejected(cur.nom, String(b?.note || '').slice(0, 500));
      else if (kind === 'payment_info') m = MAILS.paymentInfo(cur.nom, String(b?.note || '').slice(0, 500));
      if (!m) return fail(res, 400, 'Notification inconnue.', 'INVALID_KIND');
      const r = await sendMail({ to: cur.email, name: cur.nom, subject: m.subject, content: m.content });
      return ok(res, { sent: r.sent });
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
      return ok(res, { ...cfg, plans: plans.data || [], other: other.error ? [] : other.data || [], mailer: mailerInfo() });
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
        /* ID client OAuth Google (public par nature) : bouton Google officiel sur le site. */
        google_client_id: process.env.GOOGLE_CLIENT_ID || null,
        plans
      }
    }, { cache: 'public, max-age=60, s-maxage=60' });
  } catch (e) {
    return fail(res, 500, 'Configuration indisponible.', 'PUBLIC_CONFIG_ERROR', e);
  }
}
