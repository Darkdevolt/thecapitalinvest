// THE CAPITAL, Dividend Screener
// Valeur propre par rapport au Screener principal (screener.js, qui a déjà une
// colonne rendement) : trajectoire du dividende sur plusieurs exercices,
// signal de soutenabilité (payout ratio via financials), détachements à venir
// mis en avant, et comparaison au rendement médian du secteur.
// Sources : window.allDividendes (dividendes_calendrier) et window.allFinancials
// (financials), chargées une fois par loader.js et partagées par toute l'app —
// pas de fetch dédié ici, comme dans screener.js / opportunites.js.
(function () {
  if (window.__TC_DIVIDEND_SCREENER_LOADED__) return;
  window.__TC_DIVIDEND_SCREENER_LOADED__ = true;

  const esc = value => { const d = document.createElement('div'); d.textContent = value == null ? '' : String(value); return d.innerHTML; };
  const n = value => { if (value === '' || value == null) return null; const num = Number(value); return Number.isFinite(num) ? num : null; };
  const pct = value => value == null ? 'Donnée non disponible' : `${Number(value).toFixed(2)} %`;
  const ymd = value => value ? String(value).slice(0, 10) : '';

  function dividendes() { return Array.isArray(window.allDividendes) ? window.allDividendes : []; }
  function financials() { return Array.isArray(window.allFinancials) ? window.allFinancials : []; }
  function sectorOf(ticker) {
    const e = (window.entMap && window.entMap[ticker]) || {};
    return e.sous_secteur || e.secteur || null;
  }

  function median(values) {
    const a = values.filter(v => v != null && Number.isFinite(v)).slice().sort((x, y) => x - y);
    if (!a.length) return null;
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  // Historique complet par ticker (toutes années confondues, indépendant du
  // filtre Exercice) pour la trajectoire du dividende — trié du plus ancien
  // au plus récent.
  function buildHistoryByTicker() {
    const map = {};
    dividendes().forEach(r => {
      const ticker = String(r.ticker || '').toUpperCase();
      const exercice = n(r.exercice ?? r.annee);
      if (!ticker || exercice == null) return;
      (map[ticker] || (map[ticker] = [])).push({ exercice, montant: n(r.montant_net ?? r.montant) });
    });
    Object.keys(map).forEach(t => map[t].sort((a, b) => a.exercice - b.exercice));
    return map;
  }

  // Nombre d'exercices consécutifs, en partant du plus récent, avec un
  // dividende versé (montant renseigné) — signal de régularité brut, sans
  // présumer d'une progression.
  function streakFromHistory(history) {
    let count = 0, prevYear = null;
    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i];
      if (h.montant == null) break;
      if (prevYear != null && prevYear - h.exercice !== 1) break;
      count++; prevYear = h.exercice;
    }
    return count;
  }

  // Financials le plus proche de l'exercice du dividende (même année, sinon
  // année antérieure la plus récente, sinon dernier exercice connu).
  function finFor(ticker, year) {
    /* Exercices annuels seulement : un semestre ou un cumul trimestriel de la même année n'a ni DPA ni payout. */
    const list = financials().filter(f => String(f.ticker || '').toUpperCase() === ticker && (!f.periode || String(f.periode).toLowerCase() === 'annuel')).sort((a, b) => n(b.annee) - n(a.annee));
    if (!list.length) return null;
    return list.find(f => n(f.annee) === year) || list.find(f => year == null || n(f.annee) <= year) || list[0];
  }

  // payout_ratio est déjà calculé côté admin (public/admin/js/financials/financials-schema.js)
  // et stocké sur financials.payout_ratio ; on retombe sur le même calcul
  // (dpa/bpa, sinon dpa×actions/résultat net) quand la colonne est vide.
  function payoutRatioFor(f) {
    if (!f) return null;
    const stored = n(f.payout_ratio);
    if (stored != null) return stored;
    const dpa = n(f.dpa), bpa = n(f.bpa), rn = n(f.resultat_net), actions = n(f.nombre_actions ?? f.nb_actions);
    if (dpa != null && bpa != null && bpa > 0) return (dpa / bpa) * 100;
    if (dpa != null && rn != null && rn > 0 && actions) return (dpa * actions / rn) * 100;
    return null;
  }

  function sparklineSvg(history) {
    const vals = history.map(h => h.montant).filter(v => v != null);
    if (vals.length < 2) return '';
    const w = 84, h = 22, pad = 2;
    const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1;
    const stepX = (w - pad * 2) / (vals.length - 1);
    const pts = vals.map((v, i) => `${(pad + i * stepX).toFixed(1)},${(h - pad - ((v - min) / range) * (h - pad * 2)).toFixed(1)}`).join(' ');
    const color = vals[vals.length - 1] >= vals[0] ? 'var(--green)' : 'var(--red)';
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="div-spark"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6"/></svg>`;
  }

  function historyCell(history) {
    if (!history || history.length < 2) return '<span style="color:var(--dim)">—</span>';
    const title = history.map(h => `${h.exercice}: ${h.montant != null ? h.montant : '—'}`).join(' · ');
    return `<span title="${esc(title)}">${sparklineSvg(history)}</span>`;
  }

  function qualityCell(ratio, streakCount) {
    const badges = [];
    if (ratio != null) {
      const cls = ratio > 100 ? 'warn' : (ratio > 80 ? 'muted' : 'ok');
      badges.push(`<span class="div-badge ${cls}">Payout ${Math.round(ratio)} %${ratio > 100 ? ' ⚠' : ''}</span>`);
    }
    if (streakCount >= 2) badges.push(`<span class="div-badge muted">${streakCount} ans consécutifs</span>`);
    return badges.length ? `<div class="div-badges">${badges.join('')}</div>` : '<span style="color:var(--dim)">—</span>';
  }

  function sectorSubline(yieldValue, sectorMedian) {
    if (yieldValue == null || sectorMedian == null) return '';
    const diff = yieldValue - sectorMedian;
    if (Math.abs(diff) < 0.05) return `<div class="div-sub">≈ médiane secteur</div>`;
    const cls = diff > 0 ? 'ok' : 'muted';
    const arrow = diff > 0 ? '▲' : '▼';
    return `<div class="div-sub ${cls}">${arrow} médiane secteur (${pct(sectorMedian)})</div>`;
  }

  // Reconstruit la liste des exercices disponibles seulement si elle a
  // changé, pour rester correcte même quand ce rendu est rejoué avant que
  // window.allDividendes ne soit peuplé (premier rendu à froid, données
  // arrivant en tâche de fond) sans perdre la sélection en cours.
  function syncYearOptions(rows) {
    const select = document.getElementById('divYear');
    if (!select) return;
    const years = [...new Set(rows.map(r => r.exercice ?? r.annee).filter(Boolean))].sort((a, b) => b - a).map(String);
    const current = Array.from(select.options).slice(1).map(o => o.value);
    if (current.length === years.length && current.every((v, i) => v === years[i])) return;
    const prevValue = select.value;
    select.innerHTML = '<option value="">Tous</option>' + years.map(y => `<option value="${esc(y)}">${esc(y)}</option>`).join('');
    if (years.includes(prevValue)) select.value = prevValue;
  }

  function daysLabel(days) {
    if (days === 0) return "aujourd'hui";
    if (days === 1) return 'demain';
    return `dans ${days} jours`;
  }

  // Détachements dont la date tombe dans les 45 prochains jours, tous
  // exercices confondus (indépendant du filtre Exercice de la liste
  // principale) — remontés à part plutôt que noyés dans un tableau trié par
  // rendement.
  function upcomingDetachments() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const horizon = new Date(today.getTime() + 45 * 86400000);
    return dividendes()
      .map(r => {
        const dateStr = ymd(r.date_detachement ?? r.ex_date);
        if (!dateStr) return null;
        const d = new Date(dateStr + 'T00:00:00');
        if (Number.isNaN(d.getTime()) || d < today || d > horizon) return null;
        return {
          ticker: String(r.ticker || '').toUpperCase(),
          date: dateStr,
          paiement: ymd(r.date_paiement_cal ?? r.date_paiement),
          yieldValue: n(r.taux_rendement ?? r.rendement),
          statut: r.statut || '',
          days: Math.round((d - today) / 86400000)
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.days - b.days);
  }

  function renderUpcoming() {
    const card = document.getElementById('divUpcomingCard');
    const tbody = document.getElementById('divUpcomingTable');
    if (!card || !tbody) return;
    const list = upcomingDetachments();
    card.style.display = list.length ? '' : 'none';
    if (!list.length) return;
    tbody.innerHTML = list.map(u => `<tr>
      <td><strong style="color:var(--gold)">${esc(u.ticker)}</strong></td>
      <td>${esc(u.date.split('-').reverse().join('/'))} <span class="div-sub ok">${esc(daysLabel(u.days))}</span></td>
      <td>${u.paiement ? esc(u.paiement.split('-').reverse().join('/')) : '—'}</td>
      <td class="right">${pct(u.yieldValue)}</td>
      <td>${esc(u.statut || '—')}</td>
    </tr>`).join('');
  }

  function injectCss() {
    if (document.getElementById('tc-dividend-screener-css')) return;
    const s = document.createElement('style');
    s.id = 'tc-dividend-screener-css';
    s.textContent = [
      '#view-dividend-screener .div-badges{display:flex;flex-direction:column;gap:3px;align-items:flex-start}',
      '#view-dividend-screener .div-badge{font-size:9px;padding:2px 7px;border-radius:999px;border:1px solid;white-space:nowrap;letter-spacing:.02em}',
      '#view-dividend-screener .div-badge.ok{color:var(--green);border-color:rgba(74,222,128,.4)}',
      '#view-dividend-screener .div-badge.warn{color:var(--red);border-color:rgba(248,113,113,.4)}',
      '#view-dividend-screener .div-badge.muted{color:var(--dim);border-color:var(--border2)}',
      '#view-dividend-screener .div-sub{font-size:9px;margin-top:2px}',
      '#view-dividend-screener .div-sub.ok{color:var(--green)}',
      '#view-dividend-screener .div-sub.muted{color:var(--dim)}',
      '#view-dividend-screener .div-spark{display:block}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function renderDividendScreener() {
    const view = document.getElementById('view-dividend-screener');
    if (!view) return;
    injectCss();

    // Reconstruire tout le DOM efface les filtres en cours de saisie : une
    // fois la structure posée, les rafraîchissements suivants (données
    // asynchrones qui arrivent après le premier rendu) ne font que rejouer
    // apply() sur les données à jour.
    if (view.dataset.tcBuilt === '1') { renderUpcoming(); apply(); return; }
    view.dataset.tcBuilt = '1';

    view.innerHTML = `
      <div class="page-header"><h1>Dividend <span style="color:var(--gold)">Screener</span></h1><p>Filtrez les sociétés selon le rendement, la croissance et la régularité du dividende, à partir du calendrier BRVM.</p></div>
      <div class="card mb20" id="divUpcomingCard" style="display:none">
        <div class="card-header"><div class="card-title">Détachements à venir</div></div>
        <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Détachement</th><th>Paiement</th><th class="right">Rendement</th><th>Statut</th></tr></thead><tbody id="divUpcomingTable"></tbody></table></div>
        <div class="card-body" style="padding-top:0"><p style="font-size:11px;color:var(--dim);margin:0">Dates du calendrier officiel, rapprochées quotidiennement des avis BRVM (voir <a href="javascript:void(0)" onclick="nav('evenements-valeurs')">Évènements sur valeurs</a>).</p></div>
      </div>
      <div class="card mb20"><div class="card-body"><div class="screener-filters">
        <div><label>Rendement min %</label><input type="number" id="divMinYield" value="0" step="0.1"></div>
        <div><label>Rendement max %</label><input type="number" id="divMaxYield" placeholder="∞" step="0.1"></div>
        <div><label>Croissance min %</label><input type="number" id="divMinGrowth" placeholder=", " step="0.1"></div>
        <div><label>Exercice</label><select id="divYear"><option value="">Tous</option></select></div>
      </div></div></div>
      <div class="card"><div class="card-header"><div class="card-title">Résultats</div><div id="divCount" style="font-size:12px;color:var(--dim)"></div></div><div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Exercice</th><th class="right">Dividende</th><th class="right">Rendement</th><th class="right">Croissance</th><th>Historique</th><th>Qualité</th><th>Détachement</th><th>Paiement</th></tr></thead><tbody id="dividendScreenerTable"></tbody></table></div></div>`;

    ['divMinYield', 'divMaxYield', 'divMinGrowth'].forEach(id => document.getElementById(id)?.addEventListener('input', apply));
    document.getElementById('divYear')?.addEventListener('change', apply);
    renderUpcoming();
    apply();
  }

  function apply() {
    const minY = n(document.getElementById('divMinYield')?.value) ?? 0;
    const maxY = n(document.getElementById('divMaxYield')?.value) ?? Infinity;
    const minG = n(document.getElementById('divMinGrowth')?.value);
    const rows = dividendes();
    syncYearOptions(rows);
    const selectedYear = document.getElementById('divYear')?.value || '';

    const historyByTicker = buildHistoryByTicker();

    // Filter the year before selecting the latest row per ticker so historical years remain selectable.
    const sourceRows = selectedYear
      ? rows.filter(r => String(r.exercice ?? r.annee) === selectedYear)
      : rows;

    const byTicker = new Map();
    sourceRows.forEach(r => {
      const ticker = String(r.ticker || '').toUpperCase();
      if (!ticker) return;
      const year = n(r.exercice ?? r.annee);
      const current = byTicker.get(ticker);
      if (!current || Number(year || 0) > Number(current.exercice ?? current.annee ?? 0)) byTicker.set(ticker, { ...r, ticker });
    });

    // Médianes de rendement par secteur, calculées sur l'ensemble des tickers
    // du périmètre (avant les filtres de rendement/croissance) pour rester
    // stables pendant que l'utilisateur ajuste ces curseurs — comme le fait
    // le comparateur de l'Analyse Fondamentale à l'échelle du sous-secteur.
    const sectorYields = {};
    byTicker.forEach(r => {
      const sec = sectorOf(r.ticker);
      const y = n(r.taux_rendement ?? r.rendement);
      if (sec && y != null) (sectorYields[sec] || (sectorYields[sec] = [])).push(y);
    });
    const sectorMedians = {};
    Object.keys(sectorYields).forEach(s => { if (sectorYields[s].length >= 3) sectorMedians[s] = median(sectorYields[s]); });

    const out = Array.from(byTicker.values()).map(r => {
      const current = n(r.montant_net ?? r.montant);
      const yieldValue = n(r.taux_rendement ?? r.rendement);
      const currentYear = n(r.exercice ?? r.annee);
      const previous = rows.find(x => String(x.ticker || '').toUpperCase() === r.ticker && n(x.exercice ?? x.annee) === currentYear - 1);
      const prevAmount = previous ? n(previous.montant_net ?? previous.montant) : null;
      const growth = current != null && prevAmount != null && prevAmount !== 0 ? (current / prevAmount - 1) * 100 : null;
      const history = historyByTicker[r.ticker] || [];
      const fin = finFor(r.ticker, currentYear);
      return {
        ...r, yieldValue, growth, history,
        payoutRatio: payoutRatioFor(fin),
        streak: streakFromHistory(history),
        sectorMedian: sectorMedians[sectorOf(r.ticker)] ?? null
      };
    }).filter(r =>
      (r.yieldValue ?? -Infinity) >= minY &&
      (r.yieldValue ?? Infinity) <= maxY &&
      (minG == null || (r.growth != null && r.growth >= minG))
    );

    const tbody = document.getElementById('dividendScreenerTable');
    if (!tbody) return;
    document.getElementById('divCount').textContent = `${out.length} résultat(s)`;
    tbody.innerHTML = out.length
      ? out.sort((a,b) => (b.yieldValue ?? -Infinity) - (a.yieldValue ?? -Infinity)).map(r => `<tr>
          <td><strong style="color:var(--gold)">${esc(r.ticker)}</strong></td>
          <td>${esc(r.exercice ?? r.annee ?? '—')}</td>
          <td class="right">${r.montant_net ?? r.montant ?? 'Donnée non disponible'}</td>
          <td class="right">${pct(r.yieldValue)}${sectorSubline(r.yieldValue, r.sectorMedian)}</td>
          <td class="right">${pct(r.growth)}</td>
          <td>${historyCell(r.history)}</td>
          <td>${qualityCell(r.payoutRatio, r.streak)}</td>
          <td>${esc(r.date_detachement ?? r.ex_date ?? '—')}</td>
          <td>${esc(r.date_paiement_cal ?? r.date_paiement ?? '—')}</td>
        </tr>`).join('')
      : '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--dim)">Aucune société ne correspond aux critères.</td></tr>';
  }

  window.renderDividendScreener = renderDividendScreener;
})();
