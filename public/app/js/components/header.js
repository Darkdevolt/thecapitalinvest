// ═══════════════════════════════════════
// COMPONENT — Header
// ═══════════════════════════════════════

function initHeader() {
  // Header initialization logic
  // Clock, search, user info updates
}

/*
 * Header navigation contract.
 * app.html already uses these handlers inline; keep the public API explicit
 * so the dropdowns do not depend on a secondary runtime script loading first.
 */
(function installHeaderDropdownContract(){
  if (window.__TC_HEADER_DROPDOWN_CONTRACT__) return;
  window.__TC_HEADER_DROPDOWN_CONTRACT__ = true;

  window.closeDropdowns = function(){
    document.querySelectorAll('.header .nav-dropdown.open').forEach(function(dropdown){
      dropdown.classList.remove('open');
      var button = dropdown.querySelector('.nav-dropdown-btn');
      if (button) button.setAttribute('aria-expanded','false');
    });
  };

  window.toggleDropdown = function(id){
    var dropdown = document.getElementById(id);
    if (!dropdown) return;
    var wasOpen = dropdown.classList.contains('open');
    window.closeDropdowns();
    if (!wasOpen) {
      dropdown.classList.add('open');
      var button = dropdown.querySelector('.nav-dropdown-btn');
      if (button) button.setAttribute('aria-expanded','true');
    }
  };

  var style = document.createElement('style');
  style.id = 'tc-header-dropdown-contract-css';
  style.textContent = `
    /* Dropdowns must escape the horizontal navigation clipping region. */
    .header .topnav{overflow:visible!important;overflow-y:visible!important;}
    .header .nav-dropdown{position:relative!important;overflow:visible!important;}
    .header .nav-dropdown-menu{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;position:absolute!important;}
    .header .nav-dropdown.open > .nav-dropdown-menu{display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;}
    @media(max-width:900px){
      .header .topnav{overflow-x:auto!important;overflow-y:visible!important;}
      .header .nav-dropdown-menu{position:fixed!important;top:58px!important;max-height:calc(100vh - 70px)!important;}
    }
  `;
  document.head.appendChild(style);
})();

