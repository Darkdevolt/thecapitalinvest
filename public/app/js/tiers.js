/* ============================================================================
   THE CAPITAL — Droits d'accès (front)
   ----------------------------------------------------------------------------
   Résout la formule de l'utilisateur via /api/marche?type=entitlements et
   expose window.TC.can(fonctionnalité). Ne bloque jamais tant que le serveur
   n'a pas répondu « mode: on » : une panne de cet appel ne doit pas priver
   un abonné de ce qu'il paie.
     - mode "off"      → TC.can() renvoie toujours true (comportement historique)
     - mode "observe"  → idem, mais data-tc-mode="observe" permet à l'UI
                          d'afficher les repères sans rien verrouiller
     - mode "on"       → TC.can(f) suit la carte des droits du serveur
   Émet l'évènement `tc:entitlements` quand la réponse arrive.
   ========================================================================== */
(function (w, d) {
  'use strict';
  if (w.__TC_TIERS__) return;
  w.__TC_TIERS__ = true;

  var TC = (w.TC = w.TC || {});

  var state = {
    mode: 'off',
    plan: 'free',
    effective: 'free',
    isAdmin: false,
    trialActive: false,
    features: {},
    resolved: false
  };
  w.TC_ENTITLEMENTS = state;

  TC.can = function (feature) {
    // Rien n'est verrouillé hors du mode "on", ni tant que le serveur n'a pas
    // répondu, ni pour une fonctionnalité inconnue de la carte.
    if (state.mode !== 'on') return true;
    if (!feature) return true;
    return state.features[feature] !== false;
  };
  TC.plan = function () { return state.effective; };
  TC.tiersMode = function () { return state.mode; };
  TC.tiersReady = function () { return state.resolved; };

  function applyAttrs() {
    try {
      var r = d.documentElement;
      r.dataset.tcPlan = state.effective;
      r.dataset.tcMode = state.mode;
      r.dataset.tcTrial = state.trialActive ? 'active' : 'off';
    } catch (e) {}
  }
  applyAttrs();

  function finish(payload) {
    if (payload && typeof payload === 'object') {
      state.mode = payload.mode === 'on' || payload.mode === 'observe' ? payload.mode : 'off';
      state.plan = payload.plan || 'free';
      state.effective = payload.effective || state.plan || 'free';
      state.isAdmin = !!payload.isAdmin;
      state.trialActive = !!payload.trialActive;
      state.features = payload.features && typeof payload.features === 'object' ? payload.features : {};
    }
    state.resolved = true;
    applyAttrs();
    try { w.dispatchEvent(new CustomEvent('tc:entitlements', { detail: state })); } catch (e) {}
  }

  w.__tcEntitlementsReady = new Promise(function (resolve) {
    function go() {
      var p;
      try {
        p = typeof w.apiGet === 'function'
          ? w.apiGet('/marche?type=entitlements&_=' + Date.now(), { cache: 'no-store' })
          : null;
      } catch (e) { p = null; }
      if (!p || typeof p.then !== 'function') { finish(null); resolve(state); return; }
      p.then(function (r) {
        var data = r && r.data && typeof r.data === 'object' ? r.data : r;
        finish(data);
      }).catch(function () {
        // Échec réseau : on reste en "off" — jamais de verrouillage sur erreur.
        finish(null);
      }).then(function () { resolve(state); });
    }
    if (typeof w.apiGet === 'function') go();
    else w.addEventListener('load', go, { once: true });
  });
})(window, document);
