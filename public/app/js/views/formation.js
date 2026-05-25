// ═══════════════════════════════════════
// VIEW — Formation BRVM
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// FORMATION
// ═══════════════════════════════════════
function showFormationTab(tabId, btn) {
  document.querySelectorAll('.formation-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');
  
  document.querySelectorAll('#view-formation .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}