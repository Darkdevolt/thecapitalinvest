/* THE CAPITAL — App UI consistency layer
 * Presentation/navigation only. No market, API, subscription or trading logic.
 */
(function(){
  'use strict';
  if(window.__TC_UI_CONSISTENCY__) return;
  window.__TC_UI_CONSISTENCY__=true;

  function addStyles(){
    if(document.getElementById('tc-ui-consistency-css')) return;
    var style=document.createElement('style');
    style.id='tc-ui-consistency-css';
    style.textContent=[
      '.tc-institute-link{display:flex;align-items:center;gap:10px;margin-top:8px;padding:9px 10px;border:1px solid rgba(184,150,78,.18);border-radius:7px;background:rgba(184,150,78,.045);color:var(--cream,#f5f0e8);text-decoration:none;font-size:11px;letter-spacing:.04em;transition:background .18s,border-color .18s,color .18s}',
      '.tc-institute-link:hover{background:rgba(184,150,78,.10);border-color:rgba(184,150,78,.38);color:var(--gold,#b8964e)}',
      '.tc-institute-mark{width:22px;height:22px;display:grid;place-items:center;border:1px solid rgba(184,150,78,.28);border-radius:5px;color:var(--gold,#b8964e);font-family:var(--mono,monospace);font-size:10px}',
      '.tc-institute-link .tc-institute-copy{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.tc-institute-link .tc-institute-title{font-weight:600;text-transform:uppercase;letter-spacing:.08em}',
      '.tc-institute-link .tc-institute-sub{font-size:9px;color:var(--dim,rgba(245,240,232,.34));letter-spacing:.02em}',
      '.tc-clean-tabs{display:flex;align-items:center;gap:6px}',
      '.tc-clean-tabs .tab{font-family:var(--sans,"DM Sans",sans-serif);font-size:11px;letter-spacing:.04em}',
      '@media(max-width:700px){.tc-institute-link{padding:10px}.tc-institute-link .tc-institute-sub{display:none}}'
    ].join('');
    document.head.appendChild(style);
  }

  function cleanWorkspaceTabs(){
    var tabs=document.querySelector('.tabs');
    if(!tabs) return;
    tabs.classList.add('tc-clean-tabs');
    tabs.querySelectorAll('.tab').forEach(function(tab){
      var label=(tab.textContent||'').replace(/^[\\s\\u200b]*(?:[⚡⭐☆✦✧★🚀📈📊])+[\\s\\u200b]*/u,'').trim();
      if(label) tab.textContent=label;
      tab.removeAttribute('title');
    });
  }

  function addInstituteLink(){
    var sidebar=document.getElementById('sidebar');
    if(!sidebar || document.querySelector('.tc-institute-link')) return;
    var bottom=sidebar.querySelector('.sidebar-bottom');
    if(!bottom) return;
    var link=document.createElement('a');
    link.className='tc-institute-link';
    link.href='/the-capital-institute/index.html';
    link.target='_self';
    link.setAttribute('aria-label','The Capital Institute');
    link.innerHTML='<span class="tc-institute-mark" aria-hidden="true">CI</span><span class="tc-institute-copy"><span class="tc-institute-title">The Capital Institute</span><span class="tc-institute-sub">Formation financière</span></span>';
    bottom.insertBefore(link,bottom.firstChild);
  }

  function run(){
    addStyles();
    cleanWorkspaceTabs();
    addInstituteLink();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();
  new MutationObserver(function(){run()}).observe(document.documentElement,{childList:true,subtree:true});
})();
