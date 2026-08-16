/*
 * Admin Dashboard — single active implementation.
 * Loads the unified Dashboard and the unified Cours & Historique control center.
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
    load('admin/js/session-manager.js?v=20260816-session-coherence', 'session-manager');
})();
