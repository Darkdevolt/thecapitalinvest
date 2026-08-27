import { supabaseAdmin } from './supabase.js';
import { fail, ok, readBody, requestUrl, BodyError } from './http.js';
import { validators } from './validate.js';

const SUB='id,user_id,plan_code,status,started_at,current_period_start,current_period_end,canceled_at,cancel_reason,provider,provider_subscription_id,created_at,updated_at';
const USER='id,email,nom,plan,plan_expire_at,created_at,last_sign_in_at';
const PAYMENT='id,user_id,subscription_id,amount,status,paid_at,provider,provider_payment_id,invoice_reference,created_at';
const STATUS=['trialing','active','past_due','paused','canceled','expired'];
const CLASSIC_PLANS=['free','pro','elite','all'];
const uuid=v=>validators.uuid(String(v||''));
const date=v=>{if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d.toISOString();};
async function audit(actor,action,table,id,oldData,newData){await supabaseAdmin.from('admin_audit_log').insert({actor_id:actor,action,table_name:table,record_id:String(id||''),old_data:oldData||null,new_data:newData||null});}
async function plan(code){
  const normalized=String(code||'').trim().toLowerCase();
  if(normalized==='all')return{code:'all',name:'All — Accès complet',active:true};
  const {data,error}=await supabaseAdmin.from('billing_plans').select('code,name,active').eq('code',normalized).maybeSingle();
  if(error)throw error;return data&&data.active?data:null;
}
function days(n){const x=Number(n);if(!Number.isFinite(x))return null;const d=new Date();d.setDate(d.getDate()+Math.trunc(x));return d.toISOString();}
async function ensureInstituteProgress(uid){const {data,error}=await supabaseAdmin.from('institute_progress').select('user_id').eq('user_id',uid).maybeSingle();if(error)throw error;if(!data){const {error:e}=await supabaseAdmin.from('institute_progress').insert({user_id:uid});if(e)throw e;}}
async function syncClassicUser(uid,code,end){const {error}=await supabaseAdmin.from('users').update({plan:code,plan_expire_at:code==='free'?null:end,updated_at:new Date().toISOString()}).eq('id',uid);if(error)throw error;}
async function latestSubscription(uid,codes){let q=supabaseAdmin.from('subscriptions').select(SUB).eq('user_id',uid).order('created_at',{ascending:false}).limit(1);if(codes&&codes.length)q=q.in('plan_code',codes);const {data,error}=await q;if(error)throw error;return data?.[0]||null;}

