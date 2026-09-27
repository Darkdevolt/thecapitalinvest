import { supabaseAdmin } from './supabase.js';
import { fail, ok, readBody, requestUrl, BodyError } from './http.js';
import { validators } from './validate.js';

const SUB='id,user_id,plan_code,status,started_at,current_period_start,current_period_end,canceled_at,cancel_reason,provider,provider_subscription_id,created_at,updated_at';
const USER='id,email,nom,plan,plan_expire_at,created_at,last_sign_in_at';
const PAYMENT='id,user_id,subscription_id,amount,status,paid_at,provider,provider_payment_id,invoice_reference,created_at';
const STATUS=['trialing','active','past_due','paused','canceled','expired'];
/* Formules The Capital Invest (tout sauf Institute). « investor » manquait :
   une attribution Investor créait un second abonnement au lieu de remplacer l'actuel. */
const CLASSIC_PLANS=['free','investor','pro','elite','all'];
const PERIOD_INTERVAL={weekly:[0,0,7],monthly:[0,1,0],quarterly:[0,3,0],semiannual:[0,6,0],annual:[1,0,0]};
function periodEnd(period,from){const p=PERIOD_INTERVAL[period];if(!p)return null;const d=from?new Date(from):new Date();d.setFullYear(d.getFullYear()+p[0]);d.setMonth(d.getMonth()+p[1]);d.setDate(d.getDate()+p[2]);return d.toISOString();}

/* Paiement confirmé (reçu vérifié ou encaissement constaté par l'administrateur) :
   même effet que review_payment_proof — commande payée, abonnement du produit
   remplacé, offre du compte synchronisée pour Invest. */
