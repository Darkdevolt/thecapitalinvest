// THE CAPITAL — Fundamental comparison (2 to 4 companies)
(function () {
  if (window.__TC_COMPARISON_LOADED__) return;
  window.__TC_COMPARISON_LOADED__ = true;

  const esc = value => {
    const d = document.createElement('div'); d.textContent = value == null ? '' : String(value); return d.innerHTML;
  };
  const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const fmt = value => value == null ? 'Donnée non disponible' : Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  const pct = value => value == null ? 'Donnée non disponible' : `${Number(value).toFixed(2)} %`;

  function latestByTicker(ticker) {
    const rows = (Array.isArray(window.allFinancials) ? window.allFinancials : []).filter(x => x.ticker === ticker).sort((a,b) => Number(b.annee || 0) - Number(a.annee || 0));
    return rows[0] || null;
  }

  function companyName(ticker) {
    const e = (Array.isArray(window.allEntreprises) ? window.allEntreprises : []).find(x => x.ticker === ticker);
    return e?.nom || e?.nom_court || ticker;
  }

  function metric(fin, ticker, key) {
    if (!fin) return null;
    if (key === 'pe') {
      const price = (Array.isArray(window.allCours) ? window.allCours : []).find(x => x.ticker === ticker)?.cours;
      return fin.bpa && Number(fin.bpa) > 0 && price != null ? Number(price) / Number(fin.bpa) : null;
    }
    if (key === 'roe') return num(fin.roe) ?? (fin.resultat_net && fin.fonds_propres ? Number(fin.resultat_net) / Number(fin.fonds_propres) * 100 : null);
    if (key === 'yield') return num(fin.dividend_yield) ?? num(fin.rendement_dividende);
    if (key === 'debt') return num(fin.dette_nette) ?? num(fin.dette_fin) ?? num(fin.dettes_financieres);
    return null;
  }

  function growthCA(ticker) {
    const rows = (Array.isArray(window.allFinancials) ? window.allFinancials : []).filter(x => x.ticker === ticker).sort((a,b) => Number(b.annee || 0) - Number(a.annee || 0));
    if (rows.length < 2 || rows[0].chiffre_affaires == null || rows[1].chiffre_affaires == null || Number(rows[1].chiffre_affaires) === 0) return null;
    return (Number(rows[0].chiffre_affaires) / Number(rows[1].chiffre_affaires) - 1) * 100;
  }

  function renderComparison() {
    const view = document.getElementById('view-comparison');
    if (!view) return;
    const companies = (Array.isArray(window.allEntreprises) ? window.allEntreprises : []).filter(x => x.actif !== false).sort((a,b) => String(a.ticker).localeCompare(String(b.ticker)));
    if (!companies.length) { view.innerHTML = '<div class="empty-state">Données sociétés indisponibles.</div>'; return; }
    const selected = new Set(Array.from(view.querySelectorAll('[data-compare-ticker]:checked')).map(x => x.value));
    const choices = selected.size ? Array.from(selected).slice(0,4) : companies.slice(0,2).map(x => x.ticker);

    view.innerHTML = `
      <div class="page-header"><h1>Comparaison <span style="color:var(--gold)">Fondamentale</span></h1><p>Comparez 2 à 4 sociétés à partir des données financières réellement disponibles.</p></div>
      <div class="card mb20"><div class="card-body"><div class="comparison-select-grid">
        ${companies.map(c => `<label class="comparison-choice"><input type="checkbox" data-compare-ticker value="${esc(c.ticker)}" ${choices.includes(c.ticker) ? 'checked' : ''}> <strong>${esc(c.ticker)}</strong><span>${esc(c.nom || c.nom_court || '')}</span></label>`).join('')}
      </div><button class="filter-btn active" id="comparisonApply">Comparer</button></div></div>
      <div class="card"><div class="table-wrap"><table class="comparison-table"><thead><tr><th>Indicateur</th>${choices.map(t => `<th>${esc(t)}<br><span class="comparison-company-name">${esc(companyName(t))}</span></th>`).join('')}</tr></thead><tbody>
        ${comparisonRows(choices)}
      </tbody></table></div></div>`;

    view.querySelector('#comparisonApply')?.addEventListener('click', () => {
      const picks = Array.from(view.querySelectorAll('[data-compare-ticker]:checked')).map(x => x.value).slice(0,4);
      if (picks.length < 2) { if (typeof toast === 'function') toast('Sélectionnez au moins 2 sociétés.', 'warn'); return; }
      const current = new Set(picks); view.querySelectorAll('[data-compare-ticker]').forEach(x => x.checked = current.has(x.value));
      renderComparison();
    });
  }

  function comparisonRows(choices) {
    const rows = [
      ['P/E', t => { const f=latestByTicker(t); const v=metric(f,t,'pe'); return v==null?'Donnée non disponible':`${v.toFixed(2)}x`; }],
      ['ROE', t => pct(metric(latestByTicker(t),t,'roe'))],
      ['Croissance CA', t => pct(growthCA(t))],
      ['Dividend Yield', t => pct(metric(latestByTicker(t),t,'yield'))],
      ['Dette', t => fmt(metric(latestByTicker(t),t,'debt'))]
    ];
    return rows.map(([label,fn], i) => `<tr><td>${label}</td>${choices.map(t => `<td class="${i > 2 ? 'pro-only' : ''}">${esc(fn(t))}</td>`).join('')}</tr>`).join('');
  }

  window.renderComparison = renderComparison;
})();
