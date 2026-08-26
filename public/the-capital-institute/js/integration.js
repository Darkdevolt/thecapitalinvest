/* THE CAPITAL INSTITUTE — lively product layer */
(function(){'use strict';var MAIN_URL='/';
function capitalLink(){var m=document.querySelector('main');if(!m||document.querySelector('.tci-capital-link'))return;var a=document.createElement('a');a.className='tci-capital-link';a.href=MAIN_URL;a.innerHTML='<span aria-hidden="true">←</span><span>Retour à The Capital</span>';m.insertBefore(a,m.firstChild)}
function userState(){var n=document.querySelector('.tci-nav');if(!n||document.querySelector('.tci-user-state'))return;var s=document.createElement('span');s.className='tci-user-state';s.textContent='✦ FORMATION';n.appendChild(s)}
function ambient(){if(document.querySelector('.tci-ambient'))return;var d=document.createElement('div');d.className='tci-ambient';d.setAttribute('aria-hidden','true');d.innerHTML='<i>✦</i><i>✦</i><i>•</i><i>✦</i>';document.body.appendChild(d)}
function ready(){capitalLink();userState();ambient();try{window.dispatchEvent(new CustomEvent('thecapital:institute-ready',{detail:{version:'2.1'}}))}catch(e){}}
new MutationObserver(function(){capitalLink();userState()}).observe(document.documentElement,{childList:true,subtree:true});document.readyState==='loading'?document.addEventListener('DOMContentLoaded',ready):ready();
})();
