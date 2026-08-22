(function(){
'use strict';

function injectDashboardStyles(){
    if(document.getElementById('tc-dashboard-overview-style'))return;
    var s=document.createElement('style');s.id='tc-dashboard-overview-style';s.textContent=`
        #panel-dashboard{padding-bottom:28px}
        .tc-dash-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:22px}
        .tc-dash-subtitle{color:var(--muted);font-size:12px;margin-top:7px;line-height:1.5}
        .tc-dash-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
        .tc-dash-kpi{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:16px;min-width:0}
        .tc-dash-kpi span,.tc-dash-kpi small{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em}
        .tc-dash-kpi strong{display:block;color:var(--cream);font-family:var(--mono);font-size:21px;margin:8px 0 5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .tc-dash-kpi small{text-transform:none;letter-spacing:0;font-size:10px;line-height:1.4}
        .tc-dash-quality{margin-bottom:16px}
        .tc-dash-quality-card{overflow:hidden}
        .tc-dash-date{font-family:var(--mono);font-size:11px;color:var(--muted);margin-left:auto}
        .tc-dash-quality-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;padding:18px}
        .tc-dash-quality-grid>div{min-width:0}
        .tc-dash-quality-grid span{display:block;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px}
        .tc-dash-quality-grid strong{font-family:var(--mono);font-size:17px;color:var(--cream)}
        .tc-dash-progress-wrap{display:flex;align-items:center;gap:9px;margin:13px 0 10px}
        .tc-dash-progress{height:7px;background:var(--border);border-radius:20px;overflow:hidden;flex:1}
        .tc-dash-progress-fill{height:100%;background:var(--gold);border-radius:20px;transition:width .3s ease}
        .tc-dash-progress-value{font-family:var(--mono);font-size:10px;color:var(--gold);min-width:34px;text-align:right}
        .tc-dash-quality-foot{padding:0 18px 16px;color:var(--muted);font-size:10px}
        .tc-dash-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .tc-dash-section-title{grid-column:1/-1;display:flex;align-items:end;justify-content:space-between;margin:5px 0 2px}
        .tc-dash-section-title span{font-family:var(--serif);font-size:18px;color:var(--cream)}
        .tc-dash-section-title small{color:var(--muted);font-size:10px}
        .tc-dash-section-card{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:15px;min-width:0;transition:border-color .2s,transform .2s}
        .tc-dash-section-card:hover{border-color:rgba(201,166,91,.55);transform:translateY(-1px)}
        .tc-dash-section-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
        .tc-dash-section-name{font-family:var(--serif);font-size:16px;color:var(--cream)}
        .tc-dash-section-meta{font-size:10px;color:var(--muted);margin-top:4px;line-height:1.4}
        .tc-dash-status{font-family:var(--mono);font-size:8px;padding:4px 6px;border:1px solid var(--border);border-radius:3px;white-space:nowrap}
        .tc-dash-status.ok{color:#8fcf9a;border-color:rgba(143,207,154,.35)}
        .tc-dash-status.warn{color:var(--gold);border-color:rgba(201,166,91,.35)}
        .tc-dash-section-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:10px;color:var(--muted)}
        .tc-dash-section-bottom .btn{flex:none}
        .tc-dash-alerts{margin-top:16px}
        .tc-dash-alert-count{margin-left:auto;min-width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:50%;font-family:var(--mono);font-size:10px;color:var(--gold)}
        .tc-dash-alert-list{padding:12px 18px 18px;display:grid;gap:8px}
        .tc-dash-alert{border:1px solid rgba(201,166,91,.28);background:rgba(201,166,91,.05);border-radius:4px;padding:10px 12px;font-size:11px;line-height:1.45;color:var(--cream)}
        .tc-dash-alert.ok-alert{border-color:rgba(143,207,154,.25);background:rgba(143,207,154,.04)}
        .tc-dash-note{margin-top:12px;color:var(--muted);font-size:10px;line-height:1.5}
        @media(max-width:1000px){.tc-dash-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.tc-dash-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:650px){.tc-dash-head{flex-direction:column}.tc-dash-kpis,.tc-dash-grid,.tc-dash-quality-grid{grid-template-columns:1fr}.tc-dash-section-title{display:block}.tc-dash-section-title small{display:block;margin-top:5px}}
    `;document.head.appendChild(s);
}
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');}
function num(v){var n=Number(v);return Number.isFinite(n)?n:null;}
function fmt(v){var n=num(v);return n===null?'—':n.toLocaleString('fr-FR');}
function progress(v){var n=Math.max(0,Math.min(100,Number(v)||0));return '<div class="tc-dash-progress"><div class="tc-dash-progress-fill" style="width:'+n+'%"></div></div><span class="tc-dash-progress-value">'+Math.round(n)+'%</span>';}
function openSection(name){var buttons=document.querySelectorAll('.admin-tab');var btn=null;buttons.forEach(function(b){if(String(b.getAttribute('onclick')||'').indexOf("switchTab('"+name+"'")>=0)btn=b;});if(typeof switchTab==='function')switchTab(name,btn);window.scrollTo({top:0,behavior:'smooth'});}
function sectionCard(s){return '<div class="tc-dash-section-card"><div class="tc-dash-section-top"><div><div class="tc-dash-section-name">'+esc(s.name)+'</div><div class="tc-dash-section-meta">'+esc(s.meta)+'</div></div><span class="tc-dash-status '+(s.ok?'ok':'warn')+'">'+(s.ok?'OPÉRATIONNEL':'À VÉRIFIER')+'</span></div><div class="tc-dash-progress-wrap">'+progress(s.progress)+'</div><div class="tc-dash-section-bottom"><span>'+esc(s.stat)+'</span><button class="btn btn-outline btn-sm" type="button" onclick="openSection(\''+s.id+'\')">Ouvrir →</button></div></div>';}

async function loadDashboardOverview(){
    injectDashboardStyles();
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
    await Promise.all(tables.map(async function(s){counts[s.table]=await sbCount(s.table);}));

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

    document.getElementById('tc-dash-kpis').innerHTML='<div class="tc-dash-kpi"><span>Sections data</span><strong>'+tables.length+'</strong><small>surveillées</small></div><div class="tc-dash-kpi"><span>Dernière séance</span><strong>'+(latestDate||'—')+'</strong><small>'+fmt(latestRows.length)+' titres récupérés</small></div><div class="tc-dash-kpi"><span>Complétude séance</span><strong>'+Math.round(completeness)+'%</strong><small>'+fmt(missing)+' donnée(s) essentielle(s) manquante(s)</small></div><div class="tc-dash-kpi"><span>Qualité technique</span><strong>'+Math.round(quality)+'%</strong><small>'+fmt(ohlc+dup)+' anomalie(s) structurelle(s)</small></div>';

    document.getElementById('tc-dash-quality').innerHTML='<div class="card tc-dash-quality-card"><div class="card-header"><span class="card-title">Qualité de la dernière séance</span><span class="tc-dash-date">'+(latestDate||'Aucune séance')+'</span></div><div class="tc-dash-quality-grid"><div><span>Complétude</span>'+progress(completeness)+'</div><div><span>Cohérence OHLC</span>'+progress(latestRows.length?Math.max(0,100-(ohlc/latestRows.length*100)):0)+'</div><div><span>Doublons détectés</span><strong>'+fmt(dup)+'</strong></div><div><span>Variations inhabituelles</span><strong>'+fmt(extreme)+'</strong></div></div><div class="tc-dash-quality-foot">Mesures uniquement : aucune correction ou suppression automatique.</div></div>';

    var sections=tables.map(function(s){var c=counts[s.table]||0;var stat=fmt(c)+' enregistrement(s)';if(s.id==='cours'&&latestDate)stat=fmt(latestRows.length)+' cours · '+latestDate;return Object.assign({},s,{progress:c>0?100:0,ok:c>0,stat:stat});});
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
    document.getElementById('tc-dash-alerts').innerHTML='<div class="card"><div class="card-header"><span class="card-title">Alertes & points de contrôle</span><span class="tc-dash-alert-count">'+alerts.length+'</span></div><div class="tc-dash-alert-list">'+(alerts.length?alerts.map(function(a){return '<div class="tc-dash-alert">⚠ '+esc(a)+'</div>';}).join(''):'<div class="tc-dash-alert ok-alert">✓ Aucun signal d’alerte détecté sur les contrôles affichés.</div>')+'</div></div>';
}

window.openSection=openSection;
window.loadDashboard=loadDashboardOverview;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(loadDashboardOverview,0);});else setTimeout(loadDashboardOverview,0);
})();
