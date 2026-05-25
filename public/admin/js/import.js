/* ══════════════════════════════════════════════════════
   IMPORT EXCEL
══════════════════════════════════════════════════════ */
var currentUpload = { data: [], config: null, filename: '' };

var dz = document.getElementById('drop-zone');
if (dz) {
    dz.addEventListener('dragover', function(e){ e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', function(){ dz.classList.remove('dragover'); });
    dz.addEventListener('drop', function(e){
        e.preventDefault(); dz.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
}

function handleFileSelect(e) { if (e.target.files.length) handleFile(e.target.files[0]); }

async function handleFile(file) {
    currentUpload.filename = file.name;
    currentUpload.config = null;
    currentUpload.data = [];
    currentUpload.missingTickers = [];
    const uf = document.getElementById('upload-filename');
    const ui = document.getElementById('upload-info');
    const usd = document.getElementById('upload-sheet-detected');
    const uhf = document.getElementById('upload-headers-found');
    const ucol = document.getElementById('upload-colonnes');
    const manual = document.getElementById('manual-template');
    if(uf) uf.textContent = file.name;
    if(ui) ui.style.display = '';
    if(usd) usd.style.display = 'none';
    if(uhf) uhf.textContent = '';
    if(ucol) ucol.textContent = '';
    if(manual) manual.value = '';

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '', raw: true });
    if (!jsonData.length || jsonData.length < 2) { toast('Fichier vide ou invalide', 'err'); return; }

    console.log('📊 Feuilles Excel:', workbook.SheetNames);
    console.log('📊 Première ligne (headers):', jsonData[0]);
    console.log('📊 Nombre total de lignes:', jsonData.length);

    const rawHeaders = jsonData[0];
    const headers = rawHeaders.map(function(h){ return String(h).toLowerCase().trim().replace(/[\s\-]+/g,'_').replace(/[^a-z0-9_]/g,''); });
    const detected = detectTemplate(headers);

    if(uhf) uhf.textContent = headers.length + ' colonnes détectées | ' + (jsonData.length - 1) + ' lignes de données';
    if(ucol) ucol.textContent = 'Cols: ' + headers.join(', ');

    if (!detected) {
        toast('Template non reconnu — sélectionnez manuellement', 'err');
        var alertEl = document.getElementById('upload-template-alert');
        if(alertEl) alertEl.style.display = '';
        console.log('Headers détectés:', headers);
        console.log('Essayez les templates:', Object.keys(TEMPLATE_CONFIG));
        return;
    } else {
        var alertEl = document.getElementById('upload-template-alert');
        if(alertEl) alertEl.style.display = 'none';
    }

    if(usd){ usd.textContent = 'Template : ' + TEMPLATE_CONFIG[detected].name; usd.style.display = ''; }
    currentUpload.config = TEMPLATE_CONFIG[detected];
    currentUpload.lastTemplateKey = detected;

    const rows = [];
    for (var i = 1; i < jsonData.length; i++) {
        var row = jsonData[i];
        if (!row.some(function(cell){ return cell !== '' && cell !== null && cell !== undefined; })) continue;
        var obj = {};
        rawHeaders.forEach(function(rawH, idx){
            var normH = String(rawH).toLowerCase().trim().replace(/[\s\-]+/g,'_').replace(/[^a-z0-9_]/g,'');
            var rawVal = row[idx] !== undefined ? row[idx] : null;
            obj[normH] = rawVal;
        });
        rows.push(obj);
    }
    console.log('📊 Exemple ligne 1:', rows[0]);
    currentUpload.data = rows;
    console.log('✓ ' + rows.length + ' lignes importées pour template ' + detected);
    showPreview(detected, rows);
}

function detectTemplate(headers) {
    var normHeaders = headers.map(normalizeHeader);
    var hasDividendeMarker = normHeaders.some(function(h){
        return h === 'exercice' || h === 'date_detachement' || h === 'date_paiement' || h === 'taux_rendement';
    });
    if (hasDividendeMarker) {
        var divConfig = TEMPLATE_CONFIG.dividendes;
        var divMatch = divConfig.required.filter(function(rh){
            return normHeaders.some(function(h){ return headerMatches(h, rh); });
        }).length;
        if (divMatch >= 2) return 'dividendes';
    }
    for (var key in TEMPLATE_CONFIG) {
        var config = TEMPLATE_CONFIG[key];
        var required = config.required;
        var match = required.filter(function(rh){
            // Match direct
            if (normHeaders.some(function(h){ return headerMatches(h, rh); })) return true;
            // Match via fieldMap (nouveau)
            if (config.fieldMap && config.fieldMap[rh]) {
                return config.fieldMap[rh].some(function(alias){
                    var normAlias = normalizeHeader(alias);
                    return normHeaders.indexOf(normAlias) !== -1;
                });
            }
            return false;
        }).length;
        var threshold = key === 'dividendes' ? 1.0 : 0.8;
        if (match >= Math.ceil(required.length * threshold)) return key;
    }
    return null;
}

function forceTemplate(key) {
    if (!key || !TEMPLATE_CONFIG[key]) { toast('Template invalide', 'err'); return; }
    currentUpload.config = TEMPLATE_CONFIG[key];
    currentUpload.lastTemplateKey = key;
    var usd = document.getElementById('upload-sheet-detected');
    if(usd){ usd.textContent = 'Template forcé : ' + TEMPLATE_CONFIG[key].name; usd.style.display = ''; }
    toast('Template manuel : ' + TEMPLATE_CONFIG[key].name, 'info');
    if (currentUpload.data && currentUpload.data.length) {
        showPreview(key, currentUpload.data);
    }
}

function resolveFieldValue(row, config, field) {
    // 1. Cherche le nom exact du champ dans la ligne
    var rawVal = row[field];
    if (rawVal !== undefined && rawVal !== null && rawVal !== '') return rawVal;

    // 2. Cherche via fieldMap du template
    if (config.fieldMap && config.fieldMap[field]) {
        for (var a = 0; a < config.fieldMap[field].length; a++) {
            var alias = config.fieldMap[field][a];
            // a) nom exact dans l'objet row
            if (row[alias] !== undefined && row[alias] !== null && row[alias] !== '') {
                return row[alias];
            }
            // b) version normalisée
            for (var rk in row) {
                var normRk = String(rk).toLowerCase().trim().replace(/[\s\-]+/g,'_').replace(/[^a-z0-9_]/g,'');
                var normAlias = String(alias).toLowerCase().trim().replace(/[\s\-]+/g,'_').replace(/[^a-z0-9_]/g,'');
                if (normRk === normAlias && row[rk] !== undefined && row[rk] !== null && row[rk] !== '') {
                    return row[rk];
                }
            }
        }
    }

    // 3. Fallbacks durs (compatibilité)
    if (field === 'ticker') return row.code || row.symbol || row.isin || row.code_valeur;
    if (field === 'date_seance') return row.date || row.date_seance;
    if (field === 'annee') return row.year;
    if (field === 'montant') return row.dividende || row.valeur;
    if (field === 'indice') return row.code || row.indice;
    if (field === 'cours_cloture') return row.cours || row.cloture || row.cours_cloture;
    if (field === 'cours_ouverture') return row.ouverture || row.cours_ouverture || row.ouv;
    if (field === 'plus_haut') return row.haut || row.plus_haut || row.high;
    if (field === 'plus_bas') return row.bas || row.plus_bas || row.low;
    if (field === 'volume') return row.vol || row.quantite || row.volume;
    if (field === 'variation') return row.var || row.pct || row.variation_pct || row.variation;
    if (field === 'valeur_totale') return row.capitalisation || row.capi || row.cap || row.valeur_totale;

    return undefined;
}

function validateRow(row, lineIndex, config) {
    var errors = [];
    var warnings = [];
    var cleaned = {};
    var display = {};
    var mapped = {};

    // Résolution de TOUS les champs via fieldMap + fallback
    config.headers.forEach(function(h) {
        mapped[h] = resolveFieldValue(row, config, h);
    });

    var tickerVal = mapped.ticker;
    if (!tickerVal || String(tickerVal).trim() === '') {
        errors.push("Ligne " + lineIndex + " : le ticker/code est vide.");
        display.ticker = '';
    } else {
        cleaned.ticker = String(tickerVal).trim().toUpperCase();
        display.ticker = cleaned.ticker;
    }

    // Vérification des champs required avec résolution fieldMap
    config.required.forEach(function(req) {
        var rawVal = mapped[req];
        if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
            errors.push("Ligne " + lineIndex + ", colonne '" + req + "' : valeur obligatoire manquante.");
        }
    });

    // Traitement de chaque champ
    config.headers.forEach(function(h) {
        var rawVal = mapped[h];

        var norm = normalizeExcelValue(rawVal, h);

        if (isNumericField(h) && norm !== null && typeof norm !== 'number') {
            errors.push("Ligne " + lineIndex + ", colonne '" + h + "' : '" + rawVal + "' n'est pas un nombre valide.");
        }

        if (norm !== null && norm !== undefined && norm !== '') {
            cleaned[h] = norm;
        }
        display[h] = (norm !== null && norm !== undefined) ? norm : (rawVal || '');
    });

    if (config.table === 'dividendes_calendrier') {
        if (!cleaned.exercice) cleaned.exercice = String(cleaned.annee || new Date().getFullYear());
        display.exercice = cleaned.exercice;
        if ((cleaned.montant === undefined || cleaned.montant === null) && display.montant !== 0) {
            errors.push("Ligne " + lineIndex + " : le montant du dividende est obligatoire et doit être numérique.");
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
        cleaned: cleaned,
        display: display,
        original: row
    };
}

function updatePreviewCell(lineIdx, field, newVal) {
    if (!currentUpload.data[lineIdx]) return;
    currentUpload.data[lineIdx][field] = newVal.trim();
    showPreview(currentUpload.lastTemplateKey, currentUpload.data);
}

async function showPreview(templateKey, rows) {
    var config = TEMPLATE_CONFIG[templateKey];
    if (!config) return;
    currentUpload.lastTemplateKey = templateKey;

    var pCard = document.getElementById('preview-card');
    var pCount = document.getElementById('preview-count');
    var btnConfirm = document.getElementById('btn-confirm-import');
    var importMsg = document.getElementById('import-msg');

    if (pCard) pCard.style.display = '';
    if (pCount) pCount.textContent = rows.length + ' lignes';

    var allResults = [];
    var totalErrors = 0;
    var totalWarnings = 0;
    var errorListHTML = '';
    var warnListHTML = '';

    for (var i = 0; i < rows.length; i++) {
        var lineNum = i + 2;
        var res = validateRow(rows[i], lineNum, config);
        allResults.push(res);
        if (!res.valid) totalErrors += res.errors.length;
        totalWarnings += res.warnings.length;
        res.errors.forEach(function(e){ errorListHTML += '<li>' + e + '</li>'; });
        res.warnings.forEach(function(w){ warnListHTML += '<li class="warn">' + w + '</li>'; });
    }

    var reportHTML = '';
    if (totalErrors > 0) {
        reportHTML += '<div style="color:var(--red);font-weight:500;font-size:13px;margin-bottom:6px;">⛔ ' + totalErrors + ' erreur(s) détectée(s) — corrigez les cellules surlignées en rouge ci-dessous.</div>';
        reportHTML += '<ul style="margin:0 0 0 16px;padding:0;font-size:12px;line-height:1.8;">' + errorListHTML + '</ul>';
    } else if (totalWarnings > 0) {
        reportHTML += '<div style="color:var(--orange);font-weight:500;font-size:13px;margin-bottom:6px;">⚠️ ' + totalWarnings + ' valeur(s) corrigée(s) automatiquement.</div>';
        reportHTML += '<ul style="margin:0 0 0 16px;padding:0;font-size:12px;line-height:1.8;">' + warnListHTML + '</ul>';
    } else {
        reportHTML += '<div style="color:var(--green);font-weight:500;font-size:13px;">✅ Toutes les lignes sont valides.</div>';
    }

    var existingReport = document.getElementById('validation-report');
    if (existingReport) existingReport.innerHTML = reportHTML;
    else {
        var infoBox = document.querySelector('#preview-card .info-box');
        var reportDiv = document.createElement('div');
        reportDiv.id = 'validation-report';
        reportDiv.className = 'validation-report';
        reportDiv.innerHTML = reportHTML;
        if (infoBox && infoBox.parentNode) infoBox.parentNode.insertBefore(reportDiv, infoBox);
    }

    if (totalErrors > 0) {
        if (btnConfirm) { btnConfirm.disabled = true; btnConfirm.style.opacity = '0.5'; btnConfirm.style.cursor = 'not-allowed'; }
        if (importMsg) { importMsg.innerHTML = '<span style="color:var(--red);">Corrigez les erreurs en rouge avant de confirmer.</span>'; importMsg.className = 'msg err'; }
    } else {
        if (btnConfirm) { btnConfirm.disabled = false; btnConfirm.style.opacity = '1'; btnConfirm.style.cursor = 'pointer'; }
        if (importMsg) { importMsg.innerHTML = '<span style="color:var(--green);">' + rows.length + ' ligne(s) prête(s) à importer.</span>'; importMsg.className = 'msg ok'; }
    }

    var pHead = document.getElementById('preview-thead');
    var pBody = document.getElementById('preview-tbody');
    var displayHeaders = config.headers.slice();
    if (config.table === 'dividendes_calendrier' && displayHeaders.indexOf('exercice') === -1) displayHeaders.push('exercice');
    displayHeaders.push('_statut');

    if (pHead) {
        pHead.innerHTML = '<tr>' + displayHeaders.map(function(h){
            return '<th>' + (h === '_statut' ? 'Statut' : h) + '</th>';
        }).join('') + '</tr>';
    }

    if (pBody) {
        pBody.innerHTML = allResults.map(function(res, idx){
            var cls = res.valid ? 'cell-ok' : 'cell-error';
            var cells = displayHeaders.map(function(h){
                if (h === '_statut') {
                    var statusIcon = res.valid ? '✅' : '❌';
                    var statusText = res.valid ? 'Prêt' : res.errors[0];
                    return '<td style="font-size:11px;white-space:normal;max-width:220px;">' + statusIcon + ' ' + statusText + '</td>';
                }
                var val = res.display[h] !== undefined ? res.display[h] : '';
                var cellCls = '';
                var hasFieldError = res.errors.some(function(e){ return e.indexOf("colonne '" + h + "'") !== -1; });
                if (hasFieldError) cellCls = 'cell-error';
                else if (res.valid) cellCls = 'cell-ok';
                return '<td contenteditable="true" data-field="' + h + '" class="' + cellCls + '" ' +
                       'onblur="updatePreviewCell(' + idx + ',\'' + h + '\',this.innerText)" ' +
                       'title="' + (hasFieldError ? 'Cliquez pour corriger' : '') + '">' + (val !== null ? val : '') + '</td>';
            }).join('');
            return '<tr data-line-idx="' + idx + '">' + cells + '</tr>';
        }).join('');
    }
}

async function verifyTickers(tickers) {
    if (!tickers.length) return { ok: true, missing: [] };
    var params = 'select=ticker&ticker=in.(' + tickers.map(encodeURIComponent).join(',') + ')';
    var rows = await sbGet('entreprises', params);
    var found = new Set((rows || []).map(function(r){ return r.ticker; }));
    var missing = tickers.filter(function(t){ return !found.has(t); });
    return { ok: missing.length === 0, missing: missing };
}

async function createMissingTickers(missing) {
    var body = missing.map(function(t){
        return { ticker: t, nom: t, pays: '', secteur: '', compartiment: 'PRINCIPAL' };
    });
    var r = await sbPost('entreprises', body, 'ticker');
    return r !== null;
}

async function autoCreateTickers() {
    if (!currentUpload.missingTickers || !currentUpload.missingTickers.length) return;
    var btn = document.getElementById('import-msg');
    if(btn) { btn.textContent = 'Création des tickers...'; btn.className = 'msg info'; }
    var ok = await createMissingTickers(currentUpload.missingTickers);
    if (ok) {
        toast('✓ ' + currentUpload.missingTickers.length + ' ticker(s) créé(s)');
        currentUpload.missingTickers = [];
        confirmImport();
    } else {
        if(btn) { btn.textContent = 'Échec création tickers'; btn.className = 'msg err'; }
    }
}

async function confirmImport() {
    var config = currentUpload.config;
    if (!currentUpload.data.length || !config) return;

    var tbody = document.getElementById('preview-tbody');
    var freshData = [];
    if (tbody) {
        var trs = tbody.querySelectorAll('tr[data-line-idx]');
        trs.forEach(function(tr){
            var idx = parseInt(tr.dataset.lineIdx);
            var row = {};
            if (currentUpload.data[idx]) {
                for (var k in currentUpload.data[idx]) row[k] = currentUpload.data[idx][k];
            }
            var cells = tr.querySelectorAll('td[data-field]');
            cells.forEach(function(td){
                var field = td.dataset.field;
                row[field] = td.innerText.trim();
            });
            freshData.push(row);
        });
    } else {
        freshData = currentUpload.data.slice();
    }

    var allErrors = [];
    var prepared = [];
    freshData.forEach(function(row, i){
        var lineNum = i + 2;
        var res = validateRow(row, lineNum, config);
        if (!res.valid) allErrors = allErrors.concat(res.errors);
        if (res.cleaned && res.cleaned.ticker) prepared.push(res.cleaned);
    });

    if (allErrors.length > 0) {
        var msgEl = document.getElementById('import-msg');
        if (msgEl) {
            msgEl.innerHTML = '<span style="color:var(--red);font-weight:500;">⛔ Import bloqué : ' + allErrors.length + ' erreur(s). Corrigez les cellules rouges dans le tableau.</span>';
            msgEl.className = 'msg err';
        }
        toast('Corrigez les erreurs en rouge avant de confirmer', 'err');
        return;
    }

    var progressCard = document.getElementById('progress-card');
    if (progressCard) progressCard.style.display = 'block';
    var inserted = 0;
    var batchSize = 100;
    var progress = document.getElementById('import-progress');
    var pText = document.getElementById('progress-text');

    for (var i = 0; i < prepared.length; i += batchSize) {
        var batch = prepared.slice(i, i + batchSize);
        if (progress) progress.style.width = Math.round((i / prepared.length) * 100) + '%';
        if (pText) pText.textContent = 'Envoi lot ' + (Math.floor(i / batchSize) + 1) + '/' + Math.ceil(prepared.length / batchSize) + '...';
        if (batch.length) {
            var r = await sbPost(config.table, batch, config.uniqueKey);
            if (r) inserted += batch.length;
        }
    }

    if (progress) progress.style.width = '100%';
    if (pText) pText.textContent = 'Terminé !';
    toast('✅ Import terminé : ' + inserted + ' ligne(s) importée(s) sur ' + prepared.length + ' préparée(s)');
    if (config.table === 'cours' || config.table === 'historique') await recalcVariations();
    cancelImport();
}

function cancelImport() {
    currentUpload = { data:[], config:null, filename:'' };
    const pCard = document.getElementById('preview-card');
    const prCard = document.getElementById('progress-card');
    const uInfo = document.getElementById('upload-info');
    const eFile = document.getElementById('excel-file');
    if(pCard) pCard.style.display   = 'none';
    if(prCard) prCard.style.display  = 'none';
    if(uInfo) uInfo.style.display    = 'none';
    if(eFile) eFile.value = '';
}

function downloadTemplate(type) {
    var config = TEMPLATE_CONFIG[type];
    if (!config) return;
    var examples = {
        ticker: 'SNTS', nom: 'SONATEL', nom_complet: 'Sonatel SA',
        pays: 'Sénégal', secteur: 'Télécoms', compartiment: 'Prestige',
        isin: 'SN0000000000', description: 'Opérateur télécoms',
        site_web: 'https://sonatel.sn', date_introduction: '2024-01-15',
        siege_social: 'Dakar', actif: 'Télécommunications',
        telephone: '+221338491010', email: 'contact@sonatel.sn',
        dirigeant: 'Directeur Général', logo_url: 'https://...',
        code_naf: '6110Z',
        date_seance: '2026-05-09', cours: 25995, ouverture: 25800,
        plus_haut: 26100, plus_bas: 25750, volume: 1250,
        capitalisation: 250000000000, plus_haut_52: 28000, plus_bas_52: 22000,
        annee: 2024, periode: 'annuel', chiffre_affaires: 900000,
        rbe: 250000, resultat_net: 168000, bpa: 17500, dpa: 12000,
        fonds_propres: 620000, dettes_financieres: 150000,
        total_actif: 850000, nombre_actions: 9600000,
        cash_flow_operationnel: 200000, capex: 80000, source: 'Rapport annuel 2024',
        marge_nette: 18.7, rendement_dividende: 5.2, ebitda: 300000,
        resultat_exploitation: 220000,
        montant: 12000, date_detachement: '2026-06-15',
        date_paiement: '2026-07-01', statut: 'confirmé', notes: 'Acompte',
        devise: 'XOF', type_dividende: 'cash', exercice: '2024-2025',
        indice: 'BRVM10', valeur: 185.42, variation: 0.85, variation_pct: 0.46,
        nom_actionnaire: 'État du Sénégal', pourcentage: 55,
        type_actionnaire: 'État', pays_origine: 'Sénégal',
        date_entree: '2000-01-01', nature: 'Actionnaire majoritaire'
    };
    var aoa = [config.headers];
    var row1 = [];
    config.headers.forEach(function(h){
        row1.push(examples[h] !== undefined ? examples[h] : '');
    });
    aoa.push(row1);
    var row2 = [];
    config.headers.forEach(function(h){ row2.push(''); });
    aoa.push(row2);
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, config.name);
    XLSX.writeFile(wb, config.name + '_Template.xlsx');
    toast('Template ' + config.name + ' téléchargé');
}
