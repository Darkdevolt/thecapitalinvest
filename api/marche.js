import { supabase, supabaseAdmin } from '../lib/supabase.js';

const db = supabaseAdmin || supabase;

function json(res,status,payload){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');res.setHeader('Pragma','no-cache');res.setHeader('Expires','0');res.end(JSON.stringify(payload));}
async function query(table,build){if(!db)throw new Error('Supabase non configuré');let q=db.from(table).select('*');if(typeof build==='function')q=build(q);return q;}

// SOURCE CANONIQUE : historique Supabase.
// Tous les tickers suivent exactement le même chemin. On prend la dernière
// observation réellement disponible POUR CHAQUE ticker, au lieu d'imposer
// une date globale qui ferait disparaître les titres dont la dernière séance
// est différente (ex. BICB vs ABJC).
async function latestCours(){
  const q=await query('historique',q=>q
    .order('date_seance',{ascending:false})
    .order('ticker',{ascending:true})
    .limit(5000));
  if(q.error)throw q.error;

  const seen=new Set();
  const rows=[];
  for(const r of (q.data||[])){
    const ticker=String(r.ticker||'').trim().toUpperCase();
    if(!ticker || seen.has(ticker))continue;
    if(r.cours_cloture==null && r.cloture==null && r.cours_normal==null)continue;
    seen.add(ticker);
    rows.push({
      id:r.id,ticker,date_seance:r.date_seance,
      cours:r.cours_cloture ?? r.cloture ?? r.cours_normal,
      cours_cloture:r.cours_cloture ?? r.cloture ?? r.cours_normal,
      ouverture:r.cours_ouverture,cours_ouverture:r.cours_ouverture,
      plus_haut:r.plus_haut,plus_bas:r.plus_bas,
      variation:r.variation,volume:r.volume,
      valeur_transigee:r.valeur_totale,valeur_totale:r.valeur_totale,
      transactions:null,capitalisation:null,
      variation_pct:r.variation_pct ?? r.variation
    });
  }

  rows.sort((a,b)=>String(a.ticker).localeCompare(String(b.ticker)));
  const latestDate=rows.reduce((max,r)=>String(r.date_seance||'')>String(max||'')?r.date_seance:max,null);
  const dates={};
  rows.forEach(r=>{dates[r.date_seance]=(dates[r.date_seance]||0)+1;});
  return {data:rows,error:null,latestDate,source:'historique',dates};
}

async function latestIndices(){
  const q=await query('indices',q=>q.order('date_seance',{ascending:false}).limit(1000));
  if(q.error)throw q.error;
  return q.data||[];
}

async function historique(ticker,limit,dateFrom,dateTo){
  return query('historique',q=>{
    q=q.order('date_seance',{ascending:false}).limit(limit);
    if(ticker)q=q.eq('ticker',ticker);
    if(dateFrom)q=q.gte('date_seance',dateFrom);
    if(dateTo)q=q.lte('date_seance',dateTo);
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
    let result;
    switch(type){
      case'cours':result=await latestCours();break;
      case'indices':result=await latestIndices();break;
      case'historique':result=await historique(ticker,limit,url.searchParams.get('date_from'),url.searchParams.get('date_to'));break;
      case'entreprises':result=await query('entreprises',q=>q.eq('actif',true).order('ticker',{ascending:true}));break;
      case'financials':result=await query('financials',q=>q.order('validation_status',{ascending:true}).order('annee',{ascending:false}).limit(2000));break;
      case'analyses':result=await query('analyses',q=>q.order('date_analyse',{ascending:false}).limit(500));break;
      case'dividendes':result=await query('dividendes_calendrier',q=>q.order('exercice',{ascending:false}).order('annee',{ascending:false}).limit(2000));break;
      case'apercu':{
        const [cours,indices]=await Promise.all([latestCours(),latestIndices()]);
        return json(res,200,{success:true,cours:cours.data||[],indices:indices||[],cours_date:cours.latestDate||null,cours_source:cours.source||null,cours_dates:cours.dates||{}});
      }
      default:return json(res,400,{error:`Type de données inconnu: ${type}`});
    }
    if(result?.error)throw result.error;
    const data=result?.data||result||[];
    if(type==='historique'&&Array.isArray(data))data.reverse();
    return json(res,200,data);
  }catch(error){console.error('[API/MARCHE]',error);return json(res,500,{error:error.message||'Erreur serveur'});}
}
