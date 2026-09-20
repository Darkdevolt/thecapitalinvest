// ═══════════════════════════════════════
// VIEW, États Financiers
// User-facing presentation layer: no raw database fields are exposed.
// ═══════════════════════════════════════

function finEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}

function finStatus(f) {
  const status = String(f?.validation_status || 'draft').toLowerCase();
  return ['validated','review','rejected','draft'].includes(status) ? status : 'draft';
}

function financialValidationBadge(f) {
  const status = finStatus(f);
  const labels = { validated:'Validé', review:'En revue', rejected:'Rejeté', draft:'En validation' };
  return `<span class="fin-status fin-status-${status}"><span class="fin-status-dot"></span>${labels[status]}</span>`;
}

function financialSourceLine(f) {
  const source = f?.source ? finEsc(f.source) : '';
  const url = f?.source_url ? String(f.source_url) : '';
  const page = f?.source_page != null ? finEsc(f.source_page) : '';
  if (!source && !url && !page) return `<div class="fin-source fin-source-missing"><span>Source</span><strong>En cours de renseignement</strong></div>`;
  const safeUrl = /^https?:\/\//i.test(url) ? url.replace(/"/g, '&quot;') : '';
  const link = safeUrl ? `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Voir la source ↗</a>` : '';
  return `<div class="fin-source"><span>Source</span><strong>${source || 'Document source'}</strong>${page ? `<em>p. ${page}</em>` : ''}${link}</div>`;
}

function finValue(value, unit = '') {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '—';
  return `${fmtM(value)}${unit ? ` ${unit}` : ''}`;
}

function finRatio(a,b, suffix='%') {
  const x=Number(a), y=Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y) || y===0) return '—';
  return `${(x/y*100).toFixed(1)}${suffix}`;
}

// Variation d'un poste par rapport à la période comparable précédente (même
// périodicité : annuel vs annuel, jamais annuel vs semestriel). Un écart de
// moins de 0.05 point est affiché neutre plutôt que faussement orienté par
// un arrondi.
function finGrowth(curr, prev) {
  const c = Number(curr), p = Number(prev);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return '';
  const pct = (c / p - 1) * 100;
  const cls = pct > 0.05 ? 'positive' : pct < -0.05 ? 'negative' : '';
  const arrow = pct > 0.05 ? '▲' : pct < -0.05 ? '▼' : '▬';
  return ` <small class="fin-delta ${cls}">${arrow} ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</small>`;
}

// Libellé d'une période. S1 et 9M sont des CUMULS depuis le 1er janvier, tels que
// publiés ; Q1…Q4 sont des trimestres isolés.
function finPeriodLabel(p) {
  const labels = { S1: 'S1 · cumul 6 mois', S2: 'S2', Q1: 'T1 · 3 mois', Q2: 'T2 isolé', Q3: 'T3 isolé', Q4: 'T4 isolé', '9M': 'T3 cumulé · 9 mois', TTM: '12 mois glissants' };
  return labels[String(p)] || String(p);
}

// Trimestre « réel » (isolé), déduit par soustraction de deux cumuls publiés la
// même année : T2 = S1 − T1, T3 = 9 mois − S1, T4 = annuel − 9 mois. Jamais stocké,
// toujours signalé comme déduit ; seuls les postes de flux du compte de résultat s'y prêtent.
// « Chiffre d'affaires », ou « Produit net bancaire » pour une banque (helper de score-maison.js).
function finCa(ticker, forme) {
  if (typeof window.tcCaLabel === 'function') return window.tcCaLabel(ticker, forme);
  return forme === 'court' ? 'CA' : forme === 'min' ? "chiffre d'affaires" : "Chiffre d'affaires";
}

