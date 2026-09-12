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

/* normalizeInstrumentName efface le code pays (CI, SN, BF...) — nécessaire
   pour un rapprochement générique, mais ça rend indiscernables les
   filiales multi-pays d'un même groupe : "BANK OF AFRICA CI" et
   "BANK OF AFRICA BF/ML/NE/SN/BJ" normalisent toutes en "BANK OF AFRICA",
   avec un score identique -> ambigu, alors que le nom source portait bien
   l'information manquante. Idem pour Ecobank, Orange, etc. On ajoute donc
   une variante où le code est développé en toutes lettres avant le reste
   de la normalisation, pour que le pays reste discriminant. */
const COUNTRY_EXPANSIONS = [
  [/\bCI\b/, 'COTE IVOIRE'], [/\bSN\b/, 'SENEGAL'], [/\bBF\b/, 'BURKINA FASO'],
  [/\bBJ\b/, 'BENIN'], [/\bTG\b/, 'TOGO'], [/\bML\b/, 'MALI'], [/\bNE\b/, 'NIGER']
];

function aliases(value) {
  const n = normalizeInstrumentName(value);
  const out = new Set([n, compact(n)]);

  const upperRaw = String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  for (const [re, full] of COUNTRY_EXPANSIONS) {
    if (re.test(upperRaw)) {
      const expanded = normalizeInstrumentName(upperRaw.replace(re, full));
      out.add(expanded);
      out.add(compact(expanded));
    }
  }

  /* Ces motifs portent sur le nom déjà normalisé : "COTE D IVOIRE" y perd
     son "D" isolé (filler-word), d'où "COTE IVOIRE" ci-dessous — pas une
     faute de frappe, une des trois entrées précédentes ne matchait jamais
     pour cette raison (vérifié : la variante avec "D" ne matchait plus
     rien depuis que normalizeInstrumentName retire les mots de liaison). */
  const replacements = [
    [/BANK OF AFRICA/g, 'BOA'], [/BANQUE INTERNATIONALE POUR L INDUSTRIE ET LE COMMERCE/g, 'BIC'],
    [/SOCIETE GENERALE/g, 'SG'], [/COMPAGNIE IVOIRIENNE ELECTRICITE/g, 'CIE'],
    [/SONATEL/g, 'SONATEL'], [/ORANGE COTE IVOIRE/g, 'ORANGE CI'],
    [/BERNABE COTE IVOIRE/g, 'BERNABE'], [/SUCRIVOIRE/g, 'SUCRIVOIRE'],
    [/\bTOTAL\b/g, 'TOTALENERGIES']
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

  const rawSourceName = source?.nom ?? source?.name ?? source?.libelle ?? source?.company_name;
  const sourceName = normalizeInstrumentName(rawSourceName);
  if (!sourceName) return { status: 'unmatched', method: 'none', score: 0, candidates: [] };
  const sourceAliases = aliases(rawSourceName);
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
