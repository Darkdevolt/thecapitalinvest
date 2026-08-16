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
// Remove any such base target once the Admin scripts are loaded.
document.querySelectorAll('base[target="_blank"]').forEach(function(base){
    base.remove();
});
})();