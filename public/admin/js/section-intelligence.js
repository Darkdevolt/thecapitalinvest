'use strict';

/*
 * ADMIN ONLY — Section Intelligence
 * This file is loaded exclusively by public/admin/js/main.js.
 * It never mounts UI outside the authenticated admin page.
 */
(function(){
  var SECTIONS = {
    entreprises:{title:'Référentiel sociétés',metrics:[['ent-q-score','Qualité'],['ent-q-total','Sociétés'],['ent-q-isin','ISIN'],['ent-q-sector','Secteurs']]},
    financials:{title:'Financial Data Control',metrics:[['fin-q-score','Qualité'],['fin-q-total','Lignes'],['fin-q-valid','Validées'],['fin-q-source','Sources']]},
    dividendes:{title:'Contrôle dividendes',metrics:[['div-q-score','Qualité'],['div-q-total','Lignes'],['div-q-paid','Payés'],['div-q-future','À venir']]},
    analyses:{title:'Contrôle éditorial',metrics:[['an-q-score','Prêtes'],['an-q-ready','Complètes'],['an-q-total','Total'],['an-q-missing','À compléter']]},
    indices:{title:'Contrôle indices',metrics:[['idx-q-score','Qualité'],['idx-q-total','Observations'],['idx-q-invalid','Invalides'],['idx-q-future','Dates futures']]},
    scraper:{title:'Monitoring ingestion',metrics:[['scraper-q-status','Statut'],['scraper-q-time','Dernier run'],['scraper-q-errors','Erreurs'],['scraper-q-rows','Lignes']]},
    import:{title:'Contrôle avant import',metrics:[['import-q-status','Statut'],['import-q-rows','Lignes'],['import-q-errors','Erreurs'],['import-q-warnings','Alertes']]},
    diagnostic:{title:'Centre de résolution',metrics:[['diag-q-score','Score'],['diag-q-errors','Erreurs'],['diag-q-warnings','Alertes'],['diag-q-checked','Contrôles']]}
  };
  function el(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]})}
  function panel(name){return el('panel-'+name)}
  function card(name){return el('intel-'+name)}
  function qualityCard(name){
    var p=panel(name), cfg=SECTIONS[name]; if(!p||!cfg||card(name))return;
    var c=document.createElement('div'); c.className='card admin-intel-card'; c.id='intel-'+name;
    c.style.cssText='background:var(--card);border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:16px;';
    c.innerHTML='<div class="card-header"><span class="card-title">'+cfg.title+'</span><span style="margin-left:auto;font:10px var(--mono);color:var(--green);letter-spacing:.08em">ADMIN CONTROL</span></div>'+
      '<div style="display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:1px;background:var(--border);">'+cfg.metrics.map(function(m){return '<div style="padding:16px;background:var(--card);min-width:0"><strong id="'+m[0]+'" style="display:block;font:18px var(--mono);color:var(--gold);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">—</strong><span style="display:block;margin-top:5px;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">'+m[1]+'</span></div>';}).join('')+'</div>';
    var header=p.querySelector('.section-header'); if(header&&header.nextSibling) p.insertBefore(c,header.nextSibling); else p.insertBefore(c,p.firstChild);
  }
  function addAll(){Object.keys(SECTIONS).forEach(qualityCard);}
  function set(id,value){var x=el(id);if(x)x.textContent=value==null?'—':value;}
  function scoreParts(total,bad){return total?Math.max(0,Math.round(100-(bad/total*100))):0}
  function update(){
    /* Never render unless the admin shell exists and has authenticated the page. */
    if(!el('app-wrapper')||!document.querySelector('.admin-nav'))return;
    addAll();
    if(typeof entData!=='undefined'){var d=entData||[],bad=d.filter(function(r){return r.actif===false||!r.isin||!r.secteur}).length;set('ent-q-score',scoreParts(d.length,bad)+'/100');set('ent-q-total',d.length);set('ent-q-isin',d.filter(function(r){return !!r.isin}).length);set('ent-q-sector',d.filter(function(r){return !!r.secteur}).length);}
    if(typeof finData!=='undefined'){var f=finData||[],badf=f.filter(function(r){return !r.ticker||r.periode==null||r.statut==='rejected'}).length,valid=f.filter(function(r){return r.statut==='validated'||r.valide===true}).length,sources=f.filter(function(r){return !!(r.source||r.source_document||r.source_url)}).length;set('fin-q-score',scoreParts(f.length,badf)+'/100');set('fin-q-total',f.length);set('fin-q-valid',valid);set('fin-q-source',sources);}
    if(typeof divData!=='undefined'){var d2=divData||[],bad2=d2.filter(function(r){return !r.ticker||!r.annee||r.montant==null||Number(r.montant)<0}).length,now=new Date();set('div-q-score',scoreParts(d2.length,bad2)+'/100');set('div-q-total',d2.length);set('div-q-paid',d2.filter(function(r){return String(r.statut||'').toLowerCase()==='payé'}).length);set('div-q-future',d2.filter(function(r){return r.date_paiement&&new Date(r.date_paiement)>now}).length);}
    if(typeof anData!=='undefined'){var a=anData||[],ready=a.filter(function(r){return r.titre&&r.analyste&&r.commentaire&&r.cours_cible!=null}).length;set('an-q-score',a.length?Math.round(ready/a.length*100)+'/100':'—');set('an-q-ready',ready);set('an-q-total',a.length);set('an-q-missing',a.length-ready);}
    if(typeof idxData!=='undefined'){var ix=idxData||[],bad3=ix.filter(function(r){return r.valeur==null||Number(r.valeur)<0||(r.date_seance&&new Date(r.date_seance)>new Date())}).length;set('idx-q-score',scoreParts(ix.length,bad3)+'/100');set('idx-q-total',ix.length);set('idx-q-invalid',ix.filter(function(r){return r.valeur==null||Number(r.valeur)<0}).length);set('idx-q-future',ix.filter(function(r){return r.date_seance&&new Date(r.date_seance)>new Date()}).length);}
    var sm=el('scraper-msg');set('scraper-q-status',sm&&sm.textContent?sm.textContent:'Prêt');set('scraper-q-time',window.__tcLastScraperRun||'—');set('scraper-q-errors',window.__tcScraperErrors||0);set('scraper-q-rows',window.__tcScraperRows||'—');
    var im=el('import-msg');set('import-q-status',im&&im.textContent?im.textContent:'En attente');var upload=window.currentUpload;var rows=upload&&upload.data?upload.data.length:0;set('import-q-rows',rows);set('import-q-errors',window.__tcImportErrors||0);set('import-q-warnings',window.__tcImportWarnings||0);
    if(typeof diagData!=='undefined'&&diagData){var issues=diagData.errors||diagData.errorCount||0,warns=diagData.warnings||diagData.warningCount||0,checked=diagData.checked||diagData.totalChecks||0,total=Math.max(1,Number(issues)+Number(warns)+Number(checked));set('diag-q-score',Math.max(0,Math.round((Number(checked)/total)*100))+'/100');set('diag-q-errors',issues);set('diag-q-warnings',warns);set('diag-q-checked',checked);}
  }
  window.refreshSectionIntelligence=update;
  window.tcMarkScraperRun=function(rows,errors){window.__tcLastScraperRun=new Date().toLocaleString('fr-FR');window.__tcScraperRows=rows==null?'—':rows;window.__tcScraperErrors=errors||0;update();};
  window.tcMarkImport=function(errors,warnings){window.__tcImportErrors=errors||0;window.__tcImportWarnings=warnings||0;update();};
  document.addEventListener('DOMContentLoaded',function(){setTimeout(update,400);setInterval(update,3000);});
})();
