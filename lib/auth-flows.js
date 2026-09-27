/**
 * Inscription, confirmation par code et mot de passe oublié, pilotés par le
 * serveur The Capital et envoyés par lib/mailer.js (Brevo / Resend, gratuits).
 *
 *   signup  { email, password, nom, legal_consent_at, legal_version }
 *   verify  { email, code }            -> session prête à l'emploi
 *   resend  { email }
 *   recover { email }                  -> lien vers /reset-password.html
 *   status  {}                         -> { mailer: bool } (le client choisit son parcours)
 *
 * Si aucun fournisseur d'e-mail n'est configuré, signup/resend/recover
 * renvoient 503 MAILER_UNAVAILABLE et les pages retombent sur les e-mails
 * Supabase d'origine.
 */
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import config from './config.js';
import { supabaseAdmin } from './supabase.js';
import { json, fail } from './http.js';
import { mailerReady, sendMail, MAILS, SITE_URL } from './mailer.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const OTP_TTL_MIN = 15;
const MAX_ATTEMPTS = 5;
const PEPPER = config.supabaseSecretKey || 'tc';

const hashCode = (email, code) => createHash('sha256').update(PEPPER + '|' + email + '|' + code).digest('hex');
const sameHash = (a, b) => { try { return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')); } catch { return false; } };

async function appConfig() {
  const { data } = await supabaseAdmin.from('admin_settings').select('value').eq('key', 'app_config').maybeSingle();
  return data?.value || {};
}

async function findAuthUser(email) {
  const { data: prof } = await supabaseAdmin.from('users').select('id').eq('email', email).maybeSingle();
  if (prof?.id) {
    const r = await supabaseAdmin.auth.admin.getUserById(prof.id);
    if (!r.error && r.data?.user) return r.data.user;
  }
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = (data?.users || []).find(u => String(u.email || '').toLowerCase() === email);
    if (hit) return hit;
    if ((data?.users || []).length < 1000) break;
  }
  return null;
}

/* Anti-abus : 1 code par minute, 6 par heure et par adresse. */
async function throttled(email) {
  const since = new Date(Date.now() - 3600e3).toISOString();
  const { data } = await supabaseAdmin.from('the_capital_signup_otps').select('created_at').eq('email', email).gte('created_at', since).order('created_at', { ascending: false });
  const list = data || [];
  if (list[0] && Date.now() - Date.parse(list[0].created_at) < 60e3) return 'Patientez une minute avant de demander un nouveau code.';
  if (list.length >= 6) return 'Trop de demandes pour cette adresse. Réessayez dans une heure.';
  return null;
}

async function issueCode(user, nom) {
  const email = String(user.email).toLowerCase();
  const code = String(randomInt(0, 1e6)).padStart(6, '0');
  await supabaseAdmin.from('the_capital_signup_otps').update({ used_at: new Date().toISOString() }).eq('email', email).is('used_at', null);
  const { error } = await supabaseAdmin.from('the_capital_signup_otps').insert({
    email, user_id: user.id, code_hash: hashCode(email, code), expires_at: new Date(Date.now() + OTP_TTL_MIN * 60e3).toISOString()
  });
  if (error) throw error;
  const m = MAILS.signupCode(code, nom);
  return sendMail({ to: email, name: nom, subject: m.subject, content: m.content });
}

/* Session Supabase complète sans mot de passe : lien magique généré puis vérifié côté serveur. */
async function sessionFor(email) {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data?.properties?.hashed_token) return null;
  const r = await fetch(config.supabaseUrl + '/auth/v1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.supabasePublishableKey },
    body: JSON.stringify({ type: 'magiclink', token_hash: data.properties.hashed_token })
  });
  const s = await r.json().catch(() => null);
  return r.ok && s?.access_token ? s : null;
}

