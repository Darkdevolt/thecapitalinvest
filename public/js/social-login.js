/* Boutons « Continuer avec Google / Apple ».
   Ne s'affichent que pour les fournisseurs activés dans Supabase
   (Authentication → Sign In / Providers) : rien à changer ici pour les ouvrir.
   Usage : <div data-social-login></div> puis ce script (après env.js). */
(function () {
  'use strict';
  var E = window.TC_ENV;
  var box = document.querySelector('[data-social-login]');
  if (!E || !box) return;
  var ICONS = {
    google: '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41 35.4 44 30.2 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
    apple: '<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.8-2-1.6-.2-3.1.9-3.9.9-.8 0-2.1-.9-3.4-.9-1.8 0-3.4 1-4.3 2.6-1.8 3.2-.5 7.9 1.3 10.5.9 1.3 1.9 2.7 3.2 2.6 1.3 0 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.5-1-2.5-4.2zM13.9 4.9c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3-1.5z"/></svg>'
  };
  var LABEL = { google: 'Continuer avec Google', apple: 'Continuer avec Apple' };
  var css = '.soc{margin:18px 0 4px}.soc-or{display:flex;align-items:center;gap:10px;color:rgba(245,240,232,.45);font-size:10px;letter-spacing:.12em;text-transform:uppercase;margin:0 0 14px}.soc-or:before,.soc-or:after{content:"";flex:1;height:1px;background:rgba(184,150,78,.22)}' +
    '.soc-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:11px;margin-bottom:9px;border-radius:5px;font:500 13.5px "DM Sans",Arial,sans-serif;cursor:pointer;border:1px solid rgba(184,150,78,.3);background:#fff;color:#1f1f1f}' +
    '.soc-btn.apple{background:#000;color:#fff;border-color:#333}.soc-btn:disabled{opacity:.6;cursor:wait}.soc-note{font-size:10.5px;color:rgba(245,240,232,.45);line-height:1.5;text-align:center;margin-top:4px}.soc-note a{color:#D4AF6A}';

  function start(provider, btn) {
    btn.disabled = true;
    var back = location.origin + '/auth-callback.html';
    location.href = E.SUPABASE_URL + '/auth/v1/authorize?provider=' + provider + '&redirect_to=' + encodeURIComponent(back);
  }

  fetch(E.SUPABASE_URL + '/auth/v1/settings', { headers: { apikey: E.SUPABASE_ANON_KEY } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (s) {
      var ext = (s && s.external) || {};
      var list = ['google', 'apple'].filter(function (p) { return ext[p]; });
      if (!list.length) return;
      var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      box.className = 'soc';
      box.innerHTML = '<div class="soc-or">ou</div>' + list.map(function (p) {
        return '<button type="button" class="soc-btn ' + p + '" data-p="' + p + '">' + ICONS[p] + LABEL[p] + '</button>';
      }).join('') + '<div class="soc-note">Aucun formulaire : votre compte est créé automatiquement à la première connexion. En continuant, vous acceptez les <a href="/cgu.html">CGU</a> et la <a href="/confidentialite.html">politique de confidentialité</a>.</div>';
      box.addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (b) start(b.getAttribute('data-p'), b); });
    })
    .catch(function () {});
})();
