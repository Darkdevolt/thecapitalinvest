// THE CAPITAL, Dividend Screener
(function () {
  if (window.__TC_DIVIDEND_SCREENER_LOADED__) return;
  window.__TC_DIVIDEND_SCREENER_LOADED__ = true;

  let rows = [];
  const esc = value => { const d = document.createElement('div'); d.textContent = value == null ? '' : String(value); return d.innerHTML; };
  const n = value => {
    if (value === null || value === undefined || value === '') return null;
    const cleaned = String(value).replace(/\s/g, '').replace('%', '').replace(',', '.');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  };
  const year = value => {
    const match = String(value ?? '').match(/\d{4}/);
    return match ? Number(match[0]) : n(value);
  };
  const pct = value => value == null ? 'Donnée non disponible' : `${Number(value).toFixed(2)} %`;

  function normalizeRow(r) {
    const annee = year(r?.annee ?? r?.exercice ?? r?.annee_exercice);
    let rendement = n(r?.taux_rendement ?? r?.rendement ?? r?.yield);
    // Accept both 5.66 and 0.0566 representations.
    if (rendement != null && rendement > 0 && rendement <= 1) rendement *= 100;
    return {
      ...r,
      ticker: String(r?.ticker ?? r?.symbol ?? '').trim().toUpperCase(),
      annee,
      montant: n(r?.montant_net ?? r?.montant ?? r?.dpa),
      taux_rendement: rendement,
      date_detachement: r?.date_detachement ?? r?.ex_date ?? r?.date_ex ?? null,
      date_paiement: r?.date_paiement_cal ?? r?.date_paiement ?? r?.payment_date ?? null
    };
  }

  async function loadRows() {
    try {
      const data = await window.apiGet('/marche?type=dividendes');
      const raw = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.rows) ? data.rows : [];
      rows = raw.map(normalizeRow).filter(r => r.ticker && r.annee != null);
      return rows;
    } catch (e) {
      console.warn('[DIVIDEND SCREENER]', e);
      rows = [];
      return rows;
    }
  }

  async function renderDividendScreener() {
    const view = document.getElementById('view-dividend-screener');
    if (!view) return;
    await loadRows();

    const years = [...new Set(rows.map(r => r.annee).filter(Boolean))].sort((a, b) => b - a);
    view.innerHTML = `
      <div class="page-header"><h1>Dividend <span style="color:var(--gold)">Screener</span></h1><p>Analysez les dividendes des sociétés cotées. L'année correspond à l'exercice bénéficiaire.</p></div>
      <div class="card mb20"><div class="card-body"><div class="screener-filters">
        <div><label>Rendement min %</label><input type="number" id="divMinYield" value="0" step="0.1"></div>
        <div><label>Rendement max %</label><input type="number" id="divMaxYield" placeholder="∞" step="0.1"></div>
        <div class="pro-only"><label>Croissance min %</label><input type="number" id="divMinGrowth" placeholder="—" step="0.1"></div>
        <div><label>Année de l'exercice</label><select id="divYear"><option value="">Toutes</option>${years.map(y => `<option value="${y}">${y}</option>`).join('')}</select></div>
      </div></div></div>
      <div class="card"><div class="card-header"><div class="card-title">Résultats</div><div id="divCount" style="font-size:12px;color:var(--dim)"></div></div><div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Année</th><th class="right">Dividende</th><th class="right">Rendement</th><th class="right pro-only">Croissance</th><th>Date détachement</th><th>Date paiement</th></tr></thead><tbody id="dividendScreenerTable"></tbody></table></div></div>`;

    ['divMinYield', 'divMaxYield', 'divMinGrowth'].forEach(id => document.getElementById(id)?.addEventListener('input', apply));
    document.getElementById('divYear')?.addEventListener('change', apply);
    apply();
  }

  function apply() {
    const minY = n(document.getElementById('divMinYield')?.value) ?? 0;
    const maxY = n(document.getElementById('divMaxYield')?.value) ?? Infinity;
    const minG = n(document.getElementById('divMinGrowth')?.value);
    const selectedYear = document.getElementById('divYear')?.value || '';
    const sourceRows = selectedYear ? rows.filter(r => String(r.annee) === selectedYear) : rows;

    const byTicker = new Map();
    sourceRows.forEach(r => {
      const current = byTicker.get(r.ticker);
      if (!current || r.annee > current.annee) byTicker.set(r.ticker, r);
    });

    const out = Array.from(byTicker.values()).map(r => {
      const previous = rows.find(x => x.ticker === r.ticker && x.annee === r.annee - 1);
      const growth = r.montant != null && previous?.montant != null && previous.montant !== 0
        ? (r.montant / previous.montant - 1) * 100 : null;
      return { ...r, growth };
    }).filter(r =>
      (r.taux_rendement ?? -Infinity) >= minY &&
      (r.taux_rendement ?? Infinity) <= maxY &&
      (minG == null || (r.growth != null && r.growth >= minG))
    );

    const tbody = document.getElementById('dividendScreenerTable');
    if (!tbody) return;
    document.getElementById('divCount').textContent = `${out.length} résultat(s)`;
    tbody.innerHTML = out.length
      ? out.sort((a, b) => (b.taux_rendement ?? -Infinity) - (a.taux_rendement ?? -Infinity)).map(r => `<tr><td><strong style="color:var(--gold)">${esc(r.ticker)}</strong></td><td>${esc(r.annee)}</td><td class="right">${r.montant == null ? 'Donnée non disponible' : r.montant.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}</td><td class="right">${pct(r.taux_rendement)}</td><td class="right pro-only">${pct(r.growth)}</td><td>${esc(r.date_detachement ?? '—')}</td><td>${esc(r.date_paiement ?? '—')}</td></tr>`).join('')
      : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--dim)">Aucune donnée de dividende disponible ou aucun résultat ne correspond aux critères.</td></tr>';

    if (window.TCDisplayMode) window.TCDisplayMode.set(document.body.dataset.mode);
  }

  window.renderDividendScreener = renderDividendScreener;
})();
