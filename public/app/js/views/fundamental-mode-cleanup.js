/* The Capital Invest — Fundamental mode control cleanup
 * Keeps the existing Analyse fondamentale SIMPLE/PRO control as the single source of truth.
 * The enhancement layer must not create a second mode switch in the header.
 */
(function () {
  'use strict';

  function cleanup() {
    var view = document.getElementById('view-analyse-fondamentale');
    if (!view) return;

    // The PRO enhancement previously injected its own header tools, including
    // a second SIMPLE/PRO toggle. Remove only that injected wrapper; preserve
    // the original module header and its existing mode control.
    view.querySelectorAll('.fund-pro-tools').forEach(function (el) {
      el.remove();
    });

    // Defensive cleanup: if a stale enhancement instance left duplicate mode
    // toggles inside the view, keep the first existing control and remove later
    // enhancement copies. Never remove the module's original header control.
    var toggles = view.querySelectorAll('.fund-pro-mode');
    toggles.forEach(function (el) { el.remove(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanup, { once: true });
  } else {
    cleanup();
  }

  // Enhancement rendering can happen after initial DOM load, so observe only
  // the fundamental view and remove newly injected duplicate wrappers.
  var observer = new MutationObserver(function () { cleanup(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(function () { try { observer.disconnect(); } catch (e) {} }, 10000);
})();
