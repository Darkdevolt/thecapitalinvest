// THE CAPITAL — authenticated user data layer
// Source de vérité : Supabase via /api/user-data. Uses the central API client.
(function(){
  'use strict';

  function call(mode, method, body, id){
    const endpoint='/user-data?mode='+encodeURIComponent(mode)+(id?'&id='+encodeURIComponent(id):'');
    if(method==='GET') return window.apiGet(endpoint);
    if(method==='POST') return window.apiPost(endpoint, body);
    if(method==='PUT') return window.apiPut(endpoint, body);
    if(method==='DELETE') return window.apiDelete(endpoint);
    throw new Error('Méthode non supportée');
  }

  let alerts=[];
  window.getAlertsServer=function(){return alerts.slice();};
  window.getAlerts=function(){return alerts.slice();};

  async function loadAlertsFromServer(){
    const payload=await call('alerts','GET');
    alerts=Array.isArray(payload?.data)?payload.data:(Array.isArray(payload)?payload:[]);
    renderAlertsServer();
    return alerts;
  }
  window.loadAlertsFromServer=loadAlertsFromServer;

  window.addAlert=async function(){
    const ticker=document.getElementById('alertTicker')?.value?.trim().toUpperCase();
    const condition=document.getElementById('alertCondition')?.value;
    const price=Number(document.getElementById('alertPrice')?.value);
    if(!ticker||!['above','below'].includes(condition)||!Number.isFinite(price)||price<=0){
      if(typeof toast==='function')toast('Remplissez correctement tous les champs','warn');
      return;
    }
    try{
      await call('alerts','POST',{ticker,condition,price});
      const input=document.getElementById('alertPrice'); if(input) input.value='';
      await loadAlertsFromServer();
      if(typeof toast==='function')toast('Alerte créée','success');
    }catch(e){if(typeof toast==='function')toast(e.message,'error');}
  };

  window.removeAlert=async function(id){
    try{await call('alerts','DELETE',undefined,id);await loadAlertsFromServer();if(typeof toast==='function')toast('Alerte supprimée','success');}
    catch(e){if(typeof toast==='function')toast(e.message,'error');}
  };

  window.toggleAlert=async function(id){
    const a=alerts.find(x=>String(x.id)===String(id));
    if(!a)return;
    try{await call('alerts','PUT',{active:!a.active},id);await loadAlertsFromServer();}
    catch(e){if(typeof toast==='function')toast(e.message,'error');}
  };

  function renderAlertsServer(){
    const el=document.getElementById('alertsList');if(!el)return;
    const byTicker={};
    (window.allCours||[]).forEach(c=>{if(c?.ticker&&!byTicker[c.ticker])byTicker[c.ticker]=c;});
    el.innerHTML=alerts.map(a=>{
      const current=Number(byTicker[a.ticker]?.cours), threshold=Number(a.seuil ?? a.price), type=a.type_alerte || a.condition;
      const triggered=Number.isFinite(current)&&(type==='above'?current>=threshold:type==='below'?current<=threshold:false);
      const label=type==='above'?'supérieur à':'inférieur à';
      return `<div class="alert-card ${triggered?'triggered':a.active?'active':''}"><div class="alert-info"><div class="alert-ticker">${a.ticker}</div><div class="alert-desc">Cours ${label} ${fmt(threshold)} FCFA</div><div class="alert-meta">${triggered?'🔔 Déclenchée':a.active?'✅ Active':'⏸️ Désactivée'} · Cours actuel : ${Number.isFinite(current)?fmt(current):'—'}</div></div><div class="alert-actions"><button onclick="toggleAlert('${a.id}')">${a.active?'Désactiver':'Activer'}</button><button onclick="removeAlert('${a.id}')">Supprimer</button></div></div>`;
    }).join('')||'<div class="empty-state"><div class="empty-icon">△</div><div class="empty-title">Aucune alerte</div><div class="empty-text">Créez votre première alerte de prix ci-dessus.</div></div>';
  }

  let watchlist=[];
  window.getWatchlistServer=function(){return watchlist.slice();};
  window.getWatchlist=function(){return watchlist.slice();};

  window.loadWatchlistFromServer=async function(){
    const payload=await call('watchlist','GET');
    watchlist=Array.isArray(payload?.data)?payload.data:(Array.isArray(payload)?payload:[]);
    window.__TC_WATCHLIST__=watchlist.slice();
    return watchlist;
  };

  window.syncWatchlist=async function(next){
    const wanted=(next||[]).map(x=>String(x.ticker||'').toUpperCase()).filter(Boolean);
    const current=watchlist.slice();
    for(const item of current) if(!wanted.includes(String(item.ticker).toUpperCase())) await call('watchlist','DELETE',undefined,item.id);
    for(const ticker of wanted) if(!current.some(x=>String(x.ticker).toUpperCase()===ticker)) await call('watchlist','POST',{ticker});
    await window.loadWatchlistFromServer();return true;
  };

  window.addWatchlistItem=async function(ticker){
    const t=String(ticker||'').toUpperCase().trim();if(!t)return false;
    if(watchlist.some(x=>String(x.ticker).toUpperCase()===t))return true;
    await call('watchlist','POST',{ticker});await window.loadWatchlistFromServer();return true;
  };

  window.removeWatchlistItem=async function(id){await call('watchlist','DELETE',undefined,id);await window.loadWatchlistFromServer();return true;};

  window.__TC_ALERTS_SERVER_READY__=true;
  window.renderAlerts=renderAlertsServer;
  window.initUserDataLayer=function(){
    return Promise.all([loadAlertsFromServer(),window.loadWatchlistFromServer()]).catch(e=>console.warn('[USER DATA]',e.message));
  };
})();
