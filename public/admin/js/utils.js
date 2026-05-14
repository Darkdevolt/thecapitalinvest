// ── DOM Helpers ──
export const v   = (id) => (document.getElementById(id)?.value || '').trim();
export const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
export const pf  = (id) => { const n = parseFloat(v(id)); return isNaN(n) ? null : n; };
export const pi  = (id) => { const n = parseInt(v(id)); return isNaN(n) ? null : n; };

// ── Formatters ──
export const fmt     = (n) => n != null && !isNaN(n) ? Number(n).toLocaleString('fr-FR', {minimumFractionDigits: 0, maximumFractionDigits: 4}) : '—';
export const fmtPct  = (n) => n != null && !isNaN(n) ? (Number(n)>=0?'+':'') + Number(n).toFixed(2) + '%' : '—';
export const clrPct  = (n) => Number(n)>=0 ? 'var(--green)' : 'var(--red)';
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

export function clearForm(ids) { ids.forEach(id => set(id, '')); }
export function clearBulk() { set('bulk-csv',''); const bp = document.getElementById('bulk-preview'); if(bp) bp.style.display='none'; }

// ── Notifications ──
export function toast(msg, type = 'ok') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

// ── Sécurité ──
export function doubleConfirm(msg) {
    if (!confirm(msg)) return false;
    return confirm('⚠️ Êtes-vous VRAIMENT sûr ? Cette action est irréversible et ne peut pas être annulée.');
}

// ── Écran de chargement ──
export function showLoadingScreen(msg) {
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

export function hideLoadingScreen() {
    const screen = document.getElementById('loading-screen');
    const app    = document.getElementById('app-wrapper');
    if (screen) screen.style.display = 'none';
    if (app)    app.style.display = '';
}

export function showFatalError(title, details) {
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

// ── Modals ──
export function closeModal(id) { const el = document.getElementById(id); if(el) el.classList.remove('open'); }
export function openModal(id)  { const el = document.getElementById(id); if(el) el.classList.add('open'); }

// ── Excel / Import helpers ──
export function isDateField(key) {
    return /date|detachement|paiement|intro|entree|analyse|expiry/.test(String(key).toLowerCase());
}

export function isNumericField(key) {
    const k = String(key).toLowerCase();
    return /montant|taux|rendement|valeur|cours|volume|capitalisation|nombre|actions|chiffre|ca|rbe|resultat|net|bpa|dpa|fonds|dettes|actif|cfo|capex|variation|haut|bas|ouverture|cloture|plus_haut|plus_bas|indice/.test(k);
}

export function excelDateToISO(val) {
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
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
}

export function normalizeExcelValue(val, key) {
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
    else if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) s = s.replace(/\./g, '').replace(/\,/g, '.');
    else if (/^-?\d+,\d+$/.test(s)) s = s.replace(/\,/g, '.');
    else if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) {
        const lastComma = s.lastIndexOf(',');
        const lastPoint = s.lastIndexOf('.');
        if (lastComma > lastPoint) s = s.replace(/\./g, '').replace(/\,/g, '.');
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

export function normalizeHeader(h) {
    return String(h).toLowerCase().trim().replace(/[\s\-]+/g,'_').replace(/[^a-z0-9_]/g,'');
}

export function headerMatches(detected, expected, synonyms) {
    const norm = normalizeHeader(detected);
    if (norm === expected) return true;
    for (const syn in synonyms) {
        if (synonyms[syn].indexOf(expected) !== -1 && synonyms[syn].indexOf(norm) !== -1) return true;
        if (syn === expected && synonyms[syn].indexOf(norm) !== -1) return true;
        if (syn === norm && synonyms[syn].indexOf(expected) !== -1) return true;
    }
    return false;
}

// ── Suppression multi-lignes ──
export const selectedRows = new Set();

export function toggleRow(id, el) {
    if (el.checked) selectedRows.add(id);
    else selectedRows.delete(id);
    updateBulkBar();
}

export function toggleAll(ids, el) {
    if (el.checked) ids.forEach(id => selectedRows.add(id));
    else ids.forEach(id => selectedRows.delete(id));
    document.querySelectorAll('.row-check[data-id]').forEach(cb => cb.checked = el.checked);
    updateBulkBar();
}

export function resetSelection() {
    selectedRows.clear();
    document.querySelectorAll('.row-check').forEach(cb => cb.checked = false);
    updateBulkBar();
}

export function updateBulkBar() {
    document.querySelectorAll('.bulk-bar').forEach(bar => {
        const count = bar.querySelector('.bulk-count');
        const actions = bar.querySelector('.bulk-actions');
        if (count) count.textContent = selectedRows.size + ' sélectionné(s)';
        if (actions) {
            if (selectedRows.size > 0) actions.classList.add('active');
            else actions.classList.remove('active');
        }
    });
}

export async function bulkDelete(table, idField, reloadFn, msgLabel, sbDelFn) {
    if (selectedRows.size === 0) { toast('Aucune ligne sélectionnée', 'err'); return; }
    const ids = Array.from(selectedRows);
    const label = msgLabel || 'ligne(s)';
    if (!doubleConfirm('Supprimer ' + ids.length + ' ' + label + ' ?')) return;
    if (!doubleConfirm('⚠️ CONFIRMATION FINALE : ' + ids.length + ' ' + label + ' seront définitivement effacées. Continuer ?')) return;

    let deleted = 0;
    for (let i = 0; i < ids.length; i++) {
        const ok = await sbDelFn(table, idField + '=eq.' + ids[i]);
        if (ok) deleted++;
    }
    toast('✓ ' + deleted + '/' + ids.length + ' ' + label + ' supprimée(s)', deleted === ids.length ? 'ok' : 'err');
    resetSelection();
    reloadFn();
}

// ── Indice helper ──
export function isIndice(ticker) {
    if (!ticker) return false;
    const t = String(ticker).trim().toUpperCase();
    return ['BRVM10','BRVM COMPOSITE','BRVM PRESTIGE','BRVM TRANSPORT','BRVM FINANCE','BRVM DISTRIBUTION','BRVM INDUSTRIE','BRVM AGRICULTURE','BRVM SERVICES PUBLICS','BRVM AUTRES SECTEURS'].indexOf(t) !== -1 || t.indexOf('BRVM') === 0;
}
