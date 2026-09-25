/**
 * Bulletin de marché automatique (séance ou semaine), prêt à publier.
 *
 * GET /api/telegram-report?periode=seance|hebdo[&date=AAAA-MM-JJ][&envoi=0]
 *   - pg_cron (secret machine) : après chaque séance, et le vendredi pour la semaine ;
 *   - administrateur : régénérer un bulletin à la main (envoi=0 : sans Telegram).
 *
 * Produit (lib/report-visuals.js) :
 *   story.png      1080×1920  TikTok, Reels, Stories, statut WhatsApp
 *   carre.png      1080×1080  post LinkedIn / X / Facebook
 *   slide-1..6.png 1080×1350  carrousel Instagram
 *   carrousel.pdf  6 pages    « document » LinkedIn
 * + les textes TikTok et LinkedIn (lib/report-captions.js).
 * Tout est rangé dans le bucket public `bulletins` (reporting/<periode>/<date>/)
 * puis envoyé sur Telegram : un album de fichiers non compressés, et un
 * message par texte à copier.
 */
import { supabaseAdmin } from '../lib/supabase.js';
import { isMachineRequest, authenticateAdmin, handlePreflight } from '../lib/middleware.js';
import { json, fail, requestUrl } from '../lib/http.js';
import appConfig from '../lib/config.js';
import { collectBulletin } from '../lib/report-data.js';
import { renderBulletin } from '../lib/report-visuals.js';
import { captionsIA } from '../lib/report-captions.js';

export const config = { maxDuration: 60 };

const BUCKET = 'bulletins';

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

async function envoyerTelegram(fichiers, legende, textes) {
  const form = new FormData();
  form.append('chat_id', TG.chat);
  form.append('media', JSON.stringify(fichiers.map(([nom], i) => Object.assign(
    { type: 'document', media: `attach://f${i}` },
    i === fichiers.length - 1 ? { caption: legende } : {}
  ))));
  fichiers.forEach(([nom, buf, type], i) => form.append(`f${i}`, new Blob([buf], { type }), nom));
  await telegram('sendMediaGroup', form);
  for (const t of textes) {
    const f = new FormData();
    f.append('chat_id', TG.chat);
    f.append('text', t.slice(0, 4096));
    f.append('disable_web_page_preview', 'true');
    await telegram('sendMessage', f);
  }
}

export default async function handler(req, res) {
  if (handlePreflight(req, res, { methods: 'GET,OPTIONS' })) return;
  if (req.method !== 'GET') return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
  if (!isMachineRequest(req)) {
    const admin = await authenticateAdmin(req, res);
    if (!admin) return;
  }
  if (!supabaseAdmin) return fail(res, 503, 'Service temporairement indisponible.', 'SERVICE_UNAVAILABLE');

  try {
    const url = requestUrl(req);
    const periode = url.searchParams.get('periode') === 'hebdo' ? 'hebdo' : 'seance';
    const dateParam = url.searchParams.get('date');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam || '') ? dateParam : new Date().toISOString().slice(0, 10);
    const envoi = url.searchParams.get('envoi') !== '0';

    const d = await collectBulletin({ periode, date });
    // Pas de séance ce jour-là (férié, week-end, import pas encore fait) : rien à publier.
    if (!d || (periode === 'seance' && !d.seances.includes(date))) {
      return json(res, 200, { success: true, skipped: true, reason: 'no_data', periode, date });
    }

    const visuels = await renderBulletin(d);
    const textes = await captionsIA(d);

    const fichiers = [
      ['story-tiktok-1080x1920.png', visuels.story, 'image/png'],
      ['post-carre-1080x1080.png', visuels.carre, 'image/png'],
      ['carrousel-linkedin.pdf', visuels.pdf, 'application/pdf'],
      ...visuels.slides.map((p, i) => [`carrousel-${i + 1}-1080x1350.png`, p, 'image/png'])
    ];
    const prefix = `reporting/${periode}/${d.to}`;
    const liens = await ranger(prefix, [
      ...fichiers,
      ['textes.json', Buffer.from(JSON.stringify(textes, null, 2)), 'application/json']
    ]);

    let telegramEnvoye = false;
    if (envoi && await identifiantsTelegram()) {
      const legende = `${visuels.meta.titreCourt} — ${visuels.meta.sousTitre}\nStory 9:16 · Carré 1:1 · Carrousel 4:5 (PNG + PDF LinkedIn)`;
      await envoyerTelegram(fichiers, legende, [
        '🎵 TEXTE TIKTOK / REELS\n\n' + textes.tiktok,
        '💼 TEXTE LINKEDIN\n\n' + textes.linkedin + (textes.source === 'gabarit' && textes.erreurIA ? `\n\n(IA indisponible : ${textes.erreurIA} — texte généré à partir des chiffres)` : '')
      ]);
      telegramEnvoye = true;
    }

    return json(res, 200, {
      success: true, periode, from: d.from, to: d.to, telegram: telegramEnvoye,
      textes: { source: textes.source, erreurIA: textes.erreurIA || null },
      fichiers: liens
    });
  } catch (error) {
    console.error('[TELEGRAM-REPORT]', error);
    return fail(res, 500, 'Génération du bulletin impossible.', 'REPORT_ERROR', error);
  }
}
