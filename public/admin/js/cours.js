/* ══════════════════════════════════════════════════════
   COURS — Validation précise et messages d'erreur détaillés
══════════════════════════════════════════════════════ */

(function() {
    'use strict';

    let coursData = [];
    let selectedIds = new Set();

    // ══════════════════════════════════════════════════════
    // UTILITAIRES
    // ══════════════════════════════════════════════════════

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function isValidNumber(val) {
        return val !== null && val !== undefined && !isNaN(val) && typeof val === 'number';
    }

    function isNonEmptyString(str) {
        return typeof str === 'string' && str.trim().length > 0;
    }

    /**
     * Validation stricte du format date YYYY-MM-DD
     */
    function isValidISODate(str) {
        if (!isNonEmptyString(str)) return false;
        // Format YYYY-MM-DD uniquement
        const regex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
        if (!regex.test(str.trim())) return false;
        
        // Vérification que la date existe réellement (pas 2026-02-30)
        const d = new Date(str.trim());
        return d instanceof Date && !isNaN(d) && 
               d.toISOString().slice(0, 10) === str.trim();
    }

    /**
     * Normalise une date M/D/YY ou MM/DD/YY → YYYY-MM-DD
     * Retourne null si impossible
     */
    function normalizeDate(dateStr) {
        if (!dateStr) return null;
        const s = String(dateStr).trim();
        
        // Déjà au bon format ?
        if (isValidISODate(s)) return s;
        
        // Format M/D/YY ou MM/DD/YY
        const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (usMatch) {
            let [, m, d, y] = usMatch;
            let year = parseInt(y, 10);
            if (y.length === 2) {
                year = year < 50 ? 2000 + year : 1900 + year;
            }
            const iso = `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
            return isValidISODate(iso) ? iso : null;
        }
        
        return null;
    }

    // ══════════════════════════════════════════════════════
    // VALIDATION PRÉCISE (retourne un tableau d'erreurs)
    // ══════════════════════════════════════════════════════

    /**
     * Valide une ligne de cours et retourne un tableau d'erreurs détaillées.
     * Chaque erreur est un objet : { champ, valeur, message }
     */
    function validateCoursRow(row, ligneNum) {
        const errors = [];
        const prefix = ligneNum ? `[Ligne ${ligneNum}] ` : '';

        // ─── TICKER ───
        const ticker = row.ticker;
        if (!isNonEmptyString(ticker)) {
            errors.push({
                champ: 'ticker',
                valeur: ticker,
                message: prefix + 'Ticker MANQUANT : le symbole boursier est obligatoire.'
            });
        } else if (ticker.trim().length < 2) {
            errors.push({
                champ: 'ticker',
                valeur: ticker,
                message: prefix + `Ticker TROP COURT (« ${escapeHtml(ticker.trim())} ») : minimum 2 caractères.`
            });
        }

        // ─── DATE ───
        const date = row.date_seance || row.date;
        if (!isNonEmptyString(date)) {
            errors.push({
                champ: 'date_seance',
                valeur: date,
                message: prefix + 'Date MANQUANTE : la date de séance est obligatoire.'
            });
        } else {
            const normalized = normalizeDate(date);
            if (!normalized) {
                errors.push({
                    champ: 'date_seance',
                    valeur: date,
                    message: prefix + `Date INVALIDE (« ${escapeHtml(date)} ») : format attendu YYYY-MM-DD (ex: 2026-05-25). Format américain détecté ? Essayez d'abord de convertir MM/DD/YY.`
                });
            }
        }

        // ─── COURS DE CLÔTURE ───
        const cours = row.cours_cloture !== undefined ? row.cours_cloture : row.cours;
        if (cours === null || cours === undefined || cours === '') {
            errors.push({
                champ: 'cours_cloture',
                valeur: cours,
                message: prefix + 'Cours de clôture MANQUANT : valeur principale obligatoire.'
            });
        } else if (isNaN(Number(cours))) {
            errors.push({
                champ: 'cours_cloture',
                valeur: cours,
                message: prefix + `Cours de clôture INCORRECT (« ${escapeHtml(cours)} ») : ce n'est pas un nombre valide.`
            });
        } else if (Number(cours) < 0) {
            errors.push({
                champ: 'cours_cloture',
                valeur: cours,
                message: prefix + `Cours de clôture NÉGATIF (« ${cours} ») : le prix ne peut pas être négatif.`
            });
        }

        // ─── CHAMPS OPTIONNELS (warnings si format mauvais mais pas bloquant) ───
        const champsOptionnels = [
            { key: 'cours_ouverture', val: row.cours_ouverture, nom: 'Cours d\'ouverture' },
            { key: 'plus_haut', val: row.plus_haut, nom: 'Plus haut' },
            { key: 'plus_bas', val: row.plus_bas, nom: 'Plus bas' },
            { key: 'volume', val: row.volume, nom: 'Volume' },
            { key: 'variation', val: row.variation, nom: 'Variation' },
            { key: 'valeur_totale', val: row.valeur_totale, nom: 'Valeur totale' }
        ];

        champsOptionnels.forEach(c => {
            if (c.val !== null && c.val !== undefined && c.val !== '' && isNaN(Number(c.val))) {
                errors.push({
                    champ: c.key,
                    valeur: c.val,
                    message: prefix + `${c.nom} IGNORÉ (« ${escapeHtml(c.val)} ») : valeur non-numérique, le champ sera mis à NULL.`
                });
            }
        });

        return errors;
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
            return '<tr>' +
                '<td><input type="checkbox" class="row-check" data-id="' + escapeHtml(r.id) + '" ' + (isSelected ? 'checked' : '') + ' onchange="window.CoursApp.toggleRow(\'' + escapeHtml(r.id) + '\',this)"></td>' +
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
        if (existingBar) return;

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
    // CRÉATION (ADD) — VALIDATION PRÉCISE
    // ══════════════════════════════════════════════════════

    async function addCours() {
        const msg = document.getElementById('c-msg');

        // ─── RÉCUPÉRATION ───
        const row = {
            ticker: v('c-ticker'),
            date_seance: v('c-date'),
            cours_cloture: pf('c-cours'),
            cours_ouverture: pf('c-ouv'),
            plus_haut: pf('c-haut'),
            plus_bas: pf('c-bas'),
            volume: pi('c-vol'),
            variation: pf('c-var'),
            valeur_totale: pf('c-capi')
        };

        console.log('[addCours] Valeurs récupérées:', row);

        // ─── VALIDATION PRÉCISE ───
        const errors = validateCoursRow(row);
        
        if (errors.length > 0) {
            // On filtre seulement les erreurs bloquantes (pas les warnings optionnels)
            const blockingErrors = errors.filter(e => !e.message.includes('IGNORÉ'));
            
            if (blockingErrors.length > 0) {
                const errorMsg = '❌ ' + blockingErrors.map(e => e.message).join(' | ');
                console.warn('[addCours] Validation échouée:', blockingErrors);
                if (msg) { 
                    msg.innerHTML = errorMsg; 
                    msg.className = 'msg err'; 
                }
                return;
            }
        }

        // ─── CONSTRUCTION DU BODY ───
        const body = {
            ticker: row.ticker.trim().toUpperCase(),
            date_seance: normalizeDate(row.date_seance) || row.date_seance.trim(),
            cours_cloture: row.cours_cloture
        };

        if (isValidNumber(row.cours_ouverture)) body.cours_ouverture = row.cours_ouverture;
        if (isValidNumber(row.plus_haut)) body.plus_haut = row.plus_haut;
        if (isValidNumber(row.plus_bas)) body.plus_bas = row.plus_bas;
        if (isValidNumber(row.volume)) body.volume = row.volume;
        if (isValidNumber(row.variation)) body.variation = row.variation;
        if (isValidNumber(row.valeur_totale)) body.valeur_totale = row.valeur_totale;

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
    // IMPORT EN MASSE — VALIDATION LIGNE PAR LIGNE
    // ══════════════════════════════════════════════════════

    /**
     * Valide un lot de données pour import et retourne un rapport détaillé.
     * À utiliser dans ton fichier d'import (import.js ou équivalent).
     */
    function validateImportBatch(rows) {
        const rapport = {
            total: rows.length,
            valides: [],
            erreurs: [], // { ligne, champ, valeur, message }
            resume: ''
        };

        rows.forEach((row, index) => {
            const ligneNum = index + 1;
            const errors = validateCoursRow(row, ligneNum);
            const blocking = errors.filter(e => !e.message.includes('IGNORÉ'));

            if (blocking.length === 0) {
                // Normaliser la date avant stockage
                const normalizedRow = {
                    ...row,
                    date_seance: normalizeDate(row.date_seance || row.date)
                };
                rapport.valides.push(normalizedRow);
            } else {
                rapport.erreurs.push(...blocking);
            }
        });

        const nbErreurs = rapport.erreurs.length;
        const nbValides = rapport.valides.length;
        
        if (nbErreurs === 0) {
            rapport.resume = `✅ ${nbValides}/${rapport.total} lignes prêtes à importer.`;
        } else {
            // Grouper les erreurs par type pour le résumé
            const parChamp = {};
            rapport.erreurs.forEach(e => {
                parChamp[e.champ] = (parChamp[e.champ] || 0) + 1;
            });
            
            const details = Object.entries(parChamp)
                .map(([champ, count]) => `${count}× ${champ}`)
                .join(', ');
                
            rapport.resume = `⚠️ ${nbValides}/${rapport.total} lignes valides. ${nbErreurs} erreur(s) détectée(s) : ${details}.`;
        }

        return rapport;
    }

    // ══════════════════════════════════════════════════════
    // ÉDITION (EDIT)
    // ══════════════════════════════════════════════════════

    function handleEditCours(btn) {
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
    // EXPOSITION PUBLIQUE
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
        bulkDeleteCours: bulkDeleteCours,
        // Nouvelles fonctions exposées pour l'import
        validateCoursRow: validateCoursRow,
        validateImportBatch: validateImportBatch,
        normalizeDate: normalizeDate
    };

})();
