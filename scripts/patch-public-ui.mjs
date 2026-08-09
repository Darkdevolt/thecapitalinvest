import fs from 'node:fs';
import path from 'node:path';

const publicDir = path.resolve('public');
const read = (file) => fs.readFileSync(file, 'utf8');
const write = (file, content) => fs.writeFileSync(file, content, 'utf8');
const fail = (message) => { throw new Error(`[The Capital UI patch] ${message}`); };

// Presentation-only build patch. It deliberately never reads or writes API/backend
// files or portfolio business-logic files.
const indexPath = path.join(publicDir, 'index.html');
let index = read(indexPath);
if (!index.includes("fetch('/api/marche?type=cours')")) fail('Ticker API call changed; aborting.');
if (!index.includes('assets/the-capital-logo.png')) fail('Official logo asset missing; aborting.');

const heroOld = '.hero-circle-inner{text-align:center;width:78%;display:flex;align-items:center;justify-content:center}.hero-circle-inner img{display:block;width:100%;height:auto;max-width:360px;max-height:160px;object-fit:contain;object-position:center;filter:brightness(1.08) contrast(1.02)}';
const heroNew = '.hero-circle-inner{text-align:center;width:88%;height:88%;display:flex;align-items:center;justify-content:center}.hero-circle-inner img{display:block;width:100%;height:100%;max-width:none;max-height:none;object-fit:contain;object-position:center;filter:brightness(1.08) contrast(1.02)}';
if (index.includes(heroOld)) index = index.replace(heroOld, heroNew);
else if (!index.includes(heroNew)) fail('Hero logo CSS is not the expected source version; aborting.');

const mobileOld = '.hero-circle-inner{width:72%}.hero-circle-inner img{max-width:260px;max-height:120px}';
const mobileNew = '.hero-circle-inner{width:82%;height:82%}.hero-circle-inner img{width:100%;height:100%;max-width:none;max-height:none}';
if (index.includes(mobileOld)) index = index.replace(mobileOld, mobileNew);
else if (!index.includes(mobileNew)) fail('Mobile hero logo CSS is not the expected source version; aborting.');

const smallOld = '.hero-circle-inner{width:70%}.hero-circle-inner img{max-width:220px;max-height:100px}';
const smallNew = '.hero-circle-inner{width:82%;height:82%}.hero-circle-inner img{width:100%;height:100%;max-width:none;max-height:none}';
if (index.includes(smallOld)) index = index.replace(smallOld, smallNew);
else if (!index.includes(smallNew)) fail('Small-mobile hero logo CSS is not the expected source version; aborting.');
write(indexPath, index);

const stylePath = path.join(publicDir, 'style.css');
let css = read(stylePath);
const marker = '/* ============================================================\n   PUBLIC SECONDARY MOBILE NAV — SAFE OVERRIDES\n   ============================================================ */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\nbody.menu-open { overflow: hidden; }\n.mobile-nav-backdrop { display:block; position:fixed; inset:0; background:rgba(0,0,0,.38); opacity:0; visibility:hidden; pointer-events:none; z-index:98; transition:opacity .2s ease,visibility .2s ease; }\n.mobile-nav-backdrop.is-open { opacity:1; visibility:visible; pointer-events:auto; }\n@media (max-width:900px) {\n  header, header.scrolled { padding-left:16px; padding-right:16px; padding-top:max(10px,env(safe-area-inset-top)); padding-bottom:10px; min-height:64px; }\n  .hamburger { display:flex; width:48px; height:48px; min-width:48px; flex:0 0 48px; align-items:center; justify-content:center; padding:0; gap:5px; border:1px solid var(--border); border-radius:10px; background:rgba(17,16,9,.88); position:relative; z-index:102; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }\n  .hamburger span { width:20px; }\n  .mobile-menu { display:flex; position:fixed; top:calc(64px + env(safe-area-inset-top)); left:10px; right:10px; max-height:calc(100svh - 76px - env(safe-area-inset-top)); overflow-y:auto; -webkit-overflow-scrolling:touch; padding:8px; background:rgba(10,8,4,.98); backdrop-filter:blur(20px); border:1px solid var(--border); border-radius:14px; box-shadow:0 24px 70px rgba(0,0,0,.55); opacity:0; visibility:hidden; pointer-events:none; transform:translateY(-8px); transition:opacity .2s ease,transform .2s ease,visibility .2s ease; z-index:101; }\n  .mobile-menu.open { opacity:1; visibility:visible; pointer-events:auto; transform:translateY(0); }\n  .mobile-menu a { display:flex; align-items:center; min-height:48px; padding:12px 14px; border-bottom:0; border-radius:9px; color:var(--cream); text-decoration:none; font-size:12px; letter-spacing:.1em; text-transform:uppercase; -webkit-tap-highlight-color:transparent; }\n  .mobile-menu a:hover, .mobile-menu a:active, .mobile-menu a.active { color:var(--gold); background:rgba(184,150,78,.07); }\n  .mobile-menu .nav-cta { margin:6px 0 0; justify-content:center; background:var(--gold)!important; color:var(--bg)!important; font-weight:500!important; }\n}\n@media (max-width:480px) { .mobile-menu { left:8px; right:8px; } }\n@media (hover:none) { .hamburger, .mobile-menu a { touch-action:manipulation; } }\n`;
  write(stylePath, css);
}

const touched = [];
for (const name of fs.readdirSync(publicDir).filter((n) => n.endsWith('.html'))) {
  if (name === 'index.html' || name === 'app.html') continue;
  const file = path.join(publicDir, name);
  let html = read(file);
  if (!html.includes('id="hamburger"') || !html.includes('id="mobile-menu"')) continue;
  if (!html.includes('js/mobile-nav.js')) {
    if (!html.includes('</body>')) fail(`Missing </body> in ${name}; aborting.`);
    html = html.replace('</body>', '  <script src="js/mobile-nav.js" defer></script>\n\n</body>');
    write(file, html);
  }
  touched.push(name);
}
if (!touched.length) fail('No secondary public page with the expected mobile menu markup was found.');

console.log('[The Capital UI patch] official hero logo sizing: OK');
console.log(`[The Capital UI patch] mobile navigation pages: ${touched.join(', ')}`);
console.log('[The Capital UI patch] ticker API unchanged: OK');
