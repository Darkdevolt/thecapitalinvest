/* THE CAPITAL — Contrôle opérationnel Cours / Historique
   Édition directe + contrôles de cohérence.
   Portée STRICTE : cours et historique Admin uniquement.
*/
(function(){
  'use strict';

  var STYLE='tc-control-editor-css-v2';
  var MODAL='tc-control-editor-modal';
  var TABLES=['cours-tbody','hist-tbody'];
  var bound=false;

  function headers(extra){
    var h={apikey:SB_ANON,Authorization:'Bearer '+TK,Accept:'application/json','Content-Type':'application/json'};
    if(extra) Object.keys(extra).forEach(function(k){h[k]=extra[k]});
    return h;
  }

  function num(v){
    if(v===null||v===undefined||v==='') return null;
    var n=Number(String(v).replace(/\s/g,'').replace(',','.'));
    return Number.isFinite(n)?n:null;
  }

  function esc(v){
    return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  async function request(path,opt){
    var r=await fetch(SB_REST+path,Object.assign({headers:headers()},opt||{}));
    var text=await r.text();
    if(!r.ok) throw Error('HTTP '+r.status+' — '+text.slice(0,300));
    if(!text) return [];
    try{return JSON.parse(text)}catch(e){return []}
  }

  async function findRows(ticker,date){
    return request('/historique?select=id,ticker,date_seance,cours_cloture,cours_ouverture,plus_haut,plus_bas,volume,variation,valeur_totale,plus_haut_52,plus_bas_52&ticker=eq.'+encodeURIComponent(ticker)+'&date_seance=eq.'+encodeURIComponent(date)+'&order=id.desc&limit=20');
  }

  function ensureCss(){
    if(document.getElementById(STYLE)) return;
    var s=document.createElement('style'); s.id=STYLE;
    s.textContent=''+
      '.tc-control-edit{border:1px solid rgba(184,150,78,.48);background:rgba(184,150,78,.08);color:#d8bd78;border-radius:5px;padding:5px 9px;font:500 10px var(--mono,monospace);cursor:pointer;white-space:nowrap}.tc-control-edit:hover{background:rgba(184,150,78,.18);border-color:#b8964e}'+
      '.tc-control-modal{position:fixed;inset:0;z-index:11000;display:grid;place-items:center;padding:18px}.tc-control-modal-back{position:absolute;inset:0;background:rgba(5,4,3,.78);backdrop-filter:blur(4px)}'+
      '.tc-control-dialog{position:relative;width:min(780px,96vw);max-height:92vh;overflow:auto;background:#15110d;color:#f5f0e8;border:1px solid rgba(184,150,78,.45);border-radius:10px;box-shadow:0 28px 90px rgba(0,0,0,.62)}'+
      '.tc-control-head{display:flex;align-items:center;justify-content:space-between;padding:17px 20px;border-bottom:1px solid rgba(184,150,78,.18)}.tc-control-eyebrow{font:500 10px var(--mono,monospace);letter-spacing:.12em;color:#b8964e}.tc-control-title{font-size:17px;font-weight:600;margin-top:4px}.tc-control-meta{font:10px var(--mono,monospace);color:#8f8a82;margin-top:5px}.tc-control-close{border:0;background:none;color:#aaa;font-size:24px;cursor:pointer}'+
      '.tc-control-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:20px}.tc-control-field{display:grid;gap:6px;font:500 10px var(--mono,monospace);color:#aaa}.tc-control-field input{width:100%;box-sizing:border-box;padding:9px 10px;border-radius:6px;border:1px solid rgba(184,150,78,.2);background:#0d0b09;color:#f5f0e8}.tc-control-field input:focus{outline:none;border-color:#b8964e;box-shadow:0 0 0 2px rgba(184,150,78,.1)}'+
      '.tc-control-checks{grid-column:1/-1;border:1px solid rgba(184,150,78,.16);border-radius:7px;padding:10px 12px;font-size:11px;line-height:1.55}.tc-control-check{display:flex;gap:8px;align-items:flex-start;margin:4px 0}.tc-control-check.ok{color:#9bc7a0}.tc-control-check.warn{color:#d8bd78}.tc-control-check.err{color:#e58d84}'+
      '.tc-control-actions{grid-column:1/-1;display:flex;align-items:center;gap:8px;padding-top:10px;border-top:1px solid rgba(184,150,78,.15)}.tc-control-msg{flex:1;color:#b8964e;font-size:11px;line-height:1.45}.tc-control-save{border:1px solid #b8964e;background:#b8964e;color:#17110d;border-radius:6px;padding:9px 14px;font-weight:700;cursor:pointer}.tc-control-save:disabled{opacity:.55;cursor:not-allowed}.tc-control-cancel{border:1px solid rgba(184,150,78,.3);background:transparent;color:#ddd;border-radius:6px;padding:9px 14px;cursor:pointer}'+
      '@media(max-width:700px){.tc-control-form{grid-template-columns:1fr 1fr}}@media(max-width:460px){.tc-control-form{grid-template-columns:1fr}.tc-control-dialog{width:98vw}.tc-control-actions{flex-wrap:wrap}}';
    document.head.appendChild(s);
  }

  function getCellText(tr,index){
    var c=tr.children[index]; return c ? (c.textContent||'').replace(/\s+/g,' ').trim() : '';
  }

  function rowIdentity(tr,type){
    var ticker,date;
    if(type==='cours'){
      ticker=getCellText(tr,1); date=getCellText(tr,2);
    }else{
      ticker=getCellText(tr,1); date=getCellText(tr,2);
    }
    return {ticker:ticker,date:date};
  }

  function addButton(tr,type){
    if(tr.querySelector('.tc-control-edit')) return;
    var id=rowIdentity(tr,type);
    if(!id.ticker || !/^\d{4}-\d{2}-\d{2}$/.test(id.date)) return;
    var cells=tr.children;
    var action=cells[cells.length-1];
    var b=document.createElement('button');
    b.type='button'; b.className='tc-control-edit'; b.textContent='Modifier'; b.title='Modifier et contrôler cette donnée';
    b.dataset.ticker=id.ticker; b.dataset.date=id.date;
    b.onclick=function(){openEditor(id.ticker,id.date,type)};
    if(action && (action.querySelector('button') || cells.length>=10)) action.appendChild(b); else {var td=document.createElement('td');td.appendChild(b);tr.appendChild(td)}
  }

  function bindTable(tbody,type){
    if(!tbody) return;
    Array.prototype.forEach.call(tbody.querySelectorAll('tr'),function(tr){addButton(tr,type)});
  }

  function bind(){
    bindTable(document.getElementById('cours-tbody'),'cours');
    bindTable(document.getElementById('hist-tbody'),'historique');
  }

  function close(){var m=document.getElementById(MODAL);if(m)m.remove()}

  function makeField(label,name,type,value,required){
    return '<label class="tc-control-field">'+esc(label)+(required?' *':'')+'<input name="'+esc(name)+'" type="'+type+'" '+(required?'required ':'')+'step="any" value="'+esc(value==null?'':value)+'"></label>';
  }

  function validation(d,previous,duplicates){
    var checks=[];
    if(d.cours_cloture==null || d.cours_cloture<0) checks.push({c:'err',t:'Clôture obligatoire et non négative.'}); else checks.push({c:'ok',t:'Clôture valide.'});
    if(d.cours_ouverture!=null && d.cours_ouverture<0) checks.push({c:'err',t:'Ouverture négative.'});
    if(d.plus_bas!=null && d.plus_bas<0) checks.push({c:'err',t:'Plus bas négatif.'});
    if(d.plus_haut!=null && d.plus_haut<0) checks.push({c:'err',t:'Plus haut négatif.'});
    if(d.plus_bas!=null && d.plus_haut!=null && d.plus_bas>d.plus_haut) checks.push({c:'err',t:'Plus bas supérieur au plus haut.'});
    if(d.cours_ouverture!=null && d.plus_haut!=null && d.cours_ouverture>d.plus_haut) checks.push({c:'err',t:'Ouverture supérieure au plus haut.'});
    if(d.cours_ouverture!=null && d.plus_bas!=null && d.cours_ouverture<d.plus_bas) checks.push({c:'err',t:'Ouverture inférieure au plus bas.'});
    if(d.cours_cloture!=null && d.plus_haut!=null && d.cours_cloture>d.plus_haut) checks.push({c:'err',t:'Clôture supérieure au plus haut.'});
    if(d.cours_cloture!=null && d.plus_bas!=null && d.cours_cloture<d.plus_bas) checks.push({c:'err',t:'Clôture inférieure au plus bas.'});
    if(d.volume!=null && (d.volume<0 || !Number.isInteger(d.volume))) checks.push({c:'err',t:'Volume invalide : entier positif attendu.'});
    if(d.variation!=null && Math.abs(d.variation)>7.5) checks.push({c:'warn',t:'Variation hors bande opérationnelle ±7,5 % : vérification manuelle requise.'});
    if(previous && previous.cours_cloture>0 && d.variation!=null){
      var calc=((d.cours_cloture-previous.cours_cloture)/previous.cours_cloture)*100;
      if(Math.abs(calc-d.variation)>0.15) checks.push({c:'warn',t:'Variation ≠ variation calculée depuis la clôture précédente ('+calc.toFixed(2)+' %).'}); else checks.push({c:'ok',t:'Variation cohérente avec la clôture précédente.'});
    }
    if(duplicates>1) checks.push({c:'err',t:'Doublon détecté pour le couple ticker/date : '+duplicates+' lignes.'});
    if(/^\d{4}-\d{2}-\d{2}$/.test(d.date_seance)){
      var day=new Date(d.date_seance+'T00:00:00').getDay();
      if(day===0||day===6) checks.push({c:'warn',t:'Date de séance située un week-end.'});
    }
    if(!checks.some(function(x){return x.c==='err'})) checks.push({c:'ok',t:'Aucune incohérence bloquante détectée.'});
    return checks;
  }

  async function openEditor(ticker,date,type){
    ensureCss(); close();
    var m=document.createElement('div'); m.id=MODAL; m.className='tc-control-modal';
    m.innerHTML='<div class="tc-control-modal-back"></div><div class="tc-control-dialog"><div class="tc-control-head"><div><div class="tc-control-eyebrow">THE CAPITAL · '+(type==='cours'?'COURS PAV':'ARCHIVE HISTORIQUE')+'</div><div class="tc-control-title">Contrôle et modification</div><div class="tc-control-meta">'+esc(ticker)+' · '+esc(date)+'</div></div><button class="tc-control-close" type="button">×</button></div><form class="tc-control-form">'+
      makeField('Ticker','ticker','text',ticker,true)+makeField('Date séance','date_seance','date',date,true)+makeField('Clôture','cours_cloture','number','',true)+makeField('Ouverture','cours_ouverture','number','',false)+makeField('Plus haut','plus_haut','number','',false)+makeField('Plus bas','plus_bas','number','',false)+makeField('Volume','volume','number','',false)+makeField('Variation %','variation','number','',false)+makeField('Valeur totale','valeur_totale','number','',false)+
      '<div class="tc-control-checks"><strong>Contrôle opérationnel</strong><div class="tc-control-check">Chargement des contrôles…</div></div><div class="tc-control-actions"><span class="tc-control-msg"></span><button type="button" class="tc-control-cancel">Annuler</button><button type="submit" class="tc-control-save">Enregistrer</button></div></form></div>';
    document.body.appendChild(m);
    var form=m.querySelector('form'), checksBox=m.querySelector('.tc-control-checks'), msg=m.querySelector('.tc-control-msg'), save=m.querySelector('.tc-control-save');
    m.querySelector('.tc-control-close').onclick=close; m.querySelector('.tc-control-cancel').onclick=close; m.querySelector('.tc-control-modal-back').onclick=close;
    try{
      var rows=await findRows(ticker,date);
      if(!rows.length) throw Error('Ligne introuvable. Rechargez le tableau puis réessayez.');
      var r=rows[0];
      Object.keys(r).forEach(function(k){var el=form.elements[k];if(el)el.value=r[k]==null?'':(k==='date_seance'?String(r[k]).slice(0,10):r[k])});
      var prevRows=await request('/historique?select=cours_cloture,date_seance&ticker=eq.'+encodeURIComponent(r.ticker)+'&date_seance=lt.'+encodeURIComponent(r.date_seance)+'&order=date_seance.desc&limit=1');
      var previous=prevRows[0]||null;
      var checks=validation(readForm(form),previous,rows.length);
      checksBox.innerHTML='<strong>Contrôle opérationnel</strong>'+checks.map(function(x){return '<div class="tc-control-check '+x.c+'">'+(x.c==='ok'?'✓':x.c==='warn'?'⚠':'✕')+' '+esc(x.t)+'</div>'}).join('');
      form.oninput=function(){var c=validation(readForm(form),previous,rows.length);checksBox.innerHTML='<strong>Contrôle opérationnel</strong>'+c.map(function(x){return '<div class="tc-control-check '+x.c+'">'+(x.c==='ok'?'✓':x.c==='warn'?'⚠':'✕')+' '+esc(x.t)+'</div>'}).join('')};
      form.onsubmit=async function(e){e.preventDefault();var d=readForm(form),c=validation(d,previous,rows.length),blocking=c.some(function(x){return x.c==='err'});if(blocking){msg.textContent='Correction requise avant enregistrement.';return}save.disabled=true;msg.textContent='Enregistrement…';try{var body={ticker:d.ticker,date_seance:d.date_seance,cours_cloture:d.cours_cloture,cours_ouverture:d.cours_ouverture,plus_haut:d.plus_haut,plus_bas:d.plus_bas,volume:d.volume,variation:d.variation,valeur_totale:d.valeur_totale};await request('/historique?id=eq.'+encodeURIComponent(r.id),{method:'PATCH',headers:headers({Prefer:'return=representation'}),body:JSON.stringify(body)});msg.textContent='✓ Modification enregistrée';setTimeout(function(){close();if(typeof loadCours==='function'&&type==='cours')loadCours();if(typeof loadHistoriqueTicker==='function'&&type==='historique')loadHistoriqueTicker();if(window.CoursControl&&typeof CoursControl.refresh==='function')CoursControl.refresh()},350)}catch(e){save.disabled=false;msg.textContent='Erreur : '+e.message}};
    }catch(e){checksBox.innerHTML='<strong>Contrôle opérationnel</strong><div class="tc-control-check err">✕ '+esc(e.message)+'</div>';save.disabled=true;msg.textContent='Impossible de charger la donnée.'}
  }

  function readForm(form){
    var d={};
    ['ticker','date_seance','cours_cloture','cours_ouverture','plus_haut','plus_bas','volume','variation','valeur_totale'].forEach(function(k){var v=form.elements[k].value;d[k]=k==='ticker'?v.trim().toUpperCase():(k==='date_seance'?v:num(v))});
    return d;
  }

  function init(){
    ensureCss();
    if(bound) return; bound=true;
    var observer=new MutationObserver(function(){bind()});
    observer.observe(document.body,{childList:true,subtree:true});
    bind();
    setInterval(bind,1000);
  }

  window.CoursControlEditor={open:openEditor,refresh:bind};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
