/* The Capital — Unified application header
 * UI/navigation only. Does not touch API, Supabase, auth or market data.
 * The complete header runtime lives here; CSS is injected locally to avoid
 * another header-specific stylesheet and to keep the shell easy to maintain.
 */
(function(){
  'use strict';
  if(window.__TC_UNIFIED_HEADER__) return;
  window.__TC_UNIFIED_HEADER__ = true;

  var $ = function(id){ return document.getElementById(id); };
  var qs = function(sel, root){ return (root || document).querySelector(sel); };
  var qsa = function(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function injectStyles(){
    if($('tc-unified-header-style')) return;
    var s=document.createElement('style'); s.id='tc-unified-header-style';
    s.textContent=`
      :root{--tc-gold:#c9a24a;--tc-gold-soft:#e3c77b;--tc-header-h:72px}
      .topnav{position:sticky;top:0;z-index:1000;min-height:var(--tc-header-h);display:flex;align-items:center;gap:4px;padding:0 18px;background:var(--bg,#171310);border-bottom:1px solid var(--border2,rgba(201,162,74,.18));box-sizing:border-box}
      .topnav-logo{flex:0 0 auto;display:flex;align-items:center;height:44px;padding:0 14px 0 4px;font-family:'Playfair Display',serif;font-weight:700;letter-spacing:.14em;color:var(--text,#f4efe5);cursor:pointer;white-space:nowrap}
      .topnav-logo span{color:var(--tc-gold);margin:0 .14em}
      .nav-dropdown{position:relative;flex:0 0 auto}
      .nav-dropdown-btn{appearance:none;border:0;background:transparent;color:var(--muted,#a9a39a);height:42px;padding:0 12px;border-radius:8px;font:500 13px/1 'DM Sans',sans-serif;display:flex;align-items:center;gap:7px;cursor:pointer;white-space:nowrap;transition:.18s ease}
      .nav-dropdown-btn:hover,.nav-dropdown-btn[aria-expanded=true],.nav-dropdown-btn.active{color:var(--text,#fff);background:rgba(201,162,74,.08)}
      .nav-dropdown-btn>span:first-child{color:var(--tc-gold)}
      .caret{font-size:9px;color:var(--muted,#999);transition:transform .18s ease}.nav-dropdown-btn[aria-expanded=true] .caret{transform:rotate(180deg)}
      .topnav-divider{width:1px;height:22px;background:var(--border2,rgba(255,255,255,.08));margin:0 4px}
      .nav-dropdown-menu{display:none;position:absolute;top:calc(100% + 8px);left:0;min-width:250px;padding:8px;background:var(--panel,#211d19);border:1px solid var(--border2,rgba(201,162,74,.2));border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.35)}
      .nav-dropdown.open .nav-dropdown-menu{display:block}
      .nav-dropdown-label{padding:7px 10px 6px;color:var(--tc-gold);font:600 10px/1 'DM Sans',sans-serif;text-transform:uppercase;letter-spacing:.12em}
      .nav-dropdown-item{width:100%;box-sizing:border-box;border:0;background:transparent;color:var(--text,#eee);display:flex;align-items:center;gap:10px;text-align:left;padding:10px;border-radius:8px;font:500 13px/1.2 'DM Sans',sans-serif;cursor:pointer}
      .nav-dropdown-item:hover,.nav-dropdown-item:focus{background:rgba(201,162,74,.09);outline:0}.item-desc{color:var(--muted,#98928a);font-size:11px;margin-top:3px;font-weight:400}
      .topnav-right{margin-left:auto;display:flex;align-items:center;gap:9px;min-width:0}
      .global-search{position:relative;width:min(300px,25vw);min-width:180px}.global-search input{width:100%;height:38px;box-sizing:border-box;border:1px solid var(--border2,rgba(255,255,255,.12));border-radius:9px;background:rgba(255,255,255,.035);color:var(--text,#eee);padding:0 12px;font:400 12px 'DM Sans',sans-serif;outline:0}.global-search input:focus{border-color:rgba(201,162,74,.55);box-shadow:0 0 0 3px rgba(201,162,74,.08)}
      .global-search-results{display:none;position:absolute;top:calc(100% + 7px);left:0;right:0;max-height:330px;overflow:auto;background:var(--panel,#211d19);border:1px solid var(--border2,rgba(201,162,74,.2));border-radius:10px;box-shadow:0 18px 45px rgba(0,0,0,.35);z-index:1100}.global-search-results.open{display:block}
      .header-market-status{display:flex;align-items:center;gap:7px;color:var(--muted,#aaa);font:500 11px 'DM Sans',sans-serif;white-space:nowrap}.market-status-dot{width:7px;height:7px;border-radius:50%;background:#5dbb7b;box-shadow:0 0 0 3px rgba(93,187,123,.1)}
      .header-time{font:500 11px 'DM Mono',monospace;color:var(--muted,#aaa);white-space:nowrap}.topnav-user,.tc-account-link{display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit;cursor:pointer;padding:4px 7px;border-radius:9px}.topnav-user:hover,.tc-account-link:hover{background:rgba(255,255,255,.05)}
      .topnav-avatar{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#2b261f,#171310);border:1px solid rgba(201,162,74,.5);color:var(--tc-gold-soft);font:700 11px 'DM Sans',sans-serif}.topnav-username{max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text,#eee);font:500 12px 'DM Sans',sans-serif}
      .topnav-logout{width:34px;height:34px;border:1px solid var(--border2,rgba(255,255,255,.1));border-radius:8px;background:transparent;color:var(--muted,#aaa);cursor:pointer}.topnav-logout:hover{color:var(--tc-gold);border-color:rgba(201,162,74,.4)}
      .tc-mobile-menu{display:none;width:40px;height:40px;border:1px solid var(--border2,rgba(255,255,255,.1));border-radius:8px;background:transparent;cursor:pointer}.tc-mobile-menu span{display:block;width:18px;height:1px;margin:4px auto;background:currentColor;color:#eee}
      .sidebar.mobile-open{z-index:1200!important}.overlay.mobile-open{display:block!important;z-index:1150!important}
      @media(max-width:1150px){.topnav-logo{padding-right:7px}.nav-dropdown-btn{padding:0 8px}.global-search{width:210px}.header-market-status{display:none}}
      @media(max-width:900px){.topnav{padding:0 12px}.tc-mobile-menu{display:block}.topnav-logo{font-size:13px}.topnav>.nav-dropdown,.topnav>.topnav-divider{display:none}.topnav-right{gap:6px}.global-search{width:min(42vw,260px);min-width:120px}.header-time{display:none}.topnav-username{display:none}.topnav-right{order:2}.topnav-logo{order:1}.tc-mobile-menu{order:0;margin-right:2px}}
      @media(max-width:560px){.global-search{display:none}.header-market-status{display:flex}.topnav{min-height:64px}.topnav-logo{font-size:12px;letter-spacing:.1em}.topnav-right{margin-left:auto}}
      @media(prefers-reduced-motion:reduce){.nav-dropdown-btn,.caret{transition:none}}
    `;
    document.head.appendChild(s);
  }

  function route(target){
    if(typeof window.nav==='function'){ window.nav(target); return; }
    var el=document.querySelector('[data-route="'+target+'"]'); if(el && typeof el.click==='function') el.click();
  }

  function closeDropdowns(except){
    qsa('.topnav .nav-dropdown').forEach(function(dd){ if(dd!==except){dd.classList.remove('open');var b=qs('.nav-dropdown-btn',dd);if(b)b.setAttribute('aria-expanded','false');} });
  }

  function bindDropdowns(){
    qsa('.topnav .nav-dropdown').forEach(function(dd){
      var btn=qs('.nav-dropdown-btn',dd); if(!btn || btn.dataset.tcBound==='1') return;
      btn.dataset.tcBound='1';
      btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var open=dd.classList.contains('open');closeDropdowns(dd);dd.classList.toggle('open',!open);btn.setAttribute('aria-expanded',String(!open));});
      qsa('.nav-dropdown-item',dd).forEach(function(item){item.addEventListener('click',function(){var target=item.dataset.route;if(target)route(target);closeDropdowns();});});
    });
  }

  function bindRoutes(){
    qsa('[data-route]').forEach(function(el){
      if(el.dataset.tcHeaderRouteBound==='1') return;
      if(el.closest('.nav-dropdown-item')) return;
      el.dataset.tcHeaderRouteBound='1';
      el.addEventListener('click',function(){var target=el.dataset.route;if(target)route(target);});
    });
  }

  function syncIdentity(){
    var session=window.tcSession||null, user=session&&session.user, meta=user&&user.user_metadata||{};
    var name=String(meta.full_name||meta.fullName||[meta.first_name||meta.firstname||meta.prenom,meta.last_name||meta.lastname||meta.nom].filter(Boolean).join(' ')||'').trim();
    if(!name && user&&user.email) name=user.email.split('@')[0];
    var nameEl=$('headerName'), avatar=$('headerAvatar');
    if(nameEl && name) nameEl.textContent=name;
    if(avatar && name){var initials=name.split(/\s+/).filter(Boolean).slice(0,2).map(function(x){return x.charAt(0).toUpperCase();}).join('');if(initials)avatar.textContent=initials;}
  }

  function bindLogout(){
    qsa('[data-action="logout"]').forEach(function(btn){if(btn.dataset.tcLogoutBound==='1')return;btn.dataset.tcLogoutBound='1';btn.addEventListener('click',function(){
      try{localStorage.removeItem('tc_session');}catch(e){}
      if(window.supabase && window.supabase.auth && typeof window.supabase.auth.signOut==='function') window.supabase.auth.signOut().catch(function(){});
      window.location.assign('/login.html');
    });});
  }

  function updateClock(){
    var el=$('headerTime'); if(!el)return; var now=new Date(); el.textContent=now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }

  function bindSearch(){
    var input=$('globalSearchInput'), box=$('globalSearchResults'); if(!input||!box||input.dataset.tcSearchBound==='1')return;input.dataset.tcSearchBound='1';
    input.addEventListener('input',function(){var q=input.value.trim().toLowerCase();if(!q){box.innerHTML='';box.classList.remove('open');return;}var items=qsa('[data-route]').filter(function(el){return el.closest('.sidebar')||el.classList.contains('nav-dropdown-item')||el.classList.contains('nav-item');});var seen={},out=[];items.forEach(function(el){var t=(el.textContent||'').replace(/\s+/g,' ').trim(),r=el.dataset.route;if(!t||!r||seen[r]||t.toLowerCase().indexOf(q)<0)return;seen[r]=1;out.push('<button type="button" class="tc-search-result" data-route="'+r+'">'+t+'</button>');});box.innerHTML=out.length?out.join(''):'<div style="padding:12px;color:var(--muted,#999);font:12px DM Sans,sans-serif">Aucun résultat</div>';box.classList.add('open');qsa('.tc-search-result',box).forEach(function(b){b.addEventListener('click',function(){route(b.dataset.route);box.classList.remove('open');input.value='';});});});
  }

  function ensureMobileMenu(){
    var topnav=qs('.topnav'), sidebar=$('sidebar'); if(!topnav||!sidebar)return;
    var btn=$('tcMobileMenu'); if(!btn){btn=document.createElement('button');btn.id='tcMobileMenu';btn.className='tc-mobile-menu';btn.type='button';btn.setAttribute('aria-label','Ouvrir le menu');btn.setAttribute('aria-expanded','false');btn.innerHTML='<span></span><span></span><span></span>';topnav.insertBefore(btn,topnav.firstChild);}
    if(btn.dataset.tcBound==='1')return;btn.dataset.tcBound='1';
    btn.addEventListener('click',function(e){e.preventDefault();var open=sidebar.classList.toggle('mobile-open');var overlay=$('overlay');if(overlay)overlay.classList.toggle('mobile-open',open);document.body.classList.toggle('menu-open',open);btn.setAttribute('aria-expanded',String(open));btn.setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu');});
    var overlay=$('overlay');if(overlay&&overlay.dataset.tcBound!=='1'){overlay.dataset.tcBound='1';overlay.addEventListener('click',function(){sidebar.classList.remove('mobile-open');overlay.classList.remove('mobile-open');document.body.classList.remove('menu-open');btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-label','Ouvrir le menu');});}
    window.addEventListener('resize',function(){if(window.innerWidth>900){sidebar.classList.remove('mobile-open');if(overlay)overlay.classList.remove('mobile-open');document.body.classList.remove('menu-open');btn.setAttribute('aria-expanded','false');}});
  }

  function bindSidebar(){
    var sidebar=$('sidebar');if(!sidebar)return;
    qsa('.nav-item',sidebar).forEach(function(item){if(item.dataset.tcSidebarBound==='1')return;item.dataset.tcSidebarBound='1';item.addEventListener('click',function(){var target=item.dataset.route;if(target)route(target);var overlay=$('overlay');if(window.innerWidth<=900){sidebar.classList.remove('mobile-open');if(overlay)overlay.classList.remove('mobile-open');document.body.classList.remove('menu-open');}});});
  }

  function init(){
    injectStyles(); bindDropdowns(); bindRoutes(); bindLogout(); bindSearch(); ensureMobileMenu(); bindSidebar(); syncIdentity(); updateClock();
    if(!window.__TC_HEADER_CLOCK__) window.__TC_HEADER_CLOCK__=setInterval(updateClock,1000);
    window.dispatchEvent(new CustomEvent('tc:header-ready'));
  }

  window.TCHeader={boot:init,init:init,initSidebar:bindSidebar};
  window.initSidebar=bindSidebar;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();