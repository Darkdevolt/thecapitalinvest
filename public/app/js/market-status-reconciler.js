// THE CAPITAL — reconcile legacy view status writers with the central BRVM engine.
// market-ux.js is the only component allowed to own market-status DOM rendering.
(function (global) {
  'use strict';
  if (global.__TC_MARKET_STATUS_RECONCILER__) return;
  global.__TC_MARKET_STATUS_RECONCILER__ = true;

  function reconcile() {
    if (typeof global.renderOverview !== 'function' || global.renderOverview.__tcMarketWrapped) return false;
    var original = global.renderOverview;
    function wrappedRenderOverview() {
      var result = original.apply(this, arguments);
      if (global.TC_MARKET_UX && typeof global.TC_MARKET_UX.start === 'function') {
        global.TC_MARKET_UX.start();
      }
      return result;
    }
    wrappedRenderOverview.__tcMarketWrapped = true;
    wrappedRenderOverview.__tcOriginal = original;
    global.renderOverview = wrappedRenderOverview;
    return true;
  }

  if (!reconcile()) {
    var attempts = 0;
    var timer = global.setInterval(function () {
      attempts += 1;
      if (reconcile() || attempts >= 120) global.clearInterval(timer);
    }, 50);
  }
})(window);
