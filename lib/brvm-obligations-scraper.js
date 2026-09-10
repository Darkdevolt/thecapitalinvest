/**
 * Extraction du marché obligataire depuis brvm.org/fr/cours-obligations/0.
 *
 * Même parti pris que lib/brvm-scraper.js : expressions régulières sur le HTML
 * de brvm.org et ordre supposé des colonnes. Toute refonte du site casse
 * l'extraction — le contrôle en aval (nombre de lignes, cours > 0) sert de
 * garde-fou minimal.
 *
 * Colonnes de la table principale :
 *   Code obligation | Nom | Date émission | Date maturité |
 *   Cours du jour en valeur | Coupon couru | Dernier paiement (Date / Valeur)
 *
 * Bloc « Activités du marché » : valeur des transactions, capitalisation
 * actions, capitalisation des obligations.
 */
import { clean, num, tableRows, fetchHtml, extractDate } from './brvm-scraper.js';

const SOURCE = 'https://www.brvm.org/fr/cours-obligations/0';

/** JJ/MM/AAAA -> AAAA-MM-JJ ; renvoie null si vide ou non conforme. */
function frToIso(value) {
  const m = clean(value).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}

/** Taux facial lu dans le nom : « ... 6,80% 2024-2029 » -> 6.8 */
function tauxFacial(nom) {
  const m = clean(nom).match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/);
  return m ? num(m[1]) : null;
}

const CODE_RE = /^[A-Z0-9]{2,8}\.O\d{1,2}$/i;

function parseObligations(html, sessionDate) {
  // Isole précisément la table dont le balisage contient « Code obligation »
  // (la page comporte aussi des tables Top 5 / Flop 5 / Activités).
  let block = '';
  for (const seg of String(html || '').split(/<table\b/i)) {
    if (/Code obligation/i.test(seg)) { block = '<table' + seg.split(/<\/table>/i)[0] + '</table>'; break; }
  }
  const rows = tableRows(block || html);
  const out = [];
  for (const cells of rows) {
    const code = clean(cells[0]).toUpperCase();
    if (!CODE_RE.test(code)) continue;
    const nom = clean(cells[1]);
    const cours = num(cells[4]);
    // Dernier paiement : « JJ/MM/AAAA / 320,48 »
    const pay = clean(cells[6] || '').split(/\s\/\s/);
    out.push({
      code,
      nom,
      date_emission: frToIso(cells[2]),
      date_maturite: frToIso(cells[3]),
      cours: cours,
      coupon_couru: num(cells[5]),
      dernier_paiement_date: pay[0] ? frToIso(pay[0]) : null,
      dernier_paiement_valeur: pay[1] != null ? num(pay[1]) : null,
      taux_facial: tauxFacial(nom),
      date_seance: sessionDate
    });
  }
  // Déduplication par code (dernière occurrence gagne).
  return [...new Map(out.map(r => [r.code, r])).values()];
}

function parseMarche(html) {
  const text = clean(html);
  const grab = re => { const m = text.match(re); return m ? num(m[1]) : null; };
  return {
    valeur_transactions: grab(/Valeur des transactions\s+([\d\s.,]+)\s*FCFA/i),
    capitalisation_actions: grab(/Capitalisation Actions\s+([\d\s.,]+)\s*FCFA/i),
    capitalisation_obligations: grab(/Capitalisation des obligations\s+([\d\s.,]+)\s*FCFA/i)
  };
}

export async function scrapeBrvmObligations() {
  const html = await fetchHtml(SOURCE);
  const sessionDate = extractDate(html) || new Date().toISOString().slice(0, 10);
  const rows = parseObligations(html, sessionDate);
  if (!rows.length) throw new Error('Aucune ligne obligataire exploitable dans la source.');
  const marche = parseMarche(html);
  return {
    date_seance: sessionDate,
    rows,
    marche: { ...marche, nb_lignes: rows.length, date_seance: sessionDate },
    source: SOURCE,
    count: rows.length
  };
}

export { SOURCE };
