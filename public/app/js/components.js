// ═══════════════════════════════════════
// UTILITAIRES & COMPONENTS (corrigé)
// ═══════════════════════════════════════
// Chargé après utils.js. Les helpers restent protégés pour éviter les
// redéclarations et conservent une sortie cohérente en cas de donnée absente.

if (typeof window.fmt === 'undefined') {
  window.fmt = function(n, d) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    d = Number.isFinite(Number(d)) ? Number(d) : 0;
    return Number(n).toLocaleString('fr-FR', {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    });
  };
}

if (typeof window.fmtM === 'undefined') {
  window.fmtM = function(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    n = Number(n);
    if (Math.abs(n) >= 1e9) return fmt(n / 1e9, 2) + ' Mds';
    if (Math.abs(n) >= 1e6) return fmt(n / 1e6, 2) + ' M';
    if (Math.abs(n) >= 1e3) return fmt(n / 1e3, 2) + ' K';
    return fmt(n, 0);
  };
}

if (typeof window.fmtDate === 'undefined') {
  window.fmtDate = function(d) {
    if (!d) return '—';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };
}

if (typeof window.getSector === 'undefined') {
  window.getSector = function(ticker) {
    const e = (typeof entMap !== 'undefined' && entMap) ? entMap[ticker] : null;
    const s = e && e.secteur ? e.secteur : 'Autre';
    return s.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^-a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };
}

if (typeof window.getPays === 'undefined') {
  window.getPays = function(ticker) {
    const e = (typeof entMap !== 'undefined' && entMap) ? entMap[ticker] : null;
    return (e && e.pays) || 'UEMOA';
  };
}

if (typeof window.emptyState === 'undefined') {
  window.emptyState = function(msg) {
    return '<tr><td colspan="99" class="tc-empty">' + (msg || 'Aucune donnée disponible.') + '</td></tr>';
  };
}

if (typeof window.tickerRow === 'undefined') {
  window.tickerRow = function(c, opts) {
    opts = opts || {};
    c = c || {};

    const v = Number.parseFloat(c.variation);
    const variation = Number.isFinite(v) ? v : 0;
    const cls = variation > 0 ? 'up' : variation < 0 ? 'down' : 'neutral';
    const sign = variation > 0 ? '+' : '';
    const ticker = String(c.ticker || '');
    const ent = (typeof entMap !== 'undefined' && entMap) ? entMap[ticker] : null;
    const nom = ent && ent.nom ? ent.nom : '—';
    const secteur = ent && ent.secteur ? ent.secteur : 'Autre';
    const sectorClass = getSector(ticker).replace(/[^a-z-]/g, '');

    let html = '<tr data-ticker="' + escapeHtml(ticker) + '" role="button" tabindex="0">' +
      '<td class="ticker-cell">' + escapeHtml(ticker) + '</td>';

    if (opts.showCompany) {
      html += '<td class="company-cell">' + escapeHtml(nom) + '</td>';
    }

    html += '<td class="price-cell right">' + fmt(c.cours, 0) + '</td>' +
      '<td class="var-cell right"><span class="pill ' + cls + '">' + sign + variation.toFixed(2) + '%</span></td>';

    if (opts.show52Week) {
      html += '<td class="right mono">' + (c.high_52 != null ? fmt(c.high_52, 0) : '—') + '</td>' +
        '<td class="right mono">' + (c.low_52 != null ? fmt(c.low_52, 0) : '—') + '</td>';
    }

    html += '<td class="vol-cell right">' + fmt(c.volume, 0) + '</td>';

    if (opts.showCapital) {
      html += '<td class="cap-cell right">' + (c.capitalisation != null ? fmtM(c.capitalisation) : '—') + '</td>';
    }

    html += '<td class="sector-cell right"><span class="sector-badge ' + sectorClass + '">' + escapeHtml(secteur) + '</span></td>' +
      '</tr>';

    return html;
  };
}

if (typeof window.toast === 'undefined') {
  window.toast = function(msg, type) {
    type = type || 'info';
    const container = document.querySelector('.toast-container') || (function() {
      const el = document.createElement('div');
      el.className = 'toast-container';
      document.body.appendChild(el);
      return el;
    })();

    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = String(msg == null ? '' : msg);
    container.appendChild(t);

    setTimeout(function() {
      t.style.opacity = '0';
      t.style.transform = 'translateX(20px)';
      setTimeout(function() { t.remove(); }, 300);
    }, 4000);
  };
}

if (typeof window.initGlobalSearch === 'undefined') {
  window.initGlobalSearch = function() {
    const input = document.getElementById('globalSearchInput');
    const results = document.getElementById('globalSearchResults');
    if (!input || !results || input.dataset.tcInitialized === '1') return;
    input.dataset.tcInitialized = '1';

    const renderResults = function(matches) {
      if (!matches.length) {
        results.innerHTML = '<div class="gsr-item"><span class="gsr-name">Aucun résultat</span></div>';
      } else {
        results.innerHTML = matches.map(function(c) {
          const ticker = String(c.ticker || '');
          const ent = (typeof entMap !== 'undefined' && entMap) ? entMap[ticker] : null;
          const name = ent && ent.nom ? ent.nom : ticker;
          const sector = ent && ent.secteur ? ent.secteur : 'Autre';
          return '<div class="gsr-item" data-search-ticker="' + escapeHtml(ticker) + '" role="option" tabindex="-1">' +
            '<div><span class="gsr-ticker">' + escapeHtml(ticker) + '</span><span class="gsr-name">' + escapeHtml(name) + '</span></div>' +
            '<span class="gsr-sector">' + escapeHtml(sector) + '</span>' +
          '</div>';
        }).join('');
      }
      results.classList.add('open');
    };

    input.addEventListener('input', debounce(function(e) {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        results.classList.remove('open');
        results.innerHTML = '';
        return;
      }

      const source = Array.isArray(window.allCours) ? window.allCours : [];
      const byTicker = {};
      source.forEach(function(c) {
        if (c && c.ticker && !byTicker[c.ticker]) byTicker[c.ticker] = c;
      });

      const matches = Object.values(byTicker).filter(function(c) {
        const ticker = String(c.ticker || '').toLowerCase();
        const name = ((entMap[c.ticker] && entMap[c.ticker].nom) || '').toLowerCase();
        return ticker.includes(q) || name.includes(q);
      }).slice(0, 8);

      renderResults(matches);
    }, 200));

    results.addEventListener('click', function(e) {
      const item = e.target.closest('[data-search-ticker]');
      if (!item) return;
      const ticker = item.getAttribute('data-search-ticker');
      if (ticker && typeof window.openFiche === 'function') window.openFiche(ticker, 'overview');
      results.classList.remove('open');
      input.value = '';
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        results.classList.remove('open');
        input.blur();
      }
    });

    document.addEventListener('click', function(e) {
      if (!e.target.closest('#globalSearch')) results.classList.remove('open');
    });
  };
}

if (typeof window.debounce === 'undefined') {
  window.debounce = function(fn, ms) {
    let timer;
    const wait = Number.isFinite(Number(ms)) ? Number(ms) : 0;
    return function() {
      const context = this;
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() {
        fn.apply(context, args);
      }, wait);
    };
  };
}
