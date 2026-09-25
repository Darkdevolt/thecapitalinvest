/**
 * Visuels du bulletin de marché, prêts à publier :
 *  - story    1080×1920 (9:16)  TikTok, Reels, Stories, statut WhatsApp ;
 *  - carre    1080×1080 (1:1)   post LinkedIn / X / Facebook ;
 *  - carrousel 6 × 1080×1350 (4:5) Instagram, et en PDF pour le « document » LinkedIn.
 * Mise en page par satori (flexbox -> SVG, polices embarquées : rendu
 * identique en local et sur Vercel), rastérisation par resvg, PDF par pdf-lib.
 * Charte : noir chaud, or, crème — celle de la bannière « La séance du jour en 1 minute ».
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

const asset = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)));
let FONTS = null;
function fonts() {
  if (FONTS) return FONTS;
  FONTS = [
    { name: 'Inter', data: asset('./fonts/Inter-Regular.ttf'), weight: 400, style: 'normal' },
    { name: 'Inter', data: asset('./fonts/Inter-Medium.ttf'), weight: 500, style: 'normal' },
    { name: 'Inter', data: asset('./fonts/Inter-SemiBold.ttf'), weight: 600, style: 'normal' },
    { name: 'Inter', data: asset('./fonts/Inter-Bold.ttf'), weight: 700, style: 'normal' },
    { name: 'Display', data: asset('./fonts/InterDisplay-ExtraBold.ttf'), weight: 800, style: 'normal' },
    { name: 'Display', data: asset('./fonts/InterDisplay-Black.ttf'), weight: 900, style: 'normal' }
  ];
  return FONTS;
}
/* Emblème The Capital, rogné en carré (lib/assets/the-capital-emblem.png, 342 px, sans marge) et
   pré-réduit à la taille EXACTE de chaque emplacement (Lanczos + léger renforcement de netteté) :
   le visuel étant rendu à l'échelle 1:1, l'image n'est plus jamais rééchantillonnée ni déformée. */
