// ═══════════════════════════════════════
// COMPONENT — Header
// ═══════════════════════════════════════

// Header-related logic extracted from router.js
// Includes: topnav, dropdowns, global search integration

function initHeader() {
  // Header initialization logic
  // Clock, search, user info updates
}

(function loadDisplayAndProductModules(){
  const scripts = [
    'app/js/mode.js',
    'app/js/views/comparison.js',
    'app/js/views/dividend-screener.js'
  ];
  scripts.forEach(src => {
    if (document.querySelector(`script[data-tc-module="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.dataset.tcModule = src;
    document.body.appendChild(script);
  });
})();