export async function handleAuthFlow(req, res, action, body) {
  if (!supabaseAdmin) return fail(res, 503, 'Service temporairement indisponible.', 'SERVICE_UNAVAILABLE');
  if (action === 'status') return json(res, 200, { success: true, mailer: mailerReady() });
  const email = String(body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return fail(res, 400, 'Adresse e-mail invalide.', 'INVALID_EMAIL');

  try {
    if (action === 'recover') {
      if (!mailerReady()) return fail(res, 503, 'Envoi d’e-mails indisponible.', 'MAILER_UNAVAILABLE');
      const user = await findAuthUser(email);
      if (user) {
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: SITE_URL + '/reset-password.html' } });
        if (!error && data?.properties?.action_link) {
          const m = MAILS.recovery(data.properties.action_link);
          const sent = await sendMail({ to: email, subject: m.subject, content: m.content });
          /* Fournisseur en refus (clé, IP non autorisée, quota) : la page bascule sur l'envoi Supabase. */
          if (!sent.sent) return fail(res, 503, 'Envoi d’e-mails indisponible.', 'MAILER_UNAVAILABLE');
        }
      }
      /* Même réponse qu'il existe ou non un compte : aucune énumération d'adresses. */
      return json(res, 200, { success: true });
    }

    if (action === 'signup') {
      if (!mailerReady()) return fail(res, 503, 'Envoi d’e-mails indisponible.', 'MAILER_UNAVAILABLE');
      const cfg = await appConfig();
      if (cfg.signups_open === false) return fail(res, 403, 'Les inscriptions sont momentanément fermées.', 'SIGNUPS_CLOSED');
      const password = String(body?.password || '');
      const nom = String(body?.nom || '').trim().slice(0, 120);
      if (!nom) return fail(res, 400, 'Indiquez votre nom.', 'INVALID_NAME');
      if (password.length < 8) return fail(res, 400, 'Le mot de passe doit contenir au moins 8 caractères.', 'WEAK_PASSWORD');
      if (!body?.legal_consent_at) return fail(res, 400, 'Vous devez accepter les CGU.', 'CONSENT_REQUIRED');
      const wait = await throttled(email);
      if (wait) return fail(res, 429, wait, 'TOO_MANY_REQUESTS');

      let user = await findAuthUser(email);
      if (user && (user.email_confirmed_at || user.confirmed_at)) {
        return fail(res, 409, 'Un compte existe déjà avec cette adresse. Connectez-vous ou utilisez « mot de passe oublié ».', 'ALREADY_REGISTERED');
      }
      const meta = { nom, legal_consent_at: String(body.legal_consent_at).slice(0, 40), legal_version: String(body?.legal_version || '').slice(0, 20) || null };
      if (user) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password, user_metadata: meta });
        if (error) throw error;
      } else {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: false, user_metadata: meta });
        if (error) return fail(res, 400, 'Création du compte impossible : ' + error.message, 'SIGNUP_FAILED');
        user = data.user;
      }
      const { error: pe } = await supabaseAdmin.from('users').upsert({ id: user.id, email, nom }, { onConflict: 'id' });
      if (pe) console.warn('[AUTH_FLOW] profil', pe.message);
      const sent = await issueCode(user, nom);
      /* 503 : la page d'inscription reprend alors le parcours Supabase (lien de confirmation). */
      if (!sent.sent) return fail(res, 503, 'Envoi d’e-mails indisponible.', 'MAILER_UNAVAILABLE');
      return json(res, 200, { success: true, email });
    }

    if (action === 'resend') {
      if (!mailerReady()) return fail(res, 503, 'Envoi d’e-mails indisponible.', 'MAILER_UNAVAILABLE');
      const user = await findAuthUser(email);
      if (!user || user.email_confirmed_at) return json(res, 200, { success: true });
      const wait = await throttled(email);
      if (wait) return fail(res, 429, wait, 'TOO_MANY_REQUESTS');
      const { data: prof } = await supabaseAdmin.from('users').select('nom').eq('id', user.id).maybeSingle();
      const sent = await issueCode(user, prof?.nom || user.user_metadata?.nom);
      if (!sent.sent) return fail(res, 502, 'Le code n’a pas pu être envoyé. Réessayez dans un instant.', 'MAIL_FAILED');
      return json(res, 200, { success: true });
    }

    if (action === 'verify') {
      const code = String(body?.code || '').replace(/\D/g, '');
      if (!/^\d{6}$/.test(code)) return fail(res, 400, 'Entrez les 6 chiffres du code reçu.', 'INVALID_CODE');
      const { data: rows, error } = await supabaseAdmin.from('the_capital_signup_otps').select('*').eq('email', email).is('used_at', null).order('created_at', { ascending: false }).limit(1);
      if (error) throw error;
      const otp = rows?.[0];
      if (!otp || Date.parse(otp.expires_at) < Date.now()) return fail(res, 400, 'Code expiré. Demandez-en un nouveau.', 'CODE_EXPIRED');
      if (otp.attempts >= MAX_ATTEMPTS) return fail(res, 429, 'Trop d’essais. Demandez un nouveau code.', 'TOO_MANY_ATTEMPTS');
      if (!sameHash(otp.code_hash, hashCode(email, code))) {
        await supabaseAdmin.from('the_capital_signup_otps').update({ attempts: otp.attempts + 1 }).eq('id', otp.id);
        return fail(res, 400, 'Code incorrect (' + (MAX_ATTEMPTS - otp.attempts - 1) + ' essai(s) restant(s)).', 'CODE_INVALID');
      }
      await supabaseAdmin.from('the_capital_signup_otps').update({ used_at: new Date().toISOString() }).eq('id', otp.id);
      const { error: ue } = await supabaseAdmin.auth.admin.updateUserById(otp.user_id, { email_confirm: true });
      if (ue) throw ue;
      const session = await sessionFor(email);
      const [{ data: prof }, cfg] = await Promise.all([supabaseAdmin.from('users').select('nom').eq('id', otp.user_id).maybeSingle(), appConfig()]);
      const w = MAILS.welcome(prof?.nom, Number(cfg.trial_days ?? 14));
      sendMail({ to: email, name: prof?.nom, subject: w.subject, content: w.content }).catch(() => {});
      return json(res, 200, { success: true, session });
    }

    return fail(res, 400, 'Action inconnue.', 'INVALID_ACTION');
  } catch (e) {
    return fail(res, 500, 'Erreur serveur. Réessayez dans un instant.', 'AUTH_FLOW_ERROR', e);
  }
}

