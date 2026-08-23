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
      .tc-calendar-nature{font-size:8px;letter-spacing:.08em;text-transform:uppercase;padding:2px 5px;border-radius:3px;margin-left:5px;vertical-align:middle;}
      .tc-calendar-nature.tc-dividende{background:rgba(184,150,78,.14);color:var(--gold);}
      .tc-calendar-nature.tc-coupon{background:rgba(96,165,250,.14);color:#60A5FA;}
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
        const [divRes,coupRes]=await Promise.allSettled([
          window.apiGet('/marche?type=dividendes&_='+Date.now()),
          window.apiGet('/marche?type=coupons&_='+Date.now())
        ]);
        if(divRes.status==='fulfilled'){
          const d=normalizePayload(divRes.value);
          window.allDividendes=Array.isArray(d)?d:[];
        }
        // La table des coupons peut ne pas exister encore : son absence ne
        // doit jamais priver le calendrier de ses dividendes.
        if(coupRes.status==='fulfilled'){
          const c=normalizePayload(coupRes.value);
          window.allCoupons=Array.isArray(c)?c:[];
        }else{
          window.allCoupons=Array.isArray(window.allCoupons)?window.allCoupons:[];
        }
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

  /**
   * Normalise dividendes et coupons en une seule liste d'échéances.
   *
   * Les deux tables sont volontairement distinctes : un coupon est
   * contractuel, périodique et exprimé sur un nominal, là où un dividende
   * est discrétionnaire et rapporté à l'action. Seul l'affichage les réunit,
   * et il ne connaît que quatre champs : date, instrument, nature, montant.
   */
  function echeances(){
    const liste=[];
    (Array.isArray(window.allDividendes)?window.allDividendes:[]).forEach(row=>{
      liste.push({
        instrument:String(row?.ticker||'—'),
        nature:'dividende',
        montant:row?.montant!=null?row.montant:row?.montant_net,
        detach:formatCalendarDate(row?.date_detachement||row?.ex_date),
        pay:formatCalendarDate(row?.date_paiement),
        statut:String(row?.statut||'confirmé'),
        detail:row?.annee?('exercice '+row.annee):''
      });
    });
    (Array.isArray(window.allCoupons)?window.allCoupons:[]).forEach(row=>{
      const rang=row?.numero_coupon!=null?('coupon n°'+row.numero_coupon):'coupon';
      const taux=row?.taux_facial!=null?(' · '+row.taux_facial+' %'):'';
      liste.push({
        instrument:String(row?.code||row?.isin||'—'),
        nature:'coupon',
        montant:row?.montant_brut!=null?row.montant_brut:row?.montant_net,
        detach:formatCalendarDate(row?.date_detachement),
        pay:formatCalendarDate(row?.date_paiement),
        statut:String(row?.statut||'prévisionnel'),
        detail:rang+taux
      });
    });
    return liste;
  }

  function renderRealCalendar(){
    // La carte « Actualités marché » affichait les trois dernières lignes de
    // la table analyses en utilisant une colonne `titre` qui n'existe pas :
    // trois tuiles identiques sans information. Le calendrier prend sa place.
    const container=document.getElementById('newsFeed')||document.getElementById('pubFeed');
    if(!container)return;
    const now=Date.now();

    const avec=e=>{
      const next=[e.detach,e.pay].filter(Boolean).filter(d=>d.time>=now).sort((a,b)=>a.time-b.time)[0];
      return next?Object.assign({},e,{next}):null;
    };
    const liste=echeances();
    const avenir=liste.map(avec).filter(Boolean).sort((a,b)=>a.next.time-b.next.time).slice(0,5);

    // Aucune échéance future : on montre les dernières passées plutôt qu'une
    // carte vide, en le disant clairement.
    const passees=liste
      .map(e=>{const next=[e.pay,e.detach].filter(Boolean).sort((a,b)=>b.time-a.time)[0];return next?Object.assign({},e,{next}):null;})
      .filter(Boolean).sort((a,b)=>b.next.time-a.next.time).slice(0,5);

    const items=avenir.length?avenir:passees;
    const futur=avenir.length>0;

    const nbCoupons=items.filter(x=>x.nature==='coupon').length;
    const statut=items.length
      ? items.length+' échéance'+(items.length>1?'s':'')+(nbCoupons?' · '+nbCoupons+' coupon'+(nbCoupons>1?'s':''):'')
      : 'Aucune donnée';

    const head='<div class="tc-calendar-head"><div><div class="eyebrow">CALENDRIER MARCHÉ</div>'
      +'<div class="card-title">'+(futur?'Prochaines échéances':'Dernières échéances')+'</div></div>'
      +'<span class="tc-calendar-status">'+statut+'</span></div>';

    if(!items.length){
      container.innerHTML=head+'<div class="tc-calendar-empty">Aucune date de détachement ou de paiement renseignée.</div>';
      return;
    }

    container.innerHTML=head+items.map(e=>{
      const parts=[];
      if(e.detach)parts.push('Détachement '+e.detach.day+' '+e.detach.month);
      if(e.pay)parts.push('Paiement '+e.pay.day+' '+e.pay.month);
      if(e.detail)parts.push(e.detail);
      const montant=e.montant!=null?(' · '+fmt(e.montant)+' FCFA'):'';
      return '<div class="tc-calendar-item"><div class="tc-calendar-date"><strong>'+e.next.day+'</strong>'+e.next.month+'</div>'
        +'<div class="tc-calendar-info"><div class="tc-calendar-ticker">'+escapeHtml(e.instrument)
        +' <span class="tc-calendar-nature tc-'+e.nature+'">'+(e.nature==='coupon'?'coupon':'dividende')+'</span></div>'
        +'<div class="tc-calendar-desc">'+escapeHtml(parts.join(' · '))+escapeHtml(montant)+'</div></div>'
        +'<span class="tc-calendar-badge">'+escapeHtml(e.statut)+'</span></div>';
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
