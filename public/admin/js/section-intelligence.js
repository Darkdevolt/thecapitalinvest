'use strict';

/* Cross-section Admin Intelligence — non destructive UI layer */
(function(){
  function el(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]})}
  function qualityCard(id,title,metrics){
    if(el(id)) return;
    var host=document.querySelector('.tab-panel.active')||document.querySelector('.main'); if(!host)return;
    var card=document.createElement('div'); card.className='card admin-intel-card'; card.id=id;
    card.innerHTML='<div class="card-header"><span class="card-title">'+title+'</span><span class="admin-intel-live">LIVE</span></div><div class="admin-quality-grid">'+metrics.map(function(m){return '<div><strong id="'+m[0]+'">—</strong><span>'+m[1]+'</span></div>'}).join('')+'</div>';
    var first=host.querySelector('.card'); if(first&&first.parentNode) first.parentNode.insertBefore(card,first); else host.appendChild(card);
  }
  function addQualityShells(){
    if(el('panel-entreprises')) qualityCard('ent-quality','Référentiel sociétés',[['ent-q-score','Qualité'],['ent-q-total','Sociétés'],['ent-q-isin','ISIN'],['ent-q-sector','Secteur']]);
    if(el('panel-dividendes')) qualityCard('div-quality','Contrôle dividendes',[['div-q-score','Qualité'],['div-q-total','Lignes'],['div-q-paid','Payés'],['div-q-future','À venir']]);
    if(el('panel-analyses')) qualityCard('an-quality','Contrôle éditorial',[['an-q-score','Prêtes'],['an-q-ready','Complètes'],['an-q-total','Total'],['an-q-missing','À compléter']]);
    if(el('panel-indices')) qualityCard('idx-quality','Contrôle indices',[['idx-q-score','Qualité'],['idx-q-total','Observations'],['idx-q-invalid','Invalides'],['idx-q-future','Dates futures']]);
    if(el('panel-scraper')) qualityCard('scraper-quality','Monitoring ingestion',[['scraper-q-status','Statut'],['scraper-q-time','Dernier run'],['scraper-q-errors','Erreurs'],['scraper-q-rows','Lignes']]);
    if(el('panel-import')) qualityCard('import-quality','Contrôle avant import',[['import-q-status','Statut'],['import-q-rows','Lignes'],['import-q-errors','Erreurs'],['import-q-warnings','Alertes']]);
  }
  function update(){
    addQualityShells();
    if(typeof entData!=='undefined'){var d=entData||[],a=d.filter(function(r){return r.actif!==false}).length,i=d.filter(function(r){return !!r.isin}).length,s=d.filter(function(r){return !!r.secteur}).length,score=d.length?Math.round((a+i+s)/(d.length*3)*100):0; if(el('ent-q-score'))el('ent-q-score').textContent=score+'/100';if(el('ent-q-total'))el('ent-q-total').textContent=d.length;if(el('ent-q-isin'))el('ent-q-isin').textContent=i;if(el('ent-q-sector'))el('ent-q-sector').textContent=s;}
    if(typeof divData!=='undefined'){var d2=divData||[],now=new Date(),future=d2.filter(function(r){return r.date_paiement&&new Date(r.date_paiement)>now}).length,paid=d2.filter(function(r){return String(r.statut||'').toLowerCase()==='payé'}).length,bad=d2.filter(function(r){return !r.ticker||!r.annee||r.montant==null||Number(r.montant)<0}).length,score2=d2.length?Math.max(0,Math.round(100-bad/d2.length*100)):0;if(el('div-q-score'))el('div-q-score').textContent=score2+'/100';if(el('div-q-total'))el('div-q-total').textContent=d2.length;if(el('div-q-paid'))el('div-q-paid').textContent=paid;if(el('div-q-future'))el('div-q-future').textContent=future;}
    if(typeof anData!=='undefined'){var d3=anData||[],ready=d3.filter(function(r){return r.titre&&r.analyste&&r.commentaire&&r.cours_cible!=null}).length,score3=d3.length?Math.round(ready/d3.length*100):0;if(el('an-q-score'))el('an-q-score').textContent=score3+'/100';if(el('an-q-ready'))el('an-q-ready').textContent=ready;if(el('an-q-total'))el('an-q-total').textContent=d3.length;if(el('an-q-missing'))el('an-q-missing').textContent=d3.length-ready;}
    if(typeof idxData!=='undefined'){var d4=idxData||[],inv=d4.filter(function(r){return r.valeur==null||Number(r.valeur)<0}).length,fu=d4.filter(function(r){return r.date_seance&&new Date(r.date_seance)>new Date()}).length,score4=d4.length?Math.max(0,Math.round(100-(inv+fu)/d4.length*100)):0;if(el('idx-q-score'))el('idx-q-score').textContent=score4+'/100';if(el('idx-q-total'))el('idx-q-total').textContent=d4.length;if(el('idx-q-invalid'))el('idx-q-invalid').textContent=inv;if(el('idx-q-future'))el('idx-q-future').textContent=fu;}
    if(el('scraper-q-status'))el('scraper-q-status').textContent=el('scraper-msg')&&el('scraper-msg').textContent?el('scraper-msg').textContent:'Prêt';
    if(el('import-q-status'))el('import-q-status').textContent=el('import-msg')&&el('import-msg').textContent?el('import-msg').textContent:'En attente';
    if(typeof currentUpload!=='undefined'){var rows=(currentUpload.data||[]).length;if(el('import-q-rows'))el('import-q-rows').textContent=rows;if(el('import-q-errors'))el('import-q-errors').textContent='—';if(el('import-q-warnings'))el('import-q-warnings').textContent='—';}
  }
  window.refreshSectionIntelligence=update;
  document.addEventListener('DOMContentLoaded',function(){setTimeout(update,300);setInterval(update,3000);});
})();