function finIsolatedCard(f, fins) {
  const periode = String(f?.periode || 'annuel');
  const rule = { S1: ['Q1', 'Trimestre 2 isolé', 'S1 − T1'], '9M': ['S1', 'Trimestre 3 isolé', '9 mois − S1'], annuel: ['9M', 'Trimestre 4 isolé', 'annuel − 9 mois'] }[periode];
  if (!rule) return '';
  const base = (Array.isArray(fins) ? fins : []).find(x => Number(x.annee) === Number(f.annee) && String(x.periode) === rule[0]);
  if (!base) return '';
  const pick = (row, key) => key === 'rbe' ? (row.rbe ?? row.ebitda) : row[key];
  const diff = key => {
    const a = Number(pick(f, key)), b = Number(pick(base, key));
    return Number.isFinite(a) && Number.isFinite(b) ? a - b : null;
  };
  return finCard(`${rule[1]} (déduit : ${rule[2]})`, [
    [finCa(f.ticker), finValue(diff('chiffre_affaires'))],
    ['RBE', finValue(diff('rbe'))],
    ['Résultat net', finValue(diff('resultat_net'))]
  ]);
}

// Période comparable la plus récente avant f : même périodicité uniquement,
// pour ne jamais comparer un exercice annuel à un semestre.
function finPreviousPeriod(fins, f) {
  const periode = f.periode || 'annuel';
  const year = Number(f.annee);
  if (!Number.isFinite(year)) return null;
  return (Array.isArray(fins) ? fins : [])
    .filter(x => (x.periode || 'annuel') === periode && Number(x.annee) < year)
    .sort((a, b) => Number(b.annee) - Number(a.annee))[0] || null;
}

// Taux de distribution : la colonne payout_ratio est déjà calculée côté
// admin (public/admin/js/financials/financials-schema.js) ; même repli que
// dividend-screener.js quand elle est vide (dpa/bpa, sinon dpa×actions/RN).
function finPayoutRatio(f) {
  const stored = Number(f?.payout_ratio);
  if (Number.isFinite(stored)) return stored;
  const dpa = Number(f?.dpa), bpa = Number(f?.bpa), rn = Number(f?.resultat_net), actions = Number(f?.nombre_actions ?? f?.nb_actions);
  if (Number.isFinite(dpa) && Number.isFinite(bpa) && bpa > 0) return dpa / bpa * 100;
  if (Number.isFinite(dpa) && Number.isFinite(rn) && rn > 0 && actions) return (dpa * actions) / rn * 100;
  return null;
}

// Politique de dividende sur l'historique annuel complet du titre (pas
// seulement la période affichée) : régularité, taux de distribution moyen,
// dernière variation. N'existe que si au moins un exercice a un DPA publié
// -- une société qui n'a jamais versé de dividende n'a pas de "politique"
// à décrire.
function dividendPolicy(annualAsc) {
  const withDpa = (Array.isArray(annualAsc) ? annualAsc : []).filter(f => Number.isFinite(Number(f.dpa)));
  if (!withDpa.length) return null;

  let streak = 0, prevYear = null;
  for (let i = annualAsc.length - 1; i >= 0; i--) {
    const f = annualAsc[i];
    const dpa = Number(f.dpa);
    if (!Number.isFinite(dpa) || dpa <= 0) break;
    const year = Number(f.annee);
    if (prevYear != null && prevYear - year !== 1) break;
    streak++; prevYear = year;
  }

  const payouts = withDpa.map(finPayoutRatio).filter(Number.isFinite);
  const avgPayout = payouts.length ? payouts.reduce((a, b) => a + b, 0) / payouts.length : null;

  let lastChange = null;
  if (withDpa.length >= 2) {
    const d1 = Number(withDpa[withDpa.length - 1].dpa), d0 = Number(withDpa[withDpa.length - 2].dpa);
    if (d0 > 0) lastChange = (d1 / d0 - 1) * 100;
  }

  return { streak, avgPayout, lastChange, years: withDpa.length, series: withDpa.map(f => ({ annee: f.annee, dpa: Number(f.dpa) })) };
}