async function activateOrder(order,admin,{reference=null,note=null,source='admin_confirm'}={}){
  const now=new Date().toISOString(),end=periodEnd(order.billing_period);
  if(!end)throw new Error('Période de facturation non prise en charge.');
  const institute=order.plan_code==='institute';
  const {data:paid,error:oe}=await supabaseAdmin.from('payment_orders').update({status:'successful',paid_at:order.paid_at||now,provider_reference:reference||order.provider_reference||null,updated_at:now,metadata:{...(order.metadata||{}),confirmed_by:admin.id,confirmed_at:now,confirmation_source:source,confirmation_note:note||null}}).eq('id',order.id).select('*').single();
  if(oe)throw oe;
  let q=supabaseAdmin.from('subscriptions').update({status:'expired',updated_at:now,canceled_at:now,cancel_reason:'replaced_by_payment_order'}).eq('user_id',order.user_id).eq('status','active');
  q=institute?q.eq('plan_code','institute'):q.neq('plan_code','institute');
  const {error:xe}=await q;if(xe)throw xe;
  const {data:sub,error:se}=await supabaseAdmin.from('subscriptions').insert({user_id:order.user_id,plan_code:order.plan_code,status:'active',started_at:now,current_period_start:now,current_period_end:end,provider:order.provider||'wave',provider_subscription_id:'order-'+order.id}).select(SUB).single();
  if(se)throw se;
  if(institute)await ensureInstituteProgress(order.user_id);else await syncClassicUser(order.user_id,order.plan_code,end);
  await supabaseAdmin.from('payment_audit_log').insert({payment_order_id:order.id,actor_user_id:admin.id,action:source,from_status:order.status,to_status:'successful',note,metadata:{reference,subscription_id:sub.id}});
  await audit(admin.id,'payment_confirm','payment_orders',order.id,{status:order.status,amount:order.amount,plan_code:order.plan_code,billing_period:order.billing_period,user_id:order.user_id},{status:'successful',reference,note,subscription_id:sub.id,current_period_end:end,user_id:order.user_id});
  return {order:paid,subscription:sub};
}
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
      /* Reçu d'un client : lien signé de 10 minutes, affiché dans l'administration. */
      const proofId=url.searchParams.get('receipt');
      if(proofId){
        if(!uuid(proofId))return fail(res,400,'Reçu invalide.','INVALID_PROOF_ID');
        const {data:pr,error:pe}=await supabaseAdmin.from('payment_proofs').select('id,storage_path').eq('id',proofId).maybeSingle();
        if(pe)throw pe;if(!pr?.storage_path)return fail(res,404,'Aucun fichier pour ce reçu.','NOT_FOUND');
        const {data:sg,error:ge}=await supabaseAdmin.storage.from('payment-proofs').createSignedUrl(pr.storage_path,600);
        if(ge||!sg?.signedUrl)return fail(res,404,'Fichier du reçu introuvable dans le stockage.','RECEIPT_MISSING',ge);
        const ext=String(pr.storage_path.split('.').pop()||'').toLowerCase();
        return ok(res,{url:sg.signedUrl,kind:ext==='pdf'?'pdf':'image',path:pr.storage_path});
      }
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

    /* Commandes : confirmer un encaissement constaté (sans reçu), ou annuler. */
    if(action==='confirm_order'||action==='cancel_order'){
      const oid=String(b?.order_id||'');if(!uuid(oid))return fail(res,400,'Commande invalide.','INVALID_ORDER_ID');
      const {data:order,error:oe}=await supabaseAdmin.from('payment_orders').select('*').eq('id',oid).maybeSingle();if(oe)throw oe;if(!order)return fail(res,404,'Commande introuvable.','NOT_FOUND');
      if(action==='cancel_order'){
        if(order.status==='successful')return fail(res,409,'Commande déjà payée : utilisez un remboursement ou modifiez l’abonnement.','ORDER_PAID');
        const {data:up,error}=await supabaseAdmin.from('payment_orders').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',oid).select('*').single();if(error)throw error;
        await supabaseAdmin.from('payment_audit_log').insert({payment_order_id:oid,actor_user_id:admin.id,action:'admin_cancel',from_status:order.status,to_status:'cancelled',note:String(b?.note||'').slice(0,500)||null});
        await audit(admin.id,'order_cancel','payment_orders',oid,{status:order.status,user_id:order.user_id,amount:order.amount,plan_code:order.plan_code},{status:'cancelled',user_id:order.user_id});
        return ok(res,up);
      }
      if(order.status==='successful')return fail(res,409,'Cette commande est déjà payée.','ORDER_ALREADY_PAID');
      const reference=String(b?.reference||'').trim().slice(0,120)||null,note=String(b?.note||'').trim().slice(0,500)||null;
      const out=await activateOrder(order,admin,{reference,note,source:'admin_confirm'});
      /* Reçus en attente de cette commande : marqués validés. */
      await supabaseAdmin.from('payment_proofs').update({status:'approved',reviewed_by:admin.id,reviewed_at:new Date().toISOString(),reviewer_note:note||'Encaissement confirmé par l’administrateur',updated_at:new Date().toISOString()}).eq('payment_order_id',oid).in('status',['pending','needs_info']);
      return ok(res,out);
    }

    if(action==='assign'){
      if(!uuid(uid))return fail(res,400,'Utilisateur invalide.','INVALID_USER_ID');
      const code=String(b?.plan_code||'').trim().toLowerCase(),pl=await plan(code);if(!pl)return fail(res,400,'Formule inexistante ou inactive.','INVALID_PLAN');
      const end=code==='free'?null:(date(b?.current_period_end)||days(b?.days||30));if(code!=='free'&&!end)return fail(res,400,'Date d’expiration invalide.','INVALID_EXPIRY');
      const now=new Date().toISOString();
      const existing=code==='institute'?await latestSubscription(uid,['institute']):await latestSubscription(uid,CLASSIC_PLANS);
      let saved;
      /* Offre du compte écrite d'abord : si la base la refuse, l'abonnement n'est pas touché (plus d'état à moitié appliqué). */
      const {data:before}=await supabaseAdmin.from('users').select('plan,plan_expire_at').eq('id',uid).maybeSingle();
      if(code!=='institute')await syncClassicUser(uid,code,end);
      try{
      if(existing){
        const {data:up,error}=await supabaseAdmin.from('subscriptions').update({plan_code:code,status:'active',started_at:existing.started_at||now,current_period_start:now,current_period_end:end,canceled_at:null,cancel_reason:null,provider:'admin',provider_subscription_id:existing.provider_subscription_id||'admin-'+Date.now(),updated_at:now}).eq('id',existing.id).select(SUB).single();if(error)throw error;saved=up;
      }else{
        const {data:created,error}=await supabaseAdmin.from('subscriptions').insert({user_id:uid,plan_code:code,status:'active',started_at:now,current_period_start:now,current_period_end:end,provider:'admin',provider_subscription_id:'admin-'+code+'-'+Date.now()}).select(SUB).single();if(error)throw error;saved=created;
      }
      }catch(e){if(code!=='institute'&&before)await supabaseAdmin.from('users').update({plan:before.plan,plan_expire_at:before.plan_expire_at}).eq('id',uid);throw e;}
      if(code==='institute') await ensureInstituteProgress(uid);
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
  }catch(e){return fail(res,500,'Action refusée par la base : '+(e?.message||'erreur inconnue'),'ADMIN_BILLING_ERROR',e);}
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
  }catch(e){return fail(res,500,'Action refusée par la base : '+(e?.message||'erreur inconnue'),'ADMIN_INSTITUTE_ERROR',e);}
}
