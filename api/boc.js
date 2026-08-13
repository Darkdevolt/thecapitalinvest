import { supabase, supabaseAdmin } from '../lib/supabase.js';
const db=supabaseAdmin||supabase;
function json(res,status,payload){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(payload));}
function numero(name){const m=String(name||'').match(/(?:boc[_-]?20\d{6}[_-]?)(\d+)/i);return m?Number(m[1]):null;}
export default async function handler(req,res){
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, X-Requested-With');
 if(req.method!=='GET')return json(res,405,{success:false,error:'Method Not Allowed'});if(!db)return json(res,503,{success:false,error:'Supabase non configuré'});
 try{const {data,error}=await db.from('boc').select('*').order('date_seance',{ascending:false}).limit(500);if(error)throw error;const rows=(data||[]).map(function(r){return Object.assign({},r,{pdf_url:r.fichier_url,numero_seance:numero(r.fichier_nom),annee:String(r.date_seance||'').slice(0,4)});});return json(res,200,{success:true,data:rows});}
 catch(error){console.error('[API/BOC]',error);return json(res,500,{success:false,error:error.message||'Erreur serveur'});}
}