function dividendPolicyCard(policy) {
  if (!policy) return '';
  const notes = [];
  notes.push({ tone: policy.streak >= 3 ? 'positive' : policy.streak === 0 ? 'negative' : '', text: policy.streak > 0 ? `Dividende versé ${policy.streak} exercice(s) consécutif(s) sans interruption.` : `Dividende interrompu sur le dernier exercice disponible.` });
  if (policy.avgPayout != null) {
    notes.push({ tone: policy.avgPayout > 100 ? 'negative' : policy.avgPayout <= 60 ? 'positive' : '', text: `Taux de distribution moyen de ${policy.avgPayout.toFixed(1)} % sur ${policy.years} exercice(s) — repère usuel : ≤ 60 % soutenable, > 100 % distribue plus que le bénéfice.` });
  }
  if (policy.lastChange != null) {
    notes.push({ tone: policy.lastChange >= 0 ? 'positive' : 'negative', text: `Dividende par action ${policy.lastChange >= 0 ? 'en hausse' : 'en baisse'} de ${Math.abs(policy.lastChange).toFixed(1)} % sur le dernier exercice publié.` });
  }
  const chartHtml = policy.series.length > 1 ? '<div class="chart-container" style="height:180px;margin-bottom:16px"><canvas id="chartDividendPolicy"></canvas></div>' : '';
  return `<div class="card mb20"><div class="card-header"><div><div class="card-title">Politique de dividende</div><div class="fin-section-note">Sur l'historique annuel disponible du titre — pas seulement la période affichée ci-dessous.</div></div></div><div class="card-body">${chartHtml}<div class="fin-lecture" style="border-top:0;padding:0">${notes.map(n => `<p class="${n.tone}">${finEsc(n.text)}</p>`).join('')}</div></div></div>`;
}

function drawDividendPolicyChart(policy) {
  const canvas = document.getElementById('chartDividendPolicy');
  if (!canvas || !policy || policy.series.length < 2) return;
  new Chart(canvas, {
    type: 'bar',
    data: { labels: policy.series.map(s => s.annee), datasets: [{ label: 'DPA', data: policy.series.map(s => s.dpa), backgroundColor: 'rgba(63,201,138,0.30)', borderColor: 'rgba(63,201,138,0.65)', borderWidth: 1, borderRadius: 5 }] },
    options: { ...chartOpts, plugins: { ...chartOpts.plugins, legend: { display: false }, tooltip: { ...chartOpts.plugins.tooltip, callbacks: { label: ctx => ' ' + fmt(ctx.parsed.y) + ' FCFA' } } } }
  });
}

