/* ============================================================
   THE CAPITAL — BULLETIN OFFICIEL DE LA COTE
   Dépôt en deux temps : la fonction serveur délivre une URL
   signée, le navigateur téléverse directement vers le stockage,
   puis la fonction enregistre la référence. Un bulletin pèse
   couramment plusieurs mégaoctets, bien au-delà de ce qu'une
   fonction serverless accepte en corps de requête.
   ============================================================ */
'use strict';

(function (TC) {

    let bulletins = [];

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">Bulletins <em>officiels</em></div>' +
            '<div class="page-sub">Archive des Bulletins Officiels de la Cote. Le document fait foi : les cotations saisies ou récupérées doivent pouvoir être rapprochées du bulletin de la séance correspondante.</div></div>' +
            '</div>' +

            '<div class="card accent"><div class="card-head"><span class="card-title">Déposer un bulletin</span></div>' +
            '<div class="form-grid">' +
            TC.field({ id: 'boc-date', label: 'Date de séance', type: 'date' }) +
            TC.field({ id: 'boc-file', label: 'Document PDF', type: 'file', hint: 'PDF uniquement, 50 Mo maximum. Une date au format AAAAMMJJ dans le nom du fichier est reconnue automatiquement.' }) +
            '</div>' +
            '<div class="actions"><button class="btn btn-primary" id="boc-upload">Déposer le bulletin</button>' +
            '<span class="msg" id="boc-msg"></span></div>' +
            '<div class="card-body tight"><div class="bar" id="boc-bar" hidden><i style="width:0%"></i></div></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Bulletins enregistrés</span>' +
            '<span class="card-tools"><input type="search" id="boc-filter" placeholder="Filtrer par année…" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;width:150px;">' +
            '<span class="card-count" id="boc-count"></span>' +
            '<button class="btn btn-outline btn-sm" id="boc-reload">↺</button></span></div>' +
            '<div class="tw capped"><table><thead><tr><th>Séance</th><th>N° bulletin</th><th>Fichier</th><th>Cotations en base</th><th></th></tr></thead>' +
            '<tbody id="boc-tbody">' + TC.rowsLoading(5) + '</tbody></table></div></div>';
    }

    function dateFromName(name) {
        const m = String(name || '').match(/(20\d{2})[-_]?([01]\d)[-_]?([0-3]\d)/);
        return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
    }

    /**
     * Selon la version du client Supabase, createSignedUploadUrl renvoie soit
     * une URL absolue, soit un simple chemin du type
     * /object/upload/sign/boc_pdfs/… . Envoyé tel quel, ce chemin relatif est
     * adressé au domaine Vercel, qui répond 404 : le message d'erreur accuse
     * alors le stockage d'un refus dont il n'est pas responsable.
     */
    function signedTarget(prep) {
        const raw = String((prep && prep.signedUrl) || '');
        if (!raw) throw new Error('Le serveur n\'a pas fourni d\'URL de téléversement.');
        if (/^https?:\/\//i.test(raw)) return raw;
        const base = String(TC.env.SUPABASE_URL || '').replace(/\/+$/, '');
        const path = raw.replace(/^\/+/, '');
        return base + (path.indexOf('storage/v1/') === 0 ? '/' : '/storage/v1/') + path;
    }

    /** Restitue le motif exact renvoyé par le stockage plutôt qu'un code nu. */
    async function storageError(response, target) {
        let detail = '';
        try {
            const text = await response.text();
            const parsed = JSON.parse(text);
            detail = parsed.message || parsed.error || text;
        } catch (e) { /* corps vide ou non JSON */ }

        const host = (function () {
            try { return new URL(target).host; } catch (e) { return target; }
        })();

        if (response.status === 404) {
            if (host.indexOf('supabase') === -1) {
                return 'Le téléversement a été adressé à ' + host + ' au lieu du stockage Supabase. ' +
                    'Rechargez la page pour charger la version corrigée du module.';
            }
            return 'Le stockage Supabase a répondu 404' + (detail ? ' : ' + detail : '') +
                '. Vérifiez le bucket visé dans api/boc-upload.js et la validité du jeton signé.';
        }
        if (response.status === 400 && /already exists/i.test(detail)) {
            return 'Un fichier porte déjà ce chemin dans le stockage.';
        }
        if (response.status === 401 || response.status === 403) {
            return 'Le stockage a refusé l\'autorisation. Vérifiez les politiques du bucket « boc_pdfs ».' +
                (detail ? ' [' + detail + ']' : '');
        }
        if (response.status === 413) return 'Fichier trop volumineux pour le stockage Supabase.';
        return 'Le stockage a refusé le fichier (HTTP ' + response.status + ')' + (detail ? ' : ' + detail : '.');
    }

    async function load() {
        TC.el('boc-tbody').innerHTML = TC.rowsLoading(5);
        try {
            const payload = await TC.api('/api/boc', { method: 'GET' });
            bulletins = (payload && payload.data) || [];
        } catch (e) {
            TC.el('boc-tbody').innerHTML =
                '<tr><td colspan="5"><div class="empty-state"><strong>Liste indisponible</strong>' + TC.esc(e.message) + '</div></td></tr>';
            return;
        }

        /* Rapprochement : un bulletin sans cotation en base signale un import manqué. */
        const dates = Array.from(new Set(bulletins.map(b => b.date_seance).filter(Boolean)));
        const counts = {};
        if (dates.length) {
            const rows = await TC.getAll('historique',
                'select=date_seance&date_seance=in.(' + dates.map(d => '"' + d + '"').join(',') + ')');
            (rows || []).forEach(r => { counts[r.date_seance] = (counts[r.date_seance] || 0) + 1; });
        }
        bulletins.forEach(b => { b.__cotations = counts[b.date_seance] || 0; });
        paint(bulletins);
    }

    function paint(list) {
        const tbody = TC.el('boc-tbody');
        TC.el('boc-count').textContent = list.length + ' bulletin(s)';
        if (!list.length) {
            tbody.innerHTML = TC.rowsEmpty(5, 'Aucun bulletin déposé',
                'Déposez le PDF de la séance pour constituer l\'archive de référence.');
            return;
        }
        tbody.innerHTML = list.map(b =>
            '<tr class="' + (b.__cotations ? '' : 'row-warn') + '">' +
            '<td class="td-mono">' + TC.fmtDate(b.date_seance) + '</td>' +
            '<td class="td-muted">' + TC.esc(b.numero_seance || '—') + '</td>' +
            '<td>' + TC.esc(b.fichier_nom || '—') + '</td>' +
            '<td>' + (b.__cotations
                ? '<span class="badge badge-green">' + b.__cotations + ' cotations</span>'
                : '<span class="badge badge-orange">aucune cotation</span>') + '</td>' +
            '<td class="r" style="white-space:nowrap;">' +
            (b.pdf_url || b.fichier_url
                ? '<a class="btn btn-outline btn-sm" href="' + TC.esc(b.pdf_url || b.fichier_url) + '" target="_blank" rel="noopener">Ouvrir</a> '
                : '') +
            '<button class="btn btn-danger btn-ico" data-del="' + TC.esc(b.id || '') + '">✕</button></td></tr>'
        ).join('');
    }

    async function upload() {
        const input = TC.el('boc-file');
        const file = input.files && input.files[0];
        if (!file) { TC.say('boc-msg', 'Choisissez un fichier PDF.', 'err'); return; }
        if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
            TC.say('boc-msg', 'Le bulletin doit être au format PDF.', 'err'); return;
        }
        if (file.size > 50 * 1024 * 1024) { TC.say('boc-msg', 'Fichier trop volumineux : 50 Mo maximum.', 'err'); return; }

        let date = TC.val('boc-date') || dateFromName(file.name);
        if (!date) { TC.say('boc-msg', 'Indiquez la date de séance du bulletin.', 'err'); return; }
        if (date > TC.today()) { TC.say('boc-msg', 'Un bulletin ne peut pas être daté dans le futur.', 'err'); return; }
        TC.setVal('boc-date', date);

        const bar = TC.el('boc-bar');
        const fill = TC.qs('i', bar);
        bar.hidden = false;
        const button = TC.el('boc-upload');
        button.disabled = true;

        try {
            TC.say('boc-msg', 'Préparation du dépôt…', 'info');
            fill.style.width = '15%';
            const prep = await TC.api('/api/boc-upload', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'prepare', filename: file.name, date_seance: date })
            });

            TC.say('boc-msg', 'Téléversement du document…', 'info');
            fill.style.width = '45%';
            const target = signedTarget(prep);
            /* Le jeton est signé côté serveur avec upsert:false. L'en-tête
               envoyé ici doit correspondre au jeton, sinon le stockage rejette
               le téléversement. Le chemin porte un horodatage, il est donc
               toujours unique : l'écrasement n'a de toute façon pas lieu d'être. */
            console.log('[BOC] téléversement vers', target.split('?')[0]);
            const put = await fetch(target, {
                method: 'PUT', headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'false' }, body: file
            });
            if (!put.ok) throw new Error(await storageError(put, target));

            TC.say('boc-msg', 'Enregistrement de la référence…', 'info');
            fill.style.width = '80%';
            await TC.api('/api/boc-upload', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'finalize', filename: file.name, date_seance: date, path: prep.path })
            });

            fill.style.width = '100%';
            TC.say('boc-msg', 'Bulletin du ' + TC.fmtDate(date) + ' enregistré.', 'ok');
            TC.toast('Bulletin déposé', 'ok');
            input.value = '';
            await load();
        } catch (e) {
            TC.say('boc-msg', e.message, 'err');
        } finally {
            button.disabled = false;
            setTimeout(() => { bar.hidden = true; fill.style.width = '0%'; }, 1600);
        }
    }

    TC.register({
        id: 'boc',
        label: 'Bulletins (BOC)',
        group: 'marche',
        icon: '❑',
        keywords: 'boc bulletin officiel cote pdf archive',
        view,
        refresh: load,
        mount() {
            TC.on('boc-upload', 'click', upload);
            TC.on('boc-reload', 'click', load);
            TC.on('boc-file', 'change', function (e) {
                const file = e.target.files && e.target.files[0];
                if (file && !TC.val('boc-date')) {
                    const guess = dateFromName(file.name);
                    if (guess) { TC.setVal('boc-date', guess); TC.say('boc-msg', 'Date déduite du nom du fichier : ' + TC.fmtDate(guess), 'info'); }
                }
            });
            TC.on('boc-filter', 'input', function (e) {
                const q = e.target.value.trim();
                paint(q ? bulletins.filter(b => String(b.date_seance || '').indexOf(q) !== -1 ||
                    String(b.fichier_nom || '').toLowerCase().indexOf(q.toLowerCase()) !== -1) : bulletins);
            });
            TC.delegate('boc-tbody', '[data-del]', 'click', async function (node) {
                const id = node.dataset.del;
                if (!id) { TC.toast('Ce bulletin n\'a pas d\'identifiant exploitable.', 'err'); return; }
                if (!TC.confirmTwice('Supprimer ce bulletin de l\'archive ?',
                    'la référence disparaît de la base ; le fichier reste dans le stockage Supabase')) return;
                try { await TC.del('boc', 'id=eq.' + encodeURIComponent(id)); TC.toast('Bulletin supprimé', 'ok'); load(); }
                catch (e) { TC.toast(e.message, 'err'); }
            });
            load();
        }
    });

})(window.TC);
