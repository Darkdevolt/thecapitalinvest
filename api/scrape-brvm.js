const SIKA_URLS=['https://www.sikafinance.com/marches/aaz','https://www.sikafinance.com/marches/aaz/'];
const BRVM='https://otsiwiwlnowxeolbbgvm.supabase.co/functions/v1/scrape-brvm';
const ANON=process.env.SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||'';
const timeout=async(p,ms)=>{let t;try{return await Promise.race([p,new Promise((_,rej)=>{t=setTimeout(()=>rej(new Error(`timeout after ${ms}ms`)),ms)})])}finally{clearTimeout(t)}};
const text=x=>String(x??'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#039;|&#39;/gi,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim();
const num=x=>{if(x==null||x===''||x==='-'||x==='—')return null;const s=String(x).replace(/\u00a0/g,' ').replace(/\s/g,'').replace(/%/g,'');const n=Number(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s);return Number.isFinite(n)?n:null};
function ticker(cell){const h=String(cell||'');const m=h.match(/cotation[_-]([A-Z0-9]+)(?:\.[a-z]{2,3})?/i)||h.match(/(?:symbol|ticker)[=\/'"]+([A-Z0-9._-]+)/i);return m?m[1].toUpperCase():null}
function parse(html){const out=[];for(const tr of html.match(/<tr\b[\s\S]*?<\/tr>/gi)||[]){const c=tr.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi)||[];if(c.length<8)continue;const v=c.map(text),j=v.join(' ').toLowerCase();if(j.includes('ouverture')&&j.includes('dernier')&&j.includes('variation'))continue;const r={ticker:ticker(c[0]),nom:v[0]||null,ouverture:num(v[1]),plus_haut:num(v[2]),plus_bas:num(v[3]),volume:num(v[4]),valeur:num(v[5]),cours:num(v[6]),variation:num(v[7])};if(r.ticker&&r.cours!==null)out.push(r)}return [...new Map(out.map(r=>[r.ticker,r])).values()]}
async function sika(){const errors=[];for(const url of SIKA_URLS){try{const r=await timeout(fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; TheCapitalInvest/1.0)','Accept':'text/html,application/xhtml+xml'}}),20000);if(!r.ok){errors.push(`${url}: HTTP ${r.status}`);continue}const html=await r.text();const rows=parse(html);if(rows.length>=20)return rows;errors.push(`${url}: ${rows.length} cotations exploitables`)}catch(e){errors.push(`${url}: ${e.message}`)}}throw new Error(`Sika Finance inaccessible ou structure non reconnue (${errors.join(' | ')})`)}
async function brvm(){const headers={'Content-Type':'application/json','Accept':'application/json'};if(ANON){headers.apikey=ANON;headers.Authorization=`Bearer ${ANON}`}const r=await timeout(fetch(BRVM,{method:'POST',headers,body:'{}'}),45000);const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(`BRVM HTTP ${r.status}${d?.error||d?.message?` — ${d.error||d.message}`:''}`);if(!d||d.success===false||d.error)throw new Error(d?.error||d?.message||'Réponse BRVM invalide');return d}
function extractRows(payload){
  const candidates=[payload?.data?.rows,payload?.rows,Array.isArray(payload?.data)?payload.data,payload];
  for(const rows of candidates){
    if(!Array.isArray(rows))continue;
    const valid=rows.filter(r=>r&&r.ticker&&(r.cours??r.cours_cloture??r.cloture??r.close)!=null);
    if(valid.length)return valid;
  }
  return [];
}
function mergeRows(brvmRows,sikaRows,date_seance){
  const map=new Map();
  for(const r of sikaRows||[]){
    const tk=String(r?.ticker||'').trim().toUpperCase();
    if(tk)map.set(tk,{...r,date_seance});
  }
  // BRVM remains authoritative whenever it provides a title. This preserves
  // titles such as ABJC that are not always present in Sika's A-Z list.
  for(const r of brvmRows||[]){
    const tk=String(r?.ticker||'').trim().toUpperCase();
    if(!tk)continue;
    map.set(tk,{...r,ticker:tk,date_seance});
  }
  return [...map.values()];
}
export default async function handler(req,res){
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, X-Requested-With');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Cache-Control','no-store');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST')return res.status(405).json({success:false,error:'Method not allowed'});
 const attempts=[];
 try{
   const brvmData=await brvm();
   const brvmRows=extractRows(brvmData);
   // The BRVM edge scraper can currently return only the actively traded
   // subset. Do not let that partial response become the new "latest" session.
   if(brvmRows.length>=40){
     return res.status(200).json({success:true,source:'BRVM',data:brvmData,attempts:[{source:'BRVM',ok:true,count:brvmRows.length}]});
   }
   attempts.push({source:'BRVM',ok:true,count:brvmRows.length,partial:true});
   const raw=await sika();
   const date_seance=new Date().toISOString().slice(0,10);
   const rows=mergeRows(brvmRows,raw,date_seance);
   if(rows.length<40)throw new Error(`Synchronisation incomplète : ${rows.length} cotations exploitables`);
   return res.status(200).json({success:true,source:'Sika Finance',data:{rows,count:rows.length,date_seance},attempts:attempts.concat([{source:'Sika Finance',ok:true,count:raw.length,mergedCount:rows.length}])});
 }catch(e){
   attempts.push({source:'BRVM',ok:false,error:e.message});
   try{
     const raw=await sika();
     const date_seance=new Date().toISOString().slice(0,10);
     const rows=raw.map(r=>({...r,date_seance}));
     if(rows.length<40)throw new Error(`Sika Finance ne retourne que ${rows.length} cotations exploitables`);
     return res.status(200).json({success:true,source:'Sika Finance',data:{rows,count:rows.length,date_seance},attempts:attempts.concat([{source:'Sika Finance',ok:true,count:rows.length}])});
   }catch(fallbackError){
     attempts.push({source:'Sika Finance',ok:false,error:fallbackError.message});
     return res.status(502).json({success:false,error:'BRVM et le fallback Sika Finance sont actuellement indisponibles.',details:attempts});
   }
 }
}
