// ═══════════════════════════════════════════════════════════════════════════════
// THE CAPITAL — Vercel Node.js Adapter
// ═══════════════════════════════════════════════════════════════════════════════
//
// Le routeur métier api/index.js utilise l'API Web Request/Response.
// Vercel détecte actuellement api/index.js comme une fonction Node.js
// et attend donc (req, res).
//
// Ce fichier fait le pont entre les deux modèles.
//
// Node/Vercel:
//     IncomingMessage / ServerResponse
//
// The Capital router:
//     Request / Response
// ═══════════════════════════════════════════════════════════════════════════════

import router from './index.js';

function getHeaderValue(req, name) {
  const value = req.headers?.[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  return value || '';
}

async function readBody(req) {
  if (
    req.method === 'GET' ||
    req.method === 'HEAD' ||
    req.method === 'OPTIONS'
  ) {
    return undefined;
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk)
    );
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return Buffer.concat(chunks);
}

function buildAbsoluteUrl(req) {
  const protocol =
    getHeaderValue(req, 'x-forwarded-proto') ||
    'https';

  const host =
    getHeaderValue(req, 'x-forwarded-host') ||
    getHeaderValue(req, 'host') ||
    'localhost';

  return `${protocol}://${host}${req.url || '/'}`;
}

async function createWebRequest(req) {
  const body = await readBody(req);

  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers || {})) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      headers.set(key, value.join(', '));
    } else {
      headers.set(key, String(value));
    }
  }

  const options = {
    method: req.method || 'GET',
    headers,
  };

  if (body !== undefined) {
    options.body = body;
    options.duplex = 'half';
  }

  return new Request(
    buildAbsoluteUrl(req),
    options
  );
}

async function sendWebResponse(res, response) {
  if (!(response instanceof Response)) {
    res.statusCode = 500;
    res.setHeader(
      'Content-Type',
      'application/json; charset=utf-8'
    );

    return res.end(
      JSON.stringify({
        success: false,
        error: 'Invalid API response',
      })
    );
  }

  res.statusCode = response.status;

  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const body = await response.arrayBuffer();

  return res.end(
    Buffer.from(body)
  );
}

export default async function handler(req, res) {
  try {
    console.log(
      '[VERCEL ADAPTER] Request:',
      req.method,
      req.url
    );

    const webRequest =
      await createWebRequest(req);

    const webResponse =
      await router(webRequest);

    return await sendWebResponse(
      res,
      webResponse
    );
  } catch (error) {
    console.error(
      '[VERCEL ADAPTER] Fatal error:',
      error
    );

    if (!res.headersSent) {
      res.statusCode = 500;

      res.setHeader(
        'Content-Type',
        'application/json; charset=utf-8'
      );
    }

    return res.end(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
      })
    );
  }
}
