/* THE CAPITAL — dashboard presentation bootstrap
 * Loads presentation runtimes and primes portfolio data for the dashboard.
 */
(function (w, d) {
  'use strict';
  if (w.__TC_DASHBOARD_PRESENTATION_V2__) return;
  w.__TC_DASHBOARD_PRESENTATION_V2__ = true;

  // dashboard-presentation-v3.css retiré : absorbé dans /app/css/dashboard.css.

  function loadScriptOnce(src) {
    var clean = String(src).split('?')[0];
    if (d.querySelector('script[src="' + clean + '"],script[src^="' + clean + '?"]')) return Promise.resolve();
    if (typeof w.tcLoadOnce === 'function') return Promise.resolve(w.tcLoadOnce(src));
    return new Promise(function (resolve) {
      var script = d.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = function () { console.warn('[DASHBOARD] Script indisponible:', src); resolve(); };
      d.head.appendChild(script);
    });
  }

  function loadCalendarRuntime() {
    var src = '/app/js/views/dashboard-calendar-runtime.js?v=20260910';
    if (d.querySelector('script[data-tc-dashboard-calendar-runtime]')) return;
    if (d.querySelector('script[src*="dashboard-calendar-runtime.js"]')) return;
    loadScriptOnce(src).then(function () {
      var scripts = d.querySelectorAll('script[src*="dashboard-calendar-runtime.js"]');
      if (scripts.length) scripts[scripts.length - 1].dataset.tcDashboardCalendarRuntime = '1';
    });
  }

  function primePortfolioStore() {
    // Le dashboard utilise le portefeuille avant que l'utilisateur n'ouvre
    // la route Portefeuille. Le store doit donc être hydraté dès l'entrée.
    loadScriptOnce('/app/js/views/portefeuille/portfolio-store.js?v=20260917').then(function () {
      if (w.portfolioStore && typeof w.portfolioStore.hydrate === 'function') w.portfolioStore.hydrate();
      if (typeof w.renderCurrentView === 'function') setTimeout(w.renderCurrentView, 0);
    });
  }

  function normalizePortfolioContributors() {
    var rows = d.querySelectorAll('#tciPortfolio .tci-contribs .tci-contrib');
    if (rows.length < 2) return;
    var detractor = rows[rows.length - 1];
    var value = detractor.querySelector('.tci-val');
    if (!value) return;
    var text = String(value.textContent || '').trim();
    if (!/^[-−]/.test(text)) detractor.hidden = true;
  }

  function observePortfolio() {
    if (!d.body || w.__TC_DASHBOARD_PORTFOLIO_OBSERVER__) return;
    w.__TC_DASHBOARD_PORTFOLIO_OBSERVER__ = true;
    var observer = new MutationObserver(function () { normalizePortfolioContributors(); });
    observer.observe(d.body, { childList: true, subtree: true });
    normalizePortfolioContributors();
  }

  function apply() {
    primePortfolioStore();
    loadCalendarRuntime();
    observePortfolio();
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();
})(window, document);
