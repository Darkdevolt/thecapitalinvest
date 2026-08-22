(() => {
  'use strict';

  const header = document.querySelector('header');
  const toggle = document.getElementById('hamburger');
  const menu = document.getElementById('mobile-menu');
  if (!header || !toggle || !menu) return;

  let backdrop = document.getElementById('mobile-nav-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'mobile-nav-backdrop';
    backdrop.className = 'mobile-nav-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    header.insertAdjacentElement('afterend', backdrop);
  }

  let scrollY = 0;

  const close = (restoreFocus = false) => {
    if (!menu.classList.contains('open')) return;
    menu.classList.remove('open');
    toggle.classList.remove('open');
    backdrop.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Ouvrir le menu');
    document.body.classList.remove('menu-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
    if (restoreFocus) toggle.focus();
  };

  const open = () => {
    scrollY = window.scrollY || 0;
    menu.classList.add('open');
    toggle.classList.add('open');
    backdrop.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Fermer le menu');
    document.body.classList.add('menu-open');
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  };

  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'mobile-menu');
  toggle.addEventListener('click', () => {
    if (menu.classList.contains('open')) close();
    else open();
  });

  backdrop.addEventListener('click', () => close());
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => close()));

  document.addEventListener('click', (event) => {
    if (!menu.classList.contains('open')) return;
    if (menu.contains(event.target) || toggle.contains(event.target)) return;
    close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('open')) {
      event.preventDefault();
      close(true);
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) close();
  });
})();
