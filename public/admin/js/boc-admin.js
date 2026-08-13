(function(){
'use strict';
function token(){try{var s=JSON.parse(localStorage.getItem('tc_session')||'null');return s&&s.access_token?s.access_token:(s&&s.data&&s.data.session?s.data.session.access_token:'');}catch(e){return localStorage.getItem('tc_token')||'';}}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
function msg(t,c){var e=document.getElementById('boc-upload-msg');if(e){e.textContent=t;e.className='msg '+(c||'info');}}
async function api(path,opts){var h=Object.assign({'Accept':'application/json'},opts&&opts.headers||{}),t=token();if(t)h.Authorization='Bearer '+t;var r=await fetch(path,Object.assign({},opts||{},{headers:h,cache:'no-store'})),d=await r.json().catch(function(){return {};});if(!r.ok)throw new Error(d.error||('HTTP '+r.status));return d;}
function parseDate(name){var m=String(name||'').match(/(?:BOC[_-]?)?(20\d{2})[-_]?([01]\d)[-_]?([0-3]\d)/i);return m?m[1]+'-'+m[2]+'-'+m[3]:'';}
async function upload(){
 var file=document.getElementById('boc-file').files[0],date=document.getElementById('boc-date').value;
 if(!file)return msg('Sélectionnez un fichier PDF.','err');
 if(file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name))return msg('Le document BOC doit être un PDF.','err');
 if(file.size>50*1024*1024)return msg('PDF trop volumineux : maximum 50 Mo.','err');
 if(!date)date=parseDate(file.name);if(!date)return msg('Indiquez la date de séance.','err');
 try{
   msg('Préparation de l’envoi…','info');
   var prep=await api('/api/boc-upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'prepare',filename:file.name,date_seance:date})});
   msg('Téléversement du PDF…','info');
   var up=await fetch(prep.signedUrl,{method:'PUT',headers:{'Content-Type':'application/pdf','x-upsert':'false'},body:file});
   if(!up.ok)throw new Error('Échec du téléversement Storage (HTTP '+up.status+')');
   msg('Enregistrement du document…','info');
   var fin=await api('/api/boc-upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'finalize',filename:file.name,date_seance:date,path:prep.path})});
   msg('✓ '+(fin.message||'Document BOC enregistré.'),'ok');
   document.getElementById('boc-file').value='';await load();
 }catch(e){console.error('[BOC upload]',e);msg('Erreur : '+e.message,'err');}
}
async function load(){var body=document.getElementById('boc-admin-tbody');if(!body)return;try{var d=await api('/api/boc'),rows=d.data||[];body.innerHTML=rows.length?rows.map(function(r){return '<tr><td>'+esc(r.date_seance)+'</td><td>'+esc(r.fichier_nom)+'</td><td><a class="btn btn-outline btn-sm" href="'+esc(r.pdf_url||r.fichier_url||'')+'" target="_blank">Ouvrir PDF</a></td></tr>';}).join(''):'<tr><td colspan="3" style="padding:20px;color:var(--muted);text-align:center">Aucun BOC enregistré.</td></tr>';}catch(e){body.innerHTML='<tr><td colspan="3" style="padding:20px;color:#f87171">Erreur : '+esc(e.message)+'</td></tr>';}}
function inject(){
 if(document.getElementById('panel-boc'))return;var nav=document.querySelector('.admin-nav'),main=document.querySelector('.main');if(!nav||!main)return;
 var tabs=nav.querySelectorAll('.admin-tab'),scraper=null;tabs.forEach(function(b){if((b.textContent||'').trim()==='Scraper')scraper=b;});
 var b=document.createElement('button');b.className='admin-tab';b.textContent='BOC';b.onclick=function(){switchTab('boc',b);load();};if(scraper&&scraper.nextSibling)nav.insertBefore(b,scraper.nextSibling);else nav.appendChild(b);
 var p=document.createElement('div');p.className='tab-panel';p.id='panel-boc';p.innerHTML='<div class="section-header"><div class="section-title">Bulletin Officiel de la Cote <em>BOC</em></div></div><div class="card"><div class="card-header"><span class="card-title">Importer un document BOC</span></div><div style="padding:18px"><div class="form-grid"><div class="field"><label>Date de séance *</label><input type="date" id="boc-date"></div><div class="field"><label>Document PDF *</label><input type="file" id="boc-file" accept="application/pdf,.pdf"></div></div><div class="info-box" style="margin-top:12px">PDF uniquement · maximum 50 Mo. Une date YYYYMMDD dans le nom du fichier est détectée automatiquement.</div><div class="actions-row"><button class="btn btn-primary" id="boc-upload-btn">Importer le BOC</button><span id="boc-upload-msg" class="msg"></span></div></div></div><div class="card"><div class="card-header"><span class="card-title">Documents BOC enregistrés</span><button class="btn btn-outline btn-sm" id="boc-refresh">↺ Actualiser</button></div><div class="tw"><table><thead><tr><th>Date</th><th>Fichier</th><th></th></tr></thead><tbody id="boc-admin-tbody"><tr><td colspan="3"><div class="loading"><div class="spinner"></div></div></td></tr></tbody></table></div></div>';main.appendChild(p);
 document.getElementById('boc-upload-btn').onclick=upload;document.getElementById('boc-refresh').onclick=load;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();window.loadBocAdmin=load;
})();
