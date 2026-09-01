/* The Capital — authenticated application gateway + trial access */
(function () {
  'use strict';
  var SESSION_KEY='tc_session';
  var SUPABASE_URL='https://otsiwiwlnowxeolbbgvm.supabase.co';
  var SUPABASE_KEY='sb_publishable_MhaI5b-kMmb5liIMOJ4P3Q_xGTsJAFJ';
  var paidPlans={investor:true,pro:true,elite:true,institute:true};
  function decodeJwt(token){try{var p=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');while(p.length%4)p+='=';return JSON.parse(atob(p));}catch(e){return null;}}
  function getSession(){try{var raw=localStorage.getItem(SESSION_KEY);if(!raw)return null;var s=JSON.parse(raw);return s&&s.access_token?s:null;}catch(e){return null;}}
  function rememberDestination(){try{var t=window.location.pathname+window.location.search+window.location.hash;if(t&&t.indexOf('/login.html')===-1)sessionStorage.setItem('tc_auth_destination',t);}catch(e){}}
  function goLogin(){rememberDestination();window.location.replace('/login.html');}
  function exposeAccess(profile){profile=profile||{};var now=Date.now(),trialEnd=profile.trial_ends_at?new Date(profile.trial_ends_at).getTime():0,plan=String(profile.plan||'free').toLowerCase(),expiry=profile.plan_expire_at?new Date(profile.plan_expire_at).getTime():0,paid=!!(paidPlans[plan]&&expiry>now);window.TC_ACCESS={plan:plan,trialActive:trialEnd>now,trialEndsAt:profile.trial_ends_at||null,paidActive:paid,premium:trialEnd>now||paid,premiumRestricted:!(trialEnd>now||paid)};document.documentElement.setAttribute('data-tc-access',window.TC_ACCESS.premium?'premium':'free');document.documentElement.setAttribute('data-tc-trial',trialEnd>now?'active':'expired');}
  var session=getSession();
  if(!session)return goLogin();
  var payload=decodeJwt(session.access_token);
  if(!payload||!payload.exp||payload.exp*1000<=Date.now()){try{localStorage.removeItem(SESSION_KEY);}catch(e){}return goLogin();}
  /* Authenticated session is sufficient to enter the application. Profile/paywall checks are non-blocking. */
  exposeAccess({plan:'free'});
  var userId=session.user&&session.user.id;
  if(!userId)return;
  fetch(SUPABASE_URL+'/rest/v1/users?select=plan,plan_expire_at,trial_started_at,trial_ends_at,is_admin&id=eq.'+encodeURIComponent(userId),{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+session.access_token,Accept:'application/json'},cache:'no-store'})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(rows){var p=rows&&rows[0];if(!p)return; if(p.is_admin){window.TC_ACCESS={plan:'admin',premium:true,trialActive:false,paidActive:true,premiumRestricted:false};return;} exposeAccess(p);})
    .catch(function(){console.warn('[TC ACCESS] Profil indisponible; session conservée.');});
})();
