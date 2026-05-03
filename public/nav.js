/**
 * THE CAPITAL — Navigation partagée
 * Injecter dans chaque page avec : <script src="nav.js"></script>
 * Appeler initNav('marche') avec le nom de la page active
 */

const NAV_PAGES = [
  {
    id: 'app',
    label: 'Dashboard',
    icon: '◈',
    href: 'app.html',
    sub: []
  },
  {
    id: 'marche',
    label: 'Marché',
    icon: '▦',
    href: 'marche.html',
    sub: [
      { label: 'Cours des actions', anchor: '#cours' },
      { label: 'Cours des indices', anchor: '#indices' },
      { label: 'Dividendes', anchor: '#dividendes' },
      { label: 'Palmarès hebdomadaires', anchor: '#palmares' },
      { label: 'Publications officielles', anchor: '#publications' },
      { label: 'Calendrier des évènements', anchor: '#calendrier' },
    ]
  },
  {
    id: 'analyse',
    label: 'Analyse',
    icon: '◎',
    href: 'analyse.html',
    sub: [
      { label: 'Graphique d\'une action', anchor: '#graphique' },
      { label: 'Analyse technique', anchor: '#technique' },
      { label: 'Signaux techniques', anchor: '#signaux' },
      { label: 'Comparaison des cours', anchor: '#comparaison' },
      { label: 'Notations financières', anchor: '#notations' },
    ]
  },
  {
    id: 'societes',
    label: 'Sociétés',
    icon: '◉',
    href: 'societes.html',
    sub: [
      { label: 'Rapports d\'activité', anchor: '#rapports' },
      { label: 'Dividendes historiques', anchor: '#dividendes-hist' },
      { label: 'Ratios par société', anchor: '#ratios-societe' },
      { label: 'Ratios par secteur', anchor: '#ratios-secteur' },
    ]
  },
  {
    id: 'portefeuille',
    label: 'Portefeuille',
    icon: '◧',
    href: 'portefeuille.html',
    sub: [
      { label: 'Mes portefeuilles', anchor: '#portefeuilles' },
      { label: 'Espèces et titres', anchor: '#especes' },
      { label: 'Analyse du portefeuille', anchor: '#analyse-pf' },
      { label: 'Détection des oublis', anchor: '#oublis' },
      { label: 'Détection des erreurs', anchor: '#erreurs' },
    ]
  },
  {
    id: 'outils',
    label: 'Outils',
    icon: '⊞',
    href: 'outils.html',
    sub: [
      { label: 'Filtrage des sociétés', anchor: '#filtrage' },
      { label: 'Classement des sociétés', anchor: '#classement' },
      { label: 'Comparaison des sociétés', anchor: '#comparaison' },
      { label: 'Journée de cotation', anchor: '#cotation' },
      { label: 'Alertes franchissement', anchor: '#alertes' },
    ]
  },
  {
    id: 'apprendre',
    label: 'Apprendre',
    icon: '◑',
    href: 'apprendre.html',
    sub: [
      { label: 'Articles & Guides', anchor: '#articles' },
      { label: 'Quiz', anchor: '#quiz' },
      { label: 'Lexique', anchor: '#lexique' },
      { label: 'Sociétés cotées', anchor: '#societes-cotees' },
      { label: 'Liste des SGI', anchor: '#sgi' },
    ]
  },
];

