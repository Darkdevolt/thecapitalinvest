import { supabaseAdmin, isSupabaseReady } from './lib/supabase.js';
import { authenticate } from './lib/middleware.js';

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Requested-With');
  return res.end(JSON.stringify(payload));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const TABLES = { alerts: 'alertes_cours', watchlist: 'watchlist' };

// The database constraint uses HAUSSE / BAISSE. The frontend historically used
// above / below, so the API normalizes both representations without changing
// existing Supabase data.
function normalizeAlertType(value) {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'above' || type === 'hausse') return 'HAUSSE';
  if (type === 'below' || type === 'baisse') return 'BAISSE';
  return null;
}

function apiAlert(row) {
  if (!row) return row;
  return { ...row, condition: row.type_alerte === 'HAUSSE' ? 'above' : row.type_alerte === 'BAISSE' ? 'below' : row.type_alerte };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, null);
  if (!isSupabaseReady() || !supabaseAdmin) return json(res, 503, { success:false, error:'Supabase non configuré' });
  const auth = await authenticate(req);
  if (auth.response) return res.end(Buffer.from(await auth.response.arrayBuffer()));
  const userId = auth.user.sub;
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const mode = url.searchParams.get('mode');
  const table = TABLES[mode];
  if (!table) return json(res, 400, { success:false, error:'Mode invalide' });

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin.from(table).select('*').eq('user_id', userId).order('created_at', { ascending:false });
      if (error) throw error;
      const output = mode === 'alerts' ? (data || []).map(apiAlert) : (data || []);
      return json(res, 200, { success:true, data:output });
    }

    if (req.method === 'POST') {
      const input = await readBody(req);
      let row;
      if (mode === 'alerts') {
        const alertType = normalizeAlertType(input.condition || input.type_alerte);
        if (!alertType) return json(res,400,{success:false,error:'Condition d’alerte invalide'});
        row = { user_id:userId, ticker:String(input.ticker||'').toUpperCase(), type_alerte:alertType, seuil:Number(input.price ?? input.seuil), active:input.active !== false, note:input.note || null };
        if (!row.ticker || !Number.isFinite(row.seuil)) return json(res,400,{success:false,error:'Ticker et seuil obligatoires'});
      } else {
        row = { user_id:userId, ticker:String(input.ticker||'').toUpperCase(), note:input.note || null };
        if (!row.ticker) return json(res,400,{success:false,error:'Ticker obligatoire'});
      }
      const { data, error } = await supabaseAdmin.from(table).insert(row).select('*').single();
      if (error) throw error;
      return json(res,201,{success:true,data:mode === 'alerts' ? apiAlert(data) : data});
    }

    if (req.method === 'PUT') {
      const id = url.searchParams.get('id');
      if (!id) return json(res,400,{success:false,error:'ID manquant'});
      const input = await readBody(req);
      const update = mode === 'alerts'
        ? { active: input.active, note: input.note }
        : { note: input.note };
      const { data, error } = await supabaseAdmin.from(table).update(update).eq('id',id).eq('user_id',userId).select('*').single();
      if (error) throw error;
      return json(res,200,{success:true,data:mode === 'alerts' ? apiAlert(data) : data});
    }

    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return json(res,400,{success:false,error:'ID manquant'});
      const { error } = await supabaseAdmin.from(table).delete().eq('id',id).eq('user_id',userId);
      if (error) throw error;
      return json(res,200,{success:true});
    }
    return json(res,405,{success:false,error:'Méthode non autorisée'});
  } catch (error) {
    console.error('[USER DATA]', error);
    return json(res,500,{success:false,error:'Erreur serveur',detail:error.message});
  }
}
