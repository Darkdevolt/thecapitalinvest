/* The Capital — Historical market data quality dashboard.
 * Read-only: never writes to Supabase. Admin uses it to decide whether a
 * session is complete, clean and logically coherent before validation.
 */
(function(){
'use strict';
function hqEsc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function hqNum(v){var n=Number(v);return Number.isFinite(n)?n:null;}
function hqPct(v){return v==null?'—':(Number(v).toFixed(2)+'%');}
function hqClass(score){return score>=90?'ok':score>=75?'warn':'bad';}

/* Read the complete history in bounded pages. The old implementation stopped at 5,000 rows. */
async function hqLoadRows(){
  var out=[],offset=0,page=1000;
  while(true){
    var rows=await sbGet('historique','select=ticker,date_seance,cours_cloture,cours_ouverture,plus_haut,plus_bas,volume,variation&id=not.is.null&order=date_seance.desc,ticker.asc&limit='+page+'&offset='+offset);
    if(!Array.isArray(rows)||!rows.length)break;
    out=out.concat(rows);
    if(rows.length<page)break;
    offset+=rows.length;
    if(offset>1000000)break;
  }
  return out;
}
async function hqLoadUniverse(){
  var rows=await sbGet('entreprises','select=ticker&actif=eq.true&limit=1000');
  return Array.isArray(rows)?rows.map(function(x){return String(x.ticker||'').toUpperCase().trim();}).filter(Boolean):[];
}
function hqAnalyse(rows,universe){
  var dates={};
  var invalid=0,ohlc=0,extreme=0,missing=0,duplicate=0,extremeVar=0;
  var seen={};
  rows.forEach(function(r){
    var d=r.date_seance||'UNKNOWN';
    if(!dates[d])dates[d]={rows:0,tickers:new Set(),missing:0,invalid:0,ohlc:0,extremeVar:0};
    var x=dates[d];x.rows++;x.tickers.add(String(r.ticker||'').toUpperCase());
    var c=hqNum(r.cours_cloture),o=hqNum(r.cours_ouverture),hi=hqNum(r.plus_haut),lo=hqNum(r.plus_bas),vol=hqNum(r.volume),v=hqNum(r.variation);
    if(!r.ticker||c==null||c<=0||[o,hi,lo,vol].some(function(n){return n!=null&&n<0;})){invalid++;x.invalid++;}
    if(hi!=null&&lo!=null&&hi<lo){ohlc++;x.ohlc++;}
    if(v==null){missing++;x.missing++;}
    if(v!=null&&Math.abs(v)>=20){extremeVar++;x.extremeVar++;}
    if(c!=null&&c>=100000)extreme++;
    var key=d+'|'+String(r.ticker||'').toUpperCase();if(seen[key])duplicate++;else seen[key]=1;
  });
  var ds=Object.keys(dates).sort(function(a,b){return b.localeCompare(a);}).slice(0,12).map(function(d){var x=dates[d];var coverage=universe.length?Math.min(100,x.tickers.size/universe.length*100):0;return{date:d,rows:x.rows,tickers:x.tickers.size,coverage:coverage,missing:x.missing,invalid:x.invalid,ohlc:x.ohlc,extremeVar:x.extremeVar};});
  var latest=ds[0]||{rows:0,tickers:0,coverage:0,missing:0,invalid:0,ohlc:0,extremeVar:0};
  var completeness=Math.round(latest.coverage);
  var cleanliness=Math.max(0,Math.round(100-(invalid>0?25:0)-(ohlc>0?25:0)-(duplicate>0?20:0)-(extreme>0?10:0)));
  var logic=Math.max(0,Math.round(100-(ohlc>0?35:0)-(extremeVar>0?25:0)-(invalid>0?25:0)));
  var missingScore=Math.max(0,100-Math.min(100,latest.missing*3));
  var health=Math.round((completeness+cleanliness+logic+missingScore)/4);
  return{dates:ds,latest:latest,invalid,ohlc,extreme,missing,duplicate,extremeVar,completeness,cleanliness,logic,missingScore,health};
}
function hqChart(data){return '<div style="display:flex;gap:14px;align-items:flex-end;height:150px;padding:10px 4px 4px;overflow-x:auto;">'+data.map(function(x){var h=Math.max(4,Math.round(x.coverage));return '<div title="'+hqEsc(x.date)+' — '+x.tickers+' titres — '+x.coverage.toFixed(1)+'%" style="min-width:38px;height:130px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:5px;"><div style="font:10px var(--mono);color:var(--muted);">'+Math.round(x.coverage)+'%</div><div style="width:24px;height:'+Math.round(h*1.05)+'px;max-height:105px;background:var(--gold);opacity:.85;border-radius:3px 3px 0 0;"></div><div style="font:9px var(--mono);color:var(--muted);transform:rotate(-35deg);transform-origin:center;white-space:nowrap;">'+hqEsc(x.date.slice(5))+'</div></div>';}).join('')+'</div>'}
async function loadHistoriqueQualityDashboard(){
  var host=document.getElementById('hist-quality-dashboard');if(!host)return;
  host.innerHTML='<div class="card"><div style="padding:18px;color:var(--muted);">Analyse qualité des séances en cours…</div></div>';
  try{
    var pair=await Promise.all([hqLoadRows(),hqLoadUniverse()]),a=hqAnalyse(pair[0],pair[1]),alerts=[];
    if(!a.latest.rows)alerts.push(['critical','Aucune séance détectée','Le pipeline n’a fourni aucune donnée historique.']);
    else if(a.completeness<90)alerts.push(['critical','Séance incomplète','La séance '+a.latest.date+' contient '+a.latest.tickers+' titres sur '+pair[1].length+' référencés.']);
    else if(a.completeness<100)alerts.push(['warning','Couverture partielle','La séance '+a.latest.date+' ne couvre pas encore tout l’univers.']);
    if(a.invalid)alerts.push(['critical','Valeurs invalides',a.invalid+' ligne(s) avec cours/prix/volume impossibles.']);
    if(a.ohlc)alerts.push(['critical','OHLC incohérent',a.ohlc+' ligne(s) avec Plus haut < Plus bas.']);
    if(a.extremeVar)alerts.push(['warning','Variations extrêmes',a.extremeVar+' ligne(s) avec une variation ≥ ±20%. À vérifier avant validation.']);
    if(a.duplicate)alerts.push(['warning','Doublons potentiels',a.duplicate+' doublon(s) ticker/date détecté(s) dans l’historique analysé.']);
    if(a.missing)alerts.push(['warning','Variations manquantes',a.missing+' ligne(s) sans variation.']);
    if(a.extreme)alerts.push(['warning','Échelle de prix inhabituelle',a.extreme+' ligne(s) avec un cours ≥ 100 000 FCFA. Vérifier l’unité.']);
    if(!alerts.length)alerts.push(['ok','Aucune anomalie majeure','Les contrôles de complétude, propreté et logique sont satisfaisants.']);
    var metric=function(label,val){return '<div class="kpi"><div class="kpi-label">'+label+'</div><div class="kpi-value" style="font-size:25px;">'+val+'%</div></div>';};
    host.innerHTML='<div class="card" style="margin-bottom:16px;"><div class="card-header"><div><span class="card-title">Contrôle qualité des séances</span><div style="font-size:11px;color:var(--muted);margin-top:4px;">Lecture seule · aucune donnée n’est modifiée automatiquement</div></div><button class="btn btn-outline btn-sm" onclick="loadHistoriqueQualityDashboard()">↺ Analyser</button></div><div class="kpi-row" style="padding:16px;">'+metric('Score global',a.health)+metric('Complétude',a.completeness)+metric('Propreté',a.cleanliness)+metric('Logique',a.logic)+metric('Données renseignées',a.missingScore)+'</div></div>'+ '<div class="card" style="margin-bottom:16px;"><div class="card-header"><span class="card-title">Couverture par séance</span><span style="margin-left:auto;font-size:11px;color:var(--muted);">Univers actif : '+pair[1].length+' titres</span></div><div style="padding:12px 18px 22px;">'+hqChart(a.dates)+'</div></div>'+ '<div class="card"><div class="card-header"><span class="card-title">Alertes de contrôle</span><span style="margin-left:auto;font-size:11px;color:var(--muted);">La décision de validation reste manuelle</span></div><div style="padding:10px 18px 18px;">'+alerts.map(function(x){var icon=x[0]==='critical'?'⛔':x[0]==='warning'?'⚠️':'✓',color=x[0]==='critical'?'var(--red)':x[0]==='warning'?'var(--orange)':'var(--green)';return '<div style="display:flex;gap:10px;padding:12px 0;border-bottom:1px solid var(--border);"><span style="color:'+color+';font-size:15px;">'+icon+'</span><div><b style="font-size:12px;">'+hqEsc(x[1])+'</b><div style="font-size:11px;color:var(--muted);margin-top:3px;">'+hqEsc(x[2])+'</div></div></div>';}).join('')+'</div></div>'+ '<div class="card" style="margin-top:16px;"><div class="card-header"><span class="card-title">Détail des dernières séances</span></div><div class="tw"><table><thead><tr><th>Date</th><th class="r">Titres</th><th class="r">Complétude</th><th class="r">Manquants</th><th class="r">OHLC</th><th class="r">Variations extrêmes</th><th>État</th></tr></thead><tbody>'+a.dates.map(function(x){var state=x.invalid||x.ohlc?'ERREUR':x.coverage<90?'INCOMPLÈTE':x.coverage<100?'PARTIELLE':'OK',color=state==='ERREUR'?'var(--red)':state==='INCOMPLÈTE'?'var(--red)':state==='PARTIELLE'?'var(--orange)':'var(--green)';return '<tr><td class="td-muted">'+hqEsc(x.date)+'</td><td class="r td-mono">'+x.tickers+'</td><td class="r td-mono">'+x.coverage.toFixed(1)+'%</td><td class="r td-mono">'+x.missing+'</td><td class="r td-mono">'+x.ohlc+'</td><td class="r td-mono">'+x.extremeVar+'</td><td style="color:'+color+';font-weight:600;">'+state+'</td></tr>';}).join('')+'</tbody></table></div></div>';
  }catch(e){console.error('[HIST-QUALITY]',e);host.innerHTML='<div class="card"><div style="padding:18px;color:var(--red);">Impossible d’analyser la qualité : '+hqEsc(e.message||e)+'</div></div>';}
}
window.loadHistoriqueQualityDashboard=loadHistoriqueQualityDashboard;
})();
