/* Canonical BRVM/Sika instrument matching.
 * No database writes. Designed to absorb naming differences between providers.
 */
export function normalizeInstrumentName(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/&/g, ' ET ')
    .replace(/\b(SA|S\.?A\.?|SOCIETE ANONYME|PLC|LTD|LIMITED|INC|CORP|CORPORATION)\b/g, ' ')
    .replace(/\b(CI|SN|BF|BJ|TG|ML|NE)\b/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\b(DE|DU|DES|LA|LE|LES|D|L)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTicker(value) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9.]/g, '');
}

function compact(value) { return normalizeInstrumentName(value).replace(/\s/g, ''); }

function aliases(value) {
  const n = normalizeInstrumentName(value);
  const out = new Set([n, compact(n)]);
  const replacements = [
    [/BANK OF AFRICA/g, 'BOA'], [/BANQUE INTERNATIONALE POUR L INDUSTRIE ET LE COMMERCE/g, 'BIC'],
    [/SOCIETE GENERALE/g, 'SG'], [/COMPAGNIE IVOIRIENNE D ELECTRICITE/g, 'CIE'],
    [/SONATEL/g, 'SONATEL'], [/ORANGE COTE D IVOIRE/g, 'ORANGE CI'],
    [/BERNABE COTE D IVOIRE/g, 'BERNABE'], [/SUCRIVOIRE/g, 'SUCRIVOIRE']
  ];
  for (const [re, repl] of replacements) if (re.test(n)) out.add(n.replace(re, repl));
  return [...out];
}

function score(source, target) {
  if (!source || !target) return 0;
  if (source === target) return 100;
  if (compact(source) === compact(target)) return 95;
  if (source.includes(target) || target.includes(source)) return 82;
  const a = new Set(source.split(' ')), b = new Set(target.split(' '));
  const inter = [...a].filter(x => x.length > 2 && b.has(x)).length;
  const denom = Math.max(1, Math.min(a.size, b.size));
  return Math.round((inter / denom) * 70);
}

export function matchInstrument(source, records = []) {
  const ticker = normalizeTicker(source?.ticker ?? source?.symbol ?? source?.code);
  if (ticker) {
    const exact = records.filter(r => normalizeTicker(r.ticker) === ticker);
    if (exact.length === 1) return { status: 'matched', method: 'ticker', score: 100, record: exact[0] };
    if (exact.length > 1) return { status: 'ambiguous', method: 'ticker', score: 100, candidates: exact };
  }

  const sourceName = normalizeInstrumentName(source?.nom ?? source?.name ?? source?.libelle ?? source?.company_name);
  if (!sourceName) return { status: 'unmatched', method: 'none', score: 0, candidates: [] };
  const sourceAliases = aliases(sourceName);
  const ranked = records.map(record => {
    const targetAliases = aliases(record.nom ?? record.name);
    const best = Math.max(...sourceAliases.flatMap(a => targetAliases.map(b => score(a, b))));
    return { record, score: best };
  }).filter(x => x.score >= 60).sort((a,b) => b.score - a.score);

  if (!ranked.length) return { status: 'unmatched', method: 'name', score: 0, candidates: [] };
  if (ranked.length > 1 && ranked[0].score - ranked[1].score < 8) {
    return { status: 'ambiguous', method: 'name', score: ranked[0].score, candidates: ranked.slice(0, 5).map(x => x.record) };
  }
  return { status: 'matched', method: 'name', score: ranked[0].score, record: ranked[0].record };
}
