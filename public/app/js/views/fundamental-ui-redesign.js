/* The Capital Invest — Analyse fondamentale / unified control + UX layer */
(function(){
  'use strict';
  const LS='tc_fundamental_pro_v2';
  const VIEW='#view-analyse-fondamentale';
  const read=()=>{try{return JSON.parse(localStorage.getItem(LS)||'{}')}catch(e){return {}}};
  const save=p=>{const s=read();Object.assign(s,p);try{localStorage.setItem(LS,JSON.stringify(s))}catch(e){}};
  const view=()=>document.querySelector(VIEW);
  const select=()=>document.getElementById('fundTickerSelect');
  const clean=t=>String(t||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function filter(q){const s=select();if(!s)return;const needle=String(q||'').trim().toLowerCase();Array.from(s.options).forEach((o,i)=>{if(i===0){o.hidden=false;return}o.hidden=!!needle&&!(`${o.textContent} ${o.value}`).toLowerCase().includes(needle)});}
  function setMethod(m,btn){if(typeof window.setFundMethod==='function')window.setFundMethod(m,btn);else window._fundMethod=m;const b=document.getElementById('tcFundControls');if(b)b.querySelectorAll('[data-method]').forEach(x=>x.classList.toggle('active',x.dataset.method===m));save({fundMethod:m});}

  function buildToolbar(){
    const v=view(),s=select();if(!v||!s||document.getElementById('tcFundControls'))return;
    const bar=document.createElement('div');bar.id='tcFundControls';bar.className='tc-fund-controls';bar.setAttribute('role','toolbar');
    bar.innerHTML=`<div class="tc-fund-security"><span class="tc-fund-search-icon" aria-hidden="true">⌕</span><input id="tcFundSearch" type="search" placeholder="Rechercher une société, ticker ou secteur…" aria-label="Rechercher une société"><button type="button" class="tc-fund-ticker" id="tcFundTicker" aria-label="Valeur active"><span id="tcFundTickerLabel">Sélectionner</span><span aria-hidden="true">⌄</span></button></div><div class="tc-fund-method" role="group" aria-label="Méthode de projection"><button type="button" data-method="tcam">TCAM</button><button type="button" data-method="regression">Régression</button></div><button type="button" class="tc-fund-mode" id="tcFundMode" aria-label="Basculer entre Simple et Pro" aria-pressed="true"><span>SIMPLE</span><b aria-hidden="true"></b><strong>PRO</strong></button><div class="tc-fund-actions"><button type="button" id="tcFundCompare" title="Comparer" aria-label="Comparer">⇄<span>Comparer</span></button><button type="button" id="tcFundExport" title="Exporter" aria-label="Exporter">↥<span>Exporter</span></button></div>`;
    const header=v.querySelector('.page-header');(header||v.firstElementChild)?.insertAdjacentElement('afterend',bar);
    bar.querySelector('.tc-fund-security').appendChild(s);s.classList.add('tc-fund-native-select');
    const search=bar.querySelector('#tcFundSearch'),ticker=bar.querySelector('#tcFundTickerLabel'),mode=bar.querySelector('#tcFundMode');
    const state=read();
    search.addEventListener('input',()=>{filter(search.value);s.size=search.value.trim()?6:1});
    search.addEventListener('keydown',e=>{if(e.key==='Escape'){search.value='';filter('');s.size=1;search.blur()}if(e.key==='Enter'&&s.options.length){const o=Array.from(s.options).find(o=>!o.hidden&&o.value);if(o){s.value=o.value;s.dispatchEvent(new Event('change'))}}});
    s.addEventListener('change',()=>{ticker.textContent=s.value||'Sélectionner';search.value='';filter('');s.size=1;save({ticker:s.value||''});if(typeof window.loadFundAnalysis==='function')window.loadFundAnalysis();setTimeout(enhanceRendered,80)});
    bar.querySelector('#tcFundTicker').addEventListener('click',()=>{search.focus();search.select();s.size=6});
    bar.querySelectorAll('[data-method]').forEach(b=>b.addEventListener('click',()=>setMethod(b.dataset.method,b)));
    mode.addEventListener('click',()=>{const next=(read().mode||'pro')==='pro'?'simple':'pro';save({mode:next});applyMode(next);});
    bar.querySelector('#tcFundCompare').onclick=()=>window.__tcFundCompare&&window.__tcFundCompare();
    bar.querySelector('#tcFundExport').onclick=()=>window.print();
    const initialTicker=state.ticker||s.value||'';if(initialTicker&&Array.from(s.options).some(o=>o.value===initialTicker))s.value=initialTicker;ticker.textContent=s.value||'Sélectionner';
    setMethod(state.fundMethod||window._fundMethod||'tcam');applyMode(state.mode||'pro');
  }

  function applyMode(mode){const v=view(),b=document.getElementById('tcFundControls');if(!v||!b)return;v.classList.toggle('fund-pro-simple',mode==='simple');const m=b.querySelector('#tcFundMode');if(m){m.classList.toggle('is-pro',mode==='pro');m.setAttribute('aria-pressed',mode==='pro');}}

  function removeDuplicates(){
    const v=view();if(!v)return;
    v.querySelectorAll('.fund-toolbar,.fund-pro-tools,.fund-pro-search,.fund-dynamic-filter').forEach(e=>e.remove());
    v.querySelectorAll('.filter-btn').forEach(b=>{const t=(b.textContent||'').trim().toLowerCase();if(t==='tcam'||t==='régression')b.closest('.fund-toolbar')?.remove()});
    v.querySelectorAll('.search-bar').forEach(e=>e.classList.add('tc-fund-hidden-control'));
    v.querySelectorAll('select#fundTickerSelect').forEach((s,i)=>{if(i>0)s.remove()});
    const bars=v.querySelectorAll('#tcFundControls');bars.forEach((b,i)=>{if(i>0)b.remove()});
  }

  function enhanceDcf(){
    const v=view();if(!v)return;
    [['fundWACC','WACC',1,30,0.1],['fundGrowth','Croissance LT',0,10,0.1]].forEach(cfg=>{
      const input=document.getElementById(cfg[0]);if(!input||input.dataset.tcSlider)return;
      input.dataset.tcSlider='1';input.type='range';input.min=cfg[2];input.max=cfg[3];input.step=cfg[4];
      const out=document.createElement('output');out.className='tc-fund-slider-value';out.textContent=(input.value||'')+' %';
      input.insertAdjacentElement('afterend',out);const sync=()=>{out.textContent=Number(input.value||0).toFixed(1)+' %'};input.addEventListener('input',sync);input.addEventListener('change',()=>{sync();if(typeof window.loadFundAnalysis==='function')window.loadFundAnalysis()});sync();
    });
    const proj=document.getElementById('fundProjYears');if(proj&&!proj.dataset.tcSlider){proj.dataset.tcSlider='1';proj.classList.add('tc-fund-projection-select');}
  }

  function makeSeriesMobileDrawer(){
    const v=view();if(!v||window.innerWidth>700)return;v.querySelectorAll('.fund-pro-custom').forEach(d=>{if(d.dataset.tcDrawer)return;d.dataset.tcDrawer='1';d.addEventListener('toggle',()=>{if(d.open)d.classList.add('tc-open');else d.classList.remove('tc-open')})});
  }

  function compare(){
    const all=Array.isArray(window.allFinancials)?window.allFinancials:[];const tickers=[...new Set(all.map(r=>r.ticker).filter(Boolean))].sort();
    document.getElementById('tcFundCompare')?.remove();const el=document.createElement('div');el.id='tcFundCompare';el.className='tc-fund-modal';
    el.innerHTML=`<div class="tc-fund-modal-bg"></div><div class="tc-fund-modal-box"><button class="tc-fund-modal-close" aria-label="Fermer">×</button><div class="tc-fund-modal-kicker">THE CAPITAL · COMPARAISON</div><h3>Comparer des sociétés</h3><p>Choisissez 2 à 3 valeurs. Une métrique indisponible reste N/A.</p><div class="tc-fund-compare-options">${tickers.map(t=>`<label><input type="checkbox" value="${clean(t)}"><span>${clean(t)}</span></label>`).join('')}</div><button class="tc-fund-primary" id="tcFundCompareGo">Comparer</button><div id="tcFundCompareResult"></div></div>`;
    document.body.appendChild(el);el.querySelector('.tc-fund-modal-bg').onclick=()=>el.remove();el.querySelector('.tc-fund-modal-close').onclick=()=>el.remove();
    el.querySelector('#tcFundCompareGo').onclick=()=>{const selected=[...el.querySelectorAll('input:checked')].map(x=>x.value).slice(0,3);if(selected.length<2){el.querySelector('#tcFundCompareResult').innerHTML='<div class="tc-fund-modal-note">Sélectionnez au moins 2 sociétés.</div>';return}const num=v=>Number.isFinite(Number(v))?Number(v):null;const rows=selected.map(t=>{const rs=all.filter(r=>String(r.ticker).toUpperCase()===String(t).toUpperCase()).sort((a,b)=>Number(a.annee)-Number(b.annee));const r=rs[rs.length-1]||{};const price=(Array.isArray(window.allCours)?window.allCours:[]).filter(c=>String(c.ticker).toUpperCase()===String(t).toUpperCase()).map(c=>num(c.cours)).filter(x=>x!==null).pop()??null;const b=num(r.bpa);return {t,r,p:price,per:price!==null&&b>0?price/b:null,margin:num(r.resultat_net)!==null&&num(r.chiffre_affaires)?num(r.resultat_net)/num(r.chiffre_affaires)*100:null}});const f=(x,u)=>x===null?'N/A':u==='%'?x.toFixed(1)+' %':u==='x'?x.toFixed(2)+'x':Math.round(x).toLocaleString('fr-FR');el.querySelector('#tcFundCompareResult').innerHTML=`<div class="tc-fund-compare-table-wrap"><table class="tc-fund-compare-table"><thead><tr><th>Indicateur</th>${rows.map(x=>`<th>${clean(x.t)}</th>`).join('')}</tr></thead><tbody>${[['Cours',x=>x.p,''],['BPA',x=>num(x.r.bpa),''],['PER',x=>x.per,'x'],['ROE',x=>num(x.r.roe),'%'],['Marge nette',x=>x.margin,'%'],['Dividend Yield',x=>num(x.r.dividend_yield??x.r.rendement_dividende),'%']].map(([l,fn,u])=>`<tr><td>${l}</td>${rows.map(x=>`<td>${f(fn(x),u)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`};
  }
  window.__tcFundCompare=compare;

  function enhanceRendered(){removeDuplicates();enhanceDcf();makeSeriesMobileDrawer();const v=view();if(!v)return;const mode=read().mode||'pro';applyMode(mode);const header=v.querySelector('.page-header');if(header)header.setAttribute('data-tc-fund-header','1');}
  function boot(){setTimeout(()=>{buildToolbar();enhanceRendered()},150);setTimeout(enhanceRendered,600);const obs=new MutationObserver(()=>{clearTimeout(window.__tcFundUiTimer);window.__tcFundUiTimer=setTimeout(()=>{if(!document.getElementById('tcFundControls'))buildToolbar();enhanceRendered()},120)});obs.observe(document.body,{childList:true,subtree:true});setTimeout(()=>obs.disconnect(),45000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();