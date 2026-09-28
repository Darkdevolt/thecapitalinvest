/**
 * Visuels du bulletin de marché, prêts à publier :
 *  - story    1080×1920 (9:16)  TikTok, Reels, Stories, statut WhatsApp ;
 *  - carre    1080×1080 (1:1)   post LinkedIn / X / Facebook ;
 *  - carrousel 6 × 1080×1350 (4:5) Instagram, et en PDF pour le « document » LinkedIn.
 * Mise en page par satori (flexbox -> SVG, polices embarquées : rendu
 * identique en local et sur Vercel), rastérisation par resvg, PDF par pdf-lib.
 *
 * Charte « cote du jour » : une page de quotidien financier plutôt qu'un
 * tableau de bord — papier chaud, encre, filets, titre de une en serif
 * (Newsreader), chiffres en colonnes (IBM Plex Mono), libellés en Plex Sans
 * Condensed. Pas de cartes arrondies, de pastilles ni de dégradés ; la couleur
 * ne sert qu'au sens (hausse / baisse) et à la marque (ocre).
 * Les chiffres viennent tels quels de lib/report-data.js : seul le rendu change.
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
  const f = (name, file, weight, style = 'normal') => ({ name, data: asset('./fonts/' + file), weight, style });
  FONTS = [
    f('Serif', 'newsreader-400-normal.woff', 400), f('Serif', 'newsreader-400-italic.woff', 400, 'italic'),
    f('Serif', 'newsreader-500-normal.woff', 500), f('Serif', 'newsreader-600-normal.woff', 600),
    f('Serif', 'newsreader-700-normal.woff', 700),
    f('Mono', 'ibm-plex-mono-400-normal.woff', 400), f('Mono', 'ibm-plex-mono-500-normal.woff', 500),
    f('Mono', 'ibm-plex-mono-600-normal.woff', 600),
    f('Sans', 'ibm-plex-sans-condensed-400-normal.woff', 400), f('Sans', 'ibm-plex-sans-condensed-500-normal.woff', 500),
    f('Sans', 'ibm-plex-sans-condensed-600-normal.woff', 600), f('Sans', 'ibm-plex-sans-condensed-700-normal.woff', 700)
  ];
  return FONTS;
}
/* Emblème The Capital, rogné en carré (lib/assets/the-capital-emblem.png, 342 px, sans marge) et
   pré-réduit à la taille EXACTE de chaque emplacement (Lanczos + léger renforcement de netteté) :
   le visuel étant rendu à l'échelle 1:1, l'image n'est plus jamais rééchantillonnée ni déformée. */
const TAILLES_LOGO = [84, 64, 52];
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
  paper: '#F3EDE1', tint: '#E9E1D0', ink: '#17130E', ink2: '#4B4337', ink3: '#877B68',
  hair: 'rgba(23,19,14,0.16)', ochre: '#9A7021', ochreHi: '#B8893A',
  up: '#1D6A45', down: '#AD2D22', flat: '#9C917F'
};
export const HANDLE = 'thecapitalinvest.com';

/* ── Formatage fr-FR ─────────────────────────────────────────────── */
const nf = (v, d = 2) => Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/[\u202F\u00A0]/g, '\u00A0');
export const pct = (v, d = 2) => (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v), d) + '\u00A0%';
export const fcfa = (v) => v >= 1e9 ? nf(v / 1e9, 2) + ' Md FCFA' : v >= 1e6 ? nf(v / 1e6, 1) + ' M FCFA' : nf(v, 0) + ' FCFA';
const tone = (v) => v > 0 ? C.up : v < 0 ? C.down : C.flat;
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
const dateCourte = (s) => { const p = String(s).slice(0, 10).split('-'); return p[2] + '/' + p[1]; };
const nomIndice = (n) => String(n).replace('BRVM-', 'BRVM ').replace('COMPOSITE', 'Composite').replace('PRESTIGE', 'Prestige');

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
const svgImg = (svg, w, hgt, style) => img('data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'), w, hgt, style);

/* Styles typographiques */
const T = {
  label: (size = 20, color = C.ink3) => ({ fontFamily: 'Sans', fontWeight: 600, fontSize: size, letterSpacing: size * 0.12, color, textTransform: 'uppercase' }),
  num: (size = 30, color = C.ink, weight = 500) => ({ fontFamily: 'Mono', fontWeight: weight, fontSize: size, color, letterSpacing: -0.3 }),
  serif: (size, weight = 600, color = C.ink) => ({ fontFamily: 'Serif', fontWeight: weight, fontSize: size, color, lineHeight: 1.04, letterSpacing: -size * 0.012 })
};

