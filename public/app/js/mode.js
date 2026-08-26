// THE CAPITAL, Global display mode (Simple / Pro)
(function () {
  if (window.__TC_DISPLAY_MODE_LOADED__) return;
  window.__TC_DISPLAY_MODE_LOADED__ = true;

  const STORAGE_KEY = 'tc_display_mode';
  const VALID = new Set(['simple', 'pro']);
  let syncing = false;

  const normalize = mode => VALID.has(mode) ? mode : 'simple';

  function getLocalMode() {
    try { return normalize(localStorage.getItem(STORAGE_KEY)); }
    catch (e) { return 'simple'; }
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
      const response = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
        body: JSON.stringify({ display_mode: mode })
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
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
      const response = await fetch('/api/preferences', { headers: { Accept: 'application/json', Authorization: 'Bearer ' + session.access_token } });
      if (!response.ok) return;
      const payload = await response.json();
      setModeAttribute(normalize(payload?.data?.display_mode));
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
    wrap.innerHTML = '<span class="tc-mode-label">MODE</span><button type="button" class="tc-mode-btn" data-mode-choice="simple" aria-label="Mode Simple">Simple</button><span class="tc-mode-sep">/</span><button type="button" class="tc-mode-btn" data-mode-choice="pro" aria-label="Mode Pro">Pro</button>';
    wrap.addEventListener('click', event => {
      const button = event.target.closest('[data-mode-choice]');
      if (button) setDisplayMode(button.dataset.modeChoice);
    });
    host.insertBefore(wrap, host.querySelector('.topnav-user') || host.firstChild);
  }

  function updateToggle(mode) {
    document.querySelectorAll('#tcDisplayMode [data-mode-choice]').forEach(button => {
      const active = button.dataset.modeChoice === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  const addAdvancedClass = element => { if (element) element.classList.add('pro-only'); };

  function decoratePortfolio() {
    const view = document.getElementById('view-portefeuille');
    if (!view) return;
    ['pfVolatility', 'pfSharpe', 'pfDrawdown', 'pfBeta'].forEach(id => addAdvancedClass(document.getElementById(id)?.closest('.portf-kpi')));
    ['chartSectorAlloc', 'chartGeoAlloc', 'chartPortfolioPL', 'correlationMatrix', 'concentrationStats', 'benchmarkStats'].forEach(id => addAdvancedClass(document.getElementById(id)?.closest('.card')));
  }

  function decorateFiche() {
    const view = document.getElementById('view-fiche');
    if (!view) return;
    addAdvancedClass(document.getElementById('ficheMeta'));
    addAdvancedClass(document.getElementById('fichYearTabs')?.closest('.card'));
    addAdvancedClass(document.getElementById('ficheFinBody')?.closest('.card'));
    addAdvancedClass(document.getElementById('ficheAnalyseList')?.closest('.card'));
    view.querySelectorAll('.year-tab').forEach((button, index) => { if (index > 0) button.classList.add('pro-only'); });
  }

  function decorateFinancials() {
    const view = document.getElementById('view-financials');
    if (view) view.querySelectorAll('.financial-advanced,[data-financial-advanced]').forEach(addAdvancedClass);
    const detail = document.getElementById('view-financials-detail');
    if (detail) detail.querySelectorAll('.fin-detail-card').forEach(card => {
      const title = (card.querySelector('h4')?.textContent || '').toLowerCase();
      if (/bilan|flux|ratios/.test(title)) card.classList.add('pro-only');
    });
  }

  function decorateAnalyses() {
    document.querySelectorAll('#view-analyses .analyse-meta span').forEach(span => {
      if ((span.textContent || '').includes('✍')) span.classList.add('pro-only');
    });
  }

  function decorateCurrentView() {
    decoratePortfolio();
    decorateFiche();
    decorateFinancials();
    decorateAnalyses();
  }

  function addGlobalNavigation() {
    const analyseMenu = document.getElementById('menu-dd-analyse');
    if (analyseMenu && !document.getElementById('nav-comparison')) {
      const item = document.createElement('div');
      item.className = 'nav-dropdown-item';
      item.id = 'nav-comparison';
      item.innerHTML = '<span class="icon">⇌</span><div><div>Comparaison</div><div class="item-desc">Comparer 2 à 4 sociétés</div></div>';
      item.onclick = () => { window.nav('comparison'); if (typeof closeDropdowns === 'function') closeDropdowns(); };
      analyseMenu.appendChild(item);
    }
    const marketMenu = document.getElementById('menu-dd-marche');
    if (marketMenu && !document.getElementById('nav-dividend-screener')) {
      const item = document.createElement('div');
      item.className = 'nav-dropdown-item';
      item.id = 'nav-dividend-screener';
      item.innerHTML = '<span class="icon">◉</span><div><div>Dividend Screener</div><div class="item-desc">Rendement & croissance</div></div>';
      item.onclick = () => { window.nav('dividend-screener'); if (typeof closeDropdowns === 'function') closeDropdowns(); };
      marketMenu.appendChild(item);
    }
  }

  function ensureDynamicViews() {
    const main = document.querySelector('main.main');
    if (!main) return;
    if (!document.getElementById('view-comparison')) {
      const view = document.createElement('div');
      view.className = 'view';
      view.id = 'view-comparison';
      main.appendChild(view);
    }
    if (!document.getElementById('view-dividend-screener')) {
      const view = document.createElement('div');
      view.className = 'view';
      view.id = 'view-dividend-screener';
      main.appendChild(view);
    }
  }

  function activateDynamicView(id) {
    const view = document.getElementById('view-' + id);
    if (!view) return false;
    if (typeof destroyAllCharts === 'function') destroyAllCharts();
    document.querySelectorAll('.view').forEach(item => {
      item.classList.remove('active');
      item.style.display = 'none';
    });
    document.querySelectorAll('.nav-dropdown-item,.nav-dropdown-btn').forEach(item => item.classList.remove('active'));
    view.classList.add('active');
    view.style.display = '';
    const navElement = document.getElementById('nav-' + id);
    if (navElement) navElement.classList.add('active');
    const parentMenu = navElement?.closest('.nav-dropdown');
    if (parentMenu) parentMenu.querySelector('.nav-dropdown-btn')?.classList.add('active');
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb('overview');
    if (typeof closeDropdowns === 'function') closeDropdowns();
    if (typeof closeSidebar === 'function') closeSidebar();
    return true;
  }

  function renderDynamicView(id) {
    ensureDynamicViews();
    if (id === 'comparison' && typeof window.renderComparison === 'function') window.renderComparison();
    if (id === 'dividend-screener' && typeof window.renderDividendScreener === 'function') window.renderDividendScreener();
    if (id === 'comparison') {
      history.replaceState(null, '', '#comparison');
      document.title = 'Comparaison Fondamentale, The Capital';
    }
    if (id === 'dividend-screener') {
      history.replaceState(null, '', '#dividend-screener');
      document.title = 'Dividend Screener, The Capital';
    }
    decorateCurrentView();
    updateToggle(document.body.dataset.mode);
  }

  function patchNavigation() {
    if (window.__TC_MODE_NAV_PATCHED__ || typeof window.nav !== 'function') return;
    window.__TC_MODE_NAV_PATCHED__ = true;
    const originalNav = window.nav;
    window.nav = function (id, noHash) {
      const dynamic = id === 'comparison' || id === 'dividend-screener';
      if (dynamic) {
        const result = activateDynamicView(id);
        if (!noHash) history.replaceState(null, '', '#' + id);
        setTimeout(() => renderDynamicView(id), 0);
        return result;
      }
      const result = originalNav(id, noHash);
      setTimeout(() => {
        renderDynamicView(id);
        decorateCurrentView();
        updateToggle(document.body.dataset.mode);
      }, 40);
      return result;
    };
  }

  function boot() {
    ensureDynamicViews();
    setModeAttribute(getLocalMode());
    createToggle();
    addGlobalNavigation();
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
    const hash = location.hash;
    if (hash === '#comparison') window.nav('comparison', true);
    if (hash === '#dividend-screener') window.nav('dividend-screener', true);
  }, 50));

  window.TCDisplayMode = { get: () => normalize(document.body.dataset.mode), set: window.setDisplayMode };
})();
