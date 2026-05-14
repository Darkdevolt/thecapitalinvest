/* ══════════════════════════════════════════════════════
   HISTORIQUE.JS — Diagnostic + Auto-réparation
══════════════════════════════════════════════════════ */
(function(){
'use strict';

const LOG = (m, e) => { console.log('[HIST] '+m); if(e) console.error(e); };
LOG('Fichier chargé');

// ══════════════════════════════════════════════════════
// 0. DIAGNOSTIC VISUEL (injecté en haut de body si besoin)
// ══════════════════════════════════════════════════════
function showDiag(msg, type='warn'){
    let box = document.getElementById('hist-diag-box');
    if(!box){
        box = document.createElement('div');
        box.id = 'hist-diag-box';
        box.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;padding:10px;font-family:monospace;font-size:13px;text-align:center;';
        document.body.prepend(box);
    }
    const color = type==='err' ? '#721c24;background:#f8d7da' : type==='ok' ? '#155724;background:#d4edda' : '#856404;background:#fff3cd';
    box.innerHTML += '<div style="color:'+color.split(';')[0].split(':')[1]+';background:'+color.split(';')[1].split(':')[1]+';padding:6px;margin-bottom:2px;border:1px solid currentColor;">'+msg+'</div>';
}

// ══════════════════════════════════════════════════════
// 1. VÉRIFICATION DÉPENDANCES
// ══════════════════════════════════════════════════════
if(typeof sbGet !== 'function'){ showDiag('ERREUR: sbGet manquant. api.js doit être chargé AVANT historique.js','err'); }
if(typeof sbPost !== 'function'){ showDiag('ERREUR: sbPost manquant. api.js doit être chargé AVANT historique.js','err'); }
if(typeof sbDel !== 'function'){ showDiag('ERREUR: sbDel manquant. api.js doit être chargé AVANT historique.js','err'); }

// ══════════════════════════════════════════════════════
// 2. FALLBACKS
// ══════════════════════════════════════════════════════
const _fmt    = (typeof fmt === 'function')    ? fmt    : v => (v==null||v==='')?'—':String(v);
const _fmtPct = (typeof fmtPct === 'function')  ? fmtPct : v => (v==null||v==='')?'—':String(v)+'%';
const _clrPct = (typeof clrPct === 'function')  ? clrPct : () => 'inherit';
const _toast  = (typeof toast === 'function')   ? toast  : m => { showDiag(m,'ok'); };
const _confirm= (typeof doubleConfirm==='function') ? doubleConfirm : m => confirm(m);

const $ = id => document.getElementById(id);
const _v = id => { const el=$(id); return el?el.value:''; };
const _set = (id,val) => { const el=$(id); if(el) el.value=val; };

function escapeHtml(t){ if(t==null)return''; return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

if(typeof window.histData === 'undefined') window.histData = [];

// ══════════════════════════════════════════════════════
// 3. FONCTIONS MÉTIER
// ══════════════════════════════════════════════════════

async function addHistorique(){
    const msg = $('h-msg');
    const body = {
        ticker: (_v('h-ticker')||'').toUpperCase().trim(),
        date_seance: _v('h-date'),
        cours_cloture: parseFloat(_v('h-cloture')),
        ouverture: parseFloat(_v('h-ouverture'))||null,
        plus_haut: parseFloat(_v('h-haut'))||null,
        plus_bas: parseFloat(_v('h-bas'))||null,
        volume: parseInt(_v('h-vol'),10)||null,
        variation: parseFloat(_v('h-var'))||null
    };
    if(!body.ticker || !body.date_seance || isNaN(body.cours_cloture)){
        if(msg){ msg.textContent='Champs obligatoires manquants'; msg.className='msg err'; }
        return;
    }
    try{
        const r = await sbPost('historique', body, 'ticker,date_seance');
        if(r){ if(msg){ msg.textContent='✓ Enregistré'; msg.className='msg ok'; } if(typeof clearForm==='function') clearForm(['h-ticker','h-date','h-cloture','h-ouverture','h-haut','h-bas','h-vol','h-var']); }
        else { if(msg){ msg.textContent='Échec enregistrement'; msg.className='msg err'; } }
    }catch(e){ LOG('addHistorique erreur',e); if(msg){ msg.textContent='Erreur réseau'; msg.className='msg err'; } }
}

async function importBulk(){
    const raw = _v('bulk-csv'), msg = $('bulk-msg');
    if(!raw){ if(msg){ msg.textContent='CSV vide'; msg.className='msg err'; } return; }
    const lines = raw.split('\n').filter(l=>l.trim());
    const rows=[];
    for(const line of lines){
        const p=line.split(',');
        if(!p[0]||!p[1]) continue;
        rows.push({ ticker:p[0].trim().toUpperCase(), date_seance:p[1].trim(), cours_cloture:parseFloat(p[2]), ouverture:parseFloat(p[3])||null, plus_haut:parseFloat(p[4])||null, plus_bas:parseFloat(p[5])||null, volume:parseInt(p[6],10)||null, variation:parseFloat(p[7])||null });
    }
    if(!rows.length){ if(msg){ msg.textContent='Aucune ligne valide'; msg.className='msg err'; } return; }
    try{
        const r = await sbPost('historique', rows, 'ticker,date_seance');
        if(r){ if(msg){ msg.textContent='✓ '+rows.length+' lignes importées'; msg.className='msg ok'; } _set('bulk-csv',''); const pr=$('bulk-preview'); if(pr) pr.style.display='none'; }
        else { if(msg){ msg.textContent='Échec import'; msg.className='msg err'; } }
    }catch(e){ LOG('importBulk erreur',e); if(msg){ msg.textContent='Erreur réseau'; msg.className='msg err'; } }
}

function parseBulkPreview(){
    const raw=_v('bulk-csv'), msg=$('bulk-msg'), preview=$('bulk-preview'), tbody=$('bulk-preview-tbody');
    if(!raw){ if(msg){ msg.textContent='CSV vide'; msg.className='msg err'; } if(preview) preview.style.display='none'; return; }
    const lines=raw.split('\n').filter(l=>l.trim());
    if(tbody){
        tbody.innerHTML=lines.slice(0,20).map(line=>{
            const p=line.split(','); const ok=p[0]&&p[1]&&!isNaN(parseFloat(p[2]));
            return `<tr><td>${escapeHtml(p[0]||'—')}</td><td>${escapeHtml(p[1]||'—')}</td><td>${escapeHtml(p[2]||'—')}</td><td>${escapeHtml(p[6]||'—')}</td><td>${escapeHtml(p[7]||'—')}</td><td>${ok?'✅':'❌'}</td></tr>`;
        }).join('');
    }
    if(preview) preview.style.display='';
    if(msg){ msg.textContent=lines.length+' lignes détectées'; msg.className='msg info'; }
}

async function loadHistoriqueTicker(){
    const ticker=_v('hist-ticker-search'), from=_v('hist-date-from'), to=_v('hist-date-to'), tb=$('hist-tbody');
    if(!tb){ showDiag('ERREUR: #hist-tbody introuvable. Le panel Historique n\'est peut-être pas encore affiché.','err'); return; }
    if(!ticker){
        tb.innerHTML='<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:20px;">Entrez un ticker et cliquez Charger</td></tr>';
        const btnDel=$('btn-del-all-hist'); if(btnDel) btnDel.style.display='none';
        window.histData=[]; removeBulkBarHist(); return;
    }
    let params='select=*&ticker=eq.'+encodeURIComponent(ticker)+'&order=date_seance.desc';
    if(from) params+='&date_seance=gte.'+encodeURIComponent(from);
    if(to)   params+='&date_seance=lte.'+encodeURIComponent(to);
    try{
        LOG('Requête: '+params);
        const rows = await sbGet('historique', params);
        window.histData = rows||[];
        LOG('Reçu '+window.histData.length+' lignes');
        const btnDel=$('btn-del-all-hist');
        if(!window.histData.length){
            tb.innerHTML='<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:20px;">Aucun historique pour ce ticker</td></tr>';
            if(btnDel) btnDel.style.display='none'; removeBulkBarHist(); return;
        }
        if(typeof resetSelection==='function') resetSelection();
        tb.innerHTML=window.histData.map(r=>`<tr>
            <td><input type="checkbox" class="row-check" data-id="${escapeHtml(r.id)}"></td>
            <td class="td-gold">${escapeHtml(r.ticker)}</td>
            <td class="td-muted">${r.date_seance}</td>
            <td class="r td-mono">${_fmt(r.cours_cloture)}</td>
            <td class="r td-muted">${_fmt(r.ouverture)}</td>
            <td class="r td-muted">${_fmt(r.plus_haut)}</td>
            <td class="r td-muted">${_fmt(r.plus_bas)}</td>
            <td class="r td-muted">${_fmt(r.volume)}</td>
            <td class="r" style="color:${_clrPct(r.variation)};font-family:var(--mono);">${_fmtPct(r.variation)}</td>
            <td><button class="btn btn-danger btn-sm btn-del-hist" data-id="${escapeHtml(r.id)}">✕</button></td>
        </tr>`).join('');
        attachHistEvents(tb);
        ensureBulkBarHist();
        if(typeof updateBulkBar==='function') updateBulkBar();
        updateHistBulkCount();
        if(btnDel) btnDel.style.display='';
    }catch(e){
        LOG('loadHistoriqueTicker erreur',e);
        tb.innerHTML='<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:20px;">Erreur de chargement — voir console F12</td></tr>';
    }
}

async function deleteHistRow(id){
    if(!id) return;
    if(!_confirm('Supprimer cette ligne ?')) return;
    try{ const ok=await sbDel('historique','id=eq.'+encodeURIComponent(id)); if(ok){ _toast('Ligne supprimée'); loadHistoriqueTicker(); } }
    catch(e){ LOG('deleteHistRow erreur',e); _toast('Erreur suppression'); }
}

async function deleteAllHistoriqueTicker(){
    const ticker=_v('hist-ticker-search'); if(!ticker) return;
    if(!_confirm('Supprimer TOUT l\'historique de '+ticker+' ?')) return;
    try{ const ok=await sbDel('historique','ticker=eq.'+encodeURIComponent(ticker)); if(ok){ _toast('Historique supprimé'); loadHistoriqueTicker(); } }
    catch(e){ LOG('deleteAllHistoriqueTicker erreur',e); _toast('Erreur suppression'); }
}

// ── Bulk bar ──
function ensureBulkBarHist(){
    const tb=$('hist-tbody'); if(!tb) return;
    const card=tb.closest('.card'); if(!card) return;
    if($('bulk-bar-hist')) return;
    const bar=document.createElement('div'); bar.id='bulk-bar-hist'; bar.className='bulk-bar';
    bar.innerHTML='<div class="bulk-actions"><span id="hist-bulk-count" style="font-size:12px;color:var(--muted);">0 sélectionné(s)</span> <button class="btn btn-danger btn-sm" id="hist-bulk-del">🗑 Supprimer</button> <button class="btn btn-outline btn-sm" id="hist-bulk-reset">↺ Tout désélectionner</button></div>';
    const ref=card.querySelector('.tw')||card.querySelector('.table-wrap')||tb.parentNode;
    if(ref&&ref.parentNode===card) card.insertBefore(bar,ref); else card.appendChild(bar);
    const btnDel=bar.querySelector('#hist-bulk-del'), btnReset=bar.querySelector('#hist-bulk-reset');
    if(btnDel) btnDel.addEventListener('click', runBulkDeleteHist);
    if(btnReset) btnReset.addEventListener('click', ()=>{ if(typeof resetSelection==='function') resetSelection(); if(typeof updateBulkBar==='function') updateBulkBar(); updateHistBulkCount(); });
}
function removeBulkBarHist(){ const b=$('bulk-bar-hist'); if(b) b.remove(); }
function updateHistBulkCount(){ const sp=$('hist-bulk-count'); if(!sp) return; sp.textContent=document.querySelectorAll('#hist-tbody .row-check:checked').length+' sélectionné(s)'; }
async function runBulkDeleteHist(){
    if(typeof bulkDeleteHist==='function') return bulkDeleteHist();
    const ids=Array.from(document.querySelectorAll('#hist-tbody .row-check:checked')).map(c=>c.dataset.id).filter(Boolean);
    if(!ids.length){ _toast('Aucune sélection'); return; }
    if(!_confirm('Supprimer '+ids.length+' ligne(s) ?')) return;
    let n=0; for(const id of ids){ try{ const ok=await sbDel('historique','id=eq.'+encodeURIComponent(id)); if(ok) n++; }catch(e){} }
    _toast(n+' ligne(s) supprimée(s)'); loadHistoriqueTicker(); if(typeof resetSelection==='function') resetSelection(); updateHistBulkCount();
}

// ── Événements (UNE SEULE FOIS) ──
function attachHistEvents(tb){
    if(!tb || tb.dataset._histEv==='1') return;
    tb.dataset._histEv='1';
    tb.addEventListener('change', e=>{ if(e.target.classList.contains('row-check')){ const id=e.target.dataset.id; if(typeof toggleRow==='function') toggleRow(id,e.target); updateHistBulkCount(); } });
    tb.addEventListener('click', e=>{ const btn=e.target.closest('.btn-del-hist'); if(btn){ e.stopPropagation(); deleteHistRow(btn.dataset.id); } });
}

// ── Compatibilité inline ──
function handleDeleteHist(btn){ if(btn&&btn.dataset&&btn.dataset.id) deleteHistRow(btn.dataset.id); }

// ══════════════════════════════════════════════════════
// 4. AUTO-RÉPARATION : si les onclick inline ne fonctionnent pas,
//    on ré-attache les handlers dès que le panel est visible
// ══════════════════════════════════════════════════════
function repairButtons(){
    // Bouton Charger
    const btnCharger = document.querySelector('button[onclick*="loadHistoriqueTicker"]');
    if(btnCharger && !btnCharger.dataset._repaired){
        btnCharger.dataset._repaired='1';
        btnCharger.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); loadHistoriqueTicker(); });
        LOG('Bouton Charger réparé');
    }
    // Bouton Supprimer tout
    const btnDelAll = document.querySelector('button[onclick*="deleteAllHistoriqueTicker"]');
    if(btnDelAll && !btnDelAll.dataset._repaired){
        btnDelAll.dataset._repaired='1';
        btnDelAll.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); deleteAllHistoriqueTicker(); });
    }
}

// Observer : attend que le panel Historique apparaisse dans le DOM
const observer = new MutationObserver(()=>{
    if($('hist-tbody')){ repairButtons(); }
});
observer.observe(document.body, { childList:true, subtree:true });

// ══════════════════════════════════════════════════════
// 5. EXPOSITION GLOBALE
// ══════════════════════════════════════════════════════
window.addHistorique = addHistorique;
window.importBulk = importBulk;
window.parseBulkPreview = parseBulkPreview;
window.loadHistoriqueTicker = loadHistoriqueTicker;
window.deleteHistRow = deleteHistRow;
window.deleteAllHistoriqueTicker = deleteAllHistoriqueTicker;
window.handleDeleteHist = handleDeleteHist;
window.runBulkDeleteHist = runBulkDeleteHist;

LOG('Initialisation terminée. Attente du panel Historique...');
})();
