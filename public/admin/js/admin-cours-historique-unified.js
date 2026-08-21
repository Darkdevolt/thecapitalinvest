/* THE CAPITAL — Navigation unifiée Cours & Historique
 * Point d'entrée unique pour les actions d'une séance vers Cours ou Historique.
 * Les boutons legacy du calendrier sont également routés ici afin qu'aucune
 * implémentation concurrente ne puisse reprendre la navigation.
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

    function openHistoriqueForDate(date) {
        var from = document.getElementById('hist-date-from');
        var to = document.getElementById('hist-date-to');
        if (from) from.value = date || '';
        if (to) to.value = date || '';
        if (!openTab('historique')) return false;
        window.setTimeout(function () {
            var panel = document.getElementById('panel-historique');
            var sub = panel && panel.querySelector('.sub-tab:nth-child(3)');
            if (sub && typeof window.switchSubTab === 'function') {
                window.switchSubTab('hist', 'view', sub);
            }
            if (typeof window.loadHistoriqueTicker === 'function') window.loadHistoriqueTicker();
        }, 50);
        return true;
    }

    function modalDate(button) {
        var modal = button && button.closest && button.closest('.tc-session-modal, #tc-session-details-modal');
        if (!modal) return '';
        var node = modal.querySelector('.tc-session-modal-head [style*="font:11px"], .card-header [style*="font:11px"]');
        return node ? node.textContent.trim() : '';
    }

    /*
     * The central calendar still contains legacy data-day/data-manage/data-hist
     * handlers in its internal implementation. Capture those actions here so
     * they all use the same explicit routing API and never tabs[1]/tabs[2].
     */
    document.addEventListener('click', function (event) {
        var day = event.target.closest && event.target.closest('[data-day]');
        if (day) {
            var date = day.getAttribute('data-day');
            if (date && typeof window.tcOpenSessionDetails === 'function') {
                event.preventDefault();
                event.stopImmediatePropagation();
                window.tcOpenSessionDetails(date);
                return;
            }
        }

        var coursButton = event.target.closest && event.target.closest('[data-manage-cours], [data-manage]');
        if (coursButton) {
            var dateCours = modalDate(coursButton);
            if (dateCours && openCoursForDate(dateCours)) {
                event.preventDefault();
                event.stopImmediatePropagation();
                var modalCours = coursButton.closest('.tc-session-modal, #tc-session-details-modal');
                if (modalCours) modalCours.remove();
                return;
            }
        }

        var histButton = event.target.closest && event.target.closest('[data-manage-hist], [data-hist]');
        if (histButton) {
            var dateHist = modalDate(histButton);
            if (dateHist && openHistoriqueForDate(dateHist)) {
                event.preventDefault();
                event.stopImmediatePropagation();
                var modalHist = histButton.closest('.tc-session-modal, #tc-session-details-modal');
                if (modalHist) modalHist.remove();
            }
        }
    }, true);

    window.TCAdminNavigation = {
        openCoursForDate: openCoursForDate,
        openArchiveForDate: openHistoriqueForDate,
        openHistoriqueForDate: openHistoriqueForDate,
        openTab: openTab
    };
})();
