(function(){
  'use strict';
  var root = window.TheCapital = window.TheCapital || {};
  root.version = '2026.09-modular';
  root.modules = root.modules || {};
  root.register = function(name, api){
    if(!name) return;
    root.modules[name] = Object.assign(root.modules[name] || {}, api || {});
  };
  root.emit = function(name, detail){
    window.dispatchEvent(new CustomEvent(name, {detail: detail || {}}));
  };
  root.on = function(name, handler, options){
    window.addEventListener(name, handler, options || false);
    return function(){ window.removeEventListener(name, handler, options || false); };
  };
  root.dom = function(id){ return document.getElementById(id); };
  root.safeArray = function(value){ return Array.isArray(value) ? value : []; };
  root.data = function(name){ return root.safeArray(window[name]); };
})();