/**
 * Rappels de fin d'essai (tâche quotidienne) : e-mail à J-3 et à J-1 pour les
 * comptes Découverte dont l'essai se termine. Idempotent sur la journée grâce
 * à user_events (événement trial_reminder_<j>).
 */
export async function sendTrialReminders() {
  if (!mailerReady()) return { sent: 0, skipped: 'MAILER_UNAVAILABLE' };
  const now = Date.now();
  const { data, error } = await supabaseAdmin.from('users').select('id,email,nom,plan,trial_ends_at')
    .gte('trial_ends_at', new Date(now).toISOString()).lte('trial_ends_at', new Date(now + 3.5 * 86400e3).toISOString());
  if (error) throw error;
  let sent = 0;
  for (const u of data || []) {
    if ((u.plan || 'free') !== 'free' || !u.email) continue;
    const days = Math.max(1, Math.ceil((Date.parse(u.trial_ends_at) - now) / 86400e3));
    if (days !== 3 && days !== 1) continue;
    const evt = 'trial_reminder_' + days;
    const { data: already } = await supabaseAdmin.from('user_events').select('id').eq('user_id', u.id).eq('event_name', evt).limit(1);
    if (already && already.length) continue;
    const m = MAILS.trialEnding(u.nom, days);
    const r = await sendMail({ to: u.email, name: u.nom, subject: m.subject, content: m.content });
    if (r.sent) {
      sent++;
      await supabaseAdmin.from('user_events').insert({ user_id: u.id, event_name: evt, metadata: { trial_ends_at: u.trial_ends_at } });
    }
  }
  return { sent, candidates: (data || []).length };
}
