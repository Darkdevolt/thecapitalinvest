// COMPONENT — Single mobile navigation controller
// UI/navigation only. No API, Supabase, auth or market-data logic is modified.
(function(){
  'use strict';
  if(window.__TC_SINGLE_MOBILE_NAV__) return;
  window.__TC_SINGLE_MOBILE_NAV__ = true;
  function get(id){return document.getElementById(id);}

  function closeLegacyNavigation(){
    ['hamburger','mobile-menu','mobile-nav-backdrop'].forEach(function(id){var el=get(id);if(el)el.remove();});
    document.querySelectorAll('.mobile-nav-backdrop').forEach(function(el){el.remove();});
  }

  function removeLegacyHeaderToggles(){
    var header=document.querySelector('.header');if(!header)return;
    header.querySelectorAll('button,[role="button"]').forEach(function(el){
      if(el.id==='tcMobileMenu')return;
      var id=(el.id||'').toLowerCase(),cls=(typeof el.className==='string'?el.className:'').toLowerCase(),aria=(el.getAttribute('aria-label')||'').toLowerCase(),title=(el.getAttribute('title')||'').toLowerCase();
      var legacy=/hamburger|mobile-menu|menu-toggle|sidebar-toggle|mobile-toggle|mobilemenu|sidebarmenu/.test(id+' '+cls)||/ouvrir le menu|fermer le menu/.test(aria+' '+title);
      if(legacy)el.remove();
    });
  }

  function closeSidebar(restoreFocus){
    var sidebar=get('sidebar'),overlay=get('overlay'),btn=get('tcMobileMenu');
    if(sidebar)sidebar.classList.remove('mobile-open');
    if(overlay)overlay.classList.remove('mobile-open');
    document.body.classList.remove('menu-open');
    if(btn){btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-label','Ouvrir le menu');if(restoreFocus&&typeof btn.focus==='function')btn.focus({preventScroll:true});}
  }

  function openSidebar(){
    var sidebar=get('sidebar'),overlay=get('overlay'),btn=get('tcMobileMenu');if(!sidebar)return;
    closeLegacyNavigation();sidebar.classList.add('mobile-open');if(overlay)overlay.classList.add('mobile-open');document.body.classList.add('menu-open');
    if(btn){btn.setAttribute('aria-expanded','true');btn.setAttribute('aria-label','Fermer le menu');}
  }
  function toggleSidebar(){var sidebar=get('sidebar');if(sidebar&&sidebar.classList.contains('mobile-open'))closeSidebar(false);else openSidebar();}

  function bindSidebarItems(){
    var sidebar=get('sidebar');if(!sidebar)return;
    sidebar.querySelectorAll('.nav-item').forEach(function(el){
      el.setAttribute('role','button');el.setAttribute('tabindex','0');
      if(el.dataset.tcMobileBound==='1')return;el.dataset.tcMobileBound='1';
      el.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}});
      el.addEventListener('click',function(){window.setTimeout(function(){closeSidebar(false);},0);});
    });
  }

  function ensureMobileMenu(){
    var header=document.querySelector('.header');if(!header)return;
    closeLegacyNavigation();removeLegacyHeaderToggles();
    var btn=get('tcMobileMenu');
    if(!btn){
      btn=document.createElement('button');btn.id='tcMobileMenu';btn.type='button';btn.className='mobile-menu-toggle';
      btn.setAttribute('aria-label','Ouvrir le menu');btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls','sidebar');
      btn.innerHTML='<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';header.insertBefore(btn,header.firstChild);
    }
    if(btn.dataset.tcBound!=='1'){btn.dataset.tcBound='1';btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();toggleSidebar();});}
  }

  function navTarget(el){
    var onclick=el.getAttribute('onclick')||'';var match=onclick.match(/nav\(['"]([^'"]+)['"]\)/);return match?match[1]:'';
  }

  function syncMobileDestinations(){
    var sidebar=get('sidebar'),topnav=document.querySelector('.topnav');if(!sidebar||!topnav)return;
    var bottom=sidebar.querySelector('.sidebar-bottom');if(!bottom)return;
    // Capture sidebar-only destinations before replacing the generated navigation.
    var legacyItems=Array.from(sidebar.querySelectorAll('.nav-item[onclick]')).map(function(el){return{el:el,target:navTarget(el),group:(function(){var p=el.previousElementSibling;while(p){if(p.classList.contains('sidebar-section'))return p.textContent.trim();p=p.previousElementSibling;}return 'Autres';})()};});
    var existing=sidebar.querySelector('.tc-mobile-generated');if(existing)existing.remove();
    var generated=document.createElement('div');generated.className='tc-mobile-generated';
    var targets=new Set();

    var overview=topnav.querySelector('#nav-overview');
    if(overview){
      var overviewItem=document.createElement('div');overviewItem.className='nav-item active';overviewItem.setAttribute('role','button');overviewItem.setAttribute('tabindex','0');
      overviewItem.innerHTML='<span class="icon">◈</span> '+overview.textContent.replace(/^\s*◈\s*/,'').trim();
      overviewItem.addEventListener('click',function(){if(typeof window.nav==='function')window.nav('overview');closeSidebar(false);});
      overviewItem.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();overviewItem.click();}});generated.appendChild(overviewItem);targets.add('overview');
    }

    topnav.querySelectorAll('.nav-dropdown').forEach(function(dropdown){
      var label=dropdown.querySelector('.nav-dropdown-label');var items=dropdown.querySelectorAll('.nav-dropdown-item[onclick]');if(!items.length)return;
      var section=document.createElement('div');section.className='tc-mobile-group';var title=document.createElement('div');title.className='sidebar-section';
      title.textContent=label?label.textContent.trim():(dropdown.querySelector('.nav-dropdown-btn')?.textContent||'').replace(/▼/g,'').trim();section.appendChild(title);
      items.forEach(function(source){
        var target=navTarget(source);if(!target)return;targets.add(target);
        var item=document.createElement('div');item.className='nav-item';item.innerHTML=source.innerHTML;item.setAttribute('role','button');item.setAttribute('tabindex','0');
        item.addEventListener('click',function(){if(typeof window.nav==='function')window.nav(target);closeSidebar(false);});
        item.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();item.click();}});section.appendChild(item);
      });generated.appendChild(section);
    });

    // Preserve destinations that exist in the application sidebar but are not
    // represented by the desktop dropdowns (e.g. the dedicated Marché view).
    legacyItems.forEach(function(entry){
      if(!entry.target||targets.has(entry.target))return;
      var section=Array.from(generated.querySelectorAll('.tc-mobile-group')).find(function(s){var h=s.querySelector('.sidebar-section');return h&&h.textContent.trim()===entry.group;});
      if(!section){section=document.createElement('div');section.className='tc-mobile-group';var h=document.createElement('div');h.className='sidebar-section';h.textContent=entry.group||'Autres';section.appendChild(h);generated.appendChild(section);}
      var item=document.createElement('div');item.className='nav-item';item.innerHTML=entry.el.innerHTML;item.setAttribute('role','button');item.setAttribute('tabindex','0');
      var target=entry.target;item.addEventListener('click',function(){if(typeof window.nav==='function')window.nav(target);closeSidebar(false);});item.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();item.click();}});section.appendChild(item);targets.add(target);
    });

    sidebar.insertBefore(generated,bottom);
    sidebar.querySelectorAll('.sidebar-section:not(.tc-mobile-generated .sidebar-section), .sidebar > .nav-item').forEach(function(el){el.remove();});
    bindSidebarItems();
  }

  function initSidebar(){ensureMobileMenu();syncMobileDestinations();bindSidebarItems();window.toggleSidebar=toggleSidebar;window.openSidebar=openSidebar;window.closeSidebar=closeSidebar;}
  window.initSidebar=initSidebar;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initSidebar,{once:true});else initSidebar();
})();