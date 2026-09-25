/**
 * Contrôle qualité d'un bulletin AVANT toute génération ou publication.
 * Principe : un bulletin n'est jamais envoyé sur des données douteuses ; il est
 * bloqué et une alerte explique pourquoi. Deux niveaux :
 *   - bloquant : le bulletin ne part pas ;
 *   - avertissement : le bulletin part, l'avertissement est signalé en privé.
 *
 * Seuils étalonnés sur l'historique réel (sept. 2025 - sept. 2026) :
 *   - hors séances suivant un trou de l'historique, la variation brute recalculée
 *     égale la variation officielle BRVM pour 100 % des titres ;
 *   - une fois ajustée des dividendes détachés, aucune variation de séance ne
 *     dépasse la limite réglementaire de ±7,5 %.
 */

export const SEUILS = {
  couvertureMin: 0.9,        // part des sociétés actives cotées ce jour-là
  concordanceMin: 0.9,       // part des titres dont la variation recalculée = variation officielle
  ecartConcordance: 0.3,     // points de %
  limiteSeance: 7.6,         // ±7,5 % réglementaires + arrondi
  limiteSemaine: 44,         // 5 séances à ±7,5 % : 1,075^5 − 1 ≈ 43,6 %
  indiceEcart: 0.15          // indice : variation publiée contre variation recalculée
};

const fmt = (v) => (v > 0 ? '+' : '') + v.toFixed(2).replace('.', ',') + ' %';

export function controlerBulletin(d) {
  const bloquants = [], avertissements = [];
  const c = d.controle;
  const hebdo = d.periode === 'hebdo';

  // 1. La séance du jour a bien été importée ET validée par le pipeline.
  // Avertissement seulement : une séance saisie par l'administrateur (import Excel) n'a pas
  // d'exécution de pipeline ; ce sont les contrôles 2 à 4, sur les données elles-mêmes, qui bloquent.
  if (!hebdo && !c.importsValides.includes(d.to)) {
    avertissements.push(`Import de la séance du ${d.to} non validé par le pipeline (aucune exécution « success » pour cette date).`);
  }
  if (hebdo) {
    const nonValidees = d.seances.filter(s => !c.importsValides.includes(s));
    if (nonValidees.length) avertissements.push(`Séances de la semaine sans exécution d'import « success » enregistrée : ${nonValidees.join(', ')}.`);
  }

  // 2. Couverture : presque toutes les sociétés cotées, et les trois indices.
  const couverture = c.nbActifs ? c.nbCotesDernier / c.nbActifs : 0;
  if (couverture < SEUILS.couvertureMin) {
    bloquants.push(`Couverture insuffisante : ${c.nbCotesDernier} titres sur ${c.nbActifs} au ${d.to} (minimum ${Math.round(SEUILS.couvertureMin * 100)} %). Import partiel probable.`);
  }
  const noms = d.indices.map(i => i.nom);
  ['BRVM-COMPOSITE', 'BRVM-30', 'BRVM-PRESTIGE'].forEach(n => {
    const i = d.indices.find(x => x.nom === n);
    if (!i) bloquants.push(`Indice ${n} absent.`);
    else if (i.date !== d.to) bloquants.push(`Indice ${n} non mis à jour (dernière valeur au ${i.date}).`);
    else if (!Number.isFinite(i.perf)) bloquants.push(`Variation de l'indice ${n} indisponible.`);
  });
  if (!noms.length) bloquants.push('Aucun indice disponible.');

  // 3. Concordance avec la variation officielle BRVM, séance par séance.
  const parSeance = {};
  c.concordance.forEach(x => { (parSeance[x.date] = parSeance[x.date] || []).push(x); });
  Object.keys(parSeance).sort().forEach(s => {
    const l = parSeance[s];
    const ok = l.filter(x => x.ecart <= SEUILS.ecartConcordance).length;
    if (l.length >= 10 && ok / l.length < SEUILS.concordanceMin) {
      const ex = l.filter(x => x.ecart > SEUILS.ecartConcordance).slice(0, 4)
        .map(x => `${x.ticker} ${fmt(x.brute)} recalculé / ${fmt(x.officielle)} publié`).join(' ; ');
      bloquants.push(`Séance du ${s} : la variation recalculée ne correspond à la variation officielle que pour ${ok} titres sur ${l.length}. Séance(s) manquante(s) dans l'historique ou données corrompues. Exemples : ${ex}.`);
    } else {
      l.filter(x => x.ecart > SEUILS.ecartConcordance).slice(0, 3).forEach(x =>
        avertissements.push(`${x.ticker} le ${s} : ${fmt(x.brute)} recalculé contre ${fmt(x.officielle)} publié.`));
    }
  });

  // 4. Limite réglementaire des variations (après ajustement des dividendes et opérations).
  const limite = hebdo ? SEUILS.limiteSemaine : SEUILS.limiteSeance;
  c.titres.filter(t => Number.isFinite(t.perf) && Math.abs(t.perf) > limite).forEach(t => {
    bloquants.push(`${t.ticker} : ${fmt(t.perf)} sur la ${hebdo ? 'semaine' : 'séance'}, au-delà de la limite de ±${hebdo ? '43,6' : '7,5'} %, sans dividende ni opération sur capital enregistrés pour l'expliquer.`);
  });

  // 5. Indices : variation publiée cohérente avec les valeurs.
  if (!hebdo) d.indices.forEach(i => {
    if (Number.isFinite(i.perfCalculee) && Number.isFinite(i.perf) && Math.abs(i.perfCalculee - i.perf) > SEUILS.indiceEcart) {
      avertissements.push(`${i.nom} : variation publiée ${fmt(i.perf)}, recalculée ${fmt(i.perfCalculee)} (séance précédente manquante ?).`);
    }
  });

  // 6. Cohérence d'ensemble (avertissement seulement : quelques poids lourds peuvent l'expliquer).
  const comp = d.indices.find(i => i.nom === 'BRVM-COMPOSITE');
  if (comp && Number.isFinite(comp.perf)) {
    if (comp.perf > 0.5 && d.nbBaisses > 2 * Math.max(1, d.nbHausses)) avertissements.push(`Composite ${fmt(comp.perf)} alors que ${d.nbBaisses} titres baissent contre ${d.nbHausses} en hausse.`);
    if (comp.perf < -0.5 && d.nbHausses > 2 * Math.max(1, d.nbBaisses)) avertissements.push(`Composite ${fmt(comp.perf)} alors que ${d.nbHausses} titres montent contre ${d.nbBaisses} en baisse.`);
  }
  if (!(d.valeurTotale > 0)) bloquants.push('Valeur échangée nulle : données de volume manquantes.');

  // Information : titres dont la variation a été ajustée.
  const ajustes = c.titres.filter(t => t.ajuste.length).map(t => `${t.ticker} (${t.ajuste.join(' ; ')})`);
  return { ok: bloquants.length === 0, bloquants, avertissements, ajustes, couverture };
}
