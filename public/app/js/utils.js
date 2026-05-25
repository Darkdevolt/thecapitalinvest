// ═══════════════════════════════════════
// UTILS
// ═══════════════════════════════════════

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

// ═══════════════════════════════════════
// CONFIG SUPABASE (UNIQUE)
// ═══════════════════════════════════════
const SB_URL = 'https://otsiwiwlnowxeolbbgvm.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90c2l3aXdsbm93eGVvbGJiZ3ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MjgwODIsImV4cCI6MjA4MjIwNDA4Mn0.bIWFJZAm0acmc5Ogk2M-DjPafQCDN0vRE9Y5owma-LY';
const SK = 'tc_session';

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
const fmt = (n, d = 0) => (n == null || isNaN(+n)) ? '—' : (+n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const fmtM = n => {
  if (n == null || isNaN(+n)) return '—';
  const v = +n;
  if (Math.abs(v) >= 1e9) return (v/1e9).toFixed(1) + ' Mrd';
  if (Math.abs(v) >= 1e6) return (v/1e6).toFixed(0) + ' M';
  return fmt(v);
};

function changePill(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return '<span class="pill neutral">—</span>';
  if (n > 0) return `<span class="pill up">▲ ${n.toFixed(2)}%</span>`;
  if (n < 0) return `<span class="pill down">▼ ${Math.abs(n).toFixed(2)}%</span>`;
  return '<span class="pill neutral">= 0.00%</span>';
}

const SECTORS = { SGBC:'Banque', BICC:'Banque', ETIT:'Telecom', NTLC:'Telecom', SAFC:'Finance', PALM:'Agro', SIVC:'Agro', SOLB:'Distribution', BOAB:'Banque', BOAN:'Banque', ONAB:'Agro', CABC:'Agro', TTLS:'Industrie', SHEC:'Industrie' };
function getSector(t) {
  if (!t) return 'Divers';
  for (const [k,v] of Object.entries(SECTORS)) if (t.startsWith(k)) return v;
  return 'Divers';
}

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

function mkLineDataset(vals, color, label, width = 1.5) {
  return { label, data: vals, borderColor: color, borderWidth: width, pointRadius: 0, pointHoverRadius: 3, fill: false, tension: 0.3 };
}