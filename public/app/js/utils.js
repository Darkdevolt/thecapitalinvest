// ═══════════════════════════════════════
// UTILS (CORRIGÉ — 100% Supabase, plus de hardcodage)
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// TOAST SYSTEM
// ═══════════════════════════════════════
function toast(msg, type='info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:360px;';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  el.style.cssText = `
    padding: 12px 20px; border-radius: 8px; font-size: 13px;
    font-family: var(--sans, 'DM Sans', sans-serif); color: #F5F0E8;
    background: ${type === 'error' ? 'rgba(248,113,113,0.15)' : type === 'warn' ? 'rgba(251,191,36,0.15)' : 'rgba(74,222,128,0.15)'};
    border: 1px solid ${type === 'error' ? 'rgba(248,113,113,0.3)' : type === 'warn' ? 'rgba(251,191,36,0.3)' : 'rgba(74,222,128,0.3)'};
    backdrop-filter: blur(10px); transition: all 0.3s ease; cursor: pointer;
  `;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0'; el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

// ═══════════════════════════════════════
// CONFIG SUPABASE (var pour résister au double chargement)
// ═══════════════════════════════════════
window.SB_URL = window.SB_URL || 'https://otsiwiwlnowxeolbbgvm.supabase.co';
window.SB_KEY = window.SB_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90c2l3aXdsbm93eGVvbGJiZ3ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MjgwODIsImV4cCI6MjA4MjIwNDA4Mn0.bIWFJZAm0acmc5Ogk2M-DjPafQCDN0vRE9Y5owma-LY';
window.SK = window.SK || 'tc_session';

var SB_URL = window.SB_URL;
var SB_KEY = window.SB_KEY;
var SK = window.SK;

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
function fmt(n, d = 0) {
  return (n == null || isNaN(+n)) ? '—' : (+n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—';
}
function fmtM(n) {
  if (n == null || isNaN(+n)) return '—';
  const v = +n;
  if (Math.abs(v) >= 1e9) return (v/1e9).toFixed(1) + ' Mrd';
  if (Math.abs(v) >= 1e6) return (v/1e6).toFixed(0) + ' M';
  return fmt(v);
}

function changePill(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  if (n > 0) return `▲ ${n.toFixed(2)}%`;
  if (n < 0) return `▼ ${Math.abs(n).toFixed(2)}%`;
  return '= 0.00%';
}

// ═══════════════════════════════════════
// SECTEUR — 100% SUPABASE (CORRIGÉ)
// ═══════════════════════════════════════
function getSector(ticker) {
  if (!ticker) return 'Divers';
  const t = ticker.toUpperCase().trim();

  if (typeof entMap !== 'undefined' && entMap[t]) {
    const e = entMap[t];
    if (e.secteur && e.secteur.trim() !== '') return e.secteur;
    if (e.sector && e.sector.trim() !== '') return e.sector;
  }

  if (typeof allCours !== 'undefined' && Array.isArray(allCours)) {
    const c = allCours.find(c => (c.ticker || '').toUpperCase().trim() === t);
    if (c) {
      if (c.secteur && c.secteur.trim() !== '') return c.secteur;
      if (c.sector && c.sector.trim() !== '') return c.sector;
    }
  }

  return 'Divers';
}

// ═══════════════════════════════════════
// PAYS — 100% SUPABASE (AJOUTÉ)
// ═══════════════════════════════════════
function getPays(ticker) {
  if (!ticker) return 'Inconnu';
  const t = ticker.toUpperCase().trim();

  if (typeof entMap !== 'undefined' && entMap[t]) {
    const e = entMap[t];
    if (e.pays && e.pays.trim() !== '') return e.pays;
    if (e.country && e.country.trim() !== '') return e.country;
  }

  if (typeof allCours !== 'undefined' && Array.isArray(allCours)) {
    const c = allCours.find(c => (c.ticker || '').toUpperCase().trim() === t);
    if (c) {
      if (c.pays && c.pays.trim() !== '') return c.pays;
      if (c.country && c.country.trim() !== '') return c.country;
    }
  }

  return 'Inconnu';
}

// ═══════════════════════════════════════
// CHART DEFAULTS
// ═══════════════════════════════════════
const chartOpts = {
  responsive: true, maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1A1610', borderColor: 'rgba(184,150,78,0.3)', borderWidth: 1,
      titleColor: '#B8964E', bodyColor: '#F5F0E8', padding: 12,
      callbacks: { label: ctx => ' ' + (ctx.dataset.label ? ctx.dataset.label + ': ' : '') + fmt(ctx.parsed.y, 2) }
    }
  },
  scales: {
    x: { grid: { color: 'rgba(184,150,78,0.04)' }, ticks: { color: 'rgba(245,240,232,0.3)', font: { size: 10, family: 'DM Mono' }, maxTicksLimit: 8 } },
    y: { position: 'right', grid: { color: 'rgba(184,150,78,0.06)' }, ticks: { color: 'rgba(245,240,232,0.3)', font: { size: 10, family: 'DM Mono' }, callback: v => fmt(v) } }
  }
};

