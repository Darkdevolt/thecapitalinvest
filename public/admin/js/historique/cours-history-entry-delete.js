/* THE CAPITAL — Suppression ciblée d'une cotation Cours / Historique
   Périmètre strict : table historique de l'Admin uniquement.
   Ne supprime jamais une séance entière : une seule ligne à la fois.
*/
(function () {
    'use strict';

    var STYLE_ID = 'tc-entry-delete-style';
    var BUTTON_CLASS = 'tc-entry-delete';

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function headers(extra) {
        var h = {
            apikey: SB_ANON,
            Authorization: 'Bearer ' + TK,
            Accept: 'application/json',
            'Content-Type': 'application/json'
        };
        if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
        return h;
    }

    async function request(path, options) {
        var r = await fetch(SB_REST + path, Object.assign({ headers: headers() }, options || {}));
        var text = await r.text();
        if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + text.slice(0, 250));
        var data = [];
        try { data = text ? JSON.parse(text) : []; } catch (_) {}
        return data;
    }

    function notify(message, type) {
        if (typeof toast === 'function') toast(message, type || 'info');
        else window.alert(message);
    }

    function addStyle() {
        if (document.getElementById(STYLE_ID)) return;
        var s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent =
            '.tc-entry-actions{display:flex;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap}' +
            '.tc-entry-delete{border:1px solid rgba(210,100,90,.55)!important;background:rgba(210,100,90,.09)!important;color:#ef9a91!important;border-radius:5px;padding:5px 8px;font:600 10px var(--mono,monospace);cursor:pointer;white-space:nowrap}' +
            '.tc-entry-delete:hover{background:rgba(210,100,90,.18)!important;border-color:#ef9a91!important}' +
            '.tc-entry-delete:disabled{opacity:.55;cursor:not-allowed}';
        document.head.appendChild(s);
    }

    function refresh(type) {
        if (type === 'cours' && typeof window.CoursControl === 'object' && typeof window.CoursControl.refresh === 'function') {
            window.CoursControl.refresh();
        }
        if (typeof loadHistoriqueTicker === 'function') loadHistoriqueTicker();
        setTimeout(function () {
            decorate();
            if (typeof loadSessionDates === 'function') loadSessionDates();
        }, 500);
    }

    async function deleteById(id, ticker, date, type, button) {
        if (!id) throw new Error('Identifiant de cotation introuvable. Rechargez le tableau.');
        var label = String(ticker || '') + ' · ' + String(date || '').slice(0, 10);
        if (!window.confirm('SUPPRIMER CETTE COTATION ?\n\n' + label + '\n\nCette suppression concerne uniquement cette ligne. Elle est définitive.')) return;
        button.disabled = true;
        try {
            await request('/historique?id=eq.' + encodeURIComponent(id), {
                method: 'DELETE',
                headers: headers({ Prefer: 'return=minimal' })
            });
            notify('Cotation supprimée : ' + label, 'success');
            refresh(type);
        } catch (e) {
            button.disabled = false;
            notify('Suppression impossible : ' + e.message, 'err');
        }
    }

    async function deleteByTickerDate(ticker, date, button) {
        var rows = await request('/historique?select=id,ticker,date_seance,cours_cloture&ticker=eq.' + encodeURIComponent(ticker) + '&date_seance=eq.' + encodeURIComponent(String(date).slice(0, 10)) + '&order=id.asc&limit=20');
        if (!Array.isArray(rows) || !rows.length) throw new Error('Cotation introuvable. Rechargez le tableau.');
        if (rows.length > 1) {
            throw new Error('Plusieurs cotations existent pour ce ticker/date. Utilisez le contrôle avec identifiant précis.');
        }
        await deleteById(rows[0].id, rows[0].ticker, rows[0].date_seance, 'historique', button);
    }

    function makeButton(id, ticker, date, type) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'tc-entry-delete';
        b.textContent = 'Supprimer';
        b.title = 'Supprimer uniquement cette cotation';
        b.dataset.id = id || '';
        b.dataset.ticker = ticker || '';
        b.dataset.date = date || '';
        b.addEventListener('click', function () {
            if (b.disabled) return;
            if (id) deleteById(id, ticker, date, type, b);
            else deleteByTickerDate(ticker, date, b).catch(function (e) { notify('Suppression impossible : ' + e.message, 'err'); });
        });
        return b;
    }

    function decorateControlTable() {
        var root = document.getElementById('cours-control-center');
        if (!root) return;
        root.querySelectorAll('tbody tr').forEach(function (tr) {
            var edit = tr.querySelector('.tc-edit-course');
            if (!edit || tr.querySelector('.' + BUTTON_CLASS)) return;
            var action = edit.parentElement;
            if (!action) return;
            var wrap = document.createElement('div');
            wrap.className = 'tc-entry-actions';
            action.insertBefore(wrap, edit);
            wrap.appendChild(edit);
            wrap.appendChild(makeButton(edit.dataset.id, edit.dataset.ticker, edit.dataset.date, 'cours'));
        });
    }

    function decorateArchiveTable() {
        var tb = document.getElementById('hist-tbody');
        if (!tb) return;
        tb.querySelectorAll('tr').forEach(function (tr) {
            if (tr.querySelector('.tc-entry-delete')) return;
            var edit = tr.querySelector('.tc-archive-edit');
            var cells = tr.children;
            if (!cells || cells.length < 3) return;
            var ticker = edit && edit.dataset ? edit.dataset.ticker : (cells[1].textContent || '').trim();
            var date = edit && edit.dataset ? edit.dataset.date : (cells[2].textContent || '').trim();
            if (!ticker || !date) return;
            var action = edit ? edit.parentElement : cells[cells.length - 1];
            if (!action) return;
            action.appendChild(makeButton('', ticker, date, 'historique'));
        });
    }

    function decorate() {
        addStyle();
        decorateControlTable();
        decorateArchiveTable();
    }

    function boot() {
        if (window.__tcEntryDeleteBooted) return;
        window.__tcEntryDeleteBooted = true;
        addStyle();
        var observer = new MutationObserver(function () { decorate(); });
        observer.observe(document.body, { childList: true, subtree: true });
        decorate();
        setInterval(decorate, 1200);
    }

    window.TCEntryDelete = { decorate: decorate, deleteById: deleteById };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
