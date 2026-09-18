/**
 * Bulletin de marché automatique (séance ou semaine), envoyé en image JPEG
 * sur Telegram. Déclenché par pg_cron (Supabase), pas par un humain — le
 * secret machine est donc la seule autorisation attendue.
 *
 * Volontairement indépendant de la version « pro » que l'admin construit à
 * la main (public/admin/js/modules/reporting.js, ~1300 lignes, dessinée en
 * SVG puis rastérisée via le <canvas> du NAVIGATEUR) : ce générateur-là ne
 * peut pas tourner côté serveur tel quel. Celui-ci reprend le même principe
 * (agrégation depuis `historique`/`indices`, rendu en SVG) mais en JS pur
 * sans dépendance au DOM, rastérisé par `sharp` plutôt qu'un navigateur
 * headless — plus léger, sans Chromium à embarquer sur le plan Vercel actuel.
 */
import sharp from 'sharp';
import { supabaseAdmin } from '../lib/supabase.js';
import { isMachineRequest, handlePreflight } from '../lib/middleware.js';
import { json, fail, requestUrl } from '../lib/http.js';
import appConfig from '../lib/config.js';

export const config = { maxDuration: 30 };

const C = {
  bg: '#FFFFFF', line: '#E6DECC', ink: '#1C1813',
  gold: '#8C6D2E', muted: '#8A8172', green: '#1F9B57', red: '#CC3B3B'
};

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pct(v, digits = 2) {
  return Number.isFinite(v) ? (v >= 0 ? '+' : '') + v.toFixed(digits) + ' %' : '—';
}

function mondayOf(d) {
  const day = d.getUTCDay(); // 0 = dimanche
  const delta = (day + 6) % 7; // lundi = 0
  const m = new Date(d);
  m.setUTCDate(d.getUTCDate() - delta);
  return m;
}

function isoDate(d) { return d.toISOString().slice(0, 10); }

/**
 * Réplique la logique d'agrégation de collect() côté admin
 * (public/admin/js/modules/reporting.js), en requêtes Supabase directes
 * plutôt qu'en appels REST depuis le navigateur — même principe, sans DOM.
 */
