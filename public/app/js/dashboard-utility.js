/* THE CAPITAL — dashboard utility compatibility module.
 *
 * Older versions injected a theme button and a temporary investor briefing
 * after 250/800 ms. That created a second layout pass and could race the
 * overview data renderer. The canonical account menu owns theme control and
 * overview-insights owns dashboard content, so this compatibility module is
 * intentionally inert.
 */
(function(){
  'use strict';
  if(window.__TC_DASHBOARD_UTILITY__) return;
  window.__TC_DASHBOARD_UTILITY__=true;
})();
