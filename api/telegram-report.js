/**
 * Bulletin de marché automatique (séance ou semaine), prêt à publier.
 *
 * GET /api/telegram-report?periode=seance|hebdo[&date=AAAA-MM-JJ][&essai=1|2|3][&envoi=0][&force=1]
 *   - pg_cron (secret machine) : séance à 16 h 40, 18 h 10, 20 h 10 ; semaine le vendredi ;
 *   - administrateur : envoi=0 génère et range sans rien envoyer ; force=1 renvoie un
 *     bulletin déjà parti (après correction des données). Le contrôle qualité s'applique
 *     TOUJOURS, il n'existe pas de moyen de le contourner.
 *
 * Déroulé :
 *   1. déjà envoyé ? -> rien (registre reporting_envois, verrou en base) ;
 *   2. pas de séance ? -> attente, puis « sans séance » au dernier essai ;
 *   3. contrôle qualité (lib/report-controls.js) -> si bloquant : AUCUN visuel, alerte
 *      Telegram détaillée, nouvel essai au créneau suivant ;
 *   4. génération (lib/report-visuals.js) et textes (lib/report-captions.js) ;
 *   5. rangement dans le bucket public `reportings` (reporting/<periode>/<date>/) ;
 *   6. envoi Telegram : album de fichiers non compressés, textes à copier, bilan du contrôle.
 * Chaque issue est tracée ; une vérification SQL du soir alerte si aucune ne l'a été.
 */
import { supabaseAdmin } from '../lib/supabase.js';
import { isMachineRequest, authenticateAdmin, handlePreflight } from '../lib/middleware.js';
import { json, fail, requestUrl } from '../lib/http.js';
import appConfig from '../lib/config.js';
import { collectBulletin } from '../lib/report-data.js';
import { controlerBulletin } from '../lib/report-controls.js';
import { renderBulletin } from '../lib/report-visuals.js';
import { captionsIA } from '../lib/report-captions.js';

export const config = { maxDuration: 60 };

const BUCKET = 'reportings';
const PROCHAIN = { seance: { 1: '18 h 10', 2: '20 h 10' }, hebdo: { 1: '20 h 25', 2: '20 h 25' } };

/* ── Registre ─────────────────────────────────────────────────────── */
async function dejaEnvoye(periode, date) {
  const { data, error } = await supabaseAdmin.from('reporting_envois').select('id')
    .eq('periode', periode).eq('date_ref', date).in('statut', ['envoye', 'en_cours']).limit(1);
  if (error) throw error;
  return !!(data && data.length);
}
async function tracer(ligne) {
  const { data, error } = await supabaseAdmin.from('reporting_envois').insert(ligne).select('id').single();
  if (error) throw error;
  return data.id;
}
async function majTrace(id, champs) {
  if (!id) return;
  await supabaseAdmin.from('reporting_envois').update(Object.assign({ updated_at: new Date().toISOString() }, champs)).eq('id', id);
}

/* ── Stockage ─────────────────────────────────────────────────────── */
async function ranger(prefix, fichiers) {
  const liens = {};
  for (const [nom, buf, type] of fichiers) {
    const path = `${prefix}/${nom}`;
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, { contentType: type, upsert: true, cacheControl: '300' });
    if (error) throw new Error(`Stockage ${path} : ${error.message}`);
    liens[nom] = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }
  return liens;
}

