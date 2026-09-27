import { supabaseAdmin, isSupabaseReady } from '../lib/supabase.js';
import { authenticate, rateLimited, handlePreflight } from '../lib/middleware.js';
import { ok, fail, readBody, BodyError } from '../lib/http.js';

export default async function handler(req,res){
  if(handlePreflight(req,res,{methods:'POST,OPTIONS'}))return;
  if(rateLimited(req,res,'wave-checkout'))return;
  if(req.method!=='POST')return fail(res,405,'Méthode non autorisée.','METHOD_NOT_ALLOWED');
  if(!isSupabaseReady()||!supabaseAdmin)return fail(res,503,'Service temporairement indisponible.','SERVICE_UNAVAILABLE');
  const user=await authenticate(req,res);if(!user)return;
  let body;try{body=await readBody(req)}catch(e){return fail(res,e instanceof BodyError?400:500,'Requête illisible.','INVALID_BODY')}
  const orderId=String(body?.order_id||'');
  if(!/^[0-9a-f-]{36}$/i.test(orderId))return fail(res,400,'Commande invalide.','INVALID_ORDER_ID');
  try{
    const {data:order,error}=await supabaseAdmin.from('payment_orders').select('id,user_id,plan_code,billing_period,amount,currency,status').eq('id',orderId).eq('user_id',user.sub).maybeSingle();
    if(error)throw error;if(!order)return fail(res,404,'Commande introuvable.','NOT_FOUND');
    if(order.status!=='pending')return fail(res,409,'Cette commande n’est plus payable.','ORDER_NOT_PAYABLE');
    const apiKey=process.env.WAVE_API_KEY;
    if(!apiKey)return fail(res,503,'Le paiement Wave n’est pas encore configuré côté serveur.','WAVE_NOT_CONFIGURED');
    const base=(process.env.SITE_URL||'https://thecapitalinvest.vercel.app').replace(/\/$/,'');
    const response=await fetch('https://api.wave.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({
      amount:String(Math.round(Number(order.amount))),currency:order.currency||'XOF',client_reference:order.id,
      success_url:base+'/payment.html?wave=success&order='+encodeURIComponent(order.id),
      error_url:base+'/payment.html?wave=error&order='+encodeURIComponent(order.id)
    })});
    const data=await response.json().catch(()=>null);
    if(!response.ok||!data?.wave_launch_url){console.error('Wave checkout error',response.status,data);return fail(res,502,'Wave n’a pas pu créer la session de paiement.','WAVE_CHECKOUT_ERROR');}
    const {error:updateError}=await supabaseAdmin.from('payment_orders').update({provider:'wave_checkout',provider_reference:data.id||null,metadata:{plan_code:order.plan_code,billing_period:order.billing_period,wave_checkout_session_id:data.id||null}}).eq('id',order.id).eq('user_id',user.sub);
    if(updateError)throw updateError;
    return ok(res,{wave_launch_url:data.wave_launch_url,session_id:data.id||null,amount:order.amount,currency:order.currency});
  }catch(error){return fail(res,500,'Impossible de créer le paiement Wave.','WAVE_CHECKOUT_ERROR',error);}
}
