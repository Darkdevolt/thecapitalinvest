/* THE CAPITAL — header runtime compatibility module.
 *
 * header-final.css is the canonical header/dropdown layout. The previous
 * runtime module injected a second set of !important rules after page load,
 * competing with header-final.css. It is intentionally inert now.
 */
(function(){
  'use strict';
  if(window.__TC_HEADER_RUNTIME_FIX__) return;
  window.__TC_HEADER_RUNTIME_FIX__=true;
})();