const NAV_CSS = `
<style id="tc-nav-style">
:root {
  --bg: #0A0804;
  --surface: #16130D;
  --card: #1A1610;
  --border: rgba(184,150,78,0.15);
  --border2: rgba(184,150,78,0.08);
  --gold: #B8964E;
  --gold-light: #D4AF6A;
  --gold-dim: rgba(184,150,78,0.4);
  --cream: #F5F0E8;
  --muted: rgba(245,240,232,0.6);
  --dim: rgba(245,240,232,0.3);
  --green: #4ADE80;
  --green-bg: rgba(74,222,128,0.08);
  --red: #F87171;
  --red-bg: rgba(248,113,113,0.08);
  --blue: #60A5FA;
  --serif: 'Playfair Display', serif;
  --sans: 'DM Sans', sans-serif;
  --mono: 'DM Mono', monospace;
  --topnav-h: 56px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg);
  font-family: var(--sans);
  color: var(--cream);
  min-height: 100vh;
  font-weight: 300;
  padding-top: var(--topnav-h);
}
body::before {
  content: '';
  position: fixed; inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
  pointer-events: none; z-index: 0; opacity: 0.5;
}

/* TOP NAV */
#tc-topnav {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: var(--topnav-h);
  background: rgba(10,8,4,0.92);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  z-index: 1000;
  padding: 0 24px;
  gap: 0;
}

.tc-nav-logo {
  font-family: var(--serif);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 3px;
  color: var(--cream);
  text-decoration: none;
  margin-right: 32px;
  white-space: nowrap;
  flex-shrink: 0;
}
.tc-nav-logo span { color: var(--gold); }

.tc-nav-items {
  display: flex;
  align-items: center;
  height: 100%;
  flex: 1;
  gap: 2px;
}

.tc-nav-item {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
}

.tc-nav-link {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  height: 100%;
  color: var(--muted);
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-decoration: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.18s;
  white-space: nowrap;
  user-select: none;
}

.tc-nav-link .nav-icon {
  font-size: 13px;
  opacity: 0.7;
}

.tc-nav-link:hover {
  color: var(--cream);
  background: rgba(184,150,78,0.04);
}

.tc-nav-link.active {
  color: var(--gold);
  border-bottom-color: var(--gold);
  background: rgba(184,150,78,0.04);
}

.tc-nav-link .nav-arrow {
  font-size: 9px;
  opacity: 0.5;
  margin-left: 2px;
  transition: transform 0.2s;
}

.tc-nav-item:hover .nav-arrow {
  transform: rotate(180deg);
}

/* DROPDOWN */
.tc-dropdown {
  position: absolute;
  top: calc(100% + 0px);
  left: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-top: 2px solid var(--gold);
  border-radius: 0 0 10px 10px;
  padding: 6px 0;
  min-width: 210px;
  box-shadow: 0 16px 40px rgba(0,0,0,0.5);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-6px);
  transition: all 0.18s ease;
  z-index: 999;
}

.tc-nav-item:hover .tc-dropdown {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.tc-dropdown a {
  display: block;
  padding: 9px 18px;
  font-size: 12.5px;
  color: var(--muted);
  text-decoration: none;
  transition: all 0.15s;
  border-left: 2px solid transparent;
}

.tc-dropdown a:hover {
  color: var(--gold);
  background: rgba(184,150,78,0.05);
  border-left-color: var(--gold);
}

/* RIGHT SIDE */
.tc-nav-right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
  flex-shrink: 0;
}

.tc-nav-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  background: var(--green-bg);
  border: 1px solid rgba(74,222,128,0.2);
  border-radius: 20px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  color: var(--green);
}

.tc-live-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: var(--green);
  animation: tc-pulse 2s infinite;
}

@keyframes tc-pulse {
  0%,100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.tc-nav-time {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--dim);
}

/* PAGE LAYOUT */
.page-content {
  position: relative;
  z-index: 1;
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px 32px;
}

.page-header {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border2);
}

.page-header h1 {
  font-family: var(--serif);
  font-size: 28px;
  font-weight: 400;
  color: var(--cream);
  margin-bottom: 6px;
}

.page-header p {
  font-size: 13px;
  color: var(--muted);
}

/* ANCHOR SECTIONS */
.section {
  margin-bottom: 40px;
  scroll-margin-top: calc(var(--topnav-h) + 20px);
}

.section-title {
  font-family: var(--serif);
  font-size: 20px;
  font-weight: 400;
  color: var(--cream);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-title::before {
  content: '';
  display: block;
  width: 3px;
  height: 20px;
  background: linear-gradient(to bottom, var(--gold), transparent);
  border-radius: 3px;
}

.section-sub {
  font-size: 12px;
  color: var(--dim);
  margin-bottom: 20px;
  margin-left: 13px;
}

/* CARDS */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border2);
}

.card-title {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dim);
}

.card-body { padding: 20px; }

/* GRIDS */
.grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 20px; }
.grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-bottom: 20px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.grid-7030 { display: grid; grid-template-columns: 1fr 300px; gap: 20px; margin-bottom: 20px; }
.mb20 { margin-bottom: 20px; }

/* STAT CARD */
.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px 20px;
  position: relative;
  overflow: hidden;
}
.stat-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--gold), transparent);
}
.stat-label { font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); margin-bottom: 8px; }
.stat-value { font-family: var(--mono); font-size: 22px; font-weight: 500; color: var(--cream); line-height: 1; margin-bottom: 5px; }
.stat-change { font-size: 12px; font-weight: 500; display: flex; align-items: center; gap: 4px; }
.stat-change.up { color: var(--green); }
.stat-change.down { color: var(--red); }
.stat-change.neutral { color: var(--dim); }

/* TABLE */
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
thead th { padding: 10px 14px; text-align: left; font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); border-bottom: 1px solid var(--border2); white-space: nowrap; }
thead th.right { text-align: right; }
tbody tr { border-bottom: 1px solid rgba(184,150,78,0.04); cursor: pointer; transition: background 0.15s; }
tbody tr:hover { background: rgba(184,150,78,0.03); }
tbody tr:last-child { border-bottom: none; }
tbody td { padding: 11px 14px; color: var(--cream); font-weight: 300; }
tbody td.right { text-align: right; font-family: var(--mono); font-size: 12px; }
tbody td.mono { font-family: var(--mono); font-size: 12px; }

/* PILLS */
.pill { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 500; font-family: var(--mono); }
.pill.up { background: var(--green-bg); color: var(--green); border: 1px solid rgba(74,222,128,0.2); }
.pill.down { background: var(--red-bg); color: var(--red); border: 1px solid rgba(248,113,113,0.2); }
.pill.neutral { background: rgba(245,240,232,0.05); color: var(--dim); border: 1px solid var(--border2); }
.sector-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; letter-spacing: 0.04em; background: rgba(184,150,78,0.08); color: var(--gold); border: 1px solid rgba(184,150,78,0.15); }

/* SEARCH */
.search-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.search-input { flex: 1; min-width: 200px; padding: 10px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; font-family: var(--sans); font-size: 14px; color: var(--cream); outline: none; transition: border-color 0.2s; }
.search-input:focus { border-color: var(--gold); }
.search-input::placeholder { color: var(--dim); }
.filter-btn { padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; color: var(--muted); font-family: var(--sans); font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.18s; white-space: nowrap; }
.filter-btn:hover, .filter-btn.active { border-color: var(--gold); color: var(--gold); background: rgba(184,150,78,0.05); }

/* CHART */
.chart-container { position: relative; height: 200px; }
.chart-container.tall { height: 280px; }
.chart-container.short { height: 140px; }

/* EMPTY */
.empty-state { text-align: center; padding: 50px 20px; color: var(--dim); }
.empty-icon { font-size: 32px; margin-bottom: 12px; opacity: 0.4; }
.empty-title { font-family: var(--serif); font-size: 17px; color: var(--muted); margin-bottom: 5px; }
.empty-text { font-size: 13px; }

/* RESPONSIVE */
@media (max-width: 1024px) {
  .grid-4 { grid-template-columns: repeat(2,1fr); }
  .grid-7030 { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .page-content { padding: 20px 16px; }
  .grid-3 { grid-template-columns: 1fr; }
  .grid-2 { grid-template-columns: 1fr; }
  .tc-nav-link .nav-label { display: none; }
}
</style>
`;

