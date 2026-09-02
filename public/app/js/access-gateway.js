/* The Capital — authenticated application gateway + trial access */
(function () {
  'use strict';

  var SESSION_KEY = 'tc_session';
  var SUPABASE_URL = 'https://otsiwiwlnowxeolbbgvm.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_MhaI5b-kMmb5liIMOJ4P3Q_xGTsJAFJ';
  var paidPlans = { investor: true, pro: true, elite: true, institute: true };

  function decodeJwt(token) {
    try {
      var part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (part.length % 4) part += '=';
      return JSON.parse(atob(part));
    } catch (e) { return null; }
  }

  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      return s && s.access_token ? s : null;
    } catch (e) { return null; }
  }

  function rememberDestination() {
    try {
      var target = window.location.pathname + window.location.search + window.location.hash;
      if (target && target.indexOf('/login.html') === -1) {
        sessionStorage.setItem('tc_auth_destination', target);
      }
    } catch (e) {}
  }

  function goLogin() {
    rememberDestination();
    window.location.replace('/login.html');
  }

  function goPayment(plan) {
    window.location.replace('/payment.html?plan=' + encodeURIComponent(plan || 'pro') + '&period=monthly');
  }

  function exposeAccess(profile) {
    var now = Date.now();
    var trialEnd = profile && profile.trial_ends_at ? new Date(profile.trial_ends_at).getTime() : 0;
    var trialActive = trialEnd > now;
    var plan = String((profile && profile.plan) || 'free').toLowerCase();
    var expiry = profile && profile.plan_expire_at ? new Date(profile.plan_expire_at).getTime() : 0;
    var paidActive = !!(paidPlans[plan] && expiry > now);

    window.TC_ACCESS = {
      plan: plan,
      trialActive: trialActive,
      trialEndsAt: (profile && profile.trial_ends_at) || null,
      paidActive: paidActive,
      premium: trialActive || paidActive,
      premiumRestricted: !trialActive && !paidActive
    };

    document.documentElement.setAttribute('data-tc-access', window.TC_ACCESS.premium ? 'premium' : 'free');
    document.documentElement.setAttribute('data-tc-trial', trialActive ? 'active' : 'expired');
  }

  var session = getSession();
  if (!session) return goLogin();

  var payload = decodeJwt(session.access_token);
  if (!payload || !payload.exp || payload.exp * 1000 <= Date.now()) {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    return goLogin();
  }

  var userId = session.user && session.user.id;
  if (!userId) {
    /* Session Supabase valide mais ancienne/incomplète : laisse app.html fonctionner. */
    exposeAccess({ plan: 'free' });
    return;
  }

  fetch(SUPABASE_URL + '/rest/v1/users?select=plan,plan_expire_at,trial_started_at,trial_ends_at,is_admin&id=eq.' + encodeURIComponent(userId), {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + session.access_token,
      Accept: 'application/json'
    },
    cache: 'no-store'
  })
    .then(function (r) {
      if (!r.ok) throw new Error('profile');
      return r.json();
    })
    .then(function (rows) {
      var profile = rows && rows[0];

      /* Ne jamais renvoyer un utilisateur authentifié vers login simplement parce
         que la table users n'est pas lisible ou que le profil est absent. */
      if (!profile) {
        exposeAccess({ plan: 'free' });
        return;
      }

      if (profile.is_admin) {
        window.TC_ACCESS = {
          plan: 'admin', premium: true, trialActive: false,
          paidActive: true, premiumRestricted: false
        };
        return;
      }

      exposeAccess(profile);

      var plan = String(profile.plan || 'free').toLowerCase();
      var now = Date.now();
      var trialEnd = profile.trial_ends_at ? new Date(profile.trial_ends_at).getTime() : 0;
      var planExpiry = profile.plan_expire_at ? new Date(profile.plan_expire_at).getTime() : 0;

      /* L'utilisateur authentifié reste dans l'application. Le paywall est géré
         par l'UI via TC_ACCESS, pas par une redirection d'authentification. */
      if (trialEnd > now) return;
      if (paidPlans[plan] && planExpiry > now) return;
    })
    .catch(function () {
      /* Une panne réseau / RLS sur users ne doit pas casser le login.
         La session Supabase reste l'autorité d'authentification. */
      console.warn('[TC ACCESS] Profil utilisateur indisponible; session conservée.');
      exposeAccess({ plan: 'free' });
    });
})();
