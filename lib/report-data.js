/**
 * Données d'un bulletin de marché (séance ou semaine), agrégées depuis
 * `historique` et `indices`.
 *
 * Variation d'un titre = enchaînement des variations de séance, chacune
 * calculée sur la clôture précédente AJUSTÉE :
 *   - dividende détaché ce jour-là : la clôture de la veille est diminuée du
 *     dividende net (sans quoi FILTISAC affichait −41,9 % le jour d'un dividende
 *     de 1 519 F, pour un titre en réalité à −2,5 %) ;
 *   - fractionnement / attribution gratuite ce jour-là : divisée par la parité.
 * Semaine : base = clôture de la semaine précédente, pas l'ouverture du lundi.
 *
 * Renvoie aussi de quoi contrôler les données (lib/report-controls.js) : pour
 * chaque séance, la variation BRUTE recalculée comparée à la variation
 * officielle publiée par la BRVM (colonne `variation`).
 */
import { supabaseAdmin } from './supabase.js';

const INDICES_ORDRE = ['BRVM-COMPOSITE', 'BRVM-30', 'BRVM-PRESTIGE'];
const AJUSTANTS = /^(fractionnement|attribution_gratuite|regroupement)$/;

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

/** Nom court lisible : nom_court, sinon nom sans le pays (« SOLIBRA COTE D'IVOIRE » -> « Solibra »). */
function nomCourt(e) {
  if (e.nom_court) return e.nom_court;
  const n = String(e.nom || '').replace(/\s+(COTE D'IVOIRE|CÔTE D'IVOIRE|SENEGAL|BENIN|BURKINA FASO|MALI|NIGER|TOGO|CI)$/i, '');
  return n.toLowerCase().replace(/(^|[\s\-'])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase());
}

export async function collectBulletin({ periode = 'seance', date }) {
  const to = date;
  const from = periode === 'hebdo' ? mondayOf(date) : date;
  const baseFrom = minusDays(from, 12); // couvre un long week-end férié

  const [quotes, indices, entsRes, courbeRes, divRes, runsRes] = await Promise.all([
    readAll(() => supabaseAdmin.from('historique')
      .select('ticker,date_seance,cours_cloture,cloture,volume,variation,valeur_totale')
      .gte('date_seance', baseFrom).lte('date_seance', to)
      .order('date_seance', { ascending: true })),
    readAll(() => supabaseAdmin.from('indices')
      .select('indice,date_seance,valeur,variation_pct')
      .gte('date_seance', baseFrom).lte('date_seance', to)
      .order('date_seance', { ascending: true })),
    supabaseAdmin.from('entreprises').select('ticker,nom,nom_court,secteur,actif,operations_capital'),
    supabaseAdmin.from('indices').select('date_seance,valeur')
      .ilike('indice', 'BRVM-COMPOSITE').gte('date_seance', minusDays(to, 50)).lte('date_seance', to)
      .order('date_seance', { ascending: true }),
    supabaseAdmin.from('dividendes_calendrier').select('ticker,date_detachement,ex_date,montant,montant_net,statut')
      .gte('date_detachement', baseFrom).lte('date_detachement', to),
    supabaseAdmin.from('brvm_scrape_runs').select('status,result,started_at')
      .gte('started_at', from + 'T00:00:00Z').order('id', { ascending: false }).limit(300)
  ]);
  for (const r of [entsRes, courbeRes, divRes, runsRes]) if (r && r.error) throw r.error;

  const ent = {};
  (entsRes.data || []).forEach(e => { ent[String(e.ticker).toUpperCase()] = e; });
  const nbActifs = (entsRes.data || []).filter(e => e.actif !== false).length;

  // Ajustement de la clôture de la veille, par titre et par séance.
  const ajust = {}; // `${ticker}|${date}` -> { div, ratio, motifs[] }
  const cle = (t, d) => t + '|' + d;
  (divRes.data || []).forEach(v => {
    if (/annul|suspend/i.test(String(v.statut || ''))) return;
    const d = v.date_detachement || v.ex_date;
    const net = Number(v.montant_net != null ? v.montant_net : v.montant);
    if (!d || !(net > 0)) return;
    const k = cle(String(v.ticker).toUpperCase(), d);
    const a = ajust[k] || (ajust[k] = { div: 0, ratio: 1, motifs: [] });
    a.div += net; a.motifs.push(`dividende net ${net} F`);
  });
  Object.values(ent).forEach(e => {
    (Array.isArray(e.operations_capital) ? e.operations_capital : []).forEach(o => {
      if (!o || !AJUSTANTS.test(String(o.type)) || !(Number(o.ratio) > 0) || !o.date) return;
      const k = cle(String(e.ticker).toUpperCase(), String(o.date).slice(0, 10));
      const a = ajust[k] || (ajust[k] = { div: 0, ratio: 1, motifs: [] });
      a.ratio *= Number(o.ratio); a.motifs.push(`${o.type} ${o.ratio}`);
    });
  });

  const inWindow = quotes.filter(r => r.date_seance >= from && close(r) !== null);
  if (!inWindow.length) return null;
  const seances = [...new Set(inWindow.map(r => r.date_seance))].sort();

  // Séries par titre (dates croissantes).
  const series = {};
  quotes.forEach(r => {
    const c = close(r);
    if (c === null) return;
    const t = String(r.ticker).toUpperCase();
    (series[t] = series[t] || []).push({ d: r.date_seance, c, v: r });
  });

  const concordance = []; // une entrée par titre et par séance de la fenêtre
  const titres = [];
  Object.keys(series).forEach(t => {
    const s = series[t];
    let base = null, valeur = 0, volume = 0, last = null, chain = 1, nbSeances = 0;
    const ajuste = [];
    s.forEach((p, i) => {
      if (p.d < from) { base = p; return; }
      const prev = i > 0 ? s[i - 1] : null;
      valeur += Number(p.v.valeur_totale) || 0;
      volume += Number(p.v.volume) || 0;
      last = p;
      if (!prev) return; // première cotation : pas de variation calculable
      const brute = (p.c / prev.c - 1) * 100;
      const officielle = Number(p.v.variation);
      if (p.v.variation != null && Number.isFinite(officielle)) {
        concordance.push({ ticker: t, date: p.d, brute, officielle, ecart: Math.abs(brute - officielle) });
      }
      const a = ajust[cle(t, p.d)];
      const ref = a ? (prev.c - a.div) / a.ratio : prev.c;
      if (a) ajuste.push(`${p.d} : ${a.motifs.join(', ')}`);
      if (!(ref > 0)) return;
      chain *= p.c / ref; nbSeances++;
    });
    if (!last) return;
    if (periode === 'seance' && last.d !== to) return; // pas coté ce jour-là
    const info = ent[t] || {};
    titres.push({
      ticker: t, nom: nomCourt(info.nom ? info : { nom: t }), secteur: info.secteur || '', cours: last.c,
      perf: nbSeances ? (chain - 1) * 100 : null, valeur, volume, ajuste,
      dateDerniere: last.d, premiereCotation: !base && s[0].d >= from
    });
  });

  // Semaine : un titre introduit en cours de semaine n'a pas de performance hebdomadaire comparable.
  const valides = titres.filter(e => e.perf !== null && Number.isFinite(e.perf) && !(periode === 'hebdo' && e.premiereCotation));

  // Indices : variation publiée pour une séance (officielle), enchaînement sur la base sinon.
  const idx = {};
  indices.forEach(r => {
    const k = String(r.indice || '').toUpperCase();
    const v = Number(r.valeur);
    if (!Number.isFinite(v)) return;
    const e = idx[k] || (idx[k] = { nom: k, base: null, last: null, lastDate: null, lastPct: null });
    if (r.date_seance < from) { e.base = v; return; }
    e.last = v; e.lastDate = r.date_seance;
    e.lastPct = r.variation_pct != null ? Number(r.variation_pct) : null;
  });
  const indicesList = INDICES_ORDRE.map(k => idx[k]).filter(e => e && e.last !== null).map(e => ({
    nom: e.nom, valeur: e.last, date: e.lastDate,
    perfCalculee: e.base ? (e.last / e.base - 1) * 100 : null,
    perf: periode === 'seance'
      ? (Number.isFinite(e.lastPct) ? e.lastPct : (e.base ? (e.last / e.base - 1) * 100 : null))
      : (e.base ? (e.last / e.base - 1) * 100 : null)
  }));

  const hausses = valides.filter(t => t.perf > 0).sort((a, b) => b.perf - a.perf);
  const baisses = valides.filter(t => t.perf < 0).sort((a, b) => a.perf - b.perf);
  const actifs = titres.slice().sort((a, b) => b.valeur - a.valeur);
  const valeurTotale = titres.reduce((s, t) => s + t.valeur, 0);

  const sect = {};
  valides.forEach(t => { if (t.secteur) (sect[t.secteur] = sect[t.secteur] || []).push(t.perf); });
  const secteurs = Object.keys(sect).map(s => ({ nom: s, perf: sect[s].reduce((a, b) => a + b, 0) / sect[s].length, n: sect[s].length }))
    .sort((a, b) => b.perf - a.perf);

  const courbe = ((courbeRes && courbeRes.data) || [])
    .map(r => ({ date: r.date_seance, valeur: Number(r.valeur) })).filter(r => Number.isFinite(r.valeur)).slice(-30);

  // Séances dont l'import a été validé par le pipeline (brvm_scrape_runs, statut success).
  const importsValides = [...new Set(((runsRes && runsRes.data) || [])
    .filter(r => r.status === 'success' && r.result && r.result.date_seance)
    .map(r => r.result.date_seance))];

  return {
    periode, from, to, seances, courbe,
    indices: indicesList,
    hausses, baisses, actifs, secteurs,
    nbHausses: hausses.length, nbBaisses: baisses.length, nbStables: valides.length - hausses.length - baisses.length,
    nbTitres: valides.length,
    valeurTotale,
    controle: {
      nbActifs,
      nbCotesDernier: titres.filter(t => t.dateDerniere === to).length,
      concordance, titres, importsValides
    }
  };
}
