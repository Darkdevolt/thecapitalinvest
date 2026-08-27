// ═══════════════════════════════════════
// COMPONENT, Header
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
    'app/js/views/dividend-screener.js',
    'app/js/header-polish.js'
  ];
  scripts.forEach(src => {
    if (document.querySelector(`script[data-tc-module="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.dataset.tcModule = src;
    document.body.appendChild(script);
  });

  const cssHref = 'app/css/header-responsive.css';
  if (!document.querySelector(`link[data-tc-header-responsive="${cssHref}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssHref;
    link.dataset.tcHeaderResponsive = cssHref;
    document.head.appendChild(link);
  }

  // Final header layer is deliberately loaded after all legacy responsive rules.
  const finalCssHref = 'app/css/header-final.css';
  if (!document.querySelector(`link[data-tc-header-final="${finalCssHref}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = finalCssHref;
    link.dataset.tcHeaderFinal = finalCssHref;
    document.head.appendChild(link);
  }

  const scaleHref = 'app/css/scale-100.css';
  if (!document.querySelector(`link[data-tc-scale-100="${scaleHref}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = scaleHref;
    link.dataset.tcScale100 = scaleHref;
    document.head.appendChild(link);
  }
})();
