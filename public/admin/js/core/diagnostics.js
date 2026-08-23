/* ============================================================
   THE CAPITAL — DIAGNOSTIC DE DÉMARRAGE
   Capture les erreurs JS, les promesses rejetées, les temps de chargement
   et les étapes critiques. Aucun appel réseau : ce module ne peut donc
   jamais bloquer le démarrage de l'administration.
   ============================================================ */
'use strict';
(function (w) {
    const started = performance.now();
    const events = [];
    const MAX = 200;

    function safe(value) {
        try { return typeof value === 'string' ? value : JSON.stringify(value); }
        catch (e) { return String(value); }
    }

    function push(type, message, detail) {
        events.push({
            t: Math.round(performance.now() - started),
            type: type,
            message: String(message || '').slice(0, 1000),
            detail: detail ? safe(detail).slice(0, 2000) : ''
        });
        if (events.length > MAX) events.shift();
    }

    w.TC_DIAG = {
        started,
        events,
        push,
        mark(name, detail) { push('mark', name, detail); },
        snapshot() {
            return {
                generated_at: new Date().toISOString(),
                page: location.href,
                user_agent: navigator.userAgent,
                online: navigator.onLine,
                elapsed_ms: Math.round(performance.now() - started),
                events: events.slice(),
                resources: performance.getEntriesByType('resource').slice(-80).map(r => ({
                    name: r.name,
                    duration: Math.round(r.duration),
                    size: r.transferSize || 0
                }))
            };
        },
        download() {
            const blob = new Blob([JSON.stringify(this.snapshot(), null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'the-capital-admin-diagnostic-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        }
    };

    w.addEventListener('error', function (e) {
        push('javascript', e.message || 'Erreur JavaScript', {
            file: e.filename,
            line: e.lineno,
            column: e.colno,
            error: e.error && e.error.stack
        });
    });

    w.addEventListener('unhandledrejection', function (e) {
        push('promise', e.reason && e.reason.stack || e.reason || 'Promise rejetée');
    });

    w.addEventListener('offline', () => push('network', 'Navigateur passé hors ligne'));
    w.addEventListener('online', () => push('network', 'Connexion réseau rétablie'));

    /* Détecte les scripts qui restent très longtemps en téléchargement. */
    setTimeout(function () {
        performance.getEntriesByType('resource').forEach(function (r) {
            if (/\.js(?:\?|$)/i.test(r.name) && r.duration > 3000) {
                push('slow-resource', 'Script lent: ' + r.name, { duration_ms: Math.round(r.duration) });
            }
        });
    }, 3500);
})(window);
