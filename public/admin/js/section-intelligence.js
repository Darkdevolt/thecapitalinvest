'use strict';

/* ADMIN ONLY — intelligence layer for public/admin.html */
(function(){
  var SECTIONS={
    cours:{title:'Contrôle marché — Cours',metrics:[['cours-q-score','Qualité'],['cours-q-total','Lignes'],['cours-q-dup','Doublons'],['cours-q-future','Dates futures']]},
    historique:{title:'Contrôle marché — Historique',metrics:[['hist-q-score','Qualité'],['hist-q-total','Lignes'],['hist-q-dup','Doublons'],['hist-q-missing','Données manquantes']]},
    entreprises:{title:'Référentiel sociétés',metrics:[['ent-q-score','Qualité'],['ent-q-total','Sociétés'],['ent-q-isin','ISIN'],['ent-q-sector','Secteurs']]},
    financials:{title:'Financial Data Control',metrics:[['fin-q-score','Qualité'],['fin-q-total','Lignes'],['fin-q-valid','Validées'],['fin-q-source','Sources']]},
    dividendes:{title:'Contrôle dividendes',metrics:[['div-q-score','Qualité'],['div-q-total','Lignes'],['div-q-paid','Payés'],['div-q-future','À venir']]},
    analyses:{title:'Contrôle éditorial',metrics:[['an-q-score','Prêtes'],['an-q-ready','Complètes'],['an-q-total','Total'],['an-q-missing','À compléter']]},
    utilisateurs:{title:'Contrôle utilisateurs',metrics:[['usr-q-score','Qualité'],['usr-q-total','Comptes'],['usr-q-active','Actifs'],['usr-q-admin','Admins']]},
    indices:{title:'Contrôle indices',metrics:[['idx-q-score','Qualité'],['idx-q-total','Observations'],['idx-q-invalid','Invalides'],['idx-q-future','Dates futures']]},
    scraper:{title:'Monitoring ingestion',metrics:[['scraper-q-status','Statut'],['scraper-q-time','Dernier run'],['scraper-q-errors','Erreurs'],['scraper-q-rows','Lignes']]},
    import:{title:'Contrôle avant import',metrics:[['import-q-status','Statut'],['import-q-rows','Lignes'],['import-q-errors','Erreurs'],['import-q-warnings','Alertes']]},
    diagnostic:{title:'Centre de résolution',metrics:[['diag-q-score','Score'],['diag-q-errors','Erreurs'],['diag-q-warnings','Alertes'],['diag-q-checked','Contrôles']]}
  };
  function el(id){return document.getElementById(id)}
  function panel(name){return el('panel-'+name)}
  function set(id,value){var x=el(id);if(x)x.textContent=value==null?'—':value}
  function score(total,bad){return total?Math.max(0,Math.round(100-(bad/total*100))):0}
  function addCard(name){var p=panel(name),cfg=SECTIONS[name];if(!p||!cfg||el('intel-'+name))return;var c=document.createElement('div');c.className='card admin-intel-card';c.id='intel-'+name;c.style.cssText='background:var(--card);border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:16px';c.innerHTML='<div class="card-header"><span class="card-title">'+cfg.title+'</span><span style="margin-left:auto;font:10px var(--mono);color:var(--green);letter-spacing:.08em">ADMIN CONTROL</span></div><div style="display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:1px;background:var(--border)">'+cfg.metrics.map(function(m){return'<div style="padding:16px;background:var(--card);min-width:0"><strong id="'+m[0]+'" style="display:block;font:18px var(--mono);color:var(--gold);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">—</strong><span style="display:block;margin-top:5px;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">'+m[1]+'</span></div>'}).join('')+'</div>';var h=p.querySelector('.section-header');if(h&&h.nextSibling)p.insertBefore(c,h.nextSibling);else p.insertBefore(c,p.firstChild)}
  function addAll(){Object.keys(SECTIONS).forEach(addCard)}
  function update(){if(!el('app-wrapper')||!document.querySelector('.admin-nav'))return;addAll();
    if(typeof coursData!=='undefined'){var c=coursData||[],keys={},dup=0,missing=0; c.forEach(function(r){var k=(r.ticker||'')+'|'+(r.date_seance||'');if(keys[k])dup++;keys[k]=1;if(!r.ticker||r.cours==null)missing++});var fut=c.filter(function(r){return r.date_seance&&new Date(r.date_seance)>new Date()}).length;set('cours-q-score',score(c.length,dup+fut+missing)+'/100');set('cours-q-total',c.length);set('cours-q-dup',dup);set('cours-q-future',fut)}
    if(typeof histData!=='undefined'){var h=histData||[],keys2={},dup2=0,miss2=0;h.forEach(function(r){var k=(r.ticker||'')+'|'+(r.date_seance||'');if(keys2[k])dup2++;keys2[k]=1;if(!r.ticker||r.cours_cloture==null)miss2++});set('hist-q-score',score(h.length,dup2+miss2)+'/100');set('hist-q-total',h.length);set('hist-q-dup',dup2);set('hist-q-missing',miss2)}
    if(typeof entData!=='undefined'){var e=entData||[],bad=e.filter(function(r){return r.actif===false||!r.isin||!r.secteur}).length;set('ent-q-score',score(e.length,bad)+'/100');set('ent-q-total',e.length);set('ent-q-isin',e.filter(function(r){return!!r.isin}).length);set('ent-q-sector',e.filter(function(r){return!!r.secteur}).length)}
    if(typeof finData!=='undefined'){var f=finData||[],badf=f.filter(function(r){return!r.ticker||r.periode==null||r.statut==='rejected'}).length,valid=f.filter(function(r){return r.statut==='validated'||r.valide===true}).length,sources=f.filter(function(r){return!!(r.source||r.source_document||r.source_url)}).length;set('fin-q-score',score(f.length,badf)+'/100');set('fin-q-total',f.length);set('fin-q-valid',valid);set('fin-q-source',sources)}
    if(typeof divData!=='undefined'){var d=divData||[],bad2=d.filter(function(r){return!r.ticker||!r.annee||r.montant==null||Number(r.montant)<0}).length,now=new Date();set('div-q-score',score(d.length,bad2)+'/100');set('div-q-total',d.length);set('div-q-paid',d.filter(function(r){return String(r.statut||'').toLowerCase()==='payé'}).length);set('div-q-future',d.filter(function(r){return r.date_paiement&&new Date(r.date_paiement)>now}).length)}
    if(typeof anData!=='undefined'){var a=anData||[],ready=a.filter(function(r){return r.titre&&r.analyste&&r.commentaire&&r.cours_cible!=null}).length;set('an-q-score',a.length?Math.round(ready/a.length*100)+'/100':'—');set('an-q-ready',ready);set('an-q-total',a.length);set('an-q-missing',a.length-ready)}
    if(typeof usrData!=='undefined'){var u=usrData||[],active=u.filter(function(r){return r.actif!==false}).length,admins=u.filter(function(r){return r.is_admin===true}).length,badU=u.filter(function(r){return!r.email}).length;set('usr-q-score',score(u.length,badU)+'/100');set('usr-q-total',u.length);set('usr-q-active',active);set('usr-q-admin',admins)}
    if(typeof idxData!=='undefined'){var ix=idxData||[],bad3=ix.filter(function(r){return r.valeur==null||Number(r.valeur)<0||(r.date_seance&&new Date(r.date_seance)>new Date())}).length;set('idx-q-score',score(ix.length,bad3)+'/100');set('idx-q-total',ix.length);set('idx-q-invalid',ix.filter(function(r){return r.valeur==null||Number(r.valeur)<0}).length);set('idx-q-future',ix.filter(function(r){return r.date_seance&&new Date(r.date_seance)>new Date()}).length)}
    var sm=el('scraper-msg');set('scraper-q-status',sm&&sm.textContent?sm.textContent:'Prêt');set('scraper-q-time',window.__tcLastScraperRun||'—');set('scraper-q-errors',window.__tcScraperErrors||0);set('scraper-q-rows',window.__tcScraperRows||'—');
    var im=el('import-msg');set('import-q-status',im&&im.textContent?im.textContent:'En attente');var up=window.currentUpload;set('import-q-rows',up&&up.data?up.data.length:0);set('import-q-errors',window.__tcImportErrors||0);set('import-q-warnings',window.__tcImportWarnings||0);
    if(typeof diagData!=='undefined'&&diagData){var er=Number(diagData.errors||diagData.errorCount||0),wa=Number(diagData.warnings||diagData.warningCount||0),ch=Number(diagData.checked||diagData.totalChecks||0),den=Math.max(1,er+wa+ch);set('diag-q-score',Math.max(0,Math.round(ch/den*100))+'/100');set('diag-q-errors',er);set('diag-q-warnings',wa);set('diag-q-checked',ch)}
  }
  window.refreshSectionIntelligence=update;
  window.tcMarkScraperRun=function(rows,errors){window.__tcLastScraperRun=new Date().toLocaleString('fr-FR');window.__tcScraperRows=rows==null?'—':rows;window.__tcScraperErrors=errors||0;update()};
  window.tcMarkImport=function(errors,warnings){window.__tcImportErrors=errors||0;window.__tcImportWarnings=warnings||0;update()};
  document.addEventListener('DOMContentLoaded',function(){setTimeout(update,400);setInterval(update,3000)});
})();