export async function handleAdminBilling(req,res,admin){
  try{
    if(req.method==='GET'){
      const url=requestUrl(req),limit=Math.min(Math.max(Number(url.searchParams.get('limit')||500),1),2000);
      const [s,u,p,pm,r]=await Promise.all([supabaseAdmin.from('subscriptions').select(SUB).order('created_at',{ascending:false}).limit(limit),supabaseAdmin.from('users').select(USER).order('created_at',{ascending:false}).limit(5000),supabaseAdmin.from('billing_plans').select('code,name,monthly_price,annual_price,weekly_price,quarterly_price,semiannual_price,currency,active,display_order').order('display_order',{ascending:true}),supabaseAdmin.from('payments').select(PAYMENT).order('created_at',{ascending:false}).limit(3000),supabaseAdmin.rpc('admin_payment_revenue_summary')]);
      for(const x of [s,u,p,pm])if(x.error)throw x.error;
      const users=Object.fromEntries((u.data||[]).map(x=>[x.id,x])),plans=Object.fromEntries((p.data||[]).map(x=>[x.code,x]));
      plans.all={code:'all',name:'All — Accès complet',monthly_price:null,annual_price:null,weekly_price:null,quarterly_price:null,semiannual_price:null,currency:'XOF',active:true,display_order:0};
      const latest={};for(const x of(pm.data||[])){const k=x.subscription_id||x.user_id;if(k&&!latest[k])latest[k]=x;}
      const rows=(s.data||[]).map(x=>({subscription:x,user:users[x.user_id]||null,plan:plans[x.plan_code]||null,last_payment:latest[x.id]||latest[x.user_id]||null})),now=Date.now(),stats={total:rows.length,active:0,expired:0,canceled:0,pending:0,subscribers:new Set(),by_plan:{}};
      rows.forEach(x=>{const st=x.subscription.status,end=x.subscription.current_period_end?Date.parse(x.subscription.current_period_end):null;if(st==='active'&&end&&end<now)stats.expired++;else if(st==='active')stats.active++;else if(st==='canceled')stats.canceled++;else if(st==='trialing'||st==='past_due')stats.pending++;stats.subscribers.add(x.subscription.user_id);stats.by_plan[x.subscription.plan_code]=(stats.by_plan[x.subscription.plan_code]||0)+1;});
      return ok(res,{rows,plans:Object.values(plans),users:u.data||[],stats:{...stats,subscribers:stats.subscribers.size},revenue:r.error?null:r.data||null});
    }
    if(req.method!=='POST')return fail(res,405,'Méthode non autorisée.','METHOD_NOT_ALLOWED');
    let b;try{b=await readBody(req);}catch(e){return fail(res,e instanceof BodyError?400:500,'Requête illisible.','INVALID_BODY');}
    const action=String(b?.action||'').toLowerCase(),uid=String(b?.user_id||''),sid=String(b?.subscription_id||'');

    if(action==='assign'){
      if(!uuid(uid))return fail(res,400,'Utilisateur invalide.','INVALID_USER_ID');
      const code=String(b?.plan_code||'').trim().toLowerCase(),pl=await plan(code);if(!pl)return fail(res,400,'Formule inexistante ou inactive.','INVALID_PLAN');
      const end=code==='free'?null:(date(b?.current_period_end)||days(b?.days||30));if(code!=='free'&&!end)return fail(res,400,'Date d’expiration invalide.','INVALID_EXPIRY');
      const now=new Date().toISOString();
      const existing=code==='institute'?await latestSubscription(uid,['institute']):await latestSubscription(uid,CLASSIC_PLANS);
      let saved;
      if(existing){
        const {data:up,error}=await supabaseAdmin.from('subscriptions').update({plan_code:code,status:'active',started_at:existing.started_at||now,current_period_start:now,current_period_end:end,canceled_at:null,cancel_reason:null,provider:'admin',provider_subscription_id:existing.provider_subscription_id||'admin-'+Date.now(),updated_at:now}).eq('id',existing.id).select(SUB).single();if(error)throw error;saved=up;
      }else{
        const {data:created,error}=await supabaseAdmin.from('subscriptions').insert({user_id:uid,plan_code:code,status:'active',started_at:now,current_period_start:now,current_period_end:end,provider:'admin',provider_subscription_id:'admin-'+code+'-'+Date.now()}).select(SUB).single();if(error)throw error;saved=created;
      }
      if(code==='institute') await ensureInstituteProgress(uid); else await syncClassicUser(uid,code,end);
      await audit(admin.id,'subscription_assign','subscriptions',saved.id,existing,saved);return ok(res,saved);
    }

    if(!uuid(sid))return fail(res,400,'Abonnement invalide.','INVALID_SUBSCRIPTION_ID');
    const {data:cur,error:ce}=await supabaseAdmin.from('subscriptions').select(SUB).eq('id',sid).maybeSingle();if(ce)throw ce;if(!cur)return fail(res,404,'Abonnement introuvable.','NOT_FOUND');

    if(action==='extend'){
      const n=Number(b?.days);if(!Number.isFinite(n)||n<=0||n>3650)return fail(res,400,'Nombre de jours invalide.','INVALID_DAYS');
      const d=cur.current_period_end&&Date.parse(cur.current_period_end)>Date.now()?new Date(cur.current_period_end):new Date();d.setDate(d.getDate()+Math.trunc(n));
      const {data:up,error}=await supabaseAdmin.from('subscriptions').update({status:'active',current_period_end:d.toISOString(),canceled_at:null,cancel_reason:null,updated_at:new Date().toISOString()}).eq('id',sid).select(SUB).single();if(error)throw error;
      if(cur.plan_code!=='institute')await syncClassicUser(cur.user_id,cur.plan_code,d.toISOString());else await ensureInstituteProgress(cur.user_id);
      await audit(admin.id,'subscription_extend','subscriptions',sid,cur,up);return ok(res,up);
    }

    if(action==='update'){
      const u={};let nextCode=cur.plan_code;
      if(b.plan_code!==undefined){nextCode=String(b.plan_code).toLowerCase();if(!(await plan(nextCode)))return fail(res,400,'Formule inexistante ou inactive.','INVALID_PLAN');u.plan_code=nextCode;}
      if(b.current_period_end!==undefined){const d=nextCode==='free'?null:date(b.current_period_end);if(nextCode!=='free'&&!d)return fail(res,400,'Date d’expiration invalide.','INVALID_EXPIRY');u.current_period_end=d;}
      if(b.status!==undefined){const st=String(b.status).toLowerCase();if(!STATUS.includes(st))return fail(res,400,'Statut invalide.','INVALID_STATUS');u.status=st;if(st==='active'){u.canceled_at=null;u.cancel_reason=null;}if(st==='canceled'){u.canceled_at=new Date().toISOString();u.cancel_reason='admin_cancel';}}
      u.updated_at=new Date().toISOString();
      const {data:up,error}=await supabaseAdmin.from('subscriptions').update(u).eq('id',sid).select(SUB).single();if(error)throw error;
      if(nextCode==='institute'){await ensureInstituteProgress(cur.user_id);}else if(up.status==='active'&&up.current_period_end){await syncClassicUser(cur.user_id,nextCode,up.current_period_end);}else if(up.status!=='active'){await syncClassicUser(cur.user_id,'free',null);}
      await audit(admin.id,'subscription_update','subscriptions',sid,cur,up);return ok(res,up);
    }

    if(action==='cancel'||action==='suspend'||action==='reactivate'){
      const st=action==='reactivate'?'active':action==='suspend'?'paused':'canceled';
      if(action==='reactivate'&&(!cur.current_period_end||Date.parse(cur.current_period_end)<=Date.now()))return fail(res,400,'Une nouvelle date d’expiration est requise.','EXPIRY_REQUIRED');
      const u={status:st,updated_at:new Date().toISOString(),canceled_at:st==='active'?null:new Date().toISOString(),cancel_reason:st==='active'?null:'admin_'+action};
      const {data:up,error}=await supabaseAdmin.from('subscriptions').update(u).eq('id',sid).select(SUB).single();if(error)throw error;
      if(cur.plan_code!=='institute'){if(st==='active')await syncClassicUser(cur.user_id,cur.plan_code,cur.current_period_end);else await syncClassicUser(cur.user_id,'free',null);}else if(st==='active')await ensureInstituteProgress(cur.user_id);
      await audit(admin.id,'subscription_'+action,'subscriptions',sid,cur,up);return ok(res,up);
    }
    return fail(res,400,'Action inconnue.','INVALID_ACTION');
  }catch(e){return fail(res,500,'Erreur serveur.','ADMIN_BILLING_ERROR',e);}
}

