/* THE CAPITAL — form field accessibility / DevTools hygiene */
(function(){
  'use strict';
  if(window.__TC_FORM_FIELD_A11Y__) return;
  window.__TC_FORM_FIELD_A11Y__ = true;

  function ensure(){
    document.querySelectorAll('input, select, textarea').forEach(function(field, index){
      var id = field.getAttribute('id');
      var name = field.getAttribute('name');
      if(!id && !name){
        id = 'tc-field-' + index + '-' + Math.random().toString(36).slice(2,8);
        field.setAttribute('id', id);
      }
      if(field.tagName === 'SELECT' && !field.getAttribute('name')){
        field.setAttribute('name', field.id || 'tc-select-' + index);
      }
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ensure, {once:true});
  }else{
    ensure();
  }
})();
