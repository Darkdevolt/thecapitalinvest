(function(){
'use strict';

/*
 * THE CAPITAL — BRVM / LA SÉANCE DU JOUR EN 1 MINUTE
 * Générateur réservé à l'administration.
 * Aucun changement de schéma Supabase : les données existantes sont lues
 * depuis indices / cours (avec fallback historique), entreprises,
 * dividendes_calendrier et financials.
 */
var G='#C9A34A',G2='#F0C866',B='#050505',P='#0B0A08',CARD='#11100D',CARD2='#17130D',C='#F5F0E8',M='#9B9488',GR='#39B96B',R='#E34D59',LINE='rgba(201,163,74,.22)',SOFT='rgba(245,240,232,.10)',logo='/assets/the-capital-logo.png';
var S={d:null,svg:'',w:1080,h:1620};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]})}
function num(v){if(v===null||v===undefined||v==='')return 0;var n=Number(String(v).replace(/\s/g,'').replace(',','.'));return isFinite(n)?n:0}
function has(v){return v!==null&&v!==undefined&&v!==''&&!isNaN(Number(v))}
function fmt(v,d){return num(v).toLocaleString('fr-FR',{minimumFractionDigits:d||0,maximumFractionDigits:d||0})}
function pct(v){var n=num(v);return (n>=0?'+':'')+n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' %'}
function compact(v){var n=num(v);if(n>=1e12)return fmt(n/1e12,2)+' tn';if(n>=1e9)return fmt(n/1e9,2)+' Mds';if(n>=1e6)return fmt(n/1e6,2)+' M';return fmt(n,0)}
function dateFR(s){if(!s)return '—';return new Date(s+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}
function shortDate(s){if(!s)return '—';return new Date(s+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'})}
function colorPct(v){return num(v)>=0?GR:R}
function text(x,y,s,size,color,weight,anchor){return '<text x="'+x+'" y="'+y+'" font-family="DM Sans,Arial,sans-serif" font-size="'+size+'" font-weight="'+(weight||400)+'" fill="'+(color||C)+'" text-anchor="'+(anchor||'start')+'">'+esc(s)+'</text>'}
function line(x1,y1,x2,y2,color,width){return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+(color||LINE)+'" stroke-width="'+(width||1)+'"/>'}
function rect(x,y,w,h,fill,stroke,r){return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+(r||12)+'" fill="'+fill+'"'+(stroke?' stroke="'+stroke+'"':'')+' />'}
function circle(cx,cy,r,fill,stroke,sw){return '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+(fill||'none')+'"'+(stroke?' stroke="'+stroke+'" stroke-width="'+(sw||2)+'"':'')+' />'}
function arrow(cx,cy,up){var col=up?GR:R;return circle(cx,cy,24,'none',col,3)+line(cx-8,cy+7,cx+7,cy-8,col,4)+line(cx+7,cy-8,cx+7,cy+2,col,4)+line(cx+7,cy-8,cx-3,cy-8,col,4)}
function safeName(r){return (r&&(r.societe||r.nom_court||r.nom))||'—'}
function valueOf(r){return num(r&&((r.valeur_totale!=null?r.valeur_totale:null)||(r.valeur_transigee!=null?r.valeur_transigee:null)||(r.valeur!=null?r.valeur:null)))}

async function readCourses(date){
    var fields='ticker,date_seance,variation,volume,cours,cours_cloture,valeur_totale,valeur_transigee,capitalisation';
    var rows=await sbGet('cours','select='+fields+'&date_seance=eq.'+encodeURIComponent(date)+'&limit=1000');
    if(rows&&rows.length)return rows;
    rows=await sbGet('historique','select='+fields+'&date_seance=eq.'+encodeURIComponent(date)+'&limit=1000');
    return rows||[];
}

async function getData(date){
    var ix=await sbGet('indices','select=indice,date_seance,valeur,variation,variation_pct&order=date_seance.desc&limit=1000')||[];
    var d=date;
    if(!d&&ix.length)d=ix[0].date_seance;
    if(!d){var q=await sbGet('cours','select=date_seance&order=date_seance.desc&limit=1')||[];d=q[0]&&q[0].date_seance}
    if(!d){var h=await sbGet('historique','select=date_seance&order=date_seance.desc&limit=1')||[];d=h[0]&&h[0].date_seance}
    if(!d)throw Error('Aucune séance disponible dans la base.');

    var c=await readCourses(d);
    var ent=await sbGet('entreprises','select=ticker,nom,nom_court&limit=1000')||[];
    var divs=await sbGet('dividendes_calendrier','select=ticker,montant_net,montant,ex_date,date_detachement,date_paiement,date_paiement_cal,statut&order=ex_date.asc&limit=12')||[];
    var fins=await sbGet('financials','select=ticker,annee,periode,bpa,dpa,resultat_net,fonds_propres&order=annee.desc&limit=1000')||[];
    var names={};ent.forEach(function(x){names[x.ticker]=x.nom_court||x.nom||x.ticker});
    c.forEach(function(x){x.societe=names[x.ticker]||x.ticker;x._value=valueOf(x);x._price=has(x.cours_cloture)?num(x.cours_cloture):num(x.cours)});

    var map={};ix.forEach(function(x){(map[x.indice]||(map[x.indice]=[])).push(x)});
    function pick(k){var a=map[k]||[];return a.find(function(x){return x.date_seance===d})||a[0]||null}
    var namesIdx=['BRVM COMPOSITE','BRVM 30','BRVM PRESTIGE'];
    var indices=namesIdx.map(function(k){var r=pick(k),ytd=null; if(r){var a=(map[k]||[]).filter(function(x){return x.date_seance&&x.date_seance.slice(0,4)===d.slice(0,4)}).sort(function(a,b){return a.date_seance.localeCompare(b.date_seance)});if(a.length&&num(a[0].valeur))ytd=(num(r.valeur)/num(a[0].valeur)-1)*100}return {name:k,row:r,ytd:ytd}});

    var active=c.filter(function(x){return num(x.volume)>0||x._value>0||has(x.variation)});
    var gain=active.filter(function(x){return num(x.variation)>0}).sort(function(a,b){return num(b.variation)-num(a.variation)}).slice(0,5);
    var loss=active.filter(function(x){return num(x.variation)<0}).sort(function(a,b){return num(a.variation)-num(b.variation)}).slice(0,5);
    var flat=active.filter(function(x){return num(x.variation)===0});
    var volume=active.reduce(function(s,x){return s+num(x.volume)},0);
    var value=active.reduce(function(s,x){return s+x._value},0);
    var cap=active.reduce(function(s,x){return s+num(x.capitalisation)},0);

    /* Ratios disponibles dans les financials. On ne fabrique jamais une valeur absente. */
    var latest={};fins.forEach(function(x){var k=x.ticker;if(!latest[k]||Number(x.annee)>Number(latest[k].annee))latest[k]=x});
    var pe=[],dy=[],roe=[];active.forEach(function(x){var f=latest[x.ticker];if(!f)return;var price=x._price,bpa=num(f.bpa),dpa=num(f.dpa),rn=num(f.resultat_net),fp=num(f.fonds_propres);if(price>0&&bpa>0)pe.push(price/bpa);if(price>0&&dpa>0)dy.push(dpa/price*100);if(fp>0&&rn!==0)roe.push(rn/fp*100)});
    function avg(a){return a.length?a.reduce(function(s,v){return s+v},0)/a.length:null}

    return {date:d,indices:indices,cours:active,gain:gain,loss:loss,flat:flat,volume:volume,value:value,cap:cap,divs:divs.filter(function(x){var dt=x.ex_date||x.date_detachement||x.date_paiement||'';return !dt||dt>=d}).slice(0,5),stats:{pe:avg(pe),dy:avg(dy),roe:avg(roe),lines:active.length,sgis:null},fins:fins};
}

function drawHeader(d,w){
    var o='';
    o+=rect(0,0,w,260,B,null,0);
    o+='<image href="'+logo+'" x="46" y="24" width="160" height="160" preserveAspectRatio="xMidYMid meet"/>';
    o+=line(230,26,230,215,G,3);
    o+=text(260,82,'BRVM',64,G,800);
    o+=text(260,137,'LA SÉANCE DU JOUR',34,C,800);
    o+=text(260,178,'EN 1 MINUTE',34,C,800);
    o+=rect(260,199,535,40,'#1E170B',G,null,20);
    o+=text(527,225,dateFR(d.date),18,G2,600,'middle');
    o+=text(w-48,70,'THE CAPITAL',12,M,600,'end');
    o+=text(w-48,92,'MARKET INTELLIGENCE',10,M,400,'end');
    return o;
}
function indexCard(x,y,w,h,it){
    var o=rect(x,y,w,h,'#FCFBF8','#E8E3D8',14),r=it.row;
    o+=text(x+22,y+30,it.name,16,'#25231F',700);
    if(r){var v=num(r.variation),vc=v>=0?GR:R;o+=arrow(x+37,y+74,v>=0);o+=text(x+72,y+87,fmt(r.valeur,2)+' pts',38,'#1E6B35',800);o+=text(x+72,y+117,pct(v),19,vc,700);o+=text(x+22,y+151,'Depuis le 1er janvier',13,'#55504A',400);o+=text(x+22,y+176,it.ytd==null?'—':pct(it.ytd),17,it.ytd==null?'#777':(it.ytd>=0?'#1E6B35':R),700);o+=rect(x+16,y+190,w-32,62,'#FFF8ED',null,9);o+=text(x+88,y+214,'VALEUR',10,'#625B52',600,'middle');o+=text(x+88,y+239,compact(r.valeur)+' pts',15,'#25231F',700,'middle');o+=line(x+w/2,y+201,x+w/2,y+242,'#E4D9C8',1);o+=text(x+w-88,y+214,'VARIATION',10,'#625B52',600,'middle');o+=text(x+w-88,y+239,pct(v),15,vc,700,'middle')}else{o+=text(x+22,y+88,'Donnée indisponible',17,'#777',500)}
    return o;
}
function metricRow(d,x,y,w){
    var vals=[d.cours.length,d.gain.length,d.loss.length,d.flat.length],labs=['titres cotés échangés aujourd’hui','en hausse','en baisse','inchangés'];
    var o=text(x,y,'LE MARCHÉ ACTIONS EN CHIFFRES',25,'#24211D',800);
    y+=22;var cw=w/4;
    vals.forEach(function(v,i){var xx=x+i*cw;if(i)o+=line(xx,y,xx,y+105,'#E5DED3',1);o+=text(xx+cw/2,y+47,fmt(v),34,'#171513',800,'middle');o+=text(xx+cw/2,y+72,labs[i],12,'#5F5952',500,'middle')});
    y+=123;o+=rect(x,y,w,82,'#FFF9F0','#EFE5D6',10);o+=text(x+w*.17,y+28,'VOLUME ÉCHANGÉ',11,'#746B61',600,'middle');o+=text(x+w*.17,y+56,fmt(d.volume)+' titres',20,G,800,'middle');o+=line(x+w*.34,y+14,x+w*.34,y+68,'#E5D9C8',1);o+=text(x+w*.50,y+28,'VALEUR ÉCHANGÉE',11,'#746B61',600,'middle');o+=text(x+w*.50,y+56,compact(d.value)+' FCFA',20,G,800,'middle');o+=line(x+w*.66,y+14,x+w*.66,y+68,'#E5D9C8',1);o+=text(x+w*.83,y+28,'CAPITALISATION',11,'#746B61',600,'middle');o+=text(x+w*.83,y+56,compact(d.cap)+' FCFA',20,G,800,'middle');
    y+=102;o+=rect(x,y,w,72,'#FFF9F0',null,10);var stats=[['P/E moyen',d.stats.pe==null?'—':fmt(d.stats.pe,2)],['Rendement moyen',d.stats.dy==null?'—':fmt(d.stats.dy,2)+' %'],['Rentabilité moyenne',d.stats.roe==null?'—':fmt(d.stats.roe,2)+' %']];stats.forEach(function(s,i){var xx=x+i*w/3;if(i)o+=line(xx,y+12,xx,y+60,'#E5D9C8',1);o+=text(xx+w/6,y+27,s[0],11,'#746B61',600,'middle');o+=text(xx+w/6,y+54,s[1],19,'#171513',800,'middle')});
    return {svg:o,next:y+91};
}
function topBox(x,y,w,h,title,rows,color){
    var o=rect(x,y,w,h,'#FFFFFF','#E7E0D6',12);o+=text(x+20,y+29,title,19,color,800);o+=line(x+20,y+44,x+w-20,y+44,'#E8E1D8',1);
    if(!rows.length){o+=text(x+20,y+78,'Aucune donnée disponible',12,'#777',400);return o}
    rows.forEach(function(r,i){var yy=y+76+i*43,vc=color;o+=circle(x+29,yy-5,11,color,null,0)+text(x+29,yy-1,String(i+1),10,'#fff',800,'middle');o+=text(x+51,yy,(r.ticker||'—')+' — '+safeName(r),12,'#24211D',600);o+=text(x+w-20,yy,pct(r.variation),13,vc,800,'end');o+=text(x+51,yy+16,'Vol. '+fmt(r.volume)+' · '+compact(r._value)+' FCFA',10,'#777',400) });
    return o;
}
function upcomingDivs(x,y,w,d){
    var h=122,o=rect(x,y,w,h,'#FFF9F0','#E8DFD0',11);o+=text(x+20,y+27,'DIVIDENDES À VENIR',16,G,800);var rows=(d.divs||[]).slice(0,4);if(!rows.length){o+=text(x+20,y+58,'Aucun dividende disponible dans le calendrier.',12,'#777',400);return o}rows.forEach(function(v,i){var yy=y+51+i*17;o+=text(x+20,yy,v.ticker||'—',11,'#24211D',700);o+=text(x+145,yy,fmt(v.montant_net||v.montant,2)+' FCFA/action',11,'#625B52',500);o+=text(x+w-20,yy,shortDate(v.ex_date||v.date_detachement||v.date_paiement),11,'#625B52',500,'end')});return o;
}
function build(d,w,h,note,bond){
    var p=34,cw=w-p*2,o='<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'">';
    o+=rect(0,0,w,h,'#FFFFFF',null,0)+drawHeader(d,w);
    var y=284, gap=12,iw=(cw-gap*2)/3,ih=268;
    d.indices.forEach(function(it,i){o+=indexCard(p+i*(iw+gap),y,iw,ih,it)});
    y+=ih+26;
    var mr=metricRow(d,p,y,cw);o+=mr.svg;y=mr.next;
    var col=(cw-gap)/2,bh=286;o+=topBox(p,y,col,bh,'TOP 5 HAUSSES DU JOUR',d.gain,GR)+topBox(p+col+gap,y,col,bh,'TOP 5 BAISSES DU JOUR',d.loss,R);y+=bh+18;
    var bondH=110;o+=rect(p,y,cw,bondH,'#FFF9F0','#E8DFD0',11)+text(p+20,y+28,'MARCHÉ OBLIGATAIRE',16,'#C78A00',800)+text(p+20,y+52,'Capitalisation',11,'#746B61',500)+text(p+150,y+52,has(bond.cap)?compact(bond.cap)+' FCFA':'—',15,'#24211D',800)+text(p+310,y+52,'Valeur échangée',11,'#746B61',500)+text(p+430,y+52,has(bond.value)?compact(bond.value)+' FCFA':'—',15,'#24211D',800)+text(p+600,y+52,'Volume échangé',11,'#746B61',500)+text(p+720,y+52,has(bond.volume)?fmt(bond.volume)+' titres':'—',15,'#24211D',800)+line(p+560,y+16,p+560,y+88,'#E5D9C8',1)+text(p+580,y+78,'Données manuelles facultatives',10,'#8A8177',400);
    y+=bondH+16;o+=upcomingDivs(p,y,cw,d);y+=140;
    var noteText=note&&note.trim()?note.trim():'Séance BRVM du jour : évolution des indices, activité du marché et valeurs les plus marquantes.';o+=rect(p,y,cw,112,'#FAF7F1','#E8DFD0',11)+text(p+20,y+27,'ACTU DU JOUR',16,G,800);var words=noteText.split(/\s+/),lines=[],cur='';words.forEach(function(wd){if((cur+' '+wd).trim().length>88){lines.push(cur);cur=wd}else cur=(cur+' '+wd).trim()});if(cur)lines.push(cur);lines.slice(0,4).forEach(function(t,i){o+=text(p+20,y+53+i*18,t,12,'#3F3A34',500)});
    o+=text(w/2,h-34,'Données The Capital · Source : données BRVM intégrées à la base The Capital',10,'#8A8177',400,'middle');
    o+='</svg>';return o;
}

function inject(){
    if(document.getElementById('tab-seance-1m'))return;
    var nav=document.querySelector('.admin-nav');
    if(nav){var b=document.createElement('button');b.id='tab-seance-1m';b.className='admin-tab';b.textContent='Séance 1 minute';b.onclick=function(){switchTab('seance1m',b);loadSeance1m()};nav.appendChild(b)}
    var main=document.querySelector('.main');if(!main)return;
    var p=document.createElement('div');p.className='tab-panel';p.id='panel-seance1m';
    p.innerHTML='<div class="section-header"><div class="section-title">BRVM <em>La séance du jour en 1 minute</em></div><button class="btn btn-outline btn-sm" onclick="loadSeance1m()">↺ Actualiser</button></div>'+\
    '<div class="seance-layout"><div class="card"><div class="card-header"><span class="card-title">Générateur The Capital</span><span class="badge badge-gold">Admin uniquement</span></div><div class="form-grid">'+\
    '<div class="field"><label>Date de séance</label><input type="date" id="seance-date"></div>'+\
    '<div class="field"><label>Format</label><select id="seance-format"><option value="1080x1620">The Capital — vertical 1080 × 1620</option><option value="1080x1920">Story / TikTok — 1080 × 1920</option><option value="1080x1350">Instagram — 1080 × 1350</option><option value="1080x1080">Carré — 1080 × 1080</option></select></div>'+\
    '<div class="field"><label>N° Bulletin <span style="color:var(--gold);font-size:9px">facultatif</span></label><input type="text" id="seance-bulletin" placeholder="151"></div>'+\
    '<div class="field"><label>Obligataire — capitalisation</label><input type="number" id="seance-bond-cap" placeholder="Optionnel" step="any"></div>'+\
    '<div class="field"><label>Obligataire — valeur échangée</label><input type="number" id="seance-bond-value" placeholder="Optionnel" step="any"></div>'+\
    '<div class="field"><label>Obligataire — volume</label><input type="number" id="seance-bond-volume" placeholder="Optionnel" step="1"></div>'+\
    '<div class="field" style="grid-column:1/-1"><label>Actualité / commentaire du jour</label><textarea id="seance-note" rows="4" placeholder="Commentaire éditorial facultatif..."></textarea></div></div>'+\
    '<div class="actions-row"><button class="btn btn-primary" id="seance-generate">Générer la séance</button><button class="btn btn-outline" id="seance-pdf">Télécharger PDF</button><button class="btn btn-green" id="seance-png">Télécharger PNG</button><span id="seance-msg" class="msg"></span></div></div>'+\
    '<div class="card"><div class="card-header"><span class="card-title">Prévisualisation finale</span><span id="seance-meta" class="card-count"></span></div><div class="seance-preview-wrap"><div id="seance-preview"></div></div></div></div>'+\
    '<div class="card" style="margin-top:16px"><div class="card-header"><span class="card-title">Publication client</span><span class="badge badge-gold">Admin uniquement</span></div><div class="seance-publish-box"><div><strong>Workflow prévu</strong><p>Le générateur reste strictement dans Admin. L’export peut ensuite être publié comme contenu client sans toucher aux tables financières, à l’authentification ni aux données BRVM.</p></div><button class="btn btn-outline" disabled>Publier dans l’App</button></div></div>';
    main.appendChild(p);
    var today=new Date().toISOString().slice(0,10);var dateEl=document.getElementById('seance-date');if(dateEl)dateEl.value=today;
    document.getElementById('seance-generate').onclick=loadSeance1m;document.getElementById('seance-png').onclick=downloadPNG;document.getElementById('seance-pdf').onclick=downloadPDF;
    var l=document.createElement('link');l.rel='stylesheet';l.href='admin/css/seance.css';l.id='seance-css';document.head.appendChild(l);
}

async function loadSeance1m(){
    inject();var msg=document.getElementById('seance-msg');if(!msg)return;
    try{msg.textContent='Lecture des données BRVM…';msg.className='msg info';var date=document.getElementById('seance-date').value;S.d=await getData(date);var z=document.getElementById('seance-format').value.split('x');S.w=+z[0];S.h=+z[1];var bond={cap:document.getElementById('seance-bond-cap').value,value:document.getElementById('seance-bond-value').value,volume:document.getElementById('seance-bond-volume').value};S.svg=build(S.d,S.w,S.h,document.getElementById('seance-note').value,bond);document.getElementById('seance-preview').innerHTML=S.svg;document.getElementById('seance-meta').textContent=dateFR(S.d.date)+' · '+S.w+'×'+S.h;msg.textContent='✓ Séance générée — '+S.d.cours.length+' lignes analysées';msg.className='msg ok'}catch(err){console.error('[seance1m]',err);msg.textContent='Erreur : '+(err&&err.message?err.message:'génération impossible');msg.className='msg err'}
}
function imageBlob(type){return new Promise(function(resolve,reject){var blob=new Blob([S.svg],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();img.onload=function(){var c=document.createElement('canvas');c.width=S.w;c.height=S.h;var ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,S.w,S.h);ctx.drawImage(img,0,0,S.w,S.h);URL.revokeObjectURL(url);c.toBlob(function(b){if(b)resolve(b);else reject(Error('Export image impossible'));},type,.96)};img.onerror=function(){URL.revokeObjectURL(url);reject(Error('Le logo ou le SVG n’a pas pu être chargé.'))};img.src=url})}
async function downloadPNG(){if(!S.svg)await loadSeance1m();var b=await imageBlob('image/png'),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='the-capital-seance-'+S.d.date+'.png';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)}
function loadPdfLib(){return new Promise(function(resolve,reject){if(window.jspdf)return resolve();var s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
async function downloadPDF(){if(!S.svg)await loadSeance1m();if(!window.jspdf)await loadPdfLib();var b=await imageBlob('image/png'),reader=new FileReader();reader.onload=function(){var doc=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4'});var pw=doc.internal.pageSize.getWidth(),ph=doc.internal.pageSize.getHeight();doc.addImage(reader.result,'PNG',0,0,pw,ph,undefined,'FAST');doc.save('the-capital-seance-'+S.d.date+'.pdf')};reader.readAsDataURL(b)}
window.loadSeance1m=loadSeance1m;window.downloadPNG=downloadPNG;window.downloadPDF=downloadPDF;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();
})();
