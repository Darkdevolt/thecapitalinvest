/*
 * Admin Dashboard — single active implementation.
 *
 * The historical dashboard implementation was retired from the runtime.
 * The complete dashboard lives in dashboard-overview.js so there is only
 * one active Dashboard implementation and no competing loadDashboard().
 */
(function () {
    'use strict';
    var src = 'admin/js/dashboard-overview.js?v=20260814-clean';
    if (document.querySelector('script[data-tc-dashboard-overview]')) return;
    var script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute('data-tc-dashboard-overview', 'true');
    document.head.appendChild(script);
})();