/* Triangle de sens (les polices de titrage n'ont pas ▲ ▼ : on le dessine). */
function sens(v, size = 20) {
  const c = tone(v);
  const s = v > 0 ? `<polygon points="${size / 2},1 ${size - 1},${size - 2} 1,${size - 2}" fill="${c}"/>`
    : v < 0 ? `<polygon points="1,2 ${size - 1},2 ${size / 2},${size - 1}" fill="${c}"/>`
      : `<rect x="2" y="${size / 2 - 2}" width="${size - 4}" height="4" fill="${c}"/>`;
  return svgImg(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${s}</svg>`, size, size);
}
const variation = (v, size = 30, weight = 600) => h('div', { alignItems: 'center', gap: Math.round(size * 0.3) },
  sens(v, Math.round(size * 0.62)), txt(pct(v), T.num(size, tone(v), weight)));

/* Filets */
const filet = (w, epais = 1, color = C.ink) => h('div', { width: w, height: epais, backgroundColor: color });
const doubleFilet = (w) => h('div', { flexDirection: 'column', width: w, gap: 5 }, filet(w, 4), filet(w, 1));

function page(W, H, ...children) {
  return h('div', {
    width: W, height: H, flexDirection: 'column', fontFamily: 'Sans', color: C.ink, position: 'relative',
    backgroundColor: C.paper
  },
  /* Liseré ocre en tête de page : la seule note de couleur de marque. */
  h('div', { position: 'absolute', top: 0, left: 0, width: W, height: 14, backgroundColor: C.ochre }),
  ...children);
}

/* Titre de journal : emblème + « The Capital », rubrique à droite, double filet, ligne de date. */
function manchette(meta, inner, o = {}) {
  const s = o.scale || 1, lg = s >= 1 ? 84 : 64;
  return h('div', { flexDirection: 'column', width: inner },
    h('div', { alignItems: 'center', justifyContent: 'space-between', width: inner, paddingBottom: 18 * s },
      h('div', { alignItems: 'center', gap: 22 * s },
        img(logo(lg), lg, lg),
        h('div', { flexDirection: 'column' },
          txt('The Capital', T.serif(58 * s, 700)),
          txt('Bourse régionale · UEMOA', Object.assign(T.label(17 * s, C.ink3), { marginTop: 4 })))
      ),
      h('div', { flexDirection: 'column', alignItems: 'flex-end', gap: 6 },
        txt(meta.rubrique, T.label(20 * s, C.ochre)),
        txt(meta.edition, T.label(17 * s, C.ink3)))
    ),
    doubleFilet(inner),
    h('div', { justifyContent: 'space-between', width: inner, paddingTop: 12 * s, paddingBottom: 12 * s },
      txt(meta.dateLigne, Object.assign(T.label(19 * s, C.ink2), { letterSpacing: 1.5 })),
      txt('Clôture BRVM · Abidjan', Object.assign(T.label(19 * s, C.ink3), { letterSpacing: 1.5 }))),
    filet(inner, 1, C.hair)
  );
}

/* Titre de une (factuel, tiré des chiffres) et chapeau. */
function une(meta, inner, size) {
  return h('div', { flexDirection: 'column', width: inner, gap: Math.round(size * 0.32) },
    txt(meta.titreUne, T.serif(size, 600)),
    txt(meta.chapeau, { fontFamily: 'Serif', fontStyle: 'italic', fontWeight: 400, fontSize: Math.round(size * 0.4), lineHeight: 1.32, color: C.ink2 })
  );
}

/* En-tête de rubrique : gros filet noir, numéro et intitulé. */
function rubrique(num, titre, inner, droite) {
  return h('div', { flexDirection: 'column', width: inner, gap: 12 },
    filet(inner, 5),
    h('div', { justifyContent: 'space-between', alignItems: 'baseline', width: inner },
      h('div', { alignItems: 'baseline', gap: 14 },
        num ? txt(num, T.num(22, C.ochre, 600)) : null,
        txt(titre, T.label(24, C.ink))),
      droite ? txt(droite, T.label(18, C.ink3)) : null)
  );
}

function pied(W, pad, gauche) {
  return h('div', { position: 'absolute', left: pad, right: pad, bottom: 40, flexDirection: 'column', gap: 12 },
    filet(W - pad * 2, 1, C.ink),
    h('div', { justifyContent: 'space-between', alignItems: 'center' },
      txt(gauche || 'Source : BRVM · calculs The Capital · pas un conseil en investissement', { fontFamily: 'Sans', fontSize: 18, color: C.ink3 }),
      txt(HANDLE, T.num(20, C.ochre, 600)))
  );
}

/* Grand chiffre du Composite. */
function chiffreComposite(comp, o = {}) {
  const s = o.size || 120;
  return h('div', { flexDirection: 'column', gap: 6 },
    txt('BRVM Composite', T.label(20, C.ink3)),
    h('div', { alignItems: 'flex-end', gap: 26 },
      txt(nf(comp.valeur, 2), Object.assign(T.serif(s, 500), { lineHeight: 0.92, letterSpacing: -s * 0.03 })),
      h('div', { paddingBottom: Math.round(s * 0.1) }, variation(comp.perf, Math.round(s * 0.3))))
  );
}

/* Graphique de cours façon presse : trait d'encre, grille horizontale fine,
   graduations à droite, premières et dernières dates, point final ocre. */
function graphique(points, width, height) {
  if (!points || points.length < 5) return null;
  const vals = points.map(p => p.valeur);
  let min = Math.min(...vals), max = Math.max(...vals);
  const pasBrut = (max - min) / 3 || 1;
  const mag = Math.pow(10, Math.floor(Math.log10(pasBrut)));
  const pas = [1, 2, 2.5, 5, 10].map(m => m * mag).find(p => p >= pasBrut) || pasBrut;
  min = Math.floor(min / pas) * pas; max = Math.ceil(max / pas) * pas;
  const gw = width - 96, top = 10, bot = height - 38;
  const X = i => 2 + (i * (gw - 4)) / (points.length - 1);
  const Y = v => top + (bot - top) * (1 - (v - min) / ((max - min) || 1));
  let grid = '';
  /* Graduation : une sur deux si elles se serrent (petit format). */
  const saut = (bot - top) * pas / ((max - min) || 1) < 34 ? 2 : 1;
  for (let v = min, k = 0; v <= max + pas / 2; v += pas, k++) {
    const y = Y(v).toFixed(1);
    grid += `<line x1="0" y1="${y}" x2="${gw}" y2="${y}" stroke="${C.ink}" stroke-opacity="${v === min ? 0.55 : 0.14}" stroke-width="${v === min ? 1.5 : 1}"/>` +
      (k % saut === 0 ? `<text x="${gw + 14}" y="${(+y + 7).toFixed(1)}" font-family="Mono" font-size="20" fill="${C.ink3}">${nf(v, 0)}</text>` : '');
  }
  const line = points.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.valeur).toFixed(1)).join(' ');
  const l = points.length - 1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${grid}` +
    `<path d="${line}" fill="none" stroke="${C.ink}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<circle cx="${X(l).toFixed(1)}" cy="${Y(vals[l]).toFixed(1)}" r="8" fill="${C.ochre}" stroke="${C.paper}" stroke-width="3"/>` +
    `<text x="0" y="${height - 6}" font-family="Mono" font-size="20" fill="${C.ink3}">${dateCourte(points[0].date)}</text>` +
    `<text x="${gw}" y="${height - 6}" font-family="Mono" font-size="20" fill="${C.ink3}" text-anchor="end">${dateCourte(points[l].date)}</text></svg>`;
  return { svg, width, height };
}
function blocGraphique(d, width, height, o = {}) {
  const src = CURRENT_GRAPHS[`g${width}x${height}`];
  if (!src) return null;
  const pts = d.courbe, v0 = pts[0].valeur, v1 = pts[pts.length - 1].valeur;
  return h('div', { flexDirection: 'column', gap: 14, width },
    o.titre === false ? null : h('div', { justifyContent: 'space-between', alignItems: 'baseline', width },
      txt(`Composite · ${pts.length} dernières séances`, T.label(19, C.ink3)),
      h('div', { alignItems: 'baseline', gap: 10 }, txt(`sur ${pts.length} séances`, { fontFamily: 'Sans', fontSize: 18, color: C.ink3 }), txt(pct((v1 / v0 - 1) * 100), T.num(22, tone(v1 - v0), 600)))),
    img(src, width, height)
  );
}

/* Répartition en « gaufre » : un carré par titre coté. */
function gaufre(d, width, o = {}) {
  const n = Math.max(1, d.nbTitres), gap = o.gap || 6;
  const parLigne = o.parLigne || Math.min(n, 24);
  const cote = Math.floor((width - gap * (parLigne - 1)) / parLigne), haut = o.haut || cote;
  const cols = [];
  for (let i = 0; i < n; i++) cols.push(i < d.nbHausses ? C.up : i < d.nbHausses + d.nbStables ? C.flat : C.down);
  const lignes = [];
  for (let i = 0; i < n; i += parLigne) lignes.push(cols.slice(i, i + parLigne));
  return h('div', { flexDirection: 'column', gap: 16, width },
    h('div', { flexDirection: 'column', gap }, lignes.map(l => h('div', { gap }, l.map(c => h('div', { width: cote, height: haut, backgroundColor: c }))))),
    h('div', { gap: 30, alignItems: 'baseline' },
      [[d.nbHausses, 'en hausse', C.up], [d.nbStables, 'stables', C.ink3], [d.nbBaisses, 'en baisse', C.down]].map(([v, l, c]) =>
        h('div', { alignItems: 'baseline', gap: 9 }, txt(v, T.num(o.fs || 30, c, 600)), txt(l, { fontFamily: 'Sans', fontSize: (o.fs || 30) * 0.8, color: C.ink2 }))))
  );
}

/* Tableau de cotation : rang, valeur, nom, cours, variation (ou montant). */
function tableau(rows, inner, o = {}) {
  const hL = o.h || 84, fs = o.fs || 32;
  const colDroite = o.colDroite || 210, colCours = o.cours === false ? 0 : (o.colCours || 180);
  return h('div', { flexDirection: 'column', width: inner },
    o.entetes !== false ? h('div', { width: inner, paddingBottom: 10, borderBottom: `1.5px solid ${C.ink}` },
      txt('Valeur', Object.assign(T.label(17), { flexGrow: 1 })),
      colCours ? txt('Cours', Object.assign(T.label(17), { width: colCours, justifyContent: 'flex-end' })) : null,
      txt(o.titreDroite || 'Var.', Object.assign(T.label(17), { width: colDroite, justifyContent: 'flex-end' }))) : null,
    rows.map((t, k) => h('div', { width: inner, height: hL, alignItems: 'center', borderBottom: `1px solid ${C.hair}` },
      txt(String(k + 1), Object.assign(T.num(fs * 0.62, C.ink3, 500), { width: fs * 1.25 })),
      h('div', { flexDirection: 'column', flexGrow: 1 },
        txt(t.ticker, { fontFamily: 'Sans', fontWeight: 700, fontSize: fs, color: C.ink, letterSpacing: 0.5 }),
        o.noms !== false && t.nom ? txt(court(t.nom, o.nomMax || 26), { fontFamily: 'Serif', fontStyle: 'italic', fontSize: fs * 0.62, color: C.ink2, marginTop: -2 }) : null),
      colCours ? h('div', { flexDirection: 'column', alignItems: 'flex-end', width: colCours, gap: 4 },
        txt(t.cours != null ? nf(t.cours, 0) : '—', T.num(fs * 0.8, C.ink2, 400)),
        o.volume && t.volume ? txt(nf(t.volume, 0) + ' titres', { fontFamily: 'Sans', fontSize: fs * 0.5, color: C.ink3 }) : null) : null,
      h('div', { width: colDroite, justifyContent: 'flex-end' }, o.droite ? o.droite(t) : variation(t.perf, fs * 0.9, 600))
    ))
  );
}

/* Bandeau de trois chiffres séparés par des filets verticaux. */
function bandeau(cells, inner, o = {}) {
  const w = Math.floor(inner / cells.length);
  return h('div', { width: inner, borderTop: `1.5px solid ${C.ink}`, borderBottom: `1.5px solid ${C.ink}` },
    cells.map(([label, valeur, couleur], i) => h('div', {
      flexDirection: 'column', width: w, padding: `${o.py || 20}px ${i ? 22 : 0}px`, gap: 6,
      borderLeft: i ? `1px solid ${C.hair}` : 'none'
    },
    txt(label, T.label(o.lfs || 17, C.ink3)),
    typeof valeur === 'string' ? txt(valeur, T.num(o.fs || 34, couleur || C.ink, 600)) : valeur))
  );
}

/* ── STORY 1080×1920 ──────────────────────────────────────────────── */
function story(d, meta) {
  const W = 1080, H = 1920, pad = 72, inner = W - pad * 2;
  const comp = d.indices[0];
  const actif = d.actifs[0];
  const top = (l) => l.slice(0, 3);
  return page(W, H,
    h('div', { flexDirection: 'column', padding: `54px ${pad}px 0`, width: W },
      manchette(meta, inner),
      h('div', { marginTop: 36 }, une(meta, inner, 78)),
      comp ? h('div', { marginTop: 40, flexDirection: 'column', gap: 26 },
        chiffreComposite(comp, { size: 128 }),
        bandeau(d.indices.slice(1).map(i => [nomIndice(i.nom) + ' · ' + nf(i.valeur, 2), variation(i.perf, 30)])
          .concat([['Valeurs échangées', fcfa(d.valeurTotale)]]), inner, { fs: 30 })
      ) : null,
      h('div', { marginTop: 34 }, blocGraphique(d, inner, 250)),
      h('div', { marginTop: 34, flexDirection: 'column', gap: 18 },
        rubrique(null, `Les ${d.nbTitres} titres cotés`, inner),
        gaufre(d, inner, { parLigne: 24, fs: 30 })),
      h('div', { marginTop: 34, gap: 40, width: inner },
        [['Plus fortes hausses', top(d.hausses)], ['Plus fortes baisses', top(d.baisses)]].map(([titre, l]) =>
          h('div', { flexDirection: 'column', width: (inner - 40) / 2, gap: 12 },
            filet((inner - 40) / 2, 5), txt(titre, T.label(21, C.ink)),
            l.length ? tableau(l, (inner - 40) / 2, { fs: 30, h: 78, cours: false, noms: false, entetes: false, colDroite: 190 })
              : txt('Aucune sur la période', { fontFamily: 'Serif', fontStyle: 'italic', fontSize: 26, color: C.ink3 })))),
      actif ? h('div', { marginTop: 28, alignItems: 'baseline', gap: 14 },
        txt('Le plus échangé', T.label(19, C.ink3)),
        txt(actif.ticker, { fontFamily: 'Sans', fontWeight: 700, fontSize: 30 }),
        txt(fcfa(actif.valeur), T.num(28, C.ochre, 600))) : null
    ),
    pied(W, pad)
  );
}

/* ── CARRÉ 1080×1080 ──────────────────────────────────────────────── */
function carre(d, meta) {
  const W = 1080, pad = 72, inner = W - pad * 2;
  const comp = d.indices[0];
  const hb = d.hausses[0], bb = d.baisses[0];
  return page(W, W,
    h('div', { flexDirection: 'column', padding: `44px ${pad}px 0`, width: W },
      manchette(meta, inner, { scale: 0.8 }),
      h('div', { marginTop: 22 }, une(meta, inner, 52)),
      comp ? h('div', { marginTop: 22, justifyContent: 'space-between', alignItems: 'flex-end', width: inner },
        chiffreComposite(comp, { size: 92 }),
        h('div', { flexDirection: 'column', gap: 10, alignItems: 'flex-end', paddingBottom: 8 },
          d.indices.slice(1).map(i => h('div', { alignItems: 'center', gap: 16 },
            txt(nomIndice(i.nom), T.label(18, C.ink3)), variation(i.perf, 26))))) : null,
      h('div', { marginTop: 24 }, gaufre(d, inner, { parLigne: d.nbTitres, gap: 3, haut: 30, fs: 24 })),
      h('div', { marginTop: 18 }, blocGraphique(d, inner, 230, { titre: false })),
      h('div', { marginTop: 18 }, bandeau([
        ['Meilleure hausse', hb ? h('div', { alignItems: 'center', gap: 14 }, txt(hb.ticker, { fontFamily: 'Sans', fontWeight: 700, fontSize: 30 }), variation(hb.perf, 28)) : '—'],
        ['Plus forte baisse', bb ? h('div', { alignItems: 'center', gap: 14 }, txt(bb.ticker, { fontFamily: 'Sans', fontWeight: 700, fontSize: 30 }), variation(bb.perf, 28)) : '—'],
        ['FCFA échangés', fcfa(d.valeurTotale).replace(' FCFA', '')]
      ], inner, { fs: 28, py: 14 }))
    ),
    pied(W, pad, `${d.nbTitres} titres · source BRVM · pas un conseil en investissement`)
  );
}

/* ── CARROUSEL 1080×1350 ──────────────────────────────────────────── */
function cadre(meta, n, total, ...body) {
  const W = 1080, H = 1350, pad = 72, inner = W - pad * 2;
  return page(W, H,
    h('div', { flexDirection: 'column', padding: `48px ${pad}px 0`, width: W },
      h('div', { justifyContent: 'space-between', alignItems: 'center', width: inner, paddingBottom: 14 },
        h('div', { alignItems: 'center', gap: 16 }, img(logo(52), 52, 52), txt('The Capital', T.serif(38, 700)),
          txt('· ' + meta.rubrique, Object.assign(T.label(18, C.ochre), { marginLeft: 6 }))),
        txt(`${n} / ${total}`, T.num(22, C.ink3, 500))),
      doubleFilet(inner),
      h('div', { flexDirection: 'column', marginTop: 44, width: inner }, ...body)
    ),
    pied(W, pad, n < total ? `${meta.dateLigne} · la suite en faisant défiler ›` : undefined)
  );
}
const titreSlide = (num, sur, titre, inner) => h('div', { flexDirection: 'column', gap: 14, marginBottom: 34, width: inner },
  h('div', { alignItems: 'baseline', gap: 14 }, txt(num, T.num(24, C.ochre, 600)), txt(sur, T.label(22, C.ink3))),
  txt(titre, T.serif(66, 600)));

function carrousel(d, meta) {
  const N = 6, inner = 1080 - 72 * 2;
  const comp = d.indices[0];
  const s1 = cadre(meta, 1, N,
    txt(meta.dateLigne, T.label(22, C.ochre)),
    /* Taille du titre selon sa longueur : il doit tenir sur deux lignes. */
    h('div', { marginTop: 22 }, une(meta, inner, meta.titreUne.length > 34 ? 82 : 100)),
    comp ? h('div', { marginTop: 56 }, chiffreComposite(comp, { size: 150 })) : null,
    h('div', { marginTop: 56 }, bandeau([
      ['Titres en hausse', String(d.nbHausses), C.up],
      ['Titres en baisse', String(d.nbBaisses), C.down],
      ['FCFA échangés', fcfa(d.valeurTotale).replace(' FCFA', '')]
    ], inner, { fs: 40, py: 22 })),
    h('div', { marginTop: -1.5 }, bandeau([
      ['Meilleure hausse', d.hausses[0] ? h('div', { alignItems: 'center', gap: 16 }, txt(d.hausses[0].ticker, { fontFamily: 'Sans', fontWeight: 700, fontSize: 36 }), variation(d.hausses[0].perf, 32)) : '—'],
      ['Plus forte baisse', d.baisses[0] ? h('div', { alignItems: 'center', gap: 16 }, txt(d.baisses[0].ticker, { fontFamily: 'Sans', fontWeight: 700, fontSize: 36 }), variation(d.baisses[0].perf, 32)) : '—']
    ], inner, { py: 22 })),
    h('div', { marginTop: 40 }, gaufre(d, inner, { parLigne: d.nbTitres, gap: 3, haut: 36, fs: 26 }))
  );
  const s2 = cadre(meta, 2, N, titreSlide('01', 'Les indices', 'Où en est le marché', inner),
    h('div', { flexDirection: 'column', width: inner },
      h('div', { width: inner, paddingBottom: 10, borderBottom: `1.5px solid ${C.ink}` },
        txt('Indice', Object.assign(T.label(17), { flexGrow: 1 })),
        txt('Points', Object.assign(T.label(17), { width: 260, justifyContent: 'flex-end' })),
        txt(meta.hebdo ? 'Semaine' : 'Séance', Object.assign(T.label(17), { width: 250, justifyContent: 'flex-end' }))),
      d.indices.map(i => h('div', { width: inner, height: 92, alignItems: 'center', borderBottom: `1px solid ${C.hair}` },
        txt(nomIndice(i.nom), Object.assign(T.serif(38, 600), { flexGrow: 1 })),
        txt(nf(i.valeur, 2), Object.assign(T.num(32, C.ink, 500), { width: 260, justifyContent: 'flex-end' })),
        h('div', { width: 250, justifyContent: 'flex-end' }, variation(i.perf, 32))))),
    h('div', { marginTop: 40 }, blocGraphique(d, inner, 300)),
    h('div', { marginTop: 36 }, gaufre(d, inner, { parLigne: 24, fs: 28 }))
  );
  const palmares = (list, vide) => list.length
    ? tableau(list.slice(0, 5), inner, { fs: 40, h: 158, colCours: 230, colDroite: 250, volume: true })
    : txt(vide, { fontFamily: 'Serif', fontStyle: 'italic', fontSize: 34, color: C.ink3 });
  const s3 = cadre(meta, 3, N, titreSlide('02', 'Palmarès', 'Les plus fortes hausses', inner), palmares(d.hausses, 'Aucune hausse sur la période.'));
  const s4 = cadre(meta, 4, N, titreSlide('03', 'Palmarès', 'Les plus fortes baisses', inner), palmares(d.baisses, 'Aucune baisse sur la période.'));
  const tot = d.valeurTotale || 1;
  const s5 = cadre(meta, 5, N, titreSlide('04', 'Activité', 'Où l’argent a circulé', inner),
    h('div', { alignItems: 'baseline', gap: 18, marginBottom: 30 },
      txt(fcfa(d.valeurTotale).replace(' FCFA', ''), Object.assign(T.serif(96, 500), { letterSpacing: -2 })),
      txt('FCFA échangés', { fontFamily: 'Serif', fontStyle: 'italic', fontSize: 34, color: C.ink2 })),
    tableau(d.actifs.slice(0, 5), inner, {
      fs: 38, h: 142, colCours: 200, colDroite: 300, titreDroite: 'Valeur · part',
      droite: t => h('div', { flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
        txt(fcfa(t.valeur).replace(' FCFA', ''), T.num(30, C.ink, 600)),
        txt(nf(t.valeur / tot * 100, 1) + ' % du total', { fontFamily: 'Sans', fontSize: 20, color: C.ochre }))
    })
  );
  const secteurs = d.secteurs.slice(0, 7);
  const s6 = cadre(meta, 6, N, titreSlide('05', 'Secteurs', 'Le marché par secteur', inner),
    secteurs.length ? h('div', { flexDirection: 'column', width: inner },
      h('div', { width: inner, paddingBottom: 10, borderBottom: `1.5px solid ${C.ink}` },
        txt('Secteur', Object.assign(T.label(17), { flexGrow: 1 })),
        txt('Titres', Object.assign(T.label(17), { width: 120, justifyContent: 'flex-end' })),
        txt('Var. moyenne', Object.assign(T.label(17), { width: 250, justifyContent: 'flex-end' }))),
      secteurs.map(s => h('div', { width: inner, height: 90, alignItems: 'center', borderBottom: `1px solid ${C.hair}` },
        txt(court(s.nom, 32), Object.assign(T.serif(32, 500), { flexGrow: 1 })),
        txt(String(s.n || ''), Object.assign(T.num(26, C.ink3, 400), { width: 120, justifyContent: 'flex-end' })),
        h('div', { width: 250, justifyContent: 'flex-end' }, variation(s.perf, 28))))) : null,
    h('div', { marginTop: 44, flexDirection: 'column', gap: 12, paddingTop: 22, borderTop: `5px solid ${C.ink}`, width: inner },
      txt('Chaque séance, sur ' + HANDLE, T.serif(44, 600)),
      txt('Cours et historiques, états financiers, dividendes, obligations et alertes de prix.', { fontFamily: 'Serif', fontStyle: 'italic', fontSize: 28, lineHeight: 1.35, color: C.ink2 }))
  );
  return [s1, s2, s3, s4, s5, s6];
}

/* ── Rendu ───────────────────────────────────────────────────────── */
/* Les graphiques sont des SVG autonomes (texte de graduation compris) : ils
   sont rastérisés à part avec les mêmes polices, puis posés en PNG. */
/* resvg ne lit pas le WOFF : les <text> du graphique (graduations, dates) sont
   retirés, recomposés par satori en chemins avec les mêmes polices, puis
   réinjectés dans le SVG avant rastérisation (×2 pour la netteté). */
let CURRENT_GRAPHS = {};
async function rasterGraph(g) {
  const texts = [];
  const svgSansTexte = g.svg.replace(/<text x="([\d.]+)" y="([\d.]+)" font-family="Mono" font-size="(\d+)" fill="([^"]+)"(?: text-anchor="(end)")?>([^<]*)<\/text>/g,
    (m, x, y, fs, fill, anchor, s) => { texts.push({ x: +x, y: +y, fs: +fs, fill, anchor, s }); return ''; });
  const calque = await satori(h('div', { width: g.width, height: g.height, position: 'relative' },
    texts.map(t => txt(t.s, Object.assign(T.num(t.fs, t.fill, 400), {
      position: 'absolute', top: t.y - t.fs * 1.05,
      ...(t.anchor === 'end' ? { right: g.width - t.x } : { left: t.x })
    })))), { width: g.width, height: g.height, fonts: fonts() });
  const inner = calque.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const svg = svgSansTexte.replace(/<\/svg>\s*$/, inner + '</svg>');
  return 'data:image/png;base64,' + Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: g.width * 2 }, font: { loadSystemFonts: false } }).render().asPng()).toString('base64');
}
async function preparerGraphiques(d, tailles) {
  const out = {};
  for (const [, w, hh] of tailles) {
    const g = graphique(d.courbe || [], w, hh);
    if (g) out[`g${w}x${hh}`] = await rasterGraph(g);
  }
  return out;
}

