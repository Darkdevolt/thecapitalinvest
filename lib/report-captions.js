/**
 * Textes de publication accompagnant les visuels du bulletin.
 *  - Toujours : un texte construit à partir des chiffres (aucune invention possible).
 *  - Si OPENAI_API_KEY est configurée (déjà utilisée par The Capital AI) : une
 *    version rédigée par l'IA à partir des MÊMES chiffres, contrôlée ensuite :
 *    tout pourcentage cité doit figurer dans les données, sinon la version IA
 *    est écartée et le texte construit est utilisé.
 */
import { pct, fcfa, dateLongue, periodeTexte, HANDLE } from './report-visuals.js';

const TAGS = '#BRVM #Bourse #Investir #Afrique #CôteDIvoire #UEMOA #FinanceAfricaine #TheCapital';

function faits(d) {
  const comp = d.indices[0];
  return {
    periode: d.periode === 'hebdo' ? 'semaine' : 'séance',
    date: d.periode === 'hebdo' ? periodeTexte(d.from, d.to) : dateLongue(d.to),
    indices: d.indices.map(i => ({ nom: i.nom, valeur: i.valeur, variation: pct(i.perf) })),
    hausses: d.hausses.slice(0, 5).map(t => ({ ticker: t.ticker, nom: t.nom, variation: pct(t.perf) })),
    baisses: d.baisses.slice(0, 5).map(t => ({ ticker: t.ticker, nom: t.nom, variation: pct(t.perf) })),
    plus_echanges: d.actifs.slice(0, 3).map(t => ({ ticker: t.ticker, nom: t.nom, valeur: fcfa(t.valeur) })),
    repartition: { hausses: d.nbHausses, baisses: d.nbBaisses, stables: d.nbStables, total: d.nbTitres },
    valeur_echangee: fcfa(d.valeurTotale),
    secteurs: d.secteurs.slice(0, 3).map(s => ({ nom: s.nom, variation: pct(s.perf) })),
    composite: comp ? { valeur: comp.valeur, variation: pct(comp.perf) } : null
  };
}

