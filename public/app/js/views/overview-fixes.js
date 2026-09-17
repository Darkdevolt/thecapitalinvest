// THE CAPITAL — Dashboard market-data/UI fixes
(function () {
  'use strict';
  if (window.__TC_OVERVIEW_FIXES__) return;
  window.__TC_OVERVIEW_FIXES__ = true;

  function injectCSS() {
    if (document.getElementById('tc-dashboard-market-fixes')) return;
    var style = document.createElement('style');
    style.id = 'tc-dashboard-market-fixes';
    style.textContent = [
      '#topMovers .movers-label-row,#topMovers .mover-row{display:grid;grid-template-columns:28px minmax(0,1fr) minmax(76px,auto) minmax(78px,92px);align-items:center;column-gap:8px}',
      '#topMovers .movers-label-row{padding:5px 12px 7px}',
      '#topMovers .mover-row{min-width:0;padding:9px 12px}',
      '#topMovers .mover-security{min-width:0;overflow:hidden}',
      '#topMovers .mover-symbol,#topMovers .mover-name{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#topMovers .mover-price{white-space:nowrap;text-align:right;font-family:var(--mono);font-size:11px}',
      '#topMovers .mover-change{text-align:right;min-width:0;overflow:visible}',
      '#topMovers .mover-change-value{display:inline-block;white-space:nowrap;font-family:var(--mono);font-size:11px;font-weight:600}',
      '#view-overview .dashboard-news{margin:0 0 14px;border-radius:14px;overflow:hidden;background:linear-gradient(180deg,rgba(27,23,18,.98),rgba(18,16,13,.98));border:1px solid rgba(184,150,78,.16);box-shadow:0 8px 28px rgba(0,0,0,.22)}',
      '#view-overview .dashboard-news-head{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:54px;padding:12px 16px;background:rgba(184,150,78,.045);border-bottom:1px solid rgba(184,150,78,.12)}',
      '#view-overview .dashboard-news-head>div:first-child{min-width:0;flex:1}',
      '#view-overview .dashboard-news-head .eyebrow{margin:0 0 3px;font:600 8px/1 var(--sans);letter-spacing:.16em;color:var(--gold);text-transform:uppercase}',
      '#view-overview .dashboard-news-head .card-title{margin:0;font:600 12px/1.15 var(--sans);letter-spacing:.08em;color:var(--cream);text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#view-overview .news-refresh{flex:0 0 auto;height:27px;padding:0 10px;border:1px solid rgba(184,150,78,.2);border-radius:6px;background:rgba(184,150,78,.055);color:var(--muted);font:500 9px var(--sans);cursor:pointer;white-space:nowrap}',
      '#view-overview .news-refresh:hover{border-color:rgba(184,150,78,.42);color:var(--cream);background:rgba(184,150,78,.09)}',
      '#view-overview .dashboard-news-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;padding:0;min-height:0}',
      '#view-overview .dashboard-news-grid .news-item{position:relative;min-width:0;min-height:94px;padding:14px 17px 13px;background:transparent;border:0;border-right:1px solid rgba(184,150,78,.10);cursor:pointer;transition:background .16s ease}',
      '#view-overview .dashboard-news-grid .news-item:last-child{border-right:0}',
      '#view-overview .dashboard-news-grid .news-item:before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:2px;background:rgba(184,150,78,.22);border-radius:2px}',
      '#view-overview .dashboard-news-grid .news-item:hover{background:rgba(184,150,78,.045)}',
      '#view-overview .dashboard-news-grid .news-item:hover:before{background:var(--gold)}',
      '#view-overview .dashboard-news-grid .badge{display:inline-flex;align-items:center;height:18px;margin:0 0 9px;padding:0 7px;border:1px solid rgba(184,150,78,.22);border-radius:999px;background:rgba(184,150,78,.07);color:var(--gold);font:600 8px/1 var(--sans);letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}',
      '#view-overview .dashboard-news-grid .badge.acheter,#view-overview .dashboard-news-grid .badge.achat{color:#86c89f;border-color:rgba(134,200,159,.25);background:rgba(134,200,159,.07)}',
      '#view-overview .dashboard-news-grid .badge.vendre,#view-overview .dashboard-news-grid .badge.vente{color:#d47c7c;border-color:rgba(212,124,124,.25);background:rgba(212,124,124,.07)}',
      '#view-overview .dashboard-news-grid .news-title{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--cream);font:600 12px/1.35 var(--sans);letter-spacing:-.005em}',
      '#view-overview .dashboard-news-grid .news-meta{margin-top:6px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dim);font:500 9px/1.25 var(--mono);letter-spacing:.01em}',
      '#view-overview .dashboard-news-grid .news-skeleton{display:none}',
      '#view-overview .dashboard-news-grid .empty-state{grid-column:1/-1;padding:18px;color:var(--dim);font:500 10px var(--sans);text-align:center}',
      '@media(max-width:900px){#view-overview .dashboard-news-grid{grid-template-columns:1fr}#view-overview .dashboard-news-grid .news-item{border-right:0!important;border-bottom:1px solid rgba(184,150,78,.10)}#view-overview .dashboard-news-grid .news-item:last-child{border-bottom:0}}',
      '@media(max-width:700px){#topMovers .movers-label-row,#topMovers .mover-row{grid-template-columns:22px minmax(0,1fr) minmax(64px,auto) minmax(62px,78px);column-gap:5px}.tc-calendar-item{grid-template-columns:48px minmax(0,1fr) auto;gap:7px}}'
    ].join('');
    document.head.appendChild(style);
  }

  injectCSS();
})();
