/* THE CAPITAL — IMPORT EXCEL ET SUIVI DES SÉANCES */
'use strict';
(function (TC) {
    const state = { rows: [], calDate: new Date(), holidays: '' };
    const headers = ['ticker','date_seance','cours_cloture','cours_ouverture','plus_haut','plus_bas','volume','variation','valeur_totale'];
    const aliases = {
        ticker:['ticker','code','symbole','valeur'], date_seance:['date','date_seance','seance','date_de_seance'],
        cours_cloture:['cours_cloture','cloture','close','cours'], cours_ouverture:['cours_ouverture','ouverture','open'],
        plus_haut:['plus_haut','haut','high'], plus_bas:['plus_bas','bas','low'], volume:['volume'],
        variation:['variation','variation_pct','variation_%'], valeur_totale:['valeur_totale','valeur','value','montant']
    };
    const norm = v => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[\s\-/]+/g,'_');
    const num = v => { if (v === null || v === undefined || v === '') return null; const n = Number(String(v).replace(/\s/g,'').replace(',','.')); return Number.isFinite(n) ? n : null; };
    const date = v => { if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0,10); const s=String(v||'').trim(); if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : ''; };
    function view() {
        return '<div class="page-head"><div><div class="page-title">Séances &amp; <em>import Excel</em></div><div class="page-sub">Importez une séance complète depuis Excel et contrôlez les jours ouvrés sans cotation.</div></div></div>' +
        '<div class="card accent"><div class="card-head"><span class="card-title">1. Importer une séance</span></div><div class="card-body"><div class="note">Téléchargez le modèle, renseignez une ligne par valeur, puis téléversez le fichier. La clé de contrôle est <strong>ticker + date de séance</strong>.</div><div class="actions"><button class="btn btn-outline" id="sx-template">Télécharger le modèle Excel</button><label class="btn btn-primary" for="sx-file">Choisir un fichier Excel</label><input id="sx-file" type="file" accept=".xlsx,.xls,.csv" hidden></div><div id="sx-preview" class="note">Aucun fichier chargé.</div><div class="actions"><button class="btn btn-primary" id="sx-import" disabled>Importer les lignes valides</button><span class="msg" id="sx-msg"></span></div></div></div>' +
        '<div class="card"><div class="card-head"><span class="card-title">2. Suivi des séances attendues</span><span class="card-tools"><span class="card-count" id="sx-count"></span></span></div>' +
        '<div class="card-body">' +
        '<div class="note">Renseignez les jours fériés BRVM au format <strong>AAAA-MM-JJ</strong>, séparés par des virgules. Les week-ends et jours fériés ne comptent pas comme des séances manquantes.</div>' +
        '<textarea id="sx-holidays" rows="2" placeholder="2026-01-01,2026-04-06,2026-05-01"></textarea>' +
        '<div class="tc-cal-nav" style="margin-top:14px">' +
        '<button class="btn btn-outline btn-sm" id="sx-cal-prev">← Mois précédent</button>' +
        '<span class="tc-cal-title" id="sx-cal-title"></span>' +
        '<button class="btn btn-outline btn-sm" id="sx-cal-today">Aujourd\'hui</button>' +
        '<button class="btn btn-outline btn-sm" id="sx-cal-next">Mois suivant →</button>' +
        '</div>' +
        '<div id="sx-calendar" class="tc-cal-grid"></div>' +
        '<div class="tc-cal-legend">' +
        '<span><i style="background:rgba(74,222,128,.55)"></i>Séance disponible</span>' +
        '<span><i style="background:rgba(248,113,113,.55)"></i>Séance manquante</span>' +
        '<span><i style="background:rgba(245,240,232,.15)"></i>Week-end ou jour férié</span>' +
        '</div>' +
        '</div></div>';
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
        TC.el('sx-import').onclick=async()=>{TC.el('sx-import').disabled=true;TC.say('sx-msg','Import en cours…','info'); try{await TC.postBatched('historique',state.rows,TC.CONFLICT.historique);TC.say('sx-msg',state.rows.length+' ligne(s) importées.','ok'); await renderCalendar();}catch(e){TC.say('sx-msg',e.message,'err')}finally{TC.el('sx-import').disabled=false;}};
        TC.el('sx-holidays').value = state.holidays;
        TC.el('sx-holidays').oninput = e => { state.holidays = e.target.value; renderCalendar(); };
        TC.el('sx-cal-prev').onclick = () => calMove(-1);
        TC.el('sx-cal-next').onclick = () => calMove(1);
        TC.el('sx-cal-today').onclick = () => { state.calDate = new Date(); renderCalendar(); };
        renderCalendar();
    }
    function calMove(delta) { state.calDate = new Date(state.calDate.getFullYear(), state.calDate.getMonth() + delta, 1); renderCalendar(); }
    /* Grille du mois affiché, comme le calendrier des dividendes côté app :
       un jour par case, coloré selon qu'une séance y est enregistrée, plutôt
       qu'un tableau à plat listant chaque jour ouvré de l'année. */
    async function renderCalendar() {
        const grid = TC.el('sx-calendar'); if (!grid) return;
        const holidays = new Set((state.holidays || '').split(',').map(x => x.trim()).filter(Boolean));
        const y = state.calDate.getFullYear(), m = state.calDate.getMonth();
        const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
        const monthStart = TC.toISODate(first), nextMonthStart = TC.toISODate(new Date(y, m + 1, 1));
        TC.el('sx-cal-title').textContent = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        const rows = await TC.getAll('historique', 'select=date_seance&date_seance=gte.' + monthStart + '&date_seance=lt.' + nextMonthStart);
        const have = new Set((rows || []).map(r => r.date_seance));
        const today = TC.today();
        const names = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        let html = names.map(n => '<div class="tc-cal-dow">' + n + '</div>').join('');
        const offset = (first.getDay() + 6) % 7;
        for (let i = 0; i < offset; i++) html += '<div class="tc-cal-day empty"></div>';
        let missing = 0, expected = 0;
        for (let d = 1; d <= last.getDate(); d++) {
            const iso = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            const weekend = TC.isWeekend(iso), holiday = holidays.has(iso), ouvre = !weekend && !holiday;
            const ok = ouvre && have.has(iso), manque = ouvre && !have.has(iso);
            if (ouvre) { expected++; if (manque) missing++; }
            html += '<div class="tc-cal-day' + (weekend || holiday ? ' weekend' : '') + (ok ? ' ok' : '') + (manque ? ' missing' : '') + (iso === today ? ' today' : '') + '">' +
                '<span class="n">' + d + '</span>' +
                (ok ? '<span class="tc-cal-event">Séance enregistrée</span>' : '') +
                (manque ? '<span class="tc-cal-event" style="background:rgba(248,113,113,.16);color:var(--red)">Manquante</span>' : '') +
                (holiday && !weekend ? '<span class="tc-cal-event" style="background:rgba(245,240,232,.08);color:var(--muted)">Férié</span>' : '') +
                '</div>';
        }
        grid.innerHTML = html;
        const countEl = TC.el('sx-count');
        if (countEl) countEl.textContent = expected ? (expected - missing) + ' / ' + expected + ' séance(s) attendue(s)' : 'aucun jour ouvré ce mois-ci';
    }
    TC.register({id:'seances-excel',label:'Séances & import Excel',group:'marche',icon:'▦',view,mount,refresh:renderCalendar});
})(window.TC);
