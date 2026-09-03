// ============================================================
// THE CAPITAL — INIT
// Bootstrap stable et sécurisé
// ============================================================

(function(){

  'use strict';

  if(window.__TC_INIT_LOADED__){
    return;
  }

  window.__TC_INIT_LOADED__ = true;

  const SESSION_KEY =
    'tc_session';

  // ----------------------------------------------------------
  // TOKEN
  // ----------------------------------------------------------

  function decodeBase64Url(value){

    let input =
      String(value || '')
        .replace(/-/g,'+')
        .replace(/_/g,'/');

    while(
      input.length % 4
    ){
      input += '=';
    }

    return atob(input);

  }

  function tokenIsValid(token){

    try{

      const parts =
        String(token || '')
          .split('.');

      if(parts.length !== 3){
        return false;
      }

      const payload =
        JSON.parse(
          decodeBase64Url(parts[1])
        );

      return !!payload.exp &&
        payload.exp * 1000 >
        Date.now();

    }catch(error){

      return false;

    }

  }

  // ----------------------------------------------------------
  // SESSION
  // ----------------------------------------------------------

  function getSession(){

    if(
      window.tcSession &&
      window.tcSession.access_token
    ){

      return window.tcSession;

    }

    try{

      const raw =
        localStorage.getItem(
          SESSION_KEY
        );

      if(!raw){
        return null;
      }

      const parsed =
        JSON.parse(raw);

      const session =
        (
          parsed &&
          parsed.data &&
          parsed.data.session
        ) ||
        (
          parsed &&
          parsed.session
        ) ||
        parsed;

      if(
        !session ||
        !session.access_token
      ){

        return null;

      }

      if(
        !tokenIsValid(
          session.access_token
        )
      ){

        return null;

      }

      return session;

    }catch(error){

      return null;

    }

  }

  // ----------------------------------------------------------
  // AUTH
  // ----------------------------------------------------------

  function requireAuth(){

    const session =
      getSession();

    if(session){

      window.tcSession =
        session;

      window.tcAccessToken =
        session.access_token;

      return true;

    }

    /*
     * DESTINATION UNIQUE :
     * toujours /app.html
     */
    const target =
      '/app.html';

    window.location.replace(
      '/login.html?redirect=' +
      encodeURIComponent(target)
    );

    return false;

  }

  // ----------------------------------------------------------
  // DOCUMENT
  // ----------------------------------------------------------

  function normalizeDocument(){

    /*
     * Aucun Desk Workspace.
     * On retire uniquement les anciennes balises base
     * qui peuvent perturber les chemins.
     */

    const bases =
      document.querySelectorAll(
        'base'
      );

    bases.forEach(
      function(base){

        base.remove();

      }
    );

    /*
     * Liens internes en navigation normale.
     */
    const links =
      document.querySelectorAll(
        'a[href]'
      );

    links.forEach(
      function(link){

        const href =
          link.getAttribute(
            'href'
          ) || '';

        if(
          href &&
          href.charAt(0) !== '#' &&
          !/^(https?:|mailto:|tel:|javascript:)/i.test(
            href
          )
        ){

          link.removeAttribute(
            'target'
          );

          link.removeAttribute(
            'rel'
          );

        }

      }
    );

  }

  // ----------------------------------------------------------
  // RENDU
  // ----------------------------------------------------------

  function safeRender(){

    try{

      if(
        typeof window.renderCurrentView ===
        'function'
      ){

        window.renderCurrentView();

      }

    }catch(error){

      console.error(
        '[INIT] Rendu:',
        error
      );

    }

  }

  // ----------------------------------------------------------
  // ENRICHISSEMENTS
  // ----------------------------------------------------------

  function loadSecondaryModules(){

    /*
     * Les modules complémentaires ne doivent
     * jamais empêcher l'affichage de l'app.
     */

    const modules = [

      '/app/js/views/overview-fixes.js?v=1',
      '/app/js/views/brvm-market-hours.js?v=20260827.3',
      '/app/js/market-ux.js?v=20260827.2',
      '/app/js/views/technique/data-bridge.js?v=20260826',
      '/app/js/views/user-data-patch.js?v=7',
      '/app/js/views/fundamental-ratios.js?v=1'

    ];

    modules.forEach(
      function(src){

        if(
          document.querySelector(
            'script[data-tc-secondary="' +
            src.replace(/"/g,'') +
            '"]'
          )
        ){

          return;

        }

        const script =
          document.createElement(
            'script'
          );

        script.src = src;

        /*
         * Ces scripts ne sont pas critiques.
         */
        script.async = true;

        script.dataset.tcSecondary =
          src;

        script.onerror =
          function(){

            console.warn(
              '[INIT] Module secondaire indisponible:',
              src
            );

          };

        document.head.appendChild(
          script
        );

      }
    );

  }

  // ----------------------------------------------------------
  // INITIALISATION
  // ----------------------------------------------------------

  function init(){

    if(
      !requireAuth()
    ){

      return;

    }

    normalizeDocument();

    console.log(
      '[INIT] Session authentifiée.'
    );

    /*
     * MAIN.JS doit être déjà chargé.
     */
    try{

      if(
        typeof window.initApp ===
        'function'
      ){

        window.initApp();

      }else{

        console.error(
          '[INIT] initApp() absent.'
        );

      }

    }catch(error){

      console.error(
        '[INIT] initApp:',
        error
      );

    }

    /*
     * Sécurité absolue :
     * on affiche l'application quoi qu'il arrive.
     */
    if(document.body){

      document.body.classList.remove(
        'init-hidden'
      );

      document.body.style.opacity =
        '1';

      document.body.style.visibility =
        'visible';

    }

    /*
     * Modules secondaires après affichage.
     */
    setTimeout(
      function(){

        try{

          loadSecondaryModules();

        }catch(error){

          console.warn(
            '[INIT] Modules secondaires:',
            error
          );

        }

      },
      100
    );

  }

  // ----------------------------------------------------------
  // BOOT
  // ----------------------------------------------------------

  if(
    document.readyState ===
    'loading'
  ){

    document.addEventListener(
      'DOMContentLoaded',
      init,
      {
        once:true
      }
    );

  }else{

    init();

  }

})();
