export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // IMPORTANT: this endpoint is a compatibility wrapper for legacy callers.
  // It MUST only retrieve BRVM data. It must never call the old Supabase cron
  // writer, otherwise it bypasses the Admin MANUAL/AUTOMATIC workflow.
  try {
    const response = await fetch(new URL('/api/scrape-brvm', `https://${req.headers.host || 'thecapitalinvest.vercel.app'}`).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {})
      },
      body: '{}'
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(502).json({ success: false, error: String(error) });
  }
}
