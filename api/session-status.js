import { supabase, supabaseAdmin } from '../lib/supabase.js';

const db = supabaseAdmin || supabase;
const EXPECTED_INDICES = ['BRVM-COMPOSITE','BRVM-30','BRVM-PRESTIGE'];

function json(res,status,payload){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma','no-cache');
  res.setHeader('Expires','0');
  res.end(JSON.stringify(payload));
}

async function getActiveTickers(){
  const q=await db.from('entreprises').select('ticker,actif').eq('actif',true).order('ticker',{ascending:true});
  if(q.error)throw q.error;
  return [...new Set((q.data||[]).map(r=>String(r.ticker||'').trim().toUpperCase()).filter(Boolean))];
}

function validateCourses(rows){
  const by={};
  const invalid=[];
  for(const r of rows||[]){
    const t=String(r.ticker||'').trim().toUpperCase();
    if(!t)continue;
    (by[t] ||= []).push(r);
    const c=Number(r.cours_cloture),o=Number(r.cours_ouverture),h=Number(r.plus_haut),l=Number(r.plus_bas),v=Number(r.volume),vr=Number(r.variation);
    if(!Number.isFinite(c)||c<0)invalid.push(`${t}: clôture manquante/invalide`);
    if(Number.isFinite(h)&&Number.isFinite(l)&&l>h)invalid.push(`${t}: bas > haut`);
    if(Number.isFinite(o)&&Number.isFinite(h)&&o>h)invalid.push(`${t}: ouverture > haut`);
    if(Number.isFinite(o)&&Number.isFinite(l)&&o<l)invalid.push(`${t}: ouverture < bas`);
    if(Number.isFinite(c)&&Number.isFinite(h)&&c>h)invalid.push(`${t}: clôture > haut`);
    if(Number.isFinite(c)&&Number.isFinite(l)&&c<l)invalid.push(`${t}: clôture < bas`);
    if(Number.isFinite(v)&&v<0)invalid.push(`${t}: volume négatif`);
    if(Number.isFinite(vr)&&Math.abs(vr)>7.5)invalid.push(`${t}: variation > ±7,5 %`);
  }
  return {by,invalid,duplicates:Object.keys(by).filter(t=>by[t].length>1)};
}

function validateIndices(rows){
  const map={};
  for(const r of rows||[]){
    const raw=String(r.indice||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(raw==='BRVMC'||raw.indexOf('COMPOSITE')>=0)map['BRVM-COMPOSITE']=r;
    else if(raw.indexOf('30')>=0)map['BRVM-30']=r;
    else if(raw.indexOf('PRESTIGE')>=0)map['BRVM-PRESTIGE']=r;
  }
  return {map,missing:EXPECTED_INDICES.filter(x=>!map[x])};
}

function normalizeCours(rows){
  return (rows||[]).map(r=>({
    id:r.id,ticker:String(r.ticker||'').trim().toUpperCase(),date_seance:r.date_seance,
    cours:r.cours_cloture ?? r.cloture ?? r.cours_normal,
    cours_cloture:r.cours_cloture ?? r.cloture ?? r.cours_normal,
    ouverture:r.cours_ouverture,cours_ouverture:r.cours_ouverture,
    plus_haut:r.plus_haut,plus_bas:r.plus_bas,
    variation:r.variation_pct ?? r.variation ?? null,
    variation_pct:r.variation_pct ?? r.variation ?? null,
    variation_abs:r.variation,valeur_transigee:r.valeur_totale,valeur_totale:r.valeur_totale,
    volume:r.volume
  }));
}

async function sessionRows(date){
  const [h,i]=await Promise.all([
    db.from('historique').select('*').eq('date_seance',date).order('ticker',{ascending:true}),
    db.from('indices').select('*').eq('date_seance',date).order('indice',{ascending:true})
  ]);
  if(h.error)throw h.error;
  if(i.error)throw i.error;
  return {historique:h.data||[],indices:i.data||[]};
}

export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'Method Not Allowed'});
  try{
    if(!db)throw new Error('Supabase non configuré');
    const tickers=await getActiveTickers();
    const datesQ=await db.from('historique').select('date_seance').not('date_seance','is',null).order('date_seance',{ascending:false}).limit(50000);
    if(datesQ.error)throw datesQ.error;
    const dates=[...new Set((datesQ.data||[]).map(r=>String(r.date_seance||'').slice(0,10)).filter(Boolean))];
    let latestDate=dates[0]||null;
    let confirmed=null;
    const checked=[];
    for(const date of dates){
      if(!date||/^(?:\d{4}-\d{2}-\d{2})$/.test(date)===false)continue;
      const {historique,indices}=await sessionRows(date);
      const course=validateCourses(historique);
      const missing=tickers.filter(t=>!course.by[t]);
      const idx=validateIndices(indices);
      const complete=historique.length>0&&!missing.length&&!course.invalid.length&&!course.duplicates.length&&!idx.missing.length;
      checked.push({date,courses:historique.length,titres:tickers.length,missing:missing.length,invalid:course.invalid.length,duplicates:course.duplicates.length,missing_indices:idx.missing.length,complete});
      if(complete){confirmed={date,historique,indices,quality:{missing,invalid:course.invalid,duplicates:course.duplicates,missing_indices:idx.missing,expected_titles:tickers.length,actual_titles:Object.keys(course.by).length}};break;}
    }
    const current=latestDate?await sessionRows(latestDate):{historique:[],indices:[]};
    const currentCourse=validateCourses(current.historique),currentIdx=validateIndices(current.indices);
    const currentMissing=tickers.filter(t=>!currentCourse.by[t]);
    const currentComplete=!!latestDate&&current.historique.length>0&&!currentMissing.length&&!currentCourse.invalid.length&&!currentCourse.duplicates.length&&!currentIdx.missing.length;
    return json(res,200,{
      ok:true,
      latest_date:latestDate,
      latest_status:{date:latestDate,complete:currentComplete,courses:current.historique.length,titres:tickers.length,missing:currentMissing.length,invalid:currentCourse.invalid.length,duplicates:currentCourse.duplicates.length,missing_indices:currentIdx.missing.length},
      confirmed_date:confirmed?.date||null,
      confirmed:!!confirmed,
      cours:confirmed?normalizeCours(confirmed.historique):[],
      indices:confirmed?confirmed.indices:[],
      quality:confirmed?.quality||null,
      checked:checked.slice(0,10)
    });
  }catch(error){
    console.error('[API/SESSION-STATUS]',error);
    return json(res,500,{ok:false,error:error.message||'Erreur serveur'});
  }
}