export function captionsGabarit(d) {
  const f = faits(d);
  const comp = d.indices[0];
  const hebdo = d.periode === 'hebdo';
  const sens = !comp ? 'termine' : comp.perf > 0.05 ? 'progresse' : comp.perf < -0.05 ? 'recule' : 'reste stable';
  const quand = hebdo ? 'cette semaine' : 'aujourd’hui';
  const h1 = d.hausses[0], b1 = d.baisses[0];
  const nf = (v) => Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const tiktok = [
    `📊 La BRVM ${sens} ${quand} : ${comp ? 'Composite ' + pct(comp.perf) : ''}`.trim(),
    h1 ? `🚀 ${h1.ticker} ${pct(h1.perf)}` + (b1 ? `  ·  📉 ${b1.ticker} ${pct(b1.perf)}` : '') : '',
    `${d.nbHausses} hausses, ${d.nbBaisses} baisses · ${fcfa(d.valeurTotale)} échangés`,
    '',
    `Toute la bourse d’Abidjan sur ${HANDLE}`,
    TAGS
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');

  const lignes = (list) => list.slice(0, 3).map(t => `• ${t.ticker} (${t.nom}) : ${pct(t.perf)}`).join('\n');
  const linkedin = [
    `${hebdo ? 'La semaine' : 'La séance du jour'} à la BRVM — ${f.date}`,
    '',
    comp ? `Le BRVM Composite ${sens} de ${pct(comp.perf).replace(/^[+−]/, '')} à ${nf(comp.valeur)} points` +
      (d.indices[1] ? `, le BRVM 30 ${pct(d.indices[1].perf)}` : '') + (d.indices[2] ? ` et le BRVM Prestige ${pct(d.indices[2].perf)}.` : '.') : '',
    `Sur ${d.nbTitres} titres cotés : ${d.nbHausses} en hausse, ${d.nbBaisses} en baisse, ${d.nbStables} stables. ${fcfa(d.valeurTotale)} ont été échangés` +
      (d.actifs[0] ? `, dont ${fcfa(d.actifs[0].valeur)} sur ${d.actifs[0].ticker}.` : '.'),
    '',
    d.hausses.length ? '📈 Plus fortes hausses\n' + lignes(d.hausses) : '',
    '',
    d.baisses.length ? '📉 Plus fortes baisses\n' + lignes(d.baisses) : '',
    '',
    d.secteurs[0] ? `${d.secteurs[0].perf >= 0 ? 'Secteur le plus dynamique' : 'Secteur qui résiste le mieux'} : ${d.secteurs[0].nom} (${pct(d.secteurs[0].perf)} en moyenne).` : '',
    '',
    `Analyses, états financiers et alertes : ${HANDLE}`,
    'Ceci n’est pas un conseil en investissement.',
    '',
    TAGS
  ].filter((l, i, a) => l !== '' || (a[i - 1] !== '' && i > 0)).join('\n').replace(/\n{3,}/g, '\n\n');

  return { tiktok, linkedin, source: 'gabarit' };
}

/* Tous les pourcentages cités par l'IA doivent exister dans les données. */
function pourcentagesAutorises(d) {
  const set = new Set();
  const add = (v) => { if (Number.isFinite(v)) set.add(Math.abs(v).toFixed(2).replace('.', ',')); };
  d.indices.forEach(i => add(i.perf));
  [...d.hausses, ...d.baisses].forEach(t => add(t.perf));
  d.secteurs.forEach(s => add(s.perf));
  return set;
}
function controle(texte, d) {
  const ok = pourcentagesAutorises(d);
  const cites = [...texte.matchAll(/(\d+[.,]\d{1,2})\s?%/g)].map(m => Number(m[1].replace(',', '.')).toFixed(2).replace('.', ','));
  return cites.every(c => ok.has(c));
}

export async function captionsIA(d, { apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL || 'gpt-5-mini' } = {}) {
  const base = captionsGabarit(d);
  if (!apiKey) return base;
  const consignes = [
    'Tu es le rédacteur social media de The Capital, média financier sur la BRVM (bourse régionale d’Afrique de l’Ouest).',
    'Rédige en français, à partir UNIQUEMENT des chiffres fournis en JSON. N’invente aucun chiffre, aucune cause, aucune actualité.',
    'Cite les pourcentages exactement comme fournis (virgule décimale, deux décimales).',
    'Réponds en JSON strict : {"tiktok": "...", "linkedin": "..."}.',
    'tiktok : 3 à 5 lignes courtes, une accroche forte en première ligne, 2-3 emojis maximum, termine par "' + HANDLE + '" puis les hashtags : ' + TAGS,
    'linkedin : 900 à 1300 caractères, ton professionnel et pédagogique, accroche en première ligne, paragraphes courts, listes à puces pour les palmarès,',
    'une phrase d’enseignement pour l’investisseur (sans conseil d’achat ni de vente), mention "Ceci n’est pas un conseil en investissement.", puis les hashtags.'
  ].join('\n');
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, instructions: consignes, input: JSON.stringify(faits(d)) }),
      signal: AbortSignal.timeout(25000)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'HTTP ' + res.status);
    const texte = body.output_text || (body.output || []).flatMap(o => o.content || []).map(c => c.text || '').join('');
    const out = JSON.parse(texte.slice(texte.indexOf('{'), texte.lastIndexOf('}') + 1));
    if (!out.tiktok || !out.linkedin) throw new Error('réponse incomplète');
    if (!controle(out.tiktok, d) || !controle(out.linkedin, d)) throw new Error('chiffre non présent dans les données');
    return { tiktok: out.tiktok.trim(), linkedin: out.linkedin.trim(), source: 'ia:' + model };
  } catch (e) {
    return Object.assign(base, { erreurIA: String(e.message || e) });
  }
}
