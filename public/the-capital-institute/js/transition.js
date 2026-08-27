/* THE CAPITAL INSTITUTE — editorial institutional entrance */
(function(){
  'use strict';
  if(window.__TCI_TRANSITION__) return;
  window.__TCI_TRANSITION__=true;

  var fallbackTimer=null, observer=null, left=false;
  var EXIT_MS=680, FALLBACK_MS=10000, THEME_KEY='tci-theme';

  function getTheme(){
    try{return localStorage.getItem(THEME_KEY)||'dark'}catch(e){return 'dark'}
  }
  function applyTheme(theme){
    theme=theme==='light'?'light':'dark';
    document.documentElement.setAttribute('data-tci-theme',theme);
    try{localStorage.setItem(THEME_KEY,theme)}catch(e){}
    var b=document.getElementById('tci-theme-toggle');
    if(b){b.setAttribute('aria-pressed',theme==='light'?'true':'false');b.innerHTML=theme==='light'?'<span aria-hidden="true">☾</span><span>Sombre</span>':'<span aria-hidden="true">☼</span><span>Clair</span>'}
  }
  applyTheme(getTheme());

  function styles(){
    if(document.getElementById('tci-transition-style')) return;
    var s=document.createElement('style'); s.id='tci-transition-style';
    s.textContent=`
      .tci-transition{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#171310;color:#f4efe6;overflow:hidden;opacity:1;transition:opacity ${EXIT_MS}ms cubic-bezier(.22,1,.36,1);font-family:'DM Sans',Arial,sans-serif}
      [data-tci-theme="light"] .tci-transition{background:#f7f4ed;color:#211d18}
      .tci-transition.is-leaving{opacity:0;pointer-events:none}
      .tci-transition::before{content:'';position:absolute;left:9%;right:9%;top:18%;height:64%;border-top:1px solid rgba(224,193,118,.10);border-bottom:1px solid rgba(224,193,118,.06);opacity:.8}
      .tci-transition::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 0%,rgba(224,193,118,.045) 50%,transparent 100%);transform:translateX(-100%);animation:tciSweep 2.2s .1s cubic-bezier(.2,.7,.2,1) forwards}
      [data-tci-theme="light"] .tci-transition::before{border-color:rgba(120,87,30,.13)}
      [data-tci-theme="light"] .tci-transition::after{background:linear-gradient(90deg,transparent 0%,rgba(157,116,47,.055) 50%,transparent 100%)}
      .tci-transition-shell{position:relative;z-index:2;width:min(900px,84vw);display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:34px}
      .tci-transition-side{font:500 8px/1.5 'DM Mono',monospace;letter-spacing:.24em;text-transform:uppercase;color:rgba(244,239,230,.30);opacity:0;animation:tciSide .7s .35s ease-out forwards}
      .tci-transition-side.right{text-align:right}
      [data-tci-theme="light"] .tci-transition-side{color:rgba(33,29,24,.38)}
      .tci-transition-center{text-align:center;min-width:270px}
      .tci-transition-rule{width:100%;height:1px;background:rgba(224,193,118,.30);transform:scaleX(0);animation:tciRule 1s .2s cubic-bezier(.22,1,.36,1) forwards}
      .tci-transition-mark{width:42px;height:42px;margin:0 auto 25px;border:1px solid rgba(224,193,118,.72);display:grid;place-items:center;transform:rotate(45deg) scale(.7);opacity:0;animation:tciMark .8s .18s cubic-bezier(.22,1,.36,1) forwards}
      .tci-transition-mark span{display:block;width:19px;height:19px;border:1px solid rgba(224,193,118,.9);transform:rotate(-45deg)}
      .tci-transition-kicker{display:block;margin-bottom:12px;color:#b9964e;font:500 8px/1 'DM Mono',monospace;letter-spacing:.38em;padding-left:.38em;text-transform:uppercase;opacity:0;animation:tciText .7s .55s ease-out forwards}
      .tci-transition-brand{display:block;color:#f4efe6;font:500 clamp(17px,2vw,23px)/1.1 'Playfair Display',Georgia,serif;letter-spacing:.035em;opacity:0;animation:tciText .7s .62s ease-out forwards}
      .tci-transition-title{display:block;margin-top:4px;color:#f4efe6;font:500 clamp(42px,5.5vw,66px)/.98 'Playfair Display',Georgia,serif;letter-spacing:-.035em;opacity:0;animation:tciText .75s .72s ease-out forwards}
      .tci-transition-title em{color:#d4b064;font-style:italic}
      .tci-transition-sub{display:block;margin-top:17px;color:rgba(244,239,230,.38);font:8px/1 'DM Mono',monospace;letter-spacing:.18em;opacity:0;animation:tciText .7s .88s ease-out forwards}
      [data-tci-theme="light"] .tci-transition-brand,[data-tci-theme="light"] .tci-transition-title{color:#211d18}
      [data-tci-theme="light"] .tci-transition-sub{color:rgba(33,29,24,.48)}
      @keyframes tciSweep{to{transform:translateX(100%)}}
      @keyframes tciRule{to{transform:scaleX(1)}}
      @keyframes tciMark{to{transform:rotate(45deg) scale(1);opacity:1}}
      @keyframes tciText{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
      @keyframes tciSide{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
      #tci-theme-toggle{display:inline-flex;align-items:center;gap:7px;margin-left:6px;padding:7px 10px;border:1px solid var(--line);border-radius:5px;background:transparent;color:var(--faint);font:500 11px 'DM Sans',sans-serif;cursor:pointer}
      #tci-theme-toggle:hover{color:var(--text);border-color:var(--gold-dim)}
      @media(max-width:720px){
        .tci-transition-shell{width:86vw;grid-template-columns:1fr;gap:18px}
        .tci-transition-side{display:none}.tci-transition-center{min-width:0}.tci-transition-rule{width:72%;margin:auto}
        .tci-transition-mark{margin-bottom:21px}
      }
      @media(prefers-reduced-motion:reduce){.tci-transition,.tci-transition *,.tci-transition::before,.tci-transition::after{animation:none!important;transition:none!important}.tci-transition-mark,.tci-transition-kicker,.tci-transition-brand,.tci-transition-title,.tci-transition-sub,.tci-transition-side{opacity:1;transform:none}.tci-transition-rule{transform:scaleX(1)}}
    `;
    document.head.appendChild(s);
  }
  function cleanup(){if(fallbackTimer){clearTimeout(fallbackTimer);fallbackTimer=null}if(observer){observer.disconnect();observer=null}}
  function leave(){if(left)return;left=true;cleanup();document.body.classList.remove('tci-transition-lock');var d=document.querySelector('.tci-transition');if(!d)return;d.classList.add('is-leaving');setTimeout(function(){if(d.parentNode)d.parentNode.removeChild(d)},EXIT_MS+80)}
  function ready(){var h=document.getElementById('tciVue');return !!(h&&h.children&&h.children.length)}
  function watchReady(){var h=document.getElementById('tciVue');if(!h){fallbackTimer=setTimeout(leave,FALLBACK_MS);return}if(ready()){requestAnimationFrame(leave);return}observer=new MutationObserver(function(){if(ready())requestAnimationFrame(leave)});observer.observe(h,{childList:true,subtree:true});fallbackTimer=setTimeout(leave,FALLBACK_MS)}
  function show(){
    if(document.querySelector('.tci-transition'))return;styles();document.body.classList.add('tci-transition-lock');
    var d=document.createElement('div');d.className='tci-transition';d.setAttribute('aria-hidden','true');
    d.innerHTML='<div class="tci-transition-shell">'+
      '<div class="tci-transition-side">BRVM<br>UEMOA<br>INVESTMENT EDUCATION</div>'+
      '<div class="tci-transition-center">'+
        '<div class="tci-transition-mark"><span></span></div>'+ '<div class="tci-transition-rule"></div>'+ 
        '<div style="height:22px"></div><span class="tci-transition-kicker">THE · CAPITAL</span>'+ 
        '<span class="tci-transition-brand">The Capital</span><span class="tci-transition-title">Institute<em>.</em></span>'+ 
        '<span class="tci-transition-sub">MARCHÉS · ÉDUCATION · BRVM</span>'+ 
      '</div>'+ '<div class="tci-transition-side right">CAPITAL<br>MARKETS<br>WEST AFRICA</div>'+ '</div>';
    document.body.appendChild(d);watchReady();
  }
  function installToggle(){
    var nav=document.querySelector('.tci-nav');if(!nav||document.getElementById('tci-theme-toggle'))return;
    var b=document.createElement('button');b.id='tci-theme-toggle';b.type='button';b.setAttribute('aria-label','Changer de thème');
    b.onclick=function(){applyTheme(getTheme()==='light'?'dark':'light')};nav.appendChild(b);applyTheme(getTheme());
  }
  function leaveThen(url){styles();var d=document.querySelector('.tci-transition');if(!d){show();d=document.querySelector('.tci-transition')}if(!d)return window.location.href=url;d.classList.remove('is-leaving');d.style.opacity='1';var title=d.querySelector('.tci-transition-title');if(title)title.innerHTML='Retour <em>vers The Capital.</em>';var sub=d.querySelector('.tci-transition-sub');if(sub)sub.textContent='RETOUR À VOTRE ESPACE D’INVESTISSEMENT';document.body.classList.add('tci-transition-lock');setTimeout(function(){window.location.href=url},1050)}
  document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('.tci-capital-link');if(a){e.preventDefault();leaveThen(a.href)}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){installToggle()});else installToggle();
  show();
})();
