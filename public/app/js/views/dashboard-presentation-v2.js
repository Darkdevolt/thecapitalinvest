/* THE CAPITAL — dashboard presentation bootstrap
 * Loads only the presentation layer and the existing real-data calendar runtime.
 * No API, auth, database, portfolio or market calculation is changed here.
 */
(function (w, d) {
  'use strict';
  if (w.__TC_DASHBOARD_PRESENTATION_V2__) return;
  w.__TC_DASHBOARD_PRESENTATION_V2__ = true;

  function loadStylesheet() {
    var href = '/app/css/dashboard-presentation-v3.css?v=20260908.2';
    if (d.querySelector('link[data-tc-dashboard-presentation="v3"]')) return;
    var link = d.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.tcDashboardPresentation = 'v3';
    d.head.appendChild(link);
  }

  function loadCalendarRuntime() {
    var src = '/app/js/views/dashboard-calendar-runtime.js?v=20260908.2';
    if (d.querySelector('script[data-tc-dashboard-calendar-runtime]')) return;
    var script = d.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.tcDashboardCalendarRuntime = '1';
    script.onerror = function () {
      console.warn('[DASHBOARD] Calendrier réel indisponible; aucune donnée artificielle ne sera affichée.');
    };
    d.head.appendChild(script);
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
    loadStylesheet();
    loadCalendarRuntime();
    observePortfolio();
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();
})(window, document);
