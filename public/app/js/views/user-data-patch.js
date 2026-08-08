// THE CAPITAL — authenticated user data layer
(function(){
  function token(){
    try { const s=JSON.parse(localStorage.getItem('tc_session')||'null'); return s?.access_token||localStorage.getItem('tc_token')||localStorage.getItem('token')||''; } catch(_){ return ''; }
  }
  async function api(mode, method, body, id){
    const headers={'Accept':'application/json','Content-Type':'application/json'};
    const t=token(); if(t) headers.Authorization='Bearer '+t;
    const url='/api/user-data?mode='+encodeURIComponent(mode)+(id?'&id='+encodeURIComponent(id):'');
    const r=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined});
    const p=await r.json().catch(()=>({})); if(!r.ok) throw new Error(p.error||`HTTP ${r.status}`); return p.data;
  }

  let alerts=[];
  window.loadAlertsFromServer=async function(){ alerts=await api('alerts','GET'); renderAlertsServer(); };
  window.getAlerts=function(){ return alerts.slice(); };
  window.addAlert=async function(){
    const ticker=document.getElementById('alertTicker')?.value;
    const condition=document.getElementById('alertCondition')?.value;
    const price=Number(document.getElementById('alertPrice')?.value);
    if(!ticker||!Number.isFinite(price)||price<=0){ if(typeof toast==='function')toast('Remplissez tous les champs','warn'); return; }
    try { await api('alerts','POST',{ticker,condition,price}); document.getElementById('alertPrice').value=''; await loadAlertsFromServer(); if(typeof toast==='function')toast('Alerte créée','success'); }
    catch(e){ if(typeof toast==='function')toast(e.message,'error'); }
  };
  window.removeAlert=async function(id){ try{await api('alerts','DELETE',null,id);await loadAlertsFromServer();}catch(e){toast(e.message,'error');} };
  window.toggleAlert=async function(id){ const a=alerts.find(x=>String(x.id)===String(id)); if(!a)return; try{await api('alerts','PUT',{active:!a.active},id);await loadAlertsFromServer();}catch(e){toast(e.message,'error');} };
  function renderAlertsServer(){
    const el=document.getElementById('alertsList'); if(!el)return;
    const byTicker={}; (window.allCours||[]).forEach(c=>{if(!byTicker[c.ticker])byTicker[c.ticker]=c;});
    el.innerHTML=alerts.map(a=>{const current=byTicker[a.ticker]?.cours;const condition=a.type_alerte==='above'?'supérieur à':'inférieur à';const triggered=a.type_alerte==='above'?current>=a.seuil:a.type_alerte==='below'?current<=a.seuil:false;return `<div class="alert-card ${triggered?'triggered':a.active?'active':''}"><div class="alert-info"><div class="alert-ticker">${a.ticker}</div><div class="alert-desc">Cours ${condition} ${fmt(a.seuil)} FCFA</div><div class="alert-meta">${triggered?'🔔 Déclenchée':a.active?'✅ Active':'⏸️ Désactivée'} · Cours actuel : ${current?fmt(current):'—'}</div></div><div class="alert-actions"><button onclick="toggleAlert('${a.id}')">${a.active?'Désactiver':'Activer'}</button><button onclick="removeAlert('${a.id}')">Supprimer</button></div></div>`;}).join('')||'<div class="empty-state"><div class="empty-icon">△</div><div class="empty-title">Aucune alerte</div><div class="empty-text">Créez votre première alerte de prix ci-dessus.</div></div>';
  }
  const oldRender=window.renderAlerts;
  window.renderAlerts=function(){ if(alerts.length||window.__TC_ALERTS_SERVER_READY__) return renderAlertsServer(); return oldRender?.(); };
  window.initUserDataLayer=function(){ window.__TC_ALERTS_SERVER_READY__=true; return loadAlertsFromServer().catch(e=>console.warn('[ALERTES]',e.message)); };
})();
