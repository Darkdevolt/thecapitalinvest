// ═══════════════════════════════════════
// COMPONENT — Cards
// ═══════════════════════════════════════

// Shared card rendering utilities

function renderStatCard(label, value, change, changeClass) {
  return `<div class="stat-card">
    <div class="stat-label">${label}</div>
    <div class="stat-value">${value}</div>
    <div class="stat-change ${changeClass}">${change}</div>
  </div>`;
}

function renderCard(title, body, extraClass = '') {
  return `<div class="card ${extraClass}">
    <div class="card-header"><div class="card-title">${title}</div></div>
    <div class="card-body">${body}</div>
  </div>`;
}
