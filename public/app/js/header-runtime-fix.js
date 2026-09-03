/* THE CAPITAL — final header runtime cleanup
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
      /* One market clock only. */
      .header #headerTime.tc-market-clocks{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:0!important;width:225px!important;min-width:225px!important;height:46px!important;overflow:hidden!important;padding:0 10px!important;border-left:1px solid rgba(184,150,78,.12)!important;border-right:1px solid rgba(184,150,78,.12)!important}
      .header #headerTime .tc-clock-main{display:flex!important;align-items:center!important;gap:10px!important;width:100%!important}
      .header #headerTime .tc-clock-kicker{display:block!important;writing-mode:horizontal-tb!important;transform:none!important;white-space:nowrap!important;font:500 7px/1 var(--mono,monospace)!important;letter-spacing:.14em!important;color:var(--gold,#b8964e)!important;margin:0!important}
      .header #headerTime .tc-clock-primary{display:flex!important;flex-direction:column!important;gap:3px!important;min-width:0!important}
      .header #headerTime .tc-clock-primary b{font:500 13px/1 var(--mono,monospace)!important;color:var(--text,#f4efe6)!important;white-space:nowrap!important}
      .header #headerTime .tc-clock-primary small{font:500 7px/1 var(--mono,monospace)!important;color:var(--muted,rgba(244,239,230,.55))!important;white-space:nowrap!important;text-transform:uppercase!important}
      .header #headerTime .tc-clock-list{display:none!important}
      .header #headerTime .tc-header-phase{display:block!important;margin-left:auto!important;max-width:90px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font:600 7px/1.2 var(--mono,monospace)!important;letter-spacing:.07em!important;color:var(--gold2,#e0c176)!important;text-transform:uppercase!important}
      body[data-theme="light"] .header #headerTime{border-color:rgba(55,45,28,.12)!important}
      body[data-theme="light"] .header #headerTime .tc-clock-primary b{color:#1d1a15!important}
      body[data-theme="light"] .header #headerTime .tc-clock-primary small{color:rgba(29,26,21,.52)!important}
      body[data-theme="light"] .header #headerTime .tc-header-phase{color:#76591f!important}

      /* Dropdowns: one predictable interaction layer. */
      .header .nav-dropdown{position:relative!important;z-index:6000!important}
      .header .nav-dropdown-btn{cursor:pointer!important;user-select:none!important}
      .header .nav-dropdown-menu{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;position:absolute!important;top:calc(100% + 8px)!important;left:0!important;z-index:7000!important;min-width:230px!important;max-width:min(360px,calc(100vw - 24px))!important;transform:translateY(-4px)!important;transition:opacity .14s ease,transform .14s ease,visibility .14s ease!important}
      .header .nav-dropdown.open > .nav-dropdown-menu,
      .header .nav-dropdown:focus-within > .nav-dropdown-menu{display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;transform:none!important}
      .header .nav-dropdown.open > .nav-dropdown-btn{background:rgba(184,150,78,.10)!important;color:var(--gold2,#e0c176)!important}
      body[data-theme="light"] .header .nav-dropdown.open > .nav-dropdown-btn{background:rgba(154,116,48,.09)!important;color:#76591f!important}
      .header .nav-dropdown-menu .nav-dropdown-item{cursor:pointer!important}

      /* Light theme: never allow legacy dark dashboard surfaces to hide text. */
      body[data-theme="light"] #view-overview .card,
      body[data-theme="light"] #view-overview > .card,
      body[data-theme="light"] #view-overview .stat-card,
      body[data-theme="light"] #view-overview .tci-card,
      body[data-theme="light"] #view-overview .dashboard-news,
      body[data-theme="light"] #view-overview .news-item,
      body[data-theme="light"] #view-overview .chart-card,
      body[data-theme="light"] .card,
      body[data-theme="light"] .stat-card,
      body[data-theme="light"] .tci-card,
      body[data-theme="light"] .dashboard-news,
      body[data-theme="light"] .chart-card,
      body[data-theme="light"] .metric-card,
      body[data-theme="light"] .insight-card,
      body[data-theme="light"] .summary-card{
        background:#fffdf9!important;
        color:#1d1a15!important;
        border-color:rgba(55,45,28,.13)!important;
      }
      body[data-theme="light"] .card h1,body[data-theme="light"] .card h2,body[data-theme="light"] .card h3,body[data-theme="light"] .card h4,
      body[data-theme="light"] .stat-card h1,body[data-theme="light"] .stat-card h2,body[data-theme="light"] .stat-card h3,body[data-theme="light"] .stat-card h4,
      body[data-theme="light"] .tci-card h1,body[data-theme="light"] .tci-card h2,body[data-theme="light"] .tci-card h3,body[data-theme="light"] .tci-card h4,
      body[data-theme="light"] .card .card-title,body[data-theme="light"] .card .stat-value,body[data-theme="light"] .stat-card .stat-value,
      body[data-theme="light"] .tci-card .tci-value,body[data-theme="light"] .tci-card .tci-title{color:#1d1a15!important}
      body[data-theme="light"] .card p,body[data-theme="light"] .card span,body[data-theme="light"] .card div,
      body[data-theme="light"] .stat-card span,body[data-theme="light"] .stat-card div,
      body[data-theme="light"] .tci-card span,body[data-theme="light"] .tci-card div{ }
      body[data-theme="light"] #view-overview .card-title,body[data-theme="light"] #view-overview .tci-title,body[data-theme="light"] #view-overview .stat-label{color:rgba(29,26,21,.62)!important}
      body[data-theme="light"] #view-overview .tci-sub,body[data-theme="light"] #view-overview .tci-label,body[data-theme="light"] #view-overview .tci-unit,
      body[data-theme="light"] #view-overview .tci-watch-name,body[data-theme="light"] #view-overview .tci-contrib-label{color:rgba(29,26,21,.55)!important}
      body[data-theme="light"] #view-overview .news-title{color:#1d1a15!important}
      body[data-theme="light"] #view-overview .news-meta{color:rgba(29,26,21,.48)!important}
      body[data-theme="light"] #view-overview .heatmap-cell{background:#f8f5ee!important;color:#1d1a15!important;border-color:rgba(55,45,28,.10)!important}

      @media(max-width:1400px){.header #headerTime.tc-market-clocks{display:flex!important;width:205px!important;min-width:205px!important}.header #headerTime .tc-header-phase{display:none!important}}
      @media(max-width:1180px){.header #headerTime.tc-market-clocks{display:flex!important;width:175px!important;min-width:175px!important}.header #headerTime .tc-clock-kicker{display:none!important}.header #headerTime .tc-header-phase{display:none!important}}
      @media(max-width:900px){.header #headerTime.tc-market-clocks{display:none!important}}
    `;
    document.head.appendChild(s);
  }

  function phaseText(){
    var badge=document.querySelector('.header-badge');
    if(badge){
      var text=badge.textContent.replace(/\s+/g,' ').trim();
      if(text) return text;
    }
    return 'MARCHÉ';
  }

  function normalizeClock(){
    var host=document.getElementById('headerTime');
    if(!host) return;
    host.classList.add('tc-market-clocks');
    var main=host.querySelector('.tc-clock-main');
    if(!main){
      host.innerHTML='<div class="tc-clock-main"><span class="tc-clock-kicker">HEURE DU MARCHÉ</span><span class="tc-clock-primary"><b id="tc-clock-abidjan">--:--:--</b><small>ABIDJAN · BRVM</small></span><span class="tc-header-phase" aria-live="polite">MARCHÉ</span></div>';
      main=host.querySelector('.tc-clock-main');
    }
    var list=host.querySelector('.tc-clock-list');
    if(list) list.remove();
    var phase=host.querySelector('.tc-header-phase');
    if(!phase){
      phase=document.createElement('span');
      phase.className='tc-header-phase';
      main.appendChild(phase);
    }
    var ab=host.querySelector('#tc-clock-abidjan');
    if(ab){
      try{
        var nowText=new Intl.DateTimeFormat('fr-FR',{timeZone:'Africa/Abidjan',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
        if(ab.textContent!==nowText) ab.textContent=nowText;
      }catch(e){}
    }
    if(phase){
      var nextPhase=phaseText();
      if(phase.textContent!==nextPhase) phase.textContent=nextPhase;
    }
  }

  function initDropdowns(){
    if(document.documentElement.__tcDropdowns) return;
    document.documentElement.__tcDropdowns=true;
    document.addEventListener('click',function(e){
      var btn=e.target.closest('.header .nav-dropdown-btn');
      if(btn){
        e.preventDefault();
        e.stopImmediatePropagation();
        var parent=btn.closest('.nav-dropdown');
        document.querySelectorAll('.header .nav-dropdown.open').forEach(function(d){if(d!==parent)d.classList.remove('open');});
        parent.classList.toggle('open');
        btn.setAttribute('aria-expanded',parent.classList.contains('open')?'true':'false');
        return;
      }
      if(!e.target.closest('.header .nav-dropdown')){
        document.querySelectorAll('.header .nav-dropdown.open').forEach(function(d){d.classList.remove('open');});
      }
    },true);
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape') document.querySelectorAll('.header .nav-dropdown.open').forEach(function(d){d.classList.remove('open');});
    });
  }

  function sync(){normalizeClock();}
  function boot(){
    injectCss();
    initDropdowns();
    sync();
    setInterval(sync,1000);
    var observer=new MutationObserver(function(){normalizeClock();});
    observer.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
