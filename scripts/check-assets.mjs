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
      // Chemin relatif : résolu depuis l'URL de la page, pas du script.
      const candidate = normalize(join(ROOT, raw));
      if (!existsSync(candidate)) {
        failures.push(`${file} charge dynamiquement « ${raw} » (chemin relatif) : introuvable depuis la racine du site. Utiliser un chemin absolu.`);
      } else {
        warnings.push(`${file} : chargement relatif « ${raw} » — préférer un chemin absolu, la résolution dépend de l'URL de la page.`);
      }
    }
  }
}

/**
 * Contrôle de syntaxe. Sept fichiers du dépôt ne se parsaient pas — apostrophes
 * françaises non échappées dans des chaînes, ternaire tronqué, chaîne non
 * fermée, sélecteur mal formé, déclarations de fonctions avalées par un
 * commentaire. Le navigateur les rejetait en silence : les modules concernés
 * n'existaient tout simplement pas à l'exécution.
 */
for (const file of files.filter(f => f.endsWith('.js'))) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (e) {
    const message = String(e.stderr || '').split('\n').find(l => l.includes('Error')) || 'erreur de syntaxe';
    failures.push(`${file} ne se parse pas : ${message.trim()}`);
  }
}

for (const w of warnings) console.warn('  avertissement :', w);

if (failures.length) {
  console.error(`\nContrôle des références statiques : ${failures.length} erreur(s)\n`);
  for (const f of failures) console.error('  •', f);
  process.exit(1);
}

console.log(`Contrôle d'intégrité : ${htmlFiles.length} pages et ${files.filter(f => f.endsWith('.js')).length} scripts vérifiés, aucune référence cassée ni erreur de syntaxe.`);
