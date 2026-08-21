/* THE CAPITAL — Navigation unifiée Cours & Historique
 * Correction P0/P1 : aucune navigation par position DOM.
 * Ce module est volontairement non destructif : il conserve les modules
 * métier existants mais impose un point d'entrée unique pour les actions
 * d'une séance vers Cours ou Archive.
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
        var button = exactTabButton(name);
        window.switchTab(name, button);
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

    /*
     * seances-details.js historically attached handlers directly to the
     * modal buttons and selected tabs with tabs[1]/tabs[2]. We intercept
     * those actions in capture phase and route them to explicit tab names.
     */
    document.addEventListener('click', function (event) {
        var coursButton = event.target.closest && event.target.closest('[data-manage-cours]');
        if (coursButton) {
            var modal = coursButton.closest('#tc-session-details-modal');
            var dateNode = modal && modal.querySelector('.card-header [style*="font:11px"]');
            var date = dateNode ? dateNode.textContent.trim() : '';
            if (date && openCoursForDate(date)) {
                event.preventDefault();
                event.stopImmediatePropagation();
                var existing = document.getElementById('tc-session-details-modal');
                if (existing) existing.remove();
                return;
            }
        }

        var histButton = event.target.closest && event.target.closest('[data-manage-hist]');
        if (histButton) {
            var hmodal = histButton.closest('#tc-session-details-modal');
            var hdateNode = hmodal && hmodal.querySelector('.card-header [style*="font:11px"]');
            var hdate = hdateNode ? hdateNode.textContent.trim() : '';
            if (hdate && openArchiveForDate(hdate)) {
                event.preventDefault();
                event.stopImmediatePropagation();
                var hm = document.getElementById('tc-session-details-modal');
                if (hm) hm.remove();
            }
        }
    }, true);

    window.TCAdminNavigation = {
        openCoursForDate: openCoursForDate,
        openArchiveForDate: openArchiveForDate,
        openTab: openTab
    };
})();
