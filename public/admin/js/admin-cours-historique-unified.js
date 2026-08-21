/* THE CAPITAL — Navigation unifiée Cours & Historique
 * Point d'entrée unique pour les actions d'une séance vers Cours ou Archive.
 * Aucune navigation par position DOM et aucun intercepteur de clic global.
 */
(function () {
    'use strict';

    function exactTabButton(name) {
        var nav = document.querySelector('.admin-nav');
        if (!nav) return null;
        return Array.from(nav.querySelectorAll('.admin-tab')).find(function (btn) {
            var onclick = btn.getAttribute('onclick') || '';
            return new RegExp("switchTab\\(['\\\"]" + name + "['\\\"]").test(onclick) ||
                btn.getAttribute('data-admin-tab') === name;
        }) || null;
    }

    function openTab(name) {
        var panel = document.getElementById('panel-' + name);
        if (!panel || typeof window.switchTab !== 'function') return false;
        window.switchTab(name, exactTabButton(name));
        return true;
    }

    function openCoursForDate(date) {
        var f = document.getElementById('cours-date-filter');
        if (f) {
            f.value = date || '';
            f.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (!openTab('cours')) return false;
        window.setTimeout(function () {
            if (typeof window.loadCours === 'function') window.loadCours();
        }, 50);
        return true;
    }

    function openArchiveForDate(date) {
        var from = document.getElementById('hist-date-from');
        var to = document.getElementById('hist-date-to');
        if (from) from.value = date || '';
        if (to) to.value = date || '';
        if (!openTab('archive')) return false;
        window.setTimeout(function () {
            var sub = document.querySelector('#panel-archive .sub-tab:nth-child(3)');
            if (sub && typeof window.switchSubTab === 'function') {
                window.switchSubTab('hist', 'view', sub);
            }
            if (typeof window.loadHistoriqueTicker === 'function') window.loadHistoriqueTicker();
        }, 50);
        return true;
    }

    window.TCAdminNavigation = {
        openCoursForDate: openCoursForDate,
        openArchiveForDate: openArchiveForDate,
        openTab: openTab
    };
})();
