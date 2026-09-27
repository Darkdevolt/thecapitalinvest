/**
 * Données personnelles : alertes de cours et liste de suivi.
 * Les modes admin-billing et admin-institute réutilisent cette fonction
 * Vercel existante afin de conserver le nombre de fonctions serverless sous
 * la limite du déploiement actuel.
 */
import { supabaseAdmin, isSupabaseReady } from '../lib/supabase.js';
import { authenticate, authenticateAdmin, authenticateMasterAdmin, rateLimited, handlePreflight } from '../lib/middleware.js';
import { ok, fail, json, readBody, requestUrl, BodyError } from '../lib/http.js';
import { validators } from '../lib/validate.js';
import { handleAdminBilling, handleAdminInstitute } from '../lib/admin-billing.js';
import { handleAdminUsers, handleAdminSettings, handlePublicConfig } from '../lib/admin-users.js';
import { handleWaveCheckout } from '../lib/wave-checkout.js';

const TABLES = { alerts: 'alertes_cours', watchlist: 'watchlist' };
const TICKER_RE = /^[A-Z0-9]{2,12}$/;
function normalizeAlertType(value){const type=String(value||'').trim().toLowerCase();if(type==='above'||type==='hausse')return'HAUSSE';if(type==='below'||type==='baisse')return'BAISSE';return null;}
function toApiAlert(row){if(!row)return row;const condition=row.type_alerte==='HAUSSE'?'above':row.type_alerte==='BAISSE'?'below':row.type_alerte;return{...row,condition};}

