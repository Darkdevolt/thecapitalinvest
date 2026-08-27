import { supabaseAdmin, isSupabaseReady } from '../lib/supabase.js';
import { authenticateAdmin, rateLimited, handlePreflight } from '../lib/middleware.js';
import { fail, ok, readBody, requestUrl, BodyError } from '../lib/http.js';
import { validators } from '../lib/validate.js';

const SUB_COLUMNS='id,user_id,plan_code,status,started_at,current_period_start,current_period_end,canceled_at,cancel_reason,provider,provider_subscription_id,created_at,updated_at';
const USER_COLUMNS='id,email,nom,plan,plan_expire_at,created_at,last_sign_in_at';
const PAYMENT_COLUMNS='id,user_id,subscription_id,amount,status,paid_at,provider,provider_payment_id,invoice_reference,created_at';

function dateOrNull(value){if(!value)return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d.toISOString();}
function uuid(value){return validators.uuid(String(value||''));}
function daysFromNow(days){const n=Number(days);if(!Number.isFinite(n))return null;const d=new Date();d.setDate(d.getDate()+Math.trunc(n));return d.toISOString();}
async function audit(actorId,action,recordId,oldData,newData){
  await supabaseAdmin.from('admin_audit_log').insert({actor_id:actorId,action,table_name:'subscriptions',record_id:String(recordId||''),old_data:oldData||null,new_data:newData||null});
}
async function planExists(code){const {data,error}=await supabaseAdmin.from('billing_plans').select('code,name,active').eq('code',code).maybeSingle();if(error)throw error;return data&&data.active?data:null;}

