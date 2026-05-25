/* ══════════════════════════════════════════════════════
   COURS — Validation exhaustive (24 types d'erreurs)
   + Calcul automatique +haut/+bas 52 semaines
   + Affichage capitalisation complète (13 colonnes)
   Chaque erreur = ligne précise + champ + valeur + explication
══════════════════════════════════════════════════════ */

(function() {
    'use strict';

    let coursData = [];
    let selectedIds = new Set();
    let stats52 = {}; // Cache min/max 52 semaines par ticker

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
        return val !== null && val !== undefined && !isNaN(val) && typeof val === 'number' && isFinite(val);
    }

    function isNonEmptyString(str) {
        return typeof str === 'string' && str.trim().length > 0;
    }

    function toNumber(val) {
        if (val === null || val === undefined || val === '') return null;
        if (typeof val === 'number') return isFinite(val) ? val : null;
        const cleaned = String(val)
            .replace(/\s/g, '')
            .replace(/,/g, '.')
            .replace(/\.(?=.*\.)/g, '');
        const n = parseFloat(cleaned);
        return isNaN(n) || !isFinite(n) ? null : n;
    }

    function isValidISODate(str) {
        if (!isNonEmptyString(str)) return false;
        const regex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
        if (!regex.test(str.trim())) return false;
        const d = new Date(str.trim() + 'T00:00:00');
        return d instanceof Date && !isNaN(d) && d.toISOString().slice(0, 10) === str.trim();
    }

    function normalizeDate(dateStr) {
        if (!dateStr) return null;
        const s = String(dateStr).trim();
        if (isValidISODate(s)) return s;
        // US: M/D/YY
        const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (usMatch) {
            let [, m, d, y] = usMatch;
            let year = parseInt(y, 10);
            if (String(y).length === 2) year = year < 50 ? 2000 + year : 1900 + year;
            const iso = `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
            return isValidISODate(iso) ? iso : null;
        }
        // FR: D/M/YY
        const frMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (frMatch) {
            let [, d, m, y] = frMatch;
            let year = parseInt(y, 10);
            if (String(y).length === 2) year = year < 50 ? 2000 + year : 1900 + year;
            const iso = `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
            return isValidISODate(iso) ? iso : null;
        }
        // Tirets: DD-MM-YYYY
        const dashMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (dashMatch) {
            let [, d, m, y] = dashMatch;
            const iso = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
            return isValidISODate(iso) ? iso : null;
        }
        return null;
    }

    function isWeekend(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        const day = d.getDay();
        return day === 0 || day === 6;
    }

    // ══════════════════════════════════════════════════════
    // 24 TYPES D'ERREURS — VALIDATION LIGNE PAR LIGNE
    // ══════════════════════════════════════════════════════

    function validateCoursRow(row, ligneNum, existingKeys) {
        const errors = [];
        const prefix = ligneNum ? `[Ligne ${ligneNum}] ` : '';
        const rawTicker = row.ticker;
        const rawDate = row.date_seance || row.date;
        const rawCours = row.cours_cloture !== undefined ? row.cours_cloture : row.cours;
        const rawOuv = row.cours_ouverture !== undefined ? row.cours_ouverture : row.ouv;
        const rawHaut = row.plus_haut !== undefined ? row.plus_haut : row.haut;
        const rawBas = row.plus_bas !== undefined ? row.plus_bas : row.bas;
        const rawVol = row.volume !== undefined ? row.volume : row.vol;
        const rawVar = row.variation !== undefined ? row.variation : row.var;
        const rawCapi = row.valeur_totale !== undefined ? row.valeur_totale : row.capi;

        const ticker = isNonEmptyString(rawTicker) ? rawTicker.trim() : null;
        const date = isNonEmptyString(rawDate) ? rawDate.trim() : null;
        const cours = toNumber(rawCours);
        const ouv = toNumber(rawOuv);
        const haut = toNumber(rawHaut);
        const bas = toNumber(rawBas);
        const vol = toNumber(rawVol);
        const variation = toNumber(rawVar);
        const capi = toNumber(rawCapi);

        // 01. LIGNE VIDE
        if (!ticker && !date && cours === null && ouv === null && haut === null && bas === null && vol === null) {
            errors.push({
                type: 'LIGNE_VIDE',
                champ: 'global',
                valeur: '(vide)',
                message: prefix + 'Ligne VIDE : aucune donnée détectée. À supprimer du fichier.'
            });
            return errors;
        }

        // 02-05. TICKER
        if (!ticker) {
            errors.push({
                type: 'TICKER_MANQUANT',
                champ: 'ticker',
                valeur: rawTicker,
                message: prefix + 'Ticker MANQUANT : le symbole boursier est obligatoire (ex: NTLC).'
            });
        } else {
            if (ticker.length < 2) {
                errors.push({
                    type: 'TICKER_TROP_COURT',
                    champ: 'ticker',
                    valeur: ticker,
                    message: prefix + `Ticker TROP COURT (« ${escapeHtml(ticker)} ») : minimum 2 caractères.`
                });
            }
            if (/\s/.test(ticker)) {
                errors.push({
                    type: 'TICKER_ESPACES',
                    champ: 'ticker',
                    valeur: ticker,
                    message: prefix + `Ticker AVEC ESPACES (« ${escapeHtml(ticker)} ») : retirez les espaces (ex: « ${escapeHtml(ticker.replace(/\s/g, ''))} »).`
                });
            }
            if (!/^[A-Za-z0-9\.\-]+$/.test(ticker)) {
                errors.push({
                    type: 'TICKER_CARACTERES_INVALIDES',
                    champ: 'ticker',
                    valeur: ticker,
                    message: prefix + `Ticker INVALIDE (« ${escapeHtml(ticker)} ») : caractères autorisés = lettres, chiffres, point, tiret.`
                });
            }
        }

        // 06-12. DATE
        if (!date) {
            errors.push({
                type: 'DATE_MANQUANTE',
                champ: 'date_seance',
                valeur: rawDate,
                message: prefix + 'Date MANQUANTE : la date de séance est obligatoire (format YYYY-MM-DD).'
            });
        } else {
            const normalized = normalizeDate(date);
            if (!normalized) {
                if (typeof rawDate === 'number' && rawDate > 30000) {
                    errors.push({
                        type: 'DATE_EXCEL_TIMESTAMP',
                        champ: 'date_seance',
                        valeur: rawDate,
                        message: prefix + `Date = NOMBRE EXCEL (« ${rawDate} ») : convertissez en texte formaté YYYY-MM-DD avant import.`
                    });
                } else {
                    errors.push({
                        type: 'DATE_FORMAT_INCONNU',
                        champ: 'date_seance',
                        valeur: date,
                        message: prefix + `Date ILLISIBLE (« ${escapeHtml(date)} ») : formats acceptés = YYYY-MM-DD, MM/DD/YY ou DD/MM/YY.`
                    });
                }
            } else {
                if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(date) && date === rawDate.trim()) {
                    errors.push({
                        type: 'DATE_FORMAT_AMBIGU',
                        champ: 'date_seance',
                        valeur: date,
                        message: prefix + `Date convertie (« ${escapeHtml(date)} » → « ${normalized} ») : vérifiez que le mois/jour sont corrects.`
                    });
                }
                const today = new Date();
                today.setHours(0,0,0,0);
                const dNorm = new Date(normalized + 'T00:00:00');
                if (dNorm > today) {
                    errors.push({
                        type: 'DATE_FUTURE',
                        champ: 'date_seance',
                        valeur: normalized,
                        message: prefix + `Date FUTURE (« ${normalized} ») : impossible d'avoir un cours pour une date non encore passée.`
                    });
                }
                if (dNorm.getFullYear() < 1900) {
                    errors.push({
                        type: 'DATE_ANCIENNE',
                        champ: 'date_seance',
                        valeur: normalized,
                        message: prefix + `Date TROP ANCIENNE (« ${normalized} ») : année < 1900. Vérifiez le siècle (ex: 0026 → 2026).`
                    });
                }
                if (isWeekend(normalized)) {
                    errors.push({
                        type: 'DATE_WEEKEND',
                        champ: 'date_seance',
                        valeur: normalized,
                        message: prefix + `Date en WEEKEND (« ${normalized} ») : les marchés sont fermés samedi/dimanche.`
                    });
                }
            }
        }

        // 13-16. COURS CLÔTURE
        if (cours === null) {
            if (rawCours === '' || rawCours === null || rawCours === undefined) {
                errors.push({
                    type: 'COURS_MANQUANT',
                    champ: 'cours_cloture',
                    valeur: rawCours,
                    message: prefix + 'Cours de clôture MANQUANT : valeur principale obligatoire.'
                });
            } else {
                errors.push({
                    type: 'COURS_NON_NUMERIQUE',
                    champ: 'cours_cloture',
                    valeur: rawCours,
                    message: prefix + `Cours de clôture = TEXTE (« ${escapeHtml(String(rawCours))} ») : ce n'est pas un nombre. Vérifiez les virgules/espaces.`
                });
            }
        } else {
            if (cours < 0) {
                errors.push({
                    type: 'COURS_NEGATIF',
                    champ: 'cours_cloture',
                    valeur: cours,
                    message: prefix + `Cours de clôture NÉGATIF (« ${cours} ») : un prix boursier ne peut pas être négatif.`
                });
            }
            if (cours === 0) {
                errors.push({
                    type: 'COURS_ZERO',
                    champ: 'cours_cloture',
                    valeur: 0,
                    message: prefix + 'Cours de clôture = 0 : valeur suspecte. Confirmez que ce n'est pas une donnée manquante.'
                });
            }
        }

        // 17-19. LOGIQUE HAUT/BAS/OUVERTURE
        if (isValidNumber(ouv) && isValidNumber(haut) && ouv > haut) {
            errors.push({
                type: 'OUVERTURE_SUPERIEUR_HAUT',
                champ: 'cours_ouverture',
                valeur: ouv,
                message: prefix + `Ouverture (${ouv}) > Plus haut (${haut}) : impossible. L'ouverture doit être ≤ au plus haut de la séance.`
            });
        }
        if (isValidNumber(bas) && isValidNumber(haut) && bas > haut) {
            errors.push({
                type: 'BAS_SUPERIEUR_HAUT',
                champ: 'plus_bas',
                valeur: bas,
                message: prefix + `Plus bas (${bas}) > Plus haut (${haut}) : impossible. Le plus bas doit être ≤ au plus haut.`
            });
        }
        if (isValidNumber(bas) && isValidNumber(cours) && bas > cours) {
            errors.push({
                type: 'BAS_SUPERIEUR_CLOTURE',
                champ: 'plus_bas',
                valeur: bas,
                message: prefix + `Plus bas (${bas}) > Clôture (${cours}) : le cours de clôture doit être ≥ au plus bas de la séance.`
            });
        }

        // 20-21. VOLUME
        if (isValidNumber(vol) && vol < 0) {
            errors.push({
                type: 'VOLUME_NEGATIF',
                champ: 'volume',
                valeur: vol,
                message: prefix + `Volume NÉGATIF (« ${vol} ») : le volume d'échange ne peut pas être négatif.`
            });
        }
        if (rawVol !== null && rawVol !== undefined && rawVol !== '' && vol === null) {
            errors.push({
                type: 'VOLUME_NON_NUMERIQUE',
                champ: 'volume',
                valeur: rawVol,
                message: prefix + `Volume = TEXTE (« ${escapeHtml(String(rawVol))} ») : valeur ignorée, le champ sera mis à NULL.`
            });
        }

        // 22. VARIATION INCOHÉRENTE
        if (isValidNumber(ouv) && isValidNumber(cours) && isValidNumber(variation)) {
            const calcVar = ((cours - ouv) / ouv) * 100;
            const diff = Math.abs(calcVar - variation);
            if (diff > 1) {
                errors.push({
                    type: 'VARIATION_INCOHERENTE',
                    champ: 'variation',
                    valeur: variation,
                    message: prefix + `Variation incohérente : fichier=${variation}% mais calcul=(clôture-ouverture)/ouverture=${calcVar.toFixed(2)}%. Écart=${diff.toFixed(2)}%.`
                });
            }
        }

        // 23. VALEUR TOTALE
        if (rawCapi !== null && rawCapi !== undefined && rawCapi !== '' && capi === null) {
            errors.push({
                type: 'VALEUR_TOTALE_NON_NUMERIQUE',
                champ: 'valeur_totale',
                valeur: rawCapi,
                message: prefix + `Valeur totale = TEXTE (« ${escapeHtml(String(rawCapi))} ») : valeur ignorée, le champ sera mis à NULL.`
            });
        }

        // 24. DOUBLON
        if (ticker && date) {
            const normalized = normalizeDate(date);
            const key = (ticker.toUpperCase() + '|' + (normalized || date));
            if (existingKeys && existingKeys.has(key)) {
                errors.push({
                    type: 'DOUBLON_INTERNE',
                    champ: 'ticker+date',
                    valeur: ticker + ' / ' + (normalized || date),
                    message: prefix + `DOUBLON dans le fichier : « ${escapeHtml(ticker)} » + « ${normalized || date} » apparaît plusieurs fois.`
                });
            } else if (existingKeys) {
                existingKeys.add(key);
            }
        }

        return errors;
    }

    // ══════════════════════════════════════════════════════
    // IMPORT EN MASSE — RAPPORT DÉTAILLÉ
    // ══════════════════════════════════════════════════════

    function validateImportBatch(rows) {
        const rapport = {
            total: rows.length,
            valides: [],
            erreurs: [],
            warnings: [],
            resume: '',
            parType: {}
        };

        const existingKeys = new Set();

        rows.forEach((row, index) => {
            const ligneNum = index + 1;
            const errors = validateCoursRow(row, ligneNum, existingKeys);

            const bloquantes = errors.filter(e => 
                !['DATE_WEEKEND', 'COURS_ZERO', 'VOLUME_NON_NUMERIQUE', 
                  'VALEUR_TOTALE_NON_NUMERIQUE', 'VARIATION_INCOHERENTE'].includes(e.type)
            );

            const warnings = errors.filter(e => 
                ['DATE_WEEKEND', 'COURS_ZERO', 'VOLUME_NON_NUMERIQUE', 
                 'VALEUR_TOTALE_NON_NUMERIQUE', 'VARIATION_INCOHERENTE'].includes(e.type)
            );

            if (bloquantes.length === 0) {
                const normalizedRow = {
                    ticker: row.ticker ? String(row.ticker).trim().toUpperCase() : null,
                    date_seance: normalizeDate(row.date_seance || row.date),
                    cours_cloture: toNumber(row.cours_cloture !== undefined ? row.cours_cloture : row.cours),
                    cours_ouverture: toNumber(row.cours_ouverture !== undefined ? row.cours_ouverture : row.ouv),
                    plus_haut: toNumber(row.plus_haut !== undefined ? row.plus_haut : row.haut),
                    plus_bas: toNumber(row.plus_bas !== undefined ? row.plus_bas : row.bas),
                    volume: toNumber(row.volume !== undefined ? row.volume : row.vol),
                    variation: toNumber(row.variation !== undefined ? row.variation : row.var),
                    valeur_totale: toNumber(row.valeur_totale !== undefined ? row.valeur_totale : row.capi)
                };
                rapport.valides.push(normalizedRow);
            } else {
                rapport.erreurs.push(...bloquantes);
            }

            rapport.warnings.push(...warnings);

            errors.forEach(e => {
                rapport.parType[e.type] = (rapport.parType[e.type] || 0) + 1;
            });
        });

        const nbErreurs = rapport.erreurs.length;
        const nbValides = rapport.valides.length;
        const nbWarnings = rapport.warnings.length;

        if (nbErreurs === 0 && nbWarnings === 0) {
            rapport.resume = `✅ ${nbValides}/${rapport.total} lignes prêtes à importer. Aucun problème détecté.`;
        } else if (nbErreurs === 0) {
            rapport.resume = `⚠️ ${nbValides}/${rapport.total} lignes valides. ${nbWarnings} warning(s) non bloquant(s).`;
        } else {
            const topErrors = Object.entries(rapport.parType)
                .filter(([type]) => !['DATE_WEEKEND', 'COURS_ZERO', 'VOLUME_NON_NUMERIQUE', 
                                      'VALEUR_TOTALE_NON_NUMERIQUE', 'VARIATION_INCOHERENTE'].includes(type))
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([type, count]) => `${count}× ${type}`)
                .join(', ');

            rapport.resume = `❌ ${nbValides}/${rapport.total} lignes valides. ${nbErreurs} erreur(s) bloquante(s) : ${topErrors}.`;
        }

        return rapport;
    }

    // ══════════════════════════════════════════════════════
    // CHARGEMENT AVEC STATS 52 SEMAINES
    // ══════════════════════════════════════════════════════

    async function loadCours() {
        try {
            const recent = await sbGet('cours', 'select=*&order=date_seance.desc&limit=100');
            coursData = recent || [];

            if (coursData.length) {
                await calc52WeekStats(coursData);
            }

            renderCoursTable(coursData);
        } catch (err) {
            console.error('[loadCours] Erreur:', err);
            const tb = document.getElementById('cours-tbody');
            if (tb) {
                tb.innerHTML = '<tr><td colspan="13" style="text-align:center;color:var(--danger);padding:20px;">Erreur de chargement : ' + escapeHtml(err.message) + '</td></tr>';
            }
        }
    }

    async function calc52WeekStats(recentRows) {
        const tickers = [...new Set(recentRows.map(r => r.ticker).filter(Boolean))];
        if (!tickers.length) return;

        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        const dateStr = d.toISOString().slice(0, 10);

        const filter = tickers.map(t => 'ticker.eq.' + encodeURIComponent(t)).join(',');
        const history = await sbGet('cours', `select=ticker,cours_cloture&date_seance=gte.${dateStr}&ticker=or.(${filter})`);

        stats52 = {};
        (history || []).forEach(row => {
            if (!stats52[row.ticker]) {
                stats52[row.ticker] = { haut: -Infinity, bas: Infinity };
            }
            if (isValidNumber(row.cours_cloture)) {
                stats52[row.ticker].haut = Math.max(stats52[row.ticker].haut, row.cours_cloture);
                stats52[row.ticker].bas = Math.min(stats52[row.ticker].bas, row.cours_cloture);
            }
        });
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
            tb.innerHTML = '<tr><td colspan="13" style="text-align:center;color:var(--muted);padding:20px;">Aucun cours</td></tr>';
            if (count) count.textContent = '0 ligne';
            return;
        }

        resetSelection();

        tb.innerHTML = data.map(function(r) {
            const isSelected = selectedIds.has(r.id);
            const s52 = stats52[r.ticker] || { haut: null, bas: null };

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
                '<td class="r td-muted">' + fmt(s52.haut) + '</td>' +
                '<td class="r td-muted">' + fmt(s52.bas) + '</td>' +
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

        const errors = validateCoursRow(row);
        const bloquantes = errors.filter(e => 
            !['DATE_WEEKEND', 'COURS_ZERO', 'VOLUME_NON_NUMERIQUE', 
              'VALEUR_TOTALE_NON_NUMERIQUE', 'VARIATION_INCOHERENTE'].includes(e.type)
        );

        if (bloquantes.length > 0) {
            const errorMsg = bloquantes.map(e => e.message).join('<br>');
            console.warn('[addCours] Validation échouée:', bloquantes);
            if (msg) { 
                msg.innerHTML = errorMsg; 
                msg.className = 'msg err'; 
            }
            return;
        }

        const body = {
            ticker: row.ticker.trim().toUpperCase(),
            date_seance: normalizeDate(row.date_seance) || row.date_seance.trim(),
            cours_cloture: toNumber(row.cours_cloture)
        };

        const ouv = toNumber(row.cours_ouverture);
        const haut = toNumber(row.plus_haut);
        const bas = toNumber(row.plus_bas);
        const vol = toNumber(row.volume);
        const variation = toNumber(row.variation);
        const capi = toNumber(row.valeur_totale);

        if (isValidNumber(ouv)) body.cours_ouverture = ouv;
        if (isValidNumber(haut)) body.plus_haut = haut;
        if (isValidNumber(bas)) body.plus_bas = bas;
        if (isValidNumber(vol)) body.volume = vol;
        if (isValidNumber(variation)) body.variation = variation;
        if (isValidNumber(capi)) body.valeur_totale = capi;

        console.log('[addCours] Body envoyé:', body);

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
        validateCoursRow: validateCoursRow,
        validateImportBatch: validateImportBatch,
        normalizeDate: normalizeDate,
        toNumber: toNumber
    };

})();
