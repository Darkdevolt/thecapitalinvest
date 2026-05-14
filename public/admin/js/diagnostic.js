/* ══════════════════════════════════════════════════════
   DIAGNOSTIC
══════════════════════════════════════════════════════ */
async function runDiagnostic() {
    const res = document.getElementById('diag-result');
    if(res) res.innerHTML = '<div class="loading"><div class="spinner"></div><p>Diagnostic en cours...</p></div>';
    const counts = await Promise.all([
        sbCount('entreprises'), sbCount('cours'), sbCount('historique'),
        sbCount('financials'), sbCount('dividendes_calendrier')
    ]);
    const nEnt = counts[0], nCours = counts[1], nHist = counts[2], nFin = counts[3], nDiv = counts[4];
    const total = 5;
    const ok = [nEnt>0, nCours>0, nHist>0, nFin>0, nDiv>0].filter(Boolean).length;
    const score = Math.round(ok/total*100);
    const bar = document.getElementById('diag-health-bar');
    if(bar) bar.style.display = '';
    const hIcon = document.getElementById('diag-health-icon');
    const hTitle = document.getElementById('diag-health-title');
    const hSub = document.getElementById('diag-health-sub');
    const hScore = document.getElementById('diag-score');
    if(hIcon) hIcon.textContent  = score>=80?'✅':score>=50?'⚠️':'⛔';
    if(hTitle) hTitle.textContent = score>=80?'Plateforme saine':score>=50?'Quelques alertes':'Problèmes détectés';
    if(hSub) hSub.textContent   = ok + '/' + total + ' tables alimentées';
    if(hScore){
        hScore.textContent = score + '%';
        hScore.style.color = score>=80?'var(--green)':score>=50?'var(--orange)':'var(--red)';
    }
    if(res){
        res.innerHTML =
            '<div class="card"><div style="padding:18px;">' +
            '<table class="diag-table" style="width:100%;font-size:13px;">' +
            '<tr><th style="text-align:left;">Table</th><th style="text-align:right;">Lignes</th><th>État</th></tr>' +
            [['entreprises',nEnt],['cours',nCours],['historique',nHist],['financials',nFin],['dividendes',nDiv]].map(function(row){
                return '<tr><td>' + row[0] + '</td><td style="text-align:right;font-family:var(--mono);">' + row[1] + '</td>' +
                       '<td class="' + (row[1]>0?'diag-ok':'diag-err') + '">' + (row[1]>0?'OK':'VIDE') + '</td></tr>';
            }).join('') +
            '</table></div></div>';
    }
    diagData = { nEnt:nEnt, nCours:nCours, nHist:nHist, nFin:nFin, nDiv:nDiv, score:score, date:new Date().toISOString() };
}

function exportDiagnostic() {
    if (!diagData) { toast('Lancez d\'abord le diagnostic', 'err'); return; }
    const blob = new Blob([JSON.stringify(diagData, null, 2)], { type:'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'diagnostic-' + new Date().toISOString().split('T')[0] + '.json'; a.click();
    URL.revokeObjectURL(url);
}

async function loadCoursErreurs() {
    const panel = document.getElementById('cours-erreurs-panel');
    const rows  = await sbGet('cours', 'select=*&or=(cours.lte.0,variation.is.null)&limit=50');
    if (!panel) return;
    if (!rows || !rows.length) { panel.innerHTML = '<div style="padding:16px;color:var(--green);">✓ Aucun cours invalide</div>'; return; }
    panel.innerHTML = '<div class="tw"><table style="font-size:12px;"><thead><tr><th>Ticker</th><th>Date</th><th>Cours</th><th>Variation</th></tr></thead><tbody>' +
        rows.map(function(r){
            return '<tr><td>' + r.ticker + '</td><td>' + r.date_seance + '</td>' +
                   '<td style="color:' + (r.cours<=0?'var(--red)':'') + '">' + r.cours + '</td>' +
                   '<td style="color:' + (r.variation==null?'var(--red)':'') + '">' + (r.variation!=null?r.variation:'NULL') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
}

async function loadTickersSansFinancials() {
    const panel = document.getElementById('tickers-sans-fin-panel');
    const ents  = await sbGet('entreprises', 'select=ticker');
    const fins  = await sbGet('financials',  'select=ticker');
    if (!panel) return;
    const finSet  = new Set((fins || []).map(function(f){ return f.ticker; }));
    const missing = (ents || []).filter(function(e){ return !finSet.has(e.ticker); });
    if (!missing.length) { panel.innerHTML = '<div style="padding:16px;color:var(--green);">✓ Tous les tickers ont des financials</div>'; return; }
    panel.innerHTML = '<div class="tw"><table style="font-size:12px;"><thead><tr><th>Ticker</th></tr></thead><tbody>' +
        missing.map(function(e){ return '<tr><td>' + e.ticker + '</td></tr>'; }).join('') +
        '</tbody></table></div>';
}
