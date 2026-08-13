// THE CAPITAL — Global display mode (Simple / Pro)
(function () {
  if (window.__TC_DISPLAY_MODE_LOADED__) return;
  window.__TC_DISPLAY_MODE_LOADED__ = true;

  const STORAGE_KEY = 'tc_display_mode';
  const VALID = new Set(['simple', 'pro']);
  let syncing = false;

  function normalize(mode) {
    return VALID.has(mode) ? mode : 'simple';
  }

  function getLocalMode() {
    try { return normalize(localStorage.getItem(STORAGE_KEY)); } catch (e) { return 'simple'; }
  }

  function hasSession() {
    try {
      const session = JSON.parse(localStorage.getItem('tc_session') || 'null');
      return Boolean(session?.access_token);
    } catch (e) { return false; }
  }

  function setModeAttribute(mode) {
    const normalized = normalize(mode);
    document.body.dataset.mode = normalized;
    document.documentElement.dataset.mode = normalized;
    try { localStorage.setItem(STORAGE_KEY, normalized); } catch (e) {}
    updateToggle(normalized);
    decorateCurrentView();
    window.dispatchEvent(new CustomEvent('tc:display-mode-change', { detail: { mode: normalized } }));
    return normalized;
  }

  async function persist(mode) {
    if (!hasSession() || syncing) return;
    syncing = true;
    try {
      const session = JSON.parse(localStorage.getItem('tc_session') || 'null');
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer ' + session.access_token
        },
        body: JSON.stringify({ display_mode: mode })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
    } catch (e) {
      console.warn('[MODE] Préférence serveur indisponible, localStorage conservé:', e.message);
    } finally {
      syncing = false;
    }
  }

  window.setDisplayMode = function (mode) {
    const normalized = setModeAttribute(mode);
    persist(normalized);
    return normalized;
  };

  async function loadServerMode() {
    if (!hasSession()) return;
    try {
      const session = JSON.parse(localStorage.getItem('tc_session') || 'null');
      const res = await fetch('/api/preferences', {
        headers: { 'Accept': 'application/json', 'Authorization': 'Bearer ' + session.access_token }
      });
      if (!res.ok) return;
      const payload = await res.json();
      const serverMode = normalize(payload?.data?.display_mode);
      setModeAttribute(serverMode);
    } catch (e) {
      console.warn('[MODE] Lecture préférence serveur impossible:', e.message);
    }
  }

  function createToggle() {
    if (document.getElementById('tcDisplayMode')) return;
    const host = document.querySelector('.topnav-right');
    if (!host) return;

    const wrap = document.createElement('div');
    wrap.className = 'tc-mode-toggle';
    wrap.id = 'tcDisplayMode';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Mode d’affichage');
    wrap.innerHTML = `
      <span class="tc-mode-label">MODE</span>
      <button type="button" class="tc-mode-btn" data-mode-choice="simple" aria-label="Mode Simple">Simple</button>
      <span class="tc-mode-sep">/</span>
      <button type="button" class="tc-mode-btn" data-mode-choice="pro" aria-label="Mode Pro">Pro</button>
    `;
    wrap.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-mode-choice]');
      if (!btn) return;
      setDisplayMode(btn.dataset.modeChoice);
    });
    host.insertBefore(wrap, host.querySelector('.topnav-user') || host.firstChild);
  }

  function updateToggle(mode) {
    document.querySelectorAll('#tcDisplayMode [data-mode-choice]').forEach(btn => {
      const active = btn.dataset.modeChoice === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function addAdvancedClass(el) {
    if (el) el.classList.add('pro-only');
  }

  function decoratePortfolio() {
    const view = document.getElementById('view-portefeuille');
    if (!view) return;
    ['pfVolatility','pfSharpe','pfDrawdown','pfBeta'].forEach(id => addAdvancedClass(document.getElementById(id)?.closest('.portf-kpi')));
    addAdvancedClass(document.getElementById('chartSectorAlloc')?.closest('.card'));
    addAdvancedClass(document.getElementById('chartGeoAlloc')?.closest('.card'));
    addAdvancedClass(document.getElementById('chartPortfolioPL')?.closest('.card'));
    addAdvancedClass(document.getElementById('correlationMatrix')?.closest('.card'));
    addAdvancedClass(document.getElementById('concentrationStats')?.closest('.card'));
    addAdvancedClass(document.getElementById('benchmarkStats')?.closest('.card'));
  }

  function decorateFiche() {
    const view = document.getElementById('view-fiche');
    if (!view) return;
    addAdvancedClass(document.getElementById('ficheMeta'));
    addAdvancedClass(document.getElementById('ficheInfo')?.closest('.card'));
    addAdvancedClass(document.getElementById('fichYearTabs')?.closest('.card'));
    addAdvancedClass(document.getElementById('ficheFinBody')?.closest('.card'));
    addAdvancedClass(document.getElementById('ficheAnalyseList')?.closest('.card'));
    const periodControls = view.querySelectorAll('.year-tab');
    periodControls.forEach((btn, index) => { if (index > 0) btn.classList.add('pro-only'); });
  }

  function decorateMarket() {
    const view = document.getElementById('view-marche');
    if (!view) return;
    // The current market renderer owns the table. Keep price/variation visible and hide advanced columns.
    view.querySelectorAll('thead th').forEach(th => {
      const text = (th.textContent || '').toLowerCase();
      if (/volume|secteur|capitalisation|haut|bas/.test(text)) th.classList.add('pro-only');
    });
    view.querySelectorAll('tbody tr').forEach(row => {
      row.querySelectorAll('td').forEach((td, index) => {
        const head = view.querySelectorAll('thead th')[index];
        if (head?.classList.contains('pro-only')) td.classList.add('pro-only');
      });
    });
    const analysis = document.getElementById('marcheAnalysis');
    addAdvancedClass(analysis);
  }

  function decorateFinancials() {
    const view = document.getElementById('view-financials');
    if (!view) return;
    view.querySelectorAll('.financial-advanced,[data-financial-advanced]').forEach(addAdvancedClass);
  }

  function decorateAnalyses() {
    document.querySelectorAll('#view-analyses .analyse-meta span').forEach(span => {
      if ((span.textContent || '').includes('✍')) span.classList.add('pro-only');
    });
  }

  function decorateCurrentView() {
    const mode = normalize(document.body.dataset.mode);
    decoratePortfolio();
    decorateFiche();
    decorateMarket();
    decorateFinancials();
    decorateAnalyses();
    document.querySelectorAll('#view-analyse-technique').forEach(v => {
      // The mature technical terminal is intentionally never modified by the mode layer.
      v.querySelectorAll('.pro-only').forEach(el => el.classList.remove('pro-only'));
    });
    if (mode === 'pro') document.querySelectorAll('.simple-hidden').forEach(el => el.classList.remove('simple-hidden'));
  }

  function addGlobalNavigation() {
    const menu = document.getElementById('menu-dd-analyse');
    if (menu && !document.getElementById('nav-comparison')) {
      const item = document.createElement('div');
      item.className = 'nav-dropdown-item';
      item.id = 'nav-comparison';
      item.innerHTML = '<span class="icon">⇌</span><div><div>Comparaison</div><div class="item-desc">Comparer 2 à 4 sociétés</div></div>';
      item.onclick = () => { window.nav('comparison'); if (typeof closeDropdowns === 'function') closeDropdowns(); };
      menu.appendChild(item);
    }
    const marcheMenu = document.getElementById('menu-dd-marche');
    if (marcheMenu && !document.getElementById('nav-dividend-screener')) {
      const item = document.createElement('div');
      item.className = 'nav-dropdown-item';
      item.id = 'nav-dividend-screener';
      item.innerHTML = '<span class="icon">◉</span><div><div>Dividend Screener</div><div class="item-desc">Rendement & croissance</div></div>';
      item.onclick = () => { window.nav('dividend-screener'); if (typeof closeDropdowns === 'function') closeDropdowns(); };
      marcheMenu.appendChild(item);
    }
  }

  function ensureDynamicViews() {
    if (!document.getElementById('view-comparison')) {
      const v = document.createElement('div');
      v.className = 'view'; v.id = 'view-comparison';
      document.querySelector('main.main')?.appendChild(v);
    }
    if (!document.getElementById('view-dividend-screener')) {
      const v = document.createElement('div');
      v.className = 'view'; v.id = 'view-dividend-screener';
      document.querySelector('main.main')?.appendChild(v);
    }
  }

  function patchNavigation() {
    if (window.__TC_MODE_NAV_PATCHED__ || typeof window.nav !== 'function') return;
    window.__TC_MODE_NAV_PATCHED__ = true;
    const originalNav = window.nav;
    window.nav = function (id, noHash) {
      if (id === 'comparison' && typeof window.renderComparison === 'function') window.renderComparison();
      if (id === 'dividend-screener' && typeof window.renderDividendScreener === 'function') window.renderDividendScreener();
      const result = originalNav(id, noHash);
      setTimeout(() => { decorateCurrentView(); updateToggle(document.body.dataset.mode); }, 70);
      return result;
    };
  }

  function boot() {
    setModeAttribute(getLocalMode());
    createToggle();
    addGlobalNavigation();
    ensureDynamicViews();
    patchNavigation();
    updateToggle(document.body.dataset.mode);
    decorateCurrentView();
    loadServerMode();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.addEventListener('hashchange', () => setTimeout(() => {
    ensureDynamicViews();
    patchNavigation();
    createToggle();
    addGlobalNavigation();
    decorateCurrentView();
  }, 50));
  window.TCDisplayMode = { get: () => normalize(document.body.dataset.mode), set: window.setDisplayMode };
})();
