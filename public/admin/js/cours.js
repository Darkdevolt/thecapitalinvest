/* THE CAPITAL — Cours & Historique bootstrap */
(function(){
'use strict';
window.CoursLegacy={retired:true};

/* Never let the duplicate admin base target force the Admin into a new tab. */
document.querySelectorAll('base[target="_blank"]').forEach(function(base){ base.remove(); });

/* The session calendar is deliberately mounted after CoursControl has built
   #panel-cours.  A MutationObserver keeps it present if the control center
   replaces the panel HTML during initialisation or refresh. */
function ensureTracking(){
    if(!document.getElementById('panel-cours')) return;
    if(!document.querySelector('script[data-tc-session-tracking]')){
        var s=document.createElement('script');
        s.src='admin/js/cours-control-tracking.js?v=20260816-2';
        s.async=false;
        s.setAttribute('data-tc-session-tracking','1');
        document.head.appendChild(s);
    }
}

function startTrackingGuard(){
    ensureTracking();
    var panel=document.getElementById('panel-cours');
    if(panel && window.MutationObserver){
        var observer=new MutationObserver(function(){
            if(!document.getElementById('tc-session-tracking')) ensureTracking();
        });
        observer.observe(panel,{childList:true});
    }
    setTimeout(ensureTracking,500);
    setTimeout(ensureTracking,1500);
    setTimeout(ensureTracking,3000);
}

if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',startTrackingGuard);
}else{
    startTrackingGuard();
}
})();