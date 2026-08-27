(()=>{
  'use strict';

  const STORAGE_KEY='thecapital:landing-theme';
  const prefersLight=()=>window.matchMedia?.('(prefers-color-scheme: light)').matches;
  const getTheme=()=>{try{return localStorage.getItem(STORAGE_KEY)|| (prefersLight()?'light':'dark')}catch{return prefersLight()?'light':'dark'}};
  const normaliseName=value=>String(value||'').trim().toUpperCase().replace(/[-_]+/g,' ');

  const setTheme=(theme,button)=>{
    const light=theme==='light';
    document.body.classList.toggle('tc-light',light);
    document.body.classList.toggle('tc-dark',!light);
    if(button){
      button.textContent=light?'☾':'☼';
      button.setAttribute('aria-label',light?'Passer en mode sombre':'Passer en mode clair');
      button.title=light?'Mode sombre':'Mode clair';
    }
    try{localStorage.setItem(STORAGE_KEY,light?'light':'dark')}catch{}
  };

  const makePath=(rows)=>{
    const values=rows.map(r=>Number(r.valeur)).filter(Number.isFinite);
    if(values.length<2)return '';
    const min=Math.min(...values),max=Math.max(...values),range=max-min||1;
    const width=520,height=90,pad=4;
    return values.map((v,i)=>{
      const x=pad+(i/(values.length-1))*(width-pad*2);
      const y=height-pad-((v-min)/range)*(height-pad*2);
      return `${i?'L':'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');
  };

  const normaliseIndex=(rows,name)=>rows.find(r=>normaliseName(r.indice)===normaliseName(name))||null;

  const buildScene=()=>{
    const hero=document.querySelector('.hero');
    if(!hero||hero.querySelector('.tc-market-scene'))return null;
    hero.classList.add('tc-immersive-hero');
    hero.innerHTML=`
      <div class="tc-market-scene" aria-label="Salle de marchés The Capital">
        <div class="tc-ceiling"></div>
        <div class="tc-window-wall">
          <article class="tc-market-panel main live">
            <small>BRVM COMPOSITE</small><strong data-index="BRVM COMPOSITE">—</strong><em data-change="BRVM COMPOSITE">Données de marché</em>
            <svg class="chart" viewBox="0 0 520 90" preserveAspectRatio="none" aria-hidden="true"><path data-chart="composite"></path></svg>
            <div class="panel-rule"></div><span class="panel-caption" data-date>—</span>
          </article>
          <article class="tc-market-panel">
            <small>BRVM 30</small><strong data-index="BRVM 30">—</strong><em data-change="BRVM 30">Données de marché</em>
            <svg class="chart" viewBox="0 0 520 90" preserveAspectRatio="none" aria-hidden="true"><path data-chart="brvm30"></path></svg>
          </article>
          <article class="tc-market-panel">
            <small>BRVM PRESTIGE</small><strong data-index="BRVM PRESTIGE">—</strong><em data-change="BRVM PRESTIGE">Données de marché</em>
            <svg class="chart" viewBox="0 0 520 90" preserveAspectRatio="none" aria-hidden="true"><path data-chart="prestige"></path></svg>
          </article>
          <article class="tc-market-panel wide">
            <small>MARKET SESSION · BRVM</small><strong>MARKET DATA</strong><em data-session>Connexion aux données de marché</em>
            <div class="panel-ticker"><span>INDICES</span><b>BRVM</b><span>SESSION</span><b data-date>—</b><span>STATUS</span><b>ACTIVE</b></div>
          </article>
        </div>
        <div class="tc-floor-desk" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="tc-market-floor"></div>
        <div class="tc-glass-reflection"></div>
        <div class="tc-architectural-line a"></div><div class="tc-architectural-line b"></div>
        <div class="tc-market-status"><span>THE CAPITAL</span><b>MARKET FLOOR · BRVM</b></div>
        <div class="tc-market-orb" aria-hidden="true"><span class="orb-sheen"></span></div>
        <div class="tc-hero-vignette"></div>
        <div class="tc-hero-content">
          <div class="eyebrow">The Capital · Financial Markets</div>
          <h1>Financial<br><em>Markets Intelligence.</em></h1>
          <p>Une lecture claire des marchés africains, des données et de l'analyse, conçue pour transformer l'information financière en décision.</p>
        </div>
        <div class="scene-data"><span>MARKET DATA <b data-data-status>READY</b></span><span>AFRICA · BRVM</span></div>
      </div>`;
    return hero.querySelector('.tc-market-scene');
  };

  const loadMarketData=async(scene)=>{
    const setText=(selector,text)=>scene.querySelectorAll(selector).forEach(el=>{el.textContent=text});
    try{
      const [latestResponse,historyResponse]=await Promise.all([
        fetch('/api/marche?type=indices',{headers:{Accept:'application/json'}}),
        fetch('/api/marche?type=indices_historique&limit=30',{headers:{Accept:'application/json'}})
      ]);
      if(!latestResponse.ok||!historyResponse.ok)throw new Error('market data unavailable');
      const latest=await latestResponse.json();
      const history=await historyResponse.json();
      const rows=Array.isArray(latest)?latest:[];
      const historyRows=Array.isArray(history)?history:[];
      const composite=normaliseIndex(rows,'BRVM COMPOSITE');
      const brvm30=normaliseIndex(rows,'BRVM 30');
      const prestige=normaliseIndex(rows,'BRVM PRESTIGE');
      [composite,brvm30,prestige].forEach(row=>{
        if(!row)return;
        const name=normaliseName(row.indice);
        const value=Number(row.valeur);
        const pct=Number(row.variation_pct);
        const valueText=Number.isFinite(value)?value.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
        const pctText=Number.isFinite(pct)?`${pct>=0?'+':''}${pct.toFixed(2)} %`:'Variation indisponible';
        setText(`[data-index="${name}"]`,valueText);
        setText(`[data-change="${name}"]`,pctText);
      });
      const date=rows.find(r=>r.date_seance)?.date_seance||historyRows.find(r=>r.date_seance)?.date_seance||'—';
      setText('[data-date]',date);
      setText('[data-session]','DONNÉES DE MARCHÉ DISPONIBLES');
      setText('[data-data-status]','LIVE DATA');

      const groups={composite:'BRVM COMPOSITE',brvm30:'BRVM 30',prestige:'BRVM PRESTIGE'};
      Object.entries(groups).forEach(([key,name])=>{
        const path=makePath(historyRows.filter(r=>normaliseName(r.indice)===normaliseName(name)));
        const el=scene.querySelector(`[data-chart="${key}"]`);
        if(el&&path){el.setAttribute('d',path);requestAnimationFrame(()=>el.classList.add('draw'));}
      });
    }catch(error){
      setText('[data-data-status]','DATA UNAVAILABLE');
      setText('[data-session]','Données non disponibles');
      console.warn('[The Capital] Market data unavailable:',error);
    }
  };

  const setupTheme=()=>{
    const nav=document.querySelector('.links');
    if(!nav||nav.querySelector('.tc-theme-toggle'))return;
    const button=document.createElement('button');
    button.type='button';button.className='tc-theme-toggle';button.setAttribute('aria-label','Passer en mode clair');
    nav.appendChild(button);
    setTheme(getTheme(),button);
    button.addEventListener('click',()=>setTheme(document.body.classList.contains('tc-light')?'dark':'light',button));
  };

  const setupReveals=()=>{
    const sections=[...document.querySelectorAll('.section')].filter(s=>s.id);
    sections.forEach(s=>s.classList.add('tc-reveal'));
    if(!('IntersectionObserver' in window)){sections.forEach(s=>s.classList.add('is-visible'));return;}
    const io=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add('is-visible');io.unobserve(entry.target);}
    }),{threshold:.14,rootMargin:'0px 0px -8% 0px'});
    sections.forEach(s=>io.observe(s));
  };

  const setupTape=async()=>{
    const tape=document.querySelector('.strip .wrap');
    if(!tape||tape.querySelector('.tc-live-tape'))return;
    const item=document.createElement('span');item.className='tc-live-tape';item.textContent='MARKET DATA · BRVM';tape.prepend(item);
    try{
      const response=await fetch('/api/marche?type=indices',{headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error('ticker unavailable');
      const rows=await response.json();
      const composite=normaliseIndex(Array.isArray(rows)?rows:[],'BRVM COMPOSITE');
      if(composite){
        const value=Number(composite.valeur),pct=Number(composite.variation_pct);
        item.innerHTML=`<b>MARKET DATA</b> · BRVM COMPOSITE <strong>${Number.isFinite(value)?value.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}</strong> <i>${Number.isFinite(pct)?`${pct>=0?'+':''}${pct.toFixed(2)} %`:'—'}</i>`;
      }
    }catch{item.textContent='MARKET DATA · BRVM';}
  };

  const boot=()=>{
    document.body.classList.add('tc-institution');
    setupTheme();
    const scene=buildScene();
    setupReveals();
    setupTape();
    if(!scene)return;
    requestAnimationFrame(()=>scene.classList.add('tc-hero-enter'));
    window.setTimeout(()=>loadMarketData(scene),650);
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
