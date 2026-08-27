import { supabaseAdmin, isSupabaseReady } from '../lib/supabase.js';
import { authenticateAdmin, rateLimited, handlePreflight } from '../lib/middleware.js';
import { fail, ok, readBody, requestUrl, BodyError } from '../lib/http.js';
import { validators } from '../lib/validate.js';

const USER_COLUMNS='id,email,nom,plan,plan_expire_at,created_at,last_sign_in_at';
const SUB_COLUMNS='id,user_id,plan_code,status,started_at,current_period_start,current_period_end,canceled_at,created_at,updated_at';
const PROGRESS_COLUMNS='user_id,completed_lessons,completed_courses,xp,streak_days,last_activity_at,badges,updated_at,created_at';
function uuid(value){return validators.uuid(String(value||''));}
function expiry(value){if(!value)return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d.toISOString();}
async function audit(actorId,action,recordId,oldData,newData){await supabaseAdmin.from('admin_audit_log').insert({actor_id:actorId,action,table_name:'institute_progress',record_id:String(recordId||''),old_data:oldData||null,new_data:newData||null});}
async function activeInstituteSubscription(userId){const {data,error}=await supabaseAdmin.from('subscriptions').select(SUB_COLUMNS).eq('user_id',userId).eq('plan_code','institute').order('created_at',{ascending:false});if(error)throw error;return data||[];}

