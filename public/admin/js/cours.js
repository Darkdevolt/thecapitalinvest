/* THE CAPITAL — Legacy Cours retired.
 * The active Admin workflow is implemented by cours-control.js.
 * This compatibility shim intentionally renders nothing and keeps the
 * legacy 52-week calculation out of the current Cours & Historique UI.
 */
(function(){
'use strict';
window.CoursLegacy={retired:true};

// Admin must remain in the current tab. A duplicate <base target="_blank">
// in admin.html was causing links/forms to open a new Admin tab.
document.querySelectorAll('base[target="_blank"]').forEach(function(base){
    base.remove();
});

// Session tracking is loaded from a dedicated module so it remains isolated
// from the existing Cours & Historique control logic.
(function loadSessionTracking(){
    if(document.querySelector('script[data-tc-session-tracking]')) return;
    var s=document.createElement('script');
    s.src='admin/js/cours-control-tracking.js?v=20260816';
    s.async=false;
    s.setAttribute('data-tc-session-tracking','1');
    document.head.appendChild(s);
})();
})();