/**
 * Rapports des sociétés cotées (brvm.org/fr/rapports-societes-cotees) :
 * états financiers annuels, rapports d'activités trimestriels / semestriels /
 * annuels, publiés en PDF par chaque émetteur.
 *
 * Même approche que lib/brvm-announcements-scraper.js : fetch() + expressions
 * régulières, fonction pure (aucune écriture ici). La page de chaque émetteur
 * est une table Drupal Views triée du plus récent au plus ancien, paginée par
 * ?page=N.
 *
 * Le rapprochement émetteur BRVM -> ticker se fait par une table explicite :
 * les libellés BRVM sont des sigles (« SGB CI », « BIIC », « SIB »…) que le
 * rapprochement par nom ne résout pas de façon fiable. Seules les sociétés
 * cotées au compartiment actions sont suivies ; les véhicules obligataires
 * (FCTC, TNC, TPCI…) ont leurs propres flux (DC/BR).
 */
import { fetchHtml, clean } from './brvm-scraper.js';

const BASE_URL = 'https://www.brvm.org/fr/rapports-societe-cotes';
const MAX_PAGES = 12;

export const EMETTEURS = {
  'air-liquide-ci': 'SIVC',
  'bank-africa-bf': 'BOABF',
  'bank-africa-bn': 'BOAB',
  'bank-africa-ci': 'BOAC',
  'bank-africa-ml': 'BOAM',
  'bank-africa-ng': 'BOAN',
  'bank-africa-sn': 'BOAS',
  'bbgci': 'BBGC',
  'bernabe-ci': 'BNBC',
  'bici-ci': 'BICC',
  'biic': 'BICB',
  'bollore-transport-logistics': 'SDSC',
  'cfao-motors-ci': 'CFAC',
  'cie-ci': 'CIEC',
  'coris-bank-international': 'CBIBF',
  'crown-siem-ci': 'SEMC',
  'ecobank-ci': 'ECOC',
  'ecobank-tg': 'ETIT',
  'filtisac-ci': 'FTSC',
  'lnb': 'LNBB',
  'nei-ceda-ci': 'NEIC',
  'nestle-ci': 'NTLC',
  'nsbc': 'NSBC',
  'onatel-bf': 'ONTBF',
  'oragroup': 'ORGT',
  'orange-ci': 'ORAC',
  'palm-ci': 'PALC',
  'safca-ci': 'SAFC',
  'saph-ci': 'SPHC',
  'servair-abidjan-ci': 'ABJC',
  'setao-ci': 'STAC',
  'sgb-ci': 'SGBC',
  'sib': 'SIBC',
  'sicable': 'CABC',
  'sicor': 'SICC',
  'sitab': 'STBC',
  'smb': 'SMBC',
  'sodeci': 'SDCC',
  'sogb': 'SOGC',
  'solibra': 'SLBC',
  'sonatel': 'SNTS',
  'sucrivoire': 'SCRC',
  'total': 'TTLC',
  'total-senegal-sa': 'TTLS',
  'totalenergies-marketing-sn': 'TTLS',
  'tractafric-ci': 'PRSC',
  'unilever-ci': 'UNLC',
  'uniwax-ci': 'UNXC',
  'vivo-energy-ci': 'SHEC'
};

