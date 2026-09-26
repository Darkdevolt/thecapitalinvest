/* ============================================================
   THE CAPITAL — Options de l'application (réglées dans l'administration,
   « Options de l'app ») : bandeau d'annonce et mode maintenance.
   Source : /api/user-data?mode=public-config (cache 60 s).
   Les administrateurs ne sont jamais bloqués par la maintenance.
   ============================================================ */
(function () {
  'use strict';
  var COLORS = { info: '#D4AF6A', success: '#4ADE80', warning: '#FB923C', danger: '#F87171' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function isAdmin() { return !!(window.TC_ACCESS && window.TC_ACCESS.plan === 'admin'); }

  function banner(b) {
    if (!b || !b.text) return;
    var key = 'tc_banner_closed';
    try { if (sessionStorage.getItem(key) === b.text) return; } catch (e) { /* stockage indisponible */ }
    var col = COLORS[b.level] || COLORS.info;
    var bar = document.createElement('div');
    bar.id = 'tc-app-banner';
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:relative;z-index:900;display:flex;gap:12px;align-items:center;justify-content:center;padding:9px 44px 9px 16px;font:400 13px/1.45 "DM Sans",system-ui,sans-serif;color:' + col + ';background:#0f0c07;border-bottom:1px solid ' + col + '55;text-align:center';
    bar.innerHTML = '<span>' + esc(b.text) + (b.link ? ' <a href="' + esc(b.link) + '" style="color:inherit;text-decoration:underline;white-space:nowrap">En savoir plus →</a>' : '') + '</span>' +
      '<button type="button" aria-label="Fermer" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:0;color:inherit;font-size:18px;cursor:pointer;line-height:1">×</button>';
    bar.querySelector('button').addEventListener('click', function () {
      bar.remove();
      try { sessionStorage.setItem(key, b.text); } catch (e) { /* stockage indisponible */ }
    });
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function maintenance(cfg) {
    if (!cfg.maintenance || isAdmin() || document.getElementById('tc-maintenance')) return;
    var s = cfg.support || {};
    var wrap = document.createElement('div');
    wrap.id = 'tc-maintenance';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 20%,#1b150b 0,#0A0804 60%);color:#F5F0E8;font-family:"DM Sans",system-ui,sans-serif;text-align:center';
    wrap.innerHTML = '<div style="max-width:460px"><img src="/assets/the-capital-logo.png" alt="The Capital" style="width:200px;max-width:70%;margin-bottom:26px">' +
      '<div style="font:700 24px/1.25 \'Playfair Display\',Georgia,serif;margin-bottom:12px">Maintenance en cours</div>' +
      '<p style="color:rgba(245,240,232,.7);font-size:14px;line-height:1.6;margin:0 0 22px">' + esc(cfg.maintenance_message || 'Nous revenons très vite.') + '</p>' +
      (s.email || s.whatsapp ? '<p style="font-size:12.5px;color:rgba(245,240,232,.55)">Besoin d’aide : ' + (s.email ? '<a style="color:#D4AF6A" href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a>' : '') + (s.email && s.whatsapp ? ' · ' : '') + (s.whatsapp ? '<a style="color:#D4AF6A" href="https://wa.me/' + esc(String(s.whatsapp).replace(/[^\d]/g, '')) + '">WhatsApp</a>' : '') + '</p>' : '') +
      '<button type="button" onclick="location.reload()" style="margin-top:14px;padding:10px 20px;background:#B8964E;color:#0A0804;border:0;border-radius:5px;font-weight:600;cursor:pointer">Réessayer</button></div>';
    document.body.appendChild(wrap);
    document.documentElement.style.overflow = 'hidden';
  }

  function apply(cfg) {
    window.TC_APP_CONFIG = cfg;
    banner(cfg.banner);
    if (!cfg.maintenance) return;
    /* Attendre que le profil (rôle admin) soit connu, au plus 3 s. */
    var t0 = Date.now();
    (function wait() {
      if (window.TC_ACCESS || Date.now() - t0 > 3000) return maintenance(cfg);
      setTimeout(wait, 150);
    })();
  }

  function start() {
    fetch('/api/user-data?mode=public-config', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.data) apply(j.data); })
      .catch(function () { /* options indisponibles : l'application continue normalement */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
