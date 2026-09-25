/**
 * Intégration des tableaux de résultats lus dans les BOC (Bulletins
 * Officiels de la Cote) par scripts/boc_extract.py.
 *
 * Le script (GitHub Actions, OCR) ne fait que repérer les tableaux et
 * rendre leurs valeurs brutes par colonne datée. Tout ce qui engage la
 * qualité des données se décide ici, contre la base :
 *
 *  - émetteur : nom reconnu dans la page (ou les pages qui la précèdent) ;
 *  - unité : celle pour laquelle les colonnes de comparaison (N-1, 31/12)
 *    retombent sur les valeurs déjà en base — une seule contradiction
 *    écarte le tableau entier ;
 *  - statut : « validated » si au moins deux valeurs déjà connues sont
 *    retrouvées à l'identique (deux documents concordent), sinon « review » ;
 *  - jamais d'écrasement : une période déjà en base n'est pas modifiée
 *    (seul son statut peut passer à « validated » si le BOC la confirme).
 *
 * planBocIngest est une fonction pure (testable hors ligne) ; ingestBoc
 * l'exécute contre Supabase.
 */

export const BOC_FIELDS = ['chiffre_affaires', 'rbe', 'resultat_exploitation',
  'resultat_activites_ordinaires', 'resultat_net', 'total_actif', 'capitaux_propres'];
const FLOW = new Set(['chiffre_affaires', 'rbe', 'resultat_exploitation', 'resultat_activites_ordinaires', 'resultat_net']);
const STOCK = new Set(['total_actif', 'capitaux_propres']);
const MULTS = [1e6, 1e9, 1e3, 1];
const PERIOD_FRACTION = { Q1: 0.25, S1: 0.5, '9M': 0.75, annuel: 1 };
const FIELD_FR = {
  chiffre_affaires: 'CA/PNB', rbe: 'RBE', resultat_exploitation: 'Rés. exploitation',
  resultat_activites_ordinaires: 'RAO', resultat_net: 'Rés. net', total_actif: 'Total actif', capitaux_propres: 'Capitaux propres'
};

export function compact(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
}

const COUNTRY = { ci: ['cotedivoire'], sn: ['senegal'], bf: ['burkinafaso', 'burkina'], ml: ['mali'],
  bn: ['benin'], ng: ['niger'], tg: ['togo'], nr: ['niger'] };

/** Variantes compactes d'un nom d'émetteur : « BOA MALI » -> bankofafricamali… */
export function aliasesOf(ent) {
  const out = new Set();
  for (const raw of [ent.nom, ent.nom_court]) {
    if (!raw) continue;
    const words = String(raw).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    const firsts = words[0] === 'boa' ? ['boa', 'bankofafrica'] : [words[0]];
    const last = words[words.length - 1];
    const lasts = COUNTRY[last] ? [last, ...COUNTRY[last]] : [last];
    for (const f of firsts) {
      for (const l of lasts) {
        const w = words.length === 1 ? [f] : [f, ...words.slice(1, -1), l];
        const c = compact(w.join(''));
        if (c.length >= 6) out.add(c);
      }
    }
  }
  return [...out];
}

/** Émetteur cité dans la page (priorité) ou dans son contexte. */
/** Sigle court (« BIIC », « SGCI »…) : reconnu seulement comme mot en capitales. */
function shortAliasOf(ent) {
  const c = String(ent.nom_court || '').trim();
  return /^[A-Z]{3,5}$/.test(c) ? c : null;
}

export function resolveIssuer(cand, entreprises) {
  const zones = [cand.page_text, ...(cand.context || []).map(c => c.text), cand.context_text];
  for (const [zi, zone] of zones.entries()) {
    const text = compact(zone);
    if (!text) continue;
    let best = null;
    let tie = false;
    for (const ent of entreprises) {
      for (const a of ent.aliases || aliasesOf(ent)) {
        if (!text.includes(a)) continue;
        if (!best || a.length > best.alias.length) { best = { ent, alias: a }; tie = false; }
        else if (a.length === best.alias.length && best.ent.ticker !== ent.ticker) tie = true;
      }
    }
    if (best && !tie) return { ticker: best.ent.ticker, alias: best.alias, ent: best.ent };
    if (best && tie) return { ambiguous: true };
    // Sur la page elle-même seulement : sigle court écrit en capitales.
    if (zi === 0 && zone) {
      const hits = entreprises.filter(e => {
        const a = shortAliasOf(e);
        return a && new RegExp(`(^|[^A-Za-z])${a}([^A-Za-z]|$)`).test(zone);
      });
      if (hits.length === 1) return { ticker: hits[0].ticker, alias: shortAliasOf(hits[0]), ent: hits[0] };
    }
  }
  return null;
}

