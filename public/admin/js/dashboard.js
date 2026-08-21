/*
 * Admin Dashboard — unified implementations only.
 *
 * Cours & Historique owns one session manager:
 *   - cours-historique.js / cours-control.js for market data
 *   - seances-globales.js for the session calendar + validation state
 *   - admin-cours-historique-unified.js for explicit navigation
 *   - seances-integrity-hardening.js for market-calendar integrity rules
 *
 * The former calendar/details/override overlays are intentionally not loaded here.
 */
(function () {
    'use strict';

    function load(src, id) {
        if (document.querySelector('script[data-tc-module="' + id + '"]')) return;
        var script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.setAttribute('data-tc-module', id);
        document.head.appendChild(script);
    }

    load('admin/js/dashboard-overview.js?v=20260814-unified', 'dashboard-overview');
    load('admin/js/cours-historique.js?v=20260814-unified', 'cours-historique');
    load('admin/js/admin-cours-historique-unified.js?v=20260821-unified', 'admin-cours-historique-unified');
    load('admin/js/seances-integrity-hardening.js?v=20260821-integrity', 'seances-integrity-hardening');
})();
