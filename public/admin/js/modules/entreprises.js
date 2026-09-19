/* ============================================================
   THE CAPITAL — RÉFÉRENTIEL DES SOCIÉTÉS
   Tout part d'ici : une cotation, un état financier ou un
   dividende dont le ticker n'existe pas dans cette table est
   rejeté par la clé étrangère, sans message compréhensible.
   La colonne « Complétude » signale ce qui manque à chaque fiche
   pour que l'application publique l'affiche correctement.

   IMPORTANT : l'ISIN n'est pas un champ requis pour une action.
   Les identifiants ISIN sont gérés dans le référentiel obligataire.
   ============================================================ */
'use strict';

(function (TC) {

    let rows = [];
    const sel = TC.selection('ent');

    const FORM = [
        { id: 'e-ticker', label: 'Ticker', placeholder: 'SNTS', upper: true },
        { id: 'e-nom', label: 'Dénomination', placeholder: 'Sonatel SA' },
        { id: 'e-secteur', label: 'Secteur', placeholder: 'Télécommunications' },
        { id: 'e-pays', label: 'Pays', type: 'select', options: [{ v: '', l: '— Choisir —' }].concat(TC.PAYS_UEMOA.map(p => ({ v: p, l: p }))) },
        { id: 'e-compart', label: 'Compartiment', type: 'select', options: [{ v: 'PRINCIPAL', l: 'Principal' }, { v: 'PRESTIGE', l: 'Prestige' }] },
        { id: 'e-actions', label: 'Nombre d\'actions', type: 'number', step: '1', col: 'nombre_actions', hint: 'Indispensable au calcul de la capitalisation et du bénéfice par action.' },
        { id: 'e-nominal', label: 'Valeur nominale', type: 'number' },
        { id: 'e-site', label: 'Site internet', placeholder: 'https://…' },
        { id: 'e-siege', label: 'Siège social', placeholder: 'Dakar, Sénégal' },
        { id: 'e-intro', label: 'Date d\'introduction', type: 'date' },
        { id: 'e-desc', label: 'Description', type: 'textarea', wide: true, rows: 3, placeholder: 'Activité, positionnement, faits marquants…' }
    ];

    /* ── Logos ───────────────────────────────────────────────
       Envoyés directement au bucket public « logos-societes » avec la session
       de l'administrateur : la politique du bucket réserve l'écriture aux
       administrateurs. Chaque envoi reçoit un nom neuf pour qu'un logo remplacé
       ne reste pas en cache chez les visiteurs. */
    const LOGO_BUCKET = 'logos-societes';
    const LOGO_MAX = 1024 * 1024;
    const LOGO_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

    function storageBase() { return String(TC.env.SUPABASE_URL || '').replace(/\/+$/, '') + '/storage/v1'; }

    async function storageHeaders(extra) {
        await TC.ensureToken();
        return Object.assign({ apikey: TC.env.SUPABASE_ANON, Authorization: 'Bearer ' + TC.session.token }, extra || {});
    }

    function logoPath(url) {
        const marker = '/' + LOGO_BUCKET + '/';
        const at = String(url || '').indexOf(marker);
        return at === -1 ? '' : String(url).slice(at + marker.length);
    }

    async function uploadLogo(ticker, file) {
        const path = ticker + '/' + Date.now() + '.' + LOGO_TYPES[file.type];
        const r = await fetch(storageBase() + '/object/' + LOGO_BUCKET + '/' + path, {
            method: 'POST',
            headers: await storageHeaders({ 'Content-Type': file.type, 'Cache-Control': 'max-age=31536000' }),
            body: file
        });
        if (!r.ok) {
            let detail = '';
            try { const j = await r.json(); detail = j.message || j.error || ''; } catch (e) { /* corps vide */ }
            if (r.status === 401 || r.status === 403) {
                throw new Error('Envoi refusé : seuls les administrateurs peuvent déposer un logo. Reconnectez-vous puis réessayez.');
            }
            if (r.status === 404) throw new Error('Le bucket « ' + LOGO_BUCKET + ' » est introuvable dans Supabase.');
            throw new Error('Envoi du logo impossible (HTTP ' + r.status + ')' + (detail ? ' : ' + detail : '.'));
        }
        return storageBase() + '/object/public/' + LOGO_BUCKET + '/' + path;
    }

    /** Suppression au mieux : un ancien fichier orphelin ne doit pas bloquer l'enregistrement. */
    async function deleteLogo(url) {
        const path = logoPath(url);
        if (!path) return;
        try {
            await fetch(storageBase() + '/object/' + LOGO_BUCKET + '/' + path, { method: 'DELETE', headers: await storageHeaders() });
        } catch (e) { /* fichier orphelin toléré */ }
    }

    function logoField() {
        return '<div class="field wide" id="e-logo-box">' +
            '<label for="e-logo-file">Logo <span class="col">→ logo_url</span></label>' +
            '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">' +
            '<div id="e-logo-prev" style="width:84px;height:84px;flex:none;display:flex;align-items:center;justify-content:center;' +
            'background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden;color:#8a8f98;font-size:11px;text-align:center;">Aucun logo</div>' +
            '<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-start;">' +
            '<input type="file" id="e-logo-file" accept="image/png,image/jpeg,image/webp,image/svg+xml">' +
            '<button type="button" class="btn btn-outline btn-sm" id="e-logo-clear" style="display:none;">Retirer le logo</button></div></div>' +
            '<div class="hint">PNG, JPG, WebP ou SVG · 1 Mo maximum · de préférence carré, sur fond transparent. ' +
            'Le logo s\'affiche à côté du ticker dans toute l\'application.</div></div>';
    }

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">Sociétés <em>cotées</em></div>' +
            '<div class="page-sub">Référentiel de la place. Chaque ticker utilisé ailleurs dans l\'administration doit exister ici : c\'est la clé étrangère de toutes les autres tables.</div></div>' +
            '<div class="page-actions">' +
            '<button class="btn btn-primary btn-sm" id="ent-new">+ Nouvelle société</button>' +
            '<button class="btn btn-outline btn-sm" id="ent-export">⬇ CSV</button></div></div>' +

            '<div class="kpis" id="ent-kpis"></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Référentiel</span>' +
            '<span class="card-tools">' +
            '<input type="search" id="ent-search" placeholder="Ticker, nom, secteur…" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;width:180px;">' +
            '<select id="ent-scope" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;">' +
            '<option value="">Toutes les fiches</option><option value="incomplet">Fiches incomplètes</option>' +
            '<option value="PRESTIGE">Compartiment Prestige</option><option value="PRINCIPAL">Compartiment Principal</option></select>' +
            '<span class="card-count" id="ent-count"></span>' +
            '<button class="btn btn-outline btn-sm" id="ent-reload">↺</button></span></div>' +
            '<div class="bulkbar" id="bulk-ent"><span class="bulk-count">0 fiche(s)</span>' +
            '<button class="btn btn-danger btn-sm" id="ent-bulk-del">Supprimer la sélection</button>' +
            '<button class="btn btn-outline btn-sm" id="ent-bulk-reset">Tout désélectionner</button></div>' +
            '<div class="tw capped" id="bulk-ent-scope"><table><thead><tr>' +
            '<th><input type="checkbox" class="rowcheck" id="ent-all"></th>' +
            '<th>Logo</th><th>Ticker</th><th>Dénomination</th><th>Secteur</th><th>Pays</th><th>Compartiment</th>' +
            '<th class="r">Nb actions</th><th>Complétude</th><th></th>' +
            '</tr></thead><tbody id="ent-tbody">' + TC.rowsLoading(11) + '</tbody></table></div></div>';
    }

    function missingOf(r) {
        const gaps = [];
        if (!r.nom) gaps.push('dénomination');
        if (!r.secteur) gaps.push('secteur');
        if (!r.pays) gaps.push('pays');
        if (!TC.toNumber(r.nombre_actions || r.nb_actions)) gaps.push('nombre d\'actions');
        if (!r.compartiment) gaps.push('compartiment');
        return gaps;
    }

    async function load() {
        TC.el('ent-tbody').innerHTML = TC.rowsLoading(11);
        const data = await TC.get('entreprises', 'select=*&order=ticker.asc&limit=1000');
        rows = (data || []).filter(r => r && r.ticker && !TC.isIndice(r.ticker));
        rows.forEach(r => { r.__missing = missingOf(r); });
        TC.invalidateTickers();
        paintKpis();
        paint(rows);
    }

    function paintKpis() {
        const complete = rows.filter(r => !r.__missing.length).length;
        const prestige = rows.filter(r => String(r.compartiment).toUpperCase() === 'PRESTIGE').length;
        const countries = new Set(rows.map(r => r.pays).filter(Boolean)).size;
        const sectors = new Set(rows.map(r => r.secteur).filter(Boolean)).size;
        TC.el('ent-kpis').innerHTML =
            kpi('Sociétés', rows.length) +
            kpi('Fiches complètes', complete + ' / ' + rows.length, complete === rows.length ? '' : 'orange') +
            kpi('Logos déposés', rows.filter(r => r.logo_url).length + ' / ' + rows.length) +
            kpi('Compartiment Prestige', prestige) +
            kpi('Pays représentés', countries) +
            kpi('Secteurs', sectors);
    }

    function kpi(label, value, tone) {
        return '<div class="kpi"><div class="kpi-label">' + TC.esc(label) + '</div>' +
            '<div class="kpi-value sm"' + (tone ? ' style="color:var(--' + tone + ')"' : '') + '>' + TC.esc(String(value)) + '</div></div>';
    }

    function paint(list) {
        const tbody = TC.el('ent-tbody');
        TC.el('ent-count').textContent = list.length + ' fiche(s)';
        if (!list.length) {
            tbody.innerHTML = TC.rowsEmpty(11, 'Aucune société',
                'Créez les sociétés cotées avant tout import de cours ou d\'états financiers.');
            return;
        }
        sel.reset();
        tbody.innerHTML = list.map(function (r) {
            const gaps = r.__missing;
            const actions = TC.toNumber(r.nombre_actions || r.nb_actions);
            return '<tr class="' + (gaps.length >= 3 ? 'row-flag' : gaps.length ? 'row-warn' : '') + '">' +
                '<td><input type="checkbox" class="rowcheck" data-id="' + TC.esc(r.ticker) + '"></td>' +
                '<td><span data-edit="' + TC.esc(r.ticker) + '" title="' + (r.logo_url ? 'Changer le logo' : 'Ajouter un logo') + '" ' +
                'style="cursor:pointer;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border-radius:7px;' +
                (r.logo_url ? 'background:#fff;' : 'border:1px dashed var(--border);color:var(--muted);font-size:14px;') + '">' +
                (r.logo_url
                    ? '<img src="' + TC.esc(r.logo_url) + '" alt="" loading="lazy" style="width:26px;height:26px;object-fit:contain;">'
                    : '+') + '</span></td>' +
                '<td class="td-key">' + TC.esc(r.ticker) + '</td>' +
                '<td>' + TC.esc(r.nom || '—') + '</td>' +
                '<td class="td-muted">' + TC.esc(r.secteur || '—') + '</td>' +
                '<td class="td-muted">' + TC.esc(r.pays || '—') + '</td>' +
                '<td><span class="badge ' + (String(r.compartiment).toUpperCase() === 'PRESTIGE' ? 'badge-gold' : 'badge-blue') + '">' +
                TC.esc(r.compartiment || '—') + '</span></td>' +
                '<td class="r td-mono' + (actions ? '' : ' down') + '">' + (actions ? TC.fmtInt(actions) : 'absent') + '</td>' +
                '<td>' + (gaps.length
                    ? '<span class="badge badge-orange" title="' + TC.esc(gaps.join(' · ')) + '">' + gaps.length + ' manque(s)</span>'
                    : '<span class="badge badge-green">complète</span>') + '</td>' +
                '<td class="r" style="white-space:nowrap;">' +
                '<button class="btn btn-outline btn-ico" data-edit="' + TC.esc(r.ticker) + '">✎</button> ' +
                '<button class="btn btn-danger btn-ico" data-del="' + TC.esc(r.ticker) + '">✕</button></td></tr>';
        }).join('');
    }

    function filter() {
        const q = TC.val('ent-search').toLowerCase();
        const scope = TC.val('ent-scope');
        paint(rows.filter(function (r) {
            const haystack = (r.ticker + ' ' + (r.nom || '') + ' ' + (r.secteur || '') + ' ' + (r.pays || '')).toLowerCase();
            if (q && haystack.indexOf(q) === -1) return false;
            if (scope === 'incomplet') return r.__missing.length > 0;
            if (scope) return String(r.compartiment).toUpperCase() === scope;
            return true;
        }));
    }

    /**
     * Gère le choix du logo dans la fiche. Rien n'est envoyé avant
     * « Enregistrer » : le ticker d'une nouvelle société n'existe pas encore
     * et l'annulation de la fenêtre ne doit laisser aucun fichier orphelin.
     */
    function wireLogo(existing) {
        const state = { file: null, remove: false, preview: '' };
        const box = TC.el('e-logo-prev'), clear = TC.el('e-logo-clear'), input = TC.el('e-logo-file');
        const current = existing && existing.logo_url ? existing.logo_url : '';

        function paintPreview() {
            const src = state.file ? state.preview : (state.remove ? '' : current);
            box.innerHTML = src
                ? '<img src="' + TC.esc(src) + '" alt="" style="max-width:100%;max-height:100%;object-fit:contain;padding:6px;box-sizing:border-box;">'
                : 'Aucun logo';
            clear.style.display = src ? '' : 'none';
        }

        input.addEventListener('change', function () {
            const file = input.files && input.files[0];
            if (!file) return;
            if (!LOGO_TYPES[file.type]) {
                input.value = '';
                TC.modal.msg('Format non accepté : utilisez un PNG, JPG, WebP ou SVG.', 'err'); return;
            }
            if (file.size > LOGO_MAX) {
                input.value = '';
                TC.modal.msg('Logo trop lourd (' + (file.size / 1048576).toFixed(1) + ' Mo) : 1 Mo maximum.', 'err'); return;
            }
            TC.modal.msg('', '');
            if (state.preview) URL.revokeObjectURL(state.preview);
            state.file = file; state.remove = false; state.preview = URL.createObjectURL(file);
            paintPreview();
        });
        clear.addEventListener('click', function () {
            if (state.preview) URL.revokeObjectURL(state.preview);
            state.file = null; state.preview = ''; state.remove = true; input.value = '';
            paintPreview();
        });
        paintPreview();
        return state;
    }

    function openForm(existing) {
        const isNew = !existing;
        let logo = { file: null, remove: false };
        TC.modal.open({
            title: isNew ? 'Nouvelle société cotée' : 'Fiche ' + existing.ticker,
            subtitle: isNew
                ? 'Le ticker devient la clé de référence de toutes les autres tables. Il ne pourra plus être modifié ensuite.'
                : (existing.__missing.length ? 'Manque : ' + existing.__missing.join(', ') : 'Fiche complète'),
            saveLabel: isNew ? 'Créer la société' : 'Enregistrer',
            body: '<div class="form-grid">' + TC.fields(FORM.map(f =>
                (!isNew && f.id === 'e-ticker') ? Object.assign({}, f, { readonly: true }) : f)) + logoField() + '</div>',
            afterOpen() {
                logo = wireLogo(existing);
                if (isNew) { TC.setVal('e-compart', 'PRINCIPAL'); return; }
                TC.setVal('e-ticker', existing.ticker);
                TC.setVal('e-nom', existing.nom);
                TC.setVal('e-secteur', existing.secteur);
                TC.setVal('e-pays', existing.pays);
                TC.setVal('e-compart', String(existing.compartiment || 'PRINCIPAL').toUpperCase());
                TC.setVal('e-actions', existing.nombre_actions || existing.nb_actions);
                TC.setVal('e-nominal', existing.valeur_nominale);
                TC.setVal('e-site', existing.site_web);
                TC.setVal('e-siege', existing.siege_social);
                TC.setVal('e-intro', existing.date_introduction ? String(existing.date_introduction).slice(0, 10) : '');
                TC.setVal('e-desc', existing.description);
            },
            async onSave() {
                const ticker = TC.val('e-ticker').toUpperCase();
                const nom = TC.val('e-nom');
                if (!ticker || !nom) { TC.modal.msg('Le ticker et la dénomination sont obligatoires.', 'err'); return; }
                if (!/^[A-Z0-9.\-]{2,20}$/.test(ticker)) {
                    TC.modal.msg('Ticker invalide : 2 à 20 caractères, lettres, chiffres, point ou tiret.', 'err'); return;
                }
                const actions = TC.int('e-actions');
                if (actions !== null && actions <= 0) { TC.modal.msg('Le nombre d\'actions doit être strictement positif.', 'err'); return; }

                const body = {
                    ticker, nom,
                    secteur: TC.val('e-secteur') || null,
                    pays: TC.val('e-pays') || null,
                    compartiment: TC.val('e-compart'),
                    nombre_actions: actions, nb_actions: actions,
                    valeur_nominale: TC.num('e-nominal'),
                    site_web: TC.val('e-site') || null,
                    siege_social: TC.val('e-siege') || null,
                    date_introduction: TC.val('e-intro') || null,
                    description: TC.val('e-desc') || null,
                    actif: true
                };

                const previous = existing && existing.logo_url ? existing.logo_url : '';
                let uploaded = '';
                TC.modal.busy(true);
                try {
                    if (logo.file) { uploaded = await uploadLogo(ticker, logo.file); body.logo_url = uploaded; }
                    else if (logo.remove) body.logo_url = null;

                    if (isNew) await TC.post('entreprises', body, 'ticker');
                    else await TC.patch('entreprises', 'ticker=eq.' + encodeURIComponent(ticker), body);

                    if (previous && (uploaded || logo.remove)) deleteLogo(previous);
                    TC.modal.close();
                    TC.toast(isNew ? 'Société ' + ticker + ' créée' : 'Fiche ' + ticker + ' mise à jour', 'ok');
                    load();
                } catch (e) {
                    if (uploaded) deleteLogo(uploaded);
                    TC.modal.msg(e.message, 'err');
                } finally { TC.modal.busy(false); }
            }
        });
    }

    async function remove(ticker) {
        const [hist, fin, div] = await Promise.all([
            TC.count('historique', 'ticker=eq.' + encodeURIComponent(ticker)),
            TC.count('financials', 'ticker=eq.' + encodeURIComponent(ticker)),
            TC.count('dividendes_calendrier', 'ticker=eq.' + encodeURIComponent(ticker))
        ]);
        const attached = hist.value + fin.value + div.value;
        const detail = attached
            ? 'Cette société porte ' + hist.value + ' cotation(s), ' + fin.value + ' état(s) financier(s) et ' +
            div.value + ' dividende(s). Supabase refusera la suppression tant que ces lignes existent.'
            : 'Aucune donnée rattachée.';
        if (!TC.confirmTwice('Supprimer la société ' + ticker + ' ?\n\n' + detail, 'la fiche disparaîtra du référentiel')) return;
        try {
            await TC.del('entreprises', 'ticker=eq.' + encodeURIComponent(ticker));
            TC.toast('Société ' + ticker + ' supprimée', 'ok');
            load();
        } catch (e) { TC.toast(e.message, 'err'); }
    }

    TC.register({
        id: 'entreprises',
        label: 'Sociétés cotées',
        group: 'societes',
        icon: '⌂',
        keywords: 'entreprise societe referentiel ticker secteur',
        view,
        refresh: load,
        mount() {
            TC.on('ent-new', 'click', () => openForm(null));
            TC.on('ent-reload', 'click', load);
            TC.on('ent-search', 'input', filter);
            TC.on('ent-scope', 'change', filter);
            TC.on('ent-all', 'change', e => sel.all(rows.map(r => r.ticker), e.target.checked));
            TC.on('ent-bulk-reset', 'click', () => sel.reset());
            TC.on('ent-bulk-del', 'click', async function () {
                const ids = sel.ids();
                if (!ids.length) return;
                if (!TC.confirmTwice('Supprimer ' + ids.length + ' société(s) du référentiel ?',
                    'toute société portant des cotations sera refusée par Supabase')) return;
                let done = 0, refused = 0;
                for (const t of ids) {
                    try { await TC.del('entreprises', 'ticker=eq.' + encodeURIComponent(t)); done++; }
                    catch (e) { refused++; }
                }
                TC.toast(done + ' supprimée(s)' + (refused ? ', ' + refused + ' refusée(s) — données rattachées' : ''),
                    refused ? 'warn' : 'ok');
                load();
            });
            TC.on('ent-export', 'click', function () {
                if (!rows.length) return;
                TC.download('referentiel-societes-' + TC.today() + '.csv',
                    TC.toCSV(rows, ['ticker', 'nom', 'secteur', 'pays', 'compartiment', 'nombre_actions', 'site_web', 'siege_social']),
                    'text/csv;charset=utf-8');
            });
            TC.delegate('ent-tbody', '.rowcheck', 'change', n => sel.toggle(n.dataset.id, n.checked));
            TC.delegate('ent-tbody', '[data-edit]', 'click', n => {
                const row = rows.find(r => r.ticker === n.dataset.edit);
                if (row) openForm(row);
            });
            TC.delegate('ent-tbody', '[data-del]', 'click', n => remove(n.dataset.del));
            load();
        }
    });

})(window.TC);
