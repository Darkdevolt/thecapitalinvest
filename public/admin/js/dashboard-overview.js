(function(){
'use strict';

function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');}
function num(v){var n=Number(v);return Number.isFinite(n)?n:null;}
function fmt(v){var n=num(v);return n===null?'—':n.toLocaleString('fr-FR');}
function pct(v){var n=num(v);return n===null?'—':n.toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1})+' %';}
function progress(v){var n=Math.max(0,Math.min(100,Number(v)||0));return '<div class="tc-dash-progress"><div class="tc-dash-progress-fill" style="width:'+n+'%"></div></div>'+'<span class="tc-dash-progress-value">'+Math.round(n)+'%</span>';}
function openSection(name){var btn=document.querySelector('.admin-tab[onclick*="switchTab(\\''+name+'\\'"]');if(typeof switchTab==='function')switchTab(name,btn||null);window.scrollTo({top:0,behavior:'smooth'});}
function sectionCard(s){return '<div class="tc-dash-section-card"><div class="tc-dash-section-top"><div><div class="tc-dash-section-name">'+esc(s.name)+'</div><div class="tc-dash-section-meta">'+esc(s.meta)+'</div></div><span class="tc-dash-status '+(s.ok?'ok':'warn')+'">'+(s.ok?'OPÉRATIONNEL':'À VÉRIFIER')+'</span></div><div class="tc-dash-progress-wrap">'+progress(s.progress)+'</div><div class="tc-dash-section-bottom"><span>'+esc(s.stat)+'</span><button class="btn btn-outline btn-sm" type="button" onclick="openSection(\''+s.id+'\')">Ouvrir →</button></div></div>';}

