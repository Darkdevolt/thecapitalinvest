// _nav.js — Snippet JS partagé (cursor, scroll, animations, hamburger mobile)
// À insérer dans le <body> de chaque page via <script src="_nav.js"></script>

(function() {
// ── Curseur custom (desktop seulement) ──
const cursor = document.getElementById(‘cursor’);
const ring = document.getElementById(‘cursorRing’);
if (cursor && ring && window.innerWidth > 900) {
let mx = 0, my = 0, rx = 0, ry = 0;
document.addEventListener(‘mousemove’, e => { mx = e.clientX; my = e.clientY; });
(function loop() {
rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
cursor.style.left = mx + ‘px’; cursor.style.top = my + ‘px’;
ring.style.left = rx + ‘px’; ring.style.top = ry + ‘px’;
requestAnimationFrame(loop);
})();
document.querySelectorAll(‘a, button’).forEach(el => {
el.addEventListener(‘mouseenter’, () => { cursor.style.width = ‘16px’; cursor.style.height = ‘16px’; ring.style.width = ‘56px’; ring.style.height = ‘56px’; });
el.addEventListener(‘mouseleave’, () => { cursor.style.width = ‘8px’; cursor.style.height = ‘8px’; ring.style.width = ‘36px’; ring.style.height = ‘36px’; });
});
}

// ── Header scroll + barre de progression ──
const header = document.querySelector(‘header’);
const scrollLine = document.getElementById(‘scrollLine’);
window.addEventListener(‘scroll’, () => {
if (header) header.classList.toggle(‘scrolled’, window.scrollY > 60);
if (scrollLine) {
const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight) * 100;
scrollLine.style.width = Math.min(pct, 100) + ‘%’;
}
});

// ── Animations au scroll (IntersectionObserver) ──
const obs = new IntersectionObserver(entries => {
entries.forEach(e => { if (e.isIntersecting) e.target.classList.add(‘visible’); });
}, { threshold: 0.1 });
document.querySelectorAll(’.anim’).forEach(el => obs.observe(el));

// ── Hamburger mobile ──
const hamburger = document.getElementById(‘hamburger’);
const mobileMenu = document.getElementById(‘mobile-menu’);
if (hamburger && mobileMenu) {
hamburger.addEventListener(‘click’, () => {
hamburger.classList.toggle(‘open’);
mobileMenu.classList.toggle(‘open’);
});
// Fermer au clic sur un lien
mobileMenu.querySelectorAll(‘a’).forEach(a => {
a.addEventListener(‘click’, () => {
hamburger.classList.remove(‘open’);
mobileMenu.classList.remove(‘open’);
});
});
}
})();