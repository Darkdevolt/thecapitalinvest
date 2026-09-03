// THE CAPITAL — Header component
// Single responsibility: account menu + header-specific presentation modules.
// Navigation behavior is owned by router.js. Dropdown state MUST NOT be redefined here.
(function () {
  'use strict';

  if (window.__TC_HEADER_COMPONENT__) return;
  window.__TC_HEADER_COMPONENT__ = true;

  function loadScript(src) {
    if (document.querySelector('script[data-tc-header-module="' + src + '"]')) return;
    var script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.tcHeaderModule = src;
    script.onerror = function () {
      console.warn('[HEADER] Module indisponible:', src);
    };
    document.body.appendChild(script);
  }

  function loadStyle(href, attr) {
    if (document.querySelector('link[' + attr + '="' + href + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(attr, href);
    document.head.appendChild(link);
  }

  function installHeaderPresentation() {
    // Router.js already defines the canonical toggleDropdown / closeDropdowns.
    // Do not redefine them here: CSS opens .nav-dropdown-menu.open, not the parent.
    loadScript('/app/js/header-runtime-fix.js');
    loadScript('/app/js/header-polish.js');

    loadStyle('/app/css/header-responsive.css', 'data-tc-header-responsive');
    loadStyle('/app/css/scale-100.css', 'data-tc-scale-100');
    loadStyle('/app/css/header-final.css', 'data-tc-header-final');
    loadStyle('/app/css/theme-system.css', 'data-tc-theme-system');
    loadStyle('/app/css/visual-contrast.css', 'data-tc-visual-contrast');
    loadStyle('/app/css/dashboard-utility.css', 'data-tc-dashboard-utility');
  }

  function installAccountMenu() {
    var user = document.getElementById('topnavUser');
    if (!user || document.getElementById('tcAccountMenu')) return;

    user.style.cursor = 'pointer';
    user.setAttribute('role', 'button');
    user.setAttribute('tabindex', '0');
    user.setAttribute('aria-haspopup', 'true');
    user.setAttribute('aria-expanded', 'false');

    var menu = document.createElement('div');
    menu.id = 'tcAccountMenu';
    menu.className = 'tc-account-menu';
    menu.innerHTML = '' +
      '<div class="tc-account-head">' +
        '<div class="tc-account-kicker">ESPACE PERSONNEL</div>' +
        '<div class="tc-account-title">Mon compte</div>' +
      '</div>' +
      '<a href="/app/account.html" class="tc-account-item"><span>◉</span><div><b>Informations</b><small>Profil et informations du compte</small></div></a>' +
      '<a href="/app/account.html#preferences" class="tc-account-item"><span>⚙</span><div><b>Préférences</b><small>Apparence, devise et notifications</small></div></a>' +
      '<a href="/app/account.html#security" class="tc-account-item"><span>◇</span><div><b>Sécurité</b><small>Accès et session</small></div></a>' +
      '<a href="/app/account.html#subscription" class="tc-account-item"><span>▣</span><div><b>Abonnement</b><small>Formule et offres</small></div></a>' +
      '<div class="tc-account-separator"></div>' +
      '<button type="button" class="tc-account-theme" id="tcAccountTheme"><span>☼</span> Apparence <strong>Sombre</strong></button>';
    document.body.appendChild(menu);

    if (!document.getElementById('tc-account-menu-inline-css')) {
      var style = document.createElement('style');
      style.id = 'tc-account-menu-inline-css';
      style.textContent = '' +
        '.tc-account-menu{position:fixed;z-index:10000;width:285px;padding:8px;background:var(--surface,#11100c);border:1px solid rgba(184,150,78,.25);border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.38);display:none;backdrop-filter:blur(18px)}' +
        '.tc-account-menu.open{display:block}' +
        '.tc-account-head{padding:10px 12px 12px;border-bottom:1px solid rgba(184,150,78,.1);margin-bottom:4px}' +
        '.tc-account-kicker{font:500 7px var(--mono,monospace);letter-spacing:.16em;color:var(--gold,#b8964e)}' +
        '.tc-account-title{font:600 20px var(--serif,Georgia,serif);margin-top:3px;color:var(--cream,#f4efe6)}' +
        '.tc-account-item{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:7px;color:var(--cream,#f4efe6);text-decoration:none}' +
        '.tc-account-item:hover{background:rgba(184,150,78,.08)}' +
        '.tc-account-item>span{width:20px;text-align:center;color:var(--gold-light,#e0c176);font-size:14px}' +
        '.tc-account-item b{display:block;font:500 10px var(--sans,Arial,sans-serif)}' +
        '.tc-account-item small{display:block;color:var(--muted,rgba(244,239,230,.6));font-size:8px;margin-top:2px}' +
        '.tc-account-separator{height:1px;background:rgba(184,150,78,.1);margin:5px 0}' +
        '.tc-account-theme{width:100%;border:0;background:transparent;color:var(--cream,#f4efe6);display:flex;align-items:center;gap:9px;padding:10px 12px;border-radius:7px;font:500 9px var(--mono,monospace);cursor:pointer;text-align:left}' +
        '.tc-account-theme:hover{background:rgba(184,150,78,.08)}' +
        '.tc-account-theme span{color:var(--gold-light,#e0c176);font-size:15px}.tc-account-theme strong{margin-left:auto;color:var(--muted,rgba(244,239,230,.6));font-weight:400}' +
        'body[data-theme="light"] .tc-account-menu{background:#fffdf9;border-color:rgba(55,45,28,.15)}' +
        'body[data-theme="light"] .tc-account-title,body[data-theme="light"] .tc-account-item,body[data-theme="light"] .tc-account-theme{color:#1d1a15}' +
        'body[data-theme="light"] .tc-account-item small,body[data-theme="light"] .tc-account-theme strong{color:rgba(29,26,21,.58)}';
      document.head.appendChild(style);
    }

    function position() {
      var rect = user.getBoundingClientRect();
      var width = 285;
      var left = rect.right - width;
      left = Math.max(10, Math.min(left, window.innerWidth - width - 10));
      menu.style.top = Math.round(rect.bottom + 8) + 'px';
      menu.style.left = Math.round(left) + 'px';
    }

    function toggle() {
      var open = menu.classList.toggle('open');
      user.setAttribute('aria-expanded', String(open));
      if (open) position();
    }

    user.addEventListener('click', toggle);
    user.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    });
    document.addEventListener('click', function (event) {
      if (!menu.contains(event.target) && !user.contains(event.target)) {
        menu.classList.remove('open');
        user.setAttribute('aria-expanded', 'false');
      }
    });
    window.addEventListener('resize', function () {
      if (menu.classList.contains('open')) position();
    }, { passive: true });

    var themeButton = menu.querySelector('#tcAccountTheme');
    function syncThemeLabel() {
      var light = document.documentElement.dataset.theme === 'light';
      themeButton.querySelector('span').textContent = light ? '☾' : '☼';
      themeButton.querySelector('strong').textContent = light ? 'Clair' : 'Sombre';
    }
    themeButton.addEventListener('click', function (event) {
      event.stopPropagation();
      if (window.TCTheme && typeof window.TCTheme.toggle === 'function') window.TCTheme.toggle();
      syncThemeLabel();
    });
    window.addEventListener('tc:theme-change', syncThemeLabel);
    setTimeout(syncThemeLabel, 100);
  }

  function boot() {
    installHeaderPresentation();
    installAccountMenu();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  console.log('[HEADER] Composant header chargé — navigation déléguée au router');
})();