(function loadDisplayAndProductModules(){
  const scripts = [
    '/app/js/mode.js',
    '/app/js/theme.js',
    '/app/js/views/comparison.js',
    '/app/js/views/dividend-screener.js',
    '/app/js/header-polish.js',
    '/app/js/header-runtime-fix.js',
    '/app/js/dashboard-utility.js'
  ];
  scripts.forEach(src => {
    if (document.querySelector(`script[data-tc-module="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.dataset.tcModule = src;
    document.body.appendChild(script);
  });

  const styles = [
    ['/app/css/header-responsive.css','data-tc-header-responsive'],
    ['/app/css/scale-100.css','data-tc-scale-100'],
    ['/app/css/header-final.css','data-tc-header-final'],
    ['/app/css/theme-system.css','data-tc-theme-system'],
    ['/app/css/visual-contrast.css','data-tc-visual-contrast'],
    ['/app/css/dashboard-utility.css','data-tc-dashboard-utility']
  ];
  styles.forEach(([href,attr])=>{
    if(document.querySelector(`link[${attr}="${href}"]`)) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=href;
    link.setAttribute(attr,href);
    document.head.appendChild(link);
  });

  // Professional account center. Presentation/navigation only; no Supabase changes.
  function installAccountMenu(){
    const user=document.getElementById('topnavUser');
    if(!user || document.getElementById('tcAccountMenu')) return;

    user.style.cursor='pointer';
    user.setAttribute('role','button');
    user.setAttribute('tabindex','0');
    user.setAttribute('aria-haspopup','true');
    user.setAttribute('aria-expanded','false');

    const menu=document.createElement('div');
    menu.id='tcAccountMenu';
    menu.className='tc-account-menu';
    menu.innerHTML=`
      <div class="tc-account-head">
        <div class="tc-account-kicker">ESPACE PERSONNEL</div>
        <div class="tc-account-title">Mon compte</div>
      </div>
      <a href="/app/account.html" class="tc-account-item"><span>◉</span><div><b>Informations</b><small>Profil et informations du compte</small></div></a>
      <a href="/app/account.html#preferences" class="tc-account-item"><span>⚙</span><div><b>Préférences</b><small>Apparence, devise et notifications</small></div></a>
      <a href="/app/account.html#security" class="tc-account-item"><span>◇</span><div><b>Sécurité</b><small>Accès et session</small></div></a>
      <a href="/app/account.html#subscription" class="tc-account-item"><span>▣</span><div><b>Abonnement</b><small>Formule et offres</small></div></a>
      <div class="tc-account-separator"></div>
      <button type="button" class="tc-account-theme" id="tcAccountTheme"><span>☼</span> Apparence <strong>Sombre</strong></button>
    `;
    document.body.appendChild(menu);

    const style=document.createElement('style');
    style.textContent=`
      .tc-account-menu{position:fixed;z-index:10000;width:285px;padding:8px;background:var(--surface,#11100c);border:1px solid rgba(184,150,78,.25);border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.38);display:none;backdrop-filter:blur(18px)}
      .tc-account-menu.open{display:block}
      .tc-account-head{padding:10px 12px 12px;border-bottom:1px solid rgba(184,150,78,.1);margin-bottom:4px}
      .tc-account-kicker{font:500 7px var(--mono,monospace);letter-spacing:.16em;color:var(--gold,#b8964e)}
      .tc-account-title{font:600 20px var(--serif,Georgia,serif);margin-top:3px;color:var(--cream,#f4efe6)}
      .tc-account-item{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:7px;color:var(--cream,#f4efe6);text-decoration:none}
      .tc-account-item:hover{background:rgba(184,150,78,.08)}
      .tc-account-item>span{width:20px;text-align:center;color:var(--gold2,#e0c176);font-size:14px}
      .tc-account-item b{display:block;font:500 10px var(--sans,Arial,sans-serif)}
      .tc-account-item small{display:block;color:var(--muted,rgba(244,239,230,.6));font-size:8px;margin-top:2px}
      .tc-account-separator{height:1px;background:rgba(184,150,78,.1);margin:5px 0}
      .tc-account-theme{width:100%;border:0;background:transparent;color:var(--cream,#f4efe6);display:flex;align-items:center;gap:9px;padding:10px 12px;border-radius:7px;font:500 9px var(--mono,monospace);cursor:pointer;text-align:left}
      .tc-account-theme:hover{background:rgba(184,150,78,.08)}
      .tc-account-theme span{color:var(--gold2,#e0c176);font-size:15px}.tc-account-theme strong{margin-left:auto;color:var(--muted,rgba(244,239,230,.6));font-weight:400}
      body[data-theme="light"] .tc-account-menu{background:#fffdf9;border-color:rgba(55,45,28,.15)}
      body[data-theme="light"] .tc-account-title,body[data-theme="light"] .tc-account-item,body[data-theme="light"] .tc-account-theme{color:#1d1a15}
      body[data-theme="light"] .tc-account-item small,body[data-theme="light"] .tc-account-theme strong{color:rgba(29,26,21,.58)}
    `;
    document.head.appendChild(style);

    function position(){
      const r=user.getBoundingClientRect();
      const width=285;
      let left=r.right-width;
      left=Math.max(10,Math.min(left,window.innerWidth-width-10));
      menu.style.top=(r.bottom+8)+'px';
      menu.style.left=left+'px';
    }
    function toggle(){
      const open=menu.classList.toggle('open');
      user.setAttribute('aria-expanded',String(open));
      if(open) position();
    }
    user.addEventListener('click',toggle);
    user.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}});
    document.addEventListener('click',e=>{if(!menu.contains(e.target)&&!user.contains(e.target)){menu.classList.remove('open');user.setAttribute('aria-expanded','false')}});
    window.addEventListener('resize',()=>{if(menu.classList.contains('open'))position()});

    const themeBtn=menu.querySelector('#tcAccountTheme');
    function syncThemeLabel(){
      const light=document.documentElement.dataset.theme==='light';
      themeBtn.querySelector('span').textContent=light?'☾':'☼';
      themeBtn.querySelector('strong').textContent=light?'Clair':'Sombre';
    }
    themeBtn.addEventListener('click',e=>{e.stopPropagation();if(window.TCTheme)window.TCTheme.toggle();syncThemeLabel()});
    window.addEventListener('tc:theme-change',syncThemeLabel);
    setTimeout(syncThemeLabel,300);
  }

  function bootAccountMenu(){
    installAccountMenu();
    setTimeout(installAccountMenu,250);
    setTimeout(installAccountMenu,800);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootAccountMenu,{once:true});
  else bootAccountMenu();
})();