function initNav(activePage = '') {
  // Inject Google Fonts if not already loaded
  if (!document.querySelector('link[href*="Playfair"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;700&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap';
    document.head.appendChild(link);
  }

  // Inject CSS
  document.head.insertAdjacentHTML('beforeend', NAV_CSS);

  // Build nav HTML
  const itemsHTML = NAV_PAGES.map(p => {
    const isActive = p.id === activePage;
    const hasSub = p.sub && p.sub.length > 0;
    const dropHTML = hasSub
      ? `<div class="tc-dropdown">${p.sub.map(s =>
          `<a href="${p.href}${s.anchor}">${s.label}</a>`
        ).join('')}</div>`
      : '';

    return `<div class="tc-nav-item">
      <a class="tc-nav-link ${isActive ? 'active' : ''}" href="${p.href}">
        <span class="nav-icon">${p.icon}</span>
        <span class="nav-label">${p.label}</span>
        ${hasSub ? '<span class="nav-arrow">▾</span>' : ''}
      </a>
      ${dropHTML}
    </div>`;
  }).join('');

  const navHTML = `
  <nav id="tc-topnav">
    <a class="tc-nav-logo" href="app.html">THE <span>·</span> CAPITAL</a>
    <div class="tc-nav-items">${itemsHTML}</div>
    <div class="tc-nav-right">
      <div class="tc-nav-badge">
        <div class="tc-live-dot"></div>
        BRVM Live
      </div>
      <div class="tc-nav-time" id="tc-clock"></div>
    </div>
  </nav>`;

  document.body.insertAdjacentHTML('afterbegin', navHTML);

  // Clock
  function updateClock() {
    const el = document.getElementById('tc-clock');
    if (el) el.textContent = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }) + ' GMT';
  }
  setInterval(updateClock, 1000);
  updateClock();
}