export async function handleAdminInstitute(req,res,admin){
  try{
    if(req.method==='GET'){
      const url=requestUrl(req),limit=Math.min(Math.max(Number(url.searchParams.get('limit')||1000),1),3000),[u,s,p]=await Promise.all([supabaseAdmin.from('users').select(USER).order('created_at',{ascending:false}).limit(5000),supabaseAdmin.from('subscriptions').select(SUB).in('plan_code',['institute','all']).order('created_at',{ascending:false}).limit(limit),supabaseAdmin.from('institute_progress').select('user_id,completed_lessons,completed_courses,xp,streak_days,last_activity_at,badges,updated_at,created_at').order('updated_at',{ascending:false}).limit(5000)]);
      for(const x of [u,s,p])if(x.error)throw x.error;const users=Object.fromEntries((u.data||[]).map(x=>[x.id,x])),progress=Object.fromEntries((p.data||[]).map(x=>[x.user_id,x])),latest={};for(const x of(s.data||[]))if(!latest[x.user_id])latest[x.user_id]=x;
      const rows=Object.keys(latest).map(id=>{const sub=latest[id],end=sub.current_period_end?Date.parse(sub.current_period_end):null;return{user:users[id]||null,subscription:sub,progress:progress[id]||null,access_active:sub.status==='active'&&(!end||end>Date.now())};}),courses=rows.reduce((n,r)=>n+(Array.isArray(r.progress?.completed_courses)?r.progress.completed_courses.length:0),0),lessons=rows.reduce((n,r)=>n+(Array.isArray(r.progress?.completed_lessons)?r.progress.completed_lessons.length:0),0);return ok(res,{rows,stats:{students:rows.length,active:rows.filter(x=>x.access_active).length,expired:rows.filter(x=>!x.access_active).length,courses_completed:courses,lessons_completed:lessons,average_completed_courses:rows.length?courses/rows.length:0}});
    }
    if(req.method!=='POST')return fail(res,405,'Méthode non autorisée.','METHOD_NOT_ALLOWED');let b;try{b=await readBody(req);}catch(e){return fail(res,e instanceof BodyError?400:500,'Requête illisible.','INVALID_BODY');}const action=String(b?.action||'').toLowerCase(),uid=String(b?.user_id||'');if(!uuid(uid))return fail(res,400,'Utilisateur invalide.','INVALID_USER_ID');
    const {data:subs,error:se}=await supabaseAdmin.from('subscriptions').select(SUB).eq('user_id',uid).eq('plan_code','institute').order('created_at',{ascending:false});if(se)throw se;const cur=subs?.[0]||null;
    if(action==='grant'){
      const end=date(b?.current_period_end)||(()=>{const d=new Date();d.setFullYear(d.getFullYear()+1);return d.toISOString();})();
      if(cur){const {data:up,error}=await supabaseAdmin.from('subscriptions').update({status:'active',current_period_start:new Date().toISOString(),current_period_end:end,canceled_at:null,cancel_reason:null,updated_at:new Date().toISOString()}).eq('id',cur.id).select(SUB).single();if(error)throw error;await ensureInstituteProgress(uid);await audit(admin.id,'institute_grant','subscriptions',uid,cur,up);return ok(res,up);}
      const now=new Date().toISOString();const {data:created,error}=await supabaseAdmin.from('subscriptions').insert({user_id:uid,plan_code:'institute',status:'active',started_at:now,current_period_start:now,current_period_end:end,provider:'admin',provider_subscription_id:'admin-institute-'+Date.now()}).select(SUB).single();if(error)throw error;await ensureInstituteProgress(uid);await audit(admin.id,'institute_grant','subscriptions',uid,null,created);return ok(res,created);
    }
    if(!cur)return fail(res,404,'Aucun accès Institute trouvé pour cet utilisateur.','INSTITUTE_ACCESS_NOT_FOUND');
    if(action==='extend'){const n=Number(b?.days);if(!Number.isFinite(n)||n<=0||n>3650)return fail(res,400,'Nombre de jours invalide.','INVALID_DAYS');const d=cur.current_period_end&&Date.parse(cur.current_period_end)>Date.now()?new Date(cur.current_period_end):new Date();d.setDate(d.getDate()+Math.trunc(n));const {data:up,error}=await supabaseAdmin.from('subscriptions').update({status:'active',current_period_end:d.toISOString(),canceled_at:null,updated_at:new Date().toISOString()}).eq('id',cur.id).select(SUB).single();if(error)throw error;await ensureInstituteProgress(uid);await audit(admin.id,'institute_extend','subscriptions',uid,cur,up);return ok(res,up);}
    if(action==='remove'||action==='suspend'){const {data:up,error}=await supabaseAdmin.from('subscriptions').update({status:action==='suspend'?'paused':'canceled',canceled_at:new Date().toISOString(),cancel_reason:'admin_'+action,updated_at:new Date().toISOString()}).eq('id',cur.id).select(SUB).single();if(error)throw error;await audit(admin.id,'institute_'+action,'subscriptions',uid,cur,up);return ok(res,up);}
    if(action==='reactivate'){const end=date(b?.current_period_end)||cur.current_period_end;if(!end||Date.parse(end)<=Date.now())return fail(res,400,'Une nouvelle date d’expiration est requise.','EXPIRY_REQUIRED');const {data:up,error}=await supabaseAdmin.from('subscriptions').update({status:'active',current_period_end:end,canceled_at:null,updated_at:new Date().toISOString()}).eq('id',cur.id).select(SUB).single();if(error)throw error;await ensureInstituteProgress(uid);await audit(admin.id,'institute_reactivate','subscriptions',uid,cur,up);return ok(res,up);}
    return fail(res,400,'Action inconnue.','INVALID_ACTION');
  }catch(e){return fail(res,500,'Erreur serveur.','ADMIN_INSTITUTE_ERROR',e);}
}
