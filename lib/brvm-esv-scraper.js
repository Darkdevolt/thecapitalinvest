/**
 * Extraction des Évènements Sur Valeurs (ESV) depuis brvm.org — paiement de
 * dividendes, paiement de coupons/remboursement de capital, fractionnement,
 * augmentation/réduction de capital, fusion/absorption, consolidation,
 * radiation.
 *
 * Même approche que lib/brvm-announcements-scraper.js : fetch() + expressions
 * régulières, aucune dépendance HTML supplémentaire. Chaque page est une vue
 * Drupal (<table class="views-table">) dont les cellules portent une classe
 * views-field-<nom-du-champ> stable — on extrait donc par nom de champ, pas
 * par position de colonne, pour survivre à un réordonnancement des colonnes.
 *
 * Fonction pure : aucune écriture réseau/base ici. Le rapprochement au
 * référentiel entreprises, le téléchargement des PDF et l'écriture en base
 * sont du ressort de l'appelant (api/sync-esv.js).
 */
import { fetchHtml, clean } from './brvm-scraper.js';

/**
 * Deux catégories (Réduction de capital, Consolidation) sont vides sur
 * brvm.org au moment de l'écriture de ce module : leurs noms de champs sont
 * une estimation par analogie avec les catégories voisines (Augmentation de
 * capital / Fractionnement), faute de ligne réelle à inspecter. Si BRVM
 * publie un jour un évènement dans l'une de ces catégories et que les champs
 * ne correspondent pas, la ligne sera simplement ignorée (aucun champ
 * reconnu) plutôt que de produire une donnée fausse — à corriger alors en
 * relisant le HTML de la page concernée.
 */
