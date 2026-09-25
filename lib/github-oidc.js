/**
 * Vérification des jetons OIDC émis par GitHub Actions.
 *
 * Un workflow du dépôt (permissions: id-token: write) obtient de GitHub un
 * JWT signé (RS256) qui atteste « ce workflow, de ce dépôt, sur cette
 * branche ». On vérifie la signature avec les clés publiques de GitHub et
 * les revendications attendues : aucun secret partagé à stocker ni à faire
 * tourner, et un jeton volé expire en quelques minutes.
 */
import crypto from 'node:crypto';

const ISSUER = 'https://token.actions.githubusercontent.com';
const JWKS_URL = `${ISSUER}/.well-known/jwks`;
const JWKS_TTL_MS = 60 * 60 * 1000;

let jwksCache = { at: 0, keys: new Map() };

async function loadKeys(force = false) {
  if (!force && jwksCache.keys.size && Date.now() - jwksCache.at < JWKS_TTL_MS) return jwksCache.keys;
  const resp = await fetch(JWKS_URL, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) throw new Error(`JWKS GitHub HTTP ${resp.status}`);
  const { keys = [] } = await resp.json();
  const map = new Map();
  for (const jwk of keys) {
    if (jwk.kty !== 'RSA' || !jwk.kid) continue;
    try { map.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' })); } catch { /* clé ignorée */ }
  }
  jwksCache = { at: Date.now(), keys: map };
  return map;
}

function b64urlJson(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

/** Le jeton ressemble-t-il à un JWT GitHub Actions ? (sans rien vérifier) */
export function looksLikeGithubOidc(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return false;
  try { return b64urlJson(parts[1]).iss === ISSUER; } catch { return false; }
}

/**
 * Vérifie le jeton et renvoie ses revendications, ou lève une erreur.
 * @param {string} token
 * @param {{ audience: string, repository: string, ref?: string, workflow?: string }} expected
 *   workflow : chemin du fichier (.github/workflows/xxx.yml) — comparé à job_workflow_ref.
 */
export async function verifyGithubOidc(token, expected) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('jeton mal formé');
  const header = b64urlJson(parts[0]);
  const claims = b64urlJson(parts[1]);
  if (header.alg !== 'RS256') throw new Error('algorithme non accepté');

  let keys = await loadKeys();
  if (!keys.has(header.kid)) keys = await loadKeys(true);
  const key = keys.get(header.kid);
  if (!key) throw new Error('clé de signature inconnue');
  const ok = crypto.verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new Error('signature invalide');

  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== ISSUER) throw new Error('émetteur inattendu');
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(expected.audience)) throw new Error('audience inattendue');
  if (!(claims.exp > now - 30)) throw new Error('jeton expiré');
  if (claims.nbf && claims.nbf > now + 60) throw new Error('jeton pas encore valide');
  const repo = String(expected.repository).toLowerCase();
  if (String(claims.repository || '').toLowerCase() !== repo) throw new Error('dépôt inattendu');
  if (expected.ref && claims.ref !== expected.ref) throw new Error('branche inattendue');
  if (expected.workflow) {
    const wf = String(claims.job_workflow_ref || claims.workflow_ref || '').toLowerCase();
    if (!wf.startsWith(`${repo}/${expected.workflow.toLowerCase()}@`)) throw new Error('workflow inattendu');
  }
  return claims;
}
