(function () {
  'use strict';

  var MODULES = [
    '/app/js/mode.js',
    '/app/js/theme.js',
    '/app/js/views/comparison.js',
    '/app/js/views/dividend-screener.js'
  ];

  function loadScript(src) {
    // On détecte les doublons de deux façons : un script déjà injecté par
    // header.js (attribut data-tc-header-module) OU un script déjà présent
    // en statique dans la page (ex: mode.js / comparison.js / dividend-
    // screener.js sont inclus en dur en bas de index.html). Sans ce second
    // test, ces fichiers étaient chargés une seconde fois, ce qui casse
    // silencieusement leur exécution (erreurs "already declared", listeners
    // dupliqués, vues à moitié initialisées).
    if (
      document.querySelector('script[data-tc-header-module="' + src + '"]') ||
      document.querySelector('script[src="' + src + '"]')
    ) {
      return;
    }

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
    // Ces scripts/styles ne doivent être injectés qu'une seule fois pour toute
    // la durée de vie de la page (loadScript/loadStyle le garantissent déjà).
    loadScript('/app/js/header-runtime-fix.js');
    loadScript('/app/js/header-polish.js');

    loadStyle('/app/css/scale-100.css', 'data-tc-scale-100');
    loadStyle('/app/css/header-final.css', 'data-tc-header-final');
    loadStyle('/app/css/theme-system.css', 'data-tc-theme-system');
    loadStyle('/app/css/visual-contrast.css', 'data-tc-visual-contrast');

    // loadScript() gère déjà la déduplication (statique + dynamique), donc
    // pas besoin de re-tester ici.
    MODULES.forEach(loadScript);
  }

  // ---- Menu compte -------------------------------------------------------
  // On garde une référence sur le noeud #topnavUser actuellement "câblé"
  // pour pouvoir détecter qu'un router a remplacé ce noeud par un nouveau
  // (cas SPA) et re-brancher les événements dessus.
  var wiredUserNode = null;
  var menuEl = null;

  function buildMenu() {
    var menu = document.createElement('div');
    menu.id = 'tcAccountMenu';
    menu.className = 'tc-account-menu';

    menu.innerHTML =
      '<div class="tc-account-head">' +
        '<div class="tc-account-kicker">ESPACE PERSONNEL</div>' +
        '<div class="tc-account-title">Mon compte</div>' +
      '</div>' +
      '<a href="/app/account.html" class="tc-account-item">' +
        '<span>\u25C9</span><div><b>Informations</b>' +
        '<small>Profil et informations du compte</small></div>' +
      '</a>' +
      '<a href="/app/account.html#preferences" class="tc-account-item">' +
        '<span>\u2699</span><div><b>Préférences</b>' +
        '<small>Apparence, devise et notifications</small></div>' +
      '</a>' +
      '<a href="/app/account.html#security" class="tc-account-item">' +
        '<span>\u25C7</span><div><b>Sécurité</b>' +
        '<small>Accès et session</small></div>' +
      '</a>' +
      '<a href="/app/account.html#subscription" class="tc-account-item">' +
        '<span>\u25A3</span><div><b>Abonnement</b>' +
        '<small>Formule et offres</small></div>' +
      '</a>' +
      '<div class="tc-account-separator"></div>' +
      '<button type="button" class="tc-account-theme" id="tcAccountTheme">' +
        '<span>\u2600</span> Apparence <strong>Sombre</strong>' +
      '</button>';

    document.body.appendChild(menu);
    return menu;
  }

  function positionMenu(user, menu) {
    var rect = user.getBoundingClientRect();
    var width = menu.offsetWidth || 285;

    // rect est relatif au viewport ; le menu est positionné en `fixed`
    // (voir note CSS plus bas) donc on n'ajoute PAS le scroll ici.
    var left = rect.right - width;
    left = Math.max(10, Math.min(left, window.innerWidth - width - 10));

    menu.style.top = Math.round(rect.bottom + 8) + 'px';
    menu.style.left = Math.round(left) + 'px';
  }

  function closeMenu(user, menu) {
    menu.classList.remove('open');
    user.setAttribute('aria-expanded', 'false');
  }

  function installAccountMenu() {
    var user = document.getElementById('topnavUser');
    if (!user) return;

    // Le noeud #topnavUser n'a pas changé depuis le dernier appel : rien à
    // refaire, les listeners sont toujours valides.
    if (user === wiredUserNode && menuEl) return;

    // Si un router a remplacé #topnavUser (SPA), on nettoie l'ancien menu
    // avant d'en recréer un propre, sinon on récupère l'existant au premier
    // chargement.
    if (menuEl && menuEl.parentNode) {
      menuEl.parentNode.removeChild(menuEl);
    }
    menuEl = document.getElementById('tcAccountMenu') || buildMenu();
    wiredUserNode = user;

    var menu = menuEl;

    user.style.cursor = 'pointer';
    user.setAttribute('role', 'button');
    user.setAttribute('tabindex', '0');
    user.setAttribute('aria-haspopup', 'true');
    user.setAttribute('aria-expanded', 'false');

    function toggle() {
      var open = menu.classList.toggle('open');
      user.setAttribute('aria-expanded', String(open));
      if (open) positionMenu(user, menu);
    }

    user.addEventListener('click', toggle);

    user.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
      if (event.key === 'Escape') {
        closeMenu(user, menu);
      }
    });

    document.addEventListener('click', function (event) {
      if (!menu.contains(event.target) && !user.contains(event.target)) {
        closeMenu(user, menu);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menu.classList.contains('open')) {
        closeMenu(user, menu);
        user.focus();
      }
    });

    // Repositionner sur resize ET sur scroll (utile sur mobile / zoom
    // navigateur, et pour toutes les échelles d'écran).
    window.addEventListener('resize', function () {
      if (menu.classList.contains('open')) positionMenu(user, menu);
    }, { passive: true });

    window.addEventListener('scroll', function () {
      if (menu.classList.contains('open')) positionMenu(user, menu);
    }, { passive: true });

    var themeButton = menu.querySelector('#tcAccountTheme');

    function syncThemeLabel() {
      var light = document.documentElement.dataset.theme === 'light';
      themeButton.querySelector('span').textContent = light ? '\u263E' : '\u2600';
      themeButton.querySelector('strong').textContent = light ? 'Clair' : 'Sombre';
    }

    themeButton.addEventListener('click', function (event) {
      event.stopPropagation();
      if (window.TCTheme && typeof window.TCTheme.toggle === 'function') {
        window.TCTheme.toggle();
      }
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

  // Surveille le header pour détecter un re-rendu côté router (SPA) et
  // rebrancher automatiquement le menu compte sur le nouveau noeud.
  var headerObserver = new MutationObserver(function () {
    installAccountMenu();
  });
  var headerRoot = document.querySelector('header') || document.body;
  headerObserver.observe(headerRoot, { childList: true, subtree: true });

  // Permet au router applicatif de forcer une re-synchro explicite après un
  // changement de vue, sans devoir recharger toute la page.
  window.TCHeader = { boot: boot, installAccountMenu: installAccountMenu };

  console.log('[HEADER] Composant header chargé — navigation déléguée au router');
})();
