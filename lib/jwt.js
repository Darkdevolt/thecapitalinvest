import { SignJWT, jwtVerify } from 'jose';
import config from './config.js';
const secret=new TextEncoder().encode(config.jwtSecret);
export async function signToken(payload){return new SignJWT(payload).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime(config.jwtExpiresIn).setAudience('the-capital').setIssuer('the-capital-api').sign(secret);}
export async function verifyToken(token){const {payload}=await jwtVerify(token,secret,{audience:'the-capital',issuer:'the-capital-api',clockTolerance:60});return payload;}
export function extractBearer(authHeader){if(!authHeader||!authHeader.startsWith('Bearer '))return null;return authHeader.slice(7).trim();}
