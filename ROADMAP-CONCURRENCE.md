# The Capital vs RichBourse — panoplie fonctionnelle & plan de mise en œuvre

Source : `rapport_audit_richbourse_the_capital.docx` (9 sept. 2026).
Objectif : **reprendre toute la panoplie de RichBourse et aller plus loin**, adapté à
The Capital, avec une exigence absolue : **chaque module lit réellement la base
Supabase `brvm data`** (traçabilité source + date + méthode).

État Supabase constaté (projet `otsiwiwlnowxeolbbgvm`, le 9 sept. 2026) :
`cours` 26 709 · `historique` 150 383 · `indices` 8 553 · `entreprises` 47 ·
`financials` 75 (27 sociétés, 23 avec ≥ 2 ans) · `analyses` 2 ·
`dividendes_calendrier` 191 · `boc` 0 · `coupons_calendrier` 0.

Légende statut : ✅ en place · 🟡 partiel / à fiabiliser · ❌ à construire.

---

## 1. Cartographie module par module

### Marché — « que se passe-t-il aujourd'hui ? »
| Fonction RichBourse | The Capital | Statut | Aller plus loin |
|---|---|---|---|
| Actualités de séance | `#view-overview` (activité, top mouvements) | 🟡 | Fil éditorial daté + archivage ; relier chaque item à une fiche |
| Cotations A→Z | `#view-titres` (cartes + tableau, filtres pays/secteur) | ✅ | Tri multi-colonnes, pagination virtuelle, export CSV |
| Palmarès hausses/baisses/volumes | `#view-overview` Top Mouvements, `#view-marche` | 🟡 | Palmarès par période (jour/semaine/mois/YTD) + filtre liquidité |
| Dividendes (dates, brut/net, historique) | `dividendes_calendrier` (191 l.) → `#view-publications`, dividend-screener | 🟡 | Fiche « rente » par société : historique, taux distribution, régularité |
| Rapports d'activité / documents | `financials.source_url` | 🟡 | Bibliothèque documentaire indexée (année, type, société) |
| Historique des cours (normaux + ajustés) | `historique` (150 k l.) | ✅ | **Cours ajustés** des dividendes/OST + toggle brut/ajusté |
| Indices + historique | `indices` (8 553 l.) | ✅ | Comparaison multi-indices, BRVM Composite **dividendes réinvestis** |
| OPCVM & obligations | — | ❌ | Table `obligations` + vue rendement/maturité/coupon ; `coupons_calendrier` à alimenter |
| Calendrier des événements | `#view-publications` | 🟡 | Calendrier unifié (détachement, paiement, publication, AG) + iCal export |