async function collectWindow(from, to, periode) {
  const [{ data: quotes, error: e1 }, { data: indices, error: e2 }, { data: refs, error: e3 }] = await Promise.all([
    supabaseAdmin.from('historique')
      .select('ticker,date_seance,cours_cloture,cloture,volume,variation,valeur_totale')
      .gte('date_seance', from).lte('date_seance', to).order('date_seance', { ascending: true }),
    supabaseAdmin.from('indices')
      .select('indice,date_seance,valeur,variation_pct')
      .gte('date_seance', from).lte('date_seance', to).order('date_seance', { ascending: true }),
    supabaseAdmin.from('entreprises').select('ticker,nom')
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;

  const names = {};
  (refs || []).forEach(r => { names[String(r.ticker).toUpperCase()] = r.nom || ''; });

  const close = r => {
    const v = r.cours_cloture !== null && r.cours_cloture !== undefined ? r.cours_cloture : r.cloture;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const rows = (quotes || []).filter(r => close(r) !== null);
  if (!rows.length) return null;

  const byTicker = {};
  rows.forEach(r => {
    const key = String(r.ticker).toUpperCase();
    const e = byTicker[key] || (byTicker[key] = {
      ticker: r.ticker, nom: names[key] || '', first: null, last: null,
      volume: 0, valeur: 0, published: null
    });
    const c = close(r);
    if (e.first === null) e.first = c;
    e.last = c;
    e.volume += Number(r.volume) || 0;
    e.valeur += Number(r.valeur_totale) || 0;
    if (periode === 'seance') e.published = Number(r.variation);
  });

  const values = Object.values(byTicker).map(e => {
    if (periode === 'seance') {
      e.perf = Number.isFinite(e.published) ? e.published : null;
    } else if (e.first && e.first > 0 && e.last !== null) {
      e.perf = ((e.last - e.first) / e.first) * 100;
    } else {
      e.perf = null;
    }
    return e;
  }).filter(e => e.perf !== null);

  const hausses = values.slice().sort((a, b) => b.perf - a.perf).slice(0, 5);
  const baisses = values.slice().sort((a, b) => a.perf - b.perf).slice(0, 5);
  const volumes = values.slice().sort((a, b) => b.valeur - a.valeur).slice(0, 5);

  const idxMap = {};
  (indices || []).forEach(r => {
    const key = String(r.indice || '').toUpperCase();
    const e = idxMap[key] || (idxMap[key] = { indice: r.indice, first: null, last: null, lastPct: null });
    const v = Number(r.valeur);
    if (!Number.isFinite(v)) return;
    if (e.first === null) e.first = v;
    e.last = v;
    e.lastPct = Number(r.variation_pct);
  });
  const idxList = Object.values(idxMap).map(e => {
    e.perf = periode === 'seance'
      ? (Number.isFinite(e.lastPct) ? e.lastPct : null)
      : (e.first && e.first > 0 ? ((e.last - e.first) / e.first) * 100 : null);
    return e;
  });

  const up = values.filter(e => e.perf > 0).length;
  const down = values.filter(e => e.perf < 0).length;
  const flat = values.length - up - down;

  return { values, hausses, baisses, volumes, indices: idxList, up, down, flat, count: values.length };
}

/** Rendu SVG pur (aucune dépendance DOM) — même esprit visuel que l'outil admin, en plus sobre. */
function buildSvg(data, meta) {
  const W = 1080, H = 1350, pad = 66;
  const parts = [];
  let y = 0;

  const line = (t, x, ty, o = {}) => {
    parts.push(
      '<text x="' + x + '" y="' + ty + '" fill="' + (o.fill || C.ink) + '" ' +
      'font-family="DejaVu Sans, Arial, sans-serif" font-size="' + (o.size || 18) + '" ' +
      'font-weight="' + (o.weight || 400) + '"' + (o.anchor ? ' text-anchor="' + o.anchor + '"' : '') + '>' +
      esc(t) + '</text>'
    );
  };

  parts.push('<rect width="' + W + '" height="' + H + '" fill="' + C.bg + '"/>');
  parts.push('<rect x="0" y="0" width="' + W + '" height="10" fill="' + C.gold + '"/>');

  y = 96;
  line('THE CAPITAL', pad, y, { size: 22, weight: 700, fill: C.gold });
  y += 46;
  line(meta.titre, pad, y, { size: 36, weight: 700 });
  y += 32;
  line(meta.sousTitre, pad, y, { size: 16, fill: C.muted });
  y += 44;
  parts.push('<line x1="' + pad + '" y1="' + y + '" x2="' + (W - pad) + '" y2="' + y + '" stroke="' + C.line + '"/>');
  y += 50;

  line('INDICES', pad, y, { size: 14, weight: 700, fill: C.gold });
  y += 36;
  if (!data.indices.length) { line('Aucune donnée d\'indice sur la période.', pad, y, { size: 15, fill: C.muted }); y += 30; }
  data.indices.forEach(idx => {
    line(idx.indice, pad, y, { size: 18 });
    line(pct(idx.perf), W - pad, y, { size: 18, anchor: 'end', weight: 700, fill: idx.perf >= 0 ? C.green : C.red });
    y += 34;
  });
  y += 16;

  line(data.up + ' hausse(s)  ·  ' + data.down + ' baisse(s)  ·  ' + data.flat + ' stable(s)  sur ' + data.count + ' valeur(s)',
    pad, y, { size: 15, fill: C.muted });
  y += 54;

  const section = (title, color, list, fmtRight) => {
    line(title, pad, y, { size: 14, weight: 700, fill: color });
    y += 36;
    if (!list.length) { line('—', pad, y, { size: 15, fill: C.muted }); y += 30; }
    list.forEach(e => {
      const label = e.ticker + (e.nom ? '  ' + e.nom : '');
      line(label.length > 44 ? label.slice(0, 44) + '…' : label, pad, y, { size: 16 });
      line(fmtRight(e), W - pad, y, { size: 16, anchor: 'end', weight: 700, fill: color });
      y += 32;
    });
    y += 22;
  };

  section('PLUS FORTES HAUSSES', C.green, data.hausses, e => pct(e.perf));
  section('PLUS FORTES BAISSES', C.red, data.baisses, e => pct(e.perf));
  section('PLUS FORTE ACTIVITÉ', C.gold, data.volumes, e => Math.round(e.valeur).toLocaleString('fr-FR') + ' FCFA');

  parts.push(
    '<text x="' + pad + '" y="' + (H - 40) + '" font-size="12" fill="' + C.muted + '" font-family="DejaVu Sans, Arial, sans-serif">' +
    '© The Capital — thecapitalinvest.com</text>'
  );

  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' +
    parts.join('') + '</svg>';
}

async function sendTelegramPhoto(jpegBuffer, caption) {
  const form = new FormData();
  form.append('chat_id', appConfig.telegramChatId);
  form.append('caption', caption);
  form.append('photo', new Blob([jpegBuffer], { type: 'image/jpeg' }), 'bulletin.jpg');
  const res = await fetch('https://api.telegram.org/bot' + appConfig.telegramBotToken + '/sendPhoto', {
    method: 'POST', body: form
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error('Telegram sendPhoto: ' + JSON.stringify(body));
  return body;
}

export default async function handler(req, res) {
  if (handlePreflight(req, res, { methods: 'GET,OPTIONS' })) return;
  if (!isMachineRequest(req)) return fail(res, 403, 'Accès réservé.', 'FORBIDDEN');
  if (!appConfig.telegramBotToken || !appConfig.telegramChatId) {
    return json(res, 200, { success: true, skipped: true, reason: 'telegram_not_configured' });
  }

  try {
    const url = requestUrl(req);
    const periode = url.searchParams.get('periode') === 'hebdo' ? 'hebdo' : 'seance';

    const today = new Date();
    let from, to, titre, sousTitre;
    if (periode === 'hebdo') {
      from = isoDate(mondayOf(today));
      to = isoDate(today);
      titre = 'La semaine en bref';
      sousTitre = 'Du ' + from + ' au ' + to;
    } else {
      from = to = isoDate(today);
      titre = 'La séance en bref';
      sousTitre = to;
    }

    const data = await collectWindow(from, to, periode);
    if (!data) return json(res, 200, { success: true, skipped: true, reason: 'no_data', from, to });

    const svg = buildSvg(data, { titre, sousTitre });
    const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();

    await sendTelegramPhoto(jpeg, titre + ' — ' + sousTitre);

    return json(res, 200, { success: true, periode, from, to });
  } catch (error) {
    console.error('[TELEGRAM-REPORT]', error);
    return fail(res, 500, 'Génération du bulletin impossible.', 'REPORT_ERROR', error);
  }
}
