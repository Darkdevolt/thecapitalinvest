/**
 * Extraction des annonces émetteurs (PDF) depuis brvm.org — convocations
 * d'assemblées générales, projets de résolution, notations financières,
 * communiqués, changements de dirigeants, franchissements de seuil.
 *
 * Même approche que lib/brvm-scraper.js : fetch() + expressions régulières,
 * pas de dépendance HTML supplémentaire. Chaque page est une table Drupal
 * Views standard (<table class="views-table">), paginée par ?page=N (0-indexé).
 *
 * Fonction pure : aucune écriture réseau/base ici. Le rapprochement au
 * référentiel entreprises, le téléchargement des PDF et l'écriture en base
 * sont du ressort de l'appelant (api/brvm-announcements.js), sur le même
 * principe de séparation que lib/brvm-scraper.js / api/process-brvm.js.
 */
import { fetchHtml, clean } from './brvm-scraper.js';

export const CATEGORIES = [
  { slug: 'convocations-assemblees-generales', categorie: 'convocation_ag' },
  { slug: 'projets-de-resolution', categorie: 'projet_resolution' },
  { slug: 'notations-financieres', categorie: 'notation_financiere' },
  { slug: 'communiques', categorie: 'communique' },
  { slug: 'changements-de-dirigeants', categorie: 'changement_dirigeants' },
  { slug: 'franchissements-de-seuil', categorie: 'franchissement_seuil' }
];

const BASE_URL = 'https://www.brvm.org/fr/emetteurs/type-annonces';
/** Garde-fou : une catégorie ne doit jamais boucler indéfiniment si le site change de forme. */
const MAX_PAGES = 60;

function parseDate(ddmmyyyy) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(String(ddmmyyyy || ''));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Découpe chaque <tr> de la table d'annonces en cellules identifiées par leur
 * classe views-field-*, plutôt que par position — plus robuste si BRVM ajoute
 * ou réordonne une colonne.
 */
function parseRows(html) {
  const out = [];
  for (const tr of String(html || '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<td[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/td>/gi)];
    if (!cells.length) continue;
    let date_publication = null, societe_nom = null, titre = null, source_url = null;
    for (const [, cls, inner] of cells) {
      if (cls.includes('field-date-annonce')) date_publication = parseDate(inner);
      else if (cls.includes('og-group-ref')) societe_nom = clean(inner) || null;
      else if (cls.includes('views-field-title')) titre = clean(inner) || null;
      else if (cls.includes('fichier-annonce')) {
        const m = inner.match(/href="([^"]+\.pdf)"/i);
        if (m) source_url = m[1];
      }
    }
    if (source_url && titre) out.push({ date_publication, societe_nom, titre, source_url });
  }
  return out;
}

/**
 * Parcourt une catégorie page par page, s'arrête dès qu'une page ne contient
 * plus aucune annonce dans la fenêtre demandée (les listes BRVM sont triées
 * du plus récent au plus ancien : une fois sous la date de coupure, la suite
 * n'apporte plus rien).
 */
async function scrapeCategory(cat, cutoffDate) {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${BASE_URL}/${cat.slug}${page ? `?page=${page}` : ''}`;
    let html;
    try { html = await fetchHtml(url); }
    catch (error) {
      if (page === 0) throw new Error(`${cat.slug} : ${error.message || error}`);
      break; // page suivante indisponible : on garde ce qui a déjà été collecté
    }
    const pageRows = parseRows(html);
    if (!pageRows.length) break;

    let sawOlder = false;
    for (const row of pageRows) {
      if (row.date_publication && row.date_publication < cutoffDate) { sawOlder = true; continue; }
      rows.push({ ...row, categorie: cat.categorie });
    }
    if (sawOlder) break;
  }
  return rows;
}

/**
 * @param {object} [options]
 * @param {Array<{slug:string,categorie:string}>} [options.categories] sous-ensemble de CATEGORIES
 * @param {number} [options.sinceYears=5] fenêtre de récupération, en années
 * @returns {Promise<{rows: object[], errors: Array<{categorie:string, error:string}>}>}
 */
export async function scrapeAnnouncements({ categories = CATEGORIES, sinceYears = 5 } = {}) {
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - sinceYears);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const rows = [];
  const errors = [];
  for (const cat of categories) {
    try {
      rows.push(...await scrapeCategory(cat, cutoffDate));
    } catch (error) {
      errors.push({ categorie: cat.categorie, error: String(error?.message || error) });
    }
  }
  return { rows, errors };
}

export { parseRows, parseDate };
