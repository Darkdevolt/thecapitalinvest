// THE CAPITAL — Dashboard market-data/UI fixes
(function(){
  'use strict';
  if(window.__TC_OVERVIEW_FIXES__)return;
  window.__TC_OVERVIEW_FIXES__=true;

  let refreshPromise=null;
  let lastRefreshAt=0;
  let dividendPromise=null;
  let lastDividendAt=0;

  function injectDashboardFixCSS(){
    if(document.getElementById('tc-dashboard-market-fixes'))return;
    const style=document.createElement('style');
    style.id='tc-dashboard-market-fixes';
    style.textContent=`
      /* Top Mouvements: 4 colonnes réelles (rang, titre, cours, variation).
         L'ancienne ligne d'en-tête n'en avait que 3, ce qui créait le
         débordement et masquait les variations sur les petites largeurs. */
      #topMovers .movers-label-row,
      #topMovers .mover-row{
        display:grid;
        grid-template-columns:28px minmax(0,1fr) minmax(76px,auto) minmax(78px,92px);
        align-items:center;
        column-gap:8px;
      }
      #topMovers .movers-label-row{padding:5px 12px 7px;}
      #topMovers .mover-row{min-width:0;padding:9px 12px;}
      #topMovers .mover-security{min-width:0;overflow:hidden;}
      #topMovers .mover-symbol,
      #topMovers .mover-name{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      #topMovers .mover-price{white-space:nowrap;text-align:right;font-family:var(--mono);font-size:11px;}
      #topMovers .mover-change{text-align:right;min-width:0;overflow:visible;}
      #topMovers .mover-change-value{display:inline-block;white-space:nowrap;font-family:var(--mono);font-size:11px;font-weight:600;}
      #topMovers .movers-label-row span:nth-child(2){text-align:left;}
      #topMovers .movers-label-row span:nth-child(3),
      #topMovers .movers-label-row span:nth-child(4){text-align:right;}

      .tc-calendar-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;}
      .tc-calendar-status{font-family:var(--mono);font-size:10px;color:var(--dim);white-space:nowrap;}
      .tc-calendar-item{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(184,150,78,.06);}
      .tc-calendar-item:last-child{border-bottom:0;}
      .tc-calendar-date{font-family:var(--mono);font-size:11px;color:var(--gold);text-align:center;line-height:1.2;}
      .tc-calendar-date strong{display:block;font-size:16px;}
      .tc-calendar-info{min-width:0;}
      .tc-calendar-ticker{font-family:var(--mono);font-size:11px;color:var(--cream);font-weight:600;}
      .tc-calendar-desc{font-size:11px;color:var(--dim);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .tc-calendar-badge{font-size:9px;padding:3px 6px;border:1px solid var(--border2);border-radius:999px;color:var(--muted);white-space:nowrap;text-transform:uppercase;}
      .tc-calendar-empty{padding:20px 8px;text-align:center;color:var(--dim);font-size:12px;}
      #coursCount{white-space:nowrap;}
      @media(max-width:700px){
        #topMovers .movers-label-row,#topMovers .mover-row{grid-template-columns:22px minmax(0,1fr) minmax(64px,auto) minmax(62px,78px);column-gap:5px;}
        #topMovers .mover-row{padding:8px 9px;}
        #topMovers .mover-price,#topMovers .mover-change-value{font-size:10px;}
        .tc-calendar-item{grid-template-columns:48px minmax(0,1fr) auto;gap:7px;}
      }
    `;
    document.head.appendChild(style);
  }

  function normalizePayload(response){
    return response&&typeof response==='object'&&'data' in response?response.data:response;
  }

  async function refreshLatestMarketData(force){
    const now=Date.now();
    if(!force && now-lastRefreshAt<30000)return;
    if(refreshPromise)return refreshPromise;
    refreshPromise=(async()=>{
      try{
        const response=await window.apiGet('/marche?type=cours&_='+Date.now());
        const data=normalizePayload(response);
        if(Array.isArray(data)){
          window.allCours=data;
          window.allCoursLatestDate=data.reduce((max,row)=>{
            const d=row?.date_seance||'';
            return !max||String(d)>String(max)?d:max;
          },null);
        }
        lastRefreshAt=Date.now();
      }catch(err){
        console.warn('[OVERVIEW FIX] Actualisation des cours impossible:',err.message||err);
      }finally{
        refreshPromise=null;
      }
    })();
    return refreshPromise;
  }

  function formatCalendarDate(value){
    if(!value)return null;
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return null;
    return {day:d.toLocaleDateString('fr-FR',{day:'2-digit'}),month:d.toLocaleDateString('fr-FR',{month:'short'}),time:d.getTime()};
  }

  async function loadDividendCalendar(){
    const now=Date.now();
    if(now-lastDividendAt<60000)return;
    if(dividendPromise)return dividendPromise;
    dividendPromise=(async()=>{
      try{
        const response=await window.apiGet('/marche?type=dividendes&_='+Date.now());
        const data=normalizePayload(response);
        window.allDividendes=Array.isArray(data)?data:[];
        lastDividendAt=Date.now();
      }catch(err){
        console.warn('[OVERVIEW FIX] Calendrier indisponible:',err.message||err);
        window.allDividendes=[];
      }finally{
        dividendPromise=null;
      }
    })();
    return dividendPromise;
  }

  function renderRealCalendar(){
    const container=document.getElementById('pubFeed');
    if(!container)return;
    const data=Array.isArray(window.allDividendes)?window.allDividendes:[];
    const now=Date.now();
    const dated=data.map(row=>{
      const detach=formatCalendarDate(row?.date_detachement);
      const pay=formatCalendarDate(row?.date_paiement);
      const next=[detach,pay].filter(Boolean).filter(d=>d.time>=now).sort((a,b)=>a.time-b.time)[0]||detach||pay;
      return {row,detach,pay,next};
    }).filter(x=>x.next)
      .sort((a,b)=>a.next.time-b.next.time)
      .slice(0,5);

    const fallback=data.map(row=>({row,detach:formatCalendarDate(row?.date_detachement),pay:formatCalendarDate(row?.date_paiement),next:formatCalendarDate(row?.date_detachement)||formatCalendarDate(row?.date_paiement)}))
      .filter(x=>x.next).slice(0,5);
    const items=dated.length?dated:fallback;

    const head=`<div class="tc-calendar-head"><div><div class="eyebrow">CALENDRIER MARCHÉ</div><div class="card-title">Prochaines dates</div></div><span class="tc-calendar-status">${items.length?items.length+' échéance'+(items.length>1?'s':''):'Aucune donnée'}</span></div>`;
    if(!items.length){container.innerHTML=head+'<div class="tc-calendar-empty">Aucune date de détachement ou de paiement renseignée.</div>';return;}
    container.innerHTML=head+items.map(({row,next,detach,pay})=>{
      const ticker=String(row?.ticker||'—');
      const statut=String(row?.statut||'confirmé');
      const desc=detach&&pay?`Détachement ${detach.day} ${detach.month} · Paiement ${pay.day} ${pay.month}`:detach?`Détachement ${detach.day} ${detach.month}`:`Paiement ${pay.day} ${pay.month}`;
      return `<div class="tc-calendar-item"><div class="tc-calendar-date"><strong>${next.day}</strong>${next.month}</div><div class="tc-calendar-info"><div class="tc-calendar-ticker">${escapeHtml(ticker)}</div><div class="tc-calendar-desc">${escapeHtml(desc)} · ${escapeHtml(fmt(row?.montant))} FCFA</div></div><span class="tc-calendar-badge">${escapeHtml(statut)}</span></div>`;
    }).join('');
  }

  function updateCoursMeta(){
    const el=document.getElementById('coursCount');
    if(!el)return;
    const count=Array.isArray(window.allCours)?window.allCours.length:0;
    const date=window.allCoursLatestDate;
    const label=date&&typeof fmtDate==='function'?` · Séance ${fmtDate(date)}`:'';
    el.textContent=count+' titre'+(count>1?'s':'')+label;
  }

  const originalOverview=window.renderOverview;
  if(typeof originalOverview==='function'){
    window.renderOverview=function(){
      injectDashboardFixCSS();
      originalOverview();
      updateCoursMeta();
      loadDividendCalendar().then(renderRealCalendar);
      const active=document.querySelector('.view.active');
      if(active?.id==='view-overview'){
        refreshLatestMarketData(false).then(()=>{
          const current=document.querySelector('.view.active');
          if(current?.id==='view-overview'){
            originalOverview();
            updateCoursMeta();
            renderRealCalendar();
          }
        });
      }
    };
  }

  injectDashboardFixCSS();
  // Le patch est chargé après le bootstrap principal. On rafraîchit donc
  // une première fois la vue actuellement affichée si nécessaire.
  setTimeout(()=>{
    const active=document.querySelector('.view.active');
    if(active?.id==='view-overview' && typeof window.renderOverview==='function')window.renderOverview();
  },0);
})();
