/**
 * Données The Capital fournies à l'IA avant chaque réponse.
 *
 * - Sociétés citées dans la question (ticker, nom ou nom court, jusqu'à 3) :
 *   fiche, cours récent et performance 1 an, états financiers annuels
 *   (5 derniers exercices), dernières publications intermédiaires,
 *   dividendes détachés, ratios recalculés au dernier cours.
 * - Aucune société citée : tableau de marché compact (cours, variation,
 *   PER, rendement, secteur) pour toutes les valeurs, plus les indices.
 *
 * Les montants sont exprimés en millions de FCFA pour limiter la taille.
 */
import { supabaseAdmin } from './supabase.js';

const MAX_COMPANIES = 3;
const PERIOD_RANK = { Q1: 1, S1: 2, Q3: 3, '9M': 3 };
const STOP = new Set(['bank', 'banque', 'africa', 'of', 'cote', 'ivoire', 'd', 'group', 'groupe', 'ci', 'sn', 'societe',
  'international', 'internationale', 'senegal', 'benin', 'mali', 'niger', 'burkina', 'faso', 'togo', 'de', 'du', 'la', 'le',
  'et', 'pour', 'l', 'industrie', 'commerce', 'marketing', 'packaging', 'boa', 'nationale']);

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const mn = v => v == null || !Number.isFinite(Number(v)) ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(v) / 1e6).replace(/ | /g, ' ');
const nb = (v, d = 0) => v == null || !Number.isFinite(Number(v)) ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(Number(v)).replace(/ | /g, ' ');
const pct = v => v == null || !Number.isFinite(v) ? '—' : (v * 100).toFixed(1).replace('.', ',') + ' %';
/* Variation du jour en % : colonne « variation » (celle affichée par le site) ;
   variation_pct vaut 0 à tort sur une partie de l'historique. */
const dayVar = r => { if (!r) return null; const v = r.variation ?? r.variation_pct; return v == null ? null : Number(v); };
const ratio = (a, b) => (Number.isFinite(Number(a)) && Number(b) > 0) ? Number(a) / Number(b) : null;

let companiesCache = null, companiesAt = 0;
async function companies() {
  if (companiesCache && Date.now() - companiesAt < 10 * 60e3) return companiesCache;
  const { data, error } = await supabaseAdmin.from('entreprises')
    .select('ticker,nom,nom_court,secteur,pays,nombre_actions,nb_actions,actif');
  if (error) throw error;
  companiesCache = (data || []).filter(c => c.actif !== false).map(c => {
    const aliases = new Set([norm(c.nom_court), norm(c.nom)]);
    for (const w of norm(c.nom_court).split(' ')) if (w.length >= 4 && !STOP.has(w)) aliases.add(w);
    const first = norm(c.nom).split(' ')[0];
    if (first && first.length >= 4 && !STOP.has(first)) aliases.add(first);
    aliases.delete('');
    return { ...c, shares: Number(c.nombre_actions || c.nb_actions) || null, aliases: [...aliases] };
  });
  companiesAt = Date.now();
  return companiesCache;
}

