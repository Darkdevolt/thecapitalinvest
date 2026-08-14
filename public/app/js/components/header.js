// THE CAPITAL — Header runtime
(function () {
  'use strict';
  if (window.__TC_HEADER_RUNTIME__) return;
  window.__TC_HEADER_RUNTIME__ = true;

  function closeDropdowns() {
    document.querySelectorAll('.nav-dropdown-menu.open').forEach(function (el) { el.classList.remove('open'); });
    document.querySelectorAll('.nav-dropdown-btn.open,.nav-dropdown-btn.active').forEach(function (el) {
      if (!el.closest('.nav-dropdown-menu')) el.classList.remove('open');
    });
    document.querySelectorAll('.nav-dropdown.open').forEach(function (el) { el.classList.remove('open'); });
  }

  function toggleDropdown(id) {
    var root = document.getElementById(id);
    if (!root) return false;
    var menu = root.querySelector('.nav-dropdown-menu');
    var btn = root.querySelector('.nav-dropdown-btn');
    if (!menu || !btn) return false;
    var open = menu.classList.contains('open');
    closeDropdowns();
    if (!open) {
      root.classList.add('open');
      menu.classList.add('open');
      btn.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    } else {
      btn.setAttribute('aria-expanded', 'false');
    }
    return !open;
  }

  window.closeDropdowns = closeDropdowns;
  window.toggleDropdown = toggleDropdown;

  function bindHeader() {
    var header = document.querySelector('.header');
    if (!header || header.dataset.tcHeaderBound === '1') return;
    header.dataset.tcHeaderBound = '1';

    header.addEventListener('click', function (event) {
      var button = event.target.closest('.nav-dropdown-btn');
      if (button) {
        var root = button.closest('.nav-dropdown');
        if (root && root.id) {
          event.preventDefault();
          event.stopPropagation();
          toggleDropdown(root.id);
          return;
        }
      }

      var item = event.target.closest('.nav-dropdown-item');
      if (item) {
        var onclick = item.getAttribute('onclick') || '';
        var match = onclick.match(/nav\(['\"]([^'\"]+)['\"]\)/);
        if (match && typeof window.nav === 'function') {
          event.preventDefault();
          event.stopPropagation();
          window.nav(match[1]);
          closeDropdowns();
        }
      }
    }, true);

    document.addEventListener('click', function (event) {
      if (!event.target.closest('.nav-dropdown')) closeDropdowns();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeDropdowns();
    });

    // Défense contre un CSS/patch qui rendrait le menu non cliquable.
    var style = document.getElementById('tc-header-runtime-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'tc-header-runtime-style';
      style.textContent = '.header,.topnav{position:relative;z-index:1000}.nav-dropdown{position:relative}.nav-dropdown-btn{position:relative;z-index:1002;cursor:pointer;pointer-events:auto}.nav-dropdown-menu{position:absolute;z-index:10010;pointer-events:auto}.nav-dropdown-menu.open{display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}.nav-dropdown-item{cursor:pointer;pointer-events:auto}';
      document.head.appendChild(style);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindHeader, { once: true });
  else bindHeader();

  // init.js peut remplacer les fonctions globales : on garde le binding DOM indépendant.
  window.addEventListener('load', bindHeader, { once: true });

  console.log('[HEADER] Runtime header chargé');
})();
