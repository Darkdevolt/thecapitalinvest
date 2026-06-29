// api/index.js — Routeur unique pour toutes les API
const config = require('./lib/config');
const cors = require('./lib/cors');
const jwt = require('./lib/jwt');
const middleware = require('./lib/middleware');
const ratelimit = require('./lib/ratelimit');
const response = require('./lib/response');
const supabase = require('./lib/supabase');
const validate = require('./lib/validate');

// ───────────────────────────────────────
// HANDLERS (copie le code de tes fichiers)
// ───────────────────────────────────────

// === ADMIN ===
async function handleAdmin(req, res) {
  // Copie ici le contenu de ton api/admin.js
  // Exemple :
  const { action } = req.query;
  if (action === 'stats') {
    return response.json(res, { stats: 'données admin' });
  }
  return response.json(res, { message: 'Admin OK' });
}

// === AUTH ===
async function handleAuth(req, res) {
  // Copie ici le contenu de ton api/auth.js
  const { action } = req.query;
  if (action === 'login') {
    // logique login...
    return response.json(res, { token: 'jwt_token' });
  }
  if (action === 'register') {
    // logique register...
    return response.json(res, { message: 'Inscription OK' });
  }
  return response.json(res, { message: 'Auth OK' });
}

// === CONTACT ===
async function handleContact(req, res) {
  // Copie ici le contenu de ton api/contact.js
  const { name, email, message } = req.body || {};
  // logique envoi email...
  return response.json(res, { message: 'Message envoyé' });
}

// === DATA (BOC, FICHE, MARCHE) ===
async function handleData(req, res) {
  // Copie ici le contenu de ton api/data.js
  const { endpoint } = req.query;
  
  switch(endpoint) {
    case 'boc':
      return response.json(res, { data: 'données BOC' });
    case 'fiche':
      return response.json(res, { data: 'données fiche' });
    case 'marche':
      return response.json(res, { data: 'données marché' });
    default:
      return response.json(res, { data: 'données générales' });
  }
}

// === SCRAPER ===
async function handleScraper(req, res) {
  // Copie ici le contenu de ton api/scraper.js
  // logique scraping BRVM...
  return response.json(res, { message: 'Scraping terminé' });
}

// ───────────────────────────────────────
// ROUTEUR PRINCIPAL
// ───────────────────────────────────────
module.exports = async (req, res) => {
  // CORS
  cors.setHeaders(res);
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Rate limiting
  const allowed = await ratelimit.check(req);
  if (!allowed) {
    return response.error(res, 429, 'Trop de requêtes');
  }

  // JWT middleware si besoin
  const token = jwt.extract(req);
  
  // Routing
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  const path = pathname.replace('/api/', '').split('/')[0];
  const query = new URL(req.url, `http://${req.headers.host}`).searchParams;

  try {
    switch(path) {
      case 'admin':
        return await handleAdmin(req, res);
      case 'auth':
        return await handleAuth(req, res);
      case 'contact':
        return await handleContact(req, res);
      case 'data':
      case 'boc':
      case 'fiche':
      case 'marche':
        return await handleData(req, res);
      case 'scraper':
        return await handleScraper(req, res);
      default:
        return response.error(res, 404, 'Endpoint non trouvé');
    }
  } catch (err) {
    console.error('API Error:', err);
    return response.error(res, 500, err.message);
  }
};