// Récapitulatif The Capital : objectif de la dernière note de recherche
// (comparé au cours du jour, pas au cours de référence historique de la
// note -- ce qui compte ici est "l'atteint-on aujourd'hui"), notation
// maison /100 (même moteur que Fiche titre : window.tcScoreMaison, voir
// public/app/js/score-maison.js -- valorisation/rentabilité/croissance/
// rendement/solidité, coché ✓/✗ par critère calculable), et un lien vers
// le rapport de recommandation complet (analyses.js) quand une note existe.
function recapTheCapitalCard(ticker, cp) {
  const analyseRows = (Array.isArray(window.allAnalyses) ? window.allAnalyses : []).filter(a => String(a?.ticker || '').toUpperCase() === String(ticker).toUpperCase());
  const latestAnalyse = analyseRows.length ? analyseRows.slice().sort((a, b) => Date.parse(b.date_analyse || 0) - Date.parse(a.date_analyse || 0))[0] : null;

  const objectifNotes = [];
  if (latestAnalyse && typeof analyseTarget === 'function') {
    const target = analyseTarget(latestAnalyse);
    if (target != null) {
      const hasPrice = Number.isFinite(cp) && cp > 0;
      const potential = hasPrice ? (target / cp - 1) * 100 : null;
      const type = typeof analyseRecType === 'function' ? analyseRecType(latestAnalyse.recommandation) : 'hold';
      const reached = hasPrice && ((type === 'buy' && cp >= target) || (type === 'sell' && cp <= target));
      objectifNotes.push({ tone: reached ? 'positive' : '', text: `Objectif de cours de ${fmt(target)} FCFA${hasPrice ? ` vs cours actuel de ${fmt(cp)} FCFA` : ''}${reached ? ' — déjà atteint.' : '.'}` });
      if (potential != null) {
        objectifNotes.push({ tone: potential >= 0 ? 'positive' : 'negative', text: `Potentiel restant de ${potential >= 0 ? '+' : ''}${potential.toFixed(1)} % par rapport au cours actuel.` });
      }
    }
  }

  let scoreHtml = '';
  if (typeof window.tcScoreMaison === 'function') {
    const sc = window.tcScoreMaison(ticker);
    if (sc.score != null) {
      scoreHtml = `
        <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:${objectifNotes.length ? '16px' : '0'} 0 14px">
          <span style="font-family:var(--serif);font-size:40px;line-height:1;color:var(--cream)">${sc.score}</span>
          <span style="color:var(--dim)">/ 100</span>
          <b style="color:var(--gold);font-size:15px">${finEsc(sc.label)}</b>
        </div>
        <div class="table-wrap"><table class="forecast-table"><thead><tr><th>Critère</th><th>Statut</th><th class="right">Points</th><th>Lecture</th></tr></thead><tbody>
          ${sc.components.map(c => {
            const ratio = c.pts == null ? null : c.pts / c.max;
            const tone = ratio == null ? { icon: '—', cls: '' } : ratio >= 0.6 ? { icon: '✓', cls: 'positive' } : ratio < 0.35 ? { icon: '✗', cls: 'negative' } : { icon: '~', cls: '' };
            return `<tr><td>${finEsc(c.l)}</td><td class="${tone.cls}">${tone.icon}</td><td class="right">${c.pts == null ? '—' : c.pts.toFixed(1) + ' / ' + c.max}</td><td style="color:var(--dim)">${finEsc(c.detail)}</td></tr>`;
          }).join('')}
        </tbody></table></div>
        <p style="font-size:10.5px;color:var(--dim);margin-top:10px">Pondération valorisation 25 · rentabilité 25 · croissance 20 · rendement 15 · solidité 15, ramenée sur 100 en ne comptant que les critères calculables depuis la base. Ceci n'est pas un conseil d'investissement.</p>`;
    }
  }

  if (!objectifNotes.length && !scoreHtml) return '';

  // analyses.id est un UUID (Supabase) : jamais Number(id) (voir
  // recommendations-fixes.js, qui a déjà dû corriger ce même piège dans
  // analyses.js -- Number(uuid) vaut NaN et rend la fiche inaccessible).
  const reportHtml = latestAnalyse && typeof window.openAnalyseDetail === 'function'
    ? `<div style="margin-top:14px"><button type="button" class="fin-detail-btn" onclick="openAnalyseDetail('${finEsc(latestAnalyse.id)}')">Voir le rapport de recommandation complet →</button></div>`
    : '';
  const dateLabel = latestAnalyse?.date_analyse ? fmtDate(latestAnalyse.date_analyse) : null;
  const noteText = dateLabel
    ? `Dernière note du ${finEsc(dateLabel)} — ${finEsc(latestAnalyse.recommandation || '—')}${latestAnalyse.analyste ? ` par ${finEsc(latestAnalyse.analyste)}` : ''}.`
    : 'Notation calculée automatiquement à partir des états financiers et de la dernière cotation disponibles.';

  return `<div class="card mb20"><div class="card-header"><div><div class="card-title">Récapitulatif The Capital</div><div class="fin-section-note">${noteText}</div></div></div><div class="card-body">${objectifNotes.length ? `<div class="fin-lecture" style="border-top:0;padding:0">${objectifNotes.map(n => `<p class="${n.tone}">${finEsc(n.text)}</p>`).join('')}</div>` : ''}${scoreHtml}${reportHtml}</div></div>`;
}

