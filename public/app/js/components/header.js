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
  // IMPORTANT: this file is loaded from /app/app.html.
  // Paths must therefore be absolute /app/... and never app/...
  // Otherwise the browser resolves them as /app/app/...
  const scripts = [
    '/app/js/mode.js',
    '/app/js/views/comparison.js',
    '/app/js/views/dividend-screener.js',
    '/app/js/header-polish.js',
    '/app/js/theme.js'
  ];
  scripts.forEach(src => {
    if (document.querySelector(`script[data-tc-module="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.dataset.tcModule = src;
    document.body.appendChild(script);
  });

  const cssHref = '/app/css/header-responsive.css';
  if (!document.querySelector(`link[data-tc-header-responsive="${cssHref}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssHref;
    link.dataset.tcHeaderResponsive = cssHref;
    document.head.appendChild(link);
  }

  // Density first, final header rules last so no legacy layer can override them.
  const scaleHref = '/app/css/scale-100.css';
  if (!document.querySelector(`link[data-tc-scale-100="${scaleHref}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = scaleHref;
    link.dataset.tcScale100 = scaleHref;
    document.head.appendChild(link);
  }

  const finalCssHref = '/app/css/header-final.css';
  if (!document.querySelector(`link[data-tc-header-final="${finalCssHref}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = finalCssHref;
    link.dataset.tcHeaderFinal = finalCssHref;
    document.head.appendChild(link);
  }

  // Header clock: one reference only — BRVM / Abidjan.
  const singleClockHref = '/app/css/header-clock-single.css';
  if (!document.querySelector(`link[data-tc-header-clock-single="${singleClockHref}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = singleClockHref;
    link.dataset.tcHeaderClockSingle = singleClockHref;
    document.head.appendChild(link);
  }

  // Final density corrections must load after every legacy header layer.
  const fixesHref = '/app/css/header-fixes.css';
  if (!document.querySelector(`link[data-tc-header-fixes="${fixesHref}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = fixesHref;
    link.dataset.tcHeaderFixes = fixesHref;
    document.head.appendChild(link);
  }

  // Institutional white / ivory theme. Dark remains the default.
  const lightThemeHref = '/app/css/theme-light.css';
  if (!document.querySelector(`link[data-tc-theme-light="${lightThemeHref}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = lightThemeHref;
    link.dataset.tcThemeLight = lightThemeHref;
    document.head.appendChild(link);
  }
})();
