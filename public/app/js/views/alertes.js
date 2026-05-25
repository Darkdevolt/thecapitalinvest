// ═══════════════════════════════════════
// VIEW — Alertes de Prix
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// ALERTES
// ═══════════════════════════════════════
function getAlerts() {
  try { return JSON.parse(localStorage.getItem('tc_alerts') || '[]'); } catch { return []; }
}
function saveAlerts(data) { localStorage.setItem('tc_alerts', JSON.stringify(data)); }

function addAlert() {
  const ticker = document.getElementById('alertTicker').value;
  const condition = document.getElementById('alertCondition').value;
  const price = parseFloat(document.getElementById('alertPrice').value);
  if (!ticker || !price) { toast('Remplissez tous les champs', 'warn'); return; }
  const alerts = getAlerts();
  alerts.push({ id: Date.now(), ticker, condition, price, active: true, triggered: false, created: new Date().toISOString() });
  saveAlerts(alerts);
  renderAlerts();
  toast('Alerte créée', 'success');
  document.getElementById('alertPrice').value = '';
}

function removeAlert(id) {
  const alerts = getAlerts().filter(a => a.id !== id);
  saveAlerts(alerts);
  renderAlerts();
  toast('Alerte supprimée', 'success');
}

function toggleAlert(id) {
  const alerts = getAlerts();
  const a = alerts.find(x => x.id === id);
  if (a) { a.active = !a.active; saveAlerts(alerts); renderAlerts(); }
}

function renderAlerts() {
  const alerts = getAlerts();
  const byTicker = {};
  allCours.forEach(c => { if (!byTicker[c.ticker]) byTicker[c.ticker] = c; });

  alerts.forEach(a => {
    const current = byTicker[a.ticker]?.cours;
    if (a.active && current != null) {
      if (a.condition === 'above' && current >= a.price) a.triggered = true;
      if (a.condition === 'below' && current <= a.price) a.triggered = true;
    }
  });
  saveAlerts(alerts);

  document.getElementById('alertsList').innerHTML = alerts.map(a => {
    const current = byTicker[a.ticker]?.cours;
    const cls = a.triggered ? 'triggered' : a.active ? 'active' : '';
    const condLabel = a.condition === 'above' ? 'supérieur à' : 'inférieur à';
    return `<div class="alert-card ${cls}">
      <div class="alert-info">
        <div class="alert-ticker">${a.ticker}</div>
        <div class="alert-desc">Cours ${condLabel} ${fmt(a.price)} FCFA</div>
        <div class="alert-meta">${a.triggered ? '🔔 Déclenchée' : a.active ? '✅ Active' : '⏸️ Désactivée'} · Cours actuel : ${current ? fmt(current) : '—'}</div>
      </div>
      <div class="alert-actions">
        <button onclick="toggleAlert(${a.id})">${a.active ? 'Désactiver' : 'Activer'}</button>
        <button onclick="removeAlert(${a.id})">Supprimer</button>
      </div>
    </div>`;
  }).join('') || '<div class="empty-state"><div class="empty-icon">△</div><div class="empty-title">Aucune alerte</div><div class="empty-text">Créez votre première alerte de prix ci-dessus.</div></div>';
}