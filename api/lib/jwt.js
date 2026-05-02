import { SignJWT, jwtVerify } from 'jose';
import config from './config.js';

const secret = new TextEncoder().encode(config.jwtSecret);

/**
 * Génère un JWT signé
 * @param {Object} payload — données à encoder
 * @returns {Promise<string>} JWT
 */
export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(config.jwtExpiresIn)
    .setAudience('the-capital')
    .setIssuer('the-capital-api')
    .sign(secret);
}

/**
 * Vérifie et décode un JWT
 * @param {string} token — JWT à vérifier
 * @returns {Promise<Object>} Payload décodé
 * @throws {Error} Si le token est invalide ou expiré
 */
export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, secret, {
    audience: 'the-capital',
    issuer: 'the-capital-api',
    clockTolerance: 60, // 1 minute de tolérance
  });
  return payload;
}

/**
 * Extrait le Bearer token d'un header Authorization
 * @param {string} authHeader
 * @returns {string|null}
 */
export function extractBearer(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim();
}