function lastDay(year, month) {
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}

/** Colonne datée -> période de la base. */
function periodOfColumn(col, fallback) {
  const [year, month] = col || [];
  if (!year) return null;
  if (month == null) return fallback ? { annee: year, periode: fallback, date_arrete: null, yearOnly: true } : null;
  const periode = { 3: 'Q1', 6: 'S1', 9: '9M', 12: 'annuel' }[month];
  return periode ? { annee: year, periode, date_arrete: lastDay(year, month) } : null;
}

const key = (t, a, p) => `${t}|${a}|${p}`;
const close = (a, b, rel = 0.015) => Math.abs(a - b) <= Math.max(Math.abs(b) * rel, 1);

/**
 * @param {object} input
 * @param {Array} input.candidates  sortie de boc_extract.py
 * @param {Array} input.entreprises [{ticker, nom, nom_court, sous_secteur, nombre_actions, nb_actions}]
 * @param {Map}   input.existing    key(ticker,annee,periode) -> ligne financials
 * @param {string} input.bocDate    AAAA-MM-JJ
 * @param {string} input.bocUrl
 */
export function planBocIngest({ candidates, entreprises, existing, bocDate, bocUrl }) {
  const report = [];
  const docs = new Map();   // ticker|annee|periode (colonne la plus récente) -> { ticker, cells: Map, cands: [] }
  const deferred = [];

  // Deux passes : une page sans unité ni référence en base (compte de
  // résultat d'un premier semestre, par ex.) reprend l'unité établie par une
  // autre page du même document (bilan recoupé au 31/12), et se recoupe
  // avec elle.
  for (const [pass, list] of [[1, candidates || []], [2, deferred]]) for (const cand of list) {
    const where = `p. ${cand.page}`;
    const who = resolveIssuer(cand, entreprises);
    if (!who || who.ambiguous) {
      report.push({ page: cand.page, status: 'ignored', reason: who?.ambiguous ? 'émetteur ambigu' : 'émetteur non reconnu' });
      continue;
    }
    const { ticker, ent } = who;
    // Colonnes -> périodes. Colonnes sans mois : période devinée du texte.
    const cols = (cand.columns || []).map(c => periodOfColumn(c, cand.period_guess)).filter(Boolean);
    const cells = new Map();   // key -> { period, fields: {field: raw} }
    let conflict = false;
    // Une colonne « 2025 » sans mois est ambiguë si la même année a aussi une
    // colonne datée (30/06/2025…) : ses valeurs sont écartées.
    const datedYears = new Set((cand.columns || []).filter(c => c && c[1] != null).map(c => c[0]));
    for (const [field, d] of Object.entries(cand.indicators || {})) {
      if (!BOC_FIELDS.includes(field)) continue;
      const byCol = new Map();
      for (const v of d.values || []) {
        if (!v.col) continue;
        if (v.col[1] == null && datedYears.has(v.col[0])) continue;
        const p = periodOfColumn(v.col, cand.period_guess);
        if (!p) continue;
        if (p.yearOnly && STOCK.has(field) && p.periode !== 'annuel') continue;
        const k = key(ticker, p.annee, p.periode);
        if (byCol.has(k) && byCol.get(k).v !== v.v) { conflict = true; continue; }
        byCol.set(k, { v: v.v, p });
      }
      for (const [k, { v, p }] of byCol) {
        if (!cells.has(k)) cells.set(k, { period: p, fields: {} });
        cells.get(k).fields[field] = v;
      }
    }
    if (!cells.size || conflict && cells.size < 2) {
      report.push({ page: cand.page, ticker, status: 'ignored', reason: 'colonnes non datées' });
      continue;
    }
    // Période du document = colonne la plus récente.
    const periods = [...cells.values()].map(c => c.period)
      .sort((a, b) => (a.annee - b.annee) || (PERIOD_FRACTION[a.periode] - PERIOD_FRACTION[b.periode]));
    const latest = periods[periods.length - 1];

    // Unité : recoupement avec la base sur toutes les cellules connues.
    const unitTrials = [cand.unit_guess, ...MULTS].filter((m, i, a) => m && a.indexOf(m) === i);
    let chosen = null;
    let anyRef = false;
    let closest = null;   // unité la plus cohérente, pour expliquer un rejet
    for (const m of unitTrials) {
      let matches = 0, mismatches = 0;
      const hit = [];
      const diff = [];
      for (const [k, cell] of cells) {
        const row = existing.get(k);
        if (!row) continue;
        for (const [f, v] of Object.entries(cell.fields)) {
          const dbv = Number(row[f]);
          if (!row[f] || !dbv) continue;
          anyRef = true;
          if (close(v * m, dbv)) { matches++; hit.push(`${FIELD_FR[f]} ${cell.period.periode} ${cell.period.annee}`); }
          else if (!close(v * m, dbv, 0.08)) {
            mismatches++;
            diff.push(`${FIELD_FR[f]} ${cell.period.periode} ${cell.period.annee} : BOC ${fmtM(v * m)} / base ${fmtM(dbv)}`);
          }
        }
      }
      if (matches && !mismatches && (!chosen || matches > chosen.matches)) chosen = { m, matches, hit, how: 'recoupé' };
      if (matches && (!closest || matches > closest.matches)) closest = { matches, diff };
    }
    if (!chosen && anyRef) {
      report.push({ page: cand.page, ticker, status: 'rejected', reason: closest
        ? `écart avec la base, rien modifié (${closest.diff.slice(0, 3).join(' ; ')})`
        : 'valeurs illisibles ou contredisant la base, rien modifié' });
      continue;
    }
    const dk0 = key(ticker, latest.annee, latest.periode);
    if (!chosen && pass === 1) { deferred.push(cand); continue; }
    if (!chosen && docs.has(dk0)) {
      // Même document déjà établi par une autre page : on essaie les unités
      // contre ses cellules (concordance à l'arrondi près).
      const doc = docs.get(dk0);
      let best = null;
      for (const m of [doc.unit, ...unitTrials].filter((x, i, a) => x && a.indexOf(x) === i)) {
        let matches = 0, mismatches = 0;
        const hit = [];
        for (const [k, cell] of cells) {
          const t = doc.cells.get(k);
          if (!t) continue;
          for (const [f, v] of Object.entries(cell.fields)) {
            if (t.fields[f] == null) continue;
            const tol = Math.max(m, t.precision[f]) * 0.6;
            if (Math.abs(v * m - t.fields[f]) <= Math.max(tol, Math.abs(t.fields[f]) * 0.015)) { matches++; hit.push(`${FIELD_FR[f]} ${cell.period.periode} ${cell.period.annee} (p. ${t.pages[f]} = p. ${cand.page})`); }
            else mismatches++;
          }
        }
        if (matches && !mismatches && (!best || matches > best.matches)) best = { m, matches, hit, how: 'recoupé' };
      }
      if (!best && !cand.unit_guess && doc.unit) best = { m: doc.unit, matches: 0, hit: [], how: 'unité du document' };
      chosen = best;
    }
    if (!chosen) {
      // Aucune référence en base : unité déclarée, contrôlée par l'ordre de
      // grandeur du CA/PNB face au dernier exercice connu (ou plausible seul).
      const m = cand.unit_guess;
      const ca = cells.get(key(ticker, latest.annee, latest.periode))?.fields.chiffre_affaires;
      const refAnnual = [...existing.values()]
        .filter(r => r.ticker === ticker && r.periode === 'annuel' && Number(r.chiffre_affaires) > 0)
        .sort((a, b) => b.annee - a.annee)[0];
      let ok = false;
      if (m && ca) {
        if (refAnnual) {
          const ratio = (ca * m) / (Number(refAnnual.chiffre_affaires) * PERIOD_FRACTION[latest.periode]);
          ok = ratio > 0.3 && ratio < 3;
        } else {
          const annualised = (ca * m) / PERIOD_FRACTION[latest.periode];
          ok = annualised > 5e8 && annualised < 5e12;
        }
      }
      if (!ok) {
        report.push({ page: cand.page, ticker, status: 'ignored', reason: 'unité indéterminée (rien à recouper en base)' });
        continue;
      }
      chosen = { m, matches: 0, hit: [], how: 'unité déclarée' };
    }

    const dk = key(ticker, latest.annee, latest.periode);
    if (!docs.has(dk)) docs.set(dk, { ticker, ent, latest, cells: new Map(), evidence: [], pages: [] });
    const doc = docs.get(dk);
    doc.pages.push(cand.page);
    doc.evidence.push(...chosen.hit.map(h => (h.includes("(p.") ? h : `${h} (${where})`)));
    for (const [k, cell] of cells) {
      if (!doc.cells.has(k)) doc.cells.set(k, { period: cell.period, fields: {}, precision: {}, pages: {} });
      const target = doc.cells.get(k);
      for (const [f, v] of Object.entries(cell.fields)) {
        const value = Math.round(v * chosen.m);
        const prev = target.fields[f];
        if (prev != null) {
          // Deux pages donnent la même valeur (à l'arrondi près) : concordance
          // (déjà comptée si la page a été recoupée contre ce document).
          const tol = Math.max(chosen.m, target.precision[f]) * 0.6;
          if (Math.abs(prev - value) <= Math.max(tol, Math.abs(prev) * 0.015)) {
            if (chosen.how !== 'recoupé' || pass === 1) doc.evidence.push(`${FIELD_FR[f]} ${cell.period.periode} ${cell.period.annee} (p. ${target.pages[f]} = ${where})`);
            if (chosen.m < target.precision[f]) { target.fields[f] = value; target.precision[f] = chosen.m; target.pages[f] = cand.page; }
          } else {
            target.conflicts = (target.conflicts || []).concat(`${FIELD_FR[f]} : ${prev} vs ${value}`);
          }
          continue;
        }
        target.fields[f] = value;
        target.precision[f] = chosen.m;
        target.pages[f] = cand.page;
      }
    }
    doc.unit = doc.unit ? Math.min(doc.unit, chosen.m) : chosen.m;
    doc.how = doc.how === 'recoupé' ? 'recoupé' : chosen.how;
  }

  // Lignes à écrire.
  const inserts = [];
  const promotions = [];
  for (const doc of docs.values()) {
    const { ticker, ent } = doc;
    const bank = /banq/i.test(ent.sous_secteur || '') || /bank|banque|boa /i.test(ent.nom || '');
    const actions = Number(ent.nombre_actions || ent.nb_actions) || null;
    for (const [k, cell] of doc.cells) {
      const { period } = cell;
      const isLatest = period.annee === doc.latest.annee && period.periode === doc.latest.periode;
      // Colonne de comparaison : seulement la même nature de période (S1 N-1
      // pour un S1 N), et avec au moins deux agrégats de résultat.
      if (!isLatest && (period.periode !== doc.latest.periode ||
          Object.keys(cell.fields).filter(f => FLOW.has(f)).length < 2)) continue;
      const fields = { ...cell.fields };
      const dropped = [];
      // Garde-fous d'ordre de grandeur face à la période comparable.
      const prevKey = key(ticker, period.annee - 1, period.periode);
      const prev = doc.cells.get(prevKey)?.fields || existing.get(prevKey) || {};
      const ref31 = doc.cells.get(key(ticker, period.annee - (period.periode === 'annuel' ? 1 : 1), 'annuel'))?.fields
        || existing.get(key(ticker, period.annee - 1, 'annuel')) || {};
      for (const f of Object.keys(fields)) {
        const v = fields[f];
        const ca = fields.chiffre_affaires;
        if (f !== 'chiffre_affaires' && FLOW.has(f) && ca && Math.abs(v) > Math.abs(ca) * 1.5) { dropped.push(f); continue; }
        if (f === 'chiffre_affaires' && v < 0) { dropped.push(f); continue; }
        if (FLOW.has(f) && f !== 'resultat_net' && prev[f] && Number(prev[f]) > 0) {
          const r = v / Number(prev[f]);
          if (!(r > 0.2 && r < 5)) { dropped.push(f); continue; }
        }
        if (STOCK.has(f)) {
          const base = Number(ref31[f] || prev[f]) || 0;
          if (v <= 0 || (base && !(v / base > 0.5 && v / base < 2))) { dropped.push(f); continue; }
        }
      }
      for (const f of dropped) delete fields[f];
      if (cell.conflicts?.length) {
        report.push({ ticker, annee: period.annee, periode: period.periode, status: 'review_needed', reason: `pages en désaccord : ${cell.conflicts.join(' ; ')}` });
      }
      if (Object.keys(fields).length < 2) continue;

      const stored = existing.get(k);
      const evidence = [...new Set(doc.evidence)];
      if (stored) {
        const diffs = [], same = [];
        for (const [f, v] of Object.entries(fields)) {
          if (stored[f] == null || !Number(stored[f])) continue;
          (close(v, Number(stored[f]), 0.02) ? same : diffs).push(f);
        }
        if (diffs.length) {
          report.push({ ticker, annee: period.annee, periode: period.periode, status: 'mismatch',
            reason: `déjà en base, écart sur ${diffs.map(f => FIELD_FR[f]).join(', ')} (non modifié)` });
        } else if (same.length >= 2 && stored.validation_status !== 'validated') {
          promotions.push({ id: stored.id, ticker, annee: period.annee, periode: period.periode,
            note: `Confirmé par le BOC du ${frDate(bocDate)} (${same.map(f => FIELD_FR[f]).join(', ')} identiques).` });
        } else {
          report.push({ ticker, annee: period.annee, periode: period.periode, status: 'already', reason: 'déjà en base (concorde)' });
        }
        continue;
      }
      const validated = isLatest && evidence.length >= 2;
      const rn = fields.resultat_net;
      const pagesTxt = [...new Set(Object.values(cell.pages))].sort((a, b) => a - b).join(', ');
      const unitTxt = { 1e9: 'milliards', 1e6: 'millions', 1e3: 'milliers', 1: 'unités' }[doc.unit] || String(doc.unit);
      inserts.push({
        row: {
          ticker, annee: period.annee, periode: period.periode, ...fields,
          bpa: rn != null && actions ? Math.round((rn / actions) * 100) / 100 : null,
          marge_nette: rn != null && fields.chiffre_affaires ? Math.round((rn / fields.chiffre_affaires) * 1000) / 10 : null,
          nb_actions: actions, nombre_actions: actions,
          devise: 'XOF', unite: 'FCFA', date_arrete: period.date_arrete, date_publication: bocDate,
          source: `BOC du ${frDate(bocDate)}, p. ${pagesTxt} (lecture automatique)`,
          source_url: bocUrl,
          validation_status: validated ? 'validated' : 'review',
          validated_at: validated ? new Date().toISOString() : null,
          validation_notes: [
            bank ? 'Banque : chiffre d\'affaires = produit net bancaire (PNB).' : null,
            `Lu automatiquement dans le BOC du ${frDate(bocDate)} (p. ${pagesTxt}), montants publiés en ${unitTxt} de FCFA.`,
            isLatest ? null : 'Colonne comparative du document.',
            evidence.length ? `Recoupé : ${evidence.slice(0, 6).join(' ; ')}.` : 'Aucun recoupement possible avec la base : à vérifier.',
            dropped.length ? `Écartés (ordre de grandeur incohérent) : ${dropped.map(f => FIELD_FR[f]).join(', ')}.` : null
          ].filter(Boolean).join(' ')
        },
        summary: { ticker, annee: period.annee, periode: period.periode, validated, fields: Object.keys(fields) }
      });
    }
  }
  return { inserts, promotions, report };
}

