import { supabase, supabaseAdmin } from '../lib/supabase.js';

const db = supabaseAdmin || supabase;

function json(res,status,payload){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma','no-cache');
  res.setHeader('Expires','0');
  res.end(JSON.stringify(payload));
}

async function query(table,build){
  if(!db)throw new Error('Supabase non configuré');
  let q=db.from(table).select('*');
  if(typeof build==='function')q=build(q);
  return q;
}

async function latestSessionDate(){
  const [h,i]=await Promise.all([
    query('historique',q=>q.select('date_seance').not('date_seance','is',null).order('date_seance',{ascending:false}).limit(1)),
    query('indices',q=>q.select('date_seance').not('date_seance','is',null).order('date_seance',{ascending:false}).limit(1))
  ]);
  if(h.error)throw h.error;
  if(i.error)throw i.error;
  const dates=[h.data?.[0]?.date_seance,i.data?.[0]?.date_seance].filter(Boolean).sort().reverse();
  return dates[0]||null;
}

async function latestCours(sessionDate=null){
  const PAGE_SIZE=1000;
  const MAX_PAGES=50;
  const latestDate=sessionDate||await latestSessionDate();
  if(!latestDate)return {data:[],error:null,latestDate:null,source:'historique',dates:{}};

  const rows=[];
  let from=0;
  for(let page=0;page<MAX_PAGES;page++){
    const q=await query('historique',q=>q.eq('date_seance',latestDate).order('ticker',{ascending:true}).range(from,from+PAGE_SIZE-1));
    if(q.error)throw q.error;
    const batch=q.data||[];
    if(!batch.length)break;
    for(const r of batch){
      const ticker=String(r.ticker||'').trim().toUpperCase();
      if(!ticker)continue;
      const variationPct=r.variation_pct ?? r.variation ?? null;
      rows.push({
        id:r.id,ticker,date_seance:r.date_seance,
        cours:r.cours_cloture ?? r.cloture ?? r.cours_normal,
        cours_cloture:r.cours_cloture ?? r.cloture ?? r.cours_normal,
        ouverture:r.cours_ouverture,cours_ouverture:r.cours_ouverture,
        plus_haut:r.plus_haut,plus_bas:r.plus_bas,
        variation:variationPct,variation_pct:variationPct,variation_abs:r.variation,
        volume:r.volume,valeur_transigee:r.valeur_totale,valeur_totale:r.valeur_totale,
        transactions:null,capitalisation:null
      });
    }
    if(batch.length<PAGE_SIZE)break;
    from+=PAGE_SIZE;
  }
  rows.sort((a,b)=>String(a.ticker).localeCompare(String(b.ticker)));
  return {data:rows,error:null,latestDate,source:'historique',dates:{[latestDate]:rows.length}};
}

async function latestIndices(sessionDate=null){
  const latestDate=sessionDate||await latestSessionDate();
  if(!latestDate)return {data:[],error:null,latestDate:null,source:'indices',dates:{}};

  // The production schema uses `indice`, not `nom`. Keep the DB untouched and
  // normalize the payload expected by the dashboard from the real columns.
  const q=await query('indices',q=>q.eq('date_seance',latestDate).order('indice',{ascending:true}).limit(1000));
  if(q.error)throw q.error;

  const data=(q.data||[]).map(r=>{
    const valeur=r.valeur;
    const variationPct=r.variation_pct ?? null;
    const rawVariation=r.variation ?? null;
    const numericValue=Number(valeur);
    const numericPct=Number(variationPct);
    const variation=rawVariation!=null
      ? rawVariation
      : (Number.isFinite(numericValue)&&Number.isFinite(numericPct) ? numericValue*numericPct/100 : null);
    return {
      ...r,
      indice:String(r.indice||'').trim(),
      valeur:r.valeur,
      variation,
      variation_pct:variationPct
    };
  });

  return {data,error:null,latestDate,source:'indices',dates:{[latestDate]:data.length}};
}

