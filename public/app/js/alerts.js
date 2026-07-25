// ALERTS MODULE — Price alerts management
(function() {
  if (window.__TC_ALERTS_LOADED__) return;
  window.__TC_ALERTS_LOADED__ = true;

  let alerts = JSON.parse(localStorage.getItem('tc_alerts') || '[]');
  let alertHistory = JSON.parse(localStorage.getItem('tc_alert_history') || '[]');
  let allCours = [];

  async function loadData() {
    const r = (window.sbQuery ? await window.sbQuery('cours', { order: 'date_seance.desc', limit: 300 }).catch(() => []) : []);
    allCours = r || [];
    const tickers = [...new Set(allCours.map(c => c.ticker))].sort();
    const tickerEl = document.getElementById('alert-ticker');
    if(tickerEl) tickerEl.innerHTML = tickers.map(t => `<option value="${t}">${t}</option>`).join('');
    renderAlerts();
    checkAlerts();
  }

  function createAlert() {
    const ticker = document.getElementById('alert-ticker').value;
    const type = document.getElementById('alert-type').value;
    const seuil = parseFloat(document.getElementById('alert-seuil').value);
    const note = document.getElementById('alert-note').value;
    
    if (!seuil) return;
    
    alerts.push({
      id: Date.now(),
      ticker, type, seuil, note,
      created: new Date().toISOString(),
      active: true
    });
    
    localStorage.setItem('tc_alerts', JSON.stringify(alerts));
    renderAlerts();
  }

  function renderAlerts() {
    const countEl = document.getElementById('alert-count');
    if(countEl) countEl.textContent = `${alerts.filter(a => a.active).length} alertes actives`;
    
    const listEl = document.getElementById('alert-list');
    if(listEl) {
      listEl.innerHTML = alerts.filter(a => a.active).map(a => {
        const cours = allCours.find(c => c.ticker === a.ticker);
        const current = cours?.cours || 0;
        const triggered = checkTriggered(a, current);
        const statusColor = triggered ? 'var(--green)' : 'var(--dim)';
        const fmt = n => n != null ? parseFloat(n).toLocaleString('fr-FR') : '—';
        
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid var(--border2)">
          <div>
            <div style="font-family:var(--mono);font-size:12px;color:var(--gold)">${a.ticker}</div>
            <div style="font-size:12px;color:var(--muted)">${a.type === 'above' ? '>' : '<'} ${fmt(a.seuil)} FCFA ${a.note ? '· ' + a.note : ''}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:11px;color:${statusColor}">${triggered ? '✓ Déclenchée' : 'En attente'}</span>
            <button class="btn btn-danger btn-sm" onclick="deleteAlert(${a.id})">✕</button>
          </div>
        </div>`;
      }).join('') || '<div style="padding:20px;color:var(--dim);text-align:center">Aucune alerte active</div>';
    }

    const historyEl = document.getElementById('alert-history');
    if(historyEl) {
      const fmt = n => n != null ? parseFloat(n).toLocaleString('fr-FR') : '—';
      const fmtDate = d => new Date(d).toLocaleDateString('fr-FR');
      historyEl.innerHTML = alertHistory.slice(-10).reverse().map(h => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 20px;border-bottom:1px solid var(--border2);opacity:0.6">
          <div>
            <span style="font-family:var(--mono);font-size:11px;color:var(--gold)">${h.ticker}</span>
            <span style="font-size:11px;color:var(--muted)"> ${h.type} ${fmt(h.seuil)} — ${fmtDate(h.triggeredAt)}</span>
          </div>
          <span style="color:var(--green);font-size:11px">✓ Déclenchée</span>
        </div>
      `).join('') || '<div style="padding:16px;color:var(--dim);text-align:center">Aucune alerte déclenchée</div>';
    }
  }

  function checkTriggered(alert, current) {
    if (!alert.active) return false;
    switch(alert.type) {
      case 'above': return current >= alert.seuil;
      case 'below': return current <= alert.seuil;
      case 'change_pct': return Math.abs(parseFloat(current?.variation) || 0) >= alert.seuil;
      default: return false;
    }
  }

  function checkAlerts() {
    allCours.forEach(c => {
      alerts.filter(a => a.active && a.ticker === c.ticker).forEach(a => {
        if (checkTriggered(a, c.cours)) {
          a.active = false;
          alertHistory.push({ ...a, triggeredAt: new Date().toISOString(), triggeredPrice: c.cours });
        }
      });
    });
    localStorage.setItem('tc_alerts', JSON.stringify(alerts));
    localStorage.setItem('tc_alert_history', JSON.stringify(alertHistory));
    renderAlerts();
  }

  function deleteAlert(id) {
    alerts = alerts.filter(a => a.id !== id);
    localStorage.setItem('tc_alerts', JSON.stringify(alerts));
    renderAlerts();
  }

  window.createAlert = createAlert;
  window.renderAlerts = renderAlerts;
  window.deleteAlert = deleteAlert;
  window.loadAlertsData = loadData;
  console.log('[ALERTS] Charge avec succes');
})();
