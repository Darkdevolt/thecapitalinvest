/* ══════════════════════════════════════════════════════
   SCRAPER
══════════════════════════════════════════════════════ */
function appendScraperLog(text, type) {
    var log = document.getElementById('scraper-log');
    if (!log) return;
    var d = document.createElement('div');
    d.className = type || 'info';
    d.textContent = new Date().toLocaleTimeString('fr-FR') + ' — ' + text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
}

async function runScraper() {
    const msg = document.getElementById('scraper-msg');
    if(msg){ msg.textContent = 'Scraper en cours...'; msg.className = 'msg info'; }
    appendScraperLog('Lancement du scraper BRVM...', 'info');
    try {
        const ctrl = new AbortController();
        const t = setTimeout(function() { ctrl.abort(); }, 30000);
        const r = await fetch(SB_URL + '/functions/v1/scrape-brvm', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json' },
            signal: ctrl.signal
        });
        clearTimeout(t);
        const data = await r.json().catch(function() { return {}; });
        if (r.ok) {
            appendScraperLog('✓ Scraper terminé : ' + JSON.stringify(data), 'ok');
            if(msg){ msg.textContent = '✓ Terminé'; msg.className = 'msg ok'; }
            toast('Scraper terminé', 'ok');
        } else {
            appendScraperLog('Erreur scraper : ' + (data && data.message || r.status), 'err');
            if(msg){ msg.textContent = 'Erreur : vérifiez l\'Edge Function'; msg.className = 'msg err'; }
        }
    } catch(e) {
        appendScraperLog('Erreur réseau : ' + e.message, 'err');
        if(msg){ msg.textContent = e.name === 'AbortError' ? 'Timeout — Edge Function trop lente' : e.message; msg.className = 'msg err'; }
    }
}

async function runFallback() {
    const msg = document.getElementById('scraper-msg');
    if(msg){ msg.textContent = 'Recalcul en cours...'; msg.className = 'msg info'; }
    appendScraperLog('Recalcul des variations...', 'info');
    await recalcVariations();
    if(msg){ msg.textContent = '✓ Variations recalculées'; msg.className = 'msg ok'; }
    appendScraperLog('✓ Variations recalculées', 'ok');
}

async function syncHistFromCours() {
    const msg = document.getElementById('scraper-msg');
    if(msg){ msg.textContent = 'Sync en cours...'; msg.className = 'msg info'; }
    const rows = await sbGet('cours', 'select=*&order=date_seance.desc&limit=50');
    if (!rows || !rows.length) { if(msg){ msg.textContent = 'Aucun cours à synchroniser'; msg.className = 'msg err'; } return; }
    const mapped = rows.map(function(r){
        return { ticker: r.ticker, date_seance: r.date_seance, cours_cloture: r.cours, variation: r.variation };
    });
    const res = await sbPost('historique', mapped, 'ticker,date_seance');
    if (res) {
        const txt = '✓ ' + mapped.length + ' cours synchronisés vers historique';
        if(msg){ msg.textContent = txt; msg.className = 'msg ok'; }
        appendScraperLog(txt, 'ok');
        toast(txt, 'ok');
    }
}

async function recalcVariations() {
    const rows = await sbGet('cours', 'select=*&order=ticker.asc,date_seance.asc');
    if (!rows || !rows.length) { toast("Aucun cours trouvé", "err"); return; }
    
    let updates = [];
    let byTicker = {};
    rows.forEach(function(r) {
        if (!byTicker[r.ticker]) byTicker[r.ticker] = [];
        byTicker[r.ticker].push(r);
    });
    
    for (var ticker in byTicker) {
        var list = byTicker[ticker].sort(function(a,b) { return new Date(a.date_seance) - new Date(b.date_seance); });
        for (var i = 1; i < list.length; i++) {
            var prev = list[i-1], cur = list[i];
            if (prev.cours && cur.cours && prev.cours > 0) {
                var varPct = parseFloat(((cur.cours - prev.cours) / prev.cours * 100).toFixed(2));
                updates.push({ id: cur.id, variation: varPct });
            }
        }
    }
    
    var updated = 0;
    for (var i = 0; i < updates.length; i += 50) {
        var batch = updates.slice(i, i + 50);
        for (var j = 0; j < batch.length; j++) {
            await sbPatch('cours', 'id=eq.' + batch[j].id, { variation: batch[j].variation });
            updated++;
        }
        if (i + 50 < updates.length) await new Promise(function(resolve) { setTimeout(resolve, 100); });
    }
    
    toast(updated + ' variations mises à jour', 'ok');
    loadCours();
}

/* ══════════════════════════════════════════════════════
   BOC
══════════════════════════════════════════════════════ */
async function importBOC() {
    var date = v('boc-date'), nom = v('boc-nom')||null, urlManuelle = v('boc-url')||null;
    var fileInput = document.getElementById('boc-file'), file = fileInput ? fileInput.files[0] : null;
    var msg = document.getElementById('boc-msg');
    if (!date) { if(msg){ msg.textContent = 'Date obligatoire'; msg.className = 'msg err'; } return; }
    if (!file && !urlManuelle) { if(msg){ msg.textContent = 'Fichier ou URL requis'; msg.className = 'msg err'; } return; }
    var fichierUrl = urlManuelle;
    if (file) {
        if (file.type !== 'application/pdf') { if(msg){ msg.textContent = 'PDF uniquement'; msg.className = 'msg err'; } return; }
        var fileName = 'boc-' + Date.now() + '-' + file.name;
        var formData = new FormData(); formData.append('file', file);
        var uploadRes = await fetch(SB_URL + '/storage/v1/object/boc_pdfs/' + fileName, {
            method:'POST', headers:{ apikey:SB_ANON, Authorization:'Bearer ' + TK }, body:formData
        });
        if (!uploadRes.ok) { if(msg){ msg.textContent = 'Échec upload'; msg.className = 'msg err'; } return; }
        fichierUrl = SB_URL + '/storage/v1/object/public/boc_pdfs/' + fileName;
    }
    var body = { date_seance:date, fichier_nom: nom||(file?file.name:'boc.pdf'), fichier_url:fichierUrl };
    var r = await sbPost('boc', body, 'date_seance');
    if (r) { if(msg){ msg.textContent = '✓ BOC enregistré'; msg.className = 'msg ok'; } loadBOC(); }
}

async function loadBOC() {
    var list = await sbGet('boc', 'select=*&order=date_seance.desc&limit=20') || [];
    const bocList = document.getElementById('boc-list');
    if(!bocList) return;
    bocList.innerHTML = list.length
        ? '<div class="tw"><table><thead><tr><th>Date</th><th>Nom</th><th>URL</th><th></th></tr></thead><tbody>' +
          list.map(function(b){
              return '<tr><td>' + b.date_seance + '</td><td>' + b.fichier_nom + '</td>' +
                     '<td><a href="' + b.fichier_url + '" target="_blank" style="color:var(--gold);">Voir</a></td>' +
          '<td><button class="btn btn-danger btn-sm" data-id="' + b.id + '" onclick="handleDeleteBoc(this)">✕</button></td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<div style="padding:16px;color:var(--muted);">Aucun BOC.</div>';
}

async function deleteBocRow(id) {
    if (!doubleConfirm('Supprimer ce BOC ?')) return;
    const ok = await sbDel('boc', 'id=eq.' + id);
    if (ok) loadBOC();
}
