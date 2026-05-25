/* ══════════════════════════════════════════════════════
   COURS — Aligné sur le schéma Supabase réel
   Mapping : cours→cours_cloture | ouverture→cours_ouverture
   capitalisation→valeur_totale | suppression 52 semaines

   DÉPENDANCES REQUISES (doivent être chargées AVANT ce fichier):
   - supabase-js (client Supabase initialisé)
   - utils.js avec : v, pf, pi, set, sbGet, sbPost, sbPatch, sbDel
   - ui.js avec : fmt, fmtPct, clrPct, doubleConfirm, toast, openModal, closeModal
   - styles CSS pour : .card, .tw, .bulk-bar, .btn, etc.
══════════════════════════════════════════════════════ */

(function() {
    'use strict';

    // ══════════════════════════════════════════════════════
    // VARIABLES D'ÉTAT (encapsulées dans la closure)
    // ══════════════════════════════════════════════════════
    let coursData = [];
    let selectedIds = new Set();

    // ══════════════════════════════════════════════════════
    // FONCTIONS UTILITAIRES LOCALES (sécurisées)
    // ══════════════════════════════════════════════════════

    /**
     * Échappe les caractères HTML pour éviter XSS
     */
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Vérifie si un nombre est valide (accepte 0, rejette null/undefined/NaN)
     */
    function isValidNumber(val) {
        return val !== null && val !== undefined && !isNaN(val) && typeof val === 'number';
    }

    /**
     * Vérifie si une chaîne est non-vide après trim
     */
    function isNonEmptyString(str) {
        return typeof str === 'string' && str.trim().length > 0;
    }

    // ══════════════════════════════════════════════════════
    // CHARGEMENT ET AFFICHAGE
    // ══════════════════════════════════════════════════════

    async function loadCours() {
        try {
            const rows = await sbGet('cours', 'select=*&order=date_seance.desc&limit=100');
            coursData = rows || [];
            renderCoursTable(coursData);
        } catch (err) {
            console.error('[loadCours] Erreur:', err);
            const tb = document.getElementById('cours-tbody');
            if (tb) {
                tb.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--danger);padding:20px;">Erreur de chargement : ' + escapeHtml(err.message) + '</td></tr>';
            }
        }
    }

    function renderCoursTable(data) {
        data = data || [];
        const tb = document.getElementById('cours-tbody');
        const count = document.getElementById('cours-count');

        if (!tb) {
            console.error('[renderCoursTable] Élément #cours-tbody introuvable');
            return;
        }

        if (!data.length) {
            tb.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--muted);padding:20px;">Aucun cours</td></tr>';
            if (count) count.textContent = '0 ligne';
            return;
        }

        resetSelection();

        tb.innerHTML = data.map(function(r) {
            const isSelected = selectedIds.has(r.id);
            // Utilisation d'attributs data-* séparés au lieu de JSON encodé (XSS-safe)
            return '<tr>' +
                '<td><input type="checkbox" class="row-check" data-id="' + escapeHtml(r.id) + '" ' + (isSelected ? 'checked' : '') + ' onchange="window.CoursApp.toggleRow('' + escapeHtml(r.id) + '',this)"></td>' +
                '<td class="td-gold">' + escapeHtml(r.ticker) + '</td>' +
                '<td class="td-muted">' + escapeHtml(r.date_seance) + '</td>' +
                '<td class="r td-mono">' + fmt(r.cours_cloture) + '</td>' +
                '<td class="r td-muted">' + fmt(r.cours_ouverture) + '</td>' +
                '<td class="r td-muted">' + fmt(r.plus_haut) + '</td>' +
                '<td class="r td-muted">' + fmt(r.plus_bas) + '</td>' +
                '<td class="r td-muted">' + fmt(r.volume) + '</td>' +
                '<td class="r" style="color:' + clrPct(r.variation) + ';font-family:var(--mono);">' + fmtPct(r.variation) + '</td>' +
                '<td class="r td-muted">' + fmt(r.valeur_totale) + '</td>' +
                '<td>' +
                  '<button class="btn btn-outline btn-sm" ' +
                    'data-ticker="' + escapeHtml(r.ticker) + '" ' +
                    'data-date="' + escapeHtml(r.date_seance) + '" ' +
                    'data-cours="' + escapeHtml(r.cours_cloture) + '" ' +
                    'data-ouv="' + escapeHtml(r.cours_ouverture) + '" ' +
                    'data-haut="' + escapeHtml(r.plus_haut) + '" ' +
                    'data-bas="' + escapeHtml(r.plus_bas) + '" ' +
                    'data-vol="' + escapeHtml(r.volume) + '" ' +
                    'data-var="' + escapeHtml(r.variation) + '" ' +
                    'data-capi="' + escapeHtml(r.valeur_totale) + '" ' +
                    'data-id="' + escapeHtml(r.id) + '" ' +
                    'onclick="window.CoursApp.handleEditCours(this)">✎</button> ' +
                  '<button class="btn btn-danger btn-sm" ' +
                    'data-ticker="' + escapeHtml(r.ticker) + '" ' +
                    'data-date="' + escapeHtml(r.date_seance) + '" ' +
                    'onclick="window.CoursApp.handleDeleteCours(this)">✕</button>' +
                '</td></tr>';
        }).join('');

        renderBulkBar();
        updateBulkBar();
        if (count) count.textContent = data.length + ' ligne(s)';
    }

    function renderBulkBar() {
        var existingBar = document.getElementById('bulk-bar-cours');
        if (existingBar) return; // Déjà rendu

        var card = document.getElementById('cours-tbody')?.closest('.card');
        if (!card) return;

        var tw = card.querySelector('.tw');
        if (!tw) return;

        var bar = document.createElement('div');
        bar.id = 'bulk-bar-cours';
        bar.className = 'bulk-bar';
        bar.innerHTML = '<div class="bulk-actions">' +
            '<span class="bulk-count" style="font-size:12px;color:var(--muted);">0 sélectionné(s)</span>' +
            '<button class="btn btn-danger btn-sm" onclick="window.CoursApp.bulkDeleteCours()">🗑 Supprimer la sélection</button>' +
            '<button class="btn btn-outline btn-sm" onclick="window.CoursApp.resetSelection();window.CoursApp.updateBulkBar();">↺ Tout désélectionner</button>' +
            '</div>';
        card.insertBefore(bar, tw);
    }

    function filterCoursTable() {
        const f = v('cours-filter').toUpperCase();
        const d = v('cours-date-filter');
        renderCoursTable(coursData.filter(function(r) {
            return (!f || (r.ticker || '').toUpperCase().indexOf(f) !== -1) && 
                   (!d || r.date_seance === d);
        }));
    }

    // ══════════════════════════════════════════════════════
    // SÉLECTION EN MASSE
    // ══════════════════════════════════════════════════════

    function toggleRow(id, checkbox) {
        if (checkbox.checked) {
            selectedIds.add(id);
        } else {
            selectedIds.delete(id);
        }
        updateBulkBar();
    }

    function resetSelection() {
        selectedIds.clear();
        document.querySelectorAll('.row-check').forEach(function(cb) {
            cb.checked = false;
        });
    }

    function updateBulkBar() {
        const bar = document.getElementById('bulk-bar-cours');
        if (!bar) return;
        const count = bar.querySelector('.bulk-count');
        if (count) count.textContent = selectedIds.size + ' sélectionné(s)';
    }

    async function bulkDeleteCours() {
        if (selectedIds.size === 0) {
            toast('Aucune ligne sélectionnée');
            return;
        }
        if (!doubleConfirm('Supprimer ' + selectedIds.size + ' cours ?')) return;

        let successCount = 0;
        let errorCount = 0;

        for (const id of selectedIds) {
            try {
                const ok = await sbDel('cours', 'id=eq.' + encodeURIComponent(id));
                if (ok) successCount++;
                else errorCount++;
            } catch (err) {
                console.error('[bulkDelete] Erreur pour id=' + id, err);
                errorCount++;
            }
        }

        toast(successCount + ' cours supprimé(s)' + (errorCount > 0 ? ', ' + errorCount + ' erreur(s)' : ''));
        resetSelection();
        loadCours();
    }

    // ══════════════════════════════════════════════════════
    // CRÉATION (ADD)
    // ══════════════════════════════════════════════════════

    async function addCours() {
        const msg = document.getElementById('c-msg');

        // ─── RÉCUPÉRATION ───
        const ticker = v('c-ticker');
        const date = v('c-date');
        const cours = pf('c-cours');
        const ouv = pf('c-ouv');
        const haut = pf('c-haut');
        const bas = pf('c-bas');
        const vol = pi('c-vol');
        const variation = pf('c-var');
        const capi = pf('c-capi');

        console.log('[addCours] Valeurs récupérées:', { 
            ticker, date, cours, ouv, haut, bas, vol, variation, capi 
        });

        // ─── VALIDATION STRICTE ───
        const errors = [];

        if (!isNonEmptyString(ticker)) {
            errors.push('Ticker obligatoire');
        }

        if (!isNonEmptyString(date)) {
            errors.push('Date obligatoire');
        }

        // COURS : doit être un nombre valide (0 est accepté !)
        if (!isValidNumber(cours)) {
            errors.push('Cours de clôture obligatoire (nombre valide)');
        }

        if (errors.length > 0) {
            const errorMsg = '⚠️ ' + errors.join(' | ');
            console.warn('[addCours] Validation échouée:', errors);
            if (msg) { 
                msg.textContent = errorMsg; 
                msg.className = 'msg err'; 
            }
            return;
        }

        // ─── CONSTRUCTION DU BODY (champs optionnels = undefined, pas null) ───
        // Supabase préfère undefined pour les champs optionnels (pas de mise à jour)
        // ou null explicite si vous voulez vider le champ
        const body = {
            ticker: ticker.trim().toUpperCase(),
            date_seance: date,
            cours_cloture: cours
        };

        // Ajouter les champs optionnels UNIQUEMENT s'ils sont valides
        if (isValidNumber(ouv)) body.cours_ouverture = ouv;
        if (isValidNumber(haut)) body.plus_haut = haut;
        if (isValidNumber(bas)) body.plus_bas = bas;
        if (isValidNumber(vol)) body.volume = vol;
        if (isValidNumber(variation)) body.variation = variation;
        if (isValidNumber(capi)) body.valeur_totale = capi;

        console.log('[addCours] Body envoyé:', body);

        // ─── ENVOI ───
        try {
            const r = await sbPost('cours', body, 'ticker,date_seance');

            if (r) {
                if (msg) { 
                    msg.textContent = '✓ Cours enregistré'; 
                    msg.className = 'msg ok'; 
                }
                clearForm(['c-ticker','c-date','c-cours','c-ouv','c-haut','c-bas','c-vol','c-var','c-capi']);
                loadCours();
            } else {
                // sbPost a retourné null/undefined → erreur déjà loggée
                if (msg) { 
                    msg.textContent = '✗ Erreur lors de l\'enregistrement'; 
                    msg.className = 'msg err'; 
                }
            }
        } catch (err) {
            console.error('[addCours] Exception:', err);
            if (msg) { 
                msg.textContent = '✗ Erreur: ' + err.message; 
                msg.className = 'msg err'; 
            }
        }
    }

    // ══════════════════════════════════════════════════════
    // ÉDITION (EDIT)
    // ══════════════════════════════════════════════════════

    function handleEditCours(btn) {
        // Récupération sécurisée depuis les attributs data-*
        const row = {
            id: btn.getAttribute('data-id'),
            ticker: btn.getAttribute('data-ticker'),
            date_seance: btn.getAttribute('data-date'),
            cours_cloture: parseFloat(btn.getAttribute('data-cours')) || null,
            cours_ouverture: parseFloat(btn.getAttribute('data-ouv')) || null,
            plus_haut: parseFloat(btn.getAttribute('data-haut')) || null,
            plus_bas: parseFloat(btn.getAttribute('data-bas')) || null,
            volume: parseInt(btn.getAttribute('data-vol'), 10) || null,
            variation: parseFloat(btn.getAttribute('data-var')) || null,
            valeur_totale: parseFloat(btn.getAttribute('data-capi')) || null
        };
        editCours(row);
    }

    function editCours(row) {
        const info = document.getElementById('modal-cours-info');
        if (info) info.textContent = escapeHtml(row.ticker) + ' — ' + escapeHtml(row.date_seance);

        set('modal-cours-id', row.id || '');
        set('modal-cours-val', row.cours_cloture);
        set('modal-cours-ouv', row.cours_ouverture);
        set('modal-cours-haut', row.plus_haut);
        set('modal-cours-bas', row.plus_bas);
        set('modal-cours-vol', row.volume);
        set('modal-cours-var', row.variation);
        set('modal-cours-capi', row.valeur_totale);

        openModal('modal-cours');
    }

    async function saveCours() {
        const id = v('modal-cours-id');
        const msg = document.getElementById('modal-cours-msg');

        if (!isNonEmptyString(id)) {
            if (msg) { msg.textContent = '✗ ID manquant'; msg.className = 'msg err'; }
            return;
        }

        const body = {};
        const cours = pf('modal-cours-val');

        // Validation : cours de clôture obligatoire même en édit
        if (!isValidNumber(cours)) {
            if (msg) { msg.textContent = '✗ Cours de clôture obligatoire'; msg.className = 'msg err'; }
            return;
        }

        body.cours_cloture = cours;

        const ouv = pf('modal-cours-ouv');
        const haut = pf('modal-cours-haut');
        const bas = pf('modal-cours-bas');
        const vol = pi('modal-cours-vol');
        const variation = pf('modal-cours-var');
        const capi = pf('modal-cours-capi');

        if (isValidNumber(ouv)) body.cours_ouverture = ouv;
        if (isValidNumber(haut)) body.plus_haut = haut;
        if (isValidNumber(bas)) body.plus_bas = bas;
        if (isValidNumber(vol)) body.volume = vol;
        if (isValidNumber(variation)) body.variation = variation;
        if (isValidNumber(capi)) body.valeur_totale = capi;

        try {
            const r = await sbPatch('cours', 'id=eq.' + encodeURIComponent(id), body);
            if (r) { 
                if (msg) { msg.textContent = '✓ Modifié'; msg.className = 'msg ok'; } 
                closeModal('modal-cours'); 
                loadCours(); 
            } else {
                if (msg) { msg.textContent = '✗ Erreur de modification'; msg.className = 'msg err'; }
            }
        } catch (err) {
            console.error('[saveCours] Exception:', err);
            if (msg) { msg.textContent = '✗ ' + err.message; msg.className = 'msg err'; }
        }
    }

    // ══════════════════════════════════════════════════════
    // SUPPRESSION (DELETE)
    // ══════════════════════════════════════════════════════

    function handleDeleteCours(btn) {
        const ticker = btn.getAttribute('data-ticker');
        const date = btn.getAttribute('data-date');
        deleteCours(ticker, date);
    }

    async function deleteCours(ticker, date) {
        if (!isNonEmptyString(ticker) || !isNonEmptyString(date)) {
            toast('Données de suppression invalides');
            return;
        }

        if (!doubleConfirm('Supprimer le cours ' + ticker + ' du ' + date + ' ?')) return;

        try {
            const ok = await sbDel('cours', 'ticker=eq.' + encodeURIComponent(ticker) + '&date_seance=eq.' + encodeURIComponent(date));
            if (ok) { 
                toast('Cours supprimé'); 
                loadCours(); 
            } else {
                toast('Erreur lors de la suppression');
            }
        } catch (err) {
            console.error('[deleteCours] Exception:', err);
            toast('Erreur: ' + err.message);
        }
    }

    // ══════════════════════════════════════════════════════
    // EXPOSITION PUBLIQUE (évite les conflits de nom global)
    // ══════════════════════════════════════════════════════

    window.CoursApp = {
        loadCours: loadCours,
        renderCoursTable: renderCoursTable,
        filterCoursTable: filterCoursTable,
        addCours: addCours,
        editCours: editCours,
        saveCours: saveCours,
        deleteCours: deleteCours,
        handleEditCours: handleEditCours,
        handleDeleteCours: handleDeleteCours,
        toggleRow: toggleRow,
        resetSelection: resetSelection,
        updateBulkBar: updateBulkBar,
        bulkDeleteCours: bulkDeleteCours
    };

})();