export default async function handler(req,res){
  if(handlePreflight(req,res,{methods:'GET,POST,OPTIONS'}))return;
  if(rateLimited(req,res,'admin-institute'))return;
  if(!isSupabaseReady()||!supabaseAdmin)return fail(res,503,'Service temporairement indisponible.','SERVICE_UNAVAILABLE');
  const admin=await authenticateAdmin(req,res);if(!admin)return;
  try{
    if(req.method==='GET'){
      const url=requestUrl(req),limit=Math.min(Math.max(Number(url.searchParams.get('limit')||1000),1),3000);
      const [usersRes,subsRes,progressRes]=await Promise.all([
        supabaseAdmin.from('users').select(USER_COLUMNS).order('created_at',{ascending:false}).limit(5000),
        supabaseAdmin.from('subscriptions').select(SUB_COLUMNS).eq('plan_code','institute').order('created_at',{ascending:false}).limit(limit),
        supabaseAdmin.from('institute_progress').select(PROGRESS_COLUMNS).order('updated_at',{ascending:false}).limit(5000)
      ]);
      for(const x of [usersRes,subsRes,progressRes])if(x.error)throw x.error;
      const users=Object.fromEntries((usersRes.data||[]).map(u=>[u.id,u]));
      const progress=Object.fromEntries((progressRes.data||[]).map(p=>[p.user_id,p]));
      const latest={};for(const s of (subsRes.data||[]))if(!latest[s.user_id])latest[s.user_id]=s;
      const rows=Object.keys(latest).map(userId=>{const s=latest[userId],p=progress[userId]||null,u=users[userId]||null;const end=s.current_period_end?Date.parse(s.current_period_end):null;const active=s.status==='active'&&(!end||end>Date.now());return{user:u,subscription:s,progress:p,access_active:active};});
      const active=rows.filter(r=>r.access_active).length,expired=rows.filter(r=>!r.access_active).length;
      const totalCourses=rows.reduce((n,r)=>n+(Array.isArray(r.progress?.completed_courses)?r.progress.completed_courses.length:0),0);
      const totalLessons=rows.reduce((n,r)=>n+(Array.isArray(r.progress?.completed_lessons)?r.progress.completed_lessons.length:0),0);
      const progressValues=rows.map(r=>{const courses=Array.isArray(r.progress?.completed_courses)?r.progress.completed_courses.length:0;return courses;});
      return ok(res,{rows,stats:{students:rows.length,active,expired,courses_completed:totalCourses,lessons_completed:totalLessons,average_completed_courses:progressValues.length?totalCourses/progressValues.length:0}});
    }
    if(req.method!=='POST')return fail(res,405,'Méthode non autorisée.','METHOD_NOT_ALLOWED');
    let body;try{body=await readBody(req);}catch(e){return fail(res,e instanceof BodyError?400:500,'Requête illisible.','INVALID_BODY');}
    const action=String(body?.action||'').trim().toLowerCase(),userId=String(body?.user_id||'');
    if(!uuid(userId))return fail(res,400,'Utilisateur invalide.','INVALID_USER_ID');
    const subs=await activeInstituteSubscription(userId),current=subs[0]||null;
    if(action==='grant'){
      const end=expiry(body?.current_period_end)||(()=>{const d=new Date();d.setFullYear(d.getFullYear()+1);return d.toISOString();})();
      if(!end)return fail(res,400,'Date d’expiration invalide.','INVALID_EXPIRY');
      if(current){
        const {data:updated,error}=await supabaseAdmin.from('subscriptions').update({status:'active',current_period_start:new Date().toISOString(),current_period_end:end,canceled_at:null,cancel_reason:null,updated_at:new Date().toISOString()}).eq('id',current.id).select(SUB_COLUMNS).single();if(error)throw error;
        await audit(admin.id,'institute_grant',userId,current,updated);
        return ok(res,updated);
      }
      const {data:created,error}=await supabaseAdmin.from('subscriptions').insert({user_id:userId,plan_code:'institute',status:'active',started_at:new Date().toISOString(),current_period_start:new Date().toISOString(),current_period_end:end,provider:'admin',provider_subscription_id:'admin-institute-'+Date.now()}).select(SUB_COLUMNS).single();if(error)throw error;
      const {data:existingProgress}=await supabaseAdmin.from('institute_progress').select(PROGRESS_COLUMNS).eq('user_id',userId).maybeSingle();
      if(!existingProgress){const {error:e}=await supabaseAdmin.from('institute_progress').insert({user_id:userId});if(e)throw e;}
      await audit(admin.id,'institute_grant',userId,null,created);return ok(res,created);
    }
    if(!current)return fail(res,404,'Aucun accès Institute trouvé pour cet utilisateur.','INSTITUTE_ACCESS_NOT_FOUND');
    if(action==='extend'){
      const days=Number(body?.days);if(!Number.isFinite(days)||days<=0||days>3650)return fail(res,400,'Nombre de jours invalide.','INVALID_DAYS');
      const base=current.current_period_end&&Date.parse(current.current_period_end)>Date.now()?new Date(current.current_period_end):new Date();base.setDate(base.getDate()+Math.trunc(days));
      const {data:updated,error}=await supabaseAdmin.from('subscriptions').update({status:'active',current_period_end:base.toISOString(),canceled_at:null,cancel_reason:null,updated_at:new Date().toISOString()}).eq('id',current.id).select(SUB_COLUMNS).single();if(error)throw error;await audit(admin.id,'institute_extend',userId,current,updated);return ok(res,updated);
    }
    if(action==='remove'||action==='suspend'){
      const {data:updated,error}=await supabaseAdmin.from('subscriptions').update({status:action==='suspend'?'suspended':'canceled',canceled_at:new Date().toISOString(),cancel_reason:'admin_'+action,updated_at:new Date().toISOString()}).eq('id',current.id).select(SUB_COLUMNS).single();if(error)throw error;await audit(admin.id,'institute_'+action,userId,current,updated);return ok(res,updated);
    }
    if(action==='reactivate'){
      const end=expiry(body?.current_period_end)||current.current_period_end;if(!end||Date.parse(end)<=Date.now())return fail(res,400,'Une nouvelle date d’expiration est requise pour réactiver cet accès.','EXPIRY_REQUIRED');
      const {data:updated,error}=await supabaseAdmin.from('subscriptions').update({status:'active',current_period_end:end,canceled_at:null,cancel_reason:null,updated_at:new Date().toISOString()}).eq('id',current.id).select(SUB_COLUMNS).single();if(error)throw error;await audit(admin.id,'institute_reactivate',userId,current,updated);return ok(res,updated);
    }
    return fail(res,400,'Action inconnue.','INVALID_ACTION');
  }catch(error){return fail(res,500,'Erreur serveur.','ADMIN_INSTITUTE_ERROR',error);}
}
