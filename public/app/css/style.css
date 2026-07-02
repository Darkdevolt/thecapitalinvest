// ═══════════════════════════════════════
// UTILITAIRES & COMPONENTS
// ═══════════════════════════════════════

// ─── FORMATTERS ───
function fmt(n, d) {
  if (n == null || isNaN(n)) return '—';
  d = d || 0;
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtM(n) {
  if (n == null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e9) return fmt(n / 1e9, 2) + ' Mds';
  if (Math.abs(n) >= 1e6) return fmt(n / 1e6, 2) + ' M';
  if (Math.abs(n) >= 1e3) return fmt(n / 1e3, 2) + ' K';
  return fmt(n, 0);
}

function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date)) return String(d);
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── SECTOR & PAYS HELPERS ───
function getSector(ticker) {
  const e = entMap && entMap[ticker];
  const s = e && e.secteur ? e.secteur : 'Autre';
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function getPays(ticker) {
  const e = entMap && entMap[ticker];
  return (e && e.pays) || 'UEMOA';
}

// ─── EMPTY STATE ───
function emptyState(msg) {
  return '<tr><td colspan="99" class="tc-empty">' + (msg || 'Aucune donnée') + '</td></tr>';
}

// ─── TICKER ROW (ligne de tableau pour un titre) ───
function tickerRow(c, opts) {
  opts = opts || {};
  const v = parseFloat(c.variation) || 0;
  const cls = v > 0 ? 'up' : v < 0 ? 'down' : 'neutral';
  const sign = v > 0 ? '+' : '';
  const sector = getSector(c.ticker);
  const sectorClass = sector.replace(/[^a-z-]/g, '');
  const ent = entMap && entMap[c.ticker];
  const nom = ent && ent.nom ? ent.nom : '';
  const pays = getPays(c.ticker);

  let html = '<tr onclick="openFiche(\'' + c.ticker + '\')">' +
    '<td class="ticker-cell">' + c.ticker + '</td>';

  if (opts.showCompany) {
    html += '<td class="company-cell">' + nom + '</td>';
  }

  html += '<td class="price-cell right">' + fmt(c.cours, 0) + '</td>' +
    '<td class="var-cell right"><span class="pill ' + cls + '">' + sign + v.toFixed(2) + '%</span></td>';

  if (opts.show52Week) {
    html += '<td class="right mono">' + (c.high_52 || '—') + '</td>' +
      '<td class="right mono">' + (c.low_52 || '—') + '</td>';
  }

  html += '<td class="vol-cell right">' + fmt(c.volume) + '</td>';

  if (opts.showCapital) {
    html += '<td class="cap-cell right">' + (c.capitalisation ? fmtM(c.capitalisation) : '—') + '</td>';
  }

  html += '<td class="sector-cell right"><span class="sector-badge ' + sectorClass + '">' + (ent && ent.secteur ? ent.secteur : 'Autre') + '</span></td>' +
    '</tr>';

  return html;
}

// ─── TOAST ───
function toast(msg, type) {
  type = type || 'info';
  const container = document.querySelector('.toast-container') || (function() {
    const el = document.createElement('div');
    el.className = 'toast-container';
    document.body.appendChild(el);
    return el;
  })();

  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  container.appendChild(t);

  setTimeout(function() {
    t.style.opacity = '0';
    t.style.transform = 'translateX(20px)';
    setTimeout(function() { t.remove(); }, 300);
  }, 4000);
}

// ─── GLOBAL SEARCH ───
function initGlobalSearch() {
  const input = document.getElementById('globalSearch');
  const results = document.getElementById('globalSearchResults');
  if (!input || !results) return;

  input.addEventListener('input', debounce(function(e) {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      results.classList.remove('open');
      return;
    }

    const matches = (allCours || []).filter(function(c) {
      return c && c.ticker && (
        c.ticker.toLowerCase().includes(q) ||
        (entMap[c.ticker] && entMap[c.ticker].nom && entMap[c.ticker].nom.toLowerCase().includes(q))
      );
    }).slice(0, 8);

    if (!matches.length) {
      results.innerHTML = '<div class="gsr-item"><span class="gsr-name">Aucun résultat</span></div>';
    } else {
      results.innerHTML = matches.map(function(c) {
        const ent = entMap[c.ticker];
        return '<div class="gsr-item" onclick="openFiche(\'' + c.ticker + '\');document.getElementById(\'globalSearchResults\').classList.remove(\'open\');">' +
          '<div><span class="gsr-ticker">' + c.ticker + '</span><span class="gsr-name">' + (ent && ent.nom ? ' — ' + ent.nom : '') + '</span></div>' +
          '<span class="gsr-sector">' + (ent && ent.secteur ? ent.secteur : 'Autre') + '</span>' +
        '</div>';
      }).join('');
    }
    results.classList.add('open');
  }, 200));

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.global-search')) {
      results.classList.remove('open');
    }
  });
}
