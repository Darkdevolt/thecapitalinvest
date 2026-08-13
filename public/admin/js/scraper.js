document.write('<script src="admin/js/scraper-legacy.js"><\/script>');
window.runScraper=async function(){
const msg=document.getElementById('scraper-msg');if(msg){msg.textContent='Scraper en cours...';msg.className='msg info';}
appendScraperLog('Lancement du scraper BRVM...','info');
try{
const r=await fetch('/api/scrape-brvm',{method:'POST',headers:{'Content-Type':'application/json'}});
const d=await r.json().catch(()=>({}));
if(!r.ok||!d.success){
const details=Array.isArray(d.details)?d.details.map(x=>x.source+': '+x.error).join(' | '):'';
throw new Error((d.error||('HTTP '+r.status))+(details?' — '+details:''));
}
if(d.source==='Sika Finance'){
const rows=d.data?.rows||[];
appendScraperLog('BRVM inaccessible — fallback Sika Finance...','info');
appendScraperLog('Sika Finance : récupération réussie','ok');
appendScraperLog('✓ '+rows.length+' titres récupérés','ok');
if(!rows.length)throw new Error('Aucune cotation Sika Finance récupérée');
const historique=rows.map(r=>({
 ticker:r.ticker,
 date_seance:r.date_seance,
 cours_cloture:r.cours,
 cours_ouverture:r.ouverture,
 plus_haut:r.plus_haut,
 plus_bas:r.plus_bas,
 volume:r.volume,
 variation:r.variation,
 valeur_totale:r.valeur
}));
const result=await sbPost('historique',historique,'ticker,date_seance');
if(!result)throw new Error('Échec de synchronisation Supabase (historique)');
appendScraperLog('✓ '+historique.length+' cours synchronisés dans historique','ok');
appendScraperLog('✓ données synchronisées','ok');
}else{
appendScraperLog('BRVM : récupération réussie','ok');
appendScraperLog('✓ données synchronisées par la source BRVM','ok');
}
appendScraperLog('Source utilisée : '+d.source,'ok');
if(msg){msg.textContent='✓ Terminé — source : '+d.source;msg.className='msg ok'}
toast('Scraper terminé — '+d.source,'ok')
}catch(e){
appendScraperLog('Échec du scraping : '+e.message,'err');
if(msg){msg.textContent='Erreur scraper : '+e.message;msg.className='msg err'}
toast('Échec du scraping BRVM','err')
}
};