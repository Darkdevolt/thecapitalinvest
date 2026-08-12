export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const response = await fetch('https://otsiwiwlnowxeolbbgvm.supabase.co/functions/v1/scrape-brvm-cron', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error) });
  }
}
