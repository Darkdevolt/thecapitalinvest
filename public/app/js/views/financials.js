// ═══════════════════════════════════════
// VIEW — États Financiers
// ═══════════════════════════════════════

function financialValidationBadge(f) {
  const status = String(f?.validation_status || 'draft').toLowerCase();
  const labels = { validated: 'Validé', review: 'En revue', rejected: 'Rejeté', draft: 'Brouillon' };
  const label = labels[status] || status;
  const style = {
    validated: 'color:#6fbf8f;border-color:rgba(111,191,143,.35);background:rgba(111,191,143,.08)',
    review: 'color:var(--gold);border-color:rgba(184,150,78,.35);background:rgba(184,150,78,.08)',
    rejected: 'color:#d98282;border-color:rgba(217,130,130,.35);background:rgba(217,130,130,.08)',
    draft: 'color:var(--dim);border-color:rgba(255,255,255,.12);background:rgba(255,255,255,.03)'
  }[status] || 'color:var(--dim);border-color:rgba(255,255,255,.12);background:rgba(255,255,255,.03)';
  return `<span style="display:inline-flex;align-items:center;padding:3px 7px;border:1px solid;border-radius:999px;font-size:10px;${style}">${label}</span>`;
}

function financialSourceLine(f) {
  const source = f?.source ? String(f.source) : '';
  const url = f?.source_url ? String(f.source_url) : '';
  const page = f?.source_page != null ? String(f.source_page) : '';
  if (!source && !url && !page) return '<div style="font-size:10px;color:var(--dim);margin-top:8px">Source : non renseignée</div>';
  const safeUrl = /^https?:\/\//i.test(url) ? url.replace(/"/g, '&quot;') : '';
  const link = safeUrl ? ` · <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--gold)">source</a>` : '';
  const pageLabel = page ? ` · p. ${page}` : '';
  return `<div style="font-size:10px;color:var(--dim);margin-top:8px">Source : ${source || 'non renseignée'}${pageLabel}${link}</div>`;
}

// ═══════════════════════════════════════
// FINANCIALS
// ═══════════════════════════════════════
function renderFinancials() {
  const byTicker = {};
  allFinancials.forEach(f => { if (!byTicker[f.ticker]) byTicker[f.ticker] = []; byTicker[f.ticker].push(f); });
  window._finByTicker = byTicker;
  window._finTickers = Object.keys(byTicker).sort();
  filterFin();
}

