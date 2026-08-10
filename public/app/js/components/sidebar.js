// COMPONENT — Sidebar / mobile navigation
// UI uniquement : toutes les destinations existantes restent disponibles.
(function(){
  'use strict';
  function closeSidebar(){
    var sidebar=document.getElementById('sidebar'),overlay=document.getElementById('overlay'),btn=document.getElementById('tcMobileMenu');
    if(sidebar)sidebar.classList.remove('mobile-open');
    if(overlay)overlay.classList.remove('mobile-open');
    document.body.classList.remove('menu-open');
    if(btn)btn.setAttribute('aria-expanded','false');
  }
  function openSidebar(){
    var sidebar=document.getElementById('sidebar'),overlay=document.getElementById('overlay'),btn=document.getElementById('tcMobileMenu');
    if(!sidebar)return;
    sidebar.classList.add('mobile-open');
    if(overlay)overlay.classList.add('mobile-open');
    document.body.classList.add('menu-open');
    if(btn)btn.setAttribute('aria-expanded','true');
  }
  function toggleSidebar(){
    var sidebar=document.getElementById('sidebar');
    if(sidebar&&sidebar.classList.contains('mobile-open'))closeSidebar();else openSidebar();
  }
  function ensureMobileMenu(){
    var header=document.querySelector('.header');
    if(!header||document.getElementById('tcMobileMenu'))return;
    var btn=document.createElement('button');
    btn.id='tcMobileMenu';btn.type='button';btn.className='mobile-menu-toggle';btn.setAttribute('aria-label','Ouvrir le menu');btn.setAttribute('aria-expanded','false');btn.innerHTML='<span></span><span></span><span></span>';
    btn.addEventListener('click',toggleSidebar);
    header.insertBefore(btn,header.firstChild);
  }
  function ensureAllMobileNavItems(){
    var sidebar=document.getElementById('sidebar');if(!sidebar)return;
    // Ne filtre aucune destination : le mobile doit exposer le même périmètre fonctionnel que desktop/iPad.
    sidebar.querySelectorAll('.sidebar-section,.nav-item,.sidebar-bottom').forEach(function(el){el.style.removeProperty('display');el.style.removeProperty('visibility');});
    sidebar.querySelectorAll('.nav-item').forEach(function(el){el.setAttribute('role','button');el.setAttribute('tabindex','0');if(!el.dataset.mobileKey){el.dataset.mobileKey='1';el.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}});el.addEventListener('click',function(){setTimeout(closeSidebar,80);});}});
  }
  function initSidebar(){ensureMobileMenu();ensureAllMobileNavItems();window.toggleSidebar=toggleSidebar;window.closeSidebar=closeSidebar;}
  window.initSidebar=initSidebar;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initSidebar);else initSidebar();
})();
