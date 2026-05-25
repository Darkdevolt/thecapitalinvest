// ═══════════════════════════════════════
// VIEW — Recommandations / Analyses
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// ANALYSES
// ═══════════════════════════════════════
function renderAnalyseCard(a, clickable) {
  const rec = (a.recommandation||'').toLowerCase();
  const rc = rec.includes('achat')||rec.includes('buy') ? 'buy' : rec.includes('vend')||rec.includes('sell') ? 'sell' : 'hold';
  const rl = { buy:'Achat', sell:'Vendre', hold:'Conserver' }[rc];
  const text = (a.resume || a.contenu || '');
  const clickAttr = clickable ? `onclick="openAnalyseDetail(${a.id})"` : '';
  return `<div class="analyse-card" ${clickAttr}>
    <div class="analyse-header">
      <div><div class="analyse-ticker">${a.ticker||'—'}</div><div class="analyse-title">${a.titre||'Analyse fondamentale'}</div></div>
      <span class="rec ${rc}">${rl}</span>
    </div>
    ${text ? `<div class="analyse-text">${text.slice(0,240)}${text.length>240?'…':''}</div>` : ''}
    <div class="analyse-meta">
      ${a.date_analyse ? `<span>📅 ${fmtDate(a.date_analyse)}</span>` : ''}
      ${a.analyste ? `<span>✍ ${a.analyste}</span>` : ''}
      ${a.cours_cible ? `<span>🎯 Cible : ${fmt(a.cours_cible)} FCFA</span>` : ''}
    </div>
  </div>`;
}

function renderAnalyses() { window._analyseRows = allAnalyses; filterAnalyses(); }

function setAnalyseFilter(f, btn) {
  _analyseFilter = f;
  document.querySelectorAll('#view-analyses .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); filterAnalyses();
}

function filterAnalyses() {
  const q = (document.getElementById('searchAnalyses')?.value || '').toLowerCase();
  let rows = window._analyseRows || [];
  if (_analyseFilter !== 'all') {
    rows = rows.filter(r => {
      const rec = (r.recommandation||'').toLowerCase();
      if (_analyseFilter==='buy') return rec.includes('achat')||rec.includes('buy');
      if (_analyseFilter==='sell') return rec.includes('vend')||rec.includes('sell');
      if (_analyseFilter==='hold') return rec.includes('conserv')||rec.includes('hold')||rec.includes('neutr');
      return true;
    });
  }
  if (q) rows = rows.filter(r => (r.ticker||'').toLowerCase().includes(q) || (r.titre||'').toLowerCase().includes(q) || (r.resume||'').toLowerCase().includes(q));
  document.getElementById('analysesList').innerHTML = rows.length
    ? rows.map(a => renderAnalyseCard(a, true)).join('')
    : '<div class="empty-state"><div class="empty-icon">◎</div><div class="empty-title">Aucune analyse</div><div class="empty-text">Vérifiez vos données Supabase</div></div>';
}

function openAnalyseDetail(id, noHash) {
  const a = allAnalyses.find(x => x.id === id);
  if (!a) return;
  nav('analyse-detail', noHash);
  if (!noHash) history.replaceState(null, '', '#analyse=' + id);
  const rec = (a.recommandation||'').toLowerCase();
  const rc = rec.includes('achat')||rec.includes('buy') ? 'buy' : rec.includes('vend')||rec.includes('sell') ? 'sell' : 'hold';
  const rl = { buy:'ACHAT', sell:'VENTE', hold:'CONSERVER' }[rc];
  document.getElementById('analyseDetailContent').innerHTML = `
    <div class="fiche-hero" style="margin-bottom:20px">
      <div class="fiche-ticker-label">${a.ticker}</div>
      <div class="fiche-company">${a.titre}</div>
      <div style="display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap">
        <span class="rec ${rc}" style="font-size:13px;padding:6px 16px">${rl}</span>
        ${a.cours_cible ? `<span style="font-family:var(--mono);font-size:16px;color:var(--gold)">🎯 Cible : ${fmt(a.cours_cible)} FCFA</span>` : ''}
      </div>
      <div class="fiche-meta" style="margin-top:8px">📅 ${fmtDate(a.date_analyse)} · ✍ ${a.analyste || 'Research BRVM'}</div>
    </div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><div class="card-title">Synthèse</div></div>
        <div class="card-body" style="font-size:14px;color:var(--muted);line-height:1.8">${a.resume || 'Aucun résumé disponible.'}</div>
      </div>
      <div>
        <div class="card mb20">
          <div class="card-header"><div class="card-title">Actions rapides</div></div>
          <div class="card-body">
            <button class="back-btn" onclick="openFiche('${a.ticker}','analyse-detail')" style="margin-bottom:0">Voir la fiche ${a.ticker} →</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Autres analyses ${a.ticker}</div></div>
          <div class="card-body">
            ${allAnalyses.filter(x => x.ticker === a.ticker && x.id !== a.id).map(x => `<div style="padding:8px 0;border-bottom:1px solid var(--border2);cursor:pointer" onclick="openAnalyseDetail(${x.id})"><div style="font-size:12px;color:var(--gold);font-family:var(--mono)">${x.titre}</div><div style="font-size:11px;color:var(--dim)">${fmtDate(x.date_analyse)}</div></div>`).join('') || '<div style="color:var(--dim);font-size:13px">Aucune autre analyse.</div>'}
          </div>
        </div>
      </div>
    </div>
  `;
}