function filterFin() {
  const q = (document.getElementById('searchFin')?.value || '').toLowerCase();
  const tickers = (window._finTickers || []).filter(t => !q || t.toLowerCase().includes(q));
  const byTicker = window._finByTicker || {};
  const container = document.getElementById('finGrid');
  if (!tickers.length) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">≡</div><div class="empty-title">Aucun résultat</div><div class="empty-text">Vérifiez vos données Supabase</div></div>'; return; }
  container.innerHTML = tickers.map(ticker => {
    const fins = (byTicker[ticker]||[]).sort((a,b) => b.annee - a.annee);
    const latest = fins[0]; const prev = fins[1];
    if (!latest) return '';
    const growthRN = (latest.resultat_net != null && prev?.resultat_net != null && prev.resultat_net !== 0)
      ? ((latest.resultat_net - prev.resultat_net) / Math.abs(prev.resultat_net) * 100).toFixed(1) : null;
    const periodeLabel = latest.periode && latest.periode !== 'annuel' ? ` · ${latest.periode}` : '';
    return `<div class="card" style="margin-bottom:16px">
      <div class="card-header" style="cursor:pointer" onclick="openFinDetail('${ticker}')">
        <div>
          <div style="font-family:var(--mono);font-size:11px;color:var(--gold);margin-bottom:2px">${ticker}</div>
          <div class="card-title">Dernier exercice : ${latest.annee}${periodeLabel}</div>
          <div style="display:flex;gap:7px;align-items:center;margin-top:6px">${financialValidationBadge(latest)}${latest.validation_status !== 'validated' ? '<span style="font-size:10px;color:var(--dim)">Donnée non validée</span>' : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          ${growthRN !== null ? `<span class="pill ${parseFloat(growthRN)>=0?'up':'down'}">${parseFloat(growthRN)>=0?'▲':'▼'} ${Math.abs(growthRN)}% RN</span>` : ''}
          <span style="font-size:11px;color:var(--gold)">Détail →</span>
        </div>
      </div>
      <div class="card-body">
        <div class="fin-detail-grid">
          <div class="fin-detail-card"><h4>Résultats</h4>
            <div class="fin-row"><span class="fin-label">CA</span><span class="fin-value">${fmtM(latest.chiffre_affaires)}</span></div>
            <div class="fin-row"><span class="fin-label">Résultat Net</span><span class="fin-value">${fmtM(latest.resultat_net)}</span></div>
            <div class="fin-row"><span class="fin-label">BPA</span><span class="fin-value">${latest.bpa ? fmt(latest.bpa) : '—'}</span></div>
          </div>
          <div class="fin-detail-card"><h4>Bilan</h4>
            <div class="fin-row"><span class="fin-label">Total Actif</span><span class="fin-value">${fmtM(latest.total_actif)}</span></div>
            <div class="fin-row"><span class="fin-label">Fonds Propres</span><span class="fin-value">${fmtM(latest.fonds_propres)}</span></div>
            <div class="fin-row"><span class="fin-label">Dettes</span><span class="fin-value">${fmtM(latest.dettes_financieres)}</span></div>
          </div>
          <div class="fin-detail-card"><h4>Ratios</h4>
            <div class="fin-row"><span class="fin-label">Marge nette</span><span class="fin-value">${latest.resultat_net != null && latest.chiffre_affaires != null && latest.chiffre_affaires !== 0 ? ((latest.resultat_net/latest.chiffre_affaires)*100).toFixed(2)+'%' : '—'}</span></div>
            <div class="fin-row"><span class="fin-label">ROE</span><span class="fin-value">${latest.resultat_net != null && latest.fonds_propres != null && latest.fonds_propres !== 0 ? ((latest.resultat_net/latest.fonds_propres)*100).toFixed(2)+'%' : '—'}</span></div>
            <div class="fin-row"><span class="fin-label">ROA</span><span class="fin-value">${latest.resultat_net != null && latest.total_actif != null && latest.total_actif !== 0 ? ((latest.resultat_net/latest.total_actif)*100).toFixed(2)+'%' : '—'}</span></div>
          </div>
        </div>
        ${financialSourceLine(latest)}
      </div>
    </div>`;
  }).join('');
}

