// ═══════════════════════════════════════
// UTILS — Garde anti-double exécution
// ═══════════════════════════════════════
if (window.__utilsLoaded) {
  console.warn('[UTILS] Déjà chargé, skip.');
} else {
  window.__utilsLoaded = true;

  // ═══════════════════════════════════════
  // TOAST SYSTEM
  // ═══════════════════════════════════════
  function toast(msg, type='info') {
   const container = document.getElementById('toastContainer');
   const el = document.createElement('div');
   el.className = `toast ${type}`;
   el.textContent = msg;
   container.appendChild(el);
   setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; setTimeout(() => el.remove(), 300); }, 4000);
  }
  window.toast = toast;

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
  window.fmt = fmt;

  function fmtDate(d) {
    return d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—';
  }
  window.fmtDate = fmtDate;

  function fmtM(n) {
   if (n == null || isNaN(+n)) return '—';
   const v = +n;
   if (Math.abs(v) >= 1e9) return (v/1e9).toFixed(1) + ' Mrd';
   if (Math.abs(v) >= 1e6) return (v/1e6).toFixed(0) + ' M';
   return fmt(v);
  }
  window.fmtM = fmtM;

  function changePill(v) {
   const n = parseFloat(v);
   if (isNaN(n)) return '—';
   if (n > 0) return `▲ ${n.toFixed(2)}%`;
   if (n < 0) return `▼ ${Math.abs(n).toFixed(2)}%`;
   return '= 0.00%';
  }
  window.changePill = changePill;

  const SECTORS = { SGBC:'Banque', BICC:'Banque', ETIT:'Telecom', NTLC:'Telecom', SAFC:'Finance', PALM:'Agro', SIVC:'Agro', SOLB:'Distribution', BOAB:'Banque', BOAN:'Banque', ONAB:'Agro', CABC:'Agro', TTLS:'Industrie', SHEC:'Industrie' };
  window.SECTORS = SECTORS;

  function getSector(t) {
   if (!t) return 'Divers';
   for (const [k,v] of Object.entries(SECTORS)) if (t.startsWith(k)) return v;
   return 'Divers';
  }
  window.getSector = getSector;

  // ═══════════════════════════════════════
  // CHART DEFAULTS
  // ═══════════════════════════════════════
  const chartOpts = {
   responsive: true,
   maintainAspectRatio: false,
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
  window.chartOpts = chartOpts;

  function mkDataset(vals, color = '#B8964E', label = '') {
   return {
    label,
    data: vals, borderColor: color, borderWidth: 2,
    pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: color, pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
    fill: true, tension: 0.3,
    backgroundColor: ctx => {
     const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
     g.addColorStop(0, color + '18'); g.addColorStop(1, color + '00');
     return g;
    }
   };
  }
  window.mkDataset = mkDataset;

  function mkLineDataset(vals, color, label, width = 1.5) {
   return { label, data: vals, borderColor: color, borderWidth: width, pointRadius: 0, pointHoverRadius: 3, fill: false, tension: 0.3 };
  }
  window.mkLineDataset = mkLineDataset;
}
