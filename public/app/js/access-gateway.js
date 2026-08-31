/* The Capital — authenticated application gateway */
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

  function goLogin() {
    var target = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace('/login.html?redirect=' + target);
  }

  function goPayment(plan) {
    window.location.replace('/payment.html?plan=' + encodeURIComponent(plan || 'pro') + '&period=monthly');
  }

  var session = getSession();
  if (!session) return goLogin();

  var payload = decodeJwt(session.access_token);
  if (!payload || !payload.exp || payload.exp * 1000 <= Date.now()) {
    localStorage.removeItem(SESSION_KEY);
    return goLogin();
  }

  var userId = session.user && session.user.id;
  if (!userId) return goLogin();

  fetch(SUPABASE_URL + '/rest/v1/users?select=plan,plan_expire_at,is_admin&id=eq.' + encodeURIComponent(userId), {
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
      if (!profile) return goLogin();
      if (profile.is_admin) return;

      var plan = String(profile.plan || 'free').toLowerCase();
      if (!paidPlans[plan] || plan === 'free') return;

      var expiry = profile.plan_expire_at ? new Date(profile.plan_expire_at).getTime() : 0;
      if (expiry > Date.now()) return;

      return fetch(SUPABASE_URL + '/rest/v1/subscriptions?select=plan_code,status,current_period_end&user_id=eq.' + encodeURIComponent(userId) + '&status=eq.active&order=current_period_end.desc&limit=1', {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: 'Bearer ' + session.access_token,
          Accept: 'application/json'
        },
        cache: 'no-store'
      }).then(function (r) {
        if (!r.ok) throw new Error('subscription');
        return r.json();
      }).then(function (subs) {
        var active = subs && subs[0];
        if (active && active.current_period_end && new Date(active.current_period_end).getTime() > Date.now()) return;
        goPayment(plan);
      });
    })
    .catch(function () {
      window.location.replace('/login.html?error=access_check');
    });
})();