function openFinDetail(ticker) {
  nav('financials-detail');
  history.replaceState(null, '', '#financials-detail');
  const fins = (window._finByTicker[ticker] || []).sort((a,b) => b.annee - a.annee);
  const ent = allEntreprises.find(e => e.ticker === ticker) || {};
  const cours = allCours.find(c => c.ticker === ticker) || {};
  const cp = parseFloat(cours.cours);

  const periods = [...new Set(fins.map(f => f.annee + (f.periode && f.periode !== 'annuel' ? ' ' + f.periode : '')))];

  document.getElementById('finDetailContent').innerHTML = `
    <div class="fiche-hero" style="margin-bottom:20px">
      <div class="fiche-ticker-label">${ticker}</div>
      <div class="fiche-company">${ent.nom || ticker}</div>
      <div class="fiche-meta">États financiers détaillés — ${periods.length} période(s) disponible(s)</div>
    </div>
    <div class="card mb20">
      <div class="card-header"><div class="card-title">Évolution du résultat net</div></div>
      <div class="card-body"><div class="chart-container tall"><canvas id="chartFinEvolution"></canvas></div></div>
    </div>
    <div id="finDetailPeriods"></div>
  `;

  const evolLabels = fins.filter(f => f.periode === 'annuel' || !f.periode).map(f => f.annee).reverse();
  const evolData = fins.filter(f => f.periode === 'annuel' || !f.periode).map(f => f.resultat_net).reverse();
  if (evolLabels.length > 1) {
    new Chart(document.getElementById('chartFinEvolution'), {
      type: 'bar',
      data: { labels: evolLabels, datasets: [{ data: evolData, backgroundColor: 'rgba(184,150,78,0.3)', borderColor: 'rgba(184,150,78,0.6)', borderWidth: 1, borderRadius: 4 }] },
      options: { ...chartOpts, plugins: { ...chartOpts.plugins, tooltip: { ...chartOpts.plugins.tooltip, callbacks: { label: ctx => ' ' + fmtM(ctx.parsed.y) } } } }
    });
  } else {
    document.getElementById('chartFinEvolution').parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--dim)">Pas assez de données pour un graphique</div>';
  }

  const container = document.getElementById('finDetailPeriods');
  container.innerHTML = fins.map((f, i) => {
    const periodeTitle = f.periode && f.periode !== 'annuel' ? `${f.annee} — ${f.periode.charAt(0).toUpperCase() + f.periode.slice(1)}` : `${f.annee} — Annuel`;
    const sections = [
      ['COMPTE DE RÉSULTAT', [["Chiffre d'affaires", fmtM(f.chiffre_affaires)], ["RBE", fmtM(f.rbe)], ["Résultat Net", fmtM(f.resultat_net)], ["BPA", f.bpa ? fmt(f.bpa)+' FCFA' : '—'], ["DPA", f.dpa ? fmt(f.dpa)+' FCFA' : '—']]],
      ['BILAN', [["Total Actif", fmtM(f.total_actif)], ["Fonds Propres", fmtM(f.fonds_propres)], ["Dettes Financières", fmtM(f.dettes_financieres)]]],
      ['FLUX DE TRÉSORERIE', [["Cash-flow Opérationnel", fmtM(f.cash_flow_operationnel)], ["CAPEX", fmtM(f.capex)]]],
      ['RATIOS', [["Marge nette", f.resultat_net != null && f.chiffre_affaires != null && f.chiffre_affaires !== 0 ? ((f.resultat_net/f.chiffre_affaires)*100).toFixed(2)+'%' : '—'], ["ROE", f.resultat_net != null && f.fonds_propres != null && f.fonds_propres !== 0 ? ((f.resultat_net/f.fonds_propres)*100).toFixed(2)+'%' : '—'], ["ROA", f.resultat_net != null && f.total_actif != null && f.total_actif !== 0 ? ((f.resultat_net/f.total_actif)*100).toFixed(2)+'%' : '—'], ["Dette / FP", f.dettes_financieres != null && f.fonds_propres != null && f.fonds_propres !== 0 ? (f.dettes_financieres/f.fonds_propres).toFixed(2)+'x' : '—'], ["P/E", f.bpa != null && f.bpa > 0 && cp ? (cp/f.bpa).toFixed(1)+'x' : '—'], ["Div. Yield", f.dpa != null && cp && cp > 0 ? ((f.dpa/cp)*100).toFixed(2)+'%' : '—']]]
    ];
    return `<div class="card mb20">
      <div class="card-header"><div class="card-title">${periodeTitle}</div><div>${financialValidationBadge(f)}</div></div>
      <div class="card-body">
        <div class="fin-detail-grid">
          ${sections.map(([title, rows]) => {
            const valid = rows.filter(([,v]) => v !== '—');
            if (!valid.length) return '';
            return `<div class="fin-detail-card"><h4>${title}</h4>${valid.map(([l,v]) => `<div class="fin-row"><span class="fin-label">${l}</span><span class="fin-value">${v}</span></div>`).join('')}</div>`;
          }).join('')}
        </div>
        ${financialSourceLine(f)}
      </div>
    </div>`;
  }).join('');
}