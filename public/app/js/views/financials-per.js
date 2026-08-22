// Historical PER — isolated patch. Keeps the core financials view unchanged.
(function () {
  'use strict';

  const originalOpenFinDetail = window.openFinDetail;
  if (typeof originalOpenFinDetail !== 'function') return;

  async function fetchHistoricalRows(ticker) {
    const all = [];
    const pageSize = 1000;
    let offset = 0;

    // Historical PER needs the full available price history, not only the
    // first 1,000 rows. Pagination is kept local to this isolated module.
    while (true) {
      const response = await window.apiGet(
        '/marche?type=historique&ticker=' + encodeURIComponent(String(ticker).toUpperCase()) +
        '&limit=' + pageSize + '&offset=' + offset
      );
      const rows = Array.isArray(response) ? response : (response?.data || []);
      if (!Array.isArray(rows) || rows.length === 0) break;

      all.push(...rows);
      if (rows.length < pageSize) break;

      offset += pageSize;
      if (offset > 1000000) {
        throw new Error('Historique trop volumineux pour le calcul du PER.');
      }
    }

    return all
      .map(r => ({
        date: String(r.date_seance || r.date || '').slice(0, 10),
        close: Number(r.cours_cloture ?? r.cours ?? r.cloture)
      }))
      .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(r.close) && r.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  function firstSessionFromJan2(history, year) {
    const cutoff = `${year}-01-02`;
    return history.find(row => row.date >= cutoff && row.date.startsWith(String(year))) || null;
  }

  function buildRows(fins, history) {
    return (Array.isArray(fins) ? fins : [])
      .filter(f => (!f.periode || f.periode === 'annuel') && Number.isFinite(Number(f.annee)))
      .sort((a, b) => Number(a.annee) - Number(b.annee))
      .map(f => {
        const year = Number(f.annee);
        const session = firstSessionFromJan2(history, year);
        const bpa = Number(f.bpa);
        const validBpa = Number.isFinite(bpa) && bpa > 0;
        return {
          year,
          sessionDate: session?.date || null,
          close: session?.close ?? null,
          bpa: validBpa ? bpa : null,
          per: session && validBpa ? session.close / bpa : null
        };
      });
  }

  function renderPER(rows) {
    const card = document.createElement('div');
    card.className = 'card mb20';
    card.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">PER historique</div>
          <div style="font-size:11px;color:var(--dim);margin-top:4px">
            Cours de la première séance BRVM disponible à partir du 2 janvier ÷ BPA de l'exercice.
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="chart-container tall"><canvas id="chartPERHistory"></canvas></div>
        <div class="table-wrap" id="perHistoryTable"></div>
      </div>`;

    const table = card.querySelector('#perHistoryTable');
    if (!rows.length) {
      table.innerHTML = '<div class="fin-chart-empty">Aucune donnée financière annuelle disponible.</div>';
      return card;
    }

    table.innerHTML = `
      <table class="forecast-table">
        <thead>
          <tr><th>Année</th><th>1ère séance ≥ 02/01</th><th>Cours</th><th>BPA</th><th>PER</th></tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td><strong>${r.year}</strong></td>
              <td>${r.sessionDate || '—'}</td>
              <td>${r.close != null ? fmt(r.close) + ' FCFA' : '—'}</td>
              <td>${r.bpa != null ? fmt(r.bpa) + ' FCFA' : '—'}</td>
              <td>${r.per != null ? r.per.toFixed(2) + 'x' : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    const valid = rows.filter(r => Number.isFinite(r.per));
    const canvas = card.querySelector('#chartPERHistory');
    if (canvas && valid.length) {
      new Chart(canvas, {
        type: 'line',
        data: {
          labels: valid.map(r => r.year),
          datasets: [{ label: 'PER', data: valid.map(r => Number(r.per.toFixed(2))), tension: 0.25, fill: false }]
        },
        options: {
          ...window.chartOpts,
          plugins: { ...(window.chartOpts?.plugins || {}), legend: { display: false } }
        }
      });
    } else if (canvas) {
      canvas.parentElement.innerHTML = '<div class="fin-chart-empty">PER non calculable : cours ou BPA manquant.</div>';
    }
    return card;
  }

  window.openFinDetail = async function (ticker) {
    await originalOpenFinDetail(ticker);

    const detail = document.getElementById('finDetailContent');
    if (!detail) return;

    const fins = [...(window._finByTicker?.[ticker] || [])];
    const existing = detail.querySelector('#historical-per-card');
    if (existing) existing.remove();

    const placeholder = document.createElement('div');
    placeholder.id = 'historical-per-card';
    placeholder.className = 'card mb20';
    placeholder.innerHTML = '<div class="card-body"><div class="fin-chart-empty">Calcul du PER historique…</div></div>';
    const periods = detail.querySelector('#finDetailPeriods');
    if (periods) detail.insertBefore(placeholder, periods);
    else detail.appendChild(placeholder);

    try {
      const history = await fetchHistoricalRows(ticker);
      const rows = buildRows(fins, history);
      const card = renderPER(rows);
      card.id = 'historical-per-card';
      placeholder.replaceWith(card);
    } catch (error) {
      console.error('[PER historique]', error);
      placeholder.innerHTML = '<div class="card-body"><div class="fin-chart-empty">Impossible de charger l’historique des cours pour calculer le PER.</div></div>';
    }
  };
})();
