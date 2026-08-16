/* The Capital Invest — Analyse fondamentale PRO enhancement layer */
(function () {
  'use strict';

  const LS = 'tc_fundamental_pro_v2';
  const state = { mode: 'pro', sections: {}, series: {}, ticker: '', chart: null, compare: [] };
  const metricDefs = [
    {k:'ca',label:"Chiffre d'affaires",cat:'Résultats',unit:'FCFA',keys:['chiffre_affaires','ca','revenue']},
    {k:'rn',label:'Résultat net',cat:'Résultats',unit:'FCFA',keys:['resultat_net','net_income']},
    {k:'ebitda',label:'EBITDA',cat:'Résultats',unit:'FCFA',keys:['ebitda','EBITDA']},
    {k:'ebit',label:'EBIT',cat:'Résultats',unit:'FCFA',keys:['ebit','EBIT']},
    {k:'bpa',label:'BPA',cat:'Par action',unit:'FCFA',keys:['bpa','BPA']},
    {k:'dpa',label:'Dividende / action',cat:'Par action',unit:'FCFA',keys:['dividende_par_action','dpa','dividende']},
    {k:'per',label:'PER',cat:'Valorisation',unit:'x',keys:['per']},
    {k:'pb',label:'P/B',cat:'Valorisation',unit:'x',keys:['pb','price_to_book']},
    {k:'ps',label:'P/S',cat:'Valorisation',unit:'x',keys:['ps','price_to_sales']},
    {k:'evEbitda',label:'EV/EBITDA',cat:'Valorisation',unit:'x',keys:['ev_ebitda','evEbitda']},
    {k:'roe',label:'ROE',cat:'Rentabilité',unit:'%',keys:['roe','ROE']},
    {k:'roa',label:'ROA',cat:'Rentabilité',unit:'%',keys:['roa','ROA']},
    {k:'netMargin',label:'Marge nette',cat:'Rentabilité',unit:'%',keys:['marge_nette','net_margin']},
    {k:'equity',label:'Fonds propres',cat:'Bilan',unit:'FCFA',keys:['fonds_propres','capitaux_propres','equity']},
    {k:'assets',label:'Total actif',cat:'Bilan',unit:'FCFA',keys:['total_actif','actifs','total_assets']},
    {k:'cash',label:'Trésorerie',cat:'Bilan',unit:'FCFA',keys:['tresorerie','cash','cash_and_equivalents']},
    {k:'netDebt',label:'Dette nette',cat:'Bilan',unit:'FCFA',keys:['dette_nette','net_debt']},
    {k:'operatingCF',label:'Cash-flow opérationnel',cat:'Cash-flow',unit:'FCFA',keys:['cash_flow_operationnel','flux_tresorerie_operationnel','operating_cash_flow']},
    {k:'capex',label:'CAPEX',cat:'Cash-flow',unit:'FCFA',keys:['capex','CAPEX']},
    {k:'fcf',label:'Free Cash Flow',cat:'Cash-flow',unit:'FCFA',keys:['free_cash_flow','fcf']},
    {k:'yield',label:'Dividend Yield',cat:'Dividendes',unit:'%',keys:['dividend_yield','rendement_dividende']},
    {k:'payout',label:'Payout Ratio',cat:'Dividendes',unit:'%',keys:['payout_ratio','payout']}
  ];

  function loadState(){ try { Object.assign(state, JSON.parse(localStorage.getItem(LS)||'{}')); } catch(e){} }
  function saveState(){ try { localStorage.setItem(LS, JSON.stringify({mode:state.mode,sections:state.sections,series:state.series,ticker:state.ticker})); } catch(e){} }
  function n(v){ const x=Number(v); return Number.isFinite(x) ? x : null; }
  function val(row, keys){ for(const k of keys){ const x=n(row && row[k]); if(x!==null) return x; } return null; }
  function annual(ticker){ return (Array.isArray(window.allFinancials)?window.allFinancials:[]).filter(f=>String(f.ticker||'').toUpperCase()===String(ticker).toUpperCase() && (f.periode==='annuel'||!f.periode)).sort((a,b)=>Number(a.annee)-Number(b.annee)); }
  function latestPrice(ticker){ const rows=(Array.isArray(window.allCours)?window.allCours:[]).filter(c=>String(c.ticker||'').toUpperCase()===String(ticker).toUpperCase()); return rows.map(c=>n(c.cours)).filter(x=>x!==null).pop()||null; }
  function latestRow(ticker){ const a=annual(ticker); return a[a.length-1]||null; }
  function fmt(x, unit){ if(x===null) return 'N/A'; if(unit==='%') return x.toFixed(1)+' %'; if(unit==='x') return x.toFixed(2)+'x'; const ax=Math.abs(x); if(ax>=1e9) return (x/1e9).toFixed(2)+' Md'; if(ax>=1e6) return (x/1e6).toFixed(2)+' M'; return Math.round(x).toLocaleString('fr-FR')+' FCFA'; }
  function escape(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function metricValue(row, def, price){
    let x=val(row,def.keys);
    if(x!==null) return x;
    if(def.k==='fcf'){ const oc=val(row,['cash_flow_operationnel','flux_tresorerie_operationnel','operating_cash_flow']); const cap=val(row,['capex','CAPEX']); return oc!==null&&cap!==null?oc-cap:null; }
    if(def.k==='netMargin'){ const rn=val(row,['resultat_net','net_income']), ca=val(row,['chiffre_affaires','ca','revenue']); return rn!==null&&ca?rn/ca*100:null; }
    if(def.k==='per'){ const b=val(row,['bpa','BPA']); return price!==null&&b>0?price/b:null; }
    return null;
  }

  function availableMetrics(rows,price){ return metricDefs.filter(d=>rows.some(r=>metricValue(r,d,price)!==null)); }
  function defaultSeries(avail){ const preferred=['ca','rn','bpa']; const a=preferred.filter(k=>avail.some(d=>d.k===k)); return a.length?a:avail.slice(0,Math.min(3,avail.length)).map(d=>d.k); }

  function injectSearch(select){
    if(document.getElementById('fundProSearch')) return;
    const wrap=select.parentElement; if(!wrap) return;
    const input=document.createElement('input'); input.id='fundProSearch'; input.className='fund-pro-search'; input.placeholder='Rechercher société, ticker ou secteur…'; input.setAttribute('aria-label','Rechercher une société');
    input.value=state.ticker||'';
    input.addEventListener('input',()=>{ const q=input.value.toLowerCase().trim(); Array.from(select.options).forEach((o,i)=>{if(i===0)return; const hit=!q||o.textContent.toLowerCase().includes(q)||o.value.toLowerCase().includes(q); o.hidden=!hit;}); });
    wrap.insertBefore(input,select);
  }

  function section(name,content,open){ const key='s_'+name.toLowerCase().replace(/[^a-z0-9]+/g,'_'); const isOpen=state.sections[key]!==undefined?state.sections[key]:open; return `<section class="fund-pro-section ${isOpen?'is-open':''}" data-section="${key}"><button class="fund-pro-section-head" aria-expanded="${isOpen}"><span><b>${name}</b></span><span class="fund-pro-chevron">⌄</span></button><div class="fund-pro-section-body">${content}</div></section>`; }

  function qualityBpa(row){ const b=val(row,['bpa','BPA']); if(b===null) return {status:'N/A — BPA indisponible',cls:'neutral'}; if(b===0) return {status:'N/A — BPA nul',cls:'warning'}; if(b<0) return {status:'N/A — société déficitaire',cls:'warning'}; const updated=row.updated_at||row.date_publication||row.date||null; let age=''; if(updated){ const days=Math.max(0,Math.floor((Date.now()-new Date(updated).getTime())/86400000)); age=days>=365?`⚠️ BPA âgé de ${Math.floor(days/30)} mois`:`Disponible depuis ${Math.max(1,Math.floor(days/30))} mois`; } return {status:'PER pertinent',cls:'positive',age}; }

  function renderValuation(rows,price){
    const latest=rows[rows.length-1]; const q=qualityBpa(latest); const b=val(latest,['bpa','BPA']); const current=price!==null&&b>0?price/b:null;
    const historical=rows.filter(r=>val(r,['bpa','BPA'])>0).slice(-6).map(r=>({y:r.annee,per:val(r,['bpa','BPA'])?val(r,['bpa','BPA'])>0?((val(r,['cours_cloture','cours_fin_annee','cours'])||null)/val(r,['bpa','BPA'])):null:null}));
    const forward=val(latest,['bpa_previsionnel','bpa_estime','forecast_bpa']);
    const fp=price!==null&&forward>0?price/forward:null;
    return `<div class="fund-pro-valuation-grid"><div class="fund-pro-value"><span>PER historique ${latest?.annee||''}</span><strong>${historical.length?fmt(historical[historical.length-1].per,'x'):'N/A'}</strong><small>Cours fin d'exercice / BPA exercice</small></div><div class="fund-pro-value featured"><span>PER courant</span><strong>${fmt(current,'x')}</strong><small>Cours ${price!==null?fmt(price,'FCFA'):'N/A'} · BPA ${b!==null?fmt(b,'FCFA'):'N/A'} · réf. ${latest?.annee||'N/A'}</small></div><div class="fund-pro-value"><span>PER forward</span><strong>${fp===null?'N/A':fmt(fp,'x')}</strong><small>${forward===null?'Aucune prévision BPA disponible':`BPA prévisionnel ${fmt(forward,'FCFA')}`}</small></div></div><div class="fund-pro-quality ${q.cls}"><b>${q.status}</b>${q.age?`<span>${q.age}</span>`:''}</div><div class="fund-pro-mini-table">${historical.map(h=>`<span>${h.y}: <b>${fmt(h.per,'x')}</b></span>`).join('')}</div>`;
  }

  function chartData(rows, defs, price){ return {labels:rows.map(r=>String(r.annee)), datasets:defs.map((d,i)=>({label:d.label,data:rows.map(r=>metricValue(r,d,price)),unit:d.unit,spanGaps:true}))}; }
  function renderChart(host,rows,defs,price){ host.innerHTML='<div class="fund-pro-chart-head"><div><b>Évolution financière</b><small>'+defs.length+' série(s) · maximum 4 sur le graphique</small></div><div class="fund-pro-chart-legend">'+defs.map(d=>`<span>${escape(d.label)}</span>`).join('')+'</div></div><div class="fund-pro-chart-wrap"><canvas id="fundProChart"></canvas></div>';
    const canvas=host.querySelector('canvas'); if(!canvas) return; const ctx=canvas.getContext('2d');
    if(window.Chart){ if(state.chart) try{state.chart.destroy();}catch(e){}; const data=chartData(rows,defs,price); state.chart=new Chart(ctx,{type:'line',data,options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${fmt(c.parsed.y,c.dataset.unit)}`}}},scales:{x:{grid:{display:false}},y:{beginAtZero:false,ticks:{callback:v=>Math.abs(v)>=1e9?(v/1e9).toFixed(1)+' Md':Math.abs(v)>=1e6?(v/1e6).toFixed(1)+' M':v}}}}}); }
  }

  function seriesPanel(rows,price,avail){
    const cats=[...new Set(avail.map(d=>d.cat))]; const selected=new Set(state.series[state.ticker]||defaultSeries(avail)); if(selected.size>4) selected.clear();
    if(!state.series[state.ticker]){state.series[state.ticker]=[...selected];saveState();}
    const presets={Croissance:['ca','rn','bpa'],Valorisation:['per','pb'],Rentabilité:['roe','roa','netMargin'],Bilan:['equity','netDebt']};
    return `<div class="fund-pro-series-card"><div class="fund-pro-series-top"><div><b>Séries financières à afficher</b><small>${selected.size} sélectionnée(s) · données réellement disponibles pour ${escape(state.ticker)}</small></div><div class="fund-pro-actions"><button data-series-action="all">Tout</button><button data-series-action="none">Aucun</button><button data-series-action="reset">Réinitialiser</button></div></div><div class="fund-pro-presets">${Object.entries(presets).map(([name,keys])=>`<button data-preset="${name}" data-keys="${keys.join(',')}">${name}</button>`).join('')}</div><details class="fund-pro-custom"><summary>Personnaliser les séries</summary><div class="fund-pro-series-grid">${cats.map(cat=>`<div class="fund-pro-cat"><b>${cat}</b>${avail.filter(d=>d.cat===cat).map(d=>`<label><input type="checkbox" data-series="${d.k}" ${selected.has(d.k)?'checked':''}> <span>${escape(d.label)}</span><em>${d.unit}</em></label>`).join('')}</div>`).join('')}</div></details><div id="fundProChartHost" class="fund-pro-chart-host"></div></div>`;
  }

  function metricsCards(rows,price,avail){ const latest=rows[rows.length-1]; const cards=avail.slice(0,12).map(d=>{const x=metricValue(latest,d,price);return `<div class="fund-pro-metric"><span>${escape(d.label)}</span><strong>${fmt(x,d.unit)}</strong><small>${latest.annee} · ${d.unit}</small></div>`}).join(''); return `<div class="fund-pro-metrics-grid">${cards}</div>`; }

  function compareModal(ticker){
    const all=(Array.isArray(window.allFinancials)?window.allFinancials:[]); const tickers=[...new Set(all.map(x=>x.ticker).filter(Boolean))]; const opts=tickers.map(t=>`<option value="${escape(t)}" ${state.compare.includes(t)?'selected':''}>${escape(t)}</option>`).join('');
    const existing=document.getElementById('fundProCompare'); if(existing) existing.remove(); const el=document.createElement('div'); el.id='fundProCompare'; el.className='fund-pro-modal'; el.innerHTML=`<div class="fund-pro-modal-bg"></div><div class="fund-pro-modal-box"><button class="fund-pro-modal-close">×</button><h3>Comparer des sociétés</h3><p>Sélectionnez 2 à 3 sociétés. Les métriques disponibles sont comparées sans inventer de valeurs.</p><select multiple size="8" id="fundCompareSelect">${opts}</select><div class="fund-pro-modal-actions"><button class="fund-pro-compare-go">Comparer</button></div><div id="fundCompareResult"></div></div>`; document.body.appendChild(el);
    el.querySelector('.fund-pro-modal-bg').onclick=()=>el.remove(); el.querySelector('.fund-pro-modal-close').onclick=()=>el.remove(); el.querySelector('.fund-pro-compare-go').onclick=()=>{const s=[...el.querySelector('#fundCompareSelect').selectedOptions].map(o=>o.value).slice(0,3);state.compare=s; const latest=s.map(t=>latestRow(t)).filter(Boolean); const rows=[...new Set(s)]; const table=`<table class="fund-pro-compare-table"><thead><tr><th>Métrique</th>${rows.map(t=>`<th>${escape(t)}</th>`).join('')}</tr></thead><tbody>${[['BPA','bpa','FCFA'],['PER','per','x'],['ROE','roe','%'],['Marge nette','netMargin','%'],['Dividend Yield','yield','%'],['Dette nette','netDebt','FCFA']].map(([l,k,u])=>`<tr><td>${l}</td>${latest.map(r=>{const p=latestPrice(r.ticker);const d=metricDefs.find(x=>x.k===k);return `<td>${fmt(metricValue(r,d||{keys:[],k},p),u)}</td>`}).join('')}</tr>`).join('')}</tbody></table>`;el.querySelector('#fundCompareResult').innerHTML=rows.length>=2?table:'<p class="fund-pro-error">Choisissez au moins 2 sociétés.</p>';};
  }

  function enhance(){
    const view=document.getElementById('view-analyse-fondamentale'), content=document.getElementById('fundContent'), select=document.getElementById('fundTickerSelect'); if(!view||!content||!select) return;
    injectSearch(select); const ticker=select.value; if(!ticker||!Array.isArray(window.allFinancials)) return; state.ticker=ticker; saveState();
    const rows=annual(ticker), price=latestPrice(ticker), avail=availableMetrics(rows,price); if(!rows.length) return;
    const hero=view.querySelector('.fund-hero'); if(hero){ const head=hero.querySelector('h2'); if(head) head.textContent=`${ticker} · Analyse fondamentale`; const p=hero.querySelector('p'); if(p) p.textContent='Lecture structurée de la croissance, rentabilité, valorisation, bilan, cash-flow et dividendes.'; }
    let tools=view.querySelector('.fund-pro-tools'); if(!tools){ tools=document.createElement('div'); tools.className='fund-pro-tools'; tools.innerHTML=`<div class="fund-pro-mode"><button data-fmode="simple">SIMPLE</button><button data-fmode="pro" class="active">PRO</button></div><button id="fundCompareBtn">Comparer</button><button id="fundExportBtn">Exporter</button></div>`; view.querySelector('.page-header')?.appendChild(tools); tools.querySelectorAll('[data-fmode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.fmode;saveState();view.classList.toggle('fund-pro-simple',state.mode==='simple');tools.querySelectorAll('button[data-fmode]').forEach(x=>x.classList.toggle('active',x===b));}); tools.querySelector('#fundCompareBtn').onclick=()=>compareModal(ticker); tools.querySelector('#fundExportBtn').onclick=()=>window.print(); }
    const target=document.getElementById('fundProArea'); if(target) target.remove(); const area=document.createElement('div'); area.id='fundProArea';
    const last=rows[rows.length-1], ca=metricValue(last,metricDefs[0],price), rn=metricValue(last,metricDefs[1],price), bpa=metricValue(last,metricDefs[4],price); const margin=ca&&rn!==null?rn/ca*100:null;
    area.innerHTML=`<div class="fund-pro-sticky"><div><b>${escape(ticker)}</b><span>Dernières données : ${escape(String(last.annee))}</span></div><div><b>${price!==null?fmt(price,'FCFA'):'N/A'}</b><span>Cours disponible</span></div></div>${section('Performance',`<div class="fund-pro-summary"><div><span>CA</span><b>${fmt(ca,'FCFA')}</b></div><div><span>Résultat net</span><b>${fmt(rn,'FCFA')}</b></div><div><span>BPA</span><b>${fmt(bpa,'FCFA')}</b></div><div><span>Marge nette</span><b>${fmt(margin,'%')}</b></div></div>`,true)}${section('Valorisation',renderValuation(rows,price),true)}<div class="fund-pro-chart-section">${seriesPanel(rows,price,avail)}</div>${section('Rentabilité',metricsCards(rows,price,avail.filter(d=>d.cat==='Rentabilité')),false)}${section('Structure financière',metricsCards(rows,price,avail.filter(d=>d.cat==='Bilan')),false)}${section('Cash-flow',metricsCards(rows,price,avail.filter(d=>d.cat==='Cash-flow')),false)}${section('Dividendes',metricsCards(rows,price,avail.filter(d=>d.cat==='Dividendes')),false)}${section('Croissance détaillée',`<div class="fund-pro-growth">${rows.slice(-6).map((r,i,a)=>{if(!i)return '';const ca0=val(a[i-1],['chiffre_affaires','ca','revenue']),ca1=val(r,['chiffre_affaires','ca','revenue']),rn0=val(a[i-1],['resultat_net','net_income']),rn1=val(r,['resultat_net','net_income']);return `<div><b>${r.annee}</b><span>CA ${ca0&&ca1?((ca1/ca0-1)*100).toFixed(1)+'%':'N/A'}</span><span>RN ${rn0&&rn1?((rn1/rn0-1)*100).toFixed(1)+'%':'N/A'}</span></div>`}).join('')}</div>`,false)}<div class="fund-pro-source"><b>Transparence des données</b><span>Les valeurs affichées proviennent des données disponibles pour ${escape(ticker)}. Une donnée absente ou non calculable est affichée N/A, jamais 0.</span></div>`;
    content.appendChild(area); view.classList.toggle('fund-pro-simple',state.mode==='simple');
    area.querySelectorAll('.fund-pro-section-head').forEach(btn=>btn.onclick=()=>{const sec=btn.closest('.fund-pro-section'),key=sec.dataset.section; const open=!sec.classList.contains('is-open');sec.classList.toggle('is-open',open);btn.setAttribute('aria-expanded',open);state.sections[key]=open;saveState();});
    area.querySelectorAll('[data-series-action]').forEach(btn=>btn.onclick=()=>{let keys=[];if(btn.dataset.seriesAction==='all')keys=avail.slice(0,4).map(d=>d.k);if(btn.dataset.seriesAction==='reset')keys=defaultSeries(avail);state.series[ticker]=keys;saveState();enhance();});
    area.querySelectorAll('[data-preset]').forEach(btn=>btn.onclick=()=>{const keys=btn.dataset.keys.split(',').filter(k=>avail.some(d=>d.k===k)).slice(0,4);state.series[ticker]=keys;saveState();enhance();});
    area.querySelectorAll('[data-series]').forEach(cb=>cb.onchange=()=>{let keys=[...area.querySelectorAll('[data-series]:checked')].map(x=>x.dataset.series);if(keys.length>4){cb.checked=false;return;}state.series[ticker]=keys;saveState();renderChart(area.querySelector('#fundProChartHost'),rows,avail.filter(d=>keys.includes(d.k)),price);});
    const selected=(state.series[ticker]||defaultSeries(avail)).slice(0,4);renderChart(area.querySelector('#fundProChartHost'),rows,avail.filter(d=>selected.includes(d.k)),price);
  }

  function hook(){
    loadState(); const original=window.loadFundAnalysis; if(typeof original!=='function'){setTimeout(hook,300);return;} if(original.__fundProWrapped)return;
    const wrapped=async function(){ const r=await original.apply(this,arguments); setTimeout(enhance,30); return r; }; wrapped.__fundProWrapped=true; window.loadFundAnalysis=wrapped;
    const select=document.getElementById('fundTickerSelect'); if(select){ if(state.ticker && [...select.options].some(o=>o.value===state.ticker)) select.value=state.ticker; select.addEventListener('change',()=>{state.ticker=select.value;saveState();}); }
    setTimeout(enhance,100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hook);else hook();
})();
