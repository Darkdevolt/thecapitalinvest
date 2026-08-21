/*
 * Admin Dashboard — single active implementation.
 * Loads the unified Dashboard and the unified Cours & Historique control center.
 * Session management is provided by seances-globales.js to avoid duplicate
 * controls and exhaustive history loading at Admin startup.
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
    load('admin/js/seances-calendrier.js?v=20260818-calendar', 'seances-calendrier');
    load('admin/js/seances-validation-override.js?v=20260818-gap-validation', 'seances-validation-override');
    load('admin/js/session-intelligence.js?v=20260821-smart-session', 'session-intelligence');
})();
