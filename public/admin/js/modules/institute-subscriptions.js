/* THE CAPITAL — Administration des abonnements The Capital Institute.
   Couche complémentaire : le plan principal `users.plan` reste inchangé.
   L'accès Institute est piloté par la table `subscriptions`. */
(function (TC) {
    'use strict';

    /* Réutilisation d'une fonction admin existante : Vercel Hobby limite le
       nombre de fonctions serverless par déploiement. */
    const API = '/api/financials-upload';
    const originalOpen = TC.modal && TC.modal.open;
    if (!originalOpen) return;

    function authHeaders() {
        return {
            Authorization: 'Bearer ' + (TC.session?.token || ''),
            'Content-Type': 'application/json',
            Accept: 'application/json'
        };
    }

    async function request(userId, payload) {
        const response = await fetch(API, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(Object.assign({ user_id: userId }, payload || {}))
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || data?.error || 'Gestion de l’abonnement Institute impossible.');
        return data;
    }

    function expiryFromDays(days) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString().slice(0, 10);
    }

    TC.modal.open = function (options) {
        if (!options || !options.body || options.body.indexOf('mu-plan') === -1) {
            return originalOpen.call(TC.modal, options);
        }

        const originalAfterOpen = options.afterOpen;
        const originalOnSave = options.onSave;
        const email = String(options.title || '').trim();

        options.body = options.body.replace(
            '</div><div class="card-body tight">',
            '<div class="field wide" style="grid-column:1/-1;border-top:1px solid var(--border);margin-top:6px;padding-top:16px">' +
            '<label for="mu-institute">The Capital Institute</label>' +
            '<select id="mu-institute"><option value="inactive">Aucun accès</option><option value="active">Accès Institute actif</option></select>' +
            '<div class="hint">Abonnement séparé de la formule The Capital Invest. Il ne modifie pas Pro, Elite ou Découverte.</div>' +
            '</div>' +
            '<div class="field" id="mu-institute-expiry-field"><label for="mu-institute-expiry">Échéance Institute</label><input type="date" id="mu-institute-expiry"><div class="hint">La date contrôle directement l’accès aux parcours Institute.</div></div>' +
            '</div><div class="card-body tight">'
        );

        options.afterOpen = function () {
            if (typeof originalAfterOpen === 'function') originalAfterOpen();

            const select = TC.el('mu-institute');
            const expiry = TC.el('mu-institute-expiry');
            const note = TC.el('mu-note');
            if (!select || !expiry) return;

            select.value = 'inactive';
            expiry.value = expiryFromDays(30);
            expiry.disabled = true;

            const refreshNote = function (text, type) {
                if (!note) return;
                if (text) {
                    note.innerHTML = TC.esc(text);
                    note.className = 'note ' + (type || '');
                }
            };

            select.addEventListener('change', function () {
                const active = select.value === 'active';
                expiry.disabled = !active;
                refreshNote(active ? 'Accès Institute : choisissez une échéance puis enregistrez.' : 'L’accès Institute sera retiré à l’enregistrement.');
            });

            findUserIdByEmail(email).then(function (userId) {
                if (!userId) throw new Error('Utilisateur introuvable.');
                return request(userId, { action: 'institute_status' });
            }).then(function (result) {
                const list = Array.isArray(result) ? result : (result.data || []);
                const active = list.find(function (s) {
                    return s.plan_code === 'institute' && s.status === 'active' && (!s.current_period_end || new Date(s.current_period_end) > new Date());
                });
                if (active) {
                    select.value = 'active';
                    expiry.value = TC.toISODate(active.current_period_end) || expiryFromDays(30);
                    expiry.disabled = false;
                    refreshNote('Institute actuellement actif jusqu’au ' + TC.fmtDate(active.current_period_end) + '.');
                } else {
                    expiry.disabled = true;
                    refreshNote('Aucun abonnement Institute actif pour ce compte.');
                }
            }).catch(function (error) {
                refreshNote('Impossible de lire l’état actuel de l’Institute : ' + error.message, 'warn');
            });
        };

        options.onSave = async function () {
            const select = TC.el('mu-institute');
            const expiry = TC.el('mu-institute-expiry');
            if (!select || !expiry) return originalOnSave();

            try {
                const userId = await findUserIdByEmail(email);
                if (!userId) throw new Error('Utilisateur introuvable pour la gestion de l’Institute.');

                if (select.value === 'active') {
                    if (!expiry.value) throw new Error('Choisissez une date d’échéance pour l’Institute.');
                    const end = new Date(expiry.value + 'T23:59:59');
                    if (Number.isNaN(end.getTime()) || end <= new Date()) throw new Error('La date d’échéance Institute doit être future.');
                    await request(userId, { action: 'institute_assign', expires_at: end.toISOString() });
                } else {
                    await request(userId, { action: 'institute_revoke' });
                }
                await originalOnSave();
            } catch (error) {
                TC.modal.msg(error.message, 'err');
            }
        };

        return originalOpen.call(TC.modal, options);
    };

    async function findUserIdByEmail(email) {
        if (!email) return '';
        const rows = await TC.get('users', 'select=id&email=eq.' + encodeURIComponent(email) + '&limit=1');
        return Array.isArray(rows) && rows[0] ? String(rows[0].id) : '';
    }
})(window.TC);
