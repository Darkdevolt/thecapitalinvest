/* THE CAPITAL — header runtime CSS
   Presentation + navigation support only. No data/auth/API changes. */
(function(){
  'use strict';
  if(window.__TC_HEADER_RUNTIME_FIX__) return;
  window.__TC_HEADER_RUNTIME_FIX__=true;

  function injectCss(){
    if(document.getElementById('tc-header-runtime-fix-css')) return;
    var s=document.createElement('style');
    s.id='tc-header-runtime-fix-css';
    s.textContent=`
      /* Do not let the horizontal nav clip its dropdown children on desktop. */
      .header .topnav{overflow:visible!important;overflow-y:visible!important}
      .header .nav-dropdown{position:relative!important;z-index:6000!important;overflow:visible!important}
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
        /* Menu is viewport-positioned on mobile, so the horizontal scroller cannot clip it. */
        .header .topnav{overflow-x:auto!important;overflow-y:visible!important}
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

  function boot(){
    injectCss();

    /* app.html already owns click handling through toggleDropdown().
       Do not install a second listener here: two controllers would toggle
       the same menu twice and make the dropdown appear not to respond. */
    document.querySelectorAll('.header .nav-dropdown .nav-dropdown-btn').forEach(function(btn){
      if(!btn.hasAttribute('aria-haspopup')) btn.setAttribute('aria-haspopup','true');
      if(!btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded','false');
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
