// THE CAPITAL — Historical index charts
(function(){
  'use strict';
  if(window.__TC_DASHBOARD_INDICES__)return;
  window.__TC_DASHBOARD_INDICES__=true;

  let history=[];
  let loaded=false;
  let period=30;
  let chart=null;

  function normalizeName(value){
    return String(value||'').trim().toUpperCase().replace(/[\s_-]+/g,' ');
  }
  function findSeries(name){
    const target=normalizeName(name);
    const aliases={
      composite:['BRVM C','BRVM COMPOSITE','COMPOSITE'],
      brvm30:['BRVM 30','BRVM30','BRVM 30 INDEX','30'],
      prestige:['BRVM PRESTIGE','BRVM PRESTIGE INDEX','PRESTIGE']
    };
    const list=aliases[name]||[];
    const rows=history.filter(r=>list.indexOf(normalizeName(r.indice))>=0&&r.valeur!=null);
    return rows.sort((a,b)=>new Date(a.date_seance)-new Date(b.date_seance)).slice(-period);
  }
  function base100(rows){
    if(!rows.length)return [];
    const first=Number(rows[0].valeur);
    if(!Number.isFinite(first)||first===0)return [];
    return rows.map(r=>({date:r.date_seance,value:Number(((Number(r.valeur)/first)*100).toFixed(3))}));
  }
  function ensureTitle(){
    const title=document.querySelector('#chartComposite')?.closest('.card')?.querySelector('.card-title');
    if(title)title.textContent='Indices BRVM — comparaison de performance';
    const sub=document.querySelector('#chartComposite')?.closest('.card')?.querySelector('.card-header div:last-child');
    if(sub)sub.textContent='Base 100 · 30 séances';
  }
  function draw(){
    const canvas=document.getElementById('chartComposite');
    if(!canvas||!window.Chart)return;
    const series=[['composite','BRVM Composite'],['brvm30','BRVM-30'],['prestige','BRVM Prestige']].map(([key,label])=>({key,label,data:base100(findSeries(key))}));
    const usable=series.filter(s=>s.data.length>=2);
    if(chart){chart.destroy();chart=null;}
    if(!usable.length){
      const ctx=canvas.getContext('2d');
      if(ctx){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='rgba(245,240,232,.45)';ctx.font='14px DM Sans';ctx.textAlign='center';ctx.fillText('Historique des indices indisponible',canvas.width/2,canvas.height/2);}
      return;
    }
    const dates=[...new Set(usable.flatMap(s=>s.data.map(d=>d.date)))].sort();
    const labels=dates.map(d=>new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}));
    const dataset=usable.map((s,i)=>({label:s.label,data:dates.map(d=>{const x=s.data.find(v=>v.date===d);return x?x.value:null;}),tension:.25,pointRadius:0,pointHoverRadius:5,spanGaps:true,borderWidth:2}));
    chart=new Chart(canvas,{type:'line',data:{labels,datasets:dataset},options:{responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},plugins:{legend:{display:true,position:'top',labels:{usePointStyle:true,boxWidth:8,color:'rgba(245,240,232,.72)',font:{family:'DM Sans',size:11}}},tooltip:{callbacks:{label:function(c){return c.dataset.label+': '+Number(c.parsed.y).toFixed(2);}}}},scales:{x:{grid:{display:false},ticks:{color:'rgba(245,240,232,.45)',maxTicksLimit:8}},y:{grid:{color:'rgba(184,150,78,.10)'},ticks:{color:'rgba(245,240,232,.45)',callback:function(v){return Number(v).toFixed(0);}}}}}}});
  }
  async function load(){
    try{
      const res=await fetch('/api/indices-history?limit=1000&_='+Date.now(),{headers:{Accept:'application/json'}});
      if(!res.ok)throw new Error('HTTP '+res.status);
      const data=await res.json();
      history=Array.isArray(data)?data:[];
      loaded=true;
      ensureTitle();
      draw();
    }catch(e){console.warn('[DASHBOARD INDICES] Historique indisponible:',e.message||e);}
  }
  window.setIndexComparisonPeriod=function(days,btn){period=Number(days)||30;document.querySelectorAll('[data-index-period]').forEach(b=>b.classList.toggle('active',b===btn));draw();};
  window.renderHistoricalIndexComparison=function(){if(loaded){ensureTitle();draw();}else load();};
  setTimeout(load,0);
})();
