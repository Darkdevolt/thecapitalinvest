// COMPONENT, Single mobile navigation controller
// UI/navigation only. No API, Supabase, auth or market-data logic is modified.
(function(){
  'use strict';
  if(window.__TC_SINGLE_MOBILE_NAV__) return;
  window.__TC_SINGLE_MOBILE_NAV__ = true;
  function get(id){return document.getElementById(id);}

  function syncMobileIdentity(){
    var session=window.tcSession||null;
    var user=session&&session.user?session.user:null;
    var meta=user&&user.user_metadata?user.user_metadata:{};
    var nameEl=get('sidebarName');
    var roleEl=get('sidebarRole');
    var avatar=get('sidebarAvatar');
    var adminLink=get('adminLink');

    if(nameEl && (!nameEl.textContent.trim() || nameEl.textContent.trim()==='Chargement...')){
      var first=String(meta.first_name||meta.firstname||meta.prenom||'').trim();
      var last=String(meta.last_name||meta.lastname||meta.nom||'').trim();
      var full=String(meta.full_name||meta.fullName||meta.name||'').trim();
      var display=[first,last].filter(Boolean).join(' ')||full;
      if(display) nameEl.textContent=display;
      else if(user&&user.email) nameEl.textContent=user.email.split('@')[0];
    }

    if(roleEl && user){
      var role=String(meta.role||user.app_metadata?.role||'').trim();
      if(role) roleEl.textContent=role==='admin'||role==='administrator'||role==='super_admin'?'Administrateur':'BRVM';
    }

    if(avatar && nameEl){
      var initials=nameEl.textContent.trim().split(/\s+/).filter(Boolean).slice(0,2).map(function(part){return part.charAt(0).toUpperCase();}).join('');
      if(initials) avatar.textContent=initials;
    }

    if(adminLink && user){
      var role=String(meta.role||user.app_metadata?.role||'').toLowerCase();
      var isAdmin=role==='admin'||role==='administrator'||role==='super_admin';
      // Respect the existing server/auth decision when present; otherwise use the authenticated role.
      var alreadyVisible=adminLink.style.display && adminLink.style.display!=='none';
      adminLink.style.display=(alreadyVisible||isAdmin)?'block':'none';
    }
  }

  function ensureMobileIdentityStyles(){
    if(document.getElementById('tc-mobile-identity-fix')) return;
    var style=document.createElement('style');
    style.id='tc-mobile-identity-fix';
    style.textContent='@media (max-width:900px){'+
      '.sidebar.mobile-open{display:flex!important;flex-direction:column!important;align-items:stretch!important;width:min(86vw,360px)!important;max-width:360px!important;height:100dvh!important;max-height:100dvh!important;overflow:hidden!important;padding:0!important;left:0!important;right:auto!important;top:0!important;bottom:0!important}'+
      '.sidebar.mobile-open .tc-mobile-generated{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;padding:8px 10px 14px!important}'+
      '.sidebar.mobile-open .sidebar-bottom{position:relative!important;flex:0 0 auto!important;width:100%!important;margin:0!important;padding:12px 14px max(14px,env(safe-area-inset-bottom))!important;border-top:1px solid var(--border2)!important;background:var(--bg)!important;z-index:5!important}'+
      '.sidebar.mobile-open .user-info{width:100%!important;min-width:0!important;margin:0!important;padding:10px 12px!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important}'+
      '.sidebar.mobile-open .user-avatar{flex:0 0 32px!important;width:32px!important;height:32px!important;margin:0!important}'+
      '.sidebar.mobile-open .user-info>div[style*="flex:1"]{flex:1 1 auto!important;min-width:0!important;text-align:left!important;overflow:hidden!important}'+
      '.sidebar.mobile-open .user-name,.sidebar.mobile-open .user-role{display:block!important;width:100%!important;text-align:left!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}'+
      '.sidebar.mobile-open #adminLink{width:100%!important;margin-top:8px!important}'+
      '.sidebar.mobile-open #adminLink a{width:100%!important;justify-content:flex-start!important}'+
      '.sidebar.mobile-open .sidebar-bottom>button{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;min-height:38px!important;margin-top:8px!important}'+
      '}'+
      '@media (max-width:430px){.sidebar.mobile-open{width:min(88vw,340px)!important}.sidebar.mobile-open .sidebar-bottom{padding-left:12px!important;padding-right:12px!important}}'+
      '@media (max-width:360px){.sidebar.mobile-open{width:92vw!important}.sidebar.mobile-open .sidebar-bottom{padding-left:10px!important;padding-right:10px!important}}';
    document.head.appendChild(style);
  }

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
    ensureMobileIdentityStyles();
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
    syncMobileIdentity();
  }

  function initSidebar(){ensureMobileMenu();syncMobileDestinations();bindSidebarItems();syncMobileIdentity();window.toggleSidebar=toggleSidebar;window.openSidebar=openSidebar;window.closeSidebar=closeSidebar;}
  window.initSidebar=initSidebar;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initSidebar,{once:true});else initSidebar();
})();