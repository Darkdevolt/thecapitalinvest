// ═══════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// GLOBAL SEARCH
// ═══════════════════════════════════════
function initGlobalSearch() {
  const input = document.getElementById('globalSearchInput');
  const results = document.getElementById('globalSearchResults');
  
  input.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) { results.classList.remove('open'); return; }
    
    const byTicker = {};
    allCours.forEach(c => { if (c?.ticker && !byTicker[c.ticker]) byTicker[c.ticker] = c; });
    const matches = Object.values(byTicker).filter(c => 
      (c.ticker || '').toLowerCase().includes(q) || 
      (entMap[c.ticker]?.nom || '').toLowerCase().includes(q)
    ).slice(0, 8);
    
    if (!matches.length) { results.classList.remove('open'); return; }
    
    results.innerHTML = matches.map(c => {
      const name = entMap[c.ticker]?.nom || c.ticker;
      const sector = getSector(c.ticker);
      return `<div class="gsr-item" onclick="openFiche('${c.ticker}','overview'); document.getElementById('globalSearchResults').classList.remove('open'); document.getElementById('globalSearchInput').value='';">
        <div>
          <span class="gsr-ticker">${c.ticker}</span>
          <span class="gsr-name">${name}</span>
        </div>
        <span class="gsr-sector">${sector}</span>
      </div>`;
    }).join('');
    results.classList.add('open');
  });
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { results.classList.remove('open'); input.blur(); }
  });
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#globalSearch')) results.classList.remove('open');
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault();
    document.getElementById('globalSearchInput').focus();
  }
  if (e.key === 'Escape') {
    document.getElementById('globalSearchResults').classList.remove('open');
    if (window.innerWidth <= 768) closeSidebar();
  }
});