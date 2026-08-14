// THE CAPITAL — Dividend Intelligence Engine
(function () {
  if (window.__TC_DIVIDEND_SCREENER_LOADED__) return;
  window.__TC_DIVIDEND_SCREENER_LOADED__ = true;

  let rows = [];
  let settings = { method: 'tcam', horizon: 5, customGrowth: 6, window: 3, scenario: 'base' };
  const esc = v => { const d=document.createElement('div'); d.textContent=v==null?'':String(v); return d.innerHTML; };
  const num = v => { if(v===null||v===undefined||v==='') return null; const x=Number(String(v).replace(/\s/g,'').replace(/%/g,'').replace(',','.')); return Number.isFinite(x)?x:null; };
  const year = v => { const m=String(v??'').match(/\d{4}/); return m?Number(m[0]):num(v); };
  const pct = v => v==null?'—':`${Number(v).toFixed(2)} %`;
  const money = v => v==null?'—':Number(v).toLocaleString('fr-FR',{maximumFractionDigits:4});
  const normalize = r => {
    let y=num(r?.taux_rendement??r?.rendement??r?.yield); if(y!=null&&y>0&&y<=1)y*=100;
    return {...r,ticker:String(r?.ticker??r?.symbol??'').trim().toUpperCase(),annee:year(r?.annee??r?.exercice??r?.annee_exercice),montant:num(r?.montant_net??r?.montant??r?.dpa),taux_rendement:y,date_detachement:r?.date_detachement??r?.ex_date??null,date_paiement:r?.date_paiement_cal??r?.date_paiement??r?.payment_date??null,statut:r?.statut??'',notes:r?.notes??''};
  };
  async function loadRows(){
    try{const data=await window.apiGet('/marche?type=dividendes');const raw=Array.isArray(data)?data:Array.isArray(data?.data)?data.data:Array.isArray(data?.rows)?data.rows:[];rows=raw.map(normalize).filter(r=>r.ticker&&r.annee!=null);return rows;}catch(e){console.warn('[DIVIDEND INTELLIGENCE]',e);rows=[];return rows;}
  }
  function history(ticker){return rows.filter(r=>r.ticker===ticker&&r.montant!=null).sort((a,b)=>a.annee-b.annee);}
  function growths(h){const g=[];for(let i=1;i<h.length;i++)if(h[i-1].montant!==0)g.push((h[i].montant/h[i-1].montant-1)*100);return g;}
  function tcam(h){if(h.length<2||h[0].montant<=0||h[h.length-1].montant<0)return null;return (Math.pow(h[h.length-1].montant/h[0].montant,1/(h.length-1))-1)*100;}
  function regression(h){if(h.length<2)return null;const x=h.map(r=>r.annee),y=h.map(r=>r.montant),n=x.length,sx=x.reduce((a,b)=>a+b,0),sy=y.reduce((a,b)=>a+b,0),sxy=x.reduce((a,v,i)=>a+v*y[i],0),sx2=x.reduce((a,v)=>a+v*v,0),den=n*sx2-sx*sx;if(!den)return null;const slope=(n*sxy-sx*sy)/den,intercept=(sy-slope*sx)/n;const mean=sy/n;let ssr=0,sst=0;for(let i=0;i<n;i++){const f=slope*x[i]+intercept;ssr+=(y[i]-f)**2;sst+=(y[i]-mean)**2;}return{slope,intercept,r2:sst?1-ssr/sst:1};}
  function avg(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;}
  function median(a){if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;}
  function projection(h){
    if(!h.length)return {rate:null,values:[]};
    const last=h[h.length-1].montant, gs=growths(h); let rate=null, values=[];
    if(settings.method==='tcam')rate=tcam(h);
    else if(settings.method==='regression'){const r=regression(h);for(let i=1;i<=settings.horizon;i++)values.push(r?Math.max(0,r.slope*(h[h.length-1].annee+i)+r.intercept):null);}
    else if(settings.method==='average')rate=avg(gs);
    else if(settings.method==='median')rate=median(gs);
    else if(settings.method==='moving'){const w=Math.max(1,settings.window);rate=avg(gs.slice(-w));}
    else rate=settings.customGrowth;
    if(!values.length&&rate!=null){const scenario=settings.scenario==='bull'?1.25:settings.scenario==='bear'?0.5:1;rate*=scenario;for(let i=1;i<=settings.horizon;i++)values.push(last*Math.pow(1+rate/100,i));}
    return{rate,values};
  }
  function policy(h){
    const gs=growths(h), ups=gs.filter(x=>x>0).length, downs=gs.filter(x=>x<0).length, cuts=gs.filter(x=>x<-5).length, flat=gs.filter(x=>Math.abs(x)<=1).length;
    let label='Historique insuffisant', cls='neutral';
    if(h.length>=3){if(cuts>=2){label='Politique irrégulière / sous pression';cls='negative';}else if(ups>=Math.max(1,downs*2)){label='Politique de croissance';cls='positive';}else if(flat>=Math.max(1,ups+downs)){label='Politique de stabilité';cls='positive';}else{label='Politique mixte';cls='neutral';}}
    return{label,cls,ups,downs,cuts,flat};
  }
  function financialDividendContext(ticker,h){
    const fins=(Array.isArray(window.allFinancials)?window.allFinancials:[]).filter(f=>String(f.ticker).toUpperCase()===ticker).sort((a,b)=>Number(a.annee)-Number(b.annee));
    const latest=fins[fins.length-1];const d=h[h.length-1]; if(!latest||!d)return null;
    const shares=num(latest.nombre_actions);const rn=num(latest.resultat_net);const total=shares&&d.montant?shares*d.montant:null;const payout=total!=null&&rn&&rn>0?total/rn*100:null;
    return{payout,rn,shares};
  }
  function quality(h){const missing=h.filter(r=>r.montant==null||r.annee==null).length,gs=growths(h),vol=gs.length>1?Math.sqrt(avg(gs.map(g=>(g-(avg(gs)||0))**2))):null;return{score:Math.max(0,Math.min(100,100-(missing*15)-(vol!=null&&vol>30?20:0)),vol)};}

  function renderDividendFundamentalSection(ticker){
    const host=document.getElementById('fundContent'); if(!host||!ticker)return;
    const old=host.querySelector('.fund-dividend-intelligence'); if(old)old.remove();
    const h=history(String(ticker).toUpperCase()); if(!h.length)return;
    const p=projection(h),pol=policy(h),q=quality(h),ctx=financialDividendContext(String(ticker).toUpperCase(),h),last=h[h.length-1];
    const card=document.createElement('div');card.className='card fund-dividend-intelligence';
    card.innerHTML=`<div class="card-header"><div><div class="card-title">Politique de dividende & soutenabilité</div><div class="fund-section-note">Analyse issue de l'historique des dividendes et, lorsque disponibles, des données financières.</div></div><span class="${pol.cls}">${esc(pol.label)}</span></div><div class="card-body"><div class="fund-kpi-grid"><div class="fund-kpi"><span>Dernier dividende</span><strong>${money(last.montant)} FCFA</strong><small>Exercice ${last.annee}</small></div><div class="fund-kpi"><span>TCAM dividende</span><strong>${pct(tcam(h))}</strong><small>${h.length} exercice(s)</small></div><div class="fund-kpi"><span>Rendement</span><strong>${pct(last.taux_rendement)}</strong><small>Dernière donnée disponible</small></div><div class="fund-kpi"><span>Qualité historique</span><strong>${q.score.toFixed(0)}/100</strong><small>${q.vol==null?'Volatilité n/d':'Volatilité croissance '+q.vol.toFixed(1)+'%'}</small></div></div><div class="fund-checks"><div class="fund-check"><span class="${pol.cls}">●</span><div><strong>Lecture de la politique</strong><p>${pol.label}. ${pol.ups} hausse(s), ${pol.downs} baisse(s), ${pol.cuts} baisse(s) > 5 % sur l'historique.</p></div></div><div class="fund-check"><span class="${ctx?.payout!=null?(ctx.payout<=70?'positive':ctx.payout<=100?'neutral':'negative'):'neutral'}">●</span><div><strong>Payout ratio</strong><p>${ctx?.payout!=null?ctx.payout.toFixed(1)+' % du résultat net estimé':'Non calculable avec les données financières actuellement disponibles.'}</p></div></div><div class="fund-check"><span class="neutral">●</span><div><strong>Projection dividende</strong><p>${p.rate==null?'Projection indisponible.':`Méthode ${settings.method.toUpperCase()} : ${p.rate.toFixed(2)} % de croissance annuelle hypothétique.`}</p></div></div></div></div>`;
    host.appendChild(card);
  }
  window.renderDividendFundamentalSection=renderDividendFundamentalSection;
  function installFundamentalBridge(){const host=document.getElementById('fundContent');if(!host||host.__divBridge)return;host.__divBridge=true;const run=()=>renderDividendFundamentalSection(document.getElementById('fundTickerSelect')?.value);new MutationObserver(()=>setTimeout(run,0)).observe(host,{childList:true});run();}
  setTimeout(installFundamentalBridge,500);

  async function renderDividendScreener(){
    const view=document.getElementById('view-dividend-screener');if(!view)return;await loadRows();
    const years=[...new Set(rows.map(r=>r.annee).filter(Boolean))].sort((a,b)=>b-a),tickers=[...new Set(rows.map(r=>r.ticker))].sort();
    view.innerHTML=`<div class="page-header"><h1>Dividend <span style="color:var(--gold)">Intelligence</span></h1><p>Screener, politique de distribution, soutenabilité et projections paramétrables.</p></div>
    <div class="card mb20"><div class="card-body"><div class="screener-filters"><div><label>Ticker</label><select id="divTicker"><option value="">Tous</option>${tickers.map(t=>`<option>${esc(t)}</option>`).join('')}</select></div><div><label>Année exercice</label><select id="divYear"><option value="">Toutes</option>${years.map(y=>`<option>${y}</option>`).join('')}</select></div><div><label>Rendement min %</label><input type="number" id="divMinYield" value="0" step="0.1"></div><div><label>Rendement max %</label><input type="number" id="divMaxYield" placeholder="∞" step="0.1"></div><div><label>Contrôle qualité</label><select id="divQuality"><option value="all">Toutes</option><option value="ok">Données complètes</option><option value="warn">À contrôler</option><option value="missing">Données manquantes</option></select></div></div></div></div>
    <div class="card mb20"><div class="card-header"><div><div class="card-title">Projection du dividende</div><div class="fund-section-note">Les données historiques ne sont jamais modifiées par les hypothèses.</div></div></div><div class="card-body"><div class="screener-filters"><div><label>Méthode</label><select id="divMethod"><option value="tcam">TCAM</option><option value="regression">Régression linéaire</option><option value="average">Croissance moyenne</option><option value="median">Croissance médiane</option><option value="moving">Moyenne mobile</option><option value="custom">Hypothèse personnalisée</option></select></div><div><label>Horizon</label><select id="divHorizon"><option>3</option><option selected>5</option><option>7</option><option>10</option></select></div><div><label>Scénario</label><select id="divScenario"><option value="bear">Pessimiste</option><option value="base" selected>Central</option><option value="bull">Optimiste</option></select></div><div><label>Croissance personnalisée %</label><input type="number" id="divCustomGrowth" value="6" step="0.1"></div><div><label>Fenêtre moyenne mobile</label><input type="number" id="divWindow" value="3" min="1" max="10"></div></div><div id="divProjectionPanel" style="margin-top:18px"></div></div></div>
    <div class="card"><div class="card-header"><div class="card-title">Dividendes disponibles</div><div id="divCount" style="font-size:12px;color:var(--dim)"></div></div><div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Année</th><th class="right">Dividende</th><th class="right">Rendement</th><th class="right">Croissance YoY</th><th>Politique</th><th>Contrôle</th></tr></thead><tbody id="dividendScreenerTable"></tbody></table></div></div>`;
    ['divTicker','divYear','divMinYield','divMaxYield','divQuality','divMethod','divHorizon','divScenario','divCustomGrowth','divWindow'].forEach(id=>document.getElementById(id)?.addEventListener('input',apply));
    apply();
  }
  function apply(){
    const ticker=document.getElementById('divTicker')?.value||'',sy=document.getElementById('divYear')?.value||'',minY=num(document.getElementById('divMinYield')?.value)??0,maxY=num(document.getElementById('divMaxYield')?.value)??Infinity,qf=document.getElementById('divQuality')?.value||'all';
    settings.method=document.getElementById('divMethod')?.value||'tcam';settings.horizon=Number(document.getElementById('divHorizon')?.value||5);settings.scenario=document.getElementById('divScenario')?.value||'base';settings.customGrowth=num(document.getElementById('divCustomGrowth')?.value)??6;settings.window=Number(document.getElementById('divWindow')?.value||3);
    let out=rows.filter(r=>(!ticker||r.ticker===ticker)&&(!sy||String(r.annee)===sy)&&(r.taux_rendement??-Infinity)>=minY&&(r.taux_rendement??Infinity)<=maxY);
    out=out.map(r=>{const h=history(r.ticker),prev=h.find(x=>x.annee===r.annee-1),g=prev?.montant&&r.montant!=null?(r.montant/prev.montant-1)*100:null,pol=policy(h),missing=r.montant==null||r.taux_rendement==null||!r.date_detachement||!r.date_paiement;return{...r,g,pol,missing};});
    if(qf==='ok')out=out.filter(r=>!r.missing);if(qf==='warn')out=out.filter(r=>r.missing||r.pol.label.includes('irrégulière'));if(qf==='missing')out=out.filter(r=>r.missing);
    const tb=document.getElementById('dividendScreenerTable');if(!tb)return;document.getElementById('divCount').textContent=`${out.length} résultat(s)`;tb.innerHTML=out.sort((a,b)=>(b.annee-a.annee)||(b.taux_rendement??-Infinity)-(a.taux_rendement??-Infinity)).map(r=>`<tr><td><strong style="color:var(--gold)">${esc(r.ticker)}</strong></td><td>${r.annee}</td><td class="right">${money(r.montant)}</td><td class="right">${pct(r.taux_rendement)}</td><td class="right">${pct(r.g)}</td><td>${esc(r.pol.label)}</td><td>${r.missing?'<span class="negative">⚠ À contrôler</span>':'<span class="positive">✓ OK</span>'}</td></tr>`).join('')||'<tr><td colspan="7" style="text-align:center;padding:24px">Aucun résultat.</td></tr>';
    renderProjection(ticker||out[0]?.ticker);
  }
  function renderProjection(ticker){const p=document.getElementById('divProjectionPanel');if(!p||!ticker){if(p)p.innerHTML='<div style="color:var(--dim)">Sélectionnez un ticker pour afficher sa projection.</div>';return;}const h=history(ticker);if(h.length<2){p.innerHTML='<div style="color:var(--dim)">Historique insuffisant : au moins 2 exercices sont nécessaires.</div>';return;}const pr=projection(h),last=h[h.length-1],ys=[];for(let i=1;i<=settings.horizon;i++)ys.push(last.annee+i);const reg=regression(h);p.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px"><div><small>Dernier dividende</small><strong style="display:block;font-size:20px">${money(last.montant)} FCFA</strong></div><div><small>Méthode</small><strong style="display:block">${settings.method==='regression'?'Régression linéaire':settings.method.toUpperCase()}</strong></div><div><small>Croissance retenue</small><strong style="display:block">${pr.rate==null?'n/d':pct(pr.rate)}</strong></div><div><small>R² régression</small><strong style="display:block">${reg?reg.r2.toFixed(2):'n/d'}</strong></div></div><div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>Exercice</th><th>Dividende projeté</th><th>Rendement implicite actuel*</th></tr></thead><tbody>${ys.map((y,i)=>`<tr><td>${y}</td><td>${money(pr.values[i])} FCFA</td><td>${last.taux_rendement&&last.montant?pct(last.taux_rendement*(pr.values[i]/last.montant)): '—'}</td></tr>`).join('')}</tbody></table></div><small style="color:var(--dim)">* Rendement indicatif à cours constant ; modifiez les hypothèses pour tester vos scénarios.</small>`;}
  window.renderDividendScreener=renderDividendScreener;
})();