async function historiqueIndices(limit=30, dateFrom=null, dateTo=null){
  const safeLimit=Math.min(Math.max(Number(limit)||30,1),1000);
  const q=await query('indices',q=>{
    if(dateFrom)q=q.gte('date_seance',dateFrom);
    if(dateTo)q=q.lte('date_seance',dateTo);
    return q.order('date_seance',{ascending:false}).order('indice',{ascending:true}).limit(safeLimit*20);
  });
  if(q.error)throw q.error;

  // The frontend needs all index rows for the requested sessions, not only
  // the latest session. Keep the DB rows intact and sort chronologically.
  const rows=(q.data||[]).slice().sort((a,b)=>{
    const d=String(a.date_seance||'').localeCompare(String(b.date_seance||''));
    return d!==0?d:String(a.nom||a.indice||'').localeCompare(String(b.nom||b.indice||''));
  });
  const sessions=[...new Set(rows.map(r=>String(r.date_seance||'')).filter(Boolean))].slice(-safeLimit);
  const allowed=new Set(sessions);
  const data=rows.filter(r=>allowed.has(String(r.date_seance||''))).map(r=>
    String(r.indice||'').trim().toUpperCase()==='BRVM COMPOSITE'
      ? {...r,indice:'BRVM C'}
      : r
  );
  return {data,error:null,source:'indices',sessions:sessions.length};
}

async function historique(ticker,limit,dateFrom,dateTo,offset){
  const safeLimit=Math.min(Math.max(Number(limit)||1000,1),1000);
  const safeOffset=Math.max(Number(offset)||0,0);
  return query('historique',q=>{
    if(ticker)q=q.eq('ticker',ticker);
    if(dateFrom)q=q.gte('date_seance',dateFrom);
    if(dateTo)q=q.lte('date_seance',dateTo);
    q=q.order('date_seance',{ascending:false}).range(safeOffset,safeOffset+safeLimit-1);
    return q;
  });
}

export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'Method Not Allowed'});
  try{
    const url=new URL(req.url,`https://${req.headers.host||'localhost'}`);
    const type=url.searchParams.get('type')||'cours';
    const ticker=(url.searchParams.get('ticker')||'').trim().toUpperCase();
    const limit=Math.min(Math.max(Number(url.searchParams.get('limit'))||30,1),1000);
    const offset=Math.max(Number(url.searchParams.get('offset'))||0,0);
    let result;
    switch(type){
      case'cours':result=await latestCours();break;
      case'indices':result=await latestIndices();break;
      case'indices_historique':result=await historiqueIndices(limit,url.searchParams.get('date_from'),url.searchParams.get('date_to'));break;
      case'historique':result=await historique(ticker,limit,url.searchParams.get('date_from'),url.searchParams.get('date_to'),offset);break;
      case'entreprises':result=await query('entreprises',q=>q.eq('actif',true).order('ticker',{ascending:true}));break;
      case'financials':result=await query('financials',q=>q.order('validation_status',{ascending:true}).order('annee',{ascending:false}).limit(2000));break;
      case'analyses':result=await query('analyses',q=>q.order('date_analyse',{ascending:false}).limit(500));break;
      case'dividendes':result=await query('dividendes_calendrier',q=>q.order('date_detachement',{ascending:true,nullsLast:true}).order('date_paiement',{ascending:true,nullsLast:true}).limit(2000));break;
      case'apercu':{
        const sessionDate=await latestSessionDate();
        const [cours,indices]=await Promise.all([latestCours(sessionDate),latestIndices(sessionDate)]);
        return json(res,200,{success:true,cours:cours.data||[],indices:indices.data||[],session_date:sessionDate,cours_date:cours.latestDate||null,indices_date:indices.latestDate||null,cours_source:cours.source||null,indices_source:indices.source||null,cours_dates:cours.dates||{},indices_dates:indices.dates||{}});
      }
      default:return json(res,400,{error:`Type de données inconnu: ${type}`});
    }
    if(result?.error)throw result.error;
    const data=result?.data||result||[];
    if(type==='historique'&&Array.isArray(data))data.reverse();
    return json(res,200,data);
  }catch(error){
    console.error('[API/MARCHE]',error);
    return json(res,500,{error:error.message||'Erreur serveur'});
  }
}
