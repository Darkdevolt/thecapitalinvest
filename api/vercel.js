// ═══════════════════════════════════════════════════════════════════════════════
// THE CAPITAL — Vercel Node.js Adapter
// ═══════════════════════════════════════════════════════════════════════════════

import router from './index.js';
import { supabase, supabaseAdmin } from './lib/supabase.js';

const db = supabaseAdmin || supabase;
const BRVM_BOC_PAGE = 'https://bfin.brvm.org/boc.aspx';
const BRVM_BOC_BASE = 'https://bfin.brvm.org/boc/BOC_JOUR/';

function getHeaderValue(req,name){const value=req.headers?.[name.toLowerCase()];return Array.isArray(value)?value.join(', '):(value||'');}
async function readBody(req){if(['GET','HEAD','OPTIONS'].includes(req.method))return undefined;const chunks=[];for await(const chunk of req)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));return chunks.length?Buffer.concat(chunks):undefined;}
function buildAbsoluteUrl(req){const protocol=getHeaderValue(req,'x-forwarded-proto')||'https';const host=getHeaderValue(req,'x-forwarded-host')||getHeaderValue(req,'host')||'localhost';return `${protocol}://${host}${req.url||'/'}`;}
async function createWebRequest(req){const body=await readBody(req);const headers=new Headers();for(const [key,value] of Object.entries(req.headers||{})){if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):String(value));}const options={method:req.method||'GET',headers};if(body!==undefined){options.body=body;options.duplex='half';}return new Request(buildAbsoluteUrl(req),options);}
function jsonResponse(payload,status=200,cache='public, s-maxage=300, stale-while-revalidate=600'){return new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':cache,'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Content-Type,X-Requested-With','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,PATCH,OPTIONS'}});}
function withTimeout(promise,ms,label){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(`Timeout ${label} après ${ms}ms`)),ms))]);}
function bocPdfUrl(date){return `${BRVM_BOC_BASE}BOC_${date.replaceAll('-','')}.pdf`;}
function normalizeDate(value){const m=String(value).match(/(\d{2})\/(\d{2})\/(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:null;}

async function fetchOfficialBoc(limit=100){const response=await withTimeout(fetch(BRVM_BOC_PAGE,{headers:{'User-Agent':'TheCapital/1.0 BOC reader'}}),7000,'BRVM BOC');if(!response.ok)throw new Error(`BRVM BOC HTTP ${response.status}`);const html=await response.text();const dates=[];const seen=new Set();for(const m of html.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)){const d=normalizeDate(m[1]);if(!d||seen.has(d))continue;seen.add(d);dates.push(d);if(dates.length>=limit)break;}if(!dates.length)for(const m of html.matchAll(/BOC[_-](\d{8})\.pdf/gi)){const raw=m[1],d=`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;if(seen.has(d))continue;seen.add(d);dates.push(d);if(dates.length>=limit)break;}return dates.map((date,index)=>({id:`brvm-${date}`,date_seance:date,annee:Number(date.slice(0,4)),numero_seance:null,fichier_nom:`BOC_${date.replaceAll('-','')}.pdf`,fichier_url:bocPdfUrl(date),pdf_url:bocPdfUrl(date),source:'BRVM',source_url:BRVM_BOC_PAGE,rang:index+1}));}
async function readBocDatabase(){try{const result=await withTimeout(db.from('boc').select('id,date_seance,fichier_nom,fichier_url,created_at').order('date_seance',{ascending:false}).limit(100),5000,'Supabase BOC');if(result.error)throw result.error;return(result.data||[]).map(row=>({...row,annee:row.date_seance?Number(String(row.date_seance).slice(0,4)):null,numero_seance:null,pdf_url:row.fichier_url,source:'database'}));}catch(error){console.warn('[VERCEL ADAPTER] BOC database unavailable:',error.message);return[];}}
async function handleBoc(requestUrl){if(requestUrl.pathname!=='/api/boc')return null;try{let data=await readBocDatabase();let source='database';if(!data.length){data=await fetchOfficialBoc(100);source='brvm';}return jsonResponse({success:true,data:{data,count:data.length,source,source_url:BRVM_BOC_PAGE}});}catch(error){console.error('[VERCEL ADAPTER] BOC error:',error);return jsonResponse({success:false,error:'Impossible de récupérer les Bulletins Officiels de la Cote',code:'BOC_SOURCE_ERROR'},502,'no-store');}}

async function handleBrvmSync(requestUrl, req){
  if(requestUrl.pathname!=='/api/sync-brvm')return null;
  if(req.method!=='GET'&&req.method!=='POST')return jsonResponse({success:false,error:'Method not allowed'},405,'no-store');
  const cronHeader=getHeaderValue(req,'x-vercel-cron')||getHeaderValue(req,'x-vercel-cron-schedule');
  const providedSecret=getHeaderValue(req,'x-cron-secret')||requestUrl.searchParams.get('secret')||'';
  const cronSecret=process.env.CRON_SECRET||'';
  if(!cronHeader&&(!cronSecret||providedSecret!==cronSecret))return jsonResponse({success:false,error:'Unauthorized'},401,'no-store');
  const supabaseUrl=process.env.SUPABASE_URL||'';
  const supabaseKey=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||'';
  if(!supabaseUrl||!supabaseKey)return jsonResponse({success:false,error:'Supabase URL/key not configured'},503,'no-store');
  try{
    const response=await fetch(`${supabaseUrl}/functions/v1/scrape-brvm`,{method:'POST',headers:{Authorization:`Bearer ${supabaseKey}`,apikey:supabaseKey,'Content-Type':'application/json'},signal:AbortSignal.timeout(25000)});
    const text=await response.text();let data;try{data=JSON.parse(text);}catch{data={raw:text};}
    return jsonResponse(data,response.status,'no-store');
  }catch(error){console.error('[CRON] BRVM sync failed:',error);return jsonResponse({success:false,error:error.message||'BRVM sync failed'},502,'no-store');}
}

const PUBLIC_TABLES={
  indices:['indices','*','date_seance'],
  financials:['financials','*','annee'],
  financials_annuels:['financials_annuels','*','annee'],
  financials_infrannuels:['financials_infrannuels','*','annee'],
  etats_financiers:['etats_financiers','*','annee'],
  analyses:['analyses','*','date_analyse'],
  entreprises:['entreprises','*','ticker'],
  dividendes_calendrier:['dividendes_calendrier','*','date_detachement'],
  forecasts:['forecasts','*','annee_forecast'],
  cours_brvm:['cours_brvm','*','date_seance'],
  indices_brvm:['indices_brvm','*','date_seance'],
};

async function handlePublicDataset(requestUrl){
  if(requestUrl.pathname!=='/api/marche')return null;
  const type=(requestUrl.searchParams.get('type')||'apercu').toLowerCase();
  const ticker=requestUrl.searchParams.get('ticker')?.toUpperCase();
  const limit=Math.min(Math.max(Number(requestUrl.searchParams.get('limit')||500),1),2000);
  try{
    if(!db)return jsonResponse({success:false,error:'Supabase non configuré',code:'SUPABASE_NOT_CONFIGURED'},503,'no-store');
    if(type==='cours'||type==='apercu'){
      const [{data:rows,error},{data:companies,error:companyError}]=await Promise.all([
        db.from('cours_latest').select('ticker,cours,variation,variation_pct,volume,valeur_transigee,transactions,capitalisation,date_seance,ouverture,plus_haut,plus_bas,cloture').order('date_seance',{ascending:false}).limit(type==='cours'?limit:500),
        db.from('entreprises').select('ticker,nom,nom_court'),
      ]);
      if(error)throw error;if(companyError)throw companyError;
      const names=new Map((companies||[]).map(c=>[String(c.ticker).toUpperCase(),c.nom||c.nom_court||c.ticker]));
      const data=(rows||[]).map(row=>{const t=String(row.ticker||'').toUpperCase();return {...row,ticker:t,nom:names.get(t)||t};});
      if(type==='cours')return jsonResponse({success:true,data,count:data.length,dateSeance:data[0]?.date_seance||null});
      const sorted=[...data].sort((a,b)=>Number(b.variation_pct??b.variation??0)-Number(a.variation_pct??a.variation??0));
      const {data:indices,error:indexError}=await db.from('indices').select('*').order('date_seance',{ascending:false}).limit(20);if(indexError)throw indexError;
      return jsonResponse({success:true,data:{indices:(indices||[]).slice(0,3),cours:data.slice(0,15),topHausses:sorted.filter(r=>Number(r.variation_pct??r.variation??0)>0).slice(0,5),topBaisses:sorted.filter(r=>Number(r.variation_pct??r.variation??0)<0).slice(-5).reverse(),topVolumes:[...data].sort((a,b)=>Number(b.volume||0)-Number(a.volume||0)).slice(0,5),dateSeance:data[0]?.date_seance||null,totalValeurs:data.length}});
    }
    if(type==='historique'||type==='historique_cours'){
      if(!ticker)return jsonResponse({success:false,error:'Ticker requis',code:'MISSING_TICKER'},400,'no-store');
      const table=type==='historique'?'historique':'historique_cours';
      const {data,error}=await withTimeout(db.from(table).select('*').eq('ticker',ticker).order('date_seance',{ascending:false}).limit(Math.min(limit,1000)),10000,type);if(error)throw error;
      return jsonResponse({success:true,data:data||[],ticker,count:(data||[]).length});
    }
    const cfg=PUBLIC_TABLES[type];
    if(!cfg)return null;
    let query=db.from(cfg[0]).select(cfg[1]);
    if(ticker&&['financials','financials_annuels','financials_infrannuels','analyses','dividendes_calendrier','forecasts'].includes(type))query=query.eq('ticker',ticker);
    query=query.order(cfg[2],{ascending:false}).limit(limit);
    const {data,error}=await withTimeout(query,10000,type);if(error)throw error;
    return jsonResponse({success:true,data:data||[],type,count:(data||[]).length});
  }catch(error){console.error('[VERCEL ADAPTER] Public dataset error:',type,error);return jsonResponse({success:false,error:`Erreur ${type}: ${error.message}`,code:'DATASET_ERROR'},500,'no-store');}
}

async function sendWebResponse(res,response){if(!(response instanceof Response)){res.statusCode=500;res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({success:false,error:'Invalid API response'}));}res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));return res.end(Buffer.from(await response.arrayBuffer()));}

export default async function handler(req,res){try{console.log('[VERCEL ADAPTER] Request:',req.method,req.url);const requestUrl=new URL(buildAbsoluteUrl(req));if(req.method==='OPTIONS')return await sendWebResponse(res,jsonResponse({success:true},204));const syncResponse=await handleBrvmSync(requestUrl,req);if(syncResponse)return await sendWebResponse(res,syncResponse);const bocResponse=await handleBoc(requestUrl);if(bocResponse)return await sendWebResponse(res,bocResponse);if(requestUrl.pathname==='/api/marche'){const dataResponse=await handlePublicDataset(requestUrl);if(dataResponse)return await sendWebResponse(res,dataResponse);}const webRequest=await createWebRequest(req);const webResponse=await router(webRequest);return await sendWebResponse(res,webResponse);}catch(error){console.error('[VERCEL ADAPTER] Fatal error:',error);if(!res.headersSent){res.statusCode=500;res.setHeader('Content-Type','application/json; charset=utf-8');}return res.end(JSON.stringify({success:false,error:'Internal server error'}));}}
