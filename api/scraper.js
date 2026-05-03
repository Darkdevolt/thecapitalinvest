// FIX S-04 : Authentification CRON obligatoire (suppression du court-circuit si CRON_SECRET absent)
import { supabaseAdmin } from './lib/supabase.js';
import { error, success } from './lib/response.js';

export default async function handler(req) {
  // FIX S-04 : on rejette TOUJOURS si le secret ne correspond pas,
  // qu'il soit défini ou non — plus de court-circuit dangereux
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return error('Non autorisé', 401, 'UNAUTHORIZED');
  }

  const today = new Date().toISOString().split('T')[0];
  let scraped = 0;
  let inserted = 0;
  const errors = [];

  try {
    // TODO : Remplacer ce bloc par un vrai scraping BRVM (brvm.org ou API tierce).
    // Les données ci-dessous sont des exemples de structure — NE PAS utiliser en production.
    // Exemple de structure attendue après scraping réel :
    // { ticker: 'SNTS', cours: 14500, variation: 0.8, volume: 1250 }
    const scrapedData = [
      // Insérer ici le résultat du scraping réel
    ];

    if (scrapedData.length === 0) {
      return success({
        date: today,
        scraped: 0,
        inserted: 0,
        errors: null,
        message: 'Aucune donnée à importer — scraping réel non encore implémenté.',
      });
    }

    for (const row of scrapedData) {
      scraped++;
      const { error: dbError } = await supabaseAdmin
        .from('cours')
        .upsert(
          {
            ticker: row.ticker,
            date_seance: today,
            cours: row.cours,
            variation: row.variation,
            volume: row.volume,
            updated_at: new Date().toISOString(),
          },
          { onConflict: ['ticker', 'date_seance'] }
        );

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
