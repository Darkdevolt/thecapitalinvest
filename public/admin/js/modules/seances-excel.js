/* THE CAPITAL — IMPORT EXCEL ET SUIVI DES SÉANCES */
'use strict';
(function (TC) {
    const state = { rows: [], year: String(new Date().getFullYear()), holidays: '' };
    const headers = ['ticker','date_seance','cours_cloture','cours_ouverture','plus_haut','plus_bas','volume','variation','valeur_totale'];
    const aliases = {
        ticker:['ticker','code','symbole','valeur'], date_seance:['date','date_seance','seance','date_de_seance'],
        cours_cloture:['cours_cloture','cloture','close','cours'], cours_ouverture:['cours_ouverture','ouverture','open'],
        plus_haut:['plus_haut','haut','high'], plus_bas:['plus_bas','bas','low'], volume:['volume'],
        variation:['variation','variation_pct','variation_%'], valeur_totale:['valeur_totale','valeur','value','montant']
    };
    const norm = v => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s\-/]+/g,'_');
    const num = v => { if (v === null || v === undefined || v === '') return null; const n = Number(String(v).replace(/\s/g,'').replace(',','.')); return Number.isFinite(n) ? n : null; };
    const date = v => { if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0,10); const s=String(v||'').trim(); if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : ''; };
    function view() {
        return '<div class="page-head"><div><div class="page-title">Séances &amp; <em>import Excel</em></div><div class="page-sub">Importez une séance complète depuis Excel et contrôlez les jours ouvrés sans cotation.</div></div></div>' +
        '<div class="card accent"><div class="card-head"><span class="card-title">1. Importer une séance</span></div><div class="card-body"><div class="note">Téléchargez le modèle, renseignez une ligne par valeur, puis téléversez le fichier. La clé de contrôle est <strong>ticker + date de séance</strong>.</div><div class="actions"><button class="btn btn-outline" id="sx-template">Télécharger le modèle Excel</button><label class="btn btn-primary" for="sx-file">Choisir un fichier Excel</label><input id="sx-file" type="file" accept=".xlsx,.xls,.csv" hidden></div><div id="sx-preview" class="note">Aucun fichier chargé.</div><div class="actions"><button class="btn btn-primary" id="sx-import" disabled>Importer les lignes valides</button><span class="msg" id="sx-msg"></span></div></div></div>' +
        '<div class="card"><div class="card-head"><span class="card-title">2. Suivi des séances attendues</span><span class="card-tools"><input id="sx-year" type="number" min="2000" max="2100" value="'+state.year+'" style="width:90px"><button class="btn btn-outline btn-sm" id="sx-check">Analyser</button></span></div><div class="card-body"><div class="note">Renseignez les jours fériés BRVM au format <strong>AAAA-MM-JJ</strong>, séparés par des virgules. Les week-ends et jours fériés ne seront pas signalés comme manquants.</div><textarea id="sx-holidays" rows="2" placeholder="2026-01-01,2026-04-06,2026-05-01"></textarea><div id="sx-calendar" class="tw"></div></div></div>';
    }
    function template() {
        if (!window.XLSX) throw Error('Le moteur Excel n’est pas chargé. Rechargez la page.');
        const X=window.XLSX, s=X.utils.aoa_to_sheet([['Ticker','Date de séance','Cours de clôture','Cours d’ouverture','Plus haut','Plus bas','Volume','Variation %','Valeur échangée'],headers,['SNTS','2026-01-02',14500,14400,14600,14350,1200,0.69,17400000]]); s['!cols']=headers.map(()=>({wch:18})); const b=X.utils.book_new(); X.utils.book_append_sheet(b,s,'Cours'); X.utils.book_append_sheet(b,X.utils.aoa_to_sheet([['Consigne'],['Conservez la deuxième ligne : elle contient les noms techniques lus par l’import.'],['Une ligne par ticker et par séance.'],['Les doublons ticker + date sont refusés avant écriture.']]),'Mode_emploi'); X.writeFile(b,'The-Capital-Cours-Seance.xlsx');
    }
    async function read(file) {
        if (!window.XLSX) throw Error('Le moteur Excel n’est pas chargé. Rechargez la page.'); const X=window.XLSX, b=await file.arrayBuffer(), wb=X.read(b,{type:'array',cellDates:true}), ws=wb.Sheets[wb.SheetNames[0]], matrix=X.utils.sheet_to_json(ws,{header:1,defval:null,raw:true});
        let hi=0, hs=(matrix[0]||[]).map(norm); if ((matrix[1]||[]).map(norm).some(x=>headers.includes(x))) { hi=1; hs=(matrix[1]||[]).map(norm); }
        const map={}; headers.forEach(f=>{const i=aliases[f].map(norm).map(a=>hs.indexOf(a)).find(i=>i>=0); if(i!==undefined) map[f]=i;}); if(map.ticker===undefined||map.date_seance===undefined||map.cours_cloture===undefined) throw Error('Colonnes obligatoires absentes : ticker, date_seance, cours_cloture.');
        const out=[]; for(let i=hi+1;i<matrix.length;i++){const r=matrix[i]||[], x={}; headers.forEach(f=>{const v=r[map[f]]; if(v!==null&&v!==undefined&&v!=='') x[f]=['ticker'].includes(f)?String(v).trim().toUpperCase():f==='date_seance'?date(v):num(v);}); if(x.ticker&&x.date_seance&&x.cours_cloture!==null) out.push(x);} return out;
    }
    function mount() {
        TC.el('sx-template').onclick=()=>{try{template();TC.toast('Modèle Excel téléchargé','ok')}catch(e){TC.toast(e.message,'err')}};
        TC.el('sx-file').onchange=async e=>{try{state.rows=await read(e.target.files[0]); const dates=[...new Set(state.rows.map(r=>r.date_seance))]; TC.el('sx-preview').innerHTML='<strong>'+state.rows.length+' ligne(s)</strong> · séance(s) : '+dates.join(', '); TC.el('sx-import').disabled=!state.rows.length;}catch(err){state.rows=[];TC.el('sx-preview').textContent=err.message;TC.el('sx-import').disabled=true;}};
        TC.el('sx-import').onclick=async()=>{TC.el('sx-import').disabled=true;TC.say('sx-msg','Import en cours…','info'); try{await TC.postBatched('historique',state.rows,TC.CONFLICT.historique);TC.say('sx-msg',state.rows.length+' ligne(s) importées.','ok'); await check();}catch(e){TC.say('sx-msg',e.message,'err')}finally{TC.el('sx-import').disabled=false;}};
        TC.el('sx-check').onclick=check; check();
    }
    async function check(){const year=TC.el('sx-year').value||state.year, holidays=new Set((TC.el('sx-holidays').value||'').split(',').map(x=>x.trim()).filter(Boolean)); const rows=await TC.getAll('historique','select=date_seance&date_seance=gte.'+year+'-01-01&date_seance=lt.'+(Number(year)+1)+'-01-01'); const have=new Set((rows||[]).map(r=>r.date_seance)); const start=new Date(Number(year),0,1), end=new Date(Number(year)+1,0,1), out=[]; for(let d=new Date(start);d<end;d.setDate(d.getDate()+1)){const iso=d.toISOString().slice(0,10), w=d.getDay()===0||d.getDay()===6; if(w||holidays.has(iso)) continue; out.push('<tr><td>'+iso+'</td><td><span class="badge '+(have.has(iso)?'ok':'warn')+'">'+(have.has(iso)?'Disponible':'Manquante')+'</span></td></tr>');} TC.el('sx-calendar').innerHTML='<table><thead><tr><th>Date ouvrée</th><th>Statut</th></tr></thead><tbody>'+out.join('')+'</tbody></table>'; }
    TC.register({id:'seances-excel',label:'Séances & import Excel',group:'marche',icon:'▦',view,mount,refresh:check});
})(window.TC);