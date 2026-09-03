/**
 * Contrôle d'intégrité des références statiques, exécuté à chaque build.
 *
 * Motif : l'audit a mis au jour des scripts appelés par les pages mais absents
 * du dépôt, et des chargements dynamiques dont le chemin relatif ne se résolvait
 * pas depuis l'URL réelle de la page. Ces erreurs ne se voyaient que dans la
 * console du navigateur, en production. Le build échoue désormais dessus.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = 'public';
const failures = [];
const warnings = [];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const htmlFiles = files.filter(f => f.endsWith('.html'));

/**
 * app/app.html est servi via la réécriture /app.html : la base de résolution des
 * chemins relatifs est la racine du site, pas le dossier /app/.
 */
const baseFor = file => file.replace(/\\/g, '/').endsWith('app/app.html') ? ROOT : dirname(file);

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const base = baseFor(file);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const raw = match[1].split('?')[0];
    if (!raw || /^(https?:|\/\/|#|mailto:|tel:|data:)/.test(raw)) continue;
    if (!/\.(js|css)$/.test(raw)) continue;
    const target = normalize(raw.startsWith('/') ? join(ROOT, raw) : join(base, raw));
    if (!existsSync(target)) {
      failures.push(`${file} → ${raw} (résolu : ${target}) est introuvable`);
    }
  }
}

// Chargements dynamiques : script.src = '...'
for (const file of files.filter(f => f.endsWith('.js'))) {
  const code = readFileSync(file, 'utf8');
  for (const match of code.matchAll(/\.src\s*=\s*['"]([^'"]+\.js)(?:\?[^'"]*)?['"]/g)) {
    const raw = match[1];
    if (/^(https?:|\/\/)/.test(raw)) continue;
    if (raw.startsWith('/')) {
      if (!existsSync(normalize(join(ROOT, raw)))) {
        failures.push(`${file} charge dynamiquement ${raw} : fichier introuvable`);
      }
    } else {
      const candidate = normalize(join(ROOT, raw));
      if (!existsSync(candidate)) {
        failures.push(`${file} charge dynamiquement « ${raw} » (chemin relatif) : introuvable depuis la racine du site. Utiliser un chemin absolu.`);
      } else {
        warnings.push(`${file} : chargement relatif « ${raw} » — préférer un chemin absolu, la résolution dépend de l'URL de la page.`);
      }
    }
  }
}

// Contrôle de syntaxe de tous les JavaScript avant déploiement.
for (const file of files.filter(f => f.endsWith('.js'))) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (e) {
    const message = String(e.stderr || '').split('\n').find(l => l.includes('Error')) || 'erreur de syntaxe';
    failures.push(`${file} ne se parse pas : ${message.trim()}`);
  }
}

/**
 * GARDE-FOUS APPLICATION
 * Ces invariants ne changent pas le comportement de l'application. Ils font
 * échouer le build lorsqu'une modification casse le socle connu ou réintroduit
 * les mécanismes qui ont déjà provoqué une boucle navigateur.
 */
const appPath = 'public/app/app.html';
const appHtml = readFileSync(appPath, 'utf8');
const headerRuntimePath = 'public/app/js/header-runtime-fix.js';
const navGuardPath = 'public/app/js/navigation-guard.js';
const headerPath = 'public/app/js/components/header.js';
const baseCssPath = 'public/app/css/base.css';
const vercelPath = 'vercel.json';

function count(text, pattern) {
  return (text.match(pattern) || []).length;
}

function requireInvariant(condition, message) {
  if (!condition) failures.push(`GARDE-FOU : ${message}`);
}

requireInvariant(existsSync(appPath), 'public/app/app.html doit rester l’application principale.');
requireInvariant(count(appHtml, /<script[^>]+src=["']\/app\/js\/main\.js(?:\?[^"']*)?["']/g) === 1,
  'app.html doit charger exactement un main.js.');
requireInvariant(count(appHtml, /<script[^>]+src=["']\/app\/js\/init\.js(?:\?[^"']*)?["']/g) === 1,
  'app.html doit charger exactement un init.js.');
requireInvariant(count(appHtml, /<script[^>]+src=["']\/app\/js\/router\.js(?:\?[^"']*)?["']/g) === 1,
  'app.html doit charger exactement un router.js.');

const mainPos = appHtml.search(/<script[^>]+src=["']\/app\/js\/main\.js(?:\?[^"']*)?["']/);
const initPos = appHtml.search(/<script[^>]+src=["']\/app\/js\/init\.js(?:\?[^"']*)?["']/);
const routerPos = appHtml.search(/<script[^>]+src=["']\/app\/js\/router\.js(?:\?[^"']*)?["']/);
requireInvariant(mainPos >= 0 && initPos > mainPos, 'l’ordre main.js → init.js doit être conservé.');
requireInvariant(routerPos >= 0 && routerPos < mainPos, 'router.js doit être chargé avant le bootstrap main/init.');
requireInvariant(/<body[^>]*class=["'][^"']*\binit-hidden\b/.test(appHtml), 'app.html doit conserver le marqueur init-hidden du bootstrap.');

const baseCss = readFileSync(baseCssPath, 'utf8');
requireInvariant(/body\.init-hidden\s*\{[^}]*visibility\s*:\s*visible\s*!important[^}]*opacity\s*:\s*1\s*!important/s.test(baseCss),
  'base.css ne doit pas pouvoir laisser init-hidden masquer définitivement l’application.');

const headerRuntime = readFileSync(headerRuntimePath, 'utf8');
const navGuard = readFileSync(navGuardPath, 'utf8');
requireInvariant(!/observe\(\s*document\.(body|documentElement)\s*,/.test(headerRuntime),
  'header-runtime-fix.js ne doit pas observer globalement le document.');
requireInvariant(!/observe\(\s*document\.(body|documentElement)\s*,/.test(navGuard),
  'navigation-guard.js ne doit pas observer globalement le document.');
requireInvariant(/__TC_HEADER_RUNTIME_FIX__/.test(headerRuntime), 'le singleton du runtime header doit être conservé.');
requireInvariant(/__TC_NAV_GUARD__/.test(navGuard), 'le singleton du navigation guard doit être conservé.');

const header = readFileSync(headerPath, 'utf8');
for (const modulePath of [
  '/app/js/mode.js',
  '/app/js/theme.js',
  '/app/js/views/comparison.js',
  '/app/js/views/dividend-screener.js',
  '/app/js/header-polish.js',
  '/app/js/header-runtime-fix.js'
]) {
  const escaped = modulePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  requireInvariant(count(header, new RegExp(`['"]${escaped}['"]`, 'g')) === 1,
    `header.js doit référencer exactement une fois ${modulePath}.`);
}

// Aucune ancienne architecture de desk ne doit réapparaître dans l'application.
for (const file of files) {
  if (!/^(public\/app\/|public\/app\.html$)/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  if (/desk-workspace/i.test(text)) failures.push(`GARDE-FOU : référence desk-workspace interdite dans ${file}.`);
}

// admin.html est hors périmètre des correctifs app. Toute modification doit être
// volontaire et explicite, sinon le build bloque plutôt que de déployer à l’aveugle.
const adminPath = 'public/admin.html';
const expectedAdminBlobSha = '482287168d1fb384b27e5b654752bd6ba830933e';
function gitBlobSha(text) {
  const body = Buffer.from(text, 'utf8');
  return createHash('sha1').update(Buffer.from(`blob ${body.length}\0`, 'utf8')).update(body).digest('hex');
}
if (existsSync(adminPath)) {
  const actualAdminSha = gitBlobSha(readFileSync(adminPath, 'utf8'));
  requireInvariant(actualAdminSha === expectedAdminBlobSha,
    'admin.html a changé alors qu’il est hors périmètre ; bloquer le déploiement jusqu’à validation explicite.');
}

// La réécriture production /app.html → /app/app.html est un contrat critique.
const vercel = readFileSync(vercelPath, 'utf8');
requireInvariant(/"source"\s*:\s*"\/app\.html"[\s\S]*?"destination"\s*:\s*"\/app\/app\.html"/.test(vercel),
  'vercel.json doit conserver la réécriture /app.html → /app/app.html.');

for (const w of warnings) console.warn('  avertissement :', w);

if (failures.length) {
  console.error(`\nContrôle d’intégrité : ${failures.length} erreur(s)\n`);
  for (const f of failures) console.error('  •', f);
  process.exit(1);
}

console.log(`Contrôle d'intégrité : ${htmlFiles.length} pages, ${files.filter(f => f.endsWith('.js')).length} scripts et garde-fous applicatifs vérifiés, aucune référence cassée, erreur de syntaxe ou invariant critique violé.`);
