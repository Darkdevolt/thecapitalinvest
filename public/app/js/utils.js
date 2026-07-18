// ═══════════════════════════════════════
// UTILS — The Capital BRVM
// ═══════════════════════════════════════
// Guard pattern: empêche le double chargement
(function() {
  if (window.__TC_UTILS_LOADED__) {
    console.log('[UTILS] Déjà chargé, skip.');
    return;
  }
  window.__TC_UTILS_LOADED__ = true;

  // ═══════════════════════════════════════
  // TOAST SYSTEM (avec vérification DOM)
  // ═══════════════════════════════════════
  window.toast = function(msg, type='info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    el.style.cssText = `
      background: ${type === 'error' ? '#c0392b' : type === 'success' ? '#27ae60' : '#B8964E'};
      color: #fff; padding: 12px 20px; border-radius: 8px;
      font-family: 'DM Sans', sans-serif; font-size: 13px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.3s ease; opacity: 1; transform: translateX(0);
      max-width: 320px; word-break: break-word;
    `;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      setTimeout(() => { if (el.parentNode) el.remove(); }, 300);
    }, 4000);
  };

  // ═══════════════════════════════════════
  // CONFIG SUPABASE (MASQUÉE — utiliser proxy API)
  // ═══════════════════════════════════════
  // ⚠️ NE JAMAIS EXPOSER LA CLÉ SUPABASE CÔTÉ CLIENT
  // La clé a été retirée — tous les appels passent par /api/*
  window.SB_URL = null; // Désactivé côté client
  window.SB_KEY = null; // Désactivé côté client
  window.SK = 'tc_session';

  // ═══════════════════════════════════════
  // HELPERS (correction fmtM)
  // ═══════════════════════════════════════
  window.fmt = function(n, d = 0) {
    if (n == null || isNaN(+n)) return '—';
    return (+n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  window.fmtDate = function(d) {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
    } catch(e) { return '—'; }
  };

  // CORRECTION: variable 'v' utilisée au lieu de paramètre 'n'
  window.fmtM = function(n) {
    if (n == null || isNaN(+n)) return '—';
    const v = +n;
    if (Math.abs(v) >= 1e9) return (v/1e9).toFixed(1) + ' Mrd';
    if (Math.abs(v) >= 1e6) return (v/1e6).toFixed(0) + ' M';
    return fmt(v);
  };

  window.changePill = function(v) {
    const n = parseFloat(v);
    if (isNaN(n)) return '—';
    if (n > 0) return `▲ ${n.toFixed(2)}%`;
    if (n < 0) return `▼ ${Math.abs(n).toFixed(2)}%`;
    return '= 0.00%';
  };

  // ═══════════════════════════════════════
  // SECTEURS BRVM (complété avec tous les tickers)
  // ═══════════════════════════════════════
  window.SECTORS = {
    // Banques
    SGBC: 'Banque', BICC: 'Banque', BOAB: 'Banque', BOAN: 'Banque',
    CORIS: 'Banque', NSBC: 'Banque', ORGB: 'Banque', SIBC: 'Banque',
    // Telecom
    ETIT: 'Telecom', NTLC: 'Telecom',
    // Finance / Assurance
    SAFC: 'Finance', SICC: 'Finance', SONAR: 'Finance', WARA: 'Finance',
    // Agro-industrie
    PALM: 'Agro', SIVC: 'Agro', ONAB: 'Agro', CABC: 'Agro', SPCI: 'Agro',
    SPHC: 'Agro', SOGC: 'Agro', SICOR: 'Agro',
    // Distribution
    SOLB: 'Distribution', CASH: 'Distribution', CMAC: 'Distribution',
    // Industrie
    TTLS: 'Industrie', SHEC: 'Industrie', SOTRA: 'Industrie', STAC: 'Industrie',
    // Transport
    SOTR: 'Transport',
    // Énergie
    CIE: 'Energie', SODECI: 'Energie',
    // BTP
    CGR: 'BTP', SICABLE: 'BTP',
    // Holding
    BOL: 'Holding', CFAC: 'Holding', BOAS: 'Holding',
    // Santé
    PHPC: 'Sante',
    // Technologie
    UNLC: 'Technologie', VIVO: 'Technologie',
    // Mines
    SEM: 'Mines',
    // Autres
    BOAM: 'Divers', ECOC: 'Divers'
  };

  window.getSector = function(t) {
    if (!t) return 'Divers';
    // Recherche exacte d'abord
    if (SECTORS[t]) return SECTORS[t];
    // Recherche par préfixe (ordre décroissant pour éviter match partiel)
    const keys = Object.keys(SECTORS).sort((a, b) => b.length - a.length);
    for (const k of keys) {
      if (t.startsWith(k)) return SECTORS[k];
    }
    return 'Divers';
  };

  // ═══════════════════════════════════════
  // CHART DEFAULTS (chartOpts — alias chartDefaults)
  // ═══════════════════════════════════════
  window.chartOpts = {
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

  // ALIAS: chartDefaults pour compatibilité avec marche.js
  window.chartDefaults = window.chartOpts;

  window.mkDataset = function(vals, color = '#B8964E', label = '') {
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
  };

  window.mkLineDataset = function(vals, color, label, width = 1.5) {
    return { label, data: vals, borderColor: color, borderWidth: width, pointRadius: 0, pointHoverRadius: 3, fill: false, tension: 0.3 };
  };

  // ═══════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════
  window.debounce = function(fn, ms) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  };

  window.throttle = function(fn, ms) {
    let last = 0;
    return function(...args) {
      const now = Date.now();
      if (now - last >= ms) {
        last = now;
        fn.apply(this, args);
      }
    };
  };

  // Safe JSON parse
  window.safeJSON = function(str, fallback = null) {
    try { return JSON.parse(str); } catch(e) { return fallback; }
  };

  console.log('[UTILS] Chargé avec succès');

})();
