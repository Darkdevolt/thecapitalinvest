/* THE CAPITAL — Cours & Historique BRVM — Control Center */
(function(){
  'use strict';
  var started=false;
  var state={view:'table',period:'all',ticker:'',date:'',status:'all'};

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
  function num(v){var n=parseFloat(String(v||'').replace(/\s/g,'').replace(/,/g,'.'));return isFinite(n)?n:null;}
  function rows(){
    return Array.prototype.slice.call(document.querySelectorAll('#cours-tbody tr')).filter(function(r){return r.querySelector('td') && !r.querySelector('.loading');}).map(function(r){
      var c=r.querySelectorAll('td');
      return {el:r,ticker:(c[1]&&c[1].textContent||'').trim(),date:(c[2]&&c[2].textContent||'').trim(),price:num(c[3]&&c[3].textContent),volume:num(c[7]&&c[7].textContent),variation:num(c[8]&&c[8].textContent)};
    });
  }
  function filtered(){
    return rows().filter(function(x){
      return (!state.ticker || x.ticker.toLowerCase().indexOf(state.ticker.toLowerCase())>=0) &&
             (!state.date || x.date.indexOf(state.date)>=0) &&
             (state.status==='all' || (state.status==='positive' ? x.variation>=0 : x.variation<0));
    });
  }
  function css(){
    if(document.getElementById('tc-css'))return;
    var s=document.createElement('style');s.id='tc-css';s.textContent=`
      #tc-control{margin:0 0 16px}.tc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin-bottom:12px}.tc-kpi{background:var(--surface);border:1px solid var(--border);padding:13px;border-radius:4px}.tc-kpi small{display:block;color:var(--muted);font:10px var(--mono);text-transform:uppercase;letter-spacing:.5px}.tc-kpi strong{display:block;color:var(--cream);font-size:20px;margin-top:5px}.tc-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.tc-tools input,.tc-tools select{background:var(--surface);border:1px solid var(--border);color:var(--cream);padding:7px 9px;border-radius:3px;font-size:11px}.tc-tools button{cursor:pointer}.tc-views{display:flex;gap:5px;margin-top:10px}.tc-view.active{border-color:var(--gold);color:var(--gold)}.tc-chart{min-height:220px;padding:14px}.tc-bars{display:flex;align-items:flex-end;gap:4px;height:170px;border-bottom:1px solid var(--border);padding:0 5px}.tc-bar{flex:1;min-width:3px;background:var(--gold);opacity:.75;position:relative}.tc-bar span{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);font:8px var(--mono);color:var(--muted);white-space:nowrap}.tc-donut{width:150px;height:150px;border-radius:50%;margin:15px auto;background:conic-gradient(var(--gold) 0 var(--p),var(--border) var(--p) 100%);position:relative}.tc-donut:after{content:'';position:absolute;inset:30px;background:var(--surface);border-radius:50%}.tc-legend{text-align:center;color:var(--muted);font-size:11px}.tc-note{color:var(--muted);font-size:10px;line-height:1.5;margin-top:8px}.tc-alert{padding:10px 12px;border:1px solid var(--border);border-radius:3px;background:var(--surface);font-size:11px}.tc-alert b{color:var(--gold)}
    `;document.head.appendChild(s);
  }
  function card(title,body){return '<div class="card" style="margin-bottom:12px"><div class="card-header"><span class="card-title">'+title+'</span></div>'+body+'</div>';}
  function mount(){
    if(started)return; var p=document.getElementById('panel-cours'); if(!p)return; started=true;css();
    var anchor=p.querySelector('.info-box');
    var box=document.createElement('div');box.id='tc-control';
    box.innerHTML=card('Poste de pilotage — contrôle des cours BRVM','<div style="padding:14px 18px"><div class="tc-kpis" id="tc-kpis"></div><div class="tc-tools"><input id="tc-ticker" placeholder="Ticker / société"/><input id="tc-date" type="date"/><select id="tc-status"><option value="all">Toutes variations</option><option value="positive">Hausses / stables</option><option value="negative">Baisses</option></select><button class="btn btn-outline btn-sm" id="tc-reset">Réinitialiser</button><button class="btn btn-primary btn-sm" id="tc-refresh">Actualiser les données</button></div><div class="tc-views"><button class="btn btn-outline btn-sm tc-view active" data-v="table">Tableau</button><button class="btn btn-outline btn-sm tc-view" data-v="progression">Progression</button><button class="btn btn-outline btn-sm tc-view" data-v="volume">Volumes</button><button class="btn btn-outline btn-sm tc-view" data-v="pie">Répartition</button></div><div id="tc-visual"></div><div class="tc-note">Les outils ci-dessus servent au contrôle opérationnel. Ils lisent les données déjà chargées dans le tableau Cours ; aucune donnée n’est créée ou modifiée par les graphiques. Pour modifier une ligne, utilisez l’action <b>Modifier</b> du tableau.</div></div>');
    p.insertBefore(box,anchor||p.firstChild);
    ['tc-ticker','tc-date','tc-status'].forEach(function(id){document.getElementById(id).addEventListener('input',function(){state.ticker=document.getElementById('tc-ticker').value;state.date=document.getElementById('tc-date').value;state.status=document.getElementById('tc-status').value;render();});});
    document.getElementById('tc-reset').onclick=function(){state={view:'table',period:'all',ticker:'',date:'',status:'all'};document.getElementById('tc-ticker').value='';document.getElementById('tc-date').value='';document.getElementById('tc-status').value='all';render();};
    document.getElementById('tc-refresh').onclick=function(){if(typeof loadCours==='function')loadCours();setTimeout(render,900);};
    box.querySelectorAll('.tc-view').forEach(function(b){b.onclick=function(){box.querySelectorAll('.tc-view').forEach(function(x){x.classList.remove('active')});b.classList.add('active');state.view=b.dataset.v;render();};});
    render();
  }
  function render(){
    var d=filtered(), all=rows(), pos=d.filter(function(x){return x.variation!==null&&x.variation>=0}).length, neg=d.filter(function(x){return x.variation!==null&&x.variation<0}).length;
    var vol=d.reduce(function(a,x){return a+(x.volume||0)},0), avg=d.filter(function(x){return x.variation!==null}).reduce(function(a,x){return a+x.variation},0)/(d.filter(function(x){return x.variation!==null}).length||1);
    var k=document.getElementById('tc-kpis');if(!k)return;
    k.innerHTML='<div class="tc-kpi"><small>Lignes chargées</small><strong>'+all.length+'</strong></div><div class="tc-kpi"><small>Lignes filtrées</small><strong>'+d.length+'</strong></div><div class="tc-kpi"><small>Hausses / stables</small><strong>'+pos+'</strong></div><div class="tc-kpi"><small>Baisses</small><strong>'+neg+'</strong></div><div class="tc-kpi"><small>Volume affiché</small><strong>'+Math.round(vol).toLocaleString('fr-FR')+'</strong></div><div class="tc-kpi"><small>Variation moyenne</small><strong>'+avg.toFixed(2)+'%</strong></div>';
    var v=document.getElementById('tc-visual'); if(!v)return;
    if(state.view==='table'){v.innerHTML='<div class="tc-alert" style="margin-top:10px"><b>Contrôle actif :</b> '+d.length+' ligne(s) correspondent aux filtres. Les actions de modification et suppression restent dans le tableau principal ci-dessous.</div>';return;}
    if(!d.length){v.innerHTML='<div class="tc-alert" style="margin-top:10px">Aucune donnée ne correspond aux filtres actuels.</div>';return;}
    if(state.view==='pie'){var pct=(pos/(pos+neg||1)*100);v.innerHTML='<div class="tc-chart"><div class="tc-donut" style="--p:'+pct+'%"></div><div class="tc-legend">Hausses / stables : '+pos+' ('+pct.toFixed(1)+'%) · Baisses : '+neg+' ('+(100-pct).toFixed(1)+'%)</div></div>';return;}
    var key=state.view==='volume'?'volume':'price', max=Math.max.apply(null,d.map(function(x){return x[key]||0}))||1;
    var bars=d.slice(-40).map(function(x){var val=x[key]||0;var h=Math.max(3,val/max*100);return '<div class="tc-bar" style="height:'+h+'%" title="'+esc(x.ticker)+' · '+val+'"><span>'+esc(x.ticker)+'</span></div>';}).join('');
    v.innerHTML='<div class="tc-chart"><div style="font-size:10px;color:var(--muted);margin-bottom:8px">'+(state.view==='volume'?'Volumes — 40 dernières lignes affichées':'Progression des cours — 40 dernières lignes affichées')+'</div><div class="tc-bars">'+bars+'</div></div>';
  }
  function watch(){
    mount();var tb=document.getElementById('cours-tbody');if(tb&&window.MutationObserver){new MutationObserver(function(){render();}).observe(tb,{childList:true,subtree:true});}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch);else watch();
  window.TheCapitalCoursControl={refresh:render};
})();