export function detectCompanies(text, list) {
  const q = ' ' + norm(text) + ' ';
  const hits = [];
  for (const c of list) {
    let score = 0;
    if (q.includes(' ' + c.ticker.toLowerCase() + ' ')) score = 3;
    else if (c.aliases.some(a => q.includes(' ' + a + ' '))) score = 2;
    if (score) hits.push({ c, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, MAX_COMPANIES).map(h => h.c);
}

async function priceHistory(ticker) {
  const since = new Date(Date.now() - 400 * 86400e3).toISOString().slice(0, 10);
  const { data } = await supabaseAdmin.from('historique')
    .select('date_seance,cours_cloture,cloture,variation_pct')
    .eq('ticker', ticker).gte('date_seance', since).order('date_seance', { ascending: true });
  return (data || []).map(r => ({ d: r.date_seance, p: Number(r.cours_cloture ?? r.cloture), v: r.variation_pct })).filter(r => r.p > 0);
}

async function companyBlock(c) {
  const [hist, fin, divs] = await Promise.all([
    priceHistory(c.ticker),
    supabaseAdmin.from('financials').select('*').eq('ticker', c.ticker).order('annee', { ascending: false }).limit(24).then(r => r.data || []),
    supabaseAdmin.from('evenements_valeurs').select('exercice,date_ex,date_paiement,montant_net')
      .eq('ticker', c.ticker).eq('categorie', 'dividende').order('date_ex', { ascending: false }).limit(6).then(r => r.data || [])
  ]);
  const last = hist[hist.length - 1];
  const yearAgo = hist.find(r => r.d >= new Date(Date.parse(last?.d || Date.now()) - 365 * 86400e3).toISOString().slice(0, 10));
  const hi = hist.length ? Math.max(...hist.slice(-250).map(r => r.p)) : null;
  const lo = hist.length ? Math.min(...hist.slice(-250).map(r => r.p)) : null;
  const annual = fin.filter(f => f.periode === 'annuel' || !f.periode).sort((a, b) => b.annee - a.annee).slice(0, 5);
  const interim = fin.filter(f => f.periode && f.periode !== 'annuel')
    .sort((a, b) => b.annee - a.annee || (PERIOD_RANK[b.periode] || 0) - (PERIOD_RANK[a.periode] || 0)).slice(0, 3);

  const lines = [];
  lines.push(`### ${c.nom} (${c.ticker}) — ${c.secteur || 'secteur n.d.'}, ${c.pays || 'pays n.d.'}`);
  lines.push(`Nombre d'actions : ${nb(c.shares)}.`);
  if (last) {
    lines.push(`Dernier cours : ${nb(last.p)} FCFA (séance du ${last.d})${yearAgo ? ` ; il y a un an : ${nb(yearAgo.p)} FCFA (${pct(last.p / yearAgo.p - 1)})` : ''} ; plus haut / plus bas 12 mois : ${nb(hi)} / ${nb(lo)} FCFA.`);
    if (c.shares) lines.push(`Capitalisation boursière : ${mn(last.p * c.shares)} M FCFA.`);
  } else lines.push('Cours : non disponible dans la base.');

  if (annual.length) {
    lines.push('Comptes annuels (M FCFA sauf BPA et DPA brut en FCFA par action) :');
    lines.push('Exercice | Chiffre d\'affaires | Résultat net | Marge nette | Capitaux propres | ROE | Total actif | BPA | DPA brut | Statut');
    for (const f of annual) {
      const cp = f.capitaux_propres ?? f.fonds_propres;
      lines.push([f.annee, mn(f.chiffre_affaires), mn(f.resultat_net), pct(ratio(f.resultat_net, f.chiffre_affaires)), mn(cp),
        Number(cp) > 0 ? pct(ratio(f.resultat_net, cp)) : (cp != null ? 'n.s. (CP ≤ 0)' : '—'), mn(f.total_actif), nb(f.bpa, 2), nb(f.dpa, 2),
        f.validation_status === 'validated' ? 'validé' : 'en revue'].join(' | '));
    }
    const extra = annual[0];
    const more = [['EBE', extra.excedent_brut_exploitation], ['Résultat d\'exploitation', extra.resultat_exploitation ?? extra.ebit],
      ['Dettes financières', extra.dettes_financieres_total ?? extra.dettes_financieres ?? extra.dette_fin], ['Trésorerie (actif)', extra.tresorerie_actif],
      ['Flux opérationnels', extra.flux_activites_operationnelles ?? extra.cash_flow_operationnel], ['Investissements', extra.acquisitions_immobilisations ?? extra.capex]]
      .filter(([, v]) => v != null).map(([k, v]) => `${k} ${mn(v)}`);
    if (more.length) lines.push(`Détail ${extra.annee} (M FCFA) : ${more.join(' ; ')}.`);
    if (last) {
      const f = annual[0];
      const cp = Number(f.capitaux_propres ?? f.fonds_propres);
      const per = ratio(last.p, f.bpa), yld = ratio(f.dpa, last.p), pb = c.shares && cp > 0 ? last.p / (cp / c.shares) : null;
      lines.push(`Ratios au dernier cours (base exercice ${f.annee}) : PER ${per ? nb(per, 1) : '—'} ; rendement brut du dividende ${pct(yld)} ; cours / valeur comptable ${pb ? nb(pb, 2) : (cp <= 0 ? 'n.s. (CP ≤ 0)' : '—')}.`);
    }
  } else lines.push('États financiers annuels : non disponibles dans la base.');

  if (interim.length) {
    lines.push('Publications intermédiaires (cumul de l\'exercice, M FCFA) :');
    for (const f of interim) lines.push(`${f.annee} ${f.periode} : CA ${mn(f.chiffre_affaires)} ; résultat net ${mn(f.resultat_net)}${f.capitaux_propres ? ' ; capitaux propres ' + mn(f.capitaux_propres) : ''}.`);
  }
  if (divs.length) lines.push('Dividendes (net par action, date de détachement) : ' + divs.map(d => `${d.exercice ? 'ex. ' + d.exercice + ' : ' : ''}${nb(d.montant_net, 2)} FCFA le ${d.date_ex || d.date_paiement || 'n.d.'}`).join(' ; ') + '.');
  return lines.join('\n');
}

async function marketBlock(list) {
  const since = new Date(Date.now() - 14 * 86400e3).toISOString().slice(0, 10);
  const [{ data: hist }, { data: fin }, { data: idx }] = await Promise.all([
    supabaseAdmin.from('historique').select('ticker,date_seance,cours_cloture,cloture,variation,variation_pct').gte('date_seance', since).order('date_seance', { ascending: false }),
    supabaseAdmin.from('financials').select('ticker,annee,periode,bpa,dpa,resultat_net,capitaux_propres,fonds_propres').eq('periode', 'annuel').order('annee', { ascending: false }),
    supabaseAdmin.from('indices').select('indice,date_seance,valeur,variation_pct').gte('date_seance', since).order('date_seance', { ascending: false })
  ]);
  const lastPx = new Map();
  for (const r of hist || []) if (!lastPx.has(r.ticker)) lastPx.set(r.ticker, r);
  /* Dernier exercice annuel ayant un BPA (PER) et dernier exercice dont le DPA est
     connu, zéro compris (rendement) : un exercice sans dividende ne doit pas
     laisser remonter le dividende exceptionnel d'une année antérieure. */
  const lastBpa = new Map(), lastDpa = new Map();
  for (const f of fin || []) {
    if (!lastBpa.has(f.ticker) && f.bpa != null) lastBpa.set(f.ticker, f);
    if (!lastDpa.has(f.ticker) && f.dpa != null) lastDpa.set(f.ticker, f);
  }
  const lines = [];
  const seenIdx = new Set();
  const idxLine = (idx || []).filter(i => !seenIdx.has(i.indice) && seenIdx.add(i.indice)).map(i => `${i.indice} ${nb(i.valeur, 2)} (${i.variation_pct != null ? nb(i.variation_pct, 2) + ' %' : 'n.d.'}, ${i.date_seance})`);
  if (idxLine.length) lines.push('Indices : ' + idxLine.join(' ; ') + '.');

  /* Chaque valeur est étiquetée en toutes lettres : un tableau à colonnes faisait
     confondre le PER et le rendement à l'IA. */
  const rows = list.map(c => {
    const p = lastPx.get(c.ticker), fb = lastBpa.get(c.ticker), fd = lastDpa.get(c.ticker);
    const px = p ? Number(p.cours_cloture ?? p.cloture) : null;
    const per = px && fb && Number(fb.bpa) > 0 ? ratio(px, fb.bpa) : null;
    const yld = px && fd ? Number(fd.dpa) / px : null;
    return { c, p, px, per, yld, fb, fd };
  });
  lines.push('Toutes les valeurs :');
  for (const r of rows) {
    const bits = [`cours ${r.px ? nb(r.px) + ' FCFA' : 'n.d.'}${r.p ? ' (séance du ' + r.p.date_seance + ')' : ''}`,
      `variation du jour ${dayVar(r.p) != null ? nb(dayVar(r.p), 2) + ' %' : 'n.d.'}`,
      `PER ${r.per ? nb(r.per, 1) + 'x (BPA ' + r.fb.annee + ' : ' + nb(r.fb.bpa, 2) + ' FCFA)' : r.fb && Number(r.fb.bpa) <= 0 ? 'n.s. (perte en ' + r.fb.annee + ')' : 'n.d.'}`,
      `rendement brut du dividende ${r.yld == null ? 'n.d. (dividende non renseigné)' : r.yld === 0 ? '0 % (pas de dividende au titre de ' + r.fd.annee + ')' : pct(r.yld) + ' (DPA ' + r.fd.annee + ' : ' + nb(r.fd.dpa, 2) + ' FCFA)'}`,
      `secteur ${r.c.secteur || 'n.d.'}`];
    lines.push(`- ${r.c.ticker} (${r.c.nom_court || r.c.nom}) : ${bits.join(' ; ')}.`);
  }
  /* Classements déjà triés : l'IA ne doit pas les refaire elle-même. */
  const top = (arr, key, dir) => arr.filter(r => Number.isFinite(r[key]) && r[key] > 0).sort((x, y) => dir * (x[key] - y[key])).slice(0, 10);
  const byYield = top(rows, 'yld', -1);
  if (byYield.length) lines.push('CLASSEMENT PAR RENDEMENT BRUT DU DIVIDENDE (du plus élevé au plus faible) : ' + byYield.map((r, i) => `${i + 1}. ${r.c.ticker} ${pct(r.yld)}`).join(' ; ') + '.');
  const byPer = top(rows, 'per', 1);
  if (byPer.length) lines.push('CLASSEMENT PAR PER (du plus bas au plus élevé) : ' + byPer.map((r, i) => `${i + 1}. ${r.c.ticker} ${nb(r.per, 1)}x`).join(' ; ') + '.');
  return lines.join('\n');
}

/** Bloc de données à joindre au prompt système. Ne lève jamais : en cas d'erreur, renvoie ''. */
export async function buildAiContext(question, pageTicker = '') {
  try {
    const list = await companies();
    const found = detectCompanies(question, list);
    const parts = [];
    if (found.length) {
      const blocks = await Promise.all(found.map(companyBlock));
      parts.push(...blocks);
    } else {
      /* Aucune société citée mais une fiche ouverte (« est-ce cher ? ») :
         la valeur affichée, puis le tableau de marché pour les comparaisons. */
      const onPage = pageTicker && list.find(c => c.ticker === pageTicker);
      if (onPage) {
        parts.push('Valeur affichée à l\'écran de l\'utilisateur :\n' + await companyBlock(onPage));
        found.push(onPage);
      }
      parts.push(await marketBlock(list));
    }
    return { text: parts.join('\n\n'), tickers: found.map(c => c.ticker) };
  } catch (e) {
    console.error('[AI-CONTEXT]', e?.message || e);
    return { text: '', tickers: [] };
  }
}
