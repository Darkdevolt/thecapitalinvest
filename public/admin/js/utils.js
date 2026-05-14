const v   = function(id) { return (document.getElementById(id) && document.getElementById(id).value || '').trim(); };
const set = function(id, val) { const el = document.getElementById(id); if (el) el.value = val !== undefined && val !== null ? val : ''; };
const pf  = function(id) { const n = parseFloat(v(id)); return isNaN(n) ? null : n; };
const pi  = function(id) { const n = parseInt(v(id)); return isNaN(n) ? null : n; };
const fmt     = function(n) { return n != null && !isNaN(n) ? Number(n).toLocaleString('fr-FR', {minimumFractionDigits: 0, maximumFractionDigits: 4}) : '—'; };
const fmtPct  = function(n) { return n != null && !isNaN(n) ? (Number(n)>=0?'+':'') + Number(n).toFixed(2) + '%' : '—'; };
const clrPct  = function(n) { return Number(n)>=0 ? 'var(--green)' : 'var(--red)'; };
const fmtDate = function(d) { return d ? new Date(d).toLocaleDateString('fr-FR') : '—'; };

function clearForm(ids) { ids.forEach(function(id) { set(id, ''); }); }
function clearBulk() { set('bulk-csv',''); const bp = document.getElementById('bulk-preview'); if(bp) bp.style.display='none'; }

function toast(msg, type) {
    type = type || 'ok';
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(function(){ t.remove(); }, 4000);
}

function doubleConfirm(msg) {
    if (!confirm(msg)) return false;
    return confirm('⚠️ Êtes-vous VRAIMENT sûr ? Cette action est irréversible et ne peut pas être annulée.');
}

function showLoadingScreen(msg) {
    const screen = document.getElementById('loading-screen');
    const msgEl  = document.getElementById('loading-msg');
    if (screen) {
        if (!screen.querySelector('.spinner')) {
            screen.innerHTML =
                '<div style="font-family:var(--serif);font-size:22px;font-weight:700;letter-spacing:3px;color:var(--cream);">THE <span style="color:var(--gold);">·</span> CAPITAL</div>' +
                '<div class="spinner" style="border-top-color:var(--gold);border-color:var(--border);border-width:3px;border-style:solid;border-radius:50%;width:32px;height:32px;animation:spin .8s linear infinite;"></div>' +
                '<p id="loading-msg"></p>';
        }
        screen.style.display = 'flex';
    }
    const freshMsg = document.getElementById('loading-msg');
    if (freshMsg) freshMsg.textContent = msg || 'Chargement...';
}

function hideLoadingScreen() {
    const screen = document.getElementById('loading-screen');
    const app    = document.getElementById('app-wrapper');
    if (screen) screen.style.display = 'none';
    if (app)    app.style.display = '';
}

function showFatalError(title, details) {
    const screen = document.getElementById('loading-screen');
    if (screen) {
        screen.innerHTML =
            '<div style="text-align:center;max-width:460px;padding:24px;">' +
            '<div style="font-size:48px;margin-bottom:16px;">⛔</div>' +
            '<h2 style="color:#F87171;margin-bottom:12px;font-family:var(--sans);font-size:20px;">' + title + '</h2>' +
            '<p style="color:rgba(245,240,232,0.65);line-height:1.6;font-size:13px;margin-bottom:24px;">' + details + '</p>' +
            '<button onclick="localStorage.removeItem(\'tc_session\');location.href=\'login.html\'" ' +
            'style="padding:10px 22px;background:var(--gold);color:var(--bg);border:none;border-radius:4px;font-family:var(--sans);cursor:pointer;font-weight:500;">' +
            'Se reconnecter</button></div>';
        screen.style.display = 'flex';
        screen.style.flexDirection = 'column';
        screen.style.alignItems = 'center';
        screen.style.justifyContent = 'center';
    }
}

function closeModal(id) { const el = document.getElementById(id); if(el) el.classList.remove('open'); }
function openModal(id)  { const el = document.getElementById(id); if(el) el.classList.add('open'); }

function switchSubTab(prefix, panel, el) {
    if (!el) return;
    const container = el.closest('.tab-panel');
    if (!container) return;
    container.querySelectorAll('.sub-tab').forEach(function(t){ t.classList.remove('active'); });
    el.classList.add('active');
    ['ligne','bulk','view','list','add'].forEach(function(p){
        const e2 = document.getElementById(prefix + '-panel-' + p);
        if (e2) e2.style.display = 'none';
    });
    const target = document.getElementById(prefix + '-panel-' + panel);
    if (target) target.style.display = '';
}

function isDateField(key) {
    return /date|detachement|paiement|intro|entree|analyse|expiry/.test(String(key).toLowerCase());
}

function isNumericField(key) {
    const k = String(key).toLowerCase();
    return /montant|taux|rendement|valeur|cours|volume|capitalisation|nombre|actions|chiffre|ca|rbe|resultat|net|bpa|dpa|fonds|dettes|actif|cfo|capex|variation|haut|bas|ouverture|cloture|plus_haut|plus_bas|indice/.test(k);
}

