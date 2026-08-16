/* Final consolidation fixes for The Capital fundamental module. */
(function(){'use strict';
function root(){return document.getElementById('view-analyse-fondamentale')||document.querySelector('[data-view="analyse-fondamentale"]')}
function dedupe(){const c=document.getElementById('fundContent');if(!c)return;c.querySelectorAll('#tcFundAccordions').forEach((x,i)=>{if(i)x.remove()});c.querySelectorAll('#tcFundValuation,#tcFundRatios,#tcFundSeries').forEach((x)=>{const all=c.querySelectorAll('#'+x.id);all.forEach((n,i)=>{if(i)n.remove()})})}
function mode(){const r=root();if(!r)return;let pro=true;try{const s=JSON.parse(localStorage.getItem('tc_fundamental_complete_v1')||'{}');pro=s.mode==='pro'}catch(e){}r.classList.toggle('tc-fund-pro',pro);r.classList.toggle('tc-fund-simple',!pro)}
function fixPrice(){if(!Array.isArray(window.allCours))return;const old=window.__tcFundPriceFixed;if(old)return;window.__tcFundPriceFixed=true;window.__tcFundOriginalPrice=window.allCours;window.allCours=window.allCours.slice().sort((a,b)=>{const da=Date.parse(a.date||a.date_cours||a.date_seance||a.updated_at||'');const db=Date.parse(b.date||b.date_cours||b.date_seance||b.updated_at||'');return (Number.isFinite(da)?da:0)-(Number.isFinite(db)?db:0)})}
function observe(){const r=root();if(!r||r.__tcFundFinalObserver)return;r.__tcFundFinalObserver=true;const o=new MutationObserver(()=>{dedupe();mode()});o.observe(r,{childList:true,subtree:true});setTimeout(()=>{dedupe();mode();fixPrice()},100)}
window.tcFundamentalFinalFixes={run:function(){dedupe();mode();fixPrice();observe()}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>window.tcFundamentalFinalFixes.run(),{once:true});else window.tcFundamentalFinalFixes.run();
})();