export const CATEGORIES = [
  {
    slug: 'paiement-de-dividendes', categorie: 'dividende',
    url: 'https://www.brvm.org/fr/esv/paiement-de-dividendes',
    fields: {
      emetteur: { cls: 'views-field-field-emetteur-esv', type: 'text' },
      obligation: { cls: 'views-field-body-1', type: 'text' },
      exercice: { cls: 'views-field-field-exercice-comptable-esv', type: 'text' },
      date_paiement: { cls: 'views-field-field-date-de-paiement-esv', type: 'date' },
      date_ex: { cls: 'views-field-field-date-ex-dividende', type: 'date' },
      montant_net: { cls: 'views-field-field-montant-du-dividende-net', type: 'amount' },
      avis_url: { cls: 'views-field-field-avis-dividende-esv', type: 'link' }
    }
  },
  {
    slug: 'paiement-coupon', categorie: 'coupon',
    url: 'https://www.brvm.org/fr/taxonomy/term/119',
    fields: {
      emetteur: { cls: 'views-field-field-emetteur-esv', type: 'text' },
      obligation: { cls: 'views-field-body-1', type: 'text' },
      date_paiement: { cls: 'views-field-field-date-de-paiement-esv', type: 'date' },
      date_ex: { cls: 'views-field-field-date-ex-coupon-esv', type: 'date' },
      avis_url: { cls: 'views-field-field-avis-dividende-esv', type: 'link' }
    }
  },
  {
    slug: 'fractionnement', categorie: 'fractionnement',
    url: 'https://www.brvm.org/fr/esv/fractionnement',
    fields: {
      emetteur: { cls: 'views-field-field-emetteur-esv', type: 'text' },
      date_evenement: { cls: 'views-field-field-date-de-fractionnement', type: 'date' },
      parite: { cls: 'views-field-field-parite-esv', type: 'text' },
      valeur_theorique: { cls: 'views-field-field-valeur-theorique', type: 'amount' },
      avis_url: { cls: 'views-field-field-avis-dividende-esv', type: 'link' },
      communique_url: { cls: 'views-field-field-communique-esv', type: 'link' }
    }
  },
  {
    slug: 'augmentation-de-capital', categorie: 'augmentation_capital',
    url: 'https://www.brvm.org/fr/esv/augmentation-de-capital',
    fields: {
      emetteur: { cls: 'views-field-field-emetteur-esv', type: 'text' },
      date_evenement: { cls: 'views-field-field-date-de-fermeture-des-regi', type: 'date' },
      parite: { cls: 'views-field-field-autre-parite', type: 'text' },
      nature_droit: { cls: 'views-field-field-nature-du-droit-esv', type: 'text' },
      periode_negociation: { cls: 'views-field-field-periode-de-negociation-esv', type: 'text' },
      avis_url: { cls: 'views-field-field-avis-dividende-esv', type: 'link' },
      communique_url: { cls: 'views-field-field-communique-esv', type: 'link' }
    }
  },
  {
    slug: 'reduction-de-capital', categorie: 'reduction_capital',
    url: 'https://www.brvm.org/fr/esv/reduction-de-capital',
    fields: {
      emetteur: { cls: 'views-field-field-emetteur-esv', type: 'text' },
      date_evenement: { cls: 'views-field-field-date-de-fermeture-des-regi', type: 'date' },
      parite: { cls: 'views-field-field-autre-parite', type: 'text' },
      avis_url: { cls: 'views-field-field-avis-dividende-esv', type: 'link' },
      communique_url: { cls: 'views-field-field-communique-esv', type: 'link' }
    }
  },
  {
    slug: 'fusion-absorption', categorie: 'fusion_absorption',
    url: 'https://www.brvm.org/fr/taxonomy/term/124',
    fields: {
      emetteur_absorbe: { cls: 'views-field-field-emetteur-absorbe', type: 'text' },
      obligation: { cls: 'views-field-body-1', type: 'text' },
      date_evenement: { cls: 'views-field-field-date-d-assimilation-esv', type: 'date' },
      avis_url: { cls: 'views-field-field-avis-dividende-esv', type: 'link' },
      communique_url: { cls: 'views-field-field-communique-esv', type: 'link' }
    }
  },
  {
    slug: 'consolidation', categorie: 'consolidation',
    url: 'https://www.brvm.org/fr/esv/consolidation',
    fields: {
      emetteur: { cls: 'views-field-field-emetteur-esv', type: 'text' },
      date_evenement: { cls: 'views-field-field-date-de-fractionnement', type: 'date' },
      avis_url: { cls: 'views-field-field-avis-dividende-esv', type: 'link' }
    }
  },
  {
    slug: 'radiation', categorie: 'radiation',
    url: 'https://www.brvm.org/fr/esv/radiation',
    fields: {
      emetteur: { cls: 'views-field-field-emetteur-esv', type: 'text' },
      obligation: { cls: 'views-field-body-1', type: 'text' },
      date_evenement: { cls: 'views-field-field-date-de-radiation', type: 'date' },
      avis_url: { cls: 'views-field-field-avis-dividende-esv', type: 'link' }
    }
  }
];

/** Garde-fou : une catégorie ne doit jamais boucler indéfiniment si le site change de forme. */
const DEFAULT_MAX_PAGES = 15;

function extractIsoDate(cellHtml) {
  const m = String(cellHtml || '').match(/content="(\d{4}-\d{2}-\d{2})T/);
  return m ? m[1] : null;
}

function extractLink(cellHtml) {
  const m = String(cellHtml || '').match(/href="([^"]+\.pdf)"/i);
  return m ? m[1] : null;
}

/** "768,16 FCFA" / "2 127 FCFA" / "425 F CFA" → 768.16 / 2127 / 425. */
function amount(cellHtml) {
  const raw = clean(cellHtml).replace(/F\s*CFA/gi, '').replace(/[  \s]/g, '').trim();
  if (!raw) return null;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function avisNumero(url) {
  const m = String(url || '').match(/avis_nd?eg0*(\d+)/i);
  return m ? m[1] : null;
}

/**
 * Un <tr> de la vue ESV, en cellules { classe_token: html_interne }. Une
 * même classe complète peut porter plusieurs tokens (ex. "views-field
 * views-field-body-1") : on indexe chaque token pour un lookup exact, pas
 * une recherche par sous-chaîne — "views-field-body" et "views-field-body-1"
 * sont deux champs différents (Action vs Obligation) qui se chevauchent en
 * sous-chaîne.
 */
function cellsByClassToken(trHtml) {
  const byClass = {};
  for (const [, cls, inner] of trHtml.matchAll(/<td class="([^"]*)"[^>]*>([\s\S]*?)<\/td>/gi)) {
    for (const token of cls.split(/\s+/)) {
      if (!(token in byClass)) byClass[token] = inner;
    }
  }
  return byClass;
}