async function png(el, width, height) {
  const svg = await satori(el, { width, height, fonts: fonts() });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: false } }).render().asPng());
}

export function metaBulletin(d) {
  const comp = d.indices[0];
  const hebdo = d.periode === 'hebdo';
  const verbe = !comp ? null : comp.perf > 0.05 ? 'progresse' : comp.perf < -0.05 ? 'recule' : 'est stable';
  const quand = hebdo ? 'sur la semaine' : 'en séance';
  const titreUne = !comp ? (hebdo ? 'La semaine à la BRVM' : 'La séance du jour')
    : verbe === 'est stable' ? `La BRVM est stable ${quand}`
      : `La BRVM ${verbe} de ${pct(Math.abs(comp.perf)).replace('+', '')} ${quand}`;
  /* Chapeau : uniquement des faits du bulletin (extrêmes et répartition). */
  const hb = d.hausses[0], bb = d.baisses[0];
  const phrases = [];
  if (bb && hb && Math.abs(bb.perf) >= Math.abs(hb.perf)) phrases.push(`${bb.ticker} signe la plus forte baisse (${pct(bb.perf)}), ${hb.ticker} la meilleure hausse (${pct(hb.perf)}).`);
  else if (hb && bb) phrases.push(`${hb.ticker} signe la meilleure hausse (${pct(hb.perf)}), ${bb.ticker} la plus forte baisse (${pct(bb.perf)}).`);
  else if (hb) phrases.push(`${hb.ticker} signe la meilleure hausse (${pct(hb.perf)}).`);
  else if (bb) phrases.push(`${bb.ticker} signe la plus forte baisse (${pct(bb.perf)}).`);
  phrases.push(`${d.nbHausses} titre${d.nbHausses > 1 ? 's' : ''} en hausse, ${d.nbBaisses} en baisse sur ${d.nbTitres}.`);
  const sousTitre = hebdo ? (p => p.charAt(0).toUpperCase() + p.slice(1))(periodeTexte(d.from, d.to)) : dateLongue(d.to);
  return {
    hebdo,
    rubrique: hebdo ? 'Bilan de la semaine' : 'La séance du jour',
    edition: hebdo ? `${(d.seances || []).length || 5} séances` : 'Édition de clôture',
    dateLigne: sousTitre,
    titreUne,
    chapeau: phrases.join(' '),
    /* Conservés pour les légendes et l'album Telegram. */
    accroche: hebdo ? 'LA SEMAINE EN 1 MINUTE' : 'LA SÉANCE DU JOUR EN 1 MINUTE',
    titre: hebdo ? 'La semaine\nà la BRVM' : 'La séance\ndu jour',
    titreCourt: hebdo ? 'La semaine à la BRVM' : 'La séance du jour',
    sousTitre,
    accrocheCover: titreUne
  };
}

export async function renderBulletin(d) {
  await preparerLogos();
  const meta = metaBulletin(d);
  CURRENT_GRAPHS = await preparerGraphiques(d, [['', 936, 250], ['', 936, 300], ['', 936, 230]]);
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
    const pg = pdf.addPage([1080, 1350]);
    pg.drawImage(im, { x: 0, y: 0, width: 1080, height: 1350 });
  }
  return { meta, story: storyPng, carre: carrePng, slides: slidePngs, pdf: Buffer.from(await pdf.save()) };
}