export default async function handler(req,res){
  if(handlePreflight(req,res,{methods:'GET,POST,OPTIONS'}))return;
  if(rateLimited(req,res,'admin-subscriptions'))return;
  if(!isSupabaseReady()||!supabaseAdmin)return fail(res,503,'Service temporairement indisponible.','SERVICE_UNAVAILABLE');
  const admin=await authenticateAdmin(req,res);if(!admin)return;
  try{
    if(req.method==='GET'){
      const url=requestUrl(req),limit=Math.min(Math.max(Number(url.searchParams.get('limit')||500),1),2000);
      const [subsRes,usersRes,plansRes,paymentsRes,revenueRes]=await Promise.all([
        supabaseAdmin.from('subscriptions').select(SUB_COLUMNS).order('created_at',{ascending:false}).limit(limit),
        supabaseAdmin.from('users').select(USER_COLUMNS).order('created_at',{ascending:false}).limit(5000),
        supabaseAdmin.from('billing_plans').select('code,name,monthly_price,annual_price,weekly_price,quarterly_price,semiannual_price,currency,active,display_order').order('display_order',{ascending:true}),
        supabaseAdmin.from('payments').select(PAYMENT_COLUMNS).order('created_at',{ascending:false}).limit(3000),
        supabaseAdmin.rpc('admin_payment_revenue_summary')
      ]);
      for(const x of [subsRes,usersRes,plansRes,paymentsRes])if(x.error)throw x.error;
      const users=Object.fromEntries((usersRes.data||[]).map(u=>[u.id,u]));
      const plans=Object.fromEntries((plansRes.data||[]).map(p=>[p.code,p]));
      const latestPayment={};
      for(const p of (paymentsRes.data||[])){
        const key=p.subscription_id||p.user_id;
        if(key&&!latestPayment[key])latestPayment[key]=p;
      }
      const rows=(subsRes.data||[]).map(s=>({subscription:s,user:users[s.user_id]||null,plan:plans[s.plan_code]||null,last_payment:latestPayment[s.id]||latestPayment[s.user_id]||null}));
      const now=Date.now();
      const stats={total:rows.length,active:0,expired:0,canceled:0,pending:0,subscribers:new Set(),by_plan:{}};
      rows.forEach(r=>{stats.subscribers.add(r.subscription.user_id);const st=String(r.subscription.status||'').toLowerCase();const end=r.subscription.current_period_end?Date.parse(r.subscription.current_period_end):null;if(st==='active'&&end&&end<now){stats.expired++;}else if(st==='active'){stats.active++;}else if(st==='canceled'||st==='cancelled'){stats.canceled++;}else if(st==='pending'||st==='processing'){stats.pending++;}const code=r.subscription.plan_code;stats.by_plan[code]=(stats.by_plan[code]||0)+1;});
      return ok(res,{rows,plans:plansRes.data||[],stats:{...stats,subscribers:stats.subscribers.size},revenue:revenueRes.error?null:revenueRes.data||null});
    }
    if(req.method!=='POST')return fail(res,405,'Méthode non autorisée.','METHOD_NOT_ALLOWED');
    let body;try{body=await readBody(req);}catch(e){return fail(res,e instanceof BodyError?400:500,'Requête illisible.','INVALID_BODY');}
    const action=String(body?.action||'').trim().toLowerCase(),userId=String(body?.user_id||''),subscriptionId=String(body?.subscription_id||'');
    if(action==='assign'){
      if(!uuid(userId))return fail(res,400,'Utilisateur invalide.','INVALID_USER_ID');
      const planCode=String(body?.plan_code||'').trim().toLowerCase();if(!planCode)return fail(res,400,'Formule requise.','PLAN_REQUIRED');
      const plan=await planExists(planCode);if(!plan)return fail(res,400,'Formule inexistante ou inactive.','INVALID_PLAN');
      const end=dateOrNull(body?.current_period_end)||daysFromNow(body?.days||30);if(!end)return fail(res,400,'Date d’expiration invalide.','INVALID_EXPIRY');
      const started=dateOrNull(body?.started_at)||new Date().toISOString();
      const {data:old,error:oldErr}=await supabaseAdmin.from('subscriptions').select(SUB_COLUMNS).eq('user_id',userId).eq('status','active').neq('plan_code',planCode);if(oldErr)throw oldErr;
      if(old?.length){const {error}=await supabaseAdmin.from('subscriptions').update({status:'expired',canceled_at:new Date().toISOString(),cancel_reason:'replaced_by_admin',updated_at:new Date().toISOString()}).in('id',old.map(x=>x.id));if(error)throw error;}
      const {data:created,error}=await supabaseAdmin.from('subscriptions').insert({user_id:userId,plan_code:planCode,status:'active',started_at:started,current_period_start:started,current_period_end:end,provider:'admin',provider_subscription_id:'admin-'+Date.now()}).select(SUB_COLUMNS).single();if(error)throw error;
      if(planCode!=='institute'){const {error:e}=await supabaseAdmin.from('users').update({plan:planCode,plan_expire_at:end,updated_at:new Date().toISOString()}).eq('id',userId);if(e)throw e;}
      await audit(admin.id,'subscription_assign',created.id,null,created);
      return ok(res,created);
    }
    if(!uuid(subscriptionId))return fail(res,400,'Abonnement invalide.','INVALID_SUBSCRIPTION_ID');
    const {data:current,error:currentErr}=await supabaseAdmin.from('subscriptions').select(SUB_COLUMNS).eq('id',subscriptionId).maybeSingle();if(currentErr)throw currentErr;if(!current)return fail(res,404,'Abonnement introuvable.','NOT_FOUND');
    if(action==='extend'){
      const days=Number(body?.days);if(!Number.isFinite(days)||days<=0||days>3650)return fail(res,400,'Nombre de jours invalide.','INVALID_DAYS');
      const base=current.current_period_end&&Date.parse(current.current_period_end)>Date.now()?new Date(current.current_period_end):new Date();base.setDate(base.getDate()+Math.trunc(days));
      const {data:updated,error}=await supabaseAdmin.from('subscriptions').update({current_period_end:base.toISOString(),status:'active',canceled_at:null,cancel_reason:null,updated_at:new Date().toISOString()}).eq('id',subscriptionId).select(SUB_COLUMNS).single();if(error)throw error;
      if(updated.plan_code!=='institute'){const {error:e}=await supabaseAdmin.from('users').update({plan:updated.plan_code,plan_expire_at:updated.current_period_end,updated_at:new Date().toISOString()}).eq('id',updated.user_id);if(e)throw e;}
      await audit(admin.id,'subscription_extend',subscriptionId,current,updated);return ok(res,updated);
    }
    if(action==='update'){
      const update={};
      if(body.plan_code!==undefined){const code=String(body.plan_code).trim().toLowerCase();if(!(await planExists(code)))return fail(res,400,'Formule inexistante ou inactive.','INVALID_PLAN');update.plan_code=code;}
      if(body.current_period_end!==undefined){const d=dateOrNull(body.current_period_end);if(!d)return fail(res,400,'Date d’expiration invalide.','INVALID_EXPIRY');update.current_period_end=d;}
      if(body.status!==undefined){const status=String(body.status).trim().toLowerCase();if(!['active','expired','canceled','suspended','pending'].includes(status))return fail(res,400,'Statut invalide.','INVALID_STATUS');update.status=status;if(status==='active'){update.canceled_at=null;update.cancel_reason=null;}if(status==='canceled'){update.canceled_at=new Date().toISOString();}}
      if(!Object.keys(update).length)return fail(res,400,'Aucune modification fournie.','EMPTY_UPDATE');
      update.updated_at=new Date().toISOString();const {data:updated,error}=await supabaseAdmin.from('subscriptions').update(update).eq('id',subscriptionId).select(SUB_COLUMNS).single();if(error)throw error;
      if(updated.plan_code!=='institute'&&['active','expired','canceled','suspended'].includes(updated.status)){const expiry=updated.status==='active'?updated.current_period_end:null;const {error:e}=await supabaseAdmin.from('users').update({plan:updated.plan_code,plan_expire_at:expiry,updated_at:new Date().toISOString()}).eq('id',updated.user_id);if(e)throw e;}
      await audit(admin.id,'subscription_update',subscriptionId,current,updated);return ok(res,updated);
    }
    if(action==='cancel'||action==='suspend'||action==='reactivate'){
      const status=action==='reactivate'?'active':action==='suspend'?'suspended':'canceled';
      const update={status,updated_at:new Date().toISOString(),canceled_at:status==='active'?null:new Date().toISOString(),cancel_reason:status==='active'?null:`admin_${action}`};
      const {data:updated,error}=await supabaseAdmin.from('subscriptions').update(update).eq('id',subscriptionId).select(SUB_COLUMNS).single();if(error)throw error;
      if(updated.plan_code!=='institute'){const expiry=status==='active'?updated.current_period_end:null;const {error:e}=await supabaseAdmin.from('users').update({plan:status==='active'?updated.plan_code:'free',plan_expire_at:expiry,updated_at:new Date().toISOString()}).eq('id',updated.user_id);if(e)throw e;}
      await audit(admin.id,'subscription_'+action,subscriptionId,current,updated);return ok(res,updated);
    }
    return fail(res,400,'Action inconnue.','INVALID_ACTION');
  }catch(error){return fail(res,500,'Erreur serveur.','ADMIN_SUBSCRIPTIONS_ERROR',error);}
}
