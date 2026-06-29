// ═══════════════════════════════════════════════════════
// API ROUTER — Toutes les routes en 1 seule fonction
// ═══════════════════════════════════════════════════════

// ─── Libs ───
const config = require('./lib/config');
const cors = require('./lib/cors');
const jwt = require('./lib/jwt');
const middleware = require('./lib/middleware');
const ratelimit = require('./lib/ratelimit');
const response = require('./lib/response');
const supabase = require('./lib/supabase');
const validate = require('./lib/validate');

// ─── Helpers ───
const { parse } = require('url');

// ═══════════════════════════════════════════════════════
// HANDLERS (à remplacer par TON vrai code)
// ═══════════════════════════════════════════════════════

async function handleAdmin(req, res) {
  // TODO: copie ici le code de ton ancien api/admin.js
  return response.json(res, { ok: true, route: 'admin' });
}

async function handleAuth(req, res) {
  // TODO: copie ici le code de ton ancien api/auth.js
  return response.json(res, { ok: true, route: 'auth' });
}

async function handleContact(req, res) {
  // TODO: copie ici le code de ton ancien api/contact.js
  return response.json(res, { ok: true, route: 'contact' });
}

async function handleData(req, res) {
  // TODO: copie ici le code de ton ancien api/data.js
  const { endpoint } = req.query;
  return response.json(res, { ok: true, route: 'data', endpoint });
}

async function handleScraper(req, res) {
  // TODO: copie ici le code de ton ancien api/scraper.js
  return response.json(res, { ok: true, route: 'scraper' });
}

// ═══════════════════════════════════════════════════════
// ROUTEUR PRINCIPAL
// ═══════════════════════════════════════════════════════
module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { pathname } = parse(req.url, true);
  const path = pathname.replace('/api/', '').split('/')[0];

  try {
    switch (path) {
      case 'admin':    return await handleAdmin(req, res);
      case 'auth':     return await handleAuth(req, res);
      case 'contact':  return await handleContact(req, res);
      case 'data':     return await handleData(req, res);
      case 'scraper':  return await handleScraper(req, res);
      default:         return response.json(res, { ok: true, message: 'API The Capital — BRVM' });
    }
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
};
