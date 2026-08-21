/* THE CAPITAL — Gestion intelligente des séances
 * Couche additive : aucun changement de schéma Supabase.
 * - navigation calendrier -> Archive avec la séance sélectionnée
 * - gestion séance complète dans Archive
 * - ajout/modification des indices d'une séance
 * - statut de publication calculé à partir des données réellement présentes
 */
(function(){
  'use strict';
  var CAL='tc-seances-calendrier';
  var EXPECTED=['BRVM-COMPOSITE','BRVM-30','BRVM-PRESTIGE'];
  var SESSION_KEY='tc_admin_open_session_date';

  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
  function n(v){var x=Number(v);return Number.isFinite(x)?x:null;}
  function auth(){return {apikey:SB_ANON,Authorization:'Bearer '+TK,Accept:'application/json','Content-Type':'application/json'};}
  async function get(table,select,extra){
    var q=SB_REST+'/'+table+'?select='+encodeURIComponent(select)+(extra?'&'+extra:'');
    var r=await fetch(q,{headers:auth(),cache:'no-store'});var t=await r.text();
    if(!r.ok)throw Error(table+' — HTTP '+r.status+' — '+t.slice(0,220));
    return t?JSON.parse(t):[];
  }
  async function patch(table,id,body){
    var r=await fetch(SB_REST+'/'+table+'?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:Object.assign(auth(),{'Prefer':'return=minimal'}),body:JSON.stringify(body)});
    if(!r.ok)throw Error('Modification refusée — HTTP '+r.status+' — '+(await r.text()).slice(0,220));
  }
  async function post(table,body){
    var r=await fetch(SB_REST+'/'+table,{method:'POST',headers:Object.assign(auth(),{'Prefer':'return=representation'}),body:JSON.stringify(body)});
    if(!r.ok)throw Error('Création refusée — HTTP '+r.status+' — '+(await r.text()).slice(0,220));
    return r.text();
  }
  function toastMsg(m,type){if(typeof window.toast==='function')window.toast(m,type||'ok');}

  async function sessionQuality(date){
    var rows=await get('historique','id,ticker,date_seance,cours_cloture,cours_ouverture,plus_haut,plus_bas,volume,variation,valeur_totale','date_seance=eq.'+encodeURIComponent(date)+'&order=ticker.asc');
    var idx=await get('indices','id,indice,date_seance,valeur,variation,variation_pct','date_seance=eq.'+encodeURIComponent(date)+'&order=indice.asc');
    var companies=await get('entreprises','ticker,actif','actif=eq.true&order=ticker.asc');
    var expected=companies.map(function(x){return String(x.ticker||'').trim().toUpperCase();}).filter(Boolean);
    var by={};(rows||[]).forEach(function(r){var t=String(r.ticker||'').trim().toUpperCase();(by[t]||(by[t]=[])).push(r);});
    var duplicates=Object.keys(by).filter(function(t){return by[t].length>1;});
    var missing=expected.filter(function(t){return !by[t];});
    var invalid=[];
    (rows||[]).forEach(function(r){
      var c=n(r.cours_cloture),o=n(r.cours_ouverture),h=n(r.plus_haut),l=n(r.plus_bas),v=n(r.volume),vr=n(r.variation);
      if(c==null||c<0)invalid.push(r.ticker+' : clôture manquante/invalide');
      if(h!=null&&l!=null&&l>h)invalid.push(r.ticker+' : bas > haut');
      if(o!=null&&h!=null&&o>h)invalid.push(r.ticker+' : ouverture > haut');
      if(o!=null&&l!=null&&o<l)invalid.push(r.ticker+' : ouverture < bas');
      if(c!=null&&h!=null&&c>h)invalid.push(r.ticker+' : clôture > haut');
      if(c!=null&&l!=null&&c<l)invalid.push(r.ticker+' : clôture < bas');
      if(v!=null&&v<0)invalid.push(r.ticker+' : volume négatif');
      if(vr!=null&&Math.abs(vr)>7.5)invalid.push(r.ticker+' : variation > ±7,5 %');
    });
    var idxMap={};(idx||[]).forEach(function(r){var raw=String(r.indice||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(raw==='BRVMC'||raw.indexOf('COMPOSITE')>=0)idxMap['BRVM-COMPOSITE']=r;else if(raw.indexOf('30')>=0)idxMap['BRVM-30']=r;else if(raw.indexOf('PRESTIGE')>=0)idxMap['BRVM-PRESTIGE']=r;});
    var missingIdx=EXPECTED.filter(function(x){return !idxMap[x];});
    var complete=rows.length>0&&!missing.length&&!duplicates.length&&!invalid.length&&!missingIdx.length;
    return {date:date,rows:rows,indices:idx,expected:expected,missing:missing,duplicates:duplicates,invalid:invalid,missingIdx:missingIdx,idxMap:idxMap,complete:complete};
  }

  function navToArchive(date){
    localStorage.setItem(SESSION_KEY,date);
    if(typeof window.switchTab==='function')window.switchTab('archive',document.querySelector('.admin-tab[data-admin-archive="true"]'));
    setTimeout(function(){openArchiveSession(date);},250);
  }
  window.TCAdminOpenSession=navToArchive;

  function addCalendarActions(){
    var root=document.getElementById(CAL);if(!root)return;
    var detail=root.querySelector('[data-cal-detail]');if(!detail||detail.querySelector('[data-smart-session]'))return;
    var title=detail.querySelector('.tc-cal-detail-title');if(!title)return;
    var m=title.textContent.match(/(\d{2}\/\d{2}\/\d{4})/);if(!m)return;
    var parts=m[1].split('/');var date=parts[2]+'-'+parts[1]+'-'+parts[0];
    var actions=detail.querySelector('.tc-cal-actions');if(!actions)return;
    var b=document.createElement('button');b.type='button';b.className='btn btn-primary btn-sm';b.setAttribute('data-smart-session','1');b.textContent='↗ Ouvrir dans Historique';b.onclick=function(){navToArchive(date);};actions.insertBefore(b,actions.firstChild);
    var q=document.createElement('button');q.type='button';q.className='btn btn-outline btn-sm';q.setAttribute('data-smart-quality','1');q.textContent='Contrôle intelligent';q.onclick=function(){showQuality(date);};actions.insertBefore(q,actions.firstChild);
  }

  async function showQuality(date){
    try{
      var q=await sessionQuality(date),msg;
      if(q.complete)msg='✓ SÉANCE CONFIRMÉE — '+q.rows.length+' cours, '+q.indices.length+' indices, aucune anomalie bloquante. Les données sont publiables.';
      else msg='⚠ SÉANCE NON CONFIRMÉE — '+q.missing.length+' titre(s) manquant(s), '+q.invalid.length+' incohérence(s), '+q.duplicates.length+' doublon(s), '+q.missingIdx.length+' indice(s) manquant(s).';
      toastMsg(msg,q.complete?'ok':'err');
    }catch(e){toastMsg('Contrôle intelligent impossible : '+e.message,'err');}
  }

  function ensureArchiveManager(){
    var panel=document.getElementById('panel-archive');if(!panel||document.getElementById('tc-smart-archive'))return;
    var box=document.createElement('div');box.id='tc-smart-archive';box.className='card';box.style.marginBottom='16px';
    box.innerHTML='<div class="card-header"><div><span class="card-title">Gestion intelligente d’une séance</span><div style="font-size:11px;color:var(--muted);margin-top:5px">Chargez une date complète pour modifier les cours et les indices sans naviguer ligne par ligne.</div></div></div><div style="padding:14px 18px"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end"><div class="field" style="margin:0"><label>Date de séance</label><input type="date" id="tc-smart-date"></div><button class="btn btn-primary btn-sm" id="tc-smart-load">Charger la séance</button><button class="btn btn-outline btn-sm" id="tc-smart-check">Contrôler</button><span id="tc-smart-status" class="msg"></span></div><div id="tc-smart-session-body" style="margin-top:14px"></div></div>';
    panel.insertBefore(box,panel.children[1]||null);
    document.getElementById('tc-smart-load').onclick=function(){openArchiveSession(document.getElementById('tc-smart-date').value);};
    document.getElementById('tc-smart-check').onclick=function(){var d=document.getElementById('tc-smart-date').value;if(d)showQuality(d);};
    var pending=localStorage.getItem(SESSION_KEY);if(pending){document.getElementById('tc-smart-date').value=pending;setTimeout(function(){openArchiveSession(pending);},300);}
  }

  async function openArchiveSession(date){
    if(!date)return;ensureArchiveManager();var input=document.getElementById('tc-smart-date');if(input)input.value=date;
    var body=document.getElementById('tc-smart-session-body'),status=document.getElementById('tc-smart-status');if(!body)return;
    body.innerHTML='<div class="loading"><div class="spinner"></div><p>Chargement de la séance '+esc(date)+'…</p></div>';
    try{
      var q=await sessionQuality(date),st=q.complete?'✓ CONFIRMÉE — prête pour l’application':'⚠ À CORRIGER — l’application ne doit pas considérer cette séance comme complète';
      if(status){status.textContent=st;status.className='msg '+(q.complete?'ok':'err');}
      var html='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><strong>'+esc(date)+'</strong><span style="font-size:10px;color:var(--muted)">'+q.rows.length+' cours · '+q.indices.length+' indices · '+q.expected.length+' titres actifs attendus</span></div>';
      if(!q.complete)html+='<div class="info-box" style="margin-bottom:12px;border-left:3px solid #e58d84"><strong>Blocages :</strong> '+(q.missing.length?q.missing.length+' titre(s) manquant(s) · ':'')+(q.invalid.length?q.invalid.length+' incohérence(s) · ':'')+(q.duplicates.length?q.duplicates.length+' doublon(s) · ':'')+(q.missingIdx.length?q.missingIdx.length+' indice(s) manquant(s)':'')+'</div>';
      html+='<div class="tw"><table><thead><tr><th>Ticker</th><th class="r">Clôture</th><th class="r">Ouverture</th><th class="r">Haut</th><th class="r">Bas</th><th class="r">Volume</th><th class="r">Var.</th><th></th></tr></thead><tbody>';
      html+=q.rows.map(function(r){return '<tr><td><strong>'+esc(r.ticker)+'</strong></td><td class="r">'+esc(r.cours_cloture)+'</td><td class="r">'+esc(r.cours_ouverture)+'</td><td class="r">'+esc(r.plus_haut)+'</td><td class="r">'+esc(r.plus_bas)+'</td><td class="r">'+esc(r.volume)+'</td><td class="r">'+esc(r.variation)+'</td><td><button class="btn btn-outline btn-sm" data-smart-edit="'+esc(r.id)+'">Modifier</button></td></tr>';}).join('');
      html+='</tbody></table></div><div style="margin-top:18px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px"><strong>Indices de la séance</strong><button class="btn btn-primary btn-sm" id="tc-smart-add-index">+ Ajouter un indice</button></div><div class="tw"><table><thead><tr><th>Indice</th><th class="r">Valeur</th><th class="r">Variation</th><th class="r">Variation %</th><th></th></tr></thead><tbody>'+q.indices.map(function(r){return '<tr><td><strong>'+esc(r.indice)+'</strong></td><td class="r">'+esc(r.valeur)+'</td><td class="r">'+esc(r.variation)+'</td><td class="r">'+esc(r.variation_pct)+'</td><td><button class="btn btn-outline btn-sm" data-smart-edit-index="'+esc(r.id)+'">Modifier</button></td></tr>';}).join('')+'</tbody></table></div></div>';
      body.innerHTML=html;
      body.querySelectorAll('[data-smart-edit]').forEach(function(b){b.onclick=function(){var row=q.rows.find(function(r){return String(r.id)===String(b.dataset.smartEdit);});if(row&&typeof window.editHistorique==='function'){window.histData=q.rows;window.editHistorique(row.id);}};});
      body.querySelectorAll('[data-smart-edit-index]').forEach(function(b){b.onclick=function(){var row=q.indices.find(function(r){return String(r.id)===String(b.dataset.smartEditIndex);});if(row)indexModal(date,row);};});
      document.getElementById('tc-smart-add-index').onclick=function(){indexModal(date,null);};
    }catch(e){body.innerHTML='<div class="info-box" style="border-left:3px solid #e58d84">Erreur : '+esc(e.message)+'</div>';}
  }

  function indexModal(date,row){
    var old=document.getElementById('tc-index-editor');if(old)old.remove();
    var d=document.createElement('div');d.id='tc-index-editor';d.className='inline-edit';d.style.display='block';
    d.innerHTML='<div class="modal"><div class="modal-title">'+(row?'Modifier':'Ajouter')+' un indice</div><div class="form-grid"><div class="field"><label>Indice *</label><input id="tc-idx-name" value="'+esc(row&&row.indice||'')+'" placeholder="BRVM-COMPOSITE"></div><div class="field"><label>Date *</label><input id="tc-idx-date" type="date" value="'+esc(date)+'"></div><div class="field"><label>Valeur *</label><input id="tc-idx-value" type="number" step="any" value="'+esc(row&&row.valeur!=null?row.valeur:'')+'"></div><div class="field"><label>Variation</label><input id="tc-idx-var" type="number" step="any" value="'+esc(row&&row.variation!=null?row.variation:'')+'"></div><div class="field"><label>Variation %</label><input id="tc-idx-varpct" type="number" step="any" value="'+esc(row&&row.variation_pct!=null?row.variation_pct:'')+'"></div></div><div class="modal-actions"><button class="btn btn-outline btn-sm" id="tc-idx-cancel">Annuler</button><button class="btn btn-primary btn-sm" id="tc-idx-save">Enregistrer</button></div><span id="tc-idx-msg" class="msg" style="display:block;margin-top:8px"></span></div>';
    document.body.appendChild(d);
    document.getElementById('tc-idx-cancel').onclick=function(){d.remove();};
    document.getElementById('tc-idx-save').onclick=async function(){
      var msg=document.getElementById('tc-idx-msg');var body={indice:document.getElementById('tc-idx-name').value.trim(),date_seance:document.getElementById('tc-idx-date').value,valeur:n(document.getElementById('tc-idx-value').value),variation:n(document.getElementById('tc-idx-var').value),variation_pct:n(document.getElementById('tc-idx-varpct').value)};
      if(!body.indice||!body.date_seance||body.valeur==null){msg.textContent='Indice, date et valeur sont obligatoires.';msg.className='msg err';return;}
      try{if(row)await patch('indices',row.id,body);else await post('indices',body);msg.textContent='✓ Enregistré';msg.className='msg ok';setTimeout(function(){d.remove();openArchiveSession(body.date_seance);},350);}catch(e){msg.textContent='✗ '+e.message;msg.className='msg err';}
    };
  }

  function boot(){
    var obs=new MutationObserver(function(){
      addCalendarActions();
      if(document.getElementById('panel-archive'))ensureArchiveManager();
    });
    obs.observe(document.body,{subtree:true,childList:true});
    addCalendarActions();ensureArchiveManager();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