### Analyse — « pourquoi ce titre évolue-t-il ? »
| Fonction | The Capital | Statut | Aller plus loin |
|---|---|---|---|
| Graphique action (période, type) | `#view-analyse-technique` (barre d'outils complète, indicateurs, dessin) | 🟡 | Fiabiliser le rendu ; sauvegarde des dessins par ticker |
| Analyse technique (indicateurs) | idem (RSI, MACD, Stoch, ADX, CCI, OBV, BB…) | 🟡 | Séparer **données / indicateurs calculés / interprétation auto / opinion éditoriale** (recommandation du rapport) |
| Détection de configurations | signaux `sigGlob/sigTrend/…` | 🟡 | Bandeau « lecture » explicite + niveau de confiance |
| Graphique indice / droit / OPCVM / obligation | indice ✅, reste ❌ | 🟡 | Étendre le moteur graphique aux 4 instruments |
| Comparaison de cours (superposition) | `#view-comparison` | 🟡 | Base 100, corrélation, tracking error |
| Notations financières | 🟡 `#view-outils` (Score maison) | Note /100 valorisation/rentabilité/croissance/rendement/solidité, ventilation affichée ; reste à relier à la fiche et au screener |

### Sociétés — « que vaut cette entreprise ? »
| Bloc de fiche (structure recommandée du rapport) | The Capital `#view-fiche` | Statut |
|---|---|---|
| En-tête : nom, symbole, secteur, pays, cours, variation | ✅ |
| Résumé : capitalisation, liquidité, rendement, performance | 🟡 (partiel) |
| Fondamentaux : CA, résultat net, marges, bilan, endettement | 🟡 (`financials` 27 sociétés) |
| Valorisation : PER, PBR, rendement, comparaison historique + sectorielle | 🟡 (ratios calculés, pas de comparaison sectorielle) |
| Dividendes : historique, taux distribution, dates, prévisions | 🟡 |
| Marché : graphique, volumes, volatilité, perf. relative | 🟡 |
| Documents : rapports, communiqués, AG | ❌ |
| Conclusion : points forts / risques / à surveiller | ❌ (éditorial) |
| **Ratios par secteur** (comparaison pairs) | ❌ |

> **P0 recommandé** : refondre `#view-fiche` sur exactement ces 8 blocs + le bloc
> « ratios secteur ». C'est « le cœur de l'analyse et du référencement » (rapport §5).

### Outils investisseurs — le moteur de décision
| Outil | The Capital | Statut | Aller plus loin |
|---|---|---|---|
| Screening des sociétés (critères combinables) | `#view-screener` (secteur, cours, variation, volume) | 🟡 | + PER, PBR, ROE, marge, rendement, dette, croissance ; presets ; permalien de filtre |
| Ranking (classement par indicateur) | — | ❌ | Classements PBR/PER/rendement/liquidité/volatilité/marge/rotation/perf (Premium chez eux) |
| Comparaison de sociétés | `#view-comparison` | 🟡 | 2→6 sociétés, radar, tableau exportable |
| Sélection du moment / radar micro-trading | ✅ `#view-opportunites` | Balayage de la cote : volume anormal, proche plus-haut/plus-bas fenêtre, écart MM20, forte variation, détachement imminent. Filtres par signal, tri, carte → fiche. Fenêtre historique ~3 mois |
| Watchlist « mes actions suivies » | watchlist (table `watchlist`) | 🟡 | Alertes par ligne, notes, groupes |
| Calculatrices (intérêts composés, obligations, plus-values futures) | ✅ `#view-outils` | 4 onglets : intérêts composés, rendement obligataire (courant + à l'échéance), fourchette de fluctuation BRVM, score maison /100 (ratios réels vs médiane secteur) |
| Market Map BRVM | — | ❌ | Treemap capitalisation × variation |
| Profil d'investisseur | — | ❌ | Quiz → allocation cible |
| Question à un analyste | `capital-ai.html` | 🟡 | Intégrer dans la fiche + Premium |

### Backtesting & quantitatif (Premium chez eux)
| Élément | Statut | Exigence rapport |
|---|---|---|
| Backtesting dividendes / plus-values | ✅ `#view-backtest` | Moteur buy & hold : capital, période, frais achat+vente, base cours (bruts+div / ajustés), réinvestissement. Sorties : valeur nette, perf totale/annualisée, dividendes, volatilité, max drawdown, vs BRVM Composite, journal, CSV. Panneau **Hypothèses** complet (période effective, frais, dividendes, exécution clôture, biais du survivant, limites benchmark) |
| Saisonnalité, réaction aux publications, corrélation matières premières | ❌ | Phase 4 |

### Portefeuille virtuel — le cœur de la fidélisation
| Fonction | The Capital | Statut | Aller plus loin |
|---|---|---|---|
| Portefeuilles (1 par SGI + consolidé) | `#view-portefeuille` (mono) | 🟡 | Multi-comptes + vue consolidée |
| Import relevé SGI | — | ❌ | Assistant d'import (CSV/PDF) + **détection des oublis** (rapport §9) |
| Espèces + titres, chronologie | 🟡 | Journal unifié titres/espèces avec solde après opération |
| Opérations : achat/vente/dividende/dépôt/retrait/frais/**DPS**/**attribution**/souscription | achat/vente/dividende/dépôt | 🟡 | Ajouter OST (droits, actions nouvelles) |
| Calculs : valeur, PV latente, PV réalisée (CMP documenté), rentabilité, cash gagné, diversification, rendement | 🟡 (`overview-insights.js` + portefeuille) | Documenter la méthode CMP à l'écran ; séparer latent / réalisé |
| Sauvegardes / historique | 🟡 | Export + versions |

### Apprendre & contenu
| Type | The Capital | Statut |
|---|---|---|
| Articles / dossiers / lexique / vidéos / quiz / mini-bourse | `the-capital-institute/` | 🟡 |
| **Relier chaque contenu à un outil** (article dividende → calendrier → fiche → simulateur → portefeuille) | ❌ | à systématiser (rapport §10) |

### Premium & monétisation
| Élément | The Capital | Statut |
|---|---|---|
| Séparation gratuit / Premium lisible | `payment.html`, `pro-only` classes | 🟡 |
| Premium = profondeur (ranking, screeners avancés, alertes, backtest, analyses), **jamais la donnée de base** | 🟡 | Cadrer par cas d'usage (rapport §11) |

### Administration & qualité de données
| Élément | Statut | Exigence |
|---|---|---|
| `admin.html` (sources, corrections, journal) | 🟡 | **Traçabilité** : chaque chiffre → source + date publication + méthode (rapport §13). `admin_log`, `data_corrections_log` existent |
| Accès admin | 🟡 | Lien retiré de l'app ✅ ; **reste à faire** : garde de rôle sur `admin.html` + rejet serveur des routes `/api` admin pour non-admin |

---

## 2. Fiabilité de la base — priorité permanente

Chaîne actuelle : `/api/marche?type=…` (Node, Supabase service key) → `loader.js`
(`allCours`, `allIndices`, `allEntreprises`, `allAnalyses` en critique ;
`allFinancials`, `allDividendes`, `allBoc`, `allCoupons`, `allIndicesHistory` en
enrichissement) → globals `window.all*` → `renderCurrentView()`.

À verrouiller :
1. **Un état de chargement explicite par module** (skeleton) + **état d'erreur** au
   lieu d'un écran blanc silencieux.
2. **Bandeau « données au JJ/MM/AAAA »** par vue (dernière `date_seance` /
   `date_publication`).
3. **Schéma figé** : test d'intégrité qui vérifie que les colonnes lues par le JS
   existent dans Supabase (générable depuis `information_schema`).
4. **Cours ajustés** : `historique` ne contient que le brut → calculer l'ajusté
   (dividendes + OST) pour graphiques et perf.
5. `boc` et `coupons_calendrier` sont **vides** → alimenter (scraper BOC) avant
   d'exposer la vue BOC / analyse obligataire.

---

## 3. Plan par phases (repris et adapté du rapport §15.1)

| Phase | Contenu | Livrables |
|---|---|---|
| **P0 — Fondations données + fiche** | Fiche société sur les 8 blocs + ratios secteur ; bandeaux date + états chargement/erreur partout ; garde rôle admin | fiche refondue, `data-freshness`, admin sécurisé |
| **P1 — Décision** | Screener étendu (ratios) + presets + permalien ; Ranking ; Comparaison 2→6 + radar ; Watchlist + alertes par ligne ; Calendrier unifié + iCal | 5 écrans |
| **P2 — Patrimoine** | Portefeuille multi-comptes + consolidé ; OST (DPS, actions nouvelles) ; import assisté + détection des oublis ; méthode CMP à l'écran | portefeuille v2 |
| **P3 — Quantitatif** | Backtesting dividendes + plus-values avec hypothèses affichées ; saisonnalité ; réaction aux publications | moteur backtest |
| **P4 — Contenu & Premium** | Contenus reliés aux outils ; paywall par cas d'usage ; API publique | Institute v2, Premium |
| **P5 — Perso & régional** | Recommandations, profil investisseur, autres places | — |

Chaque phase = 1 à 3 branches, 1 preview Vercel, 1 revue avant merge `main`.

---

## 4. « Aller plus loin que RichBourse » — angles différenciants

- **Transparence méthodologique visible** : sous chaque chiffre, un lien
  « source / date / calcul » (le rapport en fait la recommandation centrale).
- **Cours ajustés natifs** (dividendes + OST) — souvent absent ailleurs.
- **Séparation stricte fait / calcul / interprétation auto / opinion éditoriale**
  dans l'analyse technique et fondamentale.
- **Fiche société « décision en 2 minutes »** : conclusion points forts / risques /
  à surveiller en tête, détail en dessous.
- **Détection des oublis** du portefeuille comme fonctionnalité mise en avant, pas
  cachée.
- **Contenu Institute relié à l'action** : chaque leçon ouvre l'outil concerné avec
  un exemple pré-chargé.

---

*Ce document est le cadre. La construction se fait module par module, avec preview
et revue. Prochaine étape proposée : P0 — refonte de la fiche société.*
