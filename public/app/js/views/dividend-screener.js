// THE CAPITAL — Dividend Screener
(function () {
  if (window.__TC_DIVIDEND_SCREENER_LOADED__) return;
  window.__TC_DIVIDEND_SCREENER_LOADED__ = true;

  let rows = [];
  const esc = value => { const d = document.createElement('div'); d.textContent = value == null ? '' : String(value); return d.innerHTML; };
  const n = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const pct = value => value == null ? 'Donnée non disponible' : `${Number(value).toFixed(2)} %`;

  async function loadRows() {
    try {
      const data = await window.apiGet('/marche?type=dividendes');
      rows = Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('[DIVIDEND SCREENER]', e);
      rows = [];
    }
  }

  async function renderDividendScreener() {
    const view = document.getElementById('view-dividend-screener');
    if (!view) return;
    if (!rows.length) await loadRows();
    view.innerHTML = `
      <div class="page-header"><h1>Dividend <span style="color:var(--gold)">Screener</span></h1><p>Filtrez les sociétés selon le rendement et la croissance du dividende, à partir de dividendes_calendrier.</p></div>
      <div class="card mb20"><div class="card-body"><div class="screener-filters">
        <div><label>Rendement min %</label><input type="number" id="divMinYield" value="0" step="0.1"></div>
        <div><label>Rendement max %</label><input type="number" id="divMaxYield" placeholder="∞" step="0.1"></div>
        <div class="pro-only"><label>Croissance min %</label><input type="number" id="divMinGrowth" placeholder="—" step="0.1"></div>
        <div><label>Exercice</label><select id="divYear"><option value="">Tous</option>${[...new Set(rows.map(r => r.exercice ?? r.annee).filter(Boolean))].sort((a,b) => b-a).map(y => `<option value="${esc(y)}">${esc(y)}</option>`).join('')}</select></div>
      </div></div></div>
      <div class="card"><div class="card-header"><div class="card-title">Résultats</div><div id="divCount" style="font-size:12px;color:var(--dim)"></div></div><div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Exercice</th><th class="right">Dividende</th><th class="right">Rendement</th><th class="right pro-only">Croissance</th><th>Date détachement</th><th>Date paiement</th></tr></thead><tbody id="dividendScreenerTable"></tbody></table></div></div>`;

    ['divMinYield', 'divMaxYield', 'divMinGrowth'].forEach(id => document.getElementById(id)?.addEventListener('input', apply));
    document.getElementById('divYear')?.addEventListener('change', apply);
    apply();
  }

  function apply() {
    const minY = n(document.getElementById('divMinYield')?.value) ?? 0;
    const maxY = n(document.getElementById('divMaxYield')?.value) ?? Infinity;
    const minG = n(document.getElementById('divMinGrowth')?.value);
    const selectedYear = document.getElementById('divYear')?.value || '';

    // Filter the year before selecting the latest row per ticker so historical years remain selectable.
    const sourceRows = selectedYear
      ? rows.filter(r => String(r.exercice ?? r.annee) === selectedYear)
      : rows;

    const byTicker = new Map();
    sourceRows.forEach(r => {
      const ticker = String(r.ticker || '').toUpperCase();
      if (!ticker) return;
      const year = n(r.exercice ?? r.annee);
      const current = byTicker.get(ticker);
      if (!current || Number(year || 0) > Number(current.exercice ?? current.annee ?? 0)) byTicker.set(ticker, { ...r, ticker });
    });

    const out = Array.from(byTicker.values()).map(r => {
      const current = n(r.montant_net ?? r.montant);
      const yieldValue = n(r.taux_rendement ?? r.rendement);
      const currentYear = n(r.exercice ?? r.annee);
      const previous = rows.find(x => String(x.ticker || '').toUpperCase() === r.ticker && n(x.exercice ?? x.annee) === currentYear - 1);
      const prevAmount = previous ? n(previous.montant_net ?? previous.montant) : null;
      const growth = current != null && prevAmount != null && prevAmount !== 0 ? (current / prevAmount - 1) * 100 : null;
      return { ...r, yieldValue, growth };
    }).filter(r =>
      (r.yieldValue ?? -Infinity) >= minY &&
      (r.yieldValue ?? Infinity) <= maxY &&
      (minG == null || (r.growth != null && r.growth >= minG))
    );

    const tbody = document.getElementById('dividendScreenerTable');
    if (!tbody) return;
    document.getElementById('divCount').textContent = `${out.length} résultat(s)`;
    tbody.innerHTML = out.length
      ? out.sort((a,b) => (b.yieldValue ?? -Infinity) - (a.yieldValue ?? -Infinity)).map(r => `<tr><td><strong style="color:var(--gold)">${esc(r.ticker)}</strong></td><td>${esc(r.exercice ?? r.annee ?? '—')}</td><td class="right">${r.montant_net ?? r.montant ?? 'Donnée non disponible'}</td><td class="right">${pct(r.yieldValue)}</td><td class="right pro-only">${pct(r.growth)}</td><td>${esc(r.date_detachement ?? r.ex_date ?? '—')}</td><td>${esc(r.date_paiement_cal ?? r.date_paiement ?? '—')}</td></tr>`).join('')
      : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--dim)">Aucune société ne correspond aux critères.</td></tr>';

    if (window.TCDisplayMode) window.TCDisplayMode.set(document.body.dataset.mode);
  }

  window.renderDividendScreener = renderDividendScreener;
})();
