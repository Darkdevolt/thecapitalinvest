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

  // Le BPA des états financiers est ramené à la base d'actions ACTUELLE (state.js) : le cours brut
  // d'une séance passée doit l'être aussi (opérations sur le capital, ex. BOAB avant 03/09/2024).
  // Le cours affiché reste le brut ; seul le PER est calculé sur les deux valeurs ajustées.
  function shareFactor(ticker, date) {
    return typeof window.tcShareFactorAt === 'function' ? window.tcShareFactorAt(ticker, date) : 1;
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
          per: session && validBpa ? (session.close * shareFactor(f.ticker, session.date)) / bpa : null
        };
      });
  }

  /* ── PER sectoriel (comparatif) ──────────────────────────────────
     Même exigence de rigueur que le PER du titre : pour chaque
     comparable, le PER d'une année est calculé avec SA propre séance
     (1ère ≥ 02/01 de cette année) et SON propre BPA de cet exercice —
     jamais une valeur actuelle plaquée sur une année passée. La
     portée retenue est le sous-secteur (les niveaux de PER n'ont pas
     le même sens d'un secteur à l'autre — banques vs assurances,
     par ex.), avec repli sur le secteur s'il y a moins de deux
     comparables au niveau du sous-secteur. */
  function sectorPeers(ticker) {
    const entMap = (window.entMap && typeof window.entMap === 'object') ? window.entMap : {};
    const self = entMap[String(ticker).toUpperCase()] || {};
    const sousSecteur = self.sous_secteur || '';
    const secteur = self.secteur || '';
    if (!sousSecteur && !secteur) return { peers: [], portee: null, label: '' };

    const all = Array.isArray(window.allEntreprises) ? window.allEntreprises : [];
    const q = String(ticker).toUpperCase();
    const memes = (champ, valeur) => valeur
      ? all.filter(e => e && e.ticker && String(e.ticker).toUpperCase() !== q && (e[champ] || '') === valeur)
      : [];

    const bySous = memes('sous_secteur', sousSecteur);
    if (bySous.length >= 2) return { peers: bySous.map(e => String(e.ticker).toUpperCase()), portee: 'sous-secteur', label: sousSecteur };

    const bySecteur = memes('secteur', secteur);
    if (bySecteur.length >= 2) return { peers: bySecteur.map(e => String(e.ticker).toUpperCase()), portee: 'secteur', label: secteur };

    return { peers: [], portee: null, label: '' };
  }

  async function peerPerByYear(peerTicker) {
    const fins = window._finByTicker?.[peerTicker] ||
      (Array.isArray(window.allFinancials) ? window.allFinancials.filter(f => String(f?.ticker || '').toUpperCase() === peerTicker) : []);
    const history = await fetchHistoricalRows(peerTicker);
    const map = {};
    buildRows(fins, history).forEach(r => { if (Number.isFinite(r.per)) map[r.year] = r.per; });
    return map;
  }

  // Moyenne par défaut ; médiane si l'utilisateur l'a choisie dans Fondamentale
  // (réglage partagé, cf. tcStatPref dans score-maison.js).
  function statLabel() { return typeof window.tcStatLabel === 'function' ? window.tcStatLabel() : 'moyenne'; }
  function aggregate(values) {
    const a = values.filter(Number.isFinite).slice().sort((x, y) => x - y);
    if (!a.length) return null;
    if (statLabel() === 'moyenne') return a.reduce((s, v) => s + v, 0) / a.length;
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  // Une année sans au moins deux comparables calculables est omise plutôt
  // qu'approximée sur un seul pair — pas de statistique à un chiffre déguisée.
  async function sectorPerSeries(ticker, years) {
    const { peers, portee, label } = sectorPeers(ticker);
    if (peers.length < 2 || !years.length) return null;
    const perByPeer = await Promise.all(peers.map(p => peerPerByYear(p).catch(() => ({}))));
    const byYear = {};
    years.forEach(year => {
      const vals = perByPeer.map(m => m[year]);
      if (vals.filter(Number.isFinite).length >= 2) byYear[year] = aggregate(vals);
    });
    return { byYear, portee, label, peerCount: peers.length };
  }

  function renderSectorPER(ticker, rows, sector) {
    const card = document.createElement('div');
    card.className = 'card mb20';
    const years = rows.map(r => r.year);
    const hasData = sector && years.some(y => Number.isFinite(sector.byYear[y]));
    if (!hasData) {
      const reason = !years.length
        ? "Historique de cours indisponible pour ce titre : comparaison impossible."
        : (!sector
          ? "Moins de deux sociétés comparables (même sous-secteur ou secteur) avec un PER calculable."
          : "Aucune année ne réunit au moins deux comparables avec un PER calculable.");
      card.innerHTML = `<div class="card-header"><div class="card-title">PER sectoriel</div></div><div class="card-body"><div class="fin-chart-empty">${reason}</div></div>`;
      return card;
    }

    const label = sector.portee === 'sous-secteur' ? 'sous-secteur' : 'secteur';
    card.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">PER sectoriel — comparatif</div>
          <div style="font-size:11px;color:var(--dim);margin-top:4px">
            ${statLabel() === 'moyenne' ? 'Moyenne' : 'Médiane'} du PER de ${sector.peerCount} société(s) du même ${label} (${finEsc(sector.label)}), même méthode année par année (1ère séance ≥ 02/01 ÷ BPA de l'exercice). Une année sans au moins deux comparables est omise, jamais approximée.
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="chart-container tall"><canvas id="chartPERSector"></canvas></div>
      </div>`;

    const tickerSeries = years.map(y => {
      const r = rows.find(x => x.year === y);
      return r && Number.isFinite(r.per) ? Number(r.per.toFixed(2)) : null;
    });
    const sectorSeries = years.map(y => Number.isFinite(sector.byYear[y]) ? Number(sector.byYear[y].toFixed(2)) : null);

    const canvas = card.querySelector('#chartPERSector');
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: years,
        datasets: [
          { label: 'PER ' + ticker, data: tickerSeries, tension: 0.25, fill: false, spanGaps: true },
          { label: 'PER ' + (statLabel() === 'moyenne' ? 'moyen ' : 'médian ') + label, data: sectorSeries, tension: 0.25, fill: false, borderDash: [5, 4], spanGaps: true }
        ]
      },
      options: {
        ...window.chartOpts,
        plugins: { ...(window.chartOpts?.plugins || {}), legend: { display: true } }
      }
    });
    return card;
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
    ['historical-per-card', 'sector-per-card'].forEach(id => detail.querySelector('#' + id)?.remove());

    const placeholder = document.createElement('div');
    placeholder.id = 'historical-per-card';
    placeholder.className = 'card mb20';
    placeholder.innerHTML = '<div class="card-body"><div class="fin-chart-empty">Calcul du PER historique…</div></div>';
    const periods = detail.querySelector('#finDetailPeriods');
    if (periods) detail.insertBefore(placeholder, periods);
    else detail.appendChild(placeholder);

    const sectorPlaceholder = document.createElement('div');
    sectorPlaceholder.id = 'sector-per-card';
    sectorPlaceholder.className = 'card mb20';
    sectorPlaceholder.innerHTML = '<div class="card-body"><div class="fin-chart-empty">Calcul du PER sectoriel…</div></div>';
    placeholder.after(sectorPlaceholder);

    let rows = [];
    try {
      const history = await fetchHistoricalRows(ticker);
      rows = buildRows(fins, history);
      const card = renderPER(rows);
      card.id = 'historical-per-card';
      placeholder.replaceWith(card);
    } catch (error) {
      console.error('[PER historique]', error);
      placeholder.innerHTML = '<div class="card-body"><div class="fin-chart-empty">Impossible de charger l’historique des cours pour calculer le PER.</div></div>';
    }

    try {
      const sector = await sectorPerSeries(ticker, rows.map(r => r.year));
      const card = renderSectorPER(ticker, rows, sector);
      card.id = 'sector-per-card';
      sectorPlaceholder.replaceWith(card);
    } catch (error) {
      console.error('[PER sectoriel]', error);
      sectorPlaceholder.innerHTML = '<div class="card-body"><div class="fin-chart-empty">Impossible de calculer le PER sectoriel.</div></div>';
    }
  };
})();