/** AAAAMMJJ en tête du nom de fichier BRVM -> AAAA-MM-JJ. */
function dateFromUrl(url) {
  const m = /\/(20\d{2})(\d{2})(\d{2})_/.exec(String(url || ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * Déduit du titre BRVM le type de document et la période couverte, avec les
 * mêmes codes de période que la table `financials` (annuel, Q1, S1, 9M).
 * « 3ème trimestre » est un cumul au 30/09 dans les rapports BRVM : 9M.
 */
export function classifyReport(titre) {
  const t = decodeEntities(titre).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const year = (t.match(/(20\d{2})(?!.*20\d{2})/) || [])[1];
  const annee = year ? Number(year) : null;
  let periode = null;
  if (/(1(er|ere|st)?|premier)\s*(trimestre|quart?er)/.test(t)) periode = 'Q1';
  else if (/((2|deux)(e|eme|nd|ieme)?\s*trimestre|(1(er)?|premier)\s*semestre|half[- ]?year|first half|2nd quarter)/.test(t)) periode = 'S1';
  else if (/(3|trois)(e|eme|rd|ieme)?\s*(trimestre|quart?er)|9\s*mois|30 septembre/.test(t)) periode = '9M';
  // 4e trimestre / 2e semestre : cumul au 31/12, donc l'exercice complet.
  else if (/(4|quatr)(e|eme|th|ieme)?\s*(trimestre|quart?er)|(2|deux)(e|eme|nd|ieme)?\s*semestre|exercice|annuel|annual|31 decembre/.test(t)) periode = 'annuel';
  const categorie = /etats? financiers|comptes (annuels|consolides|sociaux)|financial statements/.test(t)
    ? 'etats_financiers'
    : 'rapport_activites';
  // « Etats financiers 2022 », « Rapport d'activité 2022 » : sans précision,
  // un document daté d'une seule année couvre l'exercice.
  if (!periode && annee) periode = 'annuel';
  return { categorie, periode, annee };
}

/**
 * Titre sans année (« Etats financiers - Norme SYSCOHADA ») : on la déduit de
 * la date de publication. Des états financiers ou un rapport d'exercice
 * publiés au premier semestre N portent sur l'exercice N-1 ; un rapport
 * intermédiaire porte sur l'année de publication.
 */
function inferMissingYear(cls, datePublication) {
  if (cls.annee || !datePublication) return cls;
  const y = Number(datePublication.slice(0, 4));
  const m = Number(datePublication.slice(5, 7));
  const periode = cls.periode || (cls.categorie === 'etats_financiers' ? 'annuel' : null);
  if (!periode) return cls;
  const annee = periode === 'annuel' ? (m <= 9 ? y - 1 : y) : y;
  return { ...cls, periode, annee, annee_deduite: true };
}

function decodeEntities(s) {
  return clean(s)
    .replace(/&#0*39;|&apos;|&rsquo;|’/g, "'")
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ');
}

function parseReportRows(html) {
  const out = [];
  for (const tr of String(html || '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const titreCell = tr[1].match(/<td[^>]*views-field-nothing[^>]*>([\s\S]*?)<\/td>/i);
    const fileCell = tr[1].match(/href="([^"]+\.pdf)"/i);
    if (!titreCell || !fileCell) continue;
    const titre = decodeEntities(titreCell[1]);
    if (!titre) continue;
    out.push({ titre, source_url: fileCell[1], date_publication: dateFromUrl(fileCell[1]) });
  }
  return out;
}

/**
 * Parcourt les rapports d'un émetteur, du plus récent au plus ancien, jusqu'à
 * la date de coupure (ou `maxPages`).
 */
async function scrapeEmetteur(slug, cutoffDate, maxPages, deadline) {
  const rows = [];
  for (let page = 0; page < maxPages; page++) {
    const left = deadline - Date.now();
    if (page > 0 && left < 3000) break;
    let html;
    try {
      html = await fetchHtml(`${BASE_URL}/${slug}${page ? `?page=${page}` : ''}`,
        { timeoutMs: Math.max(5000, Math.min(20000, left)) });
    } catch (error) {
      if (page === 0) throw new Error(`${slug} : ${error.message || error}`);
      break;
    }
    const pageRows = parseReportRows(html);
    if (!pageRows.length) break;
    let sawOlder = false;
    for (const row of pageRows) {
      if (row.date_publication && row.date_publication < cutoffDate) { sawOlder = true; continue; }
      rows.push(row);
    }
    if (sawOlder) break;
  }
  return rows;
}

/**
 * @param {object} [options]
 * @param {string[]} [options.slugs] sous-ensemble des émetteurs (clés de EMETTEURS)
 * @param {number} [options.sinceYears=2] fenêtre de récupération
 * @param {number} [options.maxPages=MAX_PAGES] pages par émetteur
 * @param {number} [options.concurrency=6] émetteurs lus en parallèle
 * @param {number} [options.deadline] horodatage (ms) après lequel aucun nouvel
 *   émetteur n'est lu : la fonction Vercel est limitée à 60 s et brvm.org est
 *   parfois lent (constaté le 2026-09-24 : lecture des listes > 55 s).
 * @param {number} [options.startOffset=0] rotation du point de départ, pour que
 *   des passages successifs interrompus par le délai couvrent tous les émetteurs.
 */
export async function scrapeRapports({ slugs, sinceYears = 2, maxPages = MAX_PAGES, concurrency = 6,
  deadline = Infinity, startOffset = 0 } = {}) {
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - sinceYears);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const base = (slugs && slugs.length ? slugs : Object.keys(EMETTEURS)).filter(s => EMETTEURS[s]);
  const k = base.length ? ((startOffset % base.length) + base.length) % base.length : 0;
  const list = base.slice(k).concat(base.slice(0, k));

  const rows = [];
  const errors = [];
  const skipped = [];
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const slug = list[next++];
      if (Date.now() > deadline) { skipped.push(slug); continue; }
      try {
        const found = await scrapeEmetteur(slug, cutoffDate, maxPages, deadline);
        for (const r of found) {
          const cls = inferMissingYear(classifyReport(r.titre), r.date_publication);
          rows.push({ ...r, ...cls, ticker: EMETTEURS[slug], emetteur_slug: slug,
            societe_nom: (r.titre.split(':')[0] || '').trim() || null });
        }
      } catch (error) {
        errors.push({ emetteur: slug, error: String(error?.message || error) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
  return { rows, errors, skipped };
}

export { parseReportRows, dateFromUrl };