// Lecture automatique, uniquement à partir de ratios réellement calculables
// (aucune valeur inventée). Les repères cités sont volontairement explicites
// dans le texte plutôt qu'un verdict opaque.
function finLecture(f, prev) {
  const notes = [];
  const ca = Number(f.chiffre_affaires), caPrev = Number(prev?.chiffre_affaires);
  if (Number.isFinite(ca) && Number.isFinite(caPrev) && caPrev !== 0) {
    const g = (ca / caPrev - 1) * 100;
    notes.push({ tone: g >= 0 ? 'positive' : 'negative', text: `${finCa(f.ticker)} ${g >= 0 ? 'en hausse' : 'en baisse'} de ${Math.abs(g).toFixed(1)} % sur la période précédente.` });
  }
  const rn = Number(f.resultat_net), chiffreAffaires = Number(f.chiffre_affaires);
  if (Number.isFinite(rn) && Number.isFinite(chiffreAffaires) && chiffreAffaires !== 0) {
    const marge = rn / chiffreAffaires * 100;
    notes.push({ tone: marge < 0 ? 'negative' : marge >= 10 ? 'positive' : '', text: `Marge nette de ${marge.toFixed(1)} %${marge < 0 ? ' (perte sur la période)' : marge >= 10 ? ' — repère usuel : ≥ 10 % confortable' : ''}.` });
  }
  const fondsPropres = Number(f.fonds_propres);
  if (Number.isFinite(rn) && Number.isFinite(fondsPropres) && fondsPropres > 0) {
    const roe = rn / fondsPropres * 100;
    notes.push({ tone: roe < 5 ? 'negative' : roe >= 12 ? 'positive' : '', text: `ROE de ${roe.toFixed(1)} % — repère usuel : ≥ 12 % bon, < 5 % faible.` });
  }
  const dettes = Number(f.dettes_financieres);
  if (Number.isFinite(dettes) && Number.isFinite(fondsPropres) && fondsPropres > 0) {
    const levier = dettes / fondsPropres;
    notes.push({ tone: levier > 2 ? 'negative' : levier <= 1 ? 'positive' : '', text: `Dette financière / fonds propres de ${levier.toFixed(2)}x — repère usuel : ≤ 1x prudent, > 2x élevé.` });
  }
  const payout = finPayoutRatio(f);
  if (payout != null) {
    notes.push({ tone: payout > 100 ? 'negative' : payout <= 60 ? 'positive' : '', text: `Taux de distribution de ${payout.toFixed(1)} % du bénéfice — repère usuel : ≤ 60 % soutenable, > 100 % distribue plus que le résultat net de la période.` });
  }
  return notes;
}

function finMetric(label, value, note='') {
  return `<div class="fin-metric"><span>${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ''}</div>`;
}

function finCard(title, rows) {
  const valid = rows.filter(([,v]) => v !== '—');
  if (!valid.length) return '';
  return `<section class="fin-detail-card"><h4>${title}</h4>${valid.map(([l,v,d]) => `<div class="fin-row"><span class="fin-label">${l}</span><span class="fin-value">${v}${d || ''}</span></div>`).join('')}</section>`;
}

function renderFinancials() {
  const byTicker = {};
  (Array.isArray(allFinancials) ? allFinancials : []).forEach(f => {
    if (!f?.ticker || finStatus(f) === 'rejected') return;
    const t = String(f.ticker).toUpperCase();
    if (!byTicker[t]) byTicker[t] = [];
    byTicker[t].push(f);
  });
  Object.values(byTicker).forEach(list => list.sort((a,b) => Number(b.annee||0)-Number(a.annee||0)));
  window._finByTicker = byTicker;
  window._finTickers = Object.keys(byTicker).sort();
  filterFin();
}

