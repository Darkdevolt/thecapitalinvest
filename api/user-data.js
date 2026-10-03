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
import { resolveEntitlements, meets, FEATURE_TIER, TIERS_MODE } from '../lib/entitlements.js';

const TABLES = { alerts: 'alertes_cours', watchlist: 'watchlist' };
const TICKER_RE = /^[A-Z0-9]{2,12}$/;
/* alertes_cours.id est un entier (bigint) : l'ancienne validation UUID refusait toute modification ou suppression. */
const validId = id => validators.uuid(id) || /^\d{1,18}$/.test(id);
function normalizeAlertType(value){const type=String(value||'').trim().toLowerCase();if(type==='above'||type==='hausse')return'HAUSSE';if(type==='below'||type==='baisse')return'BAISSE';return null;}
function toApiAlert(row){if(!row)return row;const condition=row.type_alerte==='HAUSSE'?'above':row.type_alerte==='BAISSE'?'below':row.type_alerte;return{...row,condition};}


/* Personnalisation du simulateur obligataire : seules des images matricielles
   (PNG, JPEG, WebP) en data URL sont acceptées, jamais de SVG. */
const HEX_RE=/^#[0-9a-f]{6}$/i;
const LOGO_RE=/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const txt=(v,n)=>String(v??'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,n);
function cleanMarque(m){
  if(!m||typeof m!=='object')return{value:{}};
  const out={nom:txt(m.nom,80),mention:txt(m.mention,200)};
  for(const k of['couleur','couleur_texte','couleur_fond']){if(m[k]==null||m[k]==='')continue;if(!HEX_RE.test(String(m[k])))return{error:'Couleur invalide (format #RRGGBB attendu).'};out[k]=String(m[k]).toLowerCase();}
  if(m.logo){const l=String(m.logo);if(!LOGO_RE.test(l))return{error:'Logo invalide : PNG, JPEG ou WebP uniquement.'};if(l.length>300000)return{error:'Logo trop lourd (300 Ko maximum).'};out.logo=l;}
  return{value:out};
}
const PARAM_KEYS={commission_sgi_pct:'n',commission_sgi_libelle:'s',taf_pct:'n',taf_sur_apporteur:'b',apporteur_par_titre:'n',apporteur_actif:'b',brvm_dcbr_pct:'n',brvm_dcbr_base:'base',brvm_dcbr_actif:'b',delai_reglement_jours:'n',masquer:'list'};
function cleanParams(p){
  const out={};if(!p||typeof p!=='object')return out;
  for(const [k,t] of Object.entries(PARAM_KEYS)){
    if(p[k]==null)continue;const v=p[k];
    if(t==='n'){const n=Number(v);if(Number.isFinite(n)&&n>=0&&n<=100000)out[k]=n;}
    else if(t==='s')out[k]=txt(v,60);
    else if(t==='b')out[k]=v===true;
    else if(t==='base')out[k]=v==='montant'?'montant':'nominal';
    else if(t==='list'&&Array.isArray(v))out[k]=v.slice(0,40).map(x=>txt(x,40)).filter(x=>/^[a-z_]+$/.test(x));
  }
  return out;
}

/* Droit d'accès d'une fonctionnalité payante, aligné sur le front (tiers.js) :
   appliqué seulement quand les formules sont actives. */
async function hasFeature(req,feature){
  if(TIERS_MODE!=='on')return true;
  const ent=await resolveEntitlements(req);
  return meets(ent.effective,FEATURE_TIER[feature]||'pro');
}
const pct=(v,max)=>{const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=max?Math.round(n*10000)/10000:undefined;};
function cleanFrais(f){
  const o={};if(!f||typeof f!=='object')return o;
  const map={courtage_pct:10,tva_pct:30,brvm_pct:1,dcbr_pct:1,gestion_annuelle_pct:10,performance_pct:50,droits_garde_pct:5};
  for(const [k,max] of Object.entries(map)){const v=pct(f[k],max);if(v!==undefined)o[k]=v;}
  return o;
}
function cleanLimites(l){
  const o={};if(!l||typeof l!=='object')return o;
  for(const k of['ligne_max_pct','secteur_max_pct','cash_min_pct','cash_max_pct','actions_max_pct','perte_alerte_pct']){const v=pct(l[k],100);if(v!==undefined)o[k]=v;}
  return o;
}
const CLIENT_TYPES=new Set(['particulier','entreprise','institutionnel']),PROFILS=new Set(['prudent','equilibre','dynamique']);
function cleanClient(b,creating){
  if(!b||typeof b!=='object')return{error:'Fiche client vide.'};
  const v={};
  if(creating||b.code!==undefined){const code=txt(b.code,40).replace(/@/g,'');if(!code)return{error:'Code client obligatoire.'};v.code=code;}
  if(creating||b.nom!==undefined){const nom=txt(b.nom,120);if(!nom)return{error:'Nom du client obligatoire.'};v.nom=nom;}
  if(b.type_client!==undefined)v.type_client=CLIENT_TYPES.has(b.type_client)?b.type_client:'particulier';
  if(b.profil_risque!==undefined)v.profil_risque=PROFILS.has(b.profil_risque)?b.profil_risque:'equilibre';
  for(const [k,n] of [['email',120],['telephone',40],['numero_compte',60],['objectif',300],['horizon',60],['notes',2000]])if(b[k]!==undefined)v[k]=txt(b[k],n)||null;
  if(v.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))return{error:'Adresse e-mail invalide.'};
  if(b.date_ouverture!==undefined)v.date_ouverture=b.date_ouverture&&validators.date(String(b.date_ouverture))?String(b.date_ouverture):null;
  if(b.frais!==undefined)v.frais=cleanFrais(b.frais);
  if(b.limites!==undefined)v.limites=cleanLimites(b.limites);
  if(b.actif!==undefined)v.actif=b.actif!==false;
  return{value:v};
}
function cleanGestionParams(p){
  const o={frais:cleanFrais(p?.frais),profils:{},mention_releve:txt(p?.mention_releve,300)};
  for(const k of PROFILS)o.profils[k]=cleanLimites(p?.profils?.[k]);
  return o;
}

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
  if(mode==='simulateur-profil'){
    try{
      if(req.method==='GET'){
        const {data,error}=await supabaseAdmin.from('simulateur_profils').select('marque,parametres,updated_at').eq('user_id',userId).maybeSingle();
        if(error)throw error;return ok(res,{profil:data||null});
      }
      if(req.method!=='PUT')return fail(res,405,'Méthode non autorisée.','METHOD_NOT_ALLOWED');
      if(!await hasFeature(req,'simulateur_obligataire'))return fail(res,403,'Personnalisation réservée à la formule Pro.','PLAN_REQUIRED');
      let body;try{body=await readBody(req,{limit:600000})}catch(e){return fail(res,e instanceof BodyError?400:500,'Requête illisible.','INVALID_BODY')}
      const row={user_id:userId,updated_at:new Date().toISOString()};
      if(body&&Object.prototype.hasOwnProperty.call(body,'marque')){const m=cleanMarque(body.marque);if(m.error)return fail(res,400,m.error,'INVALID_BRAND');row.marque=m.value;}
      if(body&&Object.prototype.hasOwnProperty.call(body,'parametres')){row.parametres=cleanParams(body.parametres);}
      const {data,error}=await supabaseAdmin.from('simulateur_profils').upsert(row,{onConflict:'user_id'}).select('marque,parametres,updated_at').single();
      if(error)throw error;return ok(res,{profil:data});
    }catch(error){return fail(res,500,'Impossible de charger ou d\'enregistrer la personnalisation.','PROFILE_ERROR',error);}
  }
  if(mode==='gestion-clients'||mode==='gestion-parametres'){
    if(!await hasFeature(req,'gestion_pro'))return fail(res,403,'Espace Gérant réservé à la formule Pro.','PLAN_REQUIRED');
    try{
      if(mode==='gestion-parametres'){
        if(req.method==='GET'){const {data,error}=await supabaseAdmin.from('gestion_parametres').select('valeur,updated_at').eq('user_id',userId).maybeSingle();if(error)throw error;return ok(res,{parametres:data?.valeur||{},updated_at:data?.updated_at||null});}
        if(req.method!=='PUT')return fail(res,405,'Méthode non autorisée.','METHOD_NOT_ALLOWED');
        let body;try{body=await readBody(req)}catch(e){return fail(res,e instanceof BodyError?400:500,'Requête illisible.','INVALID_BODY')}
        const valeur=cleanGestionParams(body?.parametres??body);
        const {data,error}=await supabaseAdmin.from('gestion_parametres').upsert({user_id:userId,valeur,updated_at:new Date().toISOString()},{onConflict:'user_id'}).select('valeur,updated_at').single();
        if(error)throw error;return ok(res,{parametres:data.valeur,updated_at:data.updated_at});
      }
      const id=url.searchParams.get('id')||'';
      if(req.method==='GET'){const {data,error}=await supabaseAdmin.from('gestion_clients').select('*').eq('gerant_id',userId).order('nom',{ascending:true});if(error)throw error;return ok(res,{clients:data||[]});}
      if(req.method==='DELETE'){
        if(!validators.uuid(id))return fail(res,400,'Identifiant invalide.','INVALID_ID');
        const {data,error}=await supabaseAdmin.from('gestion_clients').delete().eq('id',id).eq('gerant_id',userId).select('id');
        if(error)throw error;if(!data?.length)return fail(res,404,'Client introuvable.','NOT_FOUND');return ok(res,{id});
      }
      if(req.method!=='POST'&&req.method!=='PUT')return fail(res,405,'Méthode non autorisée.','METHOD_NOT_ALLOWED');
      let body;try{body=await readBody(req)}catch(e){return fail(res,e instanceof BodyError?400:500,'Requête illisible.','INVALID_BODY')}
      const c=cleanClient(body,req.method==='POST');if(c.error)return fail(res,400,c.error,'INVALID_CLIENT');
      const row={...c.value,updated_at:new Date().toISOString()};
      let q;
      if(req.method==='POST'){
        const {count,error:ce}=await supabaseAdmin.from('gestion_clients').select('id',{count:'exact',head:true}).eq('gerant_id',userId);
        if(ce)throw ce;if((count||0)>=500)return fail(res,400,'Limite de 500 clients atteinte.','CLIENT_LIMIT');
        q=supabaseAdmin.from('gestion_clients').insert({...row,gerant_id:userId}).select('*').single();
      }else{
        if(!validators.uuid(id))return fail(res,400,'Identifiant invalide.','INVALID_ID');
        q=supabaseAdmin.from('gestion_clients').update(row).eq('id',id).eq('gerant_id',userId).select('*').maybeSingle();
      }
      const {data,error}=await q;
      if(error&&error.code==='23505')return fail(res,409,'Ce code client est déjà utilisé.','DUPLICATE_CODE');
      if(error)throw error;if(!data)return fail(res,404,'Client introuvable.','NOT_FOUND');
      return json(res,req.method==='POST'?201:200,{success:true,data});
    }catch(error){return fail(res,500,'Impossible de traiter la demande de l\'Espace Gérant.','GESTION_ERROR',error);}
  }
  const table=TABLES[mode];if(!table)return fail(res,400,'Mode invalide (attendu : alerts ou watchlist).','INVALID_MODE');
  try{
    if(req.method==='GET'){const {data,error}=await supabaseAdmin.from(table).select('*').eq('user_id',userId).order('created_at',{ascending:false});if(error)throw error;const rows=data||[];return ok(res,mode==='alerts'?rows.map(toApiAlert):rows);}
    if(req.method==='POST'){let body;try{body=await readBody(req);}catch(e){return fail(res,e instanceof BodyError?400:500,'Requête illisible.','INVALID_BODY',e);}const ticker=String(body?.ticker||'').trim().toUpperCase();if(!TICKER_RE.test(ticker))return fail(res,400,'Ticker invalide.','INVALID_TICKER');let row;if(mode==='alerts'){const alertType=normalizeAlertType(body?.condition??body?.type_alerte);if(!alertType)return fail(res,400,"Condition d'alerte invalide.",'INVALID_CONDITION');const threshold=Number(body?.price??body?.seuil);if(!Number.isFinite(threshold)||threshold<=0)return fail(res,400,"Seuil d'alerte invalide.",'INVALID_THRESHOLD');row={user_id:userId,ticker,type_alerte:alertType,seuil:threshold,active:body?.active!==false,note:body?.note??null};}else row={user_id:userId,ticker,note:body?.note??null};const {data,error}=await supabaseAdmin.from(table).insert(row).select('*').single();if(error&&error.code==='23505'&&mode==='watchlist'){/* Déjà suivie : on renvoie la ligne existante plutôt qu'une erreur serveur. */const {data:existing}=await supabaseAdmin.from(table).select('*').eq('user_id',userId).eq('ticker',ticker).maybeSingle();return ok(res,existing||row);}if(error)throw error;return json(res,201,{success:true,data:mode==='alerts'?toApiAlert(data):data});}
    if(req.method==='PUT'){const id=url.searchParams.get('id')||'';if(!validId(id))return fail(res,400,'Identifiant invalide.','INVALID_ID');let body;try{body=await readBody(req);}catch(e){return fail(res,e instanceof BodyError?400:500,'Requête illisible.','INVALID_BODY',e);}const update={};if(Object.prototype.hasOwnProperty.call(body,'note'))update.note=body.note??null;if(mode==='alerts'&&Object.prototype.hasOwnProperty.call(body,'active')){update.active=body.active!==false;if(update.active){update.triggered_at=null;update.triggered_price=null;}}if(mode==='alerts'&&Object.prototype.hasOwnProperty.call(body,'seuil')){const seuil=Number(body.seuil);if(!Number.isFinite(seuil)||seuil<=0)return fail(res,400,'Seuil invalide.','INVALID_THRESHOLD');update.seuil=seuil;}if(!Object.keys(update).length)return fail(res,400,'Aucune modification fournie.','EMPTY_UPDATE');const {data,error}=await supabaseAdmin.from(table).update(update).eq('id',id).eq('user_id',userId).select('*').maybeSingle();if(error)throw error;if(!data)return fail(res,404,'Élément introuvable.','NOT_FOUND');return ok(res,mode==='alerts'?toApiAlert(data):data);}
    if(req.method==='DELETE'){const id=url.searchParams.get('id')||'';if(!validId(id))return fail(res,400,'Identifiant invalide.','INVALID_ID');const {data,error}=await supabaseAdmin.from(table).delete().eq('id',id).eq('user_id',userId).select('id');if(error)throw error;if(!data?.length)return fail(res,404,'Élément introuvable.','NOT_FOUND');return ok(res,{id});}
    return fail(res,405,'Méthode non autorisée.','METHOD_NOT_ALLOWED');
  }catch(error){return fail(res,500,'Erreur serveur.','USER_DATA_ERROR',error);}
}
