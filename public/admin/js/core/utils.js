/* ── HELPERS DOM ─────────────────────────────────────────────── */
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

/* ── TOASTS ───────────────────────────────────────────────────── */
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

/* ── MODALS ───────────────────────────────────────────────────── */
function closeModal(id) { const el = document.getElementById(id); if(el) el.classList.remove('open'); }
function openModal(id)  { const el = document.getElementById(id); if(el) el.classList.add('open'); }

/* ── CONFIRMATIONS ───────────────────────────────────────────── */
function doubleConfirm(msg) {
    if (!confirm(msg)) return false;
    return confirm('⚠️ Êtes-vous VRAIMENT sûr ? Cette action est irréversible et ne peut pas être annulée.');
}

/* ── INDICES BRV ─────────────────────────────────────────────── */
function isIndice(ticker) {
    if (!ticker) return false;
    const t = String(ticker).trim().toUpperCase();
    return INDICES_BRV.indexOf(t) !== -1 || t.indexOf('BRVM') === 0;
}

/* ── ÉCRAN DE CHARGEMENT ─────────────────────────────────────── */
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
            '<button onclick="localStorage.removeItem(\'' + SK + '\');location.href=\'login.html\'" ' +
            'style="padding:10px 22px;background:var(--gold);color:var(--bg);border:none;border-radius:4px;font-family:var(--sans);cursor:pointer;font-weight:500;">' +
            'Se reconnecter</button></div>';
        screen.style.display = 'flex';
        screen.style.flexDirection = 'column';
        screen.style.alignItems = 'center';
        screen.style.justifyContent = 'center';
    }
}

/* ── CONVERSION EXCEL DATES ─────────────────────────────────── */
function excelDateToISO(val) {
    if (!val && val !== 0) return null;
    
    // Déjà une date ISO
    if (typeof val === 'string') {
        var s = val.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        
        // DD/MM/YYYY ou DD-MM-YYYY
        if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(s)) {
            var sep = s.indexOf('/') !== -1 ? '/' : '-';
            var p = s.split(sep);
            return p[2] + '-' + p[1] + '-' + p[0];
        }
        
        // M/D/YY ou MM/DD/YY (format US court — sécurité)
        if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(s)) {
            var p = s.split('/');
            var m = p[0].padStart(2, '0');
            var d = p[1].padStart(2, '0');
            var y = parseInt(p[2], 10);
            y = y < 50 ? 2000 + y : 1900 + y;
            return y + '-' + m + '-' + d;
        }
        
        // MM/DD/YYYY (format US long)
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
            var p = s.split('/');
            return p[2] + '-' + p[0] + '-' + p[1];
        }
    }
    
    // Objet Date natif (quand cellDates: true + raw: true)
    if (val instanceof Date) {
        var y = val.getFullYear();
        var m = String(val.getMonth() + 1).padStart(2, '0');
        var d = String(val.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
    }
    
    // Serial number Excel
    var n = Number(val);
    if (isNaN(n) || n <= 0) return null;
    var epoch = new Date(1899, 11, 30);
    var date = new Date(epoch.getTime() + n * 24 * 60 * 60 * 1000);
    if (n >= 60) date = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
}

function isDateField(key) {
    return /date|detachement|paiement|intro|entree|analyse|expiry/.test(String(key).toLowerCase());
}

function normalizeExcelValue(val, key) {
    if (val === null || val === undefined || val === '') return null;
    if (isDateField(key)) return excelDateToISO(val);
    if (typeof val === 'number') return val;

    var s = String(val).trim();
    if (s === '') return null;

    if (/%$/.test(s)) {
        var numPart = s.replace(/%$/, '').trim().replace(/\s/g, '');
        if (/^-?\d+,\d+$/.test(numPart)) {
            numPart = numPart.replace(/,/g, '.');
        }
        else if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(numPart)) {
            numPart = numPart.replace(/,/g, '');
        }
        var pct = parseFloat(numPart);
        if (!isNaN(pct)) {
            console.warn('[normalizeExcelValue] Pourcentage converti pour ' + key + ': "' + val + '" → ' + pct);
            return pct;
        }
    }

    s = s.replace(/\s/g, '');

    if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(s)) {
        s = s.replace(/\,/g, '');
    }
    else if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
        s = s.replace(/\./g, '').replace(/\,/g, '.');
    }
    else if (/^-?\d+,\d+$/.test(s)) {
        s = s.replace(/\,/g, '.');
    }
    else if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) {
        var lastComma = s.lastIndexOf(',');
        var lastPoint = s.lastIndexOf('.');
        if (lastComma > lastPoint) {
            s = s.replace(/\./g, '').replace(/\,/g, '.');
        } else {
            s = s.replace(/\,/g, '');
        }
    }

    if (/^-?\d+\.?\d*$/.test(s)) return parseFloat(s);

    if (isNumericField(key)) {
        var cleaned = s.replace(/[^\d,\.\-]/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleaned.indexOf(',') !== -1 && cleaned.indexOf('.') === -1) {
            cleaned = cleaned.replace(/,/g, '.');
        } else if (cleaned.indexOf(',') !== -1 && cleaned.indexOf('.') !== -1) {
            var lc = cleaned.lastIndexOf(',');
            var lp = cleaned.lastIndexOf('.');
            if (lc > lp) cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
            else cleaned = cleaned.replace(/,/g, '');
        }
        var m = cleaned.match(/-?\d+\.?\d*/);
        if (m) {
            var n = parseFloat(m[0]);
            if (!isNaN(n)) {
                console.warn('[normalizeExcelValue] Extraction numérique pour ' + key + ': "' + val + '" → ' + n);
                return n;
            }
        }
    }

    return s;
}

function isNumericField(key) {
    var k = String(key).toLowerCase();
    return /montant|taux|rendement|valeur|cours|volume|capitalisation|nombre|actions|chiffre|ca|rbe|resultat|net|bpa|dpa|fonds|dettes|actif|cfo|capex|variation|haut|bas|ouverture|cloture|plus_haut|plus_bas|indice/.test(k);
}

function normalizeHeader(h) {
    return String(h).toLowerCase().trim().replace(/[\s\-]+/g,'_').replace(/[^a-z0-9_]/g,'');
}

function headerMatches(detected, expected) {
    var norm = normalizeHeader(detected);
    if (norm === expected) return true;
    for (var syn in TEMPLATE_SYNONYMS) {
        if (TEMPLATE_SYNONYMS[syn].indexOf(expected) !== -1 && TEMPLATE_SYNONYMS[syn].indexOf(norm) !== -1) return true;
        if (syn === expected && TEMPLATE_SYNONYMS[syn].indexOf(norm) !== -1) return true;
        if (syn === norm && TEMPLATE_SYNONYMS[syn].indexOf(expected) !== -1) return true;
    }
    return false;
}

function calcPotentiel() {
    const cible = pf('an-cible');
    const cours = pf('an-cours');
    const disp  = document.getElementById('an-potentiel-display');
    if (!cible || !cours || cours <= 0) { if(disp) disp.value = '—'; return; }
    const pot = ((cible - cours) / cours * 100).toFixed(2);
    if(disp){
        disp.value = (pot >= 0 ? '+' : '') + pot + '%';
        disp.style.color = pot >= 0 ? 'var(--green)' : 'var(--red)';
    }
}
