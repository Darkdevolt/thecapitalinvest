import { supabase, supabaseAdmin } from '../lib/supabase.js';

const db = supabaseAdmin || supabase;
const MIN_COMPLETE_QUOTES = 40;
function json(res,status,payload){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');res.setHeader('Pragma','no-cache');res.setHeader('Expires','0');res.end(JSON.stringify(payload));}
async function query(table,build){if(!db)throw new Error('Supabase non configuré');let q=db.from(table).select('*');if(typeof build==='function')q=build(q);return q;}

// A historical session is only exposed as the live market snapshot when it is
// sufficiently complete. This prevents a partial scraper/import (e.g. 16
// tickers) from making most securities disappear or revert to stale values.
async function latestCours(){
  const latestDateQ=await query('historique',q=>q.select('date_seance').order('date_seance',{ascending:false}).limit(1));
  if(latestDateQ.error)throw latestDateQ.error;
  const latestDate=latestDateQ.data?.[0]?.date_seance||null;

  const fallbackQ=await query('cours_latest',q=>q.order('ticker',{ascending:true}).limit(1000));
  if(fallbackQ.error)throw fallbackQ.error;
  const fallbackRows=fallbackQ.data||[];
  const fallbackDate=fallbackRows.reduce((max,r)=>String(r.date_seance||'')>String(max||'')?r.date_seance:max,null);

  if(!latestDate){return {data:fallbackRows,error:null,latestDate:fallbackDate,source:'cours_latest'};}

  const histQ=await query('historique',q=>q.eq('date_seance',latestDate).order('ticker',{ascending:true}).limit(1000));
  if(histQ.error)throw histQ.error;
  const rows=(histQ.data||[]).map(r=>({
    id:r.id,ticker:r.ticker,date_seance:r.date_seance,
    cours:r.cours_cloture ?? r.cloture ?? r.cours_normal,
    ouverture:r.cours_ouverture,plus_haut:r.plus_haut,plus_bas:r.plus_bas,
    variation:r.variation,volume:r.volume,valeur_transigee:r.valeur_totale,
    transactions:null,capitalisation:null,variation_pct:r.variation_pct ?? r.variation
  })).filter(r=>r.ticker&&r.cours!=null);

  // If the newest historical session is partial, keep the last complete
  // current snapshot instead of exposing an incomplete market to the app.
  if(rows.length < MIN_COMPLETE_QUOTES){
    return {data:fallbackRows,error:null,latestDate:fallbackDate,source:'cours_latest',ignoredHistoricalDate:latestDate,ignoredHistoricalCount:rows.length};
  }
  return {data:rows,error:null,latestDate,source:'historique'};
}

async function latestIndices(){
  const q=await query('indices',q=>q.order('date_seance',{ascending:false}).limit(1000));
  if(q.error)throw q.error;
  const rows=q.data||[];
  return rows;
}

export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'Method Not Allowed'});
  try{
    const url=new URL(req.url,`https://${req.headers.host||'localhost'}`);
    const type=url.searchParams.get('type')||'cours';
    const ticker=(url.searchParams.get('ticker')||'').trim().toUpperCase();
    const limit=Math.min(Math.max(Number(url.searchParams.get('limit'))||30,1),1000);
    let result;
    switch(type){
      case'cours':result=await latestCours();break;
      case'indices':result=await latestIndices();break;
      case'historique':
        if(!ticker)return json(res,400,{error:'ticker requis'});
        result=await query('historique',q=>q.eq('ticker',ticker).order('date_seance',{ascending:false}).limit(limit));
        if(!result.error&&Array.isArray(result.data))result.data.reverse();
        break;
      case'entreprises':result=await query('entreprises',q=>q.eq('actif',true).order('ticker',{ascending:true}));break;
      case'financials':result=await query('financials',q=>q.order('validation_status',{ascending:true}).order('annee',{ascending:false}).limit(2000));break;
      case'analyses':result=await query('analyses',q=>q.order('date_analyse',{ascending:false}).limit(500));break;
      case'dividendes':result=await query('dividendes_calendrier',q=>q.order('exercice',{ascending:false}).order('annee',{ascending:false}).limit(2000));break;
      case'apercu':{
        const [cours,indices]=await Promise.all([latestCours(),latestIndices()]);
        if(cours.error)throw cours.error;
        return json(res,200,{success:true,cours:cours.data||[],indices:indices||[],cours_date:cours.latestDate||cours.data?.[0]?.date_seance||null,cours_source:cours.source||null});
      }
      default:return json(res,400,{error:`Type de données inconnu: ${type}`});
    }
    if(result?.error)throw result.error;
    return json(res,200,result?.data||result||[]);
  }catch(error){console.error('[API/MARCHE]',error);return json(res,500,{error:error.message||'Erreur serveur'});}
}
