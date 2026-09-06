// THE CAPITAL — Global display mode (Simple / Pro)
(function () {
  'use strict';
  if (window.__TC_DISPLAY_MODE_LOADED__) return;
  window.__TC_DISPLAY_MODE_LOADED__ = true;

  const STORAGE_KEY = 'tc_display_mode';
  const VALID = new Set(['simple', 'pro']);
  let syncing = false;
  let booted = false;

  const normalize = mode => VALID.has(mode) ? mode : 'simple';

  function getLocalMode() {
    try { return normalize(localStorage.getItem(STORAGE_KEY)); }
    catch (e) { return 'simple'; }
  }

  function getSession() {
    try {
      const raw = localStorage.getItem('tc_session');
      if (!raw) return null;
      const value = JSON.parse(raw);
      return (value && value.data && value.data.session) ||
             (value && value.session) || value;
    } catch (e) {
      return null;
    }
  }

  function hasSession() {
    const session = getSession();
    return Boolean(session && session.access_token);
  }

  function updateToggle(mode) {
    document.querySelectorAll('#tcDisplayMode [data-mode-choice]').forEach(button => {
      const active = button.dataset.modeChoice === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function addAdvancedClass(element) {
    if (element) element.classList.add('pro-only');
  }

  function decoratePortfolio() {
    const view = document.getElementById('view-portefeuille');
    if (!view) return;
    ['pfVolatility','pfSharpe','pfDrawdown','pfBeta'].forEach(id => {
      addAdvancedClass(document.getElementById(id)?.closest('.portf-kpi'));
    });
    ['chartSectorAlloc','chartGeoAlloc','chartPortfolioPL','correlationMatrix','concentrationStats','benchmarkStats'].forEach(id => {
      addAdvancedClass(document.getElementById(id)?.closest('.card'));
    });
  }

  function decorateFiche() {
    const view = document.getElementById('view-fiche');
    if (!view) return;
    addAdvancedClass(document.getElementById('ficheMeta'));
    addAdvancedClass(document.getElementById('fichYearTabs')?.closest('.card'));
    addAdvancedClass(document.getElementById('ficheFinBody')?.closest('.card'));
    addAdvancedClass(document.getElementById('ficheAnalyseList')?.closest('.card'));
    view.querySelectorAll('.year-tab').forEach((button, index) => {
      button.classList.toggle('pro-only', index > 0);
    });
  }

  function decorateFinancials() {
    const view = document.getElementById('view-financials');
    if (view) {
      view.querySelectorAll('.financial-advanced,[data-financial-advanced]').forEach(addAdvancedClass);
    }
    const detail = document.getElementById('view-financials-detail');
    if (detail) {
      detail.querySelectorAll('.fin-detail-card').forEach(card => {
        const title = (card.querySelector('h4')?.textContent || '').toLowerCase();
        card.classList.toggle('pro-only', /bilan|flux|ratios/.test(title));
      });
    }
  }

  function decorateAnalyses() {
    document.querySelectorAll('#view-analyses .analyse-meta span').forEach(span => {
      span.classList.toggle('pro-only', (span.textContent || '').includes('✍'));
    });
  }

  function decorateCurrentView() {
    decoratePortfolio();
    decorateFiche();
    decorateFinancials();
    decorateAnalyses();
  }

  function removeRedundantBreadcrumb() {
    document.querySelectorAll('#breadcrumb,.breadcrumb').forEach(el => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  window.TCRemoveBreadcrumb = removeRedundantBreadcrumb;

  function setModeAttribute(mode) {
    const normalized = normalize(mode);
    if (document.body) document.body.dataset.mode = normalized;
    document.documentElement.dataset.mode = normalized;
    try { localStorage.setItem(STORAGE_KEY, normalized); } catch (e) {}
    updateToggle(normalized);
    decorateCurrentView();
    removeRedundantBreadcrumb();
    window.dispatchEvent(new CustomEvent('tc:display-mode-change', {
      detail: { mode: normalized }
    }));
    return normalized;
  }

  async function persist(mode) {
    if (!hasSession() || syncing) return;
    const session = getSession();
    if (!session || !session.access_token) return;
    syncing = true;
    try {
      const response = await fetch('/api/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer ' + session.access_token
        },
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
    const session = getSession();
    if (!session || !session.access_token) return;
    try {
      const response = await fetch('/api/preferences', {
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer ' + session.access_token
        }
      });
      if (!response.ok) return;
      const payload = await response.json();
      const serverMode = payload?.data?.display_mode ?? payload?.display_mode;
      if (VALID.has(serverMode)) setModeAttribute(serverMode);
    } catch (e) {
      console.warn('[MODE] Lecture préférence serveur impossible:', e.message);
    }
  }

  function createToggle() {
    const existing = document.getElementById('tcDisplayMode');
    if (existing) {
      updateToggle(document.body?.dataset.mode || getLocalMode());
      return true;
    }

    const host = document.querySelector('.tc-header-tools');
    if (!host) return false;

    const wrap = document.createElement('div');
    wrap.className = 'tc-mode-toggle';
    wrap.id = 'tcDisplayMode';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Mode d’affichage');
    wrap.innerHTML =
      '<span class="tc-mode-label">MODE</span>' +
      '<button type="button" class="tc-mode-btn" data-mode-choice="simple" aria-label="Mode Simple">Simple</button>' +
      '<span class="tc-mode-sep" aria-hidden="true">/</span>' +
      '<button type="button" class="tc-mode-btn" data-mode-choice="pro" aria-label="Mode Pro">Pro</button>';

    wrap.addEventListener('click', event => {
      const button = event.target.closest('[data-mode-choice]');
      if (button) window.setDisplayMode(button.dataset.modeChoice);
    });

    const account = host.querySelector('#topnavUser');
    if (account) host.insertBefore(wrap, account);
    else host.appendChild(wrap);

    updateToggle(document.body?.dataset.mode || getLocalMode());
    return true;
  }

  function boot() {
    if (booted) return;
    if (!document.body) return;
    if (!createToggle()) return;
    booted = true;
    setModeAttribute(getLocalMode());
    decorateCurrentView();
    removeRedundantBreadcrumb();
    loadServerMode();
  }

  // header.js emits tc:header-ready after it has created the simplified header.
  document.addEventListener('tc:header-ready', boot, { once: true });

  // Fallback for future pages where the simplified header may already exist.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.querySelector('.tc-simple-header')) boot();
    }, { once: true });
  } else if (document.querySelector('.tc-simple-header')) {
    boot();
  }

  window.addEventListener('hashchange', () => {
    setTimeout(() => {
      updateToggle(document.body?.dataset.mode || getLocalMode());
      decorateCurrentView();
      removeRedundantBreadcrumb();
    }, 0);
  });

  window.TCDisplayMode = {
    get: () => normalize(document.body?.dataset.mode || getLocalMode()),
    set: window.setDisplayMode
  };
})();