function excelDateToISO(val) {
    if (!val && val !== 0) return null;
    if (typeof val === 'string') {
        const s = val.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
            const p = s.split('/');
            return p[2] + '-' + p[1] + '-' + p[0];
        }
        if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
            const p = s.split('-');
            return p[2] + '-' + p[1] + '-' + p[0];
        }
    }
    if (val instanceof Date) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
    }
    const n = Number(val);
    if (isNaN(n) || n <= 0) return null;
    const epoch = new Date(1899, 11, 30);
    let date = new Date(epoch.getTime() + n * 24 * 60 * 60 * 1000);
    if (n >= 60) date = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
}

function normalizeExcelValue(val, key) {
    if (val === null || val === undefined || val === '') return null;
    if (isDateField(key)) return excelDateToISO(val);
    if (typeof val === 'number') return val;

    let s = String(val).trim();
    if (s === '') return null;

    if (/%$/.test(s)) {
        let numPart = s.replace(/%$/, '').trim().replace(/\s/g, '');
        if (/^-?\d+,\d+$/.test(numPart)) numPart = numPart.replace(/,/g, '.');
        else if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(numPart)) numPart = numPart.replace(/,/g, '');
        const pct = parseFloat(numPart);
        if (!isNaN(pct)) return pct;
    }

    s = s.replace(/\s/g, '');

    if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(s)) s = s.replace(/\,/g, '');
    else if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) s = s.replace(/\./g, '').replace(/,/g, '.');
    else if (/^-?\d+,\d+$/.test(s)) s = s.replace(/,/g, '.');
    else if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) {
        const lastComma = s.lastIndexOf(',');
        const lastPoint = s.lastIndexOf('.');
        if (lastComma > lastPoint) s = s.replace(/\./g, '').replace(/,/g, '.');
        else s = s.replace(/\,/g, '');
    }

    if (/^-?\d+\.?\d*$/.test(s)) return parseFloat(s);

    if (isNumericField(key)) {
        let cleaned = s.replace(/[^\d,\.\-]/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleaned.indexOf(',') !== -1 && cleaned.indexOf('.') === -1) cleaned = cleaned.replace(/,/g, '.');
        else if (cleaned.indexOf(',') !== -1 && cleaned.indexOf('.') !== -1) {
            const lc = cleaned.lastIndexOf(',');
            const lp = cleaned.lastIndexOf('.');
            if (lc > lp) cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
            else cleaned = cleaned.replace(/,/g, '');
        }
        const m = cleaned.match(/-?\d+\.?\d*/);
        if (m) {
            const n = parseFloat(m[0]);
            if (!isNaN(n)) return n;
        }
    }

    return s;
}

function normalizeHeader(h) {
    return String(h).toLowerCase().trim().replace(/[\s\-]+/g,'_').replace(/[^a-z0-9_]/g,'');
}

function headerMatches(detected, expected, synonyms) {
    const norm = normalizeHeader(detected);
    if (norm === expected) return true;
    for (const syn in synonyms) {
        if (synonyms[syn].indexOf(expected) !== -1 && synonyms[syn].indexOf(norm) !== -1) return true;
        if (syn === expected && synonyms[syn].indexOf(norm) !== -1) return true;
        if (syn === norm && synonyms[syn].indexOf(expected) !== -1) return true;
    }
    return false;
}

function toggleRow(id, el) {
    if (el.checked) selectedRows.add(id);
    else selectedRows.delete(id);
    updateBulkBar();
}

function toggleAll(ids, el) {
    if (el.checked) ids.forEach(function(id){ selectedRows.add(id); });
    else ids.forEach(function(id){ selectedRows.delete(id); });
    document.querySelectorAll('.row-check[data-id]').forEach(function(cb){ cb.checked = el.checked; });
    updateBulkBar();
}

function resetSelection() {
    selectedRows.clear();
    document.querySelectorAll('.row-check').forEach(function(cb){ cb.checked = false; });
    updateBulkBar();
}

function updateBulkBar() {
    document.querySelectorAll('.bulk-bar').forEach(function(bar){
        const count = bar.querySelector('.bulk-count');
        const actions = bar.querySelector('.bulk-actions');
        if (count) count.textContent = selectedRows.size + ' sélectionné(s)';
        if (actions) {
            if (selectedRows.size > 0) actions.classList.add('active');
            else actions.classList.remove('active');
        }
    });
}

function bulkDelete(table, idField, reloadFn, msgLabel) {
    if (selectedRows.size === 0) { toast('Aucune ligne sélectionnée', 'err'); return; }
    const ids = Array.from(selectedRows);
    const label = msgLabel || 'ligne(s)';
    if (!doubleConfirm('Supprimer ' + ids.length + ' ' + label + ' ?')) return;
    if (!doubleConfirm('⚠️ CONFIRMATION FINALE : ' + ids.length + ' ' + label + ' seront définitivement effacées. Continuer ?')) return;

    let deleted = 0;
    const promises = ids.map(function(id) {
        return sbDel(table, idField + '=eq.' + id).then(function(ok) {
            if (ok) deleted++;
        });
    });
    Promise.all(promises).then(function() {
        toast('✓ ' + deleted + '/' + ids.length + ' ' + label + ' supprimée(s)', deleted === ids.length ? 'ok' : 'err');
        resetSelection();
        reloadFn();
    });
}

function isIndice(ticker) {
    if (!ticker) return false;
    const t = String(ticker).trim().toUpperCase();
    return CONFIG.INDICES_BRV.indexOf(t) !== -1 || t.indexOf('BRVM') === 0;
}