function filterFin() {
  const q = (document.getElementById('searchFin')?.value || '').trim().toLowerCase();
  const tickers = (window._finTickers || []).filter(t => !q || t.toLowerCase().includes(q));
  const byTicker = window._finByTicker || {};
  const container = document.getElementById('finGrid');
  if (!container) return;

  if (!tickers.length) {
    container.innerHTML = `<div class="fin-empty"><div class="fin-empty-icon">⌕</div><h3>Aucun titre trouvé</h3><p>Essayez un autre ticker.</p></div>`;
    return;
  }

  const total = tickers.length;
  const validated = tickers.filter(t => finStatus(byTicker[t][0]) === 'validated').length;
  const inReview = tickers.filter(t => ['review','draft'].includes(finStatus(byTicker[t][0]))).length;
  const noSource = tickers.filter(t => !byTicker[t][0]?.source && !byTicker[t][0]?.source_url).length;

  container.innerHTML = `
    <div class="fin-overview">
      <div class="fin-overview-copy"><span class="fin-kicker">DONNÉES FINANCIÈRES</span><h2>Les fondamentaux, enfin lisibles.</h2><p>Résultats, bilan, ratios et évolution présentés dans un format conçu pour la décision, pas pour la lecture d'une base de données.</p></div>
      <div class="fin-overview-stats">
        ${finMetric('Titres', total)}
        ${finMetric('Validés', validated)}
        ${finMetric('En validation', inReview)}
        ${finMetric('Sources à compléter', noSource)}
      </div>
    </div>
    <div class="fin-trust-note"><span>●</span><div><strong>Transparence des données</strong><p>Un indicateur marqué « En validation » est présenté à titre informatif et n'est pas encore certifié par l'équipe The Capital.</p></div></div>
    <div class="fin-grid-list">${tickers.map(ticker => renderFinancialTicker(ticker, byTicker[ticker])).join('')}</div>`;
}

function renderFinancialTicker(ticker, fins) {
  const latest = fins[0];
  const prev = fins[1];
  const ent = (Array.isArray(allEntreprises) ? allEntreprises : []).find(e => String(e?.ticker||'').toUpperCase()===ticker) || {};
  const company = finEsc(ent.nom || ent.raison_sociale || ticker);
  const rn = Number(latest?.resultat_net);
  const prevRn = Number(prev?.resultat_net);
  const growth = Number.isFinite(rn) && Number.isFinite(prevRn) && prevRn !== 0 ? ((rn-prevRn)/Math.abs(prevRn)*100) : null;
  const annual = !latest.periode || latest.periode === 'annuel';
  const period = annual ? 'Exercice annuel' : finEsc(latest.periode);
  const status = finStatus(latest);
  const confidence = status === 'validated' ? 'Donnée validée' : status === 'review' ? 'Contrôle éditorial en cours' : 'Donnée en cours de validation';

  return `<article class="fin-company-card">
    <div class="fin-company-head" onclick="openFinDetail('${finEsc(ticker)}')">
      <div class="fin-company-id"><span class="fin-ticker">${finEsc(ticker)}</span><h3>${company}</h3><span class="fin-period">${period} · ${finEsc(latest.annee)}</span></div>
      <div class="fin-company-status">${financialValidationBadge(latest)}<span class="fin-open">Voir l'analyse →</span></div>
    </div>
    <div class="fin-key-grid">
      ${finMetric(finCa(ticker), finValue(latest.chiffre_affaires), `Exercice ${finEsc(latest.annee)}`)}
      ${finMetric('Résultat net', finValue(latest.resultat_net), growth === null ? confidence : `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% vs exercice précédent`)}
      <div class="pro-only">${finMetric('BPA', latest.bpa != null ? `${fmt(latest.bpa)} FCFA` : '—', 'Bénéfice par action')}</div>
      ${finMetric('Marge nette', finRatio(latest.resultat_net, latest.chiffre_affaires), `Résultat net / ${finCa(ticker, 'court')}`)}
      ${finMetric('Dividende par action', latest.dpa != null ? `${fmt(latest.dpa)} FCFA` : '—', 'DPA disponible en base')}
    </div>
    <div class="fin-company-foot pro-only">${financialSourceLine(latest)}<button class="fin-detail-btn" onclick="event.stopPropagation();openFinDetail('${finEsc(ticker)}')">Explorer les états financiers</button></div>
  </article>`;
}

