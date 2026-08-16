/* THE CAPITAL — bootstrap Cours & Historique. */
(function(){
'use strict';
window.CoursLegacy={retired:true};
document.querySelectorAll('base[target="_blank"]').forEach(function(base){base.remove();});
function loadTracker(done){if(window.CoursSessionTracking){done();return;}var existing=document.querySelector('script[data-tc-session-tracking]');if(existing){existing.addEventListener('load',done,{once:true});return;}var s=document.createElement('script');s.src='admin/js/cours-control-tracking.js?v=20260816-3';s.async=false;s.setAttribute('data-tc-session-tracking','1');s.onload=done;s.onerror=function(){console.error('[cours] Impossible de charger le tracking officiel des séances.');};document.head.appendChild(s);}
function mountAfterInit(){loadTracker(function(){if(window.CoursSessionTracking)window.CoursSessionTracking.mount();});}
function hook(){if(!window.CoursControl||typeof window.CoursControl.init!=='function'){setTimeout(hook,25);return;}if(window.CoursControl.__trackingLifecycleHooked)return;var original=window.CoursControl.init;window.CoursControl.init=function(){var result=original.apply(this,arguments);mountAfterInit();return result;};window.CoursControl.__trackingLifecycleHooked=true;}
hook();
})();