const TAILLES_LOGO = [112, 92, 72];
const LOGOS = {};
async function preparerLogos() {
  if (TAILLES_LOGO.every(t => LOGOS[t])) return;
  const src = asset('./assets/the-capital-emblem.png');
  await Promise.all(TAILLES_LOGO.map(async t => {
    const buf = await sharp(src).resize(t, t, { kernel: 'lanczos3', fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .sharpen({ sigma: 0.6 }).png({ compressionLevel: 9 }).toBuffer();
    LOGOS[t] = 'data:image/png;base64,' + buf.toString('base64');
  }));
}
function logo(t) { return LOGOS[t]; }

const C = {
  bg0: '#0E0A06', bg1: '#1A130B', card: 'rgba(255,240,210,0.045)', cardLine: 'rgba(212,162,76,0.22)',
  gold: '#D4A24C', goldHi: '#F0CD85', cream: '#F7EFE2', muted: '#B3A58C', dim: '#7E725E',
  up: '#34D399', upBg: 'rgba(52,211,153,0.13)', down: '#F87171', downBg: 'rgba(248,113,113,0.13)', flat: '#9C9282'
};
export const HANDLE = 'thecapitalinvest.com';

/* ── Formatage fr-FR ─────────────────────────────────────────────── */
const nf = (v, d = 2) => Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/ /g, ' ');
export const pct = (v, d = 2) => (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v), d) + ' %';
export const fcfa = (v) => v >= 1e9 ? nf(v / 1e9, 2) + ' Md FCFA' : v >= 1e6 ? nf(v / 1e6, 1) + ' M FCFA' : nf(v, 0) + ' FCFA';
const cours = (v) => nf(v, v >= 1000 ? 0 : 2);
const tone = (v) => v > 0 ? C.up : v < 0 ? C.down : C.flat;
const toneBg = (v) => v > 0 ? C.upBg : v < 0 ? C.downBg : 'rgba(156,146,130,0.12)';
const arrow = (v) => v > 0 ? '▲' : v < 0 ? '▼' : '■';
export function dateLongue(s) {
  const d = new Date(s + 'T12:00:00Z');
  const t = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
/* « du 21 au 25 septembre 2026 », « du 29 septembre au 3 octobre 2026 » */
export function periodeTexte(from, to) {
  const f = new Date(from + 'T12:00:00Z'), t = new Date(to + 'T12:00:00Z');
  const o = (d, opt) => d.toLocaleDateString('fr-FR', Object.assign({ timeZone: 'UTC' }, opt));
  if (from === to) return 'le ' + o(t, { day: 'numeric', month: 'long', year: 'numeric' });
  const debut = f.getUTCMonth() === t.getUTCMonth() ? o(f, { day: 'numeric' }) : f.getUTCFullYear() === t.getUTCFullYear() ? o(f, { day: 'numeric', month: 'long' }) : o(f, { day: 'numeric', month: 'long', year: 'numeric' });
  return `du ${debut} au ${o(t, { day: 'numeric', month: 'long', year: 'numeric' })}`;
}
const court = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

/* ── Mini « JSX » pour satori ─────────────────────────────────────── */
function h(type, style, ...children) {
  const kids = children.flat().filter(c => c !== null && c !== undefined && c !== false);
  const props = { style: Object.assign({ display: 'flex' }, style || {}) };
  if (kids.length === 1) props.children = kids[0];
  else if (kids.length) props.children = kids;
  return { type, props };
}
const img = (src, w, hgt, style) => ({ type: 'img', props: { src, width: w, height: hgt, style: Object.assign({ width: w, height: hgt }, style || {}) } });
const txt = (s, style) => h('div', style, String(s));

function fond(W, H, ...children) {
  return h('div', {
    width: W, height: H, flexDirection: 'column', fontFamily: 'Inter', color: C.cream, position: 'relative',
    backgroundColor: C.bg0,
    backgroundImage: `radial-gradient(circle at 85% 0%, rgba(212,162,76,0.22), rgba(212,162,76,0) 55%), linear-gradient(160deg, ${C.bg1} 0%, ${C.bg0} 60%, #140E07 100%)`
  }, ...children);
}
const filet = (w = 96) => h('div', { width: w, height: 5, borderRadius: 3, backgroundImage: `linear-gradient(90deg, ${C.gold}, ${C.goldHi})` });
const pill = (label, color, bg, size = 30) => h('div', {
  padding: `${Math.round(size * 0.28)}px ${Math.round(size * 0.6)}px`, borderRadius: 999, backgroundColor: bg,
  color, fontSize: size, fontWeight: 700, alignItems: 'center'
}, label);
const carte = (style, ...children) => h('div', Object.assign({
  flexDirection: 'column', backgroundColor: C.card, border: `1.5px solid ${C.cardLine}`, borderRadius: 28
}, style), ...children);

function entete(meta, size = 1) {
  const t = size === 1 ? 112 : 92;
  return h('div', { alignItems: 'center', gap: 24 * size },
    img(logo(t), t, t),
    h('div', { flexDirection: 'column', gap: 4 },
      txt('THE CAPITAL', { fontSize: 26 * size, fontWeight: 700, letterSpacing: 6 * size, color: C.goldHi }),
      txt(meta.accroche, { fontSize: 21 * size, color: C.muted, letterSpacing: 3 * size })
    )
  );
}
function pied(W, pad, extra) {
  return h('div', { position: 'absolute', left: pad, right: pad, bottom: 44, justifyContent: 'space-between', alignItems: 'center' },
    txt(HANDLE, { fontSize: 24, fontWeight: 600, color: C.gold, letterSpacing: 1 }),
    txt(extra || 'Données BRVM · Pas un conseil en investissement', { fontSize: 19, color: C.dim })
  );
}

/* Courbe du Composite : SVG autonome passé en image (data URI). */
function courbe(points, width, height, o = {}) {
  if (!points || points.length < 2) return null;
  const vals = points.map(p => p.valeur);
  const min = Math.min(...vals), max = Math.max(...vals), span = (max - min) || 1;
  const padY = 10;
  const X = i => (i * (width - 8)) / (points.length - 1) + 4;
  const Y = v => padY + (height - padY * 2) * (1 - (v - min) / span);
  const line = points.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.valeur).toFixed(1)).join(' ');
  const up = vals[vals.length - 1] >= vals[0];
  const col = up ? C.up : C.down;
  const area = line + ` L${X(points.length - 1).toFixed(1)} ${height} L${X(0).toFixed(1)} ${height} Z`;
  const last = points.length - 1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity="0.35"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>` +
    `<path d="${area}" fill="url(#g)"/><path d="${line}" fill="none" stroke="${col}" stroke-width="${o.stroke || 5}" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<circle cx="${X(last)}" cy="${Y(vals[last])}" r="${(o.stroke || 5) + 4}" fill="${col}"/></svg>`;
  return img('data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'), width, height);
}
function blocCourbe(d, width, height) {
  const pts = d.courbe || [];
  if (pts.length < 5) return null;
  const v0 = pts[0].valeur, v1 = pts[pts.length - 1].valeur;
  return h('div', { flexDirection: 'column', gap: 14 },
    h('div', { justifyContent: 'space-between', alignItems: 'baseline' },
      txt(`BRVM COMPOSITE · ${pts.length} DERNIÈRES SÉANCES`, { fontSize: 22, letterSpacing: 3, color: C.muted, fontWeight: 600 }),
      txt(pct((v1 / v0 - 1) * 100), { fontSize: 26, fontWeight: 700, color: tone(v1 - v0) })),
    courbe(pts, width, height)
  );
}

/* Barre de répartition hausses / stables / baisses */
function repartition(d, width, height = 22) {
  const tot = Math.max(1, d.nbTitres);
  const seg = (n, c) => n > 0 ? h('div', { width: Math.max(6, Math.round(width * n / tot)), height, backgroundColor: c }) : null;
  return h('div', { flexDirection: 'column', gap: 16, width },
    h('div', { width, height, borderRadius: height, overflow: 'hidden' }, seg(d.nbHausses, C.up), seg(d.nbStables, '#5B5244'), seg(d.nbBaisses, C.down)),
    h('div', { justifyContent: 'space-between', fontSize: 27, fontWeight: 600 },
      txt(`${d.nbHausses} en hausse`, { color: C.up }),
      txt(`${d.nbStables} stables`, { color: C.flat }),
      txt(`${d.nbBaisses} en baisse`, { color: C.down })
    )
  );
}

/* Ligne de palmarès avec barre proportionnelle */
function ligneTitre(t, max, width, o = {}) {
  const nomW = o.nomW || 300, pctW = o.pctW || 180;
  const barW = Math.max(8, Math.round((width - nomW - pctW - 40) * Math.min(1, Math.abs(t.perf) / (max || 1))));
  return h('div', { alignItems: 'center', justifyContent: 'space-between', width, height: o.h || 78 },
    h('div', { flexDirection: 'column', width: nomW },
      txt(t.ticker, { fontSize: o.fs || 32, fontWeight: 700, color: C.cream, letterSpacing: 1 }),
      txt(court(t.nom, 22), { fontSize: (o.fs || 32) * 0.62, color: C.muted })
    ),
    h('div', { width: width - nomW - pctW, alignItems: 'center', paddingLeft: 12, paddingRight: 28 },
      h('div', { width: barW, height: 14, borderRadius: 7, backgroundColor: tone(t.perf), opacity: 0.85 })
    ),
    txt(pct(t.perf), { fontSize: o.fs || 32, fontWeight: 700, color: tone(t.perf), width: pctW, justifyContent: 'flex-end' })
  );
}

/* ── STORY 1080×1920 ──────────────────────────────────────────────── */
function story(d, meta) {
  const W = 1080, H = 1920, pad = 96, inner = W - pad * 2;
  const comp = d.indices[0];
  const autres = d.indices.slice(1);
  const top = (list) => list.slice(0, 3);
  const maxAbs = Math.max(...d.hausses.slice(0, 3).map(t => Math.abs(t.perf)), ...d.baisses.slice(0, 3).map(t => Math.abs(t.perf)), 1);
  const actif = d.actifs[0];
  return fond(W, H,
    h('div', { flexDirection: 'column', padding: `84px ${pad}px 0`, gap: 0 },
      entete(meta),
      h('div', { flexDirection: 'column', marginTop: 48, gap: 12 },
        txt(meta.titre, { fontFamily: 'Display', fontWeight: 900, fontSize: 76, lineHeight: 1.02, color: C.cream, letterSpacing: -1, whiteSpace: 'pre-wrap' }),
        filet(120),
        txt(meta.sousTitre, { fontSize: 32, color: C.goldHi, fontWeight: 500, marginTop: 6 })
      ),
      comp ? carte({ marginTop: 40, padding: '34px 40px', gap: 6 },
        h('div', { justifyContent: 'space-between', alignItems: 'center' },
          txt('BRVM COMPOSITE', { fontSize: 26, letterSpacing: 4, color: C.muted, fontWeight: 600 }),
          pill(arrow(comp.perf) + '  ' + pct(comp.perf), tone(comp.perf), toneBg(comp.perf), 30)
        ),
        txt(nf(comp.valeur, 2), { fontFamily: 'Display', fontWeight: 800, fontSize: 116, letterSpacing: -2, color: C.cream, lineHeight: 1 }),
        h('div', { gap: 22, marginTop: 14 },
          autres.map(i => h('div', { flexGrow: 1, flexDirection: 'column', gap: 4, padding: '18px 22px', borderRadius: 18, backgroundColor: 'rgba(255,240,210,0.04)' },
            txt(i.nom.replace('BRVM-', 'BRVM '), { fontSize: 22, letterSpacing: 2, color: C.muted, fontWeight: 600 }),
            h('div', { alignItems: 'baseline', justifyContent: 'space-between' },
              txt(nf(i.valeur, 2), { fontSize: 36, fontWeight: 700 }),
              txt(pct(i.perf), { fontSize: 28, fontWeight: 700, color: tone(i.perf) }))
          ))
        )
      ) : null,
      h('div', { marginTop: 34 }, repartition(d, inner)),
      carte({ marginTop: 34, padding: '26px 40px 14px', gap: 0 },
        txt('TOP HAUSSES', { fontSize: 24, letterSpacing: 4, fontWeight: 700, color: C.up, marginBottom: 6 }),
        top(d.hausses).length ? top(d.hausses).map(t => ligneTitre(t, maxAbs, inner - 80, { fs: 30, h: 70 })) : txt('Aucune hausse', { fontSize: 26, color: C.muted, height: 64 }),
        txt('TOP BAISSES', { fontSize: 24, letterSpacing: 4, fontWeight: 700, color: C.down, marginTop: 14, marginBottom: 6 }),
        top(d.baisses).length ? top(d.baisses).map(t => ligneTitre(t, maxAbs, inner - 80, { fs: 30, h: 70 })) : txt('Aucune baisse', { fontSize: 26, color: C.muted, height: 64 })
      ),
      h('div', { marginTop: 30, justifyContent: 'space-between', alignItems: 'center' },
        h('div', { flexDirection: 'column', gap: 4 },
          txt('VALEUR ÉCHANGÉE', { fontSize: 22, letterSpacing: 3, color: C.muted, fontWeight: 600 }),
          txt(fcfa(d.valeurTotale), { fontSize: 36, fontWeight: 700 })),
        actif ? h('div', { flexDirection: 'column', gap: 4, alignItems: 'flex-end' },
          txt('LE PLUS ÉCHANGÉ', { fontSize: 22, letterSpacing: 3, color: C.muted, fontWeight: 600 }),
          txt(`${actif.ticker} · ${fcfa(actif.valeur)}`, { fontSize: 30, fontWeight: 700, color: C.goldHi })) : null
      )
    ),
    pied(W, pad)
  );
}

/* ── CARRÉ 1080×1080 ──────────────────────────────────────────────── */
function carre(d, meta) {
  const W = 1080, pad = 80, inner = W - pad * 2;
  const comp = d.indices[0];
  const hb = d.hausses[0], bb = d.baisses[0];
  return fond(W, W,
    h('div', { flexDirection: 'column', padding: `70px ${pad}px 0` },
      entete(meta, 0.85),
      txt(meta.titreCourt, { marginTop: 44, fontFamily: 'Display', fontWeight: 900, fontSize: 64, color: C.cream, letterSpacing: -1 }),
      txt(meta.sousTitre, { fontSize: 28, color: C.goldHi, marginTop: 8 }),
      comp ? h('div', { marginTop: 40, alignItems: 'flex-end', gap: 28 },
        txt(nf(comp.valeur, 2), { fontFamily: 'Display', fontWeight: 800, fontSize: 116, lineHeight: 1, letterSpacing: -2 }),
        h('div', { flexDirection: 'column', gap: 10, paddingBottom: 8 },
          txt('BRVM COMPOSITE', { fontSize: 22, letterSpacing: 3, color: C.muted, fontWeight: 600 }),
          pill(arrow(comp.perf) + '  ' + pct(comp.perf), tone(comp.perf), toneBg(comp.perf), 30))
      ) : null,
      h('div', { marginTop: 34, gap: 20 },
        d.indices.slice(1).map(i => h('div', { flexGrow: 1, justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderRadius: 18, backgroundColor: C.card, border: `1.5px solid ${C.cardLine}` },
          txt(i.nom.replace('BRVM-', 'BRVM '), { fontSize: 24, color: C.muted, fontWeight: 600 }),
          txt(pct(i.perf), { fontSize: 30, fontWeight: 700, color: tone(i.perf) })))
      ),
      h('div', { marginTop: 34 }, repartition(d, inner, 18)),
      h('div', { marginTop: 34, gap: 20 },
        [hb, bb].filter(Boolean).map(t => h('div', { flexGrow: 1, flexDirection: 'column', gap: 6, padding: '20px 24px', borderRadius: 18, backgroundColor: toneBg(t.perf) },
          txt(t.perf > 0 ? 'MEILLEURE HAUSSE' : 'PLUS FORTE BAISSE', { fontSize: 20, letterSpacing: 3, fontWeight: 700, color: tone(t.perf) }),
          h('div', { justifyContent: 'space-between', alignItems: 'baseline' },
            txt(t.ticker, { fontSize: 34, fontWeight: 700 }),
            txt(pct(t.perf), { fontSize: 34, fontWeight: 700, color: tone(t.perf) }))))
      )
    ),
    pied(W, pad, fcfa(d.valeurTotale) + ' échangés · ' + d.nbTitres + ' titres')
  );
}

/* ── CARROUSEL 1080×1350 ──────────────────────────────────────────── */
function slideCadre(meta, n, total, ...body) {
  const W = 1080, H = 1350, pad = 88;
  return fond(W, H,
    h('div', { position: 'absolute', top: 64, left: pad, right: pad, justifyContent: 'space-between', alignItems: 'center' },
      h('div', { alignItems: 'center', gap: 18 }, img(logo(72), 72, 72), txt('THE CAPITAL', { fontSize: 23, fontWeight: 700, letterSpacing: 5, color: C.goldHi })),
      txt(`${n} / ${total}`, { fontSize: 22, color: C.muted, fontWeight: 600 })
    ),
    h('div', { flexDirection: 'column', padding: `190px ${pad}px 0`, width: W }, ...body),
    pied(W, pad, n < total ? 'Faites défiler  →' : undefined)
  );
}
const titreSlide = (sur, titre) => h('div', { flexDirection: 'column', gap: 16, marginBottom: 44 },
  txt(sur, { fontSize: 24, letterSpacing: 5, color: C.gold, fontWeight: 700 }),
  txt(titre, { fontFamily: 'Display', fontWeight: 900, fontSize: 64, lineHeight: 1.05, letterSpacing: -1 }),
  filet(110));

function carrousel(d, meta) {
  const T = 6, inner = 1080 - 88 * 2;
  const comp = d.indices[0];
  const liste = (list, color) => {
    const max = Math.max(...list.map(t => Math.abs(t.perf)), 1);
    return carte({ padding: '24px 36px' }, list.map(t => ligneTitre(t, max, inner - 72, { fs: 38, h: 150, nomW: 330, pctW: 200 })));
  };
  const s1 = slideCadre(meta, 1, T,
    txt(meta.sousTitre.toUpperCase(), { fontSize: 26, letterSpacing: 4, color: C.gold, fontWeight: 700, marginTop: 40 }),
    txt(meta.accrocheCover, { fontFamily: 'Display', fontWeight: 900, fontSize: 92, lineHeight: 1.02, letterSpacing: -2, marginTop: 28 }),
    filet(140),
    comp ? h('div', { marginTop: 60, alignItems: 'flex-end', gap: 30 },
      txt(nf(comp.valeur, 2), { fontFamily: 'Display', fontWeight: 800, fontSize: 132, lineHeight: 1, letterSpacing: -3 }),
      h('div', { paddingBottom: 12 }, pill(arrow(comp.perf) + '  ' + pct(comp.perf), tone(comp.perf), toneBg(comp.perf), 36))) : null,
    txt('BRVM Composite · ' + meta.titreCourt.toLowerCase(), { fontSize: 28, color: C.muted, marginTop: 18 }),
    h('div', { marginTop: 70, gap: 20 },
      [[String(d.nbHausses), 'titres en hausse', C.up], [String(d.nbBaisses), 'titres en baisse', C.down], [fcfa(d.valeurTotale).replace(' FCFA', ''), 'FCFA échangés', C.goldHi]]
        .map(([v, l, c]) => carte({ flexGrow: 1, flexBasis: 0, padding: '28px 28px', gap: 6 },
          txt(v, { fontFamily: 'Display', fontWeight: 800, fontSize: 56, color: c, letterSpacing: -1 }),
          txt(l, { fontSize: 24, color: C.muted })))
    ),
    d.hausses[0] ? h('div', { marginTop: 26, alignItems: 'center', gap: 16, fontSize: 28, color: C.cream },
      txt('À la une :', { color: C.gold, fontWeight: 700 }),
      txt(`${d.hausses[0].ticker} ${pct(d.hausses[0].perf)}`, { fontWeight: 700, color: C.up }),
      d.baisses[0] ? txt('·', { color: C.dim }) : null,
      d.baisses[0] ? txt(`${d.baisses[0].ticker} ${pct(d.baisses[0].perf)}`, { fontWeight: 700, color: C.down }) : null) : null
  );
  const s2 = slideCadre(meta, 2, T, titreSlide('LES INDICES', 'Où en est le marché ?'),
    carte({ padding: '12px 40px' },
      d.indices.map((i, k) => h('div', { justifyContent: 'space-between', alignItems: 'center', height: 130, borderTop: k ? `1px solid ${C.cardLine}` : 'none' },
        h('div', { flexDirection: 'column', gap: 6 },
          txt(i.nom.replace('BRVM-', 'BRVM '), { fontSize: 30, fontWeight: 700 }),
          txt(nf(i.valeur, 2) + ' points', { fontSize: 26, color: C.muted })),
        pill(arrow(i.perf) + '  ' + pct(i.perf), tone(i.perf), toneBg(i.perf), 32)))
    ),
    h('div', { marginTop: 56, flexDirection: 'column', gap: 18 },
      txt('RÉPARTITION DES ' + d.nbTitres + ' TITRES', { fontSize: 24, letterSpacing: 4, color: C.muted, fontWeight: 600 }),
      repartition(d, inner, 26)),
    h('div', { marginTop: 44 }, blocCourbe(d, inner, 160))
  );
  const s3 = slideCadre(meta, 3, T, titreSlide('PALMARÈS', 'Les plus fortes hausses'),
    d.hausses.length ? liste(d.hausses.slice(0, 5), C.up) : txt('Aucune hausse sur la période.', { fontSize: 32, color: C.muted }));
  const s4 = slideCadre(meta, 4, T, titreSlide('PALMARÈS', 'Les plus fortes baisses'),
    d.baisses.length ? liste(d.baisses.slice(0, 5), C.down) : txt('Aucune baisse sur la période.', { fontSize: 32, color: C.muted }));
  const maxV = Math.max(...d.actifs.slice(0, 5).map(t => t.valeur), 1);
  const s5 = slideCadre(meta, 5, T, titreSlide('ACTIVITÉ', 'Où l’argent a circulé'),
    h('div', { alignItems: 'baseline', gap: 18, marginBottom: 34 },
      txt(fcfa(d.valeurTotale), { fontFamily: 'Display', fontWeight: 800, fontSize: 78, letterSpacing: -1 }),
      txt('échangés', { fontSize: 30, color: C.muted })),
    carte({ padding: '20px 36px' },
      d.actifs.slice(0, 5).map(t => h('div', { alignItems: 'center', justifyContent: 'space-between', height: 128 },
        h('div', { flexDirection: 'column', width: 280 },
          txt(t.ticker, { fontSize: 36, fontWeight: 700 }),
          txt(court(t.nom, 22), { fontSize: 22, color: C.muted })),
        h('div', { flexGrow: 1, paddingLeft: 10, paddingRight: 18 },
          h('div', { width: Math.max(8, Math.round((inner - 72 - 520) * t.valeur / maxV)), height: 14, borderRadius: 7, backgroundImage: `linear-gradient(90deg, ${C.gold}, ${C.goldHi})` })),
        txt(fcfa(t.valeur), { fontSize: 28, fontWeight: 700, color: C.goldHi, width: 230, justifyContent: 'flex-end' })))
    )
  );
  const secteurs = d.secteurs.slice(0, 6);
  const s6 = slideCadre(meta, 6, T, titreSlide('À RETENIR', 'Les secteurs & la suite'),
    secteurs.length ? carte({ padding: '14px 36px' },
      secteurs.map(s => h('div', { justifyContent: 'space-between', alignItems: 'center', height: 84 },
        txt(court(s.nom, 30), { fontSize: 28, fontWeight: 600 }),
        txt(pct(s.perf), { fontSize: 28, fontWeight: 700, color: tone(s.perf) })))) : null,
    h('div', { marginTop: 50, flexDirection: 'column', gap: 16, padding: '34px 40px', borderRadius: 28, backgroundImage: `linear-gradient(120deg, rgba(212,162,76,0.28), rgba(212,162,76,0.08))`, border: `1.5px solid ${C.gold}` },
      txt('Suivez la BRVM chaque jour', { fontSize: 38, fontWeight: 700 }),
      txt('Cours, analyses, états financiers et alertes sur ' + HANDLE, { fontSize: 26, color: C.cream, lineHeight: 1.35 }))
  );
  return [s1, s2, s3, s4, s5, s6];
}

/* ── Rendu ───────────────────────────────────────────────────────── */
async function png(el, width, height) {
  const svg = await satori(el, { width, height, fonts: fonts() });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: false } }).render().asPng());
}

export function metaBulletin(d) {
  const comp = d.indices[0];
  const hebdo = d.periode === 'hebdo';
  const sens = !comp ? 'termine' : comp.perf > 0.05 ? 'progresse' : comp.perf < -0.05 ? 'recule' : 'reste stable';
  const lui = hebdo ? 'cette semaine' : 'aujourd’hui';
  return {
    hebdo,
    accroche: hebdo ? 'LA SEMAINE EN 1 MINUTE' : 'LA SÉANCE DU JOUR EN 1 MINUTE',
    titre: hebdo ? 'La semaine\nà la BRVM' : 'La séance\ndu jour',
    titreCourt: hebdo ? 'La semaine à la BRVM' : 'La séance du jour',
    sousTitre: hebdo ? (p => p.charAt(0).toUpperCase() + p.slice(1))(periodeTexte(d.from, d.to)) : dateLongue(d.to),
    accrocheCover: comp ? `La BRVM ${sens} ${lui}` : (hebdo ? 'La semaine à la BRVM' : 'La séance du jour')
  };
}

export async function renderBulletin(d) {
  await preparerLogos();
  const meta = metaBulletin(d);
  const slides = carrousel(d, meta);
  const [storyPng, carrePng, ...slidePngs] = await Promise.all([
    png(story(d, meta), 1080, 1920),
    png(carre(d, meta), 1080, 1080),
    ...slides.map(s => png(s, 1080, 1350))
  ]);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${meta.titreCourt} — ${meta.sousTitre} | The Capital`);
  pdf.setAuthor('The Capital');
  for (const p of slidePngs) {
    const im = await pdf.embedPng(p);
    const page = pdf.addPage([1080, 1350]);
    page.drawImage(im, { x: 0, y: 0, width: 1080, height: 1350 });
  }
  return { meta, story: storyPng, carre: carrePng, slides: slidePngs, pdf: Buffer.from(await pdf.save()) };
}
