/**
 * Extraction des fiches techniques d'emprunts obligataires publiées par le
 * DC/BR (Dépositaire Central / Banque de Règlement, dcbruemoa.org) —
 * l'organisme qui attribue les codes ISIN pour toute la zone UEMOA.
 * Obligations cotées ET non cotées : la BRVM (lib/brvm-obligations-scraper.js)
 * ne couvre que les cotées, avec les cours du jour mais sans ISIN ni
 * caractéristiques d'émission complètes.
 *
 * Même approche que lib/brvm-esv-scraper.js : fetch() + expressions
 * régulières, aucune dépendance HTML supplémentaire. Chaque fiche est une
 * page Drupal dont les champs portent une classe field--name-field-<nom>
 * stable — extraction par nom de champ, pas par position.
 *
 * Fonction pure : aucune écriture réseau/base ici.
 */
import { fetchHtml, clean } from './brvm-scraper.js';

const BASE_URL = 'https://dcbruemoa.org';
const LIST_URL = `${BASE_URL}/fiche-technique`;

/** Garde-fou : jamais plus que ça de pages parcourues en un seul passage. */
const DEFAULT_MAX_PAGES = 15;

const FIELDS = {
  raison_sociale_emetteur: 'field-raison-sociale',
  capital_social: 'field-capital-social',
  registre_commerce: 'field-ndeg-registre-de-commerce',
  siege_social: 'field-siege-social',
  telephone_emetteur: 'field-tel-numero',
  registraire: 'field-registraire-',
  registraire_coordonnees: 'field-coordonnees-',
  personne_ressource: 'field-ressource',
  designation: 'field-designation-',
  nature_titres: 'field-nature-des-titres-',
  symbole: 'field-symbole-',
  isin: 'field-isin-',
  marche_secondaire: 'field-marche-secondaire-',
  montant_indicatif: 'field-montant-indicatif-de-l-emp',
  montant_effectif: 'field-montant-effectif-de-l-empr',
  valeur_nominale: 'field-valeur-nominale',
  nombre_titres: 'field-nombre-de-titres-',
  prix_emission: 'field-prix-d-emission',
  date_jouissance: 'field-date-de-jouissance',
  taux_brut: 'field-taux-brut-d-interet-annuel',
  taux_net: 'field-taux-d-interet-annuel-net-',
  montant_coupon_brut: 'field-montant-brut-coupon',
  montant_coupon_net: 'field-montant-net-du-coupon-',
  modalite_paiement: 'field-modalite-de-paiement-',
  duree: 'field-duree-',
  mode_remboursement: 'field-mode-de-remboursement',
  prix_remboursement: 'field-prix-de-remboursement-'
};

const NUMERIC_FIELDS = new Set([
  'montant_indicatif', 'montant_effectif', 'valeur_nominale', 'nombre_titres',
  'prix_emission', 'taux_brut', 'taux_net', 'montant_coupon_brut',
  'montant_coupon_net', 'prix_remboursement'
]);

/** "105 000 000 000 FCFA" / "6,40 %" / "10 000" → 105000000000 / 6.4 / 10000. */
function amount(text) {
  const raw = clean(text).replace(/FCFA|%/gi, '').replace(/[  \s]/g, '').trim();
  if (!raw) return null;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/** "01/04/2026" → "2026-04-01". */
function parseDate(text) {
  const m = clean(text).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function fieldRaw(html, fieldClass) {
  const escaped = fieldClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /* Lookahead sur espace/guillemet, pas \b : plusieurs classes DC/BR se
     terminent par un tiret ("field-symbole-", "field-isin-"...), et \b ne
     marque aucune frontière entre deux caractères non-mot (le tiret final
     et l'espace qui suit) — le champ ne matchait donc jamais. */
  const re = new RegExp(
    'field--name-' + escaped + '(?=[\\s"])[\\s\\S]*?<div class="field__item">([\\s\\S]*?)<\\/div>', 'i'
  );
  const m = html.match(re);
  return m ? m[1] : null;
}

function parseFicheDetail(html, url) {
  const row = { source_url: url };
  for (const [key, fieldClass] of Object.entries(FIELDS)) {
    const raw = fieldRaw(html, fieldClass);
    if (raw === null) continue;
    row[key] = NUMERIC_FIELDS.has(key) ? amount(raw) : clean(raw) || null;
  }
  if (row.date_jouissance) row.date_jouissance = parseDate(row.date_jouissance);
  if (!row.designation && !row.symbole && !row.isin) return null;
  return row;
}

/** Liens de fiches présents sur une page de listing, dans l'ordre d'affichage. */
function parseListLinks(html) {
  const out = [];
  const seen = new Set();
  for (const m of html.matchAll(/<a href="(\/fiche-technique\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1];
    if (seen.has(href)) continue;
    seen.add(href);
    out.push({ url: BASE_URL + href, titre: clean(m[2]) });
  }
  return out;
}

/**
 * Liste des fiches d'une catégorie, sans lire le détail de chacune — rapide
 * (une requête toutes les ~15 fiches), à l'inverse de la lecture détail qui
 * demande un aller-retour par fiche.
 * @param {object} [options]
 * @param {'cotee'|'non_cotee'|null} [options.categorie] filtre DC/BR (field_obligation_value=1|2), null = toutes
 * @param {number} [options.maxPages]
 * @returns {Promise<{links: Array<{url:string,titre:string}>, hasMore: boolean}>}
 */
export async function listDcbrFiches({ categorie = null, maxPages = DEFAULT_MAX_PAGES } = {}) {
  const filterValue = categorie === 'cotee' ? '1' : categorie === 'non_cotee' ? '2' : 'All';
  const links = [];
  let hasMore = false;

  for (let page = 0; page < maxPages; page++) {
    const url = `${LIST_URL}?field_obligation_value=${filterValue}&page=${page}`;
    let html;
    try { html = await fetchHtml(url); }
    catch (error) {
      if (page === 0) throw new Error(`liste fiches techniques : ${error.message || error}`);
      break;
    }
    const pageLinks = parseListLinks(html);
    if (!pageLinks.length) break;
    links.push(...pageLinks);
    if (page === maxPages - 1) hasMore = true;
  }

  return { links: [...new Map(links.map(l => [l.url, l])).values()], hasMore };
}

/** Lit et parse une fiche détail. `categorie` vient du filtre de liste utilisé
    pour la trouver (fiable), jamais déduit du contenu de la fiche elle-même. */
export async function fetchDcbrFicheDetail(url, categorie) {
  const html = await fetchHtml(url);
  const row = parseFicheDetail(html, url);
  if (row) row.categorie = categorie;
  return row;
}

/**
 * Lit le détail d'un lot de fiches avec un parallélisme borné : lire ~130
 * fiches une par une prend plusieurs minutes et dépasse largement le temps
 * d'exécution d'une fonction serverless — par lots de `concurrency`, ça tient
 * dans le budget. L'appelant décide déjà quelles URLs lire (typiquement
 * celles pas encore en base), cette fonction ne fait que le fetch parallèle.
 */
export async function fetchDcbrFicheDetails(links, categorie, concurrency = 6) {
  const rows = [];
  const errors = [];
  let index = 0;
  async function worker() {
    while (index < links.length) {
      const link = links[index++];
      try {
        const row = await fetchDcbrFicheDetail(link.url, categorie);
        if (row) rows.push(row);
      } catch (error) {
        errors.push({ url: link.url, error: String(error?.message || error) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, links.length) }, worker));
  return { rows, errors };
}

export { parseFicheDetail, parseListLinks, amount, parseDate };