export default async function handler(req,res){
  if(handlePreflight(req,res,{methods:'GET,POST,PUT,DELETE,OPTIONS'}))return;if(rateLimited(req,res,'user-data'))return;if(!isSupabaseReady()||!supabaseAdmin)return fail(res,503,'Service temporairement indisponible.','SERVICE_UNAVAILABLE');
  const url=requestUrl(req),mode=url.searchParams.get('mode');
  if(mode==='admin-billing'){
    const admin=req.method==='GET'?await authenticateAdmin(req,res):await authenticateMasterAdmin(req,res);if(!admin)return;return handleAdminBilling(req,res,admin);
  }
  if(mode==='wave-checkout')return handleWaveCheckout(req,res);
  if(mode==='public-config'){if(req.method!=='GET')return fail(res,405,'Méthode non autorisée.','METHOD_NOT_ALLOWED');return handlePublicConfig(req,res);}
  if(mode==='admin-users'){
    const admin=req.method==='GET'?await authenticateAdmin(req,res):await authenticateMasterAdmin(req,res);if(!admin)return;return handleAdminUsers(req,res,admin);
  }
  if(mode==='admin-settings'){
    const admin=req.method==='GET'?await authenticateAdmin(req,res):await authenticateMasterAdmin(req,res);if(!admin)return;return handleAdminSettings(req,res,admin);
  }
  if(mode==='admin-institute'){
    const admin=req.method==='GET'?await authenticateAdmin(req,res):await authenticateMasterAdmin(req,res);if(!admin)return;return handleAdminInstitute(req,res,admin);
  }
  const user=await authenticate(req,res);if(!user)return;const userId=user.sub;
  if(mode==='preferences'){
    try{
      if(req.method==='GET'){
        const {data,error}=await supabaseAdmin.from('user_preferences').select('display_mode,theme,currency,market_notifications,portfolio_notifications,updated_at').eq('user_id',userId).maybeSingle();
        if(error)throw error;
        return ok(res,{preferences:data||{display_mode:'simple',theme:'dark',currency:'XOF',market_notifications:true,portfolio_notifications:true}});
      }
      if(req.method==='PUT'){
        let body;try{body=await readBody(req)}catch(e){return fail(res,e instanceof BodyError?400:500,'Requête illisible.','INVALID_BODY')}
        const theme=body?.theme==='light'?'light':'dark',currency=['XOF','EUR','USD'].includes(body?.currency)?body.currency:'XOF',display_mode=body?.display_mode==='pro'?'pro':'simple';
        const row={user_id:userId,display_mode,theme,currency,market_notifications:body?.market_notifications!==false,portfolio_notifications:body?.portfolio_notifications!==false,updated_at:new Date().toISOString()};
        const {data,error}=await supabaseAdmin.from('user_preferences').upsert(row,{onConflict:'user_id'}).select('display_mode,theme,currency,market_notifications,portfolio_notifications,updated_at').single();
        if(error)throw error;return ok(res,{preferences:data});
      }
      return fail(res,405,'Méthode non autorisée.','METHOD_NOT_ALLOWED');
    }catch(error){return fail(res,500,'Impossible de charger ou sauvegarder vos préférences.','PREFERENCES_ERROR',error);}
  }
  if(mode==='subscription'){
    if(req.method!=='GET')return fail(res,405,'Méthode non autorisée.','METHOD_NOT_ALLOWED');
    try{
      const [{data:subs,error:se},{data:orders,error:oe}]=await Promise.all([
        supabaseAdmin.from('subscriptions').select('id,plan_code,status,started_at,current_period_start,current_period_end,canceled_at,cancel_reason,provider,created_at,updated_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(10),
        supabaseAdmin.from('payment_orders').select('id,plan_code,billing_period,amount,currency,provider,status,paid_at,expires_at,created_at,updated_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(10)
      ]);
      if(se)throw se;if(oe)throw oe;
      const active=(subs||[]).find(s=>s.status==='active' && (!s.current_period_end || new Date(s.current_period_end).getTime()>Date.now())) || null;
      return ok(res,{subscription:active,subscriptions:subs||[],recent_orders:orders||[]});
    }catch(error){return fail(res,500,'Impossible de charger votre abonnement.','SUBSCRIPTION_ERROR',error);}
  }
  if(mode==='payment-alert'){
    if(req.method!=='POST')return fail(res,405,'Méthode non autorisée.','METHOD_NOT_ALLOWED');
    let body;try{body=await readBody(req);}catch(e){return fail(res,e instanceof BodyError?400:500,'Requête illisible.','INVALID_BODY');}
    const proofId=String(body?.proof_id||'');
    if(!validators.uuid(proofId))return fail(res,400,'Reçu invalide.','INVALID_PROOF_ID');
    const {data:p,error:pe}=await supabaseAdmin.from('payment_proofs').select('id,user_id,payment_order_id,transaction_reference,claimed_amount,status,created_at').eq('id',proofId).eq('user_id',userId).maybeSingle();
    if(pe)throw pe;if(!p)return fail(res,404,'Reçu introuvable.','NOT_FOUND');
    if(p.status!=='pending')return ok(res,{sent:false,reason:'ALREADY_PROCESSED'});
    const [{data:u,error:ue},{data:o,error:oe}]=await Promise.all([
      supabaseAdmin.from('users').select('email,nom').eq('id',userId).maybeSingle(),
      supabaseAdmin.from('payment_orders').select('id,plan_code,billing_period,amount,currency').eq('id',p.payment_order_id).eq('user_id',userId).maybeSingle()
    ]);
    if(ue)throw ue;if(oe)throw oe;if(!u?.email||!o)return fail(res,404,'Commande ou client introuvable.','NOT_FOUND');
    const PLAN_NAMES={investor:'Investor',pro:'Pro',elite:'Elite',institute:'Institute'};
    const planName=PLAN_NAMES[o.plan_code]||o.plan_code||'The Capital';
    const mismatch=Number(o.amount)!==Number(p.claimed_amount);
    if(!mailerReady())return ok(res,{sent:false,reason:'MAILER_UNAVAILABLE'});
    const m=MAILS.paymentSubmittedToAdmin(u.nom,u.email,planName,o.billing_period,o.amount,p.claimed_amount,p.transaction_reference,o.id,p.id,mismatch);
    const sent=await sendMail({to:MASTER,name:'The Capital — Administration',subject:m.subject,content:m.content});
    return ok(res,{sent:sent.sent});
  }
  const table=TABLES[mode];if(!table)return fail(res,400,'Mode invalide (attendu : alerts ou watchlist).','INVALID_MODE');
  try{
    if(req.method==='GET'){const {data,error}=await supabaseAdmin.from(table).select('*').eq('user_id',userId).order('created_at',{ascending:false});if(error)throw error;const rows=data||[];return ok(res,mode==='alerts'?rows.map(toApiAlert):rows);}
    if(req.method==='POST'){let body;try{body=await readBody(req);}catch(e){return fail(res,e instanceof BodyError?400:500,'Requête illisible.','INVALID_BODY',e);}const ticker=String(body?.ticker||'').trim().toUpperCase();if(!TICKER_RE.test(ticker))return fail(res,400,'Ticker invalide.','INVALID_TICKER');let row;if(mode==='alerts'){const alertType=normalizeAlertType(body?.condition??body?.type_alerte);if(!alertType)return fail(res,400,"Condition d'alerte invalide.",'INVALID_CONDITION');const threshold=Number(body?.price??body?.seuil);if(!Number.isFinite(threshold)||threshold<=0)return fail(res,400,"Seuil d'alerte invalide.",'INVALID_THRESHOLD');row={user_id:userId,ticker,type_alerte:alertType,seuil:threshold,active:body?.active!==false,note:body?.note??null};}else row={user_id:userId,ticker,note:body?.note??null};const {data,error}=await supabaseAdmin.from(table).insert(row).select('*').single();if(error)throw error;return json(res,201,{success:true,data:mode==='alerts'?toApiAlert(data):data});}
    if(req.method==='PUT'){const id=url.searchParams.get('id')||'';if(!validators.uuid(id))return fail(res,400,'Identifiant invalide.','INVALID_ID');let body;try{body=await readBody(req);}catch(e){return fail(res,e instanceof BodyError?400:500,'Requête illisible.','INVALID_BODY',e);}const update={};if(Object.prototype.hasOwnProperty.call(body,'note'))update.note=body.note??null;if(mode==='alerts'&&Object.prototype.hasOwnProperty.call(body,'active'))update.active=body.active!==false;if(mode==='alerts'&&Object.prototype.hasOwnProperty.call(body,'seuil')){const seuil=Number(body.seuil);if(!Number.isFinite(seuil)||seuil<=0)return fail(res,400,'Seuil invalide.','INVALID_THRESHOLD');update.seuil=seuil;}if(!Object.keys(update).length)return fail(res,400,'Aucune modification fournie.','EMPTY_UPDATE');const {data,error}=await supabaseAdmin.from(table).update(update).eq('id',id).eq('user_id',userId).select('*').maybeSingle();if(error)throw error;if(!data)return fail(res,404,'Élément introuvable.','NOT_FOUND');return ok(res,mode==='alerts'?toApiAlert(data):data);}
    if(req.method==='DELETE'){const id=url.searchParams.get('id')||'';if(!validators.uuid(id))return fail(res,400,'Identifiant invalide.','INVALID_ID');const {data,error}=await supabaseAdmin.from(table).delete().eq('id',id).eq('user_id',userId).select('id');if(error)throw error;if(!data?.length)return fail(res,404,'Élément introuvable.','NOT_FOUND');return ok(res,{id});}
    return fail(res,405,'Méthode non autorisée.','METHOD_NOT_ALLOWED');
  }catch(error){return fail(res,500,'Erreur serveur.','USER_DATA_ERROR',error);}
}