/* ── Telegram ─────────────────────────────────────────────────────── */
/* Identifiants : variables Vercel, sinon Vault Supabase (même bot que les rapports SQL). */
let TG = null;
async function identifiantsTelegram() {
  if (TG) return TG;
  if (appConfig.telegramBotToken && appConfig.telegramChatId) return (TG = { token: appConfig.telegramBotToken, chat: appConfig.telegramChatId });
  const { data, error } = await supabaseAdmin.rpc('tc_telegram_credentials');
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row?.bot_token || !row?.chat_id) return null;
  return (TG = { token: row.bot_token, chat: row.chat_id });
}
async function telegram(methode, form) {
  const res = await fetch(`https://api.telegram.org/bot${TG.token}/${methode}`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(`Telegram ${methode} : ${body.description || res.status}`);
  return body;
}
async function message(texte) {
  if (!(await identifiantsTelegram())) return;
  const f = new FormData();
  f.append('chat_id', TG.chat);
  f.append('text', texte.slice(0, 4096));
  f.append('disable_web_page_preview', 'true');
  await telegram('sendMessage', f);
}
async function album(fichiers, legende) {
  const form = new FormData();
  form.append('chat_id', TG.chat);
  form.append('media', JSON.stringify(fichiers.map((f, i) => Object.assign(
    { type: 'document', media: `attach://f${i}` }, i === fichiers.length - 1 ? { caption: legende } : {}))));
  fichiers.forEach(([nom, buf, type], i) => form.append(`f${i}`, new Blob([buf], { type }), nom));
  await telegram('sendMediaGroup', form);
}

const libelle = (periode, date) => (periode === 'hebdo' ? 'Bulletin de la semaine au ' : 'Bulletin de la séance du ') + date.split('-').reverse().join('/');
const puces = (l, n = 8) => l.slice(0, n).map(x => '• ' + x).join('\n') + (l.length > n ? `\n• … et ${l.length - n} autre(s)` : '');

export default async function handler(req, res) {
  if (handlePreflight(req, res, { methods: 'GET,OPTIONS' })) return;
  if (req.method !== 'GET') return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
  if (!isMachineRequest(req)) {
    const admin = await authenticateAdmin(req, res);
    if (!admin) return;
  }
  if (!supabaseAdmin) return fail(res, 503, 'Service temporairement indisponible.', 'SERVICE_UNAVAILABLE');

  const url = requestUrl(req);
  const periode = url.searchParams.get('periode') === 'hebdo' ? 'hebdo' : 'seance';
  const dateParam = url.searchParams.get('date');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam || '') ? dateParam : new Date().toISOString().slice(0, 10);
  const envoi = url.searchParams.get('envoi') !== '0';
  const force = url.searchParams.get('force') === '1';
  const essai = Math.min(3, Math.max(1, Number(url.searchParams.get('essai')) || 3));
  const final = essai >= 3 || !PROCHAIN[periode][essai];
  const titre = libelle(periode, date);
  let traceId = null;

  try {
    // 1. Anti-doublon.
    if (envoi && !force && await dejaEnvoye(periode, date)) {
      return json(res, 200, { success: true, skipped: true, reason: 'already_sent', periode, date });
    }

    // 2. Séance présente ?
    const d = await collectBulletin({ periode, date });
    if (!d || (periode === 'seance' && !d.seances.includes(date))) {
      if (envoi && final) {
        await tracer({ periode, date_ref: date, essai, statut: 'sans_seance' });
        await message(`ℹ️ ${titre} : aucune séance en base pour cette date (jour férié, ou import absent). Aucun bulletin publié.`);
      }
      return json(res, 200, { success: true, skipped: true, reason: 'no_data', periode, date, essai });
    }

    // 3. Contrôle qualité — bloquant, sans exception.
    const qc = controlerBulletin(d);
    if (!qc.ok) {
      if (envoi) {
        await tracer({ periode, date_ref: date, essai, statut: 'bloque', bloquants: qc.bloquants, avertissements: qc.avertissements });
        await message(`⛔ ${titre} BLOQUÉ par le contrôle qualité — rien n'a été publié.\n\n${puces(qc.bloquants)}\n\n` +
          (final ? 'Dernier essai du jour. Corrige les données puis relance depuis l\'administration (Reporting).'
            : `Nouvel essai automatique à ${PROCHAIN[periode][essai]} GMT.`));
      }
      return json(res, 200, { success: false, blocked: true, periode, date, essai, bloquants: qc.bloquants, avertissements: qc.avertissements });
    }

    // Verrou : une seule génération/envoi à la fois pour ce bulletin.
    if (envoi) {
      if (force) {
        await supabaseAdmin.from('reporting_envois').update({ statut: 'erreur', erreur: 'remplacé par un renvoi forcé', updated_at: new Date().toISOString() })
          .eq('periode', periode).eq('date_ref', date).in('statut', ['envoye', 'en_cours']);
      }
      try {
        traceId = await tracer({ periode, date_ref: date, essai, statut: 'en_cours', avertissements: qc.avertissements });
      } catch (e) {
        if (String(e.code) === '23505') return json(res, 200, { success: true, skipped: true, reason: 'already_sent', periode, date });
        throw e;
      }
    }

    // 4. Génération.
    const visuels = await renderBulletin(d);
    const textes = await captionsIA(d);
    const fichiers = [
      ['story-tiktok-1080x1920.png', visuels.story, 'image/png'],
      ['post-carre-1080x1080.png', visuels.carre, 'image/png'],
      ['carrousel-linkedin.pdf', visuels.pdf, 'application/pdf'],
      ...visuels.slides.map((p, i) => [`carrousel-${i + 1}-1080x1350.png`, p, 'image/png'])
    ];

    // 5. Rangement.
    const liens = await ranger(`reporting/${periode}/${d.to}`, [
      ...fichiers,
      ['textes.json', Buffer.from(JSON.stringify(textes, null, 2)), 'application/json'],
      ['controle-qualite.json', Buffer.from(JSON.stringify(qc, null, 2)), 'application/json']
    ]);

    // 6. Envoi.
    let telegramEnvoye = false;
    if (envoi && await identifiantsTelegram()) {
      await album(fichiers, `${visuels.meta.titreCourt} — ${visuels.meta.sousTitre}\nStory 9:16 · Carré 1:1 · Carrousel 4:5 (PNG + PDF LinkedIn)`);
      // Les visuels sont partis : le bulletin est « envoyé », un nouvel essai ne doit pas les renvoyer.
      await majTrace(traceId, { statut: 'envoye', fichiers: liens });
      telegramEnvoye = true;
      try {
      await message('🎵 TEXTE TIKTOK / REELS\n\n' + textes.tiktok);
      await message('💼 TEXTE LINKEDIN\n\n' + textes.linkedin);
      const conc = d.controle.concordance;
      const concOk = conc.filter(x => x.ecart <= 0.3).length;
      await message(`✅ Contrôle qualité réussi — ${d.controle.nbCotesDernier}/${d.controle.nbActifs} titres, 3 indices à jour, ` +
        `${concOk}/${conc.length} variations conformes aux chiffres officiels BRVM, aucune variation hors limite.` +
        (qc.ajustes.length ? `\n↺ Ajustés (dividende / opération sur titres) : ${qc.ajustes.join(' ; ')}` : '') +
        (qc.avertissements.length ? `\n\n⚠️ À titre d'information :\n${puces(qc.avertissements, 5)}` : ''));
      } catch (e) {
        console.error('[TELEGRAM-REPORT] textes non envoyés', e);
        await majTrace(traceId, { erreur: 'visuels envoyés, textes non envoyés : ' + String(e.message || e).slice(0, 500) });
      }
    }
    await majTrace(traceId, { statut: 'envoye', fichiers: liens });

    return json(res, 200, {
      success: true, periode, from: d.from, to: d.to, essai, telegram: telegramEnvoye,
      controle: { avertissements: qc.avertissements, ajustes: qc.ajustes },
      textes: { source: textes.source, erreurIA: textes.erreurIA || null }, fichiers: liens
    });
  } catch (error) {
    console.error('[TELEGRAM-REPORT]', error);
    try {
      if (traceId) await majTrace(traceId, { statut: 'erreur', erreur: String(error.message || error).slice(0, 1000) });
      else if (envoi) await tracer({ periode, date_ref: date, essai, statut: 'erreur', erreur: String(error.message || error).slice(0, 1000) });
      if (envoi) await message(`🚨 ${titre} : erreur technique, rien n'a été publié.\n${String(error.message || error).slice(0, 500)}\n\n` +
        (final ? 'Dernier essai du jour.' : `Nouvel essai automatique à ${PROCHAIN[periode][essai]} GMT.`));
    } catch (e2) { console.error('[TELEGRAM-REPORT] alerte impossible', e2); }
    return fail(res, 500, 'Génération du bulletin impossible.', 'REPORT_ERROR', error);
  }
}