async function loadDashboardOverview(){
    var panel=document.getElementById('panel-dashboard');
    if(!panel)return;
    panel.innerHTML='<div class="tc-dash-head"><div><div class="section-title">Centre de contrôle <em>admin</em></div><div class="tc-dash-subtitle">Résumé global des données, de la qualité et des accès administrateur.</div></div><button class="btn btn-outline btn-sm" type="button" onclick="loadDashboard()">↺ Actualiser</button></div><div id="tc-dash-kpis" class="tc-dash-kpis"><div class="loading"><div class="spinner"></div><p>Lecture de la base...</p></div></div><div id="tc-dash-quality" class="tc-dash-quality"></div><div class="tc-dash-grid" id="tc-dash-sections"></div><div id="tc-dash-alerts" class="tc-dash-alerts"></div><div class="tc-dash-note">Les indicateurs ci-dessous mesurent l’état réel des données disponibles. Une alerte signale un point à vérifier et ne modifie jamais automatiquement une donnée.</div>';

    var tables=[
        {id:'entreprises',name:'Entreprises',table:'entreprises',meta:'Référentiel des sociétés cotées'},
        {id:'cours',name:'Cours',table:'cours',meta:'Dernières cotations BRVM'},
        {id:'historique',name:'Historique',table:'historique',meta:'Séries historiques et contrôle qualité'},
        {id:'financials',name:'Financials',table:'financials',meta:'Données financières'},
        {id:'dividendes',name:'Dividendes',table:'dividendes_calendrier',meta:'Calendrier et historiques de dividendes'},
        {id:'analyses',name:'Analyses',table:'analyses',meta:'Notes et recommandations'},
        {id:'utilisateurs',name:'Utilisateurs',table:'users',meta:'Comptes et droits administrateur'},
        {id:'indices',name:'Indices',table:'indices',meta:'Indices BRVM par séance'}
    ];
    var counts={};
    await Promise.all(tables.map(async function(s){counts[s.table]=await sbCount(s.table); }));

    var latestCourse=(await sbGet('cours','select=date_seance&order=date_seance.desc&limit=1'))||[];
    var latestDate=latestCourse[0]&&latestCourse[0].date_seance?String(latestCourse[0].date_seance).slice(0,10):null;
    var latestRows=[];
    if(latestDate)latestRows=(await sbGet('cours','select=ticker,cours,ouverture,plus_haut,plus_bas,volume,variation,date_seance&date_seance=eq.'+encodeURIComponent(latestDate)+'&limit=5000'))||[];

    var missing=0,ohlc=0,extreme=0,dup=0,seen={};
    latestRows.forEach(function(r){
        if(!r.ticker||num(r.cours)===null||num(r.variation)===null||num(r.volume)===null)missing++;
        var h=num(r.plus_haut),l=num(r.plus_bas),c=num(r.cours);
        if(h!==null&&l!==null&&c!==null&&!(h>=c&&c>=l&&h>=l))ohlc++;
        var v=num(r.variation);if(v!==null&&Math.abs(v)>20)extreme++;
        var key=String(r.ticker||'').toUpperCase();if(key){if(seen[key])dup++;seen[key]=1;}
    });
    var completeness=latestRows.length?((latestRows.length-missing)/latestRows.length)*100:0;
    var quality=Math.max(0,Math.min(100,completeness-(ohlc*5)-(dup*5)));

    var kpi=document.getElementById('tc-dash-kpis');
    kpi.innerHTML='<div class="tc-dash-kpi"><span>Sections data</span><strong>'+tables.length+'</strong><small>surveillées</small></div><div class="tc-dash-kpi"><span>Dernière séance</span><strong>'+(latestDate||'—')+'</strong><small>'+fmt(latestRows.length)+' titres récupérés</small></div><div class="tc-dash-kpi"><span>Complétude séance</span><strong>'+Math.round(completeness)+'%</strong><small>'+fmt(missing)+' donnée(s) essentielle(s) manquante(s)</small></div><div class="tc-dash-kpi"><span>Qualité technique</span><strong>'+Math.round(quality)+'%</strong><small>'+fmt(ohlc+dup)+' anomalie(s) structurelle(s)</small></div>';

    var q=document.getElementById('tc-dash-quality');
    q.innerHTML='<div class="card tc-dash-quality-card"><div class="card-header"><span class="card-title">Qualité de la dernière séance</span><span class="tc-dash-date">'+(latestDate||'Aucune séance')+'</span></div><div class="tc-dash-quality-grid"><div><span>Complétude</span>'+progress(completeness)+'</div><div><span>Cohérence OHLC</span>'+progress(latestRows.length?Math.max(0,100-(ohlc/latestRows.length*100)):0)+'</div><div><span>Doublons détectés</span><strong>'+fmt(dup)+'</strong></div><div><span>Variations inhabituelles</span><strong>'+fmt(extreme)+'</strong></div></div><div class="tc-dash-quality-foot">Mesures uniquement : aucune correction ou suppression automatique.</div></div>';

    var sections=tables.map(function(s){var c=counts[s.table]||0;var p=c>0?100:0;var stat=fmt(c)+' enregistrement(s)';if(s.id==='cours'&&latestDate)stat=fmt(latestRows.length)+' cours · '+latestDate;return Object.assign({},s,{progress:p,ok:c>0,stat:stat});});
    sections.push({id:'scraper',name:'Scraper',meta:'Récupération BRVM + prévisualisation / validation',progress:100,ok:true,stat:'Contrôle manuel / automatique disponible'});
    sections.push({id:'import',name:'Import Excel',meta:'Imports contrôlés depuis l’Admin',progress:100,ok:true,stat:'Module disponible'});
    sections.push({id:'diagnostic',name:'Diagnostic',meta:'Contrôles techniques et santé de l’application',progress:100,ok:true,stat:'Module disponible'});

    document.getElementById('tc-dash-sections').innerHTML='<div class="tc-dash-section-title"><span>Accès à toutes les sections</span><small>Chaque carte ouvre directement le module correspondant.</small></div>'+sections.map(sectionCard).join('');

    var alerts=[];
    if(!latestDate)alerts.push('Aucune séance de cours détectée dans la base.');
    if(missing)alerts.push(fmt(missing)+' ligne(s) de la dernière séance présentent des champs essentiels manquants — vérifier.');
    if(ohlc)alerts.push(fmt(ohlc)+' ligne(s) ont une incohérence OHLC — vérifier.');
    if(dup)alerts.push(fmt(dup)+' doublon(s) de ticker détecté(s) sur la dernière séance — vérifier.');
    if(extreme)alerts.push(fmt(extreme)+' variation(s) supérieure(s) à ±20 % — alerte, pas une correction automatique.');
    var alertBox=document.getElementById('tc-dash-alerts');
    alertBox.innerHTML='<div class="card"><div class="card-header"><span class="card-title">Alertes & points de contrôle</span><span class="tc-dash-alert-count">'+alerts.length+'</span></div><div class="tc-dash-alert-list">'+(alerts.length?alerts.map(function(a){return '<div class="tc-dash-alert">⚠ '+esc(a)+'</div>';}).join(''):'<div class="tc-dash-alert ok-alert">✓ Aucun signal d’alerte détecté sur les contrôles affichés.</div>')+'</div></div>';
}

window.openSection=openSection;
window.loadDashboard=loadDashboardOverview;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(loadDashboardOverview,0);});else setTimeout(loadDashboardOverview,0);
})();