function openFinDetail(ticker) {
  nav('financials-detail');
  history.replaceState(null, '', '#financials-detail');
  const fins = [...(window._finByTicker?.[ticker] || [])].sort((a,b) => Number(b.annee||0)-Number(a.annee||0));
  const ent = (Array.isArray(allEntreprises) ? allEntreprises : []).find(e => String(e?.ticker||'').toUpperCase()===String(ticker).toUpperCase()) || {};
  const cours = (Array.isArray(allCours) ? allCours : []).find(c => String(c?.ticker||'').toUpperCase()===String(ticker).toUpperCase()) || {};
  const cp = Number(cours.cours);
  const company = finEsc(ent.nom || ent.raison_sociale || ticker);
  const periods = [...new Set(fins.map(f => `${f.annee}${f.periode && f.periode !== 'annuel' ? ' '+f.periode : ''}`))];
  const latest = fins[0] || {};

  const annual = fins.filter(f => f.periode === 'annuel' || !f.periode);
  const policy = dividendPolicy([...annual].reverse());
  const policyHtml = dividendPolicyCard(policy);
  const researchHtml = recapTheCapitalCard(ticker, cp);
  const interimCount = fins.length - annual.length;

  const detail = document.getElementById('finDetailContent');
  if (!detail) return;
  detail.innerHTML = `
    <button class="back-btn" onclick="nav('financials')">← Retour aux états financiers</button>
    <div class="fin-detail-hero">
      <div><span class="fin-kicker">FICHE FINANCIÈRE · ${finEsc(ticker)}</span><h1>${company}</h1><p>Lecture structurée des comptes disponibles, période par période.</p></div>
      <div class="fin-detail-price"><span>Cours disponible</span><strong>${Number.isFinite(cp) && cp ? fmt(cp)+' FCFA' : '—'}</strong><small>Dernière cotation disponible</small></div>
    </div>
    <div class="fin-detail-trust">${financialValidationBadge(latest)}<span>${finStatus(latest)==='validated' ? 'Les données affichées sont validées.' : 'Certaines données sont encore en validation éditoriale.'}</span></div>
    ${researchHtml}
    <div class="card mb20"><div class="card-header"><div><div class="card-title">Évolution du ${finCa(ticker, 'min')} et du résultat net</div><div class="fin-section-note">${interimCount > 0 ? `Exercices annuels ci-dessous · ${interimCount} publication(s) infra-annuelle(s) (semestre/trimestre) dans le détail par période.` : 'Historique disponible dans la base The Capital. Aucune publication semestrielle ou trimestrielle enregistrée pour ce titre : le détail par période reste annuel.'}</div></div></div><div class="card-body"><div class="chart-container tall"><canvas id="chartFinEvolution"></canvas></div></div></div>
    ${policyHtml}
    <div id="finDetailPeriods"></div>`;

  drawDividendPolicyChart(policy);

  const evolLabels = annual.map(f=>f.annee).reverse();
  const evolCA = annual.map(f=>f.chiffre_affaires).reverse();
  const evolData = annual.map(f=>f.resultat_net).reverse();
  const canvas = document.getElementById('chartFinEvolution');
  if (canvas && evolLabels.length > 1) {
    new Chart(canvas,{type:'bar',data:{labels:evolLabels,datasets:[
      {label:finCa(ticker),data:evolCA,backgroundColor:'rgba(96,165,250,0.28)',borderColor:'rgba(96,165,250,0.65)',borderWidth:1,borderRadius:5},
      {label:'Résultat net',data:evolData,backgroundColor:'rgba(184,150,78,0.30)',borderColor:'rgba(184,150,78,0.65)',borderWidth:1,borderRadius:5}
    ]},options:{...chartOpts,plugins:{...chartOpts.plugins,legend:{display:true},tooltip:{...chartOpts.plugins.tooltip,callbacks:{label:ctx=>' '+ctx.dataset.label+' : '+fmtM(ctx.parsed.y)}}}}});
  } else if (canvas) {
    canvas.parentElement.innerHTML='<div class="fin-chart-empty">Pas assez d\'historique pour afficher une tendance.</div>';
  }

  const container = document.getElementById('finDetailPeriods');
  if (!container) return;
  container.innerHTML = fins.map(f => {
    const title = !f.periode || f.periode==='annuel' ? `${finEsc(f.annee)} · Annuel` : `${finEsc(f.annee)} · ${finEsc(finPeriodLabel(f.periode))}`;
    const prev = finPreviousPeriod(fins, f);
    const lecture = finLecture(f, prev);
    const sections = [
      finCard('Compte de résultat', [
        [finCa(ticker),finValue(f.chiffre_affaires),finGrowth(f.chiffre_affaires,prev?.chiffre_affaires)],
        ['RBE',finValue(f.rbe ?? f.ebitda),finGrowth(f.rbe ?? f.ebitda,prev?.rbe ?? prev?.ebitda)],
        ['Résultat net',finValue(f.resultat_net),finGrowth(f.resultat_net,prev?.resultat_net)],
        ['BPA',f.bpa!=null?fmt(f.bpa)+' FCFA': '—',finGrowth(f.bpa,prev?.bpa)],
        ['DPA',f.dpa!=null?fmt(f.dpa)+' FCFA': '—',finGrowth(f.dpa,prev?.dpa)]
      ]),
      finCard('Bilan', [
        ['Total actif',finValue(f.total_actif),finGrowth(f.total_actif,prev?.total_actif)],
        ['Fonds propres',finValue(f.fonds_propres),finGrowth(f.fonds_propres,prev?.fonds_propres)],
        ['Dettes financières',finValue(f.dettes_financieres),finGrowth(f.dettes_financieres,prev?.dettes_financieres)]
      ]),
      finCard('Flux de trésorerie', [['Cash-flow opérationnel',finValue(f.cash_flow_operationnel)],['CAPEX',finValue(f.capex)]]),
      finCard('Ratios clés', [['Marge nette',finRatio(f.resultat_net,f.chiffre_affaires)],['ROE',finRatio(f.resultat_net,f.fonds_propres)],['ROA',finRatio(f.resultat_net,f.total_actif)],['Dette / fonds propres',f.dettes_financieres!=null&&f.fonds_propres?((Number(f.dettes_financieres)/Number(f.fonds_propres)).toFixed(2)+'x'): '—'],['P/E',f.bpa!=null&&Number(f.bpa)>0&&Number.isFinite(cp)?(cp/Number(f.bpa)).toFixed(1)+'x': '—']]),
      finCard('Dividende', [['Rendement du dividende',f.dpa!=null&&cp>0?((Number(f.dpa)/cp)*100).toFixed(2)+'%': '—'],['Taux de distribution (payout)',finPayoutRatio(f)!=null?finPayoutRatio(f).toFixed(1)+'%': '—',finGrowth(finPayoutRatio(f),finPayoutRatio(prev))]]),
      finIsolatedCard(f, fins)
    ].join('');
    const lectureHtml = lecture.length
      ? `<div class="fin-lecture"><h4>Lecture automatique</h4>${lecture.map(n => `<p class="${n.tone}">${finEsc(n.text)}</p>`).join('')}</div>`
      : '';
    return `<article class="fin-period-card"><div class="fin-period-head"><div><span class="fin-period-label">PÉRIODE</span><h3>${title}</h3></div>${financialValidationBadge(f)}</div><div class="fin-period-grid">${sections}</div>${lectureHtml}${financialSourceLine(f)}</article>`;
  }).join('');
}