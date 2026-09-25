/**
 * Prix des matières premières qui font le chiffre d'affaires des sociétés
 * agricoles et pétrolières cotées (huile de palme, caoutchouc, sucre, cacao,
 * coton, Brent) et parité euro/dollar pour les convertir en FCFA.
 *
 * Source : FMI, « Primary Commodity Prices » (moyennes mensuelles, la série de
 * référence utilisée par les banques centrales), redistribuée sans clé d'API
 * par la Réserve fédérale de Saint-Louis (FRED, export CSV). La parité
 * EUR/USD (EXUSEU) est la moyenne mensuelle publiée par la Fed ; le FCFA est
 * arrimé à l'euro (1 € = 655,957 FCFA), la conversion est donc exacte.
 */

export const COMMODITY_SERIES = {
  huile_palme: { fred: 'PPOILUSDM', libelle: 'Huile de palme', unite: 'USD/t', marche: 'Malaisie, CAF Rotterdam' },
  caoutchouc: { fred: 'PRUBBUSDM', libelle: 'Caoutchouc naturel', unite: 'US cents/lb', marche: 'RSS n° 1, Singapour' },
  sucre: { fred: 'PSUGAISAUSDM', libelle: 'Sucre (marché mondial)', unite: 'US cents/lb', marche: 'Accord international sur le sucre' },
  cacao: { fred: 'PCOCOUSDM', libelle: 'Cacao', unite: 'USD/t', marche: 'ICCO, New York et Londres' },
  coton: { fred: 'PCOTTINDUSDM', libelle: 'Coton', unite: 'US cents/lb', marche: 'Indice Cotlook A' },
  brent: { fred: 'POILBREUSDM', libelle: 'Pétrole Brent', unite: 'USD/baril', marche: 'Brent daté' },
  eurusd: { fred: 'EXUSEU', libelle: 'Euro en dollars', unite: 'USD/EUR', marche: 'Réserve fédérale, moyenne mensuelle' }
};

const FRED_CSV = 'https://fred.stlouisfed.org/graph/fredgraph.csv';
const DEPUIS = '2015-01-01';

/** Lit une série FRED au format CSV : [{ date:'AAAA-MM-01', valeur }]. Les mois non publiés (« . ») sont ignorés. */
export async function fetchFredSeries(id, since = DEPUIS) {
  const url = `${FRED_CSV}?id=${encodeURIComponent(id)}&cosd=${since}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'TheCapitalInvest/1.0 (+https://thecapitalinvest.com)' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`FRED ${id} : HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  if (!/^observation_date|^DATE/i.test(lines[0] || '')) throw new Error(`FRED ${id} : format inattendu`);
  return lines.slice(1).map((l) => {
    const [date, v] = l.split(',');
    const valeur = Number(v);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(valeur) ? { date, valeur } : null;
  }).filter(Boolean);
}

/**
 * Récupère toutes les séries et les écrit dans commodity_prices (upsert sur
 * serie + date : une révision du FMI remplace l'ancienne valeur). Une série
 * en échec n'empêche pas les autres d'être mises à jour.
 */
export async function syncCommodities(db, { since = DEPUIS } = {}) {
  const bilan = {};
  for (const [serie, def] of Object.entries(COMMODITY_SERIES)) {
    try {
      const points = await fetchFredSeries(def.fred, since);
      const rows = points.map((p) => ({ serie, date: p.date, valeur: p.valeur, unite: def.unite, source: `FMI via FRED (${def.fred})`, updated_at: new Date().toISOString() }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await db.from('commodity_prices').upsert(rows.slice(i, i + 500), { onConflict: 'serie,date' });
        if (error) throw error;
      }
      bilan[serie] = { ok: true, points: rows.length, dernier: rows.length ? rows[rows.length - 1].date : null };
    } catch (error) {
      bilan[serie] = { ok: false, error: String(error?.message || error) };
    }
  }
  return { series: bilan };
}