// ═══════════════════════════════════════
// SUPABASE HELPERS (partagés)
// ═══════════════════════════════════════
const SB_URL = 'https://otsiwiwlnowxeolbbgvm.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90c2l3aXdsbb3d4ZW9sYmJndm0iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcyMjk3MzY0OSwiZXhwIjoyMDM4NTQ5NjQ5fQ.HZ5xbUhQKLRhRPl7VYdQZrWPJUZsEJLIvp8_zQXLmVA';

async function sbQuery(table, params = {}) {
  const url = new URL(`${SB_URL}/rest/v1/${table}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  const r = await fetch(url, {
    headers: { 'Authorization': `Bearer ${SB_KEY}`, 'apikey': SB_KEY, 'Accept': 'application/json' }
  });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

// FORMAT HELPERS
const fmt = (n, d = 0) => (n == null || isNaN(+n)) ? '—' : (+n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateShort = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—';
const fmtM = n => {
  if (n == null || isNaN(+n)) return '—';
  const v = +n;
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + ' Mrd';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(0) + ' M';
  return fmt(v);
};
function changePill(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return '<span class="pill neutral">—</span>';
  if (n > 0) return `<span class="pill up">▲ ${n.toFixed(2)}%</span>`;
  if (n < 0) return `<span class="pill down">▼ ${Math.abs(n).toFixed(2)}%</span>`;
  return '<span class="pill neutral">= 0.00%</span>';
}
const SECTORS = {
  SGBC: 'Banque', BICC: 'Banque', ETIT: 'Telecom', NTLC: 'Telecom',
  SAFC: 'Finance', PALM: 'Agro', SIVC: 'Agro', SOLB: 'Distribution',
  BOAB: 'Banque', BOAN: 'Banque', ONAB: 'Agro', CABC: 'Agro',
  TTLS: 'Industrie', SHEC: 'Industrie'
};
function getSector(t) {
  if (!t) return 'Divers';
  for (const [k, v] of Object.entries(SECTORS)) if (t.startsWith(k)) return v;
  return 'Divers';
}

// CHART DEFAULT OPTIONS
const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1A1610',
      borderColor: 'rgba(184,150,78,0.3)',
      borderWidth: 1,
      titleColor: '#B8964E',
      bodyColor: '#F5F0E8',
      padding: 12,
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(184,150,78,0.04)' },
      ticks: { color: 'rgba(245,240,232,0.3)', font: { size: 10, family: 'DM Mono' }, maxTicksLimit: 8 }
    },
    y: {
      position: 'right',
      grid: { color: 'rgba(184,150,78,0.06)' },
      ticks: { color: 'rgba(245,240,232,0.3)', font: { size: 10, family: 'DM Mono' }, callback: v => fmt(v) }
    }
  }
};

function mkLineDataset(vals, color = '#B8964E') {
  return {
    data: vals, borderColor: color, borderWidth: 2,
    pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: color,
    fill: true, tension: 0.3,
    backgroundColor: ctx => {
      const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
      g.addColorStop(0, color + '22');
      g.addColorStop(1, color + '00');
      return g;
    }
  };
}
