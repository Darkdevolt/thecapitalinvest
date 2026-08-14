/*
   THE CAPITAL — IMPORT EXCEL / CSV
   Import admin robuste + prévisualisation + taux de complétude.
   Aucun changement de schéma Supabase ni de logique métier.
*/
(function(){
    'use strict';

    var importState = {
        file: null,
        rows: [],
        template: null,
        headers: [],
        report: null
    };

    var NUMBER_FIELDS = new Set([
        'cours_cloture','cours_ouverture','ouverture','plus_haut','plus_bas','volume','variation','variation_pct',
        'valeur_totale','capitalisation','nombre_actions','annee','chiffre_affaires','rbe','resultat_net','ebit','ebitda',
        'bpa','dpa','fonds_propres','dettes_financieres','dette_nette','total_actif','cash_flow_operationnel','capex',
        'montant','taux_rendement','valeur','pourcentage','capital_social_fcfa','valeur_nominale'
    ]);

    var PERCENT_FIELDS = new Set(['variation','variation_pct','taux_rendement','pourcentage','dividend_yield','rendement_dividende','payout_ratio']);

    var TABLE_FIELDS = {
        entreprises: ['ticker','nom','secteur','pays','compartiment','isin','description','nombre_actions'],
        cours: ['ticker','date_seance','cours_cloture','cours_ouverture','plus_haut','plus_bas','volume','variation','valeur_totale'],
        financials: ['ticker','annee','periode','chiffre_affaires','rbe','resultat_net','ebit','ebitda','bpa','dpa','fonds_propres','dettes_financieres','dette_nette','total_actif','nombre_actions','cash_flow_operationnel','capex','source','source_url','source_page','validation_status','validation_notes'],
        dividendes: ['ticker','annee','montant','taux_rendement','date_detachement','date_paiement','statut','exercice','notes'],
        indices: ['indice','date_seance','valeur','variation','variation_pct'],
        actionnaires: ['ticker','nom_actionnaire','pourcentage','type_actionnaire','pays_origine']
    };

    var ALIASES = {
        ticker:['ticker','code','symbol','symbole','code_valeur'],
        nom:['nom','nom_complet','societe','société','entreprise'],
        nom_actionnaire:['nom_actionnaire','actionnaire','nom'],
        date_seance:['date_seance','date','date_session','date_cotation'],
        cours_cloture:['cours_cloture','cours','cloture','clôture','close','cours_de_cloture'],
        cours_ouverture:['cours_ouverture','ouverture','open','ouv'],
        plus_haut:['plus_haut','haut','high'],
        plus_bas:['plus_bas','bas','low'],
        volume:['volume','vol','quantite','quantité'],
        variation:['variation','var','variation_pct','variation_%','pct','pourcentage_variation'],
        valeur_totale:['valeur_totale','capitalisation','capi','cap'],
        annee:['annee','année','year'],
        periode:['periode','période','period'],
        chiffre_affaires:['chiffre_affaires','ca','chiffre_d_affaires'],
        rbe:['rbe','ebitda_ancien'],
        resultat_net:['resultat_net','résultat_net','rn'],
        ebit:['ebit'], ebitda:['ebitda'], bpa:['bpa'], dpa:['dpa'], fonds_propres:['fonds_propres','capitaux_propres'],
        dettes_financieres:['dettes_financieres','dettes','dette_financiere'], dette_nette:['dette_nette'], total_actif:['total_actif','actif_total'],
        nombre_actions:['nombre_actions','nb_actions','nb_action','actions'], cash_flow_operationnel:['cash_flow_operationnel','cfo','cash_flow'], capex:['capex'],
        source:['source','origine'], source_url:['source_url','url_source'], source_page:['source_page','page_source'],
        montant:['montant','dividende','dividende_par_action'], taux_rendement:['taux_rendement','rendement','rendement_dividende','dividend_yield'],
        date_detachement:['date_detachement','date_detachement_dividende','ex_date'], date_paiement:['date_paiement','payment_date'],
        statut:['statut','status'], exercice:['exercice','exercice_comptable'], notes:['notes','commentaires','commentaire'],
        indice:['indice','index'], valeur:['valeur','niveau','cours_indice'], variation_pct:['variation_pct','variation_%','variation_pourcent'],
        type_actionnaire:['type_actionnaire','type'], pays_origine:['pays_origine','pays'], pourcentage:['pourcentage','pct','part','participation']
    };

    var REQUIRED = {
        entreprises:['ticker','nom'],
        cours:['ticker','date_seance','cours_cloture'],
        financials:['ticker','annee'],
        dividendes:['ticker','annee','montant'],
        indices:['indice','date_seance','valeur'],
        actionnaires:['ticker','nom_actionnaire','pourcentage']
    };

    function esc(v){
        return String(v === null || v === undefined ? '' : v)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }

    function normHeader(v){
        return String(v === null || v === undefined ? '' : v)
            .trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
            .replace(/[\s\-\/]+/g,'_');
    }

    function findColumn(headers, aliases){
        var normalized = headers.map(normHeader);
        for(var i=0;i<aliases.length;i++){
            var a = normHeader(aliases[i]);
            var idx = normalized.indexOf(a);
            if(idx >= 0) return headers[idx];
        }
        return null;
    }

    function parseNumber(v){
        if(v === null || v === undefined || v === '') return null;
        if(typeof v === 'number') return isFinite(v) ? v : null;
        var s = String(v).trim();
        if(!s) return null;
        var pct = /%$/.test(s);
        s = s.replace(/\s/g,'').replace(/%$/,'');
        if(s.indexOf(',') >= 0 && s.indexOf('.') >= 0){
            if(s.lastIndexOf(',') > s.lastIndexOf('.')) s=s.replace(/\./g,'').replace(',','.');
            else s=s.replace(/,/g,'');
        } else if(s.indexOf(',') >= 0){
            s=s.replace(/,/g,'.');
        }
        var n=parseFloat(s);
        if(!isFinite(n)) return null;
        return pct ? n : n;
    }

    function excelDateToISO(v){
        if(v === null || v === undefined || v === '') return null;
        if(typeof v === 'number' && isFinite(v) && v > 20000 && v < 100000){
            var d = XLSX.SSF.parse_date_code(v);
            if(d && d.y && d.m && d.d) return String(d.y).padStart(4,'0')+'-'+String(d.m).padStart(2,'0')+'-'+String(d.d).padStart(2,'0');
        }
        var s=String(v).trim();
        if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        var m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
        if(m){
            var a=parseInt(m[1],10), b=parseInt(m[2],10), y=parseInt(m[3],10);
            if(y<100) y += y<50 ? 2000 : 1900;
            /* Pour un format ambigu, le template BRVM est interprété en DD/MM/YYYY. */
            var day=a, month=b;
            if(a>12){ day=a; month=b; }
            else if(b>12){ day=b; month=a; }
            return String(y).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
        }
        var d2=new Date(s);
        if(!isNaN(d2.getTime())) return d2.toISOString().slice(0,10);
        return null;
    }

    function cellIsPercentage(cell){
        return !!(cell && ((cell.z && String(cell.z).indexOf('%')>=0) || (cell.w && /%/.test(String(cell.w)))));
    }

    function normalizePercent(raw, cell){
        var n=parseNumber(raw);
        if(n === null) return null;
        /* Excel stocke 69% sous forme 0.69. La base, elle, attend 69. */
        if(cellIsPercentage(cell) && Math.abs(n) <= 1) return n*100;
        return n;
    }

    function displayPercent(v){
        var n=parseNumber(v);
        return n === null ? '—' : n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' %';
    }

    function displayValue(v, field){
        if(v === null || v === undefined || v === '') return '—';
        if(PERCENT_FIELDS.has(field)) return displayPercent(v);
        if(field.indexOf('date') === 0) return esc(v);
        if(typeof v === 'number') return v.toLocaleString('fr-FR',{maximumFractionDigits:4});
        return esc(v);
    }

    function getCell(sheet, header, rowIndex){
        var range=XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
        var headers=[];
        for(var c=range.s.c;c<=range.e.c;c++){
            var addr=XLSX.utils.encode_cell({r:range.s.r,c:c});
            headers.push(sheet[addr] ? sheet[addr].v : '');
        }
        var idx=headers.indexOf(header);
        if(idx<0) return null;
        var addr2=XLSX.utils.encode_cell({r:range.s.r+rowIndex+1,c:range.s.c+idx});
        return sheet[addr2] || null;
    }

    function inferTemplate(headers){
        var h=headers.map(normHeader);
        var best='',score=0;
        Object.keys(TEMPLATE_CONFIG || {}).forEach(function(key){
            var cfg=TEMPLATE_CONFIG[key];
            var s=(cfg.required||[]).reduce(function(acc,f){
                var aliases=ALIASES[f] || [f];
                return acc + (findColumn(headers,aliases) ? 2 : 0);
            },0);
            (cfg.headers||[]).forEach(function(f){ if(h.indexOf(normHeader(f))>=0) s+=1; });
            if(s>score){score=s;best=key;}
        });
        return score>0 ? best : null;
    }

    function mapRow(raw, headers, template, sheet, rowIndex){
        var fields=TABLE_FIELDS[template] || headers;
        var out={};
        fields.forEach(function(field){
            var col=findColumn(headers, ALIASES[field] || [field]);
            if(!col) return;
            var value=raw[col];
            var cell=getCell(sheet,col,rowIndex);
            if(field.indexOf('date')===0) value=excelDateToISO(value);
            else if(PERCENT_FIELDS.has(field)) value=normalizePercent(value,cell);
            else if(NUMBER_FIELDS.has(field)) value=parseNumber(value);
            else if(field==='ticker' && value!==null && value!==undefined) value=String(value).trim().toUpperCase();
            else if(field==='periode' && value!==null && value!==undefined) value=String(value).trim();
            if(value!==null && value!==undefined && value!=='') out[field]=value;
        });

        if(template==='financials' && !out.periode) out.periode='annuel';
        if(template==='dividendes' && !out.exercice && out.annee) out.exercice=String(out.annee);
        if(template==='cours' && out.cours_ouverture!==undefined && out.cours_cloture!==undefined && out.variation===undefined && Number(out.cours_ouverture)!==0){
            out.variation=((Number(out.cours_cloture)-Number(out.cours_ouverture))/Number(out.cours_ouverture))*100;
        }
        return out;
    }

    function validateRows(rows,template){
        var required=REQUIRED[template] || [];
        var seen=new Set();
        var valid=0, warnings=0;
        var details=rows.map(function(row,i){
            var errors=[];
            required.forEach(function(f){ if(row[f]===undefined || row[f]===null || row[f]==='') errors.push(f+' manquant'); });
            if(template==='cours' && row.date_seance && !excelDateToISO(row.date_seance)) errors.push('date invalide');
            if(row.ticker && !/^[A-Z0-9.\-]{2,20}$/.test(String(row.ticker))) errors.push('ticker invalide');
            var key=required.map(function(f){return row[f]===undefined?'':String(row[f]).toUpperCase();}).join('|');
            if(key && seen.has(key)) errors.push('doublon dans le fichier');
            if(key) seen.add(key);
            var allFields=TABLE_FIELDS[template] || Object.keys(row);
            var filled=allFields.filter(function(f){return row[f]!==undefined && row[f]!==null && row[f]!=='';}).length;
            var completeness=allFields.length ? Math.round(filled/allFields.length*100) : 0;
            if(errors.length===0) valid++; else warnings++;
            return {row:row,errors:errors,completeness:completeness,line:i+2};
        });
        return {details:details,total:rows.length,valid:valid,invalid:rows.length-valid,validPct:rows.length?Math.round(valid/rows.length*100):0};
    }

    function setMessage(text,type){
        var el=document.getElementById('import-msg');
        if(el){el.textContent=text||'';el.className='msg '+(type||'');}
    }

    function resetUploadUI(){
        var ids=['upload-info','preview-card','progress-card'];
        ids.forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});
        var f=document.getElementById('excel-file');if(f)f.value='';
        importState={file:null,rows:[],template:null,headers:[],report:null};
    }

    window.downloadTemplate=function(template){
        if(typeof XLSX==='undefined'){toast('Le moteur Excel n’est pas chargé. Rechargez la page.','err');return;}
        var cfg=TEMPLATE_CONFIG[template];
        if(!cfg){toast('Template inconnu : '+template,'err');return;}
        var row={};
        cfg.headers.forEach(function(h){row[h]='';});
        var ws=XLSX.utils.json_to_sheet([row],{header:cfg.headers});
        var wb=XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb,ws,cfg.name.substring(0,31));
        var guide=[
            ['Template','The Capital — '+cfg.name],
            ['Champs obligatoires',(cfg.required||[]).join(', ')],
            ['Instructions','Conservez les noms de colonnes du template. Les dates sont YYYY-MM-DD. Les pourcentages peuvent être saisis comme 0.69 ou 0.69% selon votre besoin.']
        ];
        var wsg=XLSX.utils.aoa_to_sheet(guide);
        XLSX.utils.book_append_sheet(wb,wsg,'README');
        XLSX.writeFile(wb,cfg.name+'.xlsx');
    };

    window.handleFileSelect=function(event){
        var file=event && event.target && event.target.files ? event.target.files[0] : null;
        if(file) processExcelFile(file);
    };

    window.forceTemplate=function(value){
        if(!value) return;
        importState.template=value;
        if(importState.file) processExcelFile(importState.file,value);
    };

    async function processExcelFile(file,forcedTemplate){
        setMessage('');
        if(!file) return;
        if(file.size>5*1024*1024){setMessage('Fichier trop volumineux : maximum 5 MB.','err');return;}
        if(typeof XLSX==='undefined'){setMessage('Le moteur Excel n’est pas disponible. Vérifiez le chargement de SheetJS puis rechargez la page.','err');return;}
        importState.file=file;
        var info=document.getElementById('upload-info'); if(info) info.style.display='block';
        var fn=document.getElementById('upload-filename'); if(fn) fn.textContent=file.name;
        try{
            var buffer=await file.arrayBuffer();
            var wb=XLSX.read(buffer,{type:'array',cellNF:true,cellDates:false});
            if(!wb.SheetNames.length) throw new Error('Aucune feuille détectée.');
            var sheetName=wb.SheetNames[0];
            var sheet=wb.Sheets[sheetName];
            var matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,raw:true,blankrows:false});
            if(!matrix.length) throw new Error('La feuille Excel est vide.');
            var headers=(matrix[0]||[]).map(function(v){return String(v===null||v===undefined?'':v).trim();}).filter(Boolean);
            if(!headers.length) throw new Error('La première ligne ne contient aucune colonne.');
            var rawRows=XLSX.utils.sheet_to_json(sheet,{defval:null,raw:true,blankrows:false});
            var template=forcedTemplate || importState.template || inferTemplate(headers);
            if(!template) throw new Error('Template non reconnu. Utilisez « Forcer le template ».');
            importState.template=template; importState.headers=headers;
            importState.rows=rawRows.map(function(r,i){return mapRow(r,headers,template,sheet,i);});
            importState.report=validateRows(importState.rows,template);
            var badge=document.getElementById('upload-sheet-detected'); if(badge){badge.style.display='inline-flex';badge.textContent='Template : '+template;}
            var hfound=document.getElementById('upload-headers-found'); if(hfound) hfound.textContent=headers.length+' colonne(s) · feuille « '+sheetName+' » · '+rawRows.length+' ligne(s)';
            var cols=document.getElementById('upload-colonnes'); if(cols) cols.textContent='Colonnes : '+headers.join(' · ');
            var manual=document.getElementById('manual-template'); if(manual) manual.value=template;
            renderPreview();
        }catch(e){
            console.error('[Import Excel]',e);
            setMessage('Impossible de lire le fichier : '+e.message,'err');
            var alert=document.getElementById('upload-template-alert'); if(alert) alert.style.display='block';
        }
    }

    function renderPreview(){
        var card=document.getElementById('preview-card'); if(card) card.style.display='block';
        var count=document.getElementById('preview-count');
        var r=importState.report;
        if(count) count.textContent=r.valid+' / '+r.total+' lignes valides — '+r.validPct+'%';
        var summary=document.getElementById('import-summary');
        if(summary){
            var cls=r.valid===r.total?'ok':(r.valid>0?'warn':'err');
            summary.innerHTML='<div class="import-summary-item '+cls+'"><strong>'+r.validPct+'%</strong><span>lignes valides</span></div>'+
                '<div class="import-summary-item"><strong>'+r.valid+'</strong><span>prêtes à importer</span></div>'+
                '<div class="import-summary-item '+(r.invalid?'err':'ok')+'"><strong>'+r.invalid+'</strong><span>à corriger</span></div>';
        }
        var thead=document.getElementById('preview-thead');
        var tbody=document.getElementById('preview-tbody');
        if(!thead||!tbody)return;
        var fields=TABLE_FIELDS[importState.template] || Object.keys(importState.rows[0]||{});
        thead.innerHTML='<tr>'+fields.map(function(f){return '<th>'+esc(f)+'</th>';}).join('')+'<th>Complétude</th><th>Validation</th></tr>';
        tbody.innerHTML=r.details.slice(0,200).map(function(d){
            var row=d.row;
            var status=d.errors.length ? '<span class="badge badge-red">✕ '+esc(d.errors.join(', '))+'</span>' : '<span class="badge badge-green">✓ OK</span>';
            var pctClass=d.completeness>=90?'ok':(d.completeness>=60?'warn':'err');
            return '<tr>'+fields.map(function(f){return '<td class="r">'+displayValue(row[f],f)+'</td>';}).join('')+
                '<td><div style="display:flex;align-items:center;gap:7px;min-width:100px;"><div class="progress-bar" style="flex:1;min-width:50px;height:6px;"><div class="progress-fill '+pctClass+'" style="width:'+d.completeness+'%"></div></div><span style="font-family:var(--mono);font-size:11px;">'+d.completeness+'%</span></div></td>'+
                '<td>'+status+'</td></tr>';
        }).join('');
        if(r.total>200){tbody.innerHTML+='<tr><td colspan="'+(fields.length+2)+'" style="text-align:center;color:var(--muted);padding:10px;">Aperçu limité aux 200 premières lignes. L’import porte sur les '+r.total+' lignes.</td></tr>';}
    }

    window.confirmImport=async function(){
        var r=importState.report;
        if(!r || !importState.template){setMessage('Aucune donnée à importer.','err');return;}
        if(!r.valid){setMessage('Import bloqué : aucune ligne valide. Corrigez les erreurs.','err');return;}
        var btn=document.getElementById('btn-confirm-import'); if(btn) btn.disabled=true;
        var pc=document.getElementById('progress-card'); if(pc) pc.style.display='block';
        var validRows=r.details.filter(function(d){return d.errors.length===0;}).map(function(d){return d.row;});
        var cfg=TEMPLATE_CONFIG[importState.template];
        var table=cfg && cfg.table ? cfg.table : importState.template;
        var conflict=cfg && cfg.uniqueKey ? cfg.uniqueKey : null;
        var progress=document.getElementById('import-progress');
        var pct=document.getElementById('progress-pct');
        var text=document.getElementById('progress-text');
        var log=document.getElementById('progress-log');
        var inserted=0, failed=0;
        try{
            for(var i=0;i<validRows.length;i+=50){
                var batch=validRows.slice(i,i+50);
                var result=await sbPost(table,batch,conflict);
                if(result){inserted+=batch.length;} else {failed+=batch.length;}
                var p=Math.round((Math.min(i+batch.length,validRows.length)/validRows.length)*100);
                if(progress)progress.style.width=p+'%';
                if(pct)pct.textContent=p+'%';
                if(text)text.textContent='Insertion '+Math.min(i+batch.length,validRows.length)+' / '+validRows.length;
                if(log)log.innerHTML+=esc('Batch '+(Math.floor(i/50)+1)+' : '+(result?'OK':'échec'))+'<br>';
            }
            if(inserted===validRows.length){
                setMessage('✓ Import terminé : '+inserted+' ligne(s) importée(s).','ok');
                toast('✓ '+inserted+' ligne(s) importée(s)','ok');
                if(typeof loadCours==='function' && table==='historique') loadCours();
                if(typeof loadEntreprises==='function' && table==='entreprises') loadEntreprises();
                if(typeof loadFinancials==='function' && table==='financials') loadFinancials();
                if(typeof loadDividendes==='function' && table==='dividendes_calendrier') loadDividendes();
                if(typeof loadIndices==='function' && table==='indices') loadIndices();
            }else{
                setMessage('Import partiel : '+inserted+' OK, '+failed+' en échec. Vérifiez le journal.','err');
            }
        }catch(e){
            console.error('[confirmImport]',e);
            setMessage('Erreur pendant l’import : '+e.message,'err');
        }finally{
            if(btn)btn.disabled=false;
        }
    };

    window.cancelImport=function(){
        var card=document.getElementById('preview-card');if(card)card.style.display='none';
        var pc=document.getElementById('progress-card');if(pc)pc.style.display='none';
        setMessage('');
    };

    function initDropZone(){
        var zone=document.getElementById('drop-zone');
        if(!zone)return;
        ['dragenter','dragover'].forEach(function(ev){zone.addEventListener(ev,function(e){e.preventDefault();e.stopPropagation();zone.classList.add('dragover');});});
        ['dragleave','drop'].forEach(function(ev){zone.addEventListener(ev,function(e){e.preventDefault();e.stopPropagation();zone.classList.remove('dragover');});});
        zone.addEventListener('drop',function(e){var files=e.dataTransfer&&e.dataTransfer.files;if(files&&files[0])processExcelFile(files[0]);});
    }

    function init(){
        initDropZone();
        var file=document.getElementById('excel-file');
        if(file) file.addEventListener('change',handleFileSelect);
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
