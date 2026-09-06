/* The Capital — header bootstrap simplifié */
(function(){
  'use strict';
  if(window.__TC_SIMPLE_HEADER__) return;
  window.__TC_SIMPLE_HEADER__=true;

  var MODULES=[
    '/app/js/mode.js',
    '/app/js/theme.js',
    '/app/js/views/comparison.js',
    '/app/js/views/dividend-screener.js'
  ];

  function loadScript(src){
    if(document.querySelector('script[data-tc-header-module="'+src+'"]')||document.querySelector('script[src="'+src+'"]')) return;
    var s=document.createElement('script');
    s.src=src;
    s.async=false;
    s.dataset.tcHeaderModule=src;
    s.onerror=function(){console.warn('[HEADER] Module indisponible:',src);};
    document.body.appendChild(s);
  }

  function loadStyle(href,attr){
    if(document.querySelector('link['+attr+'="'+href+'"]')) return;
    var l=document.createElement('link');
    l.rel='stylesheet';
    l.href=href;
    l.setAttribute(attr,href);
    document.head.appendChild(l);
  }

  function buildSimpleHeader(){
    var header=document.querySelector('header.header');
    if(!header) return;
    if(header.classList.contains('tc-simple-header')) return;

    header.className='header tc-simple-header';
    header.setAttribute('role','banner');
    header.innerHTML=''+
      '<div class="tc-header-inner">'+
        '<button class="tc-brand" type="button" data-route="overview" aria-label="Retour au tableau de bord">'+
          '<img class="tc-header-logo" src="/assets/the-capital-logo.png" alt="The Capital">'+
        '</button>'+ 
        '<nav class="tc-primary-nav" aria-label="Navigation principale">'+
          '<button class="tc-nav-link active" type="button" data-route="overview">Tableau de bord</button>'+ 
          '<button class="tc-nav-link" type="button" data-route="marche">Marché</button>'+ 
          '<button class="tc-nav-link" type="button" data-route="analyses">Analyse</button>'+ 
          '<button class="tc-nav-link" type="button" data-route="portefeuille">Portefeuille</button>'+ 
          '<button class="tc-nav-link" type="button" data-route="financials">Données</button>'+ 
          '<div class="tc-nav-more nav-dropdown" id="dd-plus">'+
            '<button class="tc-nav-link tc-nav-more-btn nav-dropdown-btn" id="nav-plus-btn" type="button" data-dropdown="dd-plus" aria-expanded="false" aria-haspopup="true">Plus <span aria-hidden="true">▼</span></button>'+ 
            '<div class="nav-dropdown-menu tc-nav-more-menu" id="menu-dd-plus">'+
              '<div class="nav-dropdown-label">Autres services</div>'+ 
              '<button class="nav-dropdown-item" type="button" data-route="titres"><span class="icon">▦</span><div><div>Titres BRVM</div><div class="item-desc">Univers coté</div></div></button>'+ 
              '<button class="nav-dropdown-item" type="button" data-route="boc"><span class="icon">◉</span><div><div>BOC / Emprunts</div><div class="item-desc">Bulletins et obligations</div></div></button>'+ 
              '<button class="nav-dropdown-item" type="button" data-route="screener"><span class="icon">⊟</span><div><div>Screener</div><div class="item-desc">Filtrer les titres</div></div></button>'+ 
              '<button class="nav-dropdown-item" type="button" data-route="analyse-technique"><span class="icon">↗</span><div><div>Analyse technique</div><div class="item-desc">Graphiques et indicateurs</div></div></button>'+ 
              '<button class="nav-dropdown-item" type="button" data-route="analyse-fondamentale"><span class="icon">⊛</span><div><div>Analyse fondamentale</div><div class="item-desc">Ratios et valorisation</div></div></button>'+ 
              '<button class="nav-dropdown-item" type="button" data-route="comparison"><span class="icon">⇄</span><div><div>Comparateur</div><div class="item-desc">2 à 4 sociétés</div></div></button>'+ 
              '<button class="nav-dropdown-item" type="button" data-route="dividend-screener"><span class="icon">◇</span><div><div>Screener Dividendes</div><div class="item-desc">Rendement et croissance</div></div></button>'+ 
              '<button class="nav-dropdown-item" type="button" data-route="alertes"><span class="icon">△</span><div><div>Alertes</div><div class="item-desc">Seuils de prix</div></div></button>'+ 
              '<button class="nav-dropdown-item" type="button" data-route="publications"><span class="icon">◫</span><div><div>Calendrier</div><div class="item-desc">Publications</div></div></button>'+ 
            '</div>'+ 
          '</div>'+ 
        '</nav>'+ 
        '<div class="tc-header-tools">'+
          '<div class="global-search" id="globalSearch">'+
            '<input type="search" id="globalSearchInput" placeholder="Rechercher…" aria-label="Rechercher un titre, une société ou un ticker" autocomplete="off">'+
            '<div class="global-search-results" id="globalSearchResults" role="listbox"></div>'+ 
          '</div>'+ 
          '<div class="header-market-status" id="headerMarketStatus" aria-live="polite"><span class="market-status-dot" aria-hidden="true"></span><span id="headerMarketStatusText">Marché</span></div>'+ 
          '<div class="header-time" id="headerTime" aria-label="Heure actuelle"></div>'+ 
          '<a class="tc-account-link" id="topnavUser" href="/app/account.html" aria-label="Mon compte"><span class="topnav-avatar" id="headerAvatar">TC</span><span class="topnav-username" id="headerName">—</span></a>'+ 
          '<button class="topnav-logout" type="button" data-action="logout" aria-label="Se déconnecter">⎋</button>'+ 
        '</div>'+ 
      '</div>';
  }

  function markSidebarLogo(){
    var logo=document.querySelector('.sidebar-logo');
    if(!logo||logo.querySelector('.tc-sidebar-logo-img')) return;
    logo.innerHTML='<img class="tc-sidebar-logo-img" src="/assets/the-capital-logo.png" alt="The Capital">';
  }

  function boot(){
    buildSimpleHeader();
    markSidebarLogo();

    // Une seule feuille possède la géométrie du nouveau header.
    loadStyle('/app/css/header-simple.css','data-tc-header-simple');
    loadStyle('/app/css/scale-100.css','data-tc-scale-100');
    loadStyle('/app/css/theme-system.css','data-tc-theme-system');
    loadStyle('/app/css/visual-contrast.css','data-tc-visual-contrast');
    loadStyle('/app/css/shell-overhaul.css','data-tc-shell-overhaul');

    loadScript('/app/js/header-runtime-fix.js');
    loadScript('/app/js/header-polish.js');
    loadScript('/app/js/shell-overhaul.js');
    MODULES.forEach(loadScript);

    window.dispatchEvent(new CustomEvent('tc:header-ready'));
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    boot();
  }

  window.TCHeader={boot:boot};
  console.log('[HEADER] Header simplifié chargé');
})();