function parseCategoryRows(html, category) {
  const out = [];
  for (const tr of String(html || '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const byClass = cellsByClassToken(tr[1]);
    const row = { categorie: category.categorie };
    let matchedAny = false;
    for (const [key, def] of Object.entries(category.fields)) {
      const inner = byClass[def.cls];
      if (inner === undefined) continue;
      matchedAny = true;
      if (def.type === 'date') row[key] = extractIsoDate(inner);
      else if (def.type === 'link') row[key] = extractLink(inner);
      else if (def.type === 'amount') row[key] = amount(inner);
      else row[key] = clean(inner) || null;
    }
    if (!matchedAny) continue;
    if (row.avis_url) { row.avis_numero = avisNumero(row.avis_url); }
    if (!row.emetteur && !row.emetteur_absorbe && !row.avis_url && !row.communique_url) continue;
    out.push(row);
  }
  return out;
}

/** La date la plus représentative d'une ligne, pour la coupure par ancienneté. */
function rowDate(row) {
  return row.date_paiement || row.date_ex || row.date_evenement || null;
}

/**
 * Parcourt une catégorie page par page (BRVM liste du plus récent notifié au
 * plus ancien). S'arrête dès qu'une page entière est plus ancienne que la
 * coupure, ou après maxPages pages (has_more=true dans ce cas : un appel
 * ultérieur avec un maxPages ou un sinceYears plus grand ira plus loin en
 * arrière). maxPages est volontairement distinct de sinceYears : le suiveur
 * quotidien n'a besoin que des toutes premières pages (les nouveautés sont
 * en tête de liste) alors qu'un backfill explicite doit pouvoir remonter
 * loin sans être bridé après 2-3 pages.
 */
async function scrapeCategory(category, cutoffDate, maxPages) {
  const rows = [];
  let hasMore = false;
  for (let page = 0; page < maxPages; page++) {
    const url = `${category.url}${page ? `?page=${page}` : ''}`;
    let html;
    try { html = await fetchHtml(url); }
    catch (error) {
      if (page === 0) throw new Error(`${category.slug} : ${error.message || error}`);
      break;
    }
    const pageRows = parseCategoryRows(html, category);
    if (!pageRows.length) break;

    let sawOlder = false;
    for (const row of pageRows) {
      const d = rowDate(row);
      if (d && d < cutoffDate) { sawOlder = true; continue; }
      rows.push(row);
    }
    if (sawOlder) break;
    if (page === maxPages - 1) hasMore = true;
  }
  return { rows, hasMore };
}

/**
 * @param {object} [options]
 * @param {Array<object>} [options.categories] sous-ensemble de CATEGORIES
 * @param {number} [options.sinceYears=5] fenêtre de récupération, en années
 * @param {number} [options.maxPages] pages maximum par catégorie (défaut 15 ; le
 *   suiveur quotidien passe une valeur basse, un backfill manuel une valeur haute)
 * @returns {Promise<{rows: object[], errors: Array<{categorie:string, error:string}>, hasMore: Record<string, boolean>}>}
 */
export async function scrapeEsv({ categories = CATEGORIES, sinceYears = 5, maxPages = DEFAULT_MAX_PAGES } = {}) {
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - sinceYears);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const rows = [];
  const errors = [];
  const hasMore = {};
  for (const category of categories) {
    try {
      const result = await scrapeCategory(category, cutoffDate, maxPages);
      rows.push(...result.rows);
      hasMore[category.categorie] = result.hasMore;
    } catch (error) {
      errors.push({ categorie: category.categorie, error: String(error?.message || error) });
    }
  }
  return { rows, errors, hasMore };
}

export { parseCategoryRows, amount, avisNumero, extractIsoDate, extractLink };
