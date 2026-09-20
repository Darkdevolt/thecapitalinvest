// THE CAPITAL — Dividend Intelligence Center
(function () {
  'use strict';
  if (window.__TC_DIVIDEND_SCREENER_LOADED__) return;
  window.__TC_DIVIDEND_SCREENER_LOADED__ = true;

  const esc = v => { const d=document.createElement('div'); d.textContent=v==null?'':String(v); return d.innerHTML; };
  const num = v => { if(v===''||v==null) return null; const n=Number(v); return Number.isFinite(n)?n:null; };
  const arr = k => Array.isArray(window[k]) ? window[k] : [];
  const divs = () => arr('allDividendes');
  const fins = () => arr('allFinancials');
  const cours = () => arr('allCours');
  const ymd = v => v ? String(v).slice(0,10) : '';
  const fmt = (v,d=2) => v==null ? '—' : Number(v).toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d});
  const pct = v => v==null ? '—' : fmt(v,2)+' %';
  const ticker = v => String(v||'').toUpperCase().trim();

  function sectorOf(t){ const e=(window.entMap&&window.entMap[t])||{}; return e.sous_secteur||e.secteur||'Autre'; }
  function nameOf(t){ const e=(window.entMap&&window.entMap[t])||{}; return e.nom||t; }
  function priceOf(t){
    const rows=cours().filter(r=>ticker(r.ticker)===t);
    if(!rows.length) return null;
    rows.sort((a,b)=>String(b.date_seance||'').localeCompare(String(a.date_seance||'')));
    return num(rows[0].cours_cloture??rows[0].cloture??rows[0].cours_normal??rows[0].cours);
  }
  function median(a){ a=a.filter(Number.isFinite).sort((x,y)=>x-y); if(!a.length)return null; const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; }

  function historyByTicker(){
    const m={};
    divs().forEach(r=>{const t=ticker(r.ticker), y=num(r.exercice??r.annee), d=num(r.montant_net??r.montant); if(!t||y==null)return; (m[t]||(m[t]=[])).push({year:y,dps:d,yield:num(r.taux_rendement??r.rendement),ex:ymd(r.date_detachement??r.ex_date),pay:ymd(r.date_paiement_cal??r.date_paiement)});});
    Object.values(m).forEach(a=>a.sort((x,y)=>x.year-y.year));
    return m;
  }
  function finFor(t,y){
    const a=fins().filter(f=>ticker(f.ticker)===t&&(!f.periode||String(f.periode).toLowerCase()==='annuel')).sort((x,z)=>(num(z.annee)||0)-(num(x.annee)||0));
    return a.find(f=>num(f.annee)===y)||a.find(f=>(num(f.annee)||0)<=y)||a[0]||null;
  }
  function payout(f){
    if(!f)return null; const s=num(f.payout_ratio); if(s!=null)return s;
    const d=num(f.dpa), b=num(f.bpa), rn=num(f.resultat_net), sh=num(f.nombre_actions??f.nb_actions);
    if(d!=null&&b>0)return d/b*100;
    if(d!=null&&rn>0&&sh)return d*sh/rn*100;
    return null;
  }
  function coverage(f){ const p=payout(f); return p!=null&&p>0?100/p:null; }
  function fcf(f){ const ocf=num(f?.cash_flow_operationnel), capex=num(f?.capex); return ocf!=null&&capex!=null ? ocf-Math.abs(capex) : null; }
  function growth(history,nYears=5){
    if(!history||history.length<2)return null;
    const latest=history[history.length-1], target=history.find(x=>x.year<=latest.year-nYears&&x.dps>0);
    if(!target||latest.dps==null||target.dps==null)return null;
    return (Math.pow(latest.dps/target.dps,1/(latest.year-target.year))-1)*100;
  }
  function streak(history){
    if(!history?.length)return 0; let c=0,last=null;
    for(let i=history.length-1;i>=0;i--){const x=history[i]; if(x.dps==null)break; if(last!=null&&last-x.year!==1)break; c++;last=x.year;} return c;
  }
  function currentRow(t){
    const h=historyByTicker()[t]||[]; return h[h.length-1]||null;
  }
  function forwardDps(t){
    const today=new Date(); today.setHours(0,0,0,0);
    const future=divs().filter(r=>ticker(r.ticker)===t).map(r=>({r,d:ymd(r.date_detachement??r.ex_date)})).filter(x=>x.d&&new Date(x.d+'T00:00:00')>=today).sort((a,b)=>a.d.localeCompare(b.d));
    if(!future.length)return null; return num(future[0].r.montant_net??future[0].r.montant);
  }

  let charts={}, selectedTicker='';
  function destroy(id){ if(charts[id]){try{charts[id].destroy();}catch(e){} delete charts[id];} }
  function chart(id,type,data,options={}){ const cv=document.getElementById(id); if(!cv||typeof window.Chart!=='function')return; destroy(id); charts[id]=new Chart(cv,{type,data,options:{responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},plugins:{legend:{labels:{color:'#c8c0b5',font:{size:10}}},tooltip:{mode:'index',intersect:false}},scales:{x:{ticks:{color:'#8f877d',font:{size:9}},grid:{color:'rgba(255,255,255,.05)'}},y:{ticks:{color:'#8f877d',font:{size:9}},grid:{color:'rgba(255,255,255,.05)'}}},...options}}); }

  function injectCss(){
    if(document.getElementById('tc-dividend-intelligence-css'))return;
    const s=document.createElement('style'); s.id='tc-dividend-intelligence-css';
    s.textContent=`
      #view-dividend-screener .di-hero{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:0 0 16px}
      #view-dividend-screener .di-kpi{padding:15px;border:1px solid var(--border2);background:linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.012));border-radius:10px}
      #view-dividend-screener .di-kpi-label{font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em}.di-kpi-value{font-size:21px;font-weight:700;margin-top:6px;color:var(--text)}.di-kpi-sub{font-size:10px;color:var(--dim);margin-top:3px}
      #view-dividend-screener .di-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.di-toolbar select,.di-toolbar input{min-width:145px}
      #view-dividend-screener .di-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0}.di-tab{background:transparent;color:var(--dim);border:1px solid var(--border2);padding:7px 11px;border-radius:7px;cursor:pointer}.di-tab.active{color:var(--gold);border-color:var(--gold)}
      #view-dividend-screener .di-grid{display:grid;grid-template-columns:1.25fr .75fr;gap:16px;margin-bottom:16px}.di-grid.equal{grid-template-columns:1fr 1fr}
      #view-dividend-screener .di-chart{height:300px;position:relative}.di-chart.tall{height:350px}
      #view-dividend-screener .di-card-title{font-weight:700;font-size:13px}.di-card-meta{font-size:10px;color:var(--dim);margin-top:3px}
      #view-dividend-screener .di-pills{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}.di-pill{padding:5px 8px;border-radius:999px;border:1px solid var(--border2);font-size:10px;color:var(--dim)}
      #view-dividend-screener .di-pill strong{color:var(--text)}
      #view-dividend-screener .di-actions{display:flex;gap:8px;flex-wrap:wrap}.di-actions button{cursor:pointer}
      #view-dividend-screener .di-table-row{cursor:pointer}.di-table-row:hover{background:rgba(255,255,255,.025)}
      #view-dividend-screener .di-badge{font-size:9px;padding:3px 7px;border:1px solid var(--border2);border-radius:999px;white-space:nowrap}.di-good{color:var(--green)!important;border-color:rgba(74,222,128,.35)!important}.di-warn{color:var(--red)!important;border-color:rgba(248,113,113,.35)!important}
      #view-dividend-screener .di-calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.di-day{min-height:76px;padding:7px;border:1px solid var(--border2);border-radius:7px;background:rgba(255,255,255,.015)}.di-day small{color:var(--dim)}.di-event{margin-top:5px;font-size:9px;color:var(--gold);cursor:pointer}
      #view-dividend-screener .di-calc{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.di-calc-result{font-size:18px;font-weight:700;color:var(--gold)}
      @media(max-width:1000px){#view-dividend-screener .di-hero{grid-template-columns:repeat(3,1fr)}#view-dividend-screener .di-grid,#view-dividend-screener .di-grid.equal{grid-template-columns:1fr}}
      @media(max-width:600px){#view-dividend-screener .di-hero{grid-template-columns:repeat(2,1fr)}#view-dividend-screener .di-calc{grid-template-columns:1fr 1fr}.di-calendar{grid-template-columns:repeat(2,1fr)!important}}
    `;
    document.head.appendChild(s);
  }

  function kpis(rows){
    const yields=rows.map(r=>r.y).filter(v=>v!=null), growths=rows.map(r=>r.g3).filter(v=>v!=null);
    const avg=yields.length?yields.reduce((a,b)=>a+b,0)/yields.length:null, med=median(yields), max=yields.length?Math.max(...yields):null;
    return {avg,med,max,count:rows.length,avgGrowth:growths.length?growths.reduce((a,b)=>a+b,0)/growths.length:null};
  }

  function datasetRows(){
    const hm=historyByTicker(), by={};
    divs().forEach(r=>{const t=ticker(r.ticker),y=num(r.exercice??r.annee); if(!t||y==null)return; if(!by[t]||y>(num(by[t].exercice??by[t].annee)||0))by[t]=r;});
    return Object.keys(by).map(t=>{const r=by[t], h=hm[t]||[], y=num(r.taux_rendement??r.rendement), f=finFor(t,num(r.exercice??r.annee)), p=payout(f), price=priceOf(t), fd=forwardDps(t); return {t,name:nameOf(t),sector:sectorOf(t),year:num(r.exercice??r.annee),dps:num(r.montant_net??r.montant),y,g3:growth(h,3),g5:growth(h,5),payout:p,coverage:coverage(f),fcf:fcf(f),streak:streak(h),price,forwardYield:fd!=null&&price>0?fd/price*100:null,h};});
  }

  function build(){
    const view=document.getElementById('view-dividend-screener'); if(!view)return; injectCss();
    if(view.dataset.built==='1'){renderAll();return;} view.dataset.built='1';
    view.innerHTML=`
      <div class="page-header"><h1>Dividend <span style="color:var(--gold)">Intelligence</span></h1><p>Analysez rendement, croissance, couverture, soutenabilité et calendrier des dividendes BRVM.</p></div>
      <div class="di-hero" id="diKpis"></div>
      <div class="card mb20"><div class="card-body"><div class="di-toolbar">
        <select id="diTicker"><option value="">Choisir une société…</option></select>
        <select id="diSector"><option value="">Tous les secteurs</option></select>
        <input id="diMinYield" type="number" placeholder="Yield min %" step=".1"><input id="diMaxYield" type="number" placeholder="Yield max %" step=".1">
        <input id="diMinGrowth" type="number" placeholder="Growth min %" step=".1">
        <select id="diPeriod"><option value="all">Tout l'historique</option><option value="3">3 ans</option><option value="5" selected>5 ans</option><option value="10">10 ans</option></select>
      </div></div></div>
      <div class="di-tabs"><button class="di-tab active" data-tab="overview">Overview</button><button class="di-tab" data-tab="screener">Screener</button><button class="di-tab" data-tab="calendar">Calendrier</button><button class="di-tab" data-tab="compare">Comparer</button><button class="di-tab" data-tab="calculator">Calculateur</button></div>
      <div id="diOverview">
        <div class="di-grid"><div class="card"><div class="card-header"><div><div class="di-card-title">Dividend Yield vs Growth</div><div class="di-card-meta">Chaque bulle représente une société · taille = capitalisation si disponible</div></div></div><div class="card-body"><div class="di-chart tall"><canvas id="diScatter"></canvas></div></div></div>
        <div class="card"><div class="card-header"><div><div class="di-card-title">Profil du titre</div><div class="di-card-meta" id="diProfileMeta">Sélectionnez une société</div></div></div><div class="card-body"><div id="diProfilePills"></div><div class="di-chart"><canvas id="diProfileChart"></canvas></div></div></div></div>
        <div class="di-grid equal"><div class="card"><div class="card-header"><div class="di-card-title">Dividend Yield historique</div></div><div class="card-body"><div class="di-chart"><canvas id="diYieldHistory"></canvas></div></div></div>
        <div class="card"><div class="card-header"><div class="di-card-title">Payout & Dividend Coverage</div></div><div class="card-body"><div class="di-chart"><canvas id="diPayoutHistory"></canvas></div></div></div></div>
        <div class="di-grid equal"><div class="card"><div class="card-header"><div class="di-card-title">Yield moyen par secteur</div></div><div class="card-body"><div class="di-chart"><canvas id="diSectorChart"></canvas></div></div></div>
        <div class="card"><div class="card-header"><div class="di-card-title">FCF vs Dividendes</div></div><div class="card-body"><div class="di-chart"><canvas id="diFcfChart"></canvas></div></div></div></div>
      </div>
      <div id="diScreener" style="display:none"><div class="card"><div class="card-header"><div class="card-title">Résultats du screener</div><div id="diCount" style="font-size:11px;color:var(--dim)"></div></div><div class="table-wrap"><table><thead><tr><th>Société</th><th>Secteur</th><th class="right">Yield</th><th class="right">Growth 3Y</th><th class="right">Growth 5Y</th><th class="right">Payout</th><th class="right">Coverage</th><th class="right">Forward Yield</th><th>Régularité</th></tr></thead><tbody id="diTable"></tbody></table></div></div></div>
      <div id="diCalendar" style="display:none"><div class="card mb20"><div class="card-header"><div class="card-title">Calendrier des dividendes</div><div class="di-actions"><button id="diPrev">←</button><button id="diNext">→</button></div></div><div class="card-body"><div id="diCalendarGrid" class="di-calendar"></div></div></div><div class="card"><div class="card-header"><div class="card-title">Prochains détachements</div></div><div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Ex-Date</th><th>Payment Date</th><th>Yield</th><th>Statut</th></tr></thead><tbody id="diUpcoming"></tbody></table></div></div></div>
      <div id="diCompare" style="display:none"><div class="card"><div class="card-header"><div class="card-title">Comparaison multi-actions</div></div><div class="card-body"><div id="diComparePicks" class="di-pills"></div><div class="di-chart tall"><canvas id="diCompareChart"></canvas></div><div class="table-wrap"><table><thead><tr><th>Indicateur</th><th id="cmpH1">—</th><th id="cmpH2">—</th><th id="cmpH3">—</th><th id="cmpH4">—</th></tr></thead><tbody id="diCompareTable"></tbody></table></div></div></div></div>
      <div id="diCalculator" style="display:none"><div class="card"><div class="card-header"><div class="card-title">Calculateur de revenus de dividendes</div></div><div class="card-body"><div class="di-calc"><div><label>Capital investi (FCFA)</label><input id="diCapital" type="number" value="10000000"></div><div><label>Prix par action</label><input id="diCalcPrice" type="number"></div><div><label>DPS annuel</label><input id="diCalcDps" type="number"></div><div><label>Croissance annuelle</label><input id="diCalcGrowth" type="number" value="0" step=".1"></div></div><div class="di-pills" style="margin-top:18px"><div class="di-pill">Actions <strong id="diCalcShares">—</strong></div><div class="di-pill">Dividende annuel <strong class="di-calc-result" id="diCalcIncome">—</strong></div><div class="di-pill">Yield on Cost <strong id="diCalcYoc">—</strong></div><div class="di-pill">Revenu mensuel <strong id="diCalcMonthly">—</strong></div></div><div class="di-chart"><canvas id="diIncomeChart"></canvas></div></div></div></div>`;
    bind();
  }

  function bind(){
    ['diTicker','diSector','diMinYield','diMaxYield','diMinGrowth','diPeriod'].forEach(id=>document.getElementById(id)?.addEventListener('change',renderAll));
    ['diMinYield','diMaxYield','diMinGrowth','diCapital','diCalcPrice','diCalcDps','diCalcGrowth'].forEach(id=>document.getElementById(id)?.addEventListener('input',renderAll));
    document.querySelectorAll('#view-dividend-screener .di-tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#view-dividend-screener .di-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');showTab(b.dataset.tab);}));
    document.getElementById('diTicker')?.addEventListener('change',()=>{selectedTicker=document.getElementById('diTicker').value;});
    document.getElementById('diPrev')?.addEventListener('click',()=>calendarMove(-1));
    document.getElementById('diNext')?.addEventListener('click',()=>calendarMove(1));
  }
  let calDate=new Date();

  function syncSelectors(rows){
    const tsel=document.getElementById('diTicker'), sec=document.getElementById('diSector'); if(!tsel||!sec)return;
    const old=tsel.value, oldS=sec.value;
    tsel.innerHTML='<option value="">Choisir une société…</option>'+rows.sort((a,b)=>a.t.localeCompare(b.t)).map(r=>'<option value="'+esc(r.t)+'">'+esc(r.t+' · '+r.name)+'</option>').join('');
    tsel.value=rows.some(r=>r.t===old)?old:'';
    const sectors=[...new Set(rows.map(r=>r.sector))].sort();
    sec.innerHTML='<option value="">Tous les secteurs</option>'+sectors.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join('');
    sec.value=sectors.includes(oldS)?oldS:'';
    if(!selectedTicker)selectedTicker=tsel.value;
  }
  function filtered(rows){
    const sec=document.getElementById('diSector')?.value||'', min=num(document.getElementById('diMinYield')?.value), max=num(document.getElementById('diMaxYield')?.value), mg=num(document.getElementById('diMinGrowth')?.value);
    return rows.filter(r=>(!sec||r.sector===sec)&&(min==null||r.y>=min)&&(max==null||r.y<=max)&&(mg==null||(r.g3!=null&&r.g3>=mg)));
  }
  function showTab(tab){
    ['Overview','Screener','Calendar','Compare','Calculator'].forEach(x=>{const el=document.getElementById('di'+x);if(el)el.style.display=x.toLowerCase()===tab?'':'none';});
    renderAll();
  }

  function renderAll(){
    const rows=datasetRows(); syncSelectors(rows); const out=filtered(rows), k=kpis(out);
    document.getElementById('diKpis').innerHTML=[
      ['Dividend Yield moyen',pct(k.avg),'sur le périmètre filtré'],['Yield médian',pct(k.med),'moins sensible aux extrêmes'],['Plus haut Yield',pct(k.max),'titre le plus élevé'],['Croissance moyenne 5Y',pct(k.avgGrowth),'CAGR quand disponible'],['Titres distributifs',k.count,'dans le périmètre'],['Détachements à venir',divs().filter(r=>ymd(r.date_detachement??r.ex_date)>=new Date().toISOString().slice(0,10)).length,'calendrier BRVM']
    ].map(x=>'<div class="di-kpi"><div class="di-kpi-label">'+x[0]+'</div><div class="di-kpi-value">'+x[1]+'</div><div class="di-kpi-sub">'+x[2]+'</div></div>').join('');
    renderScatter(out); renderProfile(rows); renderSector(out); renderScreener(out); renderCalendar(); renderCompare(rows); renderCalculator();
  }

  function renderScatter(rows){
    const pts=rows.filter(r=>r.y!=null&&r.g3!=null).map(r=>({x:r.y,y:r.g3,r}));
    chart('diScatter','scatter',{datasets:[{label:'Titres',data:pts,backgroundColor:'rgba(212,175,55,.72)',borderColor:'rgba(212,175,55,.9)',pointRadius:5,pointHoverRadius:8}]},{plugins:{tooltip:{callbacks:{label:c=>{const r=c.raw.r;return r.t+' · Yield '+pct(r.y)+' · Growth '+pct(r.g3);}}}},scales:{x:{title:{display:true,text:'Dividend Yield (%)',color:'#9e978e'},ticks:{color:'#8f877d'},grid:{color:'rgba(255,255,255,.05)'}},y:{title:{display:true,text:'Dividend Growth 3Y (%)',color:'#9e978e'},ticks:{color:'#8f877d'},grid:{color:'rgba(255,255,255,.05)'}}}});
  }

  function renderProfile(rows){
    const t=document.getElementById('diTicker')?.value||selectedTicker||rows[0]?.t; if(!t)return;
    const r=rows.find(x=>x.t===t)||rows[0]; if(!r)return; selectedTicker=r.t;
    const meta=document.getElementById('diProfileMeta'); if(meta)meta.textContent=r.t+' · '+r.name+' · '+r.sector;
    document.getElementById('diProfilePills').innerHTML=[['Yield',pct(r.y)],['Forward Yield',pct(r.forwardYield)],['Growth 3Y',pct(r.g3)],['Growth 5Y',pct(r.g5)],['Payout',pct(r.payout)],['Coverage',r.coverage?fmt(r.coverage,2)+'x':'—'],['Streak',r.streak+' ans'],['Prix',r.price?fmt(r.price,0)+' FCFA':'—']].map(x=>'<span class="di-pill">'+x[0]+' <strong>'+x[1]+'</strong></span>').join('');
    const h=r.h||[]; chart('diProfileChart','bar',{labels:h.map(x=>x.year),datasets:[{label:'DPS net',data:h.map(x=>x.dps),backgroundColor:'rgba(212,175,55,.45)',borderColor:'rgba(212,175,55,.9)',borderWidth:1}]});
    chart('diYieldHistory','line',{labels:h.map(x=>x.year),datasets:[{label:'Yield',data:h.map(x=>x.yield),borderColor:'rgba(212,175,55,.95)',backgroundColor:'rgba(212,175,55,.12)',fill:true,tension:.3,pointRadius:3}]},{plugins:{legend:{display:false}}});
    const fs=h.map(x=>finFor(r.t,x.year)); chart('diPayoutHistory','line',{labels:h.map(x=>x.year),datasets:[{label:'Payout %',data:fs.map(f=>payout(f)),borderColor:'rgba(212,175,55,.95)',tension:.3},{label:'Coverage x',data:fs.map(f=>coverage(f)),borderColor:'rgba(96,165,250,.9)',tension:.3,yAxisID:'y2'}]},{scales:{y:{title:{display:true,text:'Payout %',color:'#9e978e'}},y2:{position:'right',title:{display:true,text:'Coverage x',color:'#9e978e'},grid:{drawOnChartArea:false}}}});
    const fcfData=h.map(x=>fcf(finFor(r.t,x.year))); chart('diFcfChart','bar',{labels:h.map(x=>x.year),datasets:[{label:'FCF',data:fcfData,backgroundColor:'rgba(96,165,250,.38)'},{label:'Dividendes',data:h.map(x=>x.dps),backgroundColor:'rgba(212,175,55,.48)'}]});
  }

  function renderSector(rows){
    const m={}; rows.forEach(r=>{if(r.y!=null)(m[r.sector]||(m[r.sector]=[])).push(r.y);}); const a=Object.keys(m).map(s=>({s,y:median(m[s])})).sort((x,y)=>y.y-x.y);
    chart('diSectorChart','bar',{labels:a.map(x=>x.s),datasets:[{label:'Yield médian %',data:a.map(x=>x.y),backgroundColor:'rgba(212,175,55,.48)',borderColor:'rgba(212,175,55,.9)',borderWidth:1}]},{indexAxis:'y',plugins:{legend:{display:false}}});
  }

  function renderScreener(rows){
    const tb=document.getElementById('diTable'); if(!tb)return; document.getElementById('diCount').textContent=rows.length+' résultat(s)';
    tb.innerHTML=rows.sort((a,b)=>(b.y??-999)-(a.y??-999)).map(r=>'<tr class="di-table-row" onclick="openFiche && openFiche(\''+esc(r.t)+'\',\'dividend-screener\')"><td><strong style="color:var(--gold)">'+esc(r.t)+'</strong><div style="font-size:10px;color:var(--dim)">'+esc(r.name)+'</div></td><td>'+esc(r.sector)+'</td><td class="right">'+pct(r.y)+'</td><td class="right">'+pct(r.g3)+'</td><td class="right">'+pct(r.g5)+'</td><td class="right">'+pct(r.payout)+'</td><td class="right">'+(r.coverage?fmt(r.coverage,2)+'x':'—')+'</td><td class="right">'+pct(r.forwardYield)+'</td><td><span class="di-badge '+(r.streak>=3?'di-good':'')+'">'+r.streak+' ans</span></td></tr>').join('')||'<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--dim)">Aucune donnée.</td></tr>';
  }

  function calendarRows(){ return divs().map(r=>({t:ticker(r.ticker),ex:ymd(r.date_detachement??r.ex_date),pay:ymd(r.date_paiement_cal??r.date_paiement),y:num(r.taux_rendement??r.rendement),status:r.statut||'—'})).filter(r=>r.ex).sort((a,b)=>a.ex.localeCompare(b.ex)); }
  function calendarMove(d){calDate.setMonth(calDate.getMonth()+d);renderCalendar();}
  function renderCalendar(){
    const rows=calendarRows(), y=calDate.getFullYear(),m=calDate.getMonth(), first=new Date(y,m,1), last=new Date(y,m+1,0), grid=document.getElementById('diCalendarGrid'); if(!grid)return;
    const names=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']; let html=names.map(n=>'<div class="di-day" style="min-height:auto;font-weight:700;color:var(--dim)">'+n+'</div>').join(''); let offset=(first.getDay()+6)%7;
    for(let i=0;i<offset;i++)html+='<div class="di-day" style="opacity:.25"></div>';
    for(let d=1;d<=last.getDate();d++){const date=new Date(y,m,d), key=date.toISOString().slice(0,10), ev=rows.filter(r=>r.ex===key);html+='<div class="di-day"><small>'+d+'</small>'+ev.map(r=>'<div class="di-event" onclick="openFiche && openFiche(\''+esc(r.t)+'\',\'dividend-screener\')">'+esc(r.t)+' · '+pct(r.y)+'</div>').join('')+'</div>';}
    grid.innerHTML=html;
    const up=rows.filter(r=>new Date(r.ex+'T00:00:00')>=new Date()).slice(0,20); document.getElementById('diUpcoming').innerHTML=up.map(r=>'<tr><td><strong style="color:var(--gold)">'+esc(r.t)+'</strong></td><td>'+esc(r.ex.split('-').reverse().join('/'))+'</td><td>'+esc(r.pay?r.pay.split('-').reverse().join('/'):'—')+'</td><td>'+pct(r.y)+'</td><td>'+esc(r.status)+'</td></tr>').join('')||'<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--dim)">Aucun détachement futur disponible.</td></tr>';
  }

  function renderCompare(rows){
    const picks=[...new Set((window.__tcDividendCompare||[]).filter(t=>rows.some(r=>r.t===t)))].slice(0,4);
    const holder=document.getElementById('diComparePicks'); if(!holder)return;
    if(!picks.length){const defaults=rows.filter(r=>r.y!=null).sort((a,b)=>b.y-a.y).slice(0,4).map(r=>r.t); window.__tcDividendCompare=defaults;}
    const final=[...new Set((window.__tcDividendCompare||[]))].slice(0,4);
    holder.innerHTML=rows.map(r=>'<button class="di-pill '+(final.includes(r.t)?'di-good':'')+'" style="cursor:pointer" onclick="window.__tcDividendCompare=window.__tcDividendCompare||[];var a=window.__tcDividendCompare,i=a.indexOf(\''+esc(r.t)+'\');if(i>=0)a.splice(i,1);else if(a.length<4)a.push(\''+esc(r.t)+'\');renderDividendScreener();">'+esc(r.t)+'</button>').join('');
    const selected=final.map(t=>rows.find(r=>r.t===t)).filter(Boolean); ['cmpH1','cmpH2','cmpH3','cmpH4'].forEach((id,i)=>document.getElementById(id).textContent=selected[i]?.t||'—');
    const metrics=[['Yield','y','%'],['Growth 3Y','g3','%'],['Growth 5Y','g5','%'],['Payout','payout','%'],['Coverage','coverage','x'],['Forward Yield','forwardYield','%'],['Streak','streak','ans']];
    document.getElementById('diCompareTable').innerHTML=metrics.map(m=>'<tr><td>'+m[0]+'</td>'+[0,1,2,3].map(i=>'<td>'+(selected[i]&&selected[i][m[1]]!=null?fmt(selected[i][m[1]],2)+(m[2]==='x'?'x':m[2]==='ans'?' ans':' %'):'—')+'</td>').join('')+'</tr>').join('');
    chart('diCompareChart','radar',{labels:['Yield','Growth 3Y','Growth 5Y','Coverage','Forward Yield'],datasets:selected.map((r,i)=>({label:r.t,data:[r.y||0,r.g3||0,r.g5||0,r.coverage||0,r.forwardYield||0],borderColor:i===0?'rgba(212,175,55,.9)':'rgba(96,165,250,.8)',backgroundColor:'transparent'}))},{scales:{r:{angleLines:{color:'rgba(255,255,255,.08)'},grid:{color:'rgba(255,255,255,.08)'},pointLabels:{color:'#9e978e',font:{size:10}},ticks:{display:false}}}});
  }

  function renderCalculator(){
    const t=document.getElementById('diTicker')?.value||selectedTicker, r=datasetRows().find(x=>x.t===t), cap=num(document.getElementById('diCapital')?.value)||0;
    const price=num(document.getElementById('diCalcPrice')?.value)??r?.price, dps=num(document.getElementById('diCalcDps')?.value)??r?.dps, g=num(document.getElementById('diCalcGrowth')?.value)||0;
    const p=document.getElementById('diCalcPrice'); if(p&&price!=null&&document.activeElement!==p)p.value=price; const d=document.getElementById('diCalcDps');if(d&&dps!=null&&document.activeElement!==d)d.value=dps;
    const shares=price>0?Math.floor(cap/price):0, income=shares*dps, yoc=cap>0?income/cap*100:0;
    document.getElementById('diCalcShares').textContent=fmt(shares,0);document.getElementById('diCalcIncome').textContent=fmt(income,0)+' FCFA';document.getElementById('diCalcYoc').textContent=pct(yoc);document.getElementById('diCalcMonthly').textContent=fmt(income/12,0)+' FCFA';
    const labels=Array.from({length:6},(_,i)=>'An '+i), vals=labels.map((_,i)=>income*Math.pow(1+g/100,i)); chart('diIncomeChart','line',{labels,datasets:[{label:'Revenu annuel projeté',data:vals,borderColor:'rgba(212,175,55,.95)',backgroundColor:'rgba(212,175,55,.1)',fill:true,tension:.3}]},{plugins:{legend:{display:false}}});
  }

  window.renderDividendScreener=build;
})();