function mkDataset(vals, color = '#B8964E', label = '') {
  return {
    label, data: vals, borderColor: color, borderWidth: 2,
    pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: color, pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
    fill: true, tension: 0.3,
    backgroundColor: ctx => {
      const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
      g.addColorStop(0, color + '18'); g.addColorStop(1, color + '00');
      return g;
    }
  };
}

function mkLineDataset(vals, color, label, width = 1.5) {
  return { label, data: vals, borderColor: color, borderWidth: width, pointRadius: 0, pointHoverRadius: 3, fill: false, tension: 0.3 };
}

// ═══════════════════════════════════════════════════════
// UNIFIED DESIGN SYSTEM HELPERS — CORRIGÉ
// ═══════════════════════════════════════════════════════

function sectorBadge(sector) {
  if (!sector) return '<span class="sector-badge divers">Divers</span>';

  const normalized = sector.toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[éèê]/g, 'e')
    .replace(/[àâ]/g, 'a')
    .replace(/[ô]/g, 'o')
    .replace(/[û]/g, 'u')
    .replace(/[ç]/g, 'c');

  const classMap = {
    'services-financiers': 'services-financiers',
    'banque': 'services-financiers',
    'finance': 'services-financiers',
    'consommation-discretionnaire': 'consommation-discretionnaire',
    'consommation': 'consommation-discretionnaire',
    'consommation-base': 'consommation-base',
    'industriels': 'industriels',
    'industrie': 'industriels',
    'telecommunications': 'telecommunications',
    'telecom': 'telecommunications',
    'services-publics': 'services-publics',
    'energie': 'energie',
    'agro': 'agro',
    'industrie-agricole': 'agro',
    'distribution': 'distribution',
    'divers': 'divers',
    'autre': 'divers'
  };

  const cls = classMap[normalized] || 'divers';
  return '<span class="sector-badge ' + cls + '">' + sector + '</span>';
}

function tickerRow(c, opts) {
  opts = opts || {};
  var showCompany = opts.showCompany || false;
  var show52Week = opts.show52Week || false;
  var showCapital = opts.showCapital || false;
  var ent = (typeof entMap !== 'undefined' && entMap[c.ticker]) || {};

  var html = '<td><strong class="ticker-cell">' + c.ticker + '</strong></td>';
  if (showCompany) html += '<td class="company-cell">' + (ent.nom || c.ticker) + '</td>';
  html += '<td class="price-cell">' + fmt(c.cours) + '</td>';
  html += '<td class="var-cell">' + changePill(c.variation) + '</td>';
  html += '<td class="vol-cell">' + fmt(c.volume) + '</td>';

  if (showCapital) html += '<td class="cap-cell">' + (c.capitalisation ? fmtM(c.capitalisation) : '—') + '</td>';
  if (show52Week) {
    html += '<td class="high52-cell">' + (c.plus_haut_52 ? fmt(c.plus_haut_52) : '—') + '</td>';
    html += '<td class="low52-cell">' + (c.plus_bas_52 ? fmt(c.plus_bas_52) : '—') + '</td>';
  }
  html += '<td class="sector-cell">' + sectorBadge(getSector(c.ticker)) + '</td>';

  return '<tr>' + html + '</tr>';
}

function emptyState(msg) {
  return '<tr><td colspan="99" class="tc-empty">' + msg + '</td></tr>';
}
