// ═══════════════════════════════════════
// VIEW, Overview / Tableau de bord
// ═══════════════════════════════════════
(function() {
  if (window.__TC_OVERVIEW_LOADED__) {
    console.log('[OVERVIEW] Déjà chargé, skip.');
    return;
  }
  window.__TC_OVERVIEW_LOADED__ = true;

  let _compositePeriod = 30;
  let _moversTab = 'gainers';

  // The Capital uses typography, labels and status indicators instead of decorative emoji.
  function removeDecorativeEmoji(root = document.body) {
    if (!root) return;
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach(n => {
      if (n.parentElement?.closest('script,style,noscript')) return;
      const cleaned = n.nodeValue.replace(emoji, '').replace(/\s{2,}/g, ' ');
      if (cleaned !== n.nodeValue) n.nodeValue = cleaned;
    });
  }

  function installEmojiGuard() {
    removeDecorativeEmoji();
    if (window.__TC_EMOJI_GUARD__) return;
    window.__TC_EMOJI_GUARD__ = true;
    const observer = new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(n => {
          if (n.nodeType === Node.TEXT_NODE) removeDecorativeEmoji(n.parentElement);
          else if (n.nodeType === Node.ELEMENT_NODE) removeDecorativeEmoji(n);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function getLatestIndices() {
    const map = {};
    (window.allIndices || []).forEach(row => {
      if (!row?.indice || !row?.date_seance) return;
      const name = String(row.indice).trim();
      if (!map[name] || new Date(row.date_seance) > new Date(map[name].date_seance)) map[name] = row;
    });
    return map;
  }

  function getIndiceHistory(indiceName, maxDays = 30) {
    return (window.allIndices || [])
      .filter(r => r?.indice && String(r.indice).trim() === indiceName && r?.valeur != null)
      .sort((a, b) => new Date(a.date_seance) - new Date(b.date_seance))
      .slice(-maxDays);
  }

  window.renderOverview = function() {
    console.log('[OVERVIEW] Rendu...');
    installEmojiGuard();
    const latest = getLatestIndices();
    const indiceNames = Object.keys(latest);
    updateMarketStatus();
    renderIndexCards(latest, indiceNames);
    renderCompositeChart();
    renderSectorHeatmap();
    renderNewsFeed();
    renderMoversControls();
    renderTopMovers();
    renderPubFeed();
    renderAlertFeed();
    renderWatchFeed();
    renderCoursTable();
  };

  function updateMarketStatus() {
    const now = new Date();
    const gmtNow = new Date(now.toLocaleString('en-US', { timeZone: 'GMT' }));
    const hour = gmtNow.getHours(), min = gmtNow.getMinutes(), day = gmtNow.getDay();
    const isOpen = day >= 1 && day <= 5 && ((hour === 9 && min >= 30) || (hour > 9 && hour < 15) || (hour === 15 && min <= 30));
    const statusEl = document.getElementById('marketStatus');
    const timeEl = document.getElementById('marketTime');
    const nextEl = document.getElementById('marketNext');
    if (statusEl) {
      statusEl.className = 'market-status ' + (isOpen ? 'open' : 'closed');
      statusEl.innerHTML = `<span class="status-dot"></span>${isOpen ? 'Marché Ouvert' : 'Marché Fermé'}`;
    }
    if (timeEl) timeEl.textContent = gmtNow.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit',second:'2-digit'}) + ' GMT';
    if (nextEl) {
      if (isOpen) {
        const closeTime = new Date(gmtNow); closeTime.setHours(15,30,0,0);
        nextEl.textContent = `Fermeture dans ${Math.max(0, Math.floor((closeTime-gmtNow)/60000))} min`;
      } else {
        const nextOpen = new Date(gmtNow); nextOpen.setHours(9,30,0,0);
        if (day === 5 || day === 6) nextOpen.setDate(nextOpen.getDate() + (day === 5 ? 3 : 2));
        else if (day === 0 || hour >= 15) nextOpen.setDate(nextOpen.getDate() + 1);
        const days = ['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
        nextEl.textContent = `Prochaine ouverture : ${days[nextOpen.getDay()]} ${nextOpen.getHours()}:${String(nextOpen.getMinutes()).padStart(2,'0')}`;
      }
    }
  }

  function renderIndexCards(latest, indiceNames) {
    const findIndice = candidates => candidates.map(c => indiceNames.find(n => n.toLowerCase() === c.toLowerCase())).find(Boolean) || null;
    const mapCard = {
      composite:{candidates:['BRVM C','BRVM Composite','COMPOSITE','BRVM_C','BRVM COMPOSITE'],id:'idx-composite',chgId:'idx-composite-chg',sparkId:'sparkComposite'},
      brvm30:{candidates:['BRVM 30','BRVM30','30','BRVM_30'],id:'idx-30',chgId:'idx-30-chg',sparkId:'spark30'},
      prestige:{candidates:['BRVM Prestige','BRVMPrestige','PRESTIGE','BRVM PRESTIGE'],id:'idx-prestige',chgId:'idx-prestige-chg',sparkId:'sparkPrestige'}
    };
    const setIdx = (id,val,chgId,chg) => {
      const el=document.getElementById(id), ce=document.getElementById(chgId);
      if(el) el.textContent=(val!=null&&!isNaN(+val))?fmt(+val,2):', ';
      if(ce){const n=parseFloat(chg),cls=isNaN(n)?'neutral':n>0?'up':n<0?'down':'neutral';ce.className=`stat-change ${cls}`;ce.textContent=isNaN(n)?', ':(n>0?'+':n<0?'−':'')+Math.abs(n).toFixed(2)+' pts';}
    };
    let lastDate=null;
    Object.values(mapCard).forEach(card=>{const realName=findIndice(card.candidates),data=realName?latest[realName]:null;if(data){setIdx(card.id,data.valeur,card.chgId,data.variation);if(data.date_seance)lastDate=data.date_seance;const history=getIndiceHistory(realName,20);if(history.length>=2)drawSparkline(card.sparkId,history.map(d=>d.valeur));}else setIdx(card.id,null,card.chgId,null);});
    const lastSessionEl=document.getElementById('lastSession');if(lastSessionEl)lastSessionEl.textContent=lastDate?'Séance '+fmtDate(lastDate):', ';
  }

  window.renderCompositeChart=function(){
    if(window.compositeChartInst){window.compositeChartInst.destroy();window.compositeChartInst=null;}
    const history=getIndiceHistory('BRVM C',_compositePeriod),labels=history.map(d=>d?.date_seance?new Date(d.date_seance).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}):'?'),values=history.map(d=>d?.valeur??0),canvas=document.getElementById('chartComposite');
    if(!canvas)return;
    if(labels.length<=1||!values.some(v=>v>0)){const ctx=canvas.getContext('2d');if(ctx){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='rgba(245,240,232,.3)';ctx.font='14px DM Sans';ctx.textAlign='center';ctx.fillText('Données insuffisantes',canvas.width/2,canvas.height/2);}return;}
    try{window.compositeChartInst=new Chart(canvas,{type:'line',data:{labels,datasets:[{...mkDataset(values),tension:.3,pointRadius:0,pointHoverRadius:6}]},options:{...chartOpts,interaction:{intersect:false,mode:'index'},plugins:{...chartOpts.plugins,legend:{display:false}}}});}catch(err){console.error('[OVERVIEW] Erreur création chart:',err);}
  };

  window.setCompositePeriod=function(days,btn){document.querySelectorAll('.chart-tabs .year-tab').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');_compositePeriod=days;renderCompositeChart();};

  function drawSparkline(canvasId,values){const canvas=document.getElementById(canvasId);if(!canvas||values.length<2)return;const ctx=canvas.getContext('2d'),dpr=window.devicePixelRatio||1,rect=canvas.getBoundingClientRect();if(rect.width===0||rect.height===0)return;canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;ctx.scale(dpr,dpr);const w=rect.width,h=rect.height,min=Math.min(...values),max=Math.max(...values),range=max-min||1;ctx.clearRect(0,0,w,h);ctx.beginPath();ctx.strokeStyle=values[values.length-1]>=values[0]?'var(--green)':'var(--red)';ctx.lineWidth=2;values.forEach((v,i)=>{const x=i/(values.length-1)*w,y=h-((v-min)/range)*h*.8-h*.1;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();}

  function renderSectorHeatmap(){const bySector={},byTicker={};(window.allCours||[]).forEach(c=>{if(c?.ticker&&!byTicker[c.ticker])byTicker[c.ticker]=c;});Object.values(byTicker).forEach(c=>{const sector=getSector(c.ticker)||'Autre';if(!bySector[sector])bySector[sector]={total:0,count:0};const v=parseFloat(c.variation)||0;bySector[sector].total+=v;bySector[sector].count++;});const container=document.getElementById('sectorHeatmap');if(!container)return;const sectors=Object.entries(bySector).map(([name,data])=>({name,avg:data.total/data.count,count:data.count})).sort((a,b)=>Math.abs(b.avg)-Math.abs(a.avg));if(!sectors.length){container.innerHTML='<div class="empty-state">Aucune donnée sectorielle</div>';return;}container.innerHTML=sectors.map(s=>{const cls=s.avg>0?'heatmap-up':s.avg<0?'heatmap-down':'heatmap-neutral',color=s.avg>0?'var(--green)':s.avg<0?'var(--red)':'var(--dim)';return `<div class="heatmap-cell ${cls}" style="border-left-color:${color}"><div class="hm-name">${escapeHtml(s.name)}</div><div class="hm-value" style="color:${color}">${s.avg>0?'+':''}${s.avg.toFixed(2)}%</div><div class="hm-count">${s.count} titre${s.count>1?'s':''}</div></div>`;}).join('');}

  function renderNewsFeed(){const container=document.getElementById('newsFeed');if(!container)return;const recent=(window.allAnalyses||[]).slice(0,5);if(!recent.length){container.innerHTML='<div class="empty-state">Aucune analyse disponible</div>';return;}container.innerHTML=recent.map(a=>{const badgeClass=(a.recommandation||'').toLowerCase(),badgeText=a.recommandation||'NEWS',ticker=a.ticker||', ';return `<div class="news-item"><span class="badge ${escapeHtml(badgeClass)}">${escapeHtml(badgeText)}</span><div class="news-title">${escapeHtml(a.titre||'Analyse '+ticker)}</div><div class="news-meta">${escapeHtml(ticker)} • ${fmtDate(a.date_analyse)} • Objectif: ${a.objectif||', '} FCFA</div></div>`;}).join('');}

  // ─── TOP MOVERS ───
  function renderMoversControls(){
    const container=document.getElementById('topMovers');
    if(!container)return;
    const card=container.closest('.card');
    const header=card?.querySelector('.card-header');
    if(!header)return;
    header.classList.add('movers-header');
    let controls=header.querySelector('.movers-controls');
    if(!controls){
      controls=document.createElement('div');
      controls.className='movers-controls';
      controls.innerHTML=`<div class="movers-tabs" role="tablist" aria-label="Filtrer les mouvements"><button type="button" class="mover-filter active" data-tab="gainers">Hausse</button><button type="button" class="mover-filter" data-tab="losers">Baisse</button><button type="button" class="mover-filter" data-tab="volume">Volume</button></div>`;
      controls.querySelectorAll('.mover-filter').forEach(btn=>btn.addEventListener('click',()=>window.setMoversTab(btn.dataset.tab,btn)));
      header.appendChild(controls);
    }
    controls.querySelectorAll('.mover-filter').forEach(btn=>btn.classList.toggle('active',btn.dataset.tab===_moversTab));
  }

  window.setMoversTab=function(tab,btn){_moversTab=tab;const controls=document.querySelector('.movers-controls');controls?.querySelectorAll('.mover-filter').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));renderTopMovers();};

  function renderTopMovers(){
    const container=document.getElementById('topMovers');if(!container)return;
    if(!Array.isArray(window.allCours)||!window.allCours.length){container.innerHTML='<div class="empty-state">Aucune donnée de marché disponible</div>';return;}
    const byTicker={};window.allCours.forEach(c=>{if(c?.ticker&&!byTicker[c.ticker])byTicker[c.ticker]=c;});
    const values=Object.values(byTicker);
    let sorted=[];
    if(_moversTab==='gainers')sorted=values.filter(c=>parseFloat(c.variation)>0).sort((a,b)=>parseFloat(b.variation)-parseFloat(a.variation)).slice(0,8);
    else if(_moversTab==='losers')sorted=values.filter(c=>parseFloat(c.variation)<0).sort((a,b)=>parseFloat(a.variation)-parseFloat(b.variation)).slice(0,8);
    else sorted=values.sort((a,b)=>(Number(b.volume)||0)-(Number(a.volume)||0)).slice(0,8);
    if(!sorted.length){container.innerHTML=`<div class="movers-empty">Aucun titre dans la catégorie <strong>${_moversTab==='gainers'?'Hausse':_moversTab==='losers'?'Baisse':'Volume'}</strong></div>`;return;}
    container.innerHTML=`<div class="movers-label-row"><span>Titre</span><span>Cours</span><span>${_moversTab==='volume'?'Volume':'Variation'}</span></div>`+sorted.map((c,i)=>{
      const v=parseFloat(c.variation)||0,vol=_moversTab==='volume',cls=v>0?'up':v<0?'down':'neutral',rightVal=vol?fmt(c.volume):(v>0?'+':'')+v.toFixed(2)+'%';
      return `<div class="mover-row ${cls}" onclick="openFiche('${escapeHtml(c.ticker)}')" role="button" tabindex="0"><div class="mover-rank">${String(i+1).padStart(2,'0')}</div><div class="mover-security"><span class="mover-symbol">${escapeHtml(c.ticker)}</span><span class="mover-name">${escapeHtml(window.entMap?.[c.ticker]?.nom||'Titre BRVM')}</span></div><div class="mover-price">${fmt(c.cours)} <span>FCFA</span></div><div class="mover-change ${cls}"><span class="mover-change-value">${rightVal}</span></div></div>`;
    }).join('');
  }

  function renderPubFeed(){const container=document.getElementById('pubFeed');if(!container)return;const upcoming=(window.allFinancials||[]).filter(f=>f.periode==='annuel'||f.periode==='s1').sort((a,b)=>(b.annee||0)-(a.annee||0)).slice(0,5);if(!upcoming.length){container.innerHTML='<div class="empty-state">Aucune publication prévue</div>';return;}container.innerHTML=upcoming.map(p=>{const ticker=p.ticker||', ',year=p.annee||new Date().getFullYear(),isPublished=p.resultat_net!=null,month=isPublished?'03':'06';return `<div class="pub-item"><div class="pub-date"><span class="day">15</span><span class="month">${month}</span></div><div class="pub-info"><span class="ticker">${escapeHtml(ticker)}</span><span class="period">${escapeHtml(p.periode)} ${year}</span></div></div>`;}).join('');}

  function renderAlertFeed(){const container=document.getElementById('alertFeed');if(!container)return;const alerts=safeJSON(localStorage.getItem('tc_alerts'),[]),active=alerts.filter(a=>!a.triggered).slice(0,5);if(!active.length){container.innerHTML='<div class="empty-state">Aucune alerte active</div>';return;}const byTicker={};(window.allCours||[]).forEach(c=>{if(c?.ticker)byTicker[c.ticker]=c;});container.innerHTML=active.map(a=>{const c=byTicker[a.ticker],current=c?.cours||0,triggered=a.condition==='above'?current>=a.price:current<=a.price;return `<div class="alert-item ${triggered?'triggered':''}"><span class="ticker">${escapeHtml(a.ticker)}</span><span class="condition">${a.condition==='above'?'>':'<'} ${a.price} FCFA</span><span class="current">${fmt(current)}</span></div>`;}).join('');}

  function renderWatchFeed(){const container=document.getElementById('watchFeed');if(!container)return;const watchlist=safeJSON(localStorage.getItem('tc_watchlist'),[]),positions=safeJSON(localStorage.getItem('tc_portfolio'),[]),tickers=[...new Set([...watchlist,...positions.map(p=>p.ticker)])];if(!tickers.length){container.innerHTML='<div class="empty-state">Ajoutez des titres à votre watchlist</div>';return;}const byTicker={};(window.allCours||[]).forEach(c=>{if(c?.ticker)byTicker[c.ticker]=c;});container.innerHTML=tickers.map(t=>{const c=byTicker[t];if(!c)return '';const v=parseFloat(c.variation)||0,cls=v>0?'up':v<0?'down':'neutral',ent=window.entMap?.[t];return `<div class="watch-item ${cls}" onclick="openFiche('${escapeHtml(t)}')"><span class="ticker">${escapeHtml(t)}</span><span class="name">${escapeHtml(ent?.nom||'')}</span><span class="price">${fmt(c.cours)}</span><span class="change ${cls}">${v>0?'+':''}${v.toFixed(2)}%</span></div>`;}).join('');}

  function renderCoursTable(){
    const byTicker={};(window.allCours||[]).forEach(c=>{if(c?.ticker&&!byTicker[c.ticker])byTicker[c.ticker]=c;});
    const rows=Object.values(byTicker).sort((a,b)=>(a?.ticker||'').localeCompare(b?.ticker||''));
    const countEl=document.getElementById('coursCount');if(countEl)countEl.textContent=rows.length+' titre'+(rows.length>1?'s':'');
    const tableEl=document.getElementById('coursTable');if(!tableEl)return;
    if(!rows.length){tableEl.innerHTML='<tr><td colspan="6" class="empty-cell">Aucune donnée de cours disponible.</td></tr>';return;}
    tableEl.innerHTML=rows.map(c=>`<tr onclick="openFiche('${escapeHtml(c.ticker)}')"><td><strong>${escapeHtml(c.ticker)}</strong></td><td>${fmt(c.cours)}</td><td>${changePill(c.variation)}</td><td>${fmt(c.volume)}</td><td>${c.capitalisation?fmtM(c.capitalisation):', '}</td><td>${escapeHtml(getSector(c.ticker))}</td></tr>`).join('');
  }

  console.log('[OVERVIEW] Chargé avec succès');
})();
