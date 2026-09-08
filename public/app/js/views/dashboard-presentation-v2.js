/* THE CAPITAL — dashboard presentation bootstrap
 * Loads only the presentation layer and the existing real-data calendar runtime.
 * No API, auth, database, portfolio or market calculation is changed here.
 */
(function (w, d) {
  'use strict';
  if (w.__TC_DASHBOARD_PRESENTATION_V2__) return;
  w.__TC_DASHBOARD_PRESENTATION_V2__ = true;

  function loadStylesheet() {
    var href = '/app/css/dashboard-presentation-v2.css';
    if (d.querySelector('link[data-tc-dashboard-presentation="v2"]')) return;
    var link = d.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.tcDashboardPresentation = 'v2';
    d.head.appendChild(link);
  }

  function loadCalendarRuntime() {
    var src = '/app/js/views/dashboard-calendar-runtime.js';
    if (d.querySelector('script[data-tc-dashboard-calendar-runtime]')) return;
    var script = d.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.tcDashboardCalendarRuntime = '1';
    script.onerror = function () {
      console.warn('[DASHBOARD] Calendrier réel indisponible; conservation du flux existant.');
    };
    d.head.appendChild(script);
  }

  function apply() {
    loadStylesheet();
    loadCalendarRuntime();
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();
})(window, document);
