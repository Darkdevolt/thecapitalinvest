/* THE CAPITAL INSTITUTE — welcome refinement */
(function(){'use strict';
function update(){
  var hero=document.querySelector('.tci-hero');
  if(!hero)return;
  var kicker=hero.querySelector('.tci-kicker');
  var title=hero.querySelector('h1');
  var intro=hero.querySelector('.tci-hero-p');
  if(kicker)kicker.textContent='Bienvenue à The Capital Institute';
  if(title)title.textContent='Comprendre les marchés. Construire son jugement.';
  if(intro)intro.textContent='Une institution pédagogique dédiée à la compréhension des marchés financiers, ancrée dans la réalité de la BRVM et de l’UEMOA. Progressez par étapes, de la lecture des mécanismes aux outils qui permettent de raisonner avec rigueur.';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',update);else update();
})();
