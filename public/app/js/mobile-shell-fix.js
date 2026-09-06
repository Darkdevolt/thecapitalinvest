/* THE CAPITAL — mobile shell compatibility */
(function(w){
  'use strict';
  if(w.__TC_MOBILE_SHELL_FIX__) return;
  w.__TC_MOBILE_SHELL_FIX__=true;
  function el(id){return document.getElementById(id)}
  function syncButton(open){var b=el('tcMobileMenu');if(!b)return;b.setAttribute('aria-expanded',open?'true':'false');b.setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu')}
  function syncIdentity(){var s=w.tcSession||{},u=s.user||{},m=u.user_metadata||{},name=String(m.full_name||m.fullName||m.name||[m.first_name||m.firstname,m.last_name||m.lastname].filter(Boolean).join(' ')||'').trim()||String(u.email||'').split('@')[0]||'—';var n=el('headerName'),a=el('headerAvatar');if(n)n.textContent=name;if(a){var parts=name.split(/\s+/).filter(Boolean).slice(0,2),initials=parts.map(function(x){return x.charAt(0).toUpperCase()}).join('');a.textContent=initials||'TC'}}
  function syncOverlay(open){var o=el('overlay');if(!o)return;o.classList.toggle('mobile-open',open);o.setAttribute('aria-hidden',open?'false':'true')}
  function close(){var s=el('sidebar');if(s)s.classList.remove('mobile-open','open');syncOverlay(false);syncButton(false);document.body.classList.remove('menu-open')}
  function open(){var s=el('sidebar');if(!s)return;s.classList.add('mobile-open');s.classList.remove('open');syncOverlay(true);syncButton(true);document.body.classList.add('menu-open')}
  function toggle(){var s=el('sidebar');if(s&&s.classList.contains('mobile-open'))close();else open()}
  function buildMobileNavigation(){
    var sidebar=el('sidebar'),header=document.querySelector('.tc-simple-header');if(!sidebar||!header)return;
    var bottom=sidebar.querySelector('.sidebar-bottom');if(!bottom)return;
    var old=sidebar.querySelector('.tc-mobile-generated');if(old)old.remove();
    var generated=document.createElement('div');generated.className='tc-mobile-generated';generated.setAttribute('role','navigation');generated.setAttribute('aria-label','Navigation mobile');var seen=new Set();
    function addItem(route,label,icon,group){if(!route||seen.has(route))return;seen.add(route);var item=document.createElement('button');item.type='button';item.className='nav-item';item.setAttribute('data-route',route);item.innerHTML='<span class="icon">'+(icon||'•')+'</span> '+label;item.addEventListener('click',function(){if(typeof w.nav==='function')w.nav(route);close()});(group||generated).appendChild(item)}
    var overview=header.querySelector('[data-route="overview"]');if(overview)addItem('overview','Tableau de bord','◈');
    header.querySelectorAll('.tc-primary-nav > .tc-nav-link[data-route]').forEach(function(source){addItem(source.getAttribute('data-route'),source.textContent.trim(),'•')});
    header.querySelectorAll('.tc-nav-more-menu .nav-dropdown-item[data-route]').forEach(function(source){var route=source.getAttribute('data-route');if(!route||seen.has(route))return;var group=generated.querySelector('[data-mobile-group="plus"]');if(!group){group=document.createElement('div');group.className='tc-mobile-group';group.setAttribute('data-mobile-group','plus');var title=document.createElement('div');title.className='sidebar-section';title.textContent='Autres services';group.appendChild(title);generated.appendChild(group)}var label=source.querySelector('div > div')?.textContent.trim()||source.textContent.trim();addItem(route,label,'•',group)});
    sidebar.insertBefore(generated,bottom);sidebar.querySelectorAll(':scope > .sidebar-section,:scope > .nav-item').forEach(function(node){node.remove()});
  }
  function boot(){
    buildMobileNavigation();syncIdentity();w.openSidebar=open;w.closeSidebar=close;w.toggleSidebar=toggle;
    var b=el('tcMobileMenu');if(b&&b.dataset.tcMobileFix!=='1'){b.dataset.tcMobileFix='1';b.addEventListener('click',function(e){e.preventDefault();e.stopImmediatePropagation();toggle()},true)}
    var o=el('overlay');if(o&&o.dataset.tcMobileFix!=='1'){o.dataset.tcMobileFix='1';o.addEventListener('click',function(){close()})}
    syncOverlay(false);syncButton(false)
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,0)},{once:true});else setTimeout(boot,0);
  w.addEventListener('tc:header-ready',function(){setTimeout(boot,0)});
})(window);