/** 6 131 800 226 -> « −6 132 M » */
function fmtM(v) {
  const n = Math.round(Number(v) / 1e6);
  return `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} M`;
}

export function frDate(iso) {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  return d ? `${d}/${m}/${y}` : String(iso || '');
}

export function bocPublicUrl(date) {
  return `https://bfin.brvm.org/boc/BOC_JOUR/BOC_${String(date).replace(/-/g, '')}.pdf`;
}

/** Texte du message Telegram récapitulatif. */
export function bocTelegramText({ bocDate, pagesTotal, pagesScanned, inserted, promotions, report }) {
  const lines = [`📰 BOC du ${frDate(bocDate)} analysé (${pagesTotal} pages, ${pagesScanned} scannées).`];
  const per = s => `${s.ticker} ${s.periode} ${s.annee}`;
  if (inserted.length) lines.push(`➕ Ajouté : ${inserted.map(s => `${per(s)}${s.validated ? ' ✅' : ' (à vérifier)'}`).join(', ')}`);
  if (promotions.length) lines.push(`✅ Confirmé : ${promotions.map(per).join(', ')}`);
  const handled = new Set([...inserted, ...promotions].map(s => s.ticker)
    .concat(report.filter(r => r.status === 'already').map(r => r.ticker)));
  // Un émetteur traité par ailleurs n'est pas signalé pour une page annexe
  // illisible ; un écart chiffré prime sur une lecture illisible.
  const issues = report.filter(r => ['mismatch', 'rejected', 'review_needed'].includes(r.status) &&
    !(r.status === 'rejected' && handled.has(r.ticker)));
  const precise = new Set(issues.filter(r => !/illisibles/.test(r.reason)).map(r => r.ticker));
  const shown = issues.filter((r, i) => !(/illisibles/.test(r.reason) &&
    (precise.has(r.ticker) || issues.findIndex(x => x.ticker === r.ticker && /illisibles/.test(x.reason)) !== i)));
  for (const r of shown) {
    lines.push(`⚠️ ${r.ticker || 'p. ' + r.page}${r.annee ? ` ${r.periode} ${r.annee}` : ''}${r.page ? ` (p. ${r.page})` : ''} : ${r.reason}`);
  }
  if (!inserted.length && !promotions.length && !shown.length) lines.push('Aucune nouvelle donnée financière.');
  return lines.join('\n');
}

/**
 * Exécute l'intégration contre Supabase.
 * @returns résumé (également enregistré dans boc_extractions)
 */
export async function ingestBoc(supabase, { bocDate, pagesTotal, pagesScanned, candidates }) {
  const { data: ents, error: e1 } = await supabase.from('entreprises')
    .select('ticker, nom, nom_court, sous_secteur, nombre_actions, nb_actions').eq('actif', true);
  if (e1) throw e1;
  const entreprises = (ents || []).map(e => ({ ...e, aliases: aliasesOf(e) }));

  // Tickers susceptibles d'être concernés : ceux reconnus dans les pages.
  const tickers = new Set();
  for (const c of candidates || []) {
    const who = resolveIssuer(c, entreprises);
    if (who?.ticker) tickers.add(who.ticker);
  }
  const existing = new Map();
  if (tickers.size) {
    const { data: rows, error: e2 } = await supabase.from('financials')
      .select(['id', 'ticker', 'annee', 'periode', 'validation_status', 'validation_notes', ...BOC_FIELDS].join(','))
      .in('ticker', [...tickers]);
    if (e2) throw e2;
    for (const r of rows || []) existing.set(key(r.ticker, r.annee, r.periode), r);
  }

  const plan = planBocIngest({ candidates, entreprises, existing, bocDate, bocUrl: bocPublicUrl(bocDate) });
  const inserted = [];
  const errors = [];
  for (const { row, summary } of plan.inserts) {
    const { data, error } = await supabase.from('financials')
      .upsert(row, { onConflict: 'ticker,annee,periode', ignoreDuplicates: true }).select('id');
    if (error) errors.push({ ...summary, error: error.message });
    else if (data?.length) inserted.push(summary);
  }
  const promoted = [];
  for (const p of plan.promotions) {
    const prev = existing.get(key(p.ticker, p.annee, p.periode));
    const { error } = await supabase.from('financials').update({
      validation_status: 'validated', validated_at: new Date().toISOString(),
      validation_notes: `${prev?.validation_notes || ''} ${p.note}`.trim()
    }).eq('id', p.id).neq('validation_status', 'validated');
    if (error) errors.push({ ...p, error: error.message }); else promoted.push(p);
  }
  return { inserted, promoted, report: plan.report, errors, candidates: (candidates || []).length };
}
