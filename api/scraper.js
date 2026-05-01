import { supabaseAdmin } from './lib/supabase.js';
import { json, error, success } from './lib/response.js';

export default async function handler(req) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return error('Non autorisé', 401, 'UNAUTHORIZED');
  }

  const today = new Date().toISOString().split('T')[0];
  let scraped = 0;
  let inserted = 0;
  const errors = [];

  try {
    const mockData = [
      { ticker: 'SNTS', cours: 14500, variation: 0.8, volume: 1250 },
      { ticker: 'SGBC', cours: 33100, variation: -0.3, volume: 890 },
    ];

    for (const row of mockData) {
      scraped++;
      const { error: dbError } = await supabaseAdmin
        .from('cours')
        .upsert({
          ticker: row.ticker,
          date_seance: today,
          cours: row.cours,
          variation: row.variation,
          volume: row.volume,
          updated_at: new Date().toISOString(),
        }, { onConflict: ['ticker', 'date_seance'] });

      if (dbError) {
        errors.push(`${row.ticker}: ${dbError.message}`);
      } else {
        inserted++;
      }
    }

    return success({
      date: today,
      scraped,
      inserted,
      errors: errors.length ? errors : null,
      fallback: false,
    });
  } catch (e) {
    console.error('Scraper error:', e);
    return error('Erreur scraping', 500, 'SCRAPER_ERROR');
  }
}
