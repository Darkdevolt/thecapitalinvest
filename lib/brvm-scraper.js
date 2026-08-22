/**
 * Extraction des données de séance depuis brvm.org.
 *
 * Extrait de api/scrape-brvm.js pour être appelable directement par
 * api/process-brvm.js. Le pipeline effectuait auparavant un appel HTTP de la
 * fonction serverless vers elle-même : un aller-retour réseau facturé, soumis
 * au délai d'exécution et à l'authentification de la route publique, pour un
 * traitement qui se déroule dans le même processus.
 *
 * LIMITE STRUCTURELLE : l'analyse repose sur des expressions régulières
 * appliquées au HTML de brvm.org et sur l'ordre supposé des colonnes. Toute
 * refonte du site casse silencieusement l'extraction. Le contrôle de variation
 * en aval (api/process-brvm.js) sert de garde-fou, mais la solution durable est
 * un flux de données contractuel plutôt qu'un scraping de page.
 */
const SOURCES = {
  cours: 'https://www.brvm.org/fr/cours-actions/0',
  resume: 'https://www.brvm.org/fr/resume',
  capitalisations: 'https://www.brvm.org/fr/capitalisations/0',
  volumes: 'https://www.brvm.org/fr/volumes/0'
};

const FETCH_TIMEOUT_MS = 25000;

const clean = s => String(s ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
  .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').trim();

function num(value) {
  const raw = clean(value).replace(/%/g, '').trim();
  if (!raw || raw === '-') return null;
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(/,/g, '.')
    : raw.replace(/\s/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

const MONTHS = {
  janvier: '01', février: '02', mars: '03', avril: '04', mai: '05', juin: '06',
  juillet: '07', août: '08', septembre: '09', octobre: '10', novembre: '11', décembre: '12',
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
};

function extractDate(html) {
  const match = clean(html).match(
    /(?:Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\d{1,2})\s+([A-Za-zéûôà]+),?\s+(\d{4})/i
  );
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${month}-${String(match[1]).padStart(2, '0')}`;
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 TheCapitalInvest scraper',
        Accept: 'text/html,application/xhtml+xml'
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
    return await response.text();
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error(`${url} : délai dépassé (${FETCH_TIMEOUT_MS} ms)`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function tableRows(html) {
  const rows = [];
  for (const tr of String(html || '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => clean(c[1]));
    if (cells.length >= 2) rows.push(cells);
  }
  return rows;
}

const IGNORED_CODES = new Set(['CODE', 'SYMBOL', 'TICKER', 'TOTAL', 'TOUS']);

function findTicker(cells) {
  for (let i = 0; i < cells.length; i++) {
    const value = cells[i].trim().toUpperCase();
    if (/^[A-Z0-9]{3,6}$/.test(value) && !IGNORED_CODES.has(value)) return { index: i, ticker: value };
  }
  return null;
}

const numericCells = cells => cells
  .filter(cell => /^[-+]?\s*\d[\d\s.,]*%?$/.test(cell.trim()))
  .map(num);

function parseCourses(html, sessionDate) {
  const out = [];
  for (const cells of tableRows(html)) {
    const found = findTicker(cells);
    if (!found) continue;
    const values = numericCells(cells.slice(found.index + 1));
    // Colonnes attendues : volume, cours précédent, ouverture, clôture, variation.
    if (values.length < 4) continue;
    const [volume, , open, close] = values;
    const variation = values.length >= 5 ? values[4] : null;
    if (close == null) continue;
    out.push({
      ticker: found.ticker, date_seance: sessionDate,
      cours: close, cloture: close, cours_cloture: close,
      ouverture: open, cours_ouverture: open,
      plus_haut: null, plus_bas: null,
      variation, variation_pct: variation,
      volume: volume == null ? null : Math.round(volume),
      valeur_transigee: null, valeur_totale: null,
      transactions: null, capitalisation: null
    });
  }
  return [...new Map(out.map(row => [row.ticker, row])).values()];
}

function parseVolumes(html) {
  const out = {};
  for (const cells of tableRows(html)) {
    const found = findTicker(cells);
    if (!found) continue;
    const values = numericCells(cells.slice(found.index + 1));
    if (values.length >= 2) {
      out[found.ticker] = {
        volume: values[0] == null ? null : Math.round(values[0]),
        valeur_transigee: values[1],
        valeur_totale: values[1]
      };
    }
  }
  return out;
}

function parseCapitalisations(html) {
  const out = {};
  for (const cells of tableRows(html)) {
    const found = findTicker(cells);
    if (!found) continue;
    const values = numericCells(cells.slice(found.index + 1));
    if (values.length >= 4) out[found.ticker] = values[3];
  }
  return out;
}

const INDEX_PATTERNS = [
  [/BRVM[- ]C(?:OMPOSITE)?\s+([\d\s.,]+)\s+([+-]?[\d.,]+)%/i, 'BRVM-COMPOSITE'],
  [/BRVM[- ]30\s+([\d\s.,]+)\s+([+-]?[\d.,]+)%/i, 'BRVM-30'],
  [/BRVM[- ]PRES(?:TIGE)?\s+([\d\s.,]+)\s+([+-]?[\d.,]+)%/i, 'BRVM-PRESTIGE']
];

function parseIndices(html, sessionDate) {
  const text = clean(html);
  return INDEX_PATTERNS.flatMap(([pattern, name]) => {
    const match = text.match(pattern);
    if (!match) return [];
    const value = num(match[1]);
    const variation = num(match[2]);
    if (value == null) return [];
    return [{ indice: name, date_seance: sessionDate, valeur: value, variation, variation_pct: variation }];
  });
}

async function optional(url) {
  try { return { ok: true, html: await fetchHtml(url) }; }
  catch (error) { return { ok: false, error: String(error?.message || error) }; }
}

export async function scrapeBrvm() {
  const [coursR, resumeR, capR, volR] = await Promise.all([
    optional(SOURCES.cours), optional(SOURCES.resume),
    optional(SOURCES.capitalisations), optional(SOURCES.volumes)
  ]);
  if (!coursR.ok) throw new Error(`Source « cours » indisponible : ${coursR.error}`);

  const sessionDate = extractDate(coursR.html)
    || (resumeR.ok ? extractDate(resumeR.html) : null)
    || new Date().toISOString().slice(0, 10);

  const rows = parseCourses(coursR.html, sessionDate);
  if (!rows.length) throw new Error('Aucune cotation exploitable dans la source « cours »');

  const volumes = volR.ok ? parseVolumes(volR.html) : {};
  const caps = capR.ok ? parseCapitalisations(capR.html) : {};
  for (const row of rows) {
    if (volumes[row.ticker]) Object.assign(row, volumes[row.ticker]);
    if (caps[row.ticker] != null) row.capitalisation = caps[row.ticker];
  }

  return {
    date_seance: sessionDate,
    rows,
    // Auparavant : idx.length ? idx : (resumeR.ok ? [] : []) — les deux branches
    // de la condition étaient identiques, l'expression n'avait aucun effet.
    indices: resumeR.ok ? parseIndices(resumeR.html, sessionDate) : [],
    source: 'BRVM',
    count: rows.length,
    sources: SOURCES,
    source_status: { cours: coursR.ok, resume: resumeR.ok, capitalisations: capR.ok, volumes: volR.ok },
    source_errors: {
      cours: coursR.ok ? null : coursR.error,
      resume: resumeR.ok ? null : resumeR.error,
      capitalisations: capR.ok ? null : capR.error,
      volumes: volR.ok ? null : volR.error
    }
  };
}

export { SOURCES };
