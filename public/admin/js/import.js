/*
 * THE CAPITAL — ADMIN / IMPORT EXCEL
 * Import robuste XLSX / XLS / CSV + prévisualisation lisible + complétude.
 * Ne modifie ni Supabase ni le schéma de données.
 */
(function () {
    'use strict';

    var state = { file: null, template: '', rows: [], report: null };

    var CONFIG = {
        entreprises: {
            name: 'BRVM_Entreprises', table: 'entreprises', unique: 'ticker',
            headers: ['ticker','nom','nom_complet','pays','secteur','compartiment','capital_social_fcfa','nombre_actions','valeur_nominale','isin','description','site_web','date_introduction','siege_social','actif'],
            required: ['ticker','nom','pays','secteur','compartiment']
        },
        cours: {
            name: 'BRVM_Cours', table: 'historique', unique: 'ticker,date_seance',
            headers: ['ticker','date_seance','cours_cloture','cours_ouverture','plus_haut','plus_bas','volume','variation','valeur_totale','plus_haut_52','plus_bas_52'],
            required: ['ticker','date_seance','cours_cloture']
        },
        financials: {
            name: 'BRVM_Financials', table: 'financials', unique: 'ticker,annee,periode',
            headers: ['ticker','annee','periode','chiffre_affaires','rbe','resultat_net','bpa','dpa','fonds_propres','dettes_financieres','total_actif','nombre_actions','cash_flow_operationnel','capex','source'],
            required: ['ticker','annee']
        },
        dividendes: {
            name: 'BRVM_Dividendes', table: 'dividendes_calendrier', unique: 'ticker,exercice',
            headers: ['ticker','annee','montant','taux_rendement','date_detachement','date_paiement','statut','exercice','notes'],
            required: ['ticker','annee','montant']
        },
        indices: {
            name: 'BRVM_Indices', table: 'indices', unique: 'indice,date_seance',
            headers: ['indice','date_seance','valeur','variation','variation_pct'],
            required: ['indice','date_seance','valeur']
        },
        actionnaires: {
            name: 'BRVM_Actionnaires', table: 'actionnaires', unique: null,
            headers: ['ticker','nom_actionnaire','pourcentage','type_actionnaire','pays_origine'],
            required: ['ticker','nom_actionnaire','pourcentage']
        }
    };

    var ALIAS = {
        ticker:['ticker','code','symbol','symbole','code_valeur','isin'],
        nom:['nom','nom_complet','societe','société','entreprise'],
        nom_complet:['nom_complet','nom','societe','société'],
        pays:['pays','country'], secteur:['secteur','sector'], compartiment:['compartiment','segment'],
        capital_social_fcfa:['capital_social_fcfa','capital_social','capital'], nombre_actions:['nombre_actions','nb_actions','nb_action','actions'],
        valeur_nominale:['valeur_nominale','nominal'], isin:['isin'], description:['description'], site_web:['site_web','website','url'],
        date_introduction:['date_introduction','date_ipo'], siege_social:['siege_social','siège_social'], actif:['actif','active'],
        date_seance:['date_seance','date','date_session','date_cotation'], cours_cloture:['cours_cloture','cours','cloture','clôture','close','cours_de_cloture'],
        cours_ouverture:['cours_ouverture','ouverture','open','ouv'], plus_haut:['plus_haut','haut','high'], plus_bas:['plus_bas','bas','low'],
        volume:['volume','vol','quantite','quantité'], variation:['variation','var','variation_pct','variation_%','pct','pourcentage_variation'],
        valeur_totale:['valeur_totale','capitalisation','capi','cap'], plus_haut_52:['plus_haut_52','haut_52','high_52'], plus_bas_52:['plus_bas_52','bas_52','low_52'],
        annee:['annee','année','year'], periode:['periode','période','period'], chiffre_affaires:['chiffre_affaires','ca','chiffre_d_affaires'],
        rbe:['rbe'], resultat_net:['resultat_net','résultat_net','rn'], bpa:['bpa'], dpa:['dpa'], fonds_propres:['fonds_propres','capitaux_propres'],
        dettes_financieres:['dettes_financieres','dettes','dette_financiere'], total_actif:['total_actif','actif_total'], cash_flow_operationnel:['cash_flow_operationnel','cfo','cash_flow'], capex:['capex'], source:['source','origine'],
        montant:['montant','dividende','dividende_par_action'], taux_rendement:['taux_rendement','rendement','rendement_dividende','dividend_yield'],
        date_detachement:['date_detachement','ex_date'], date_paiement:['date_paiement','payment_date'], statut:['statut','status'], exercice:['exercice','exercice_comptable'], notes:['notes','commentaires','commentaire'],
        indice:['indice','index'], valeur:['valeur','niveau','cours_indice'], variation_pct:['variation_pct','variation_%','variation_pourcent'],
        nom_actionnaire:['nom_actionnaire','actionnaire','nom'], pourcentage:['pourcentage','pct','part','participation'], type_actionnaire:['type_actionnaire','type'], pays_origine:['pays_origine','pays']
    };

    var NUMBER_FIELDS = new Set([
        'cours_cloture','cours_ouverture','plus_haut','plus_bas','volume','variation','variation_pct','valeur_totale','plus_haut_52','plus_bas_52',
        'capital_social_fcfa','nombre_actions','valeur_nominale','annee','chiffre_affaires','rbe','resultat_net','bpa','dpa','fonds_propres','dettes_financieres','total_actif','cash_flow_operationnel','capex','montant','taux_rendement','valeur','pourcentage'
    ]);
    var PERCENT_FIELDS = new Set(['variation','variation_pct','taux_rendement','pourcentage','dividend_yield','rendement_dividende','payout_ratio']);
    var DATE_FIELDS = new Set(['date_seance','date_introduction','date_detachement','date_paiement']);

    function esc(v) {
        return String(v === null || v === undefined ? '' : v)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }
    function norm(v) {
        return String(v === null || v === undefined ? '' : v).trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s\-\/]+/g,'_');
    }
    function findColumn(headers, field) {
        var aliases = ALIAS[field] || [field];
        var normalized = headers.map(norm);
        for (var i=0;i<aliases.length;i++) {
            var idx = normalized.indexOf(norm(aliases[i]));
            if (idx >= 0) return headers[idx];
        }
        return null;
    }
    function parseNumber(v) {
        if (v === null || v === undefined || v === '') return null;
        if (typeof v === 'number') return isFinite(v) ? v : null;
        var s = String(v).trim().replace(/\s/g,'').replace(/%$/,'');
        if (!s) return null;
        if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) {
            if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g,'').replace(',','.');
            else s = s.replace(/,/g,'');
        } else if (s.indexOf(',') >= 0) {
            s = s.replace(/,/g,'.');
        }
        var n = Number(s);
        return isFinite(n) ? n : null;
    }
    function excelDate(v) {
        if (v === null || v === undefined || v === '') return null;
        if (typeof v === 'number' && isFinite(v) && typeof XLSX !== 'undefined' && XLSX.SSF) {
            var d = XLSX.SSF.parse_date_code(v);
            if (d && d.y && d.m && d.d) return d.y+'-'+String(d.m).padStart(2,'0')+'-'+String(d.d).padStart(2,'0');
        }
        var s = String(v).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        var m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
        if (m) {
            var a=+m[1], b=+m[2], y=+m[3]; if(y<100)y+=y<50?2000:1900;
            var day=a, month=b; if(a<=12 && b>12){day=b;month=a;}
            return y+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
        }
        var dt = new Date(s);
        return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0,10);
    }
    function getSheetCell(sheet, headers, header, rowIndex) {
        if (!sheet || !sheet['!ref'] || typeof XLSX === 'undefined') return null;
        var range=XLSX.utils.decode_range(sheet['!ref']), idx=headers.indexOf(header);
        if(idx<0)return null;
        return sheet[XLSX.utils.encode_cell({r:range.s.r+rowIndex+1,c:range.s.c+idx})] || null;
    }
    function percentValue(raw, cell) {
        var n=parseNumber(raw); if(n===null)return null;
        var formatted = cell && ((cell.z && String(cell.z).indexOf('%')>=0) || (cell.w && /%/.test(String(cell.w))));
        return formatted && Math.abs(n)<=1 ? n*100 : n;
    }
    function fmtPercent(v) {
        var n=parseNumber(v); return n===null?'—':n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' %';
    }
    function fmt(v, field) {
        if(v===null||v===undefined||v==='')return '—';
        if(PERCENT_FIELDS.has(field))return fmtPercent(v);
        if(DATE_FIELDS.has(field))return esc(v);
        if(typeof v==='number')return v.toLocaleString('fr-FR',{maximumFractionDigits:4});
        return esc(v);
    }
    function detectTemplate(headers) {
        var best='', bestScore=-1;
        Object.keys(CONFIG).forEach(function(key){
            var cfg=CONFIG[key], score=0;
            (cfg.required||[]).forEach(function(f){if(findColumn(headers,f))score+=10;});
            (cfg.headers||[]).forEach(function(f){if(headers.map(norm).indexOf(norm(f))>=0)score+=1;});
            if(score>bestScore){bestScore=score;best=key;}
        });
        return bestScore>=10 ? best : '';
    }
    function mapRow(raw, headers, template, sheet, rowIndex) {
        var cfg=CONFIG[template], out={};
        cfg.headers.forEach(function(field){
            var col=findColumn(headers,field); if(!col)return;
            var value=raw[col], cell=getSheetCell(sheet,headers,col,rowIndex);
            if(DATE_FIELDS.has(field)) value=excelDate(value);
            else if(PERCENT_FIELDS.has(field)) value=percentValue(value,cell);
            else if(NUMBER_FIELDS.has(field)) value=parseNumber(value);
            else if(field==='ticker' && value!==null && value!==undefined) value=String(value).trim().toUpperCase();
            else if(field==='indice' && value!==null && value!==undefined) value=String(value).trim().toUpperCase();
            else if(field==='periode' && value!==null && value!==undefined) value=String(value).trim();
            if(value!==null && value!==undefined && value!=='') out[field]=value;
        });
        if(template==='financials' && !out.periode) out.periode='annuel';
        if(template==='dividendes' && !out.exercice && out.annee) out.exercice=String(out.annee);
        if(template==='cours' && out.cours_ouverture!==undefined && out.cours_cloture!==undefined && out.variation===undefined && Number(out.cours_ouverture)!==0) {
            out.variation=((Number(out.cours_cloture)-Number(out.cours_ouverture))/Number(out.cours_ouverture))*100;
        }
        return out;
    }
    function validate(rows,template) {
        var cfg=CONFIG[template], seen=new Set(), details=[], valid=0;
        rows.forEach(function(row,i){
            var errors=[];
            cfg.required.forEach(function(f){if(row[f]===undefined||row[f]===null||row[f]==='')errors.push(f+' manquant');});
            if(row.ticker && !/^[A-Z0-9.\-]{2,20}$/.test(String(row.ticker)))errors.push('ticker invalide');
            var key=cfg.unique ? cfg.unique.split(',').map(function(f){return String(row[f]===undefined?'':row[f]).trim().toUpperCase();}).join('|') : '';
            if(key && seen.has(key))errors.push('doublon dans le fichier');
            if(key)seen.add(key);
            var fields=cfg.headers, filled=fields.filter(function(f){return row[f]!==undefined&&row[f]!==null&&row[f]!=='';}).length;
            details.push({row:row,errors:errors,line:i+2,completeness:Math.round(filled/fields.length*100)});
            if(!errors.length)valid++;
        });
        return {details:details,total:rows.length,valid:valid,invalid:rows.length-valid,validPct:rows.length?Math.round(valid/rows.length*100):0};
    }
    function msg(text,type){var el=document.getElementById('import-msg');if(el){el.textContent=text||'';el.className='msg '+(type||'');}}

    window.downloadTemplate=function(template){
        if(typeof XLSX==='undefined'){toast('Le moteur Excel n’est pas chargé. Rechargez la page.','err');return;}
        var cfg=CONFIG[template];if(!cfg){toast('Template inconnu.','err');return;}
        var ws=XLSX.utils.aoa_to_sheet([cfg.headers]);
        ws['!cols']=cfg.headers.map(function(h){return {wch:Math.max(12,Math.min(28,h.length+3))};});
        cfg.headers.forEach(function(h,i){
            var cell=XLSX.utils.encode_cell({r:0,c:i});
            if(PERCENT_FIELDS.has(h)) ws[cell].z='0.00%';
        });
        var readme=XLSX.utils.aoa_to_sheet([
            ['The Capital Invest — '+cfg.name],
            ['Champs obligatoires',cfg.required.join(', ')],
            ['Pourcentages','Saisissez 0.69 pour 0,69 %. Si la cellule Excel est au format %, 0,69 % sera également reconnu.'],
            ['Dates','YYYY-MM-DD recommandé.'],
            ['Important','Ne renommez pas les colonnes du template.']
        ]);
        var wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,cfg.name.slice(0,31));XLSX.utils.book_append_sheet(wb,readme,'README');
        XLSX.writeFile(wb,cfg.name+'.xlsx');
    };

    async function readFile(file,forced) {
        state.file=file; state.rows=[]; state.report=null;
        if(!file)return;
        if(file.size>5*1024*1024){msg('Fichier trop volumineux : maximum 5 MB.','err');return;}
        if(typeof XLSX==='undefined'){msg('Le moteur Excel n’est pas chargé. Rechargez la page.','err');return;}
        var name=(file.name||'').toLowerCase();
        if(!/\.(xlsx|xls|csv)$/.test(name)){msg('Format non supporté. Utilisez .xlsx, .xls ou .csv.','err');return;}
        var info=document.getElementById('upload-info');if(info)info.style.display='block';
        var fn=document.getElementById('upload-filename');if(fn)fn.textContent=file.name;
        try{
            var buffer=await file.arrayBuffer();
            var wb=XLSX.read(buffer,{type:'array',cellNF:true,cellDates:false});
            if(!wb.SheetNames.length)throw new Error('Aucune feuille détectée.');
            var sheetName=wb.SheetNames[0], sheet=wb.Sheets[sheetName];
            var matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,raw:true,blankrows:false});
            if(!matrix.length)throw new Error('La feuille Excel est vide.');
            var headers=(matrix[0]||[]).map(function(v){return String(v==null?'':v).trim();}).filter(Boolean);
            if(!headers.length)throw new Error('La première ligne ne contient aucune colonne.');
            var rawRows=XLSX.utils.sheet_to_json(sheet,{defval:null,raw:true,blankrows:false});
            var template=forced || detectTemplate(headers);
            if(!template)throw new Error('Template non reconnu. Sélectionnez-le manuellement.');
            state.template=template;
            state.rows=rawRows.map(function(r,i){return mapRow(r,headers,template,sheet,i);});
            state.report=validate(state.rows,template);
            var badge=document.getElementById('upload-sheet-detected');if(badge){badge.style.display='inline-flex';badge.textContent='Template : '+template;}
            var found=document.getElementById('upload-headers-found');if(found)found.textContent=headers.length+' colonne(s) · feuille « '+sheetName+' » · '+rawRows.length+' ligne(s)';
            var cols=document.getElementById('upload-colonnes');if(cols)cols.textContent='Colonnes : '+headers.join(' · ');
            var manual=document.getElementById('manual-template');if(manual)manual.value=template;
            var alert=document.getElementById('upload-template-alert');if(alert)alert.style.display='none';
            renderPreview();
        }catch(e){console.error(e);msg('Impossible de lire le fichier : '+e.message,'err');var a=document.getElementById('upload-template-alert');if(a)a.style.display='block';}
    }

    window.handleFileSelect=function(event){var f=event&&event.target&&event.target.files?event.target.files[0]:null;if(f)readFile(f,'');};
    window.forceTemplate=function(template){state.template=template||'';if(state.file)readFile(state.file,state.template);};

    function renderPreview(){
        var r=state.report,cfg=CONFIG[state.template];if(!r||!cfg)return;
        var card=document.getElementById('preview-card');if(card)card.style.display='block';
        var count=document.getElementById('preview-count');if(count)count.textContent=r.valid+' / '+r.total+' lignes valides — '+r.validPct+' %';
        var summary=document.getElementById('import-summary');
        if(summary)summary.innerHTML=
            '<div class="import-summary-item '+(r.validPct===100?'ok':r.validPct?'warn':'err')+'"><strong>'+r.validPct+' %</strong><span>lignes valides</span></div>'+\
            '<div class="import-summary-item"><strong>'+r.valid+'</strong><span>à importer</span></div>'+\
            '<div class="import-summary-item '+(r.invalid?'err':'ok')+'"><strong>'+r.invalid+'</strong><span>à corriger</span></div>';

        var thead=document.getElementById('preview-thead'),tbody=document.getElementById('preview-tbody');
        if(!thead||!tbody)return;
        thead.innerHTML='<tr><th>Ligne</th><th>Complétude</th>'+cfg.headers.map(function(f){return '<th>'+esc(f.replace(/_/g,' '))+'</th>';}).join('')+'<th>Contrôle</th></tr>';
        tbody.innerHTML=r.details.slice(0,250).map(function(d){
            var cls=d.errors.length?' style="background:rgba(239,68,68,.06)"':'';
            var pct=d.completeness;
            var pctCls=pct===100?'good':pct>=75?'mid':'bad';
            return '<tr'+cls+'><td>'+d.line+'</td><td><div class="import-completeness"><span class="import-pct '+pctCls+'">'+pct+' %</span><div class="import-mini-bar"><i style="width:'+pct+'%"></i></div></div></td>'+cfg.headers.map(function(f){return '<td class="'+(PERCENT_FIELDS.has(f)?'import-percent':'')+'">'+fmt(d.row[f],f)+'</td>';}).join('')+'<td class="import-errors">'+(d.errors.length?esc(d.errors.join(' · ')):'✓ OK')+'</td></tr>';
        }).join('');
        if(r.details.length>250)tbody.innerHTML+='<tr><td colspan="'+(cfg.headers.length+3)+'" style="text-align:center;color:var(--muted);padding:12px;">Prévisualisation limitée aux 250 premières lignes. Les '+r.total+' lignes seront contrôlées à l’import.</td></tr>';
        injectPreviewStyle();
    }
    function injectPreviewStyle(){
        if(document.getElementById('tc-import-style'))return;
        var s=document.createElement('style');s.id='tc-import-style';s.textContent='.import-summary{display:flex;gap:10px;flex-wrap:wrap;padding:14px 18px}.import-summary-item{min-width:120px;padding:10px 14px;border:1px solid var(--border);border-radius:5px;background:var(--surface);display:flex;flex-direction:column;gap:3px}.import-summary-item strong{font-family:var(--mono);font-size:18px}.import-summary-item span{font-size:10px;color:var(--muted);text-transform:uppercase}.import-summary-item.ok strong{color:#6ee7b7}.import-summary-item.warn strong{color:#fbbf24}.import-summary-item.err strong{color:#f87171}.import-completeness{min-width:75px}.import-pct{font-family:var(--mono);font-size:11px;font-weight:600}.import-pct.good{color:#6ee7b7}.import-pct.mid{color:#fbbf24}.import-pct.bad{color:#f87171}.import-mini-bar{height:4px;background:rgba(255,255,255,.08);border-radius:3px;margin-top:4px;overflow:hidden}.import-mini-bar i{display:block;height:100%;background:currentColor}.import-percent{font-family:var(--mono);font-weight:600}.import-errors{font-size:10px;white-space:nowrap}.preview-table th{white-space:nowrap}.preview-table td{white-space:nowrap}';document.head.appendChild(s);
    }

    window.cancelImport=function(){
        state={file:null,template:'',rows:[],report:null};
        var card=document.getElementById('preview-card');if(card)card.style.display='none';
        var input=document.getElementById('excel-file');if(input)input.value='';
        var info=document.getElementById('upload-info');if(info)info.style.display='none';
        msg('');
    };

    window.confirmImport=async function(){
        if(!state.report||!state.template){msg('Aucune donnée prête à importer.','err');return;}
        var r=state.report,cfg=CONFIG[state.template];
        if(!r.valid){msg('Import bloqué : aucune ligne valide. Corrigez le fichier.','err');return;}
        if(r.invalid){msg('Import bloqué : '+r.invalid+' ligne(s) invalide(s). Corrigez le fichier avant de continuer.','err');return;}
        var btn=document.getElementById('btn-confirm-import');if(btn){btn.disabled=true;btn.textContent='Import en cours…';}
        var progress=document.getElementById('progress-card'),fill=document.getElementById('import-progress'),pct=document.getElementById('progress-pct'),txt=document.getElementById('progress-text'),log=document.getElementById('progress-log');
        if(progress)progress.style.display='block';
        try{
            var rows=r.details.filter(function(d){return !d.errors.length;}).map(function(d){return d.row;});
            var batchSize=50, inserted=0;
            for(var i=0;i<rows.length;i+=batchSize){
                var batch=rows.slice(i,i+batchSize);
                var result=await sbPost(cfg.table,batch,cfg.unique||null);
                if(!result)throw new Error('Échec d’insertion sur le lot '+(Math.floor(i/batchSize)+1)+'. Consultez le message d’erreur.');
                inserted+=batch.length;
                var p=Math.round(inserted/rows.length*100);if(fill)fill.style.width=p+'%';if(pct)pct.textContent=p+' %';if(txt)txt.textContent=inserted+' / '+rows.length+' lignes';if(log)log.innerHTML+='✓ Lot '+(Math.floor(i/batchSize)+1)+' : '+batch.length+' ligne(s)<br>';
            }
            if(typeof loadEntreprises==='function'&&state.template==='entreprises')loadEntreprises();
            if(typeof loadCours==='function'&&state.template==='cours')loadCours();
            if(typeof loadFinancials==='function'&&state.template==='financials')loadFinancials();
            if(typeof loadDividendes==='function'&&state.template==='dividendes')loadDividendes();
            if(typeof loadIndices==='function'&&state.template==='indices')loadIndices();
            if(typeof loadActionnaires==='function'&&state.template==='actionnaires')loadActionnaires();
            msg('✓ '+inserted+' ligne(s) importée(s) avec succès.','ok');
            if(txt)txt.textContent='Import terminé : '+inserted+' ligne(s)';
        }catch(e){console.error('[Import]',e);msg('Import interrompu : '+e.message,'err');}
        finally{if(btn){btn.disabled=false;btn.textContent="✓ Confirmer l'import";}}
    };

    function initDropZone(){
        var zone=document.getElementById('drop-zone');if(!zone)return;
        ['dragenter','dragover'].forEach(function(ev){zone.addEventListener(ev,function(e){e.preventDefault();e.stopPropagation();zone.classList.add('drag-over');});});
        ['dragleave','drop'].forEach(function(ev){zone.addEventListener(ev,function(e){e.preventDefault();e.stopPropagation();zone.classList.remove('drag-over');});});
        zone.addEventListener('drop',function(e){var f=e.dataTransfer&&e.dataTransfer.files?e.dataTransfer.files[0]:null;if(f)readFile(f,'');});
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initDropZone);else initDropZone();
})();
