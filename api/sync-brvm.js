// The Capital — scheduled BRVM data refresh
// Vercel Cron calls this endpoint; it delegates the actual scrape to the
// Supabase Edge Function so the privileged database key never reaches the browser.
import config from './lib/config.js';

function json(body, status = 200) {
  return {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Vercel Cron sends this header. If CRON_SECRET is configured, require it too.
  const cronHeader = req.headers?.['x-vercel-cron'] || req.headers?.['x-vercel-cron-schedule'];
  const providedSecret = req.headers?.['x-cron-secret'] || req.query?.secret;
  if (!cronHeader && (!config.cronSecret || providedSecret !== config.cronSecret)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    return res.status(503).json({ success: false, error: 'Supabase URL/key not configured' });
  }

  const endpoint = `${config.supabaseUrl}/functions/v1/scrape-brvm`;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.supabasePublishableKey}`,
        apikey: config.supabasePublishableKey,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(25000),
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[CRON] BRVM sync failed:', error);
    return res.status(502).json({ success: false, error: error.message || 'BRVM sync failed' });
  }
}
