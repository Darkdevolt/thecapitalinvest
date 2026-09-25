/**
 * Données d'un bulletin de marché (séance ou semaine), agrégées depuis
 * `historique` et `indices`. Base de comparaison :
 *  - séance : variation publiée par la BRVM pour la séance ;
 *  - semaine : dernier cours / dernière valeur AVANT le premier jour de la
 *    fenêtre (clôture de la semaine précédente), pas l'ouverture du lundi —
 *    sinon la séance du lundi disparaissait de la performance hebdomadaire.
 */
import { supabaseAdmin } from './supabase.js';

const INDICES_ORDRE = ['BRVM-COMPOSITE', 'BRVM-30', 'BRVM-PRESTIGE'];

function iso(d) { return d.toISOString().slice(0, 10); }
export function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return iso(d);
}
function minusDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return iso(d);
}

async function readAll(build) {
  const out = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function close(r) {
  const v = r.cours_cloture != null ? r.cours_cloture : r.cloture;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Nom court lisible : nom_court, sinon nom sans le pays en majuscules (« SOLIBRA COTE D'IVOIRE » -> « Solibra »). */
function nomCourt(e) {
  if (e.nom_court) return e.nom_court;
  const n = String(e.nom || '').replace(/\s+(COTE D'IVOIRE|CÔTE D'IVOIRE|SENEGAL|BENIN|BURKINA FASO|MALI|NIGER|TOGO|CI)$/i, '');
  return n.toLowerCase().replace(/(^|[\s\-'])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase());
}

export async function collectBulletin({ periode = 'seance', date }) {
  const to = date;
  const from = periode === 'hebdo' ? mondayOf(date) : date;
  const baseFrom = minusDays(from, 12); // couvre un long week-end férié

  let courbeRes = null;
  const [quotes, indices, { data: ents, error: e3 }] = await Promise.all([
    readAll(() => supabaseAdmin.from('historique')
      .select('ticker,date_seance,cours_cloture,cloture,volume,variation,variation_pct,valeur_totale')
      .gte('date_seance', baseFrom).lte('date_seance', to)
      .order('date_seance', { ascending: true })),
    readAll(() => supabaseAdmin.from('indices')
      .select('indice,date_seance,valeur,variation_pct')
      .gte('date_seance', baseFrom).lte('date_seance', to)
      .order('date_seance', { ascending: true })),
    supabaseAdmin.from('entreprises').select('ticker,nom,nom_court,secteur,actif'),
    // Courbe du BRVM Composite sur les ~30 dernières séances (graphique des visuels).
    supabaseAdmin.from('indices').select('date_seance,valeur')
      .ilike('indice', 'BRVM-COMPOSITE').gte('date_seance', minusDays(to, 50)).lte('date_seance', to)
      .order('date_seance', { ascending: true })
  ]).then(r => { courbeRes = r[3]; return r.slice(0, 3); });
  if (e3) throw e3;

  const ent = {};
  (ents || []).forEach(e => { ent[String(e.ticker).toUpperCase()] = e; });

  const inWindow = quotes.filter(r => r.date_seance >= from && close(r) !== null);
  if (!inWindow.length) return null;
  const seances = [...new Set(inWindow.map(r => r.date_seance))].sort();

  const byTicker = {};
  quotes.forEach(r => {
    const t = String(r.ticker).toUpperCase();
    const c = close(r);
    if (c === null) return;
    const e = byTicker[t] || (byTicker[t] = { ticker: t, base: null, first: null, last: null, valeur: 0, volume: 0, published: null });
    if (r.date_seance < from) { e.base = c; return; }
    if (e.first === null) e.first = c;
    e.last = c;
    e.valeur += Number(r.valeur_totale) || 0;
    e.volume += Number(r.volume) || 0;
    const p = Number(r.variation_pct != null && Number(r.variation_pct) !== 0 ? r.variation_pct : r.variation);
    if (Number.isFinite(p)) e.published = p;
  });

  const titres = Object.values(byTicker).filter(e => e.last !== null).map(e => {
    // Clôture précédente connue -> variation exacte ; sinon variation publiée (séance seulement).
    let perf = e.base ? (e.last / e.base - 1) * 100 : null;
    if (perf === null && periode === 'seance' && Number.isFinite(e.published)) perf = e.published;
    const info = ent[e.ticker] || {};
    return { ticker: e.ticker, nom: nomCourt(info.nom ? info : { nom: e.ticker }), secteur: info.secteur || '', cours: e.last, perf, valeur: e.valeur, volume: e.volume };
  }).filter(e => e.perf !== null && Number.isFinite(e.perf));

  const idx = {};
  indices.forEach(r => {
    const k = String(r.indice || '').toUpperCase();
    const v = Number(r.valeur);
    if (!Number.isFinite(v)) return;
    const e = idx[k] || (idx[k] = { nom: k, base: null, last: null, lastPct: null });
    if (r.date_seance < from) { e.base = v; return; }
    e.last = v;
    e.lastPct = Number(r.variation_pct);
  });
  const indicesList = INDICES_ORDRE.map(k => idx[k]).filter(e => e && e.last !== null).map(e => ({
    nom: e.nom,
    valeur: e.last,
    perf: e.base ? (e.last / e.base - 1) * 100 : (periode === 'seance' && Number.isFinite(e.lastPct) ? e.lastPct : null)
  }));

  const hausses = titres.filter(t => t.perf > 0).sort((a, b) => b.perf - a.perf);
  const baisses = titres.filter(t => t.perf < 0).sort((a, b) => a.perf - b.perf);
  const actifs = titres.slice().sort((a, b) => b.valeur - a.valeur);
  const valeurTotale = titres.reduce((s, t) => s + t.valeur, 0);

  // Secteurs : variation moyenne équipondérée des titres du secteur.
  const sect = {};
  titres.forEach(t => {
    if (!t.secteur) return;
    (sect[t.secteur] = sect[t.secteur] || []).push(t.perf);
  });
  const secteurs = Object.keys(sect).map(s => ({ nom: s, perf: sect[s].reduce((a, b) => a + b, 0) / sect[s].length, n: sect[s].length }))
    .sort((a, b) => b.perf - a.perf);

  const courbe = ((courbeRes && courbeRes.data) || [])
    .map(r => ({ date: r.date_seance, valeur: Number(r.valeur) })).filter(r => Number.isFinite(r.valeur)).slice(-30);

  return {
    periode, from, to, seances, courbe,
    indices: indicesList,
    hausses, baisses, actifs, secteurs,
    nbHausses: hausses.length, nbBaisses: baisses.length, nbStables: titres.length - hausses.length - baisses.length,
    nbTitres: titres.length,
    valeurTotale
  };
}
