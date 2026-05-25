// ═══════════════════════════════════════
// VIEW — BOC (Bulletin Officiel de la Cote)
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// BOC
// ═══════════════════════════════════════
function renderBoc() {
  window._bocRows = allBoc;
  filterBoc();
}

function setBocFilter(f, btn) {
  _bocFilter = f;
  document.querySelectorAll('#view-boc .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterBoc();
}

function filterBoc() {
  const q = (document.getElementById('searchBoc')?.value || '').toLowerCase();
  const yearFilter = document.getElementById('bocYearFilter')?.value;
  let rows = [...(window._bocRows || [])];

  if (q) {
    rows = rows.filter(r => 
      (r.date_seance || '').includes(q) ||
      (r.numero_seance || '').toString().includes(q)
    );
  }

  if (yearFilter) {
    rows = rows.filter(r => (r.annee || '').toString() === yearFilter);
  }

  if (_bocFilter === 'week') {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    rows = rows.filter(r => new Date(r.date_seance) >= weekAgo);
  } else if (_bocFilter === 'month') {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    rows = rows.filter(r => new Date(r.date_seance) >= monthAgo);
  }

  document.getElementById('bocCount').textContent = (window._bocRows || []).length;
  const lastSession = window._bocRows?.[0];
  document.getElementById('bocLastDate').textContent = lastSession ? fmtDate(lastSession.date_seance) : '—';
  document.getElementById('bocResultCount').textContent = rows.length + ' séance(s)';
  document.getElementById('bocCurrentYear').textContent = new Date().getFullYear();

  const tbody = document.getElementById('bocTable');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--dim)">Aucune séance trouvée</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(boc => {
    const dateObj = new Date(boc.date_seance);
    const jourSemaine = dateObj.toLocaleDateString('fr-FR', { weekday: 'long' });
    const jourCapitalized = jourSemaine.charAt(0).toUpperCase() + jourSemaine.slice(1);
    const isToday = boc.date_seance === new Date().toISOString().split('T')[0];
    const statutClass = isToday ? 'up' : 'neutral';
    const statutLabel = isToday ? 'Aujourd\'hui' : 'Publié';

    return `<tr>
      <td><strong style="color:var(--cream)">${fmtDate(boc.date_seance)}</strong></td>
      <td style="color:var(--muted);text-transform:capitalize">${jourCapitalized}</td>
      <td class="right" style="font-family:var(--mono);color:var(--gold)">#${boc.numero_seance}</td>
      <td><span class="pill ${statutClass}">${statutLabel}</span></td>
      <td class="right">
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <a href="${boc.pdf_url}" target="_blank" class="filter-btn" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px">
            📄 Ouvrir
          </a>
          <a href="${boc.pdf_url}" download class="filter-btn" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px">
            ⬇ Télécharger
          </a>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openBocPdf(url, date) {
  if (!url) {
    toast('PDF non disponible pour cette séance', 'warn');
    return;
  }
  window.open(url, '_blank');
}