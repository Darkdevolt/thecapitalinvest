/* ============================================================
   THE CAPITAL — NOYAU / OUTILS
   Formatage, accès au DOM, notifications, fenêtre modale,
   normalisation des nombres et des dates.
   ============================================================ */
'use strict';

(function (TC) {

    /* ── Échappement et accès au DOM ─────────────────────── */

    const esc = TC.esc = function (value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    };

    const el = TC.el = id => document.getElementById(id);
    const qs = TC.qs = (sel, root) => (root || document).querySelector(sel);
    const qsa = TC.qsa = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

    TC.val = function (id) {
        const node = el(id);
        return node ? String(node.value || '').trim() : '';
    };

    TC.setVal = function (id, value) {
        const node = el(id);
        if (node) node.value = (value === null || value === undefined) ? '' : value;
    };

    TC.num = function (id) {
        const n = parseFloat(String(TC.val(id)).replace(',', '.'));
        return Number.isFinite(n) ? n : null;
    };

    TC.int = function (id) {
        const n = parseInt(TC.val(id), 10);
        return Number.isFinite(n) ? n : null;
    };

    TC.clear = function (ids) {
        ids.forEach(id => TC.setVal(id, ''));
    };

    TC.on = function (id, event, handler) {
        const node = el(id);
        if (node) node.addEventListener(event, handler);
    };

    /* Délégation : les tableaux sont réécrits à chaque rendu, attacher
       les écouteurs ligne par ligne fuit en mémoire et se perd au re-render. */
    TC.delegate = function (root, selector, event, handler) {
        const host = typeof root === 'string' ? el(root) : root;
        if (!host || host.dataset['bound' + event] === selector) return;
        host.addEventListener(event, function (e) {
            const target = e.target.closest(selector);
            if (target && host.contains(target)) handler(target, e);
        });
        host.dataset['bound' + event] = selector;
    };

    /* ── Nombres, pourcentages, dates ────────────────────── */

    /**
     * Lecture tolérante d'un nombre saisi ou importé : espaces insécables,
     * séparateur décimal français, séparateur de milliers, symbole monétaire
     * et signe pourcent sont tous acceptés.
     */
    const toNumber = TC.toNumber = function (value) {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        let s = String(value).replace(/\u00a0/g, ' ').replace(/\s+/g, '').replace(/%$/, '')
            .replace(/(?:FCFA|XOF|CFA|€|\$)/gi, '');
        if (!s) return null;
        if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) {
            s = s.lastIndexOf(',') > s.lastIndexOf('.')
                ? s.replace(/\./g, '').replace(',', '.')
                : s.replace(/,/g, '');
        } else if (s.indexOf(',') >= 0) {
            s = s.replace(',', '.');
        }
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    };

    TC.fmt = function (value, digits) {
        const n = toNumber(value);
        if (n === null) return '—';
        return n.toLocaleString('fr-FR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: digits === undefined ? 2 : digits
        });
    };

    TC.fmtInt = function (value) {
        const n = toNumber(value);
        return n === null ? '—' : Math.round(n).toLocaleString('fr-FR');
    };

    TC.fmtPct = function (value) {
        const n = toNumber(value);
        if (n === null) return '—';
        return (n >= 0 ? '+' : '') + n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
    };

    TC.trendClass = function (value) {
        const n = toNumber(value);
        if (n === null || n === 0) return 'td-muted';
        return n > 0 ? 'up' : 'down';
    };

    TC.today = () => new Date().toISOString().slice(0, 10);

    /** Date de séance normalisée en AAAA-MM-JJ, quelle que soit l'entrée. */
    const toISODate = TC.toISODate = function (value) {
        if (value === null || value === undefined || value === '') return null;
        if (value instanceof Date && !isNaN(value)) {
            return value.getFullYear() + '-' +
                String(value.getMonth() + 1).padStart(2, '0') + '-' +
                String(value.getDate()).padStart(2, '0');
        }
        if (typeof value === 'number') {
            /* Numéro de série Excel (origine 30/12/1899). */
            if (value <= 0 || value > 80000) return null;
            const base = new Date(Date.UTC(1899, 11, 30));
            const d = new Date(base.getTime() + value * 86400000);
            return d.toISOString().slice(0, 10);
        }
        const s = String(value).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
        const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
        if (m) {
            let day = +m[1], month = +m[2], year = +m[3];
            if (year < 100) year += year < 50 ? 2000 : 1900;
            /* Format américain détecté lorsque le premier groupe dépasse 12. */
            if (day <= 12 && month > 12) { const swap = day; day = month; month = swap; }
            if (month < 1 || month > 12 || day < 1 || day > 31) return null;
            return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        }
        const parsed = Date.parse(s);
        return Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10);
    };

    TC.fmtDate = function (value) {
        const iso = toISODate(value);
        if (!iso) return '—';
        const [y, m, d] = iso.split('-');
        return d + '/' + m + '/' + y;
    };

    TC.fmtDateLong = function (value) {
        const iso = toISODate(value);
        if (!iso) return '—';
        return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    };

    TC.isWeekend = function (iso) {
        const day = new Date(iso + 'T12:00:00').getDay();
        return day === 0 || day === 6;
    };

    TC.isIndice = function (ticker) {
        if (!ticker) return false;
        const t = String(ticker).trim().toUpperCase();
        return TC.INDICES.indexOf(t) !== -1 || /^BRVM/.test(t);
    };

    /** Ajoute (ou retranche) des jours à une date ISO. */
    TC.shiftDays = function (iso, days) {
        const d = new Date(iso + 'T12:00:00');
        d.setDate(d.getDate() + days);
        return d.toISOString().slice(0, 10);
    };

    /* ── Notifications ───────────────────────────────────── */

    TC.toast = function (message, type, ms) {
        const host = el('toasts');
        if (!host) { console.log('[TC]', message); return; }
        const node = document.createElement('div');
        node.className = 'toast ' + (type || 'ok');
        node.textContent = message;
        host.appendChild(node);
        setTimeout(() => {
            node.style.opacity = '0';
            node.style.transition = 'opacity .3s';
            setTimeout(() => node.remove(), 320);
        }, ms || 4200);
    };

    TC.say = function (id, message, type) {
        const node = el(id);
        if (!node) return;
        node.textContent = message || '';
        node.className = 'msg ' + (type || '');
    };

    /* ── Confirmation en deux temps ──────────────────────── */

    TC.confirmTwice = function (question, detail) {
        if (!window.confirm(question)) return false;
        return window.confirm('Confirmation finale — ' + (detail || 'cette action est irréversible.') + '\n\nContinuer ?');
    };

    /* ── Fenêtre modale partagée ─────────────────────────── */

    let modalSave = null;

    TC.modal = {
        open(options) {
            el('modal-title').textContent = options.title || '';
            el('modal-sub').textContent = options.subtitle || '';
            el('modal-body').innerHTML = options.body || '';
            TC.say('modal-msg', '');
            const saveBtn = el('modal-save');
            saveBtn.textContent = options.saveLabel || 'Enregistrer';
            saveBtn.style.display = options.readonly ? 'none' : '';
            modalSave = options.onSave || null;
            el('modal-host').classList.add('open');
            if (typeof options.afterOpen === 'function') options.afterOpen();
            const first = qs('#modal-body input:not([readonly]), #modal-body select, #modal-body textarea');
            if (first) setTimeout(() => first.focus(), 60);
        },
        close() {
            el('modal-host').classList.remove('open');
            modalSave = null;
        },
        msg(text, type) { TC.say('modal-msg', text, type); },
        busy(state) {
            const saveBtn = el('modal-save');
            saveBtn.disabled = !!state;
            saveBtn.textContent = state ? 'Enregistrement…' : (saveBtn.dataset.label || 'Enregistrer');
        }
    };

    document.addEventListener('DOMContentLoaded', function () {
        const host = el('modal-host');
        if (!host) return;
        el('modal-cancel').addEventListener('click', TC.modal.close);
        el('modal-save').addEventListener('click', function () {
            if (typeof modalSave === 'function') modalSave();
        });
        host.addEventListener('click', function (e) { if (e.target === host) TC.modal.close(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && host.classList.contains('open')) TC.modal.close();
        });
    });

    /* ── Construction de champs de formulaire ────────────── */

    /**
     * Un champ décrit par un objet plutôt que par du HTML recopié :
     * { id, label, type, placeholder, col, options, wide, readonly, hint }
     */
    TC.field = function (f) {
        const label = '<label for="' + f.id + '">' + esc(f.label) +
            (f.col ? ' <span class="col">→ ' + esc(f.col) + '</span>' : '') + '</label>';
        let control;
        if (f.type === 'select') {
            control = '<select id="' + f.id + '">' + (f.options || []).map(o => {
                const value = typeof o === 'string' ? o : o.v;
                const text = typeof o === 'string' ? o : o.l;
                return '<option value="' + esc(value) + '">' + esc(text) + '</option>';
            }).join('') + '</select>';
        } else if (f.type === 'textarea') {
            control = '<textarea id="' + f.id + '" rows="' + (f.rows || 4) + '" placeholder="' + esc(f.placeholder || '') + '"></textarea>';
        } else {
            control = '<input type="' + (f.type || 'text') + '" id="' + f.id + '"' +
                (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') +
                (f.step ? ' step="' + f.step + '"' : (f.type === 'number' ? ' step="any"' : '')) +
                (f.readonly ? ' readonly' : '') +
                (f.upper ? ' data-upper="1"' : '') + '>';
        }
        return '<div class="field' + (f.wide ? ' wide' : '') + '">' + label + control +
            (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') + '</div>';
    };

    TC.fields = list => list.map(TC.field).join('');

    /* Mise en majuscules automatique des champs ticker, sans écouteur inline. */
    document.addEventListener('input', function (e) {
        if (e.target && e.target.dataset && e.target.dataset.upper) {
            const pos = e.target.selectionStart;
            e.target.value = e.target.value.toUpperCase();
            try { e.target.setSelectionRange(pos, pos); } catch (err) { /* champ non textuel */ }
        }
    });

    /* ── États de tableau ────────────────────────────────── */

    TC.rowsLoading = cols =>
        '<tr><td colspan="' + cols + '"><div class="loading"><div class="spinner"></div>Chargement…</div></td></tr>';

    TC.rowsEmpty = (cols, title, hint) =>
        '<tr><td colspan="' + cols + '"><div class="empty-state"><strong>' + esc(title) + '</strong>' +
        (hint ? esc(hint) : '') + '</div></td></tr>';

    /* ── Téléchargements ─────────────────────────────────── */

    TC.download = function (filename, content, mime) {
        const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    };

    TC.toCSV = function (rows, columns) {
        const head = columns.join(';');
        const body = rows.map(r => columns.map(c => {
            const value = r[c];
            if (value === null || value === undefined) return '';
            const s = String(value);
            return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(';')).join('\n');
        return '\ufeff' + head + '\n' + body;
    };

    /* ── Sélection multiple ──────────────────────────────── */

    TC.selection = function (key) {
        const set = new Set();
        return {
            set,
            toggle(id, checked) { checked ? set.add(String(id)) : set.delete(String(id)); this.paint(); },
            all(ids, checked) {
                ids.forEach(id => checked ? set.add(String(id)) : set.delete(String(id)));
                qsa('#bulk-' + key + '-scope .rowcheck[data-id]').forEach(cb => { cb.checked = checked; });
                this.paint();
            },
            reset() {
                set.clear();
                qsa('#bulk-' + key + '-scope .rowcheck').forEach(cb => { cb.checked = false; });
                this.paint();
            },
            ids() { return Array.from(set); },
            paint() {
                const bar = el('bulk-' + key);
                if (!bar) return;
                bar.classList.toggle('on', set.size > 0);
                const count = qs('.bulk-count', bar);
                if (count) count.textContent = set.size + ' ligne(s) sélectionnée(s)';
            }
        };
    };

})(window.TC);
