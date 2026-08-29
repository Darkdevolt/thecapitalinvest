(()=>{
  'use strict';

  const KEY='thecapital:landing-theme';

  const setTheme=(theme,button)=>{
    const light=theme==='light';
    document.body.classList.toggle('tc-light',light);
    document.body.classList.toggle('tc-dark',!light);
    try{localStorage.setItem(KEY,theme)}catch{}
    if(button){
      button.textContent=light?'☾':'☼';
      button.setAttribute('aria-label',light?'Passer en mode sombre':'Passer en mode clair');
    }
  };

  const setupTheme=()=>{
    const nav=document.querySelector('.links');
    if(!nav||nav.querySelector('.tc-theme-toggle')) return;

    const button=document.createElement('button');
    button.type='button';
    button.className='tc-theme-toggle';
    nav.appendChild(button);

    let theme='dark';
    try{
      theme=localStorage.getItem(KEY)||
        (matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
    }catch{}

    setTheme(theme,button);
    button.addEventListener('click',()=>{
      setTheme(document.body.classList.contains('tc-light')?'dark':'light',button);
    });
  };

  const scene=()=>{
    const visual=document.querySelector('.visual');
    if(!visual||visual.querySelector('.tc-floor-scene')) return;

    visual.innerHTML=`
      <div class="tc-floor-scene" aria-label="Salle des marchés The Capital">

        <div class="tc-floor-header">
          <div class="tc-room-brand">
            <span class="tc-room-dot"></span>
            THE CAPITAL · MARKET INTELLIGENCE
          </div>
          <div class="floor-status">DAKAR · BRVM</div>
        </div>

        <div class="tc-ceiling" aria-hidden="true"></div>
        <div class="tc-lightbar" aria-hidden="true"></div>
        <div class="tc-column left" aria-hidden="true"></div>
        <div class="tc-column right" aria-hidden="true"></div>

        <div class="tc-wall">
          <div class="tc-wall-value">
            <small>BRVM COMPOSITE</small>
            <strong class="tc-composite-value">—</strong>
            <b class="tc-composite-change">—</b>
          </div>
          <div class="tc-wall-chart" aria-hidden="true">
            <svg viewBox="0 0 520 120" preserveAspectRatio="none">
              <path d="M0 94 C32 91 48 98 72 82 S110 88 136 73 S170 78 196 65 S230 72 258 57 S300 66 330 48 S365 56 394 39 S430 47 458 29 S492 36 520 18" fill="none" stroke="rgba(224,193,118,.86)" stroke-width="2"/>
            </svg>
          </div>
        </div>

        <div class="tc-back-row" aria-hidden="true">
          <div class="tc-back-desk"><div class="tc-back-screen"></div><div class="tc-back-chair"></div></div>
          <div class="tc-back-desk"><div class="tc-back-screen"></div><div class="tc-back-chair"></div></div>
          <div class="tc-back-desk"><div class="tc-back-screen"></div><div class="tc-back-chair"></div></div>
          <div class="tc-back-desk"><div class="tc-back-screen"></div><div class="tc-back-chair"></div></div>
        </div>

        <div class="tc-front-row">
          <div class="tc-workstation">
            <div class="tc-monitor">
              <div class="tc-monitor-head"><span>MARKET</span><b>BRVM</b></div>
              <div class="tc-bars"><i style="height:35%"></i><i style="height:53%"></i><i style="height:46%"></i><i style="height:69%"></i><i style="height:57%"></i><i style="height:78%"></i><i style="height:66%"></i><i style="height:86%"></i></div>
              <div class="tc-monitor-foot"><span>SONATEL</span><b>DATA</b></div>
            </div>
            <div class="tc-person"></div>
            <div class="tc-table"></div>
          </div>

          <div class="tc-workstation">
            <div class="tc-monitor">
              <div class="tc-monitor-head"><span>ANALYSIS</span><b>FUNDAMENTAL</b></div>
              <div class="tc-bars"><i style="height:42%"></i><i style="height:58%"></i><i style="height:50%"></i><i style="height:74%"></i><i style="height:63%"></i><i style="height:82%"></i><i style="height:70%"></i></div>
              <div class="tc-monitor-foot"><span>FINANCIALS</span><b>LIVE</b></div>
            </div>
            <div class="tc-person"></div>
            <div class="tc-table"></div>
          </div>

          <div class="tc-workstation">
            <div class="tc-monitor">
              <div class="tc-monitor-head"><span>PORTFOLIO</span><b>MONITOR</b></div>
              <div class="tc-bars"><i style="height:31%"></i><i style="height:44%"></i><i style="height:39%"></i><i style="height:61%"></i><i style="height:56%"></i><i style="height:72%"></i><i style="height:84%"></i></div>
              <div class="tc-monitor-foot"><span>RISK</span><b>TRACKING</b></div>
            </div>
            <div class="tc-person"></div>
            <div class="tc-table"></div>
          </div>
        </div>

        <div class="tc-floor-plane" aria-hidden="true"></div>
        <div class="tc-floor-glow" aria-hidden="true"></div>

        <div class="tc-room-ticker">
          <span>SONATEL <b>MARKET</b></span>
          <span>BOA SN <b>ANALYSIS</b></span>
          <span>CORIS BANK <b>DATA</b></span>
          <span>BRVM 30 <b>INDEX</b></span>
          <span>THE CAPITAL <b>INTELLIGENCE</b></span>
        </div>
      </div>
    `;

    const hero=document.querySelector('.hero');
    hero?.classList.add('tc-immersive-hero');

    const eyebrow=document.querySelector('.hero .eyebrow');
    if(eyebrow) eyebrow.textContent='THE CAPITAL · MARCHÉS AFRICAINS';

    const title=document.querySelector('.hero h1');
    if(title) title.innerHTML='Intelligence financière<br><em>africaine.</em>';
  };

  const data=async()=>{
    try{
      const response=await fetch('/api/marche?type=indices',{headers:{Accept:'application/json'}});
      if(!response.ok) throw new Error('market-data');

      const rows=await response.json();
      const find=name=>rows.find(row=>
        String(row.indice||'').toUpperCase().replace(/[-_]/g,' ')===name
      );

      const composite=find('BRVM COMPOSITE');
      if(composite){
        const value=Number(composite.valeur);
        const variation=Number(composite.variation_pct);
        const valueNode=document.querySelector('.tc-composite-value');
        const changeNode=document.querySelector('.tc-composite-change');

        if(valueNode&&Number.isFinite(value)){
          valueNode.textContent=value.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
        }
        if(changeNode&&Number.isFinite(variation)){
          changeNode.textContent=`${variation>=0?'+':''}${variation.toFixed(2)} %`;
        }
      }
    }catch{}
  };

  const reveals=()=>{
    const sections=document.querySelectorAll('.section');
    if(!('IntersectionObserver' in window)){
      sections.forEach(section=>section.classList.add('tc-visible'));
      return;
    }

    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('tc-visible');
          observer.unobserve(entry.target);
        }
      });
    },{threshold:.12});

    sections.forEach(section=>observer.observe(section));
  };

  const boot=()=>{
    document.body.classList.add('tc-institution');
    setupTheme();
    scene();
    reveals();
    requestAnimationFrame(()=>document.querySelector('.tc-floor-scene')?.classList.add('active'));
    data();
  };

  document.readyState==='loading'
    ? document.addEventListener('DOMContentLoaded',boot,{once:true})
    : boot();
})();
