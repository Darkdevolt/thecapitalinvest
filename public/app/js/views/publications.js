// ═══════════════════════════════════════
// VIEW — Calendrier des Publications
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// PUBLICATIONS
// ═══════════════════════════════════════
function renderPublications() {
  filterPublications();
}

function setPubFilter(f, btn) {
  _pubFilter = f;
  document.querySelectorAll('#view-publications .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterPublications();
}

function filterPublications() {
  const q = (document.getElementById('searchPubs')?.value || '').toLowerCase();
  
  const allTickersSet = new Set();
  allCours.forEach(c => allTickersSet.add(c.ticker));
  allEntreprises.forEach(e => allTickersSet.add(e.ticker));
  const allTickers = Array.from(allTickersSet).sort();

  const pubs = {};
  allFinancials.forEach(f => {
    if (f.resultat_net == null) return;
    const periode = f.periode || 'annuel';
    if (_pubFilter !== 'all' && periode !== _pubFilter && !(_pubFilter === 'annuel' && periode === 'annuel')) return;
    const keyPeriod = periode === 'annuel' ? 'Annuel' : periode.toUpperCase();
    const key = f.annee + ' ' + keyPeriod;
    if (!pubs[key]) pubs[key] = [];
    if (!pubs[key].includes(f.ticker)) pubs[key].push(f.ticker);
  });

  if (q) {
    Object.keys(pubs).forEach(key => {
      pubs[key] = pubs[key].filter(t => t.toLowerCase().includes(q) || (entMap[t]?.nom || t).toLowerCase().includes(q));
      if (pubs[key].length === 0) delete pubs[key];
    });
  }

  const periodOrder = { 'T1':1, 'T2':2, 'T3':3, 'S1':4, 'Annuel':5 };
  const sorted = Object.entries(pubs).sort((a,b) => {
    const [yA, pA] = a[0].split(' ');
    const [yB, pB] = b[0].split(' ');
    if (yA !== yB) return yB - yA;
    return (periodOrder[pA]||0) - (periodOrder[pB]||0);
  });

  const container = document.getElementById('publicationsGrid');
  if (!sorted.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">Aucune publication détectée</div><div class="empty-text">Ajoutez des données financières avec le résultat net renseigné.</div></div>';
    return;
  }

  container.innerHTML = sorted.map(([period, publishedTickers]) => {
    const waitingTickers = allTickers.filter(t => !publishedTickers.includes(t)).sort();
    const filteredWaiting = q ? waitingTickers.filter(t => t.toLowerCase().includes(q) || (entMap[t]?.nom || t).toLowerCase().includes(q)) : waitingTickers;
    
    const periodLabel = period.replace(/(\d{4}) (.+)/, '$1 — $2');
    const total = publishedTickers.length + filteredWaiting.length;
    
    return `<div class="pub-period">
      <div class="pub-period-header">
        <span class="pub-period-title">${periodLabel}</span>
        <span class="pub-count">${publishedTickers.length} publié(s) / ${total} sociétés</span>
      </div>
      <div class="pub-tickers-grid">
        ${publishedTickers.map(t => {
          const name = entMap[t]?.nom || t;
          return `<div class="pub-ticker-card" onclick="openFiche('${t}','publications')">
            <span class="pub-check">✓</span>
            <span class="pub-ticker">${t}</span>
            <span class="pub-name" title="${name}">${name}</span>
          </div>`;
        }).join('')}
      </div>
      ${filteredWaiting.length > 0 ? `
        <div class="pub-section-title">En attente</div>
        <div class="pub-tickers-grid">
          ${filteredWaiting.map(t => {
            const name = entMap[t]?.nom || t;
            return `<div class="pub-ticker-card waiting" onclick="openFiche('${t}','publications')">
              <span class="pub-check">✕</span>
              <span class="pub-ticker">${t}</span>
              <span class="pub-name" title="${name}">${name}</span>
            </div>`;
          }).join('')}
        </div>
      ` : ''}
    </div>`;
  }).join('');
}