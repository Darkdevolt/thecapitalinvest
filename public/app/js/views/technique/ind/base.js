// ═══════════════════════════════════════
// AT Indicator — Base Utilities
// ═══════════════════════════════════════

// Shared math utilities for indicators
function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, v) => a + Math.pow(v - m, 2), 0) / arr.length);
}
