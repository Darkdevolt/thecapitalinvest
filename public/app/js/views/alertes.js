// THE CAPITAL, Alertes de prix
// Source de vérité : Supabase via /api/user-data. Aucune persistance métier en local.
(function () {
  'use strict';

  function serverReady() {
    return typeof window.getAlerts === 'function' && window.__TC_ALERTS_SERVER_READY__ === true;
  }

  function renderAlerts() {
    if (!serverReady()) return;
    const alerts = window.getAlerts() || [];
    const byTicker = {};
    (window.allCours || []).forEach(function (c) {
      if (c && c.ticker && !byTicker[c.ticker]) byTicker[c.ticker] = c;
    });
    const el = document.getElementById('alertsList');
    if (!el) return;

    el.innerHTML = alerts.map(function (a) {
      const current = Number(byTicker[a.ticker]?.cours);
      const threshold = Number(a.seuil ?? a.price);
      const type = a.type_alerte || a.condition;
      const triggered = Number.isFinite(current) && (type === 'above' ? current >= threshold : type === 'below' ? current <= threshold : false);
      const label = type === 'above' ? 'supérieur à' : 'inférieur à';
      return `<div class="alert-card ${triggered ? 'triggered' : a.active ? 'active' : ''}">
        <div class="alert-info">
          <div class="alert-ticker">${a.ticker}</div>
          <div class="alert-desc">Cours ${label} ${fmt(threshold)} FCFA</div>
          <div class="alert-meta">${triggered ? '🔔 Déclenchée' : a.active ? '✅ Active' : '⏸️ Désactivée'} · Cours actuel : ${Number.isFinite(current) ? fmt(current) : ', '}</div>
        </div>
        <div class="alert-actions">
          <button onclick="toggleAlert('${a.id}')">${a.active ? 'Désactiver' : 'Activer'}</button>
          <button onclick="removeAlert('${a.id}')">Supprimer</button>
        </div>
      </div>`;
    }).join('') || '<div class="empty-state"><div class="empty-icon">△</div><div class="empty-title">Aucune alerte</div><div class="empty-text">Créez votre première alerte de prix ci-dessus.</div></div>';
  }

  window.renderAlerts = renderAlerts;
})();
