/* THE CAPITAL — header runtime interaction
   Presentation + navigation interaction only. No data/auth/API changes. */
(function(){
  'use strict';
  if(window.__TC_HEADER_RUNTIME_FIX__) return;
  window.__TC_HEADER_RUNTIME_FIX__=true;

  function injectCss(){
    if(document.getElementById('tc-header-runtime-fix-css')) return;
    var s=document.createElement('style');
    s.id='tc-header-runtime-fix-css';
    s.textContent=`
      .header .nav-dropdown{position:relative!important;z-index:6000!important}
      .header .nav-dropdown-btn{cursor:pointer!important;user-select:none!important}
      .header .nav-dropdown-menu{
        display:none!important;
        visibility:hidden!important;
        opacity:0!important;
        pointer-events:none!important;
        position:absolute!important;
        top:calc(100% + 8px)!important;
        left:0!important;
        z-index:7000!important;
        min-width:230px!important;
        max-width:min(360px,calc(100vw - 24px))!important;
        max-height:calc(100vh - 92px)!important;
        overflow-y:auto!important;
        overflow-x:hidden!important;
        transform:translateY(-4px)!important;
        transition:opacity .14s ease,transform .14s ease,visibility .14s ease!important;
      }
      .header .nav-dropdown.open > .nav-dropdown-menu{
        display:block!important;
        visibility:visible!important;
        opacity:1!important;
        pointer-events:auto!important;
        transform:none!important;
      }
      .header .nav-dropdown.open > .nav-dropdown-btn{
        background:rgba(184,150,78,.10)!important;
        color:var(--gold2,#e0c176)!important;
      }
      .header .nav-dropdown-menu .nav-dropdown-item{cursor:pointer!important}
      @media(max-width:900px){
        .header .nav-dropdown-menu{
          position:fixed!important;
          top:58px!important;
          left:auto!important;
          max-height:calc(100vh - 70px)!important;
        }
      }
      @media(max-width:480px){
        .header .nav-dropdown-menu{top:54px!important;max-height:calc(100vh - 64px)!important}
      }
    `;
    document.head.appendChild(s);
  }

  function closeAll(except){
    document.querySelectorAll('.header .nav-dropdown.open').forEach(function(d){
      if(d!==except)d.classList.remove('open');
      var b=d.querySelector('.nav-dropdown-btn');
      if(b)b.setAttribute('aria-expanded',d===except?'true':'false');
    });
  }

  function initDropdowns(){
    if(window.__TC_HEADER_DROPDOWNS__) return;
    window.__TC_HEADER_DROPDOWNS__=true;

    document.querySelectorAll('.header .nav-dropdown').forEach(function(dropdown){
      var btn=dropdown.querySelector('.nav-dropdown-btn');
      if(!btn || !dropdown.id) return;
      btn.setAttribute('aria-haspopup','true');
      btn.setAttribute('aria-expanded','false');
    });

    document.addEventListener('click',function(e){
      var btn=e.target.closest('.header .nav-dropdown-btn');
      if(btn){
        var parent=btn.closest('.nav-dropdown');
        if(!parent || !parent.id || btn.id==='nav-overview') return;
        e.preventDefault();
        closeAll(parent);
        var opening=!parent.classList.contains('open');
        parent.classList.toggle('open',opening);
        btn.setAttribute('aria-expanded',opening?'true':'false');
        return;
      }
      if(!e.target.closest('.header .nav-dropdown')) closeAll(null);
    });

    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'){
        closeAll(null);
        var active=document.querySelector('.header .nav-dropdown.open .nav-dropdown-btn');
        if(active)active.focus();
      }
    });

    window.addEventListener('resize',function(){closeAll(null)});
    window.addEventListener('scroll',function(e){
      if(e.target===document || e.target===document.documentElement || e.target===document.body) closeAll(null);
    },{passive:true});
  }

  function boot(){
    injectCss();
    initDropdowns();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
