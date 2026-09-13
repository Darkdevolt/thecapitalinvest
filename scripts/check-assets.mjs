import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

/**
 * Build integrity check.
 *
 * The application shell is currently inline in public/app/app.html. Older
 * header-runtime/navigation component files were removed during the shell
 * consolidation, so the build guard must validate the architecture that is
 * actually deployed instead of requiring retired files to exist.
 */
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
const baseFor = file => file.replace(/\\/g, '/').endsWith('app/app.html') ? ROOT : dirname(file);

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const base = baseFor(file);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const raw = match[1].split('?')[0];
    if (!raw || /^(https?:|\/\/|#|mailto:|tel:|data:)/.test(raw)) continue;
    if (!/\.(js|css)$/.test(raw)) continue;
    const target = normalize(raw.startsWith('/') ? join(ROOT, raw) : join(base, raw));
    if (!existsSync(target)) failures.push(`${file} → ${raw} (résolu : ${target}) est introuvable`);
  }
}

// Validate dynamic script loads as well.
for (const file of files.filter(f => f.endsWith('.js'))) {
  const code = readFileSync(file, 'utf8');
  for (const match of code.matchAll(/\.src\s*=\s*['"]([^'"]+\.js)(?:\?[^'"]*)?['"]/g)) {
    const raw = match[1];
    if (/^(https?:|\/\/)/.test(raw)) continue;
    const candidate = normalize(raw.startsWith('/') ? join(ROOT, raw) : join(ROOT, raw));
    if (!existsSync(candidate)) {
      failures.push(`${file} charge dynamiquement ${raw} : fichier introuvable`);
    } else if (!raw.startsWith('/')) {
      warnings.push(`${file} : chargement relatif « ${raw} » — préférer un chemin absolu.`);
    }
  }
}

// Syntax-check every JavaScript file before deployment.
for (const file of files.filter(f => f.endsWith('.js'))) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (e) {
    const message = String(e.stderr || '').split('\n').find(l => l.includes('Error')) || 'erreur de syntaxe';
    failures.push(`${file} ne se parse pas : ${message.trim()}`);
  }
}

const appPath = 'public/app/app.html';
const appHtml = readFileSync(appPath, 'utf8');
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

if (existsSync(baseCssPath)) {
  const baseCss = readFileSync(baseCssPath, 'utf8');
  requireInvariant(/body\.init-hidden\s*\{[^}]*visibility\s*:\s*visible\s*!important[^}]*opacity\s*:\s*1\s*!important/s.test(baseCss),
    'base.css doit garantir la sortie du mode init-hidden.');
} else {
  failures.push('GARDE-FOU : public/app/css/base.css doit exister.');
}

// Current shell architecture: the header/navigation are inline in app.html.
// Validate that the canonical shell remains present without requiring retired
// component files that no longer belong to the deployed architecture.
requireInvariant(/id=["']tcShell["']/.test(appHtml), 'le shell The Capital doit rester présent.');
requireInvariant(/class=["'][^"']*tc-commandbar/.test(appHtml), 'la barre de commande du header doit rester présente.');
requireInvariant(/id=["']headerTime["']/.test(appHtml), 'la cible de l’horloge du header doit rester présente.');
requireInvariant(/class=["'][^"']*tc-market-pill/.test(appHtml), 'le statut BRVM doit rester présent dans le header.');

// No legacy desk architecture may return.
for (const file of files) {
  if (!/^(public\/app\/|public\/app\.html$)/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  if (/desk-workspace/i.test(text)) failures.push(`GARDE-FOU : référence desk-workspace interdite dans ${file}.`);
}

// admin.html remains outside the application corrections.
// Bump 2026-09-11 : ajout du module « Annonces émetteurs » (public/admin/js/modules/annonces.js)
// — récupération des convocations AG / résultats / dividendes / avis BRVM. Changement
// délibéré et revu ; le garde-fou est mis à jour en conséquence (voir requireInvariant
// ci-dessous, c'est la « validation explicite » qu'il réclame).
// Bump 2026-09-12 : ajout du module « Évènements sur valeurs »
// (public/admin/js/modules/evenements-valeurs.js) — suivi des ESV BRVM
// (dividendes, coupons, fractionnements, augmentations/réductions de
// capital, fusions, radiations). Changement délibéré et revu.
// Bump 2026-09-12 (2) : ajout du module « DC/BR — Fiches obligataires »
// (public/admin/js/modules/dcbr.js) — caractéristiques d'émission
// (ISIN, symbole, taux...) des emprunts obligataires UEMOA. Changement
// délibéré et revu.
const adminPath = 'public/admin.html';
const expectedAdminBlobSha = '9c20039ee9fd61c7de91a75129d09ecb9a8a6b4f';
function gitBlobSha(text) {
  const body = Buffer.from(text, 'utf8');
  return createHash('sha1').update(Buffer.from(`blob ${body.length}\0`, 'utf8')).update(body).digest('hex');
}
if (existsSync(adminPath)) {
  const actualAdminSha = gitBlobSha(readFileSync(adminPath, 'utf8'));
  requireInvariant(actualAdminSha === expectedAdminBlobSha,
    'admin.html a changé alors qu’il est hors périmètre ; bloquer le déploiement jusqu’à validation explicite.');
}

// Critical production rewrite contract.
const vercel = readFileSync(vercelPath, 'utf8');
requireInvariant(/"source"\s*:\s*"\/app\.html"[\s\S]*?"destination"\s*:\s*"\/app\/app\.html"/.test(vercel),
  'vercel.json doit conserver la réécriture /app.html → /app/app.html.');

for (const w of warnings) console.warn('avertissement :', w);

if (failures.length) {
  console.error(`\nContrôle d’intégrité : ${failures.length} erreur(s)\n`);
  for (const f of failures) console.error('  •', f);
  process.exit(1);
}

console.log(`Contrôle d'intégrité : ${htmlFiles.length} pages, ${files.filter(f => f.endsWith('.js')).length} scripts et garde-fous applicatifs vérifiés.`);
