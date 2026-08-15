(function () {
    'use strict';

    function getEl(id) { return document.getElementById(id); }

    function notify(message) {
        if (typeof toast === 'function') toast(message);
        else console.log('[HIST-SESSION]', message);
    }

    function confirmDelete(message) {
        return typeof doubleConfirm === 'function' ? doubleConfirm(message) : window.confirm(message);
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    async function loadSessionDates() {
        try {
            var rows = await sbGet('historique', 'select=date_seance&order=date_seance.desc&limit=5000');
            var dates = Array.from(new Set((rows || []).map(function (r) { return r.date_seance; }).filter(Boolean)));
            var select = getEl('hist-session-date-select');
            if (!select) return;
            select.innerHTML = '<option value="">Choisir une séance…</option>' + dates.map(function (date) {
                return '<option value="' + escapeHtml(date) + '">' + escapeHtml(date) + '</option>';
            }).join('');
        } catch (e) {
            console.error('[HIST-SESSION] loadSessionDates:', e);
        }
    }

    async function deleteSession() {
        var select = getEl('hist-session-date-select');
        var date = select && select.value;
        if (!date) {
            notify('Sélectionnez une séance à supprimer');
            return;
        }

        try {
            var rows = await sbGet('historique', 'select=id,ticker&date_seance=eq.' + encodeURIComponent(date));
            var count = Array.isArray(rows) ? rows.length : 0;
            if (!count) {
                notify('Aucune donnée pour la séance du ' + date);
                await loadSessionDates();
                return;
            }

            var message = 'SUPPRESSION DÉFINITIVE\n\nSéance : ' + date + '\n' + count + ' ligne(s) historique(s) seront supprimée(s), pour toutes les actions.\n\nCette opération est irréversible. Continuer ?';
            if (!confirmDelete(message)) return;

            var ok = await sbDel('historique', 'date_seance=eq.' + encodeURIComponent(date));
            if (!ok) throw new Error('La suppression Supabase a échoué');

            notify('Séance du ' + date + ' supprimée (' + count + ' ligne(s))');
            if (typeof loadHistoriqueTicker === 'function') loadHistoriqueTicker();
            await loadSessionDates();
        } catch (e) {
            console.error('[HIST-SESSION] deleteSession:', e);
            notify('Erreur lors de la suppression de la séance');
        }
    }

    function inject() {
        if (getEl('hist-session-delete-control')) return true;
        var tbody = getEl('hist-tbody');
        if (!tbody) return false;

        var card = tbody.closest('.card');
        if (!card) return false;

        var box = document.createElement('div');
        box.id = 'hist-session-delete-control';
        box.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 12px;padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:var(--surface,#111);';
        box.innerHTML = '<span style="font-size:12px;color:var(--muted);font-weight:500;">Séances de Bourse</span>' +
            '<select id="hist-session-date-select" aria-label="Séance à supprimer" style="height:32px;min-width:180px;max-width:100%;">' +
            '<option value="">Choisir une séance…</option></select>' +
            '<button type="button" class="btn btn-danger btn-sm" id="hist-session-delete-btn">🗑 Supprimer la séance</button>' +
            '<span style="font-size:11px;color:var(--muted);">Supprime toutes les lignes de la date sélectionnée.</span>';

        var tw = card.querySelector('.tw');
        if (tw) card.insertBefore(box, tw);
        else card.insertBefore(box, tbody.parentNode);

        getEl('hist-session-delete-btn').addEventListener('click', deleteSession);
        loadSessionDates();
        return true;
    }

    function boot() {
        var tries = 0;
        var timer = setInterval(function () {
            tries += 1;
            if (inject() || tries >= 80) clearInterval(timer);
        }, 250);
    }

    window.deleteHistoriqueSeance = deleteSession;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
