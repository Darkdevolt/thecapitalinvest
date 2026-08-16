/* THE CAPITAL — Editeur opérationnel Cours / Historique
 * Variation = clôture actuelle vs dernière clôture connue.
 * La variation n'est jamais saisie manuellement et n'est pas calculée
 * depuis l'ouverture. Le trigger Supabase existant reste la source finale.
 * Les champs 52 semaines sont volontairement absents de cet éditeur.
 */
(function(){
  'use strict';
  var STYLE='tc-control-editor-css-v3';
  var MODAL='tc-control-editor-modal';
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
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');}
  async function request(path,opt){
    var r=await fetch(SB_REST+path,Object.assign({headers:headers()},opt||{}));
    var text=await r.text();
    if(!r.ok) throw Error('HTTP '+r.status+' — '+text.slice(0,300));
    if(!text) return [];
    try{return JSON.parse(text)}catch(e){return []}
  }
  async function findRows(ticker,date){
    return request('/historique?select=id,ticker,date_seance,cours_cloture,cours_ouverture,plus_haut,plus_bas,volume,variation,valeur_totale,variation_pct&ticker=eq.'+encodeURIComponent(ticker)+'&date_seance=eq.'+encodeURIComponent(date)+'&order=id.desc&limit=20');
  }
  async function previousClose(ticker,date){
    var rows=await request('/historique?select=cours_cloture,date_seance&ticker=eq.'+encodeURIComponent(ticker)+'&date_seance=lt.'+encodeURIComponent(date)+'&order=date_seance.desc,id.desc&limit=1');
    return rows[0]||null;
  }
  function ensureCss(){
    if(document.getElementById(STYLE)) return;
    var s=document.createElement('style'); s.id=STYLE;
    s.textContent=''+
      '.tc-control-edit,.tc-control-delete{border:1px solid rgba(184,150,78,.48);background:rgba(184,150,78,.08);color:#d8bd78;border-radius:5px;padding:5px 9px;font:500 10px var(--mono,monospace);cursor:pointer;white-space:nowrap;margin-left:5px}.tc-control-edit:hover{background:rgba(184,150,78,.18)}.tc-control-delete{border-color:rgba(210,100,90,.48);background:rgba(210,100,90,.07);color:#e58d84}.tc-control-modal{position:fixed;inset:0;z-index:11000;display:grid;place-items:center;padding:18px}.tc-control-modal-back{position:absolute;inset:0;background:rgba(5,4,3,.78);backdrop-filter:blur(4px)}.tc-control-dialog{position:relative;width:min(780px,96vw);max-height:92vh;overflow:auto;background:#15110d;color:#f5f0e8;border:1px solid rgba(184,150,78,.45);border-radius:10px;box-shadow:0 28px 90px rgba(0,0,0,.62)}.tc-control-head{display:flex;align-items:center;justify-content:space-between;padding:17px 20px;border-bottom:1px solid rgba(184,150,78,.18)}.tc-control-eyebrow{font:500 10px var(--mono,monospace);letter-spacing:.12em;color:#b8964e}.tc-control-title{font-size:17px;font-weight:600;margin-top:4px}.tc-control-meta{font:10px var(--mono,monospace);color:#8f8a82;margin-top:5px}.tc-control-close{border:0;background:none;color:#aaa;font-size:24px;cursor:pointer}.tc-control-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:20px}.tc-control-field{display:grid;gap:6px;font:500 10px var(--mono,monospace);color:#aaa}.tc-control-field input{width:100%;box-sizing:border-box;padding:9px 10px;border-radius:6px;border:1px solid rgba(184,150,78,.2);background:#0d0b09;color:#f5f0e8}.tc-control-field input[readonly]{opacity:.8;cursor:not-allowed}.tc-control-checks{grid-column:1/-1;border:1px solid rgba(184,150,78,.16);border-radius:7px;padding:10px 12px;font-size:11px;line-height:1.55}.tc-control-check{display:flex;gap:8px;align-items:flex-start;margin:4px 0}.tc-control-check.ok{color:#9bc7a0}.tc-control-check.warn{color:#d8bd78}.tc-control-check.err{color:#e58d84}.tc-control-actions{grid-column:1/-1;display:flex;align-items:center;gap:8px;padding-top:10px;border-top:1px solid rgba(184,150,78,.15)}.tc-control-msg{flex:1;color:#b8964e;font-size:11px;line-height:1.45}.tc-control-save{border:1px solid #b8964e;background:#b8964e;color:#17110d;border-radius:6px;padding:9px 14px;font-weight:700;cursor:pointer}.tc-control-save:disabled{opacity:.55;cursor:not-allowed}.tc-control-cancel{border:1px solid rgba(184,150,78,.3);background:transparent;color:#ddd;border-radius:6px;padding:9px 14px;cursor:pointer}.tc-control-delete-modal{border:1px solid rgba(210,100,90,.55);background:rgba(210,100,90,.10);color:#ef9a91;border-radius:6px;padding:9px 14px;font-weight:700;cursor:pointer}.tc-control-delete-modal:disabled{opacity:.55;cursor:not-allowed}@media(max-width:700px){.tc-control-form{grid-template-columns:1fr 1fr}}@media(max-width:460px){.tc-control-form{grid-template-columns:1fr}.tc-control-dialog{width:98vw}.tc-control-actions{flex-wrap:wrap}}';
    document.head.appendChild(s);
  }
  function cellText(tr,index){var c=tr.children[index];return c?(c.textContent||'').replace(/\s+/g,' ').trim():'';}
  function identity(tr){return {ticker:cellText(tr,1),date:cellText(tr,2)};}
  function refresh(type){
    if(typeof loadCours==='function'&&type==='cours') loadCours();
    if(typeof loadHistoriqueTicker==='function'&&type==='historique') loadHistoriqueTicker();
    if(window.CoursControl&&typeof window.CoursControl.refresh==='function') window.CoursControl.refresh();
    setTimeout(bind,450);
  }
  async function deleteEntry(ticker,date,type,id){
    var rows=await findRows(ticker,date);
    var target=id?rows.find(function(x){return String(x.id)===String(id)}):rows[0];
    if(!target) throw Error('Entrée introuvable. Rechargez le tableau puis réessayez.');
    if(!window.confirm('SUPPRIMER CETTE ENTRÉE ?\n\n'+target.ticker+' · '+String(target.date_seance).slice(0,10)+'\nClôture : '+(target.cours_cloture==null?'—':target.cours_cloture)+'\n\nCette suppression est définitive pour cette ligne uniquement.')) return false;
    await request('/historique?id=eq.'+encodeURIComponent(target.id),{method:'DELETE',headers:headers({Prefer:'return=minimal'})});
    refresh(type); return true;
  }
  function addButtons(tr,type){
    if(tr.querySelector('.tc-control-edit')) return;
    var id=identity(tr); if(!id.ticker||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(id.date)) return;
    var cells=tr.children,action=cells[cells.length-1];
    var b=document.createElement('button');b.type='button';b.className='tc-control-edit';b.textContent='Modifier';b.title='Modifier et contrôler cette donnée';
    b.onclick=function(){openEditor(id.ticker,id.date,type)};
    if(action&&(action.querySelector('button')||cells.length>=8))action.appendChild(b);else{var td=document.createElement('td');td.appendChild(b);tr.appendChild(td);action=td;}
    var d=document.createElement('button');d.type='button';d.className='tc-control-delete';d.textContent='Supprimer';d.title='Supprimer uniquement cette cotation';
    d.onclick=async function(){d.disabled=true;try{await deleteEntry(id.ticker,id.date,type,null)}catch(e){alert('Suppression impossible : '+e.message);d.disabled=false}};
    if(action)action.appendChild(d);
  }
  function bindTable(tbody,type){if(!tbody)return;Array.prototype.forEach.call(tbody.querySelectorAll('tr'),function(tr){addButtons(tr,type)})}
  function bind(){bindTable(document.getElementById('cours-tbody'),'cours');bindTable(document.getElementById('hist-tbody'),'historique')}
  function close(){var m=document.getElementById(MODAL);if(m)m.remove()}
  function field(label,name,type,value,required,readonly){return '<label class="tc-control-field">'+esc(label)+(required?' *':'')+'<input name="'+esc(name)+'" type="'+type+'" '+(required?'required ':'')+(readonly?'readonly ':'')+'step="any" value="'+esc(value==null?'':value)+'"></label>'}
  function read(form){var d={};['ticker','date_seance','cours_cloture','cours_ouverture','plus_haut','plus_bas','volume','valeur_totale'].forEach(function(k){var v=form.elements[k].value;d[k]=k==='ticker'?v.trim().toUpperCase():(k==='date_seance'?v:num(v))});return d}
  function checks(d,previous,duplicates){
    var a=[];
    if(!d.cours_cloture||d.cours_cloture<0)a.push({c:'err',t:'Clôture obligatoire et non négative.'});else a.push({c:'ok',t:'Clôture valide.'});
    if(d.cours_ouverture!=null&&d.cours_ouverture<0)a.push({c:'err',t:'Ouverture négative.'});
    if(d.plus_bas!=null&&d.plus_bas<0)a.push({c:'err',t:'Plus bas négatif.'});
    if(d.plus_haut!=null&&d.plus_haut<0)a.push({c:'err',t:'Plus haut négatif.'});
    if(d.plus_bas!=null&&d.plus_haut!=null&&d.plus_bas>d.plus_haut)a.push({c:'err',t:'Plus bas supérieur au plus haut.'});
    if(d.cours_ouverture!=null&&d.plus_haut!=null&&d.cours_ouverture>d.plus_haut)a.push({c:'err',t:'Ouverture supérieure au plus haut.'});
    if(d.cours_ouverture!=null&&d.plus_bas!=null&&d.cours_ouverture<d.plus_bas)a.push({c:'err',t:'Ouverture inférieure au plus bas.'});
    if(d.cours_cloture!=null&&d.plus_haut!=null&&d.cours_cloture>d.plus_haut)a.push({c:'err',t:'Clôture supérieure au plus haut.'});
    if(d.cours_cloture!=null&&d.plus_bas!=null&&d.cours_cloture<d.plus_bas)a.push({c:'err',t:'Clôture inférieure au plus bas.'});
    if(d.volume!=null&&(!Number.isInteger(d.volume)||d.volume<0))a.push({c:'err',t:'Volume invalide : entier positif attendu.'});
    if(previous&&num(previous.cours_cloture)>0&&d.cours_cloture!=null){var calc=((d.cours_cloture-num(previous.cours_cloture))/num(previous.cours_cloture))*100;a.push({c:'ok',t:'Variation de référence : '+calc.toFixed(2)+' % vs clôture précédente ('+num(previous.cours_cloture)+').'});}else a.push({c:'warn',t:'Cours de référence précédent indisponible : variation = —.'});
    if(duplicates>1)a.push({c:'err',t:'Doublon détecté pour le couple ticker/date : '+duplicates+' lignes.'});
    if(!a.some(function(x){return x.c==='err'}))a.push({c:'ok',t:'Aucune incohérence bloquante détectée.'});
    return a;
  }
  async function openEditor(ticker,date,type){
    ensureCss();close();
    var m=document.createElement('div');m.id=MODAL;m.className='tc-control-modal';
    m.innerHTML='<div class="tc-control-modal-back"></div><div class="tc-control-dialog"><div class="tc-control-head"><div><div class="tc-control-eyebrow">THE CAPITAL · '+(type==='cours'?'COURS':'ARCHIVE HISTORIQUE')+'</div><div class="tc-control-title">Contrôle et modification</div><div class="tc-control-meta">'+esc(ticker)+' · '+esc(date)+'</div></div><button class="tc-control-close" type="button">×</button></div><form class="tc-control-form">'+
      field('Ticker','ticker','text',ticker,true,true)+field('Date séance','date_seance','date',date,true,true)+field('Clôture','cours_cloture','number','',true,false)+field('Ouverture','cours_ouverture','number','',false,false)+field('Plus haut','plus_haut','number','',false,false)+field('Plus bas','plus_bas','number','',false,false)+field('Volume','volume','number','',false,false)+field('Variation %','variation','number','',false,true)+field('Valeur totale','valeur_totale','number','',false,true)+
      '<div class="tc-control-checks"><strong>Contrôle opérationnel</strong><div class="tc-control-check">Chargement…</div></div><div class="tc-control-actions"><span class="tc-control-msg"></span><button type="button" class="tc-control-cancel">Annuler</button><button type="button" class="tc-control-delete-modal">Supprimer cette entrée</button><button type="submit" class="tc-control-save">Enregistrer</button></div></form></div>';
    document.body.appendChild(m);
    var form=m.querySelector('form'),box=m.querySelector('.tc-control-checks'),msg=m.querySelector('.tc-control-msg'),save=m.querySelector('.tc-control-save'),del=m.querySelector('.tc-control-delete-modal');
    m.querySelector('.tc-control-close').onclick=close;m.querySelector('.tc-control-cancel').onclick=close;m.querySelector('.tc-control-modal-back').onclick=close;
    try{
      var rows=await findRows(ticker,date);if(!rows.length)throw Error('Ligne introuvable. Rechargez le tableau puis réessayez.');
      var r=rows[0];Object.keys(r).forEach(function(k){var el=form.elements[k];if(el)el.value=r[k]==null?'':(k==='date_seance'?String(r[k]).slice(0,10):r[k])});
      var prev=await previousClose(r.ticker,String(r.date_seance).slice(0,10));
      var draw=function(){var c=checks(read(form),prev,rows.length);box.innerHTML='<strong>Contrôle opérationnel</strong>'+c.map(function(x){return '<div class="tc-control-check '+x.c+'">'+(x.c==='ok'?'✓':x.c==='warn'?'⚠':'✕')+' '+esc(x.t)+'</div>'}).join('')};
      draw();form.oninput=draw;
      del.onclick=async function(){del.disabled=true;save.disabled=true;msg.textContent='Suppression…';try{if(await deleteEntry(r.ticker,String(r.date_seance).slice(0,10),type,r.id))close();}catch(e){del.disabled=false;save.disabled=false;msg.textContent='Erreur : '+e.message}};
      form.onsubmit=async function(e){e.preventDefault();var d=read(form),c=checks(d,prev,rows.length);if(c.some(function(x){return x.c==='err'})){msg.textContent='Correction requise avant enregistrement.';return}save.disabled=true;del.disabled=true;msg.textContent='Enregistrement…';try{
        var body={cours_cloture:d.cours_cloture,cours_ouverture:d.cours_ouverture,plus_haut:d.plus_haut,plus_bas:d.plus_bas,volume:d.volume,valeur_totale:d.valeur_totale};
        /* variation volontairement absente : le trigger Supabase existant la recalcule depuis la clôture précédente. */
        await request('/historique?id=eq.'+encodeURIComponent(r.id),{method:'PATCH',headers:headers({Prefer:'return=representation'}),body:JSON.stringify(body)});
        msg.textContent='✓ Modification enregistrée';setTimeout(function(){close();refresh(type)},350);
      }catch(e){save.disabled=false;del.disabled=false;msg.textContent='Erreur : '+e.message}};
    }catch(e){box.innerHTML='<strong>Contrôle opérationnel</strong><div class="tc-control-check err">✕ '+esc(e.message)+'</div>';save.disabled=true;del.disabled=true;msg.textContent='Impossible de charger la donnée.'}
  }
  function init(){ensureCss();if(bound)return;bound=true;var observer=new MutationObserver(function(){bind()});observer.observe(document.body,{childList:true,subtree:true});bind();setInterval(bind,1000)}
  window.CoursControlEditor={open:openEditor,refresh:bind};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();