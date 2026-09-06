/* THE CAPITAL — header Institute link */
(function () {
  'use strict';
  function mount() {
    const nav = document.querySelector('.header .topnav');
    if (!nav || document.getElementById('nav-the-capital-institute')) return;
    if (!document.getElementById('tc-institute-link-style')) {
      const style = document.createElement('style');
      style.id = 'tc-institute-link-style';
      style.textContent = '.header .tc-institute-link{color:var(--cream)!important;text-decoration:none;white-space:nowrap}.header .tc-institute-link:hover{color:var(--gold)!important;background:rgba(184,150,78,.08)}@media(max-width:1100px){.header .tc-institute-link{font-size:11px!important;padding:7px 8px!important}.header .tc-institute-link span{display:none}}';
      document.head.appendChild(style);
    }
    const dashboard = document.getElementById('nav-overview');
    const wrap = document.createElement('div');
    wrap.className = 'nav-dropdown';
    wrap.innerHTML = '<a id="nav-the-capital-institute" class="nav-dropdown-btn tc-institute-link" href="/the-capital-institute/" aria-label="The Capital Institute"><span>◉</span> The Capital Institute</a>';
    if (dashboard?.parentElement) {
      dashboard.parentElement.insertAdjacentElement('afterend', wrap);
      const divider = document.createElement('div');
      divider.className = 'topnav-divider';
      wrap.insertAdjacentElement('afterend', divider);
    } else {
      nav.appendChild(wrap);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
  window.addEventListener('load', mount, { once: true });
})();
