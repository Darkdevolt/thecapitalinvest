/* THE CAPITAL — Portefeuille view bootstrap
 * Restores the portfolio view mount removed during the modular app refactor.
 * Data source remains the existing authenticated /api/portfolio-transactions
 * -> Supabase pipeline. This file only mounts the UI and loads the existing
 * portfolio modules in dependency order.
 */
(function () {
  'use strict';

  if (window.__TC_PORTFOLIO_VIEW__) return;
  window.__TC_PORTFOLIO_VIEW__ = true;

  const VIEW_ID = 'view-portefeuille';
  const ROOT_ID = 'portfolioContent';

  function ensureStyles() {
    if (document.getElementById('tc-portfolio-runtime-css')) return;
    const link = document.createElement('link');
    link.id = 'tc-portfolio-runtime-css';
    link.rel = 'stylesheet';
    link.href = '/app/css/portefeuille-runtime.css?v=1';
    document.head.appendChild(link);
  }

  function mountView() {
    if (document.getElementById(VIEW_ID)) return document.getElementById(VIEW_ID);
    const main = document.getElementById('main-content');
    if (!main) return null;

    const view = document.createElement('div');
    view.className = 'view';
    view.id = VIEW_ID;
    view.innerHTML = `
      <div class="page-header">
        <h1>Mon <span style="color:var(--gold)">Portefeuille</span></h1>
        <p>Positions, liquidités, performance et historique de vos investissements BRVM.</p>
      </div>

      <div class="portf-kpi-grid">
        <div class="portf-kpi"><div class="portf-kpi-label">Valeur totale</div><div class="portf-kpi-value" id="pfTotal">—</div><div class="portf-kpi-sub" id="pfTotalSub">—</div></div>
        <div class="portf-kpi"><div class="portf-kpi-label">Capital investi</div><div class="portf-kpi-value" id="pfInvested">—</div><div class="portf-kpi-sub" id="pfPositionCount">—</div></div>
        <div class="portf-kpi"><div class="portf-kpi-label">P&amp;L</div><div class="portf-kpi-value" id="pfPL">—</div><div class="portf-kpi-sub" id="pfPLSub">—</div></div>
        <div class="portf-kpi"><div class="portf-kpi-label">Liquidités</div><div class="portf-kpi-value" id="pfCash">—</div><div class="portf-kpi-sub">Solde espèces</div></div>
        <div class="portf-kpi"><div class="portf-kpi-label">Performance</div><div class="portf-kpi-value" id="pfReturn">—</div><div class="portf-kpi-sub">Depuis l'origine</div></div>
        <div class="portf-kpi"><div class="portf-kpi-label">Volatilité</div><div class="portf-kpi-value" id="pfVolatility">—</div><div class="portf-kpi-sub">Annualisée</div></div>
        <div class="portf-kpi"><div class="portf-kpi-label">Sharpe</div><div class="portf-kpi-value" id="pfSharpe">—</div><div class="portf-kpi-sub">Ratio de risque</div></div>
        <div class="portf-kpi"><div class="portf-kpi-label">Drawdown</div><div class="portf-kpi-value" id="pfDrawdown">—</div><div class="portf-kpi-sub">Maximum historique</div></div>
      </div>

      <div class="card mb20">
        <div class="card-header"><div><div class="card-title">Opérations</div><div class="card-meta">Les opérations sont enregistrées dans votre portefeuille authentifié.</div></div></div>
        <div class="card-body">
          <div class="pf-tabs" role="tablist">
            <button type="button" id="tabBuy" class="filter-btn active" onclick="switchPfSubtab('buy')">Acheter</button>
            <button type="button" id="tabSell" class="filter-btn" onclick="switchPfSubtab('sell')">Vendre</button>
          </div>
          <div id="panelBuy" class="pf-subpanel active">
            <div class="portf-form">
              <select id="pfTicker"><option value="">Ticker...</option></select>
              <select id="pfType"><option value="action">Action</option><option value="obligation">Obligation</option></select>
              <input type="number" id="pfQty" min="1" step="1" placeholder="Quantité">
              <input type="number" id="pfPrice" min="0" step="0.01" placeholder="Prix (FCFA)">
              <input type="date" id="pfDate">
              <button type="button" onclick="addPosition()">Ajouter l'achat</button>
            </div>
            <div id="pfCurrentPriceHint" class="form-hint"></div>
          </div>
          <div id="panelSell" class="pf-subpanel">
            <div class="portf-form">
              <select id="pfSellTicker" onchange="updateSellHint()"><option value="">Ticker à vendre...</option></select>
              <input type="number" id="pfSellQty" min="1" step="1" placeholder="Quantité">
              <input type="number" id="pfSellPrice" min="0" step="0.01" placeholder="Prix (FCFA)">
              <input type="date" id="pfSellDate">
              <button type="button" onclick="sellPositionQuick()">Enregistrer la vente</button>
            </div>
            <div id="sellHint" class="form-hint"></div>
          </div>
        </div>
      </div>

      <div class="grid-2 mb20">
        <div class="card">
          <div class="card-header"><div class="card-title">Évolution de la valeur</div><div class="portfolio-periods"><button class="year-tab active" onclick="setPortfolioPeriod(30,this)">1M</button><button class="year-tab" onclick="setPortfolioPeriod(90,this)">3M</button><button class="year-tab" onclick="setPortfolioPeriod(365,this)">1A</button><button class="year-tab" onclick="setPortfolioPeriod(99999,this)">Tout</button></div></div>
          <div class="card-body chart-card-body"><canvas id="chartPortfolioValue"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">P&amp;L cumulé</div></div>
          <div class="card-body chart-card-body"><canvas id="chartPortfolioPL"></canvas></div>
        </div>
      </div>

      <div class="card mb20">
        <div class="card-header"><div><div class="card-title">Positions</div><div class="card-meta" id="pfPositionCountMeta">Cours de marché utilisés pour la valorisation.</div></div></div>
        <div class="card-body">
          <div class="portfolio-table-toolbar">
            <input id="pfSearch" class="search-input" type="search" placeholder="Rechercher une position..." oninput="filterPositionsTable()">
            <button type="button" class="filter-btn" onclick="exportPositionsCSV(window._pfLastRows || [])">Exporter CSV</button>
            <button type="button" class="filter-btn" onclick="deleteSelectedPositions()">Supprimer sélection</button>
          </div>
          <div class="table-wrap portfolio-table-wrap">
            <table class="portfolio-table">
              <thead><tr>
                <th><input type="checkbox" aria-label="Tout sélectionner" onclick="toggleSelectAllPositions(this)"></th>
                <th>Titre</th><th class="right">Qté</th><th class="right">CMP</th><th class="right">Cours</th><th class="right">P&amp;L</th><th class="right">P&amp;L %</th><th class="right">Valeur</th><th class="right">Allocation</th><th class="right">+ Haut 52s</th><th class="right">+ Bas 52s</th><th>Actions</th>
              </tr></thead>
              <tbody id="pfTable"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="grid-2 mb20">
        <div class="card"><div class="card-header"><div class="card-title">Répartition par secteur</div></div><div class="card-body chart-card-body"><canvas id="chartSectorAlloc"></canvas></div></div>
        <div class="card"><div class="card-header"><div class="card-title">Répartition géographique</div></div><div class="card-body chart-card-body"><canvas id="chartGeoAlloc"></canvas></div></div>
      </div>

      <div class="grid-2 mb20">
        <div class="card"><div class="card-header"><div class="card-title">Concentration</div></div><div id="concentrationStats"></div></div>
        <div class="card"><div class="card-header"><div class="card-title">Dividendes</div></div><div id="dividendStats"></div><div id="dividendList" class="portfolio-mini-list"></div></div>
      </div>

      <div class="grid-2 mb20">
        <div class="card"><div class="card-header"><div class="card-title">Performance vs BRVM</div></div><div id="benchmarkStats"></div></div>
        <div class="card"><div class="card-header"><div class="card-title">Corrélations</div></div><div id="correlationMatrix"></div></div>
      </div>

      <div class="card mb20"><div class="card-header"><div class="card-title">Meilleure / pire position</div></div><div class="pf-bestworst"><div><span>Meilleure</span><strong id="pfBestPos">—</strong></div><div><span>Pire</span><strong id="pfWorstPos">—</strong></div><div><span>P&amp;L réalisé</span><strong id="pfRealizedPL">—</strong></div></div></div>

      <div class="grid-2 mb20">
        <div class="card"><div class="card-header"><div class="card-title">Watchlist</div></div><div class="card-body"><div class="portf-form"><select id="watchTicker"><option value="">Ticker...</option></select><button type="button" onclick="addToWatchlist()">Ajouter</button></div><div id="watchlistPanel" class="watchlist-grid"></div></div></div>
        <div class="card"><div class="card-header"><div class="card-title">Alertes</div></div><div class="card-body"><div id="alertsPanel"></div></div></div>
      </div>

      <div class="grid-2 mb20">
        <div class="card"><div class="card-header"><div class="card-title">Objectif portefeuille</div></div><div class="card-body"><div class="portf-form"><input id="goalTarget" type="number" min="1" placeholder="Objectif (FCFA)"><input id="goalDate" type="date"><button type="button" onclick="setPortfolioGoal()">Définir</button></div><div id="goalSummary"></div></div></div>
        <div class="card"><div class="card-header"><div class="card-title">Historique des transactions</div></div><div class="card-body"><div id="transactionHistoryPanel"></div></div></div>
      </div>

      <div class="grid-2 mb20">
        <div class="card"><div class="card-header"><div class="card-title">Dépôts / retraits</div></div><div class="card-body"><div class="portf-form"><select id="cashType"><option value="deposit">Dépôt</option><option value="withdraw">Retrait</option></select><input id="cashAmount" type="number" min="1" placeholder="Montant FCFA"><button type="button" onclick="addCash()">Enregistrer</button></div></div></div>
        <div class="card"><div class="card-header"><div class="card-title">Dividende reçu</div></div><div class="card-body"><div class="portf-form"><select id="divTicker"><option value="">Ticker...</option></select><input id="divAmount" type="number" min="0" step="0.01" placeholder="Montant FCFA"><input id="divDate" type="date"><button type="button" onclick="addDividend()">Enregistrer</button></div></div></div>
      </div>

      <div class="card mb20"><div class="card-header"><div class="card-title">Calculateur de position</div></div><div class="card-body"><div class="portf-form"><select id="calcTicker"><option value="">Ticker...</option></select><input id="calcQty" type="number" min="1" placeholder="Quantité"><input id="calcTarget" type="number" min="0" step="0.01" placeholder="Cours cible (optionnel)"><button type="button" onclick="calculatePosition()">Calculer</button></div><div id="calcResult"></div></div></div>

      <div class="card mb20"><div class="card-header"><div class="card-title">Rééquilibrage</div></div><div id="rebalancingPanel" class="card-body"></div></div>

      <div id="bulkActionBar" class="portfolio-bulkbar" style="display:none"><span id="bulkActionCount">0 sélectionnée(s)</span><button type="button" onclick="deleteSelectedPositions()">Supprimer</button></div>

      <div id="sellModal" class="pf-modal" aria-hidden="true"><div class="pf-modal-card"><div class="card-header"><div class="card-title">Vendre</div><button type="button" onclick="closeSellModal()">×</button></div><div class="card-body"><input type="hidden" id="sellTicker"><div id="sellQtyHint" class="form-hint"></div><div class="portf-form"><input id="sellQty" type="number" min="1" placeholder="Quantité"><input id="sellPrice" type="number" min="0" step="0.01" placeholder="Prix"><input id="sellDate" type="date"><button type="button" onclick="confirmSell()">Confirmer</button></div></div></div></div>
      <div id="editModal" class="pf-modal" aria-hidden="true"><div class="pf-modal-card"><div class="card-header"><div class="card-title">Modifier la position</div><button type="button" onclick="closeEditModal()">×</button></div><div class="card-body"><input type="hidden" id="editId"><div class="portf-form"><input id="editQty" type="number" min="1" placeholder="Quantité"><input id="editPrice" type="number" min="0" step="0.01" placeholder="Prix"><input id="editDate" type="date"><button type="button" onclick="confirmEdit()">Enregistrer</button></div></div></div></div>
    `;

    main.appendChild(view);
    return view;
  }

  function loadScript(src) {
    return new Promise((resolve) => {
      const existing = document.querySelector('script[data-tc-portfolio="' + src + '"]');
      if (existing) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.tcPortfolio = src;
      script.onload = () => resolve();
      script.onerror = () => {
        console.error('[PORTFOLIO] Module indisponible:', src);
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  const modules = [
    '/app/js/views/portefeuille/portefeuille-utils.js?v=5',
    '/app/js/views/portefeuille/portefeuille-prices.js?v=5',
    '/app/js/views/portefeuille/portefeuille-history.js?v=5',
    '/app/js/views/portefeuille/portefeuille-charts.js?v=5',
    '/app/js/views/portefeuille/portefeuille-crud.js?v=5',
    '/app/js/views/portefeuille/portefeuille-main.js?v=5',
    '/app/js/views/portefeuille/portefeuille-diagnostic.js?v=1'
  ];

  function render() {
    const view = mountView();
    if (!view) return;
    ensureStyles();
    if (typeof window.initPortefeuille === 'function') {
      try { window.initPortefeuille(); } catch (error) { console.error('[PORTFOLIO] Initialisation:', error); }
    }
  }

  window.renderPortefeuille = render;
  window.__tcPortfolioReady = Promise.resolve().then(async () => {
    mountView();
    ensureStyles();
    for (const src of modules) await loadScript(src);
    render();
    if (typeof window.renderCurrentView === 'function') setTimeout(window.renderCurrentView, 0);
  });

  // The router may be invoked before the async modules finish loading.
  window.__tcPortfolioReady.catch((error) => console.error('[PORTFOLIO] Bootstrap:', error));
})();
