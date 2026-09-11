/* THE CAPITAL — dashboard presentation bootstrap
 * Loads only the presentation layer and the existing real-data calendar runtime.
 * No API, auth, database, portfolio or market calculation is changed here.
 */
(function (w, d) {
  'use strict';
  if (w.__TC_DASHBOARD_PRESENTATION_V2__) return;
  w.__TC_DASHBOARD_PRESENTATION_V2__ = true;

  // dashboard-presentation-v3.css retiré : absorbé dans /app/css/dashboard.css
  // (chargé globalement dans app.html), qui reprend désormais tous ses
  // réglages. Le charger ici EN PLUS aurait recréé le conflit entre couches
  // qu'on vient de résoudre.

  function loadCalendarRuntime() {
    var src = '/app/js/views/dashboard-calendar-runtime.js?v=20260910';
    // loader.js charge déjà ce runtime (avec un autre ?v=). Ne pas le
    // redoubler : sinon le calendrier du tableau de bord s'initialise 2 fois.
    if (d.querySelector('script[data-tc-dashboard-calendar-runtime]')) return;
    if (d.querySelector('script[src*="dashboard-calendar-runtime.js"]')) return;
    if (typeof window.tcLoadOnce === 'function') { window.tcLoadOnce(src); return; }
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
    loadCalendarRuntime();
    observePortfolio();
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();
})(window, document);
