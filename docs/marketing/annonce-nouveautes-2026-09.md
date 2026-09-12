# Annonce nouveautés — The Capital (septembre 2026)

Contenu prêt à copier-coller. Basé sur les fonctionnalités réellement livrées
(voir `git log`, `CHANGELOG.md`) : marché obligataire, dividendes/ESV,
reporting public, analyse technique v3, screener, portefeuille multi-comptes.

Objectif : donner aux prospects une raison concrète de s'abonner *maintenant*,
et rappeler aux abonnés existants la valeur qu'ils ont déjà entre les mains.
Le détail complet vit sur `/nouveautes.html` — tous les liens ci-dessous y renvoient.

---

## 1. Email — abonnés existants & essais en cours

**Objet (A/B) :**
- A. Ce qui a changé sur The Capital depuis votre inscription
- B. 6 nouveautés The Capital que vous n'avez peut-être pas vues

**Pré-en-tête :** Obligations, dividendes, reporting public, analyse technique v3 — le point sur les derniers ajouts.

**Corps :**

> Bonjour {{prenom}},
>
> The Capital a évolué ces dernières semaines. Voici ce qui est déjà disponible
> sur votre compte :
>
> **Marché obligataire**
> Chaque emprunt obligataire dispose maintenant de sa fiche technique complète
> (ISIN, DC/BR UEMOA), avec une vue Obligations dédiée dans l'app.
>
> **Dividendes & évènements sur valeurs**
> Le prochain dividende s'affiche avant même son détachement, avec le calcul
> brut/net d'IRVM. Les convocations d'AG, résultats et avis apparaissent
> directement sur la fiche de chaque société.
>
> **Reporting public**
> Le bulletin de marché du jour est publié en accès libre, avec un format
> "réseaux sociaux" pensé pour être partagé en un clic.
>
> **Pour les profils Professional**
> Analyse technique v3, screener + ranking, backtesting BRVM : le pôle analyse
> a été retravaillé en profondeur.
>
> [Voir toutes les nouveautés →]({{lien_nouveautes}})
>
> Bonne semaine sur les marchés,
> L'équipe The Capital

---

## 2. Email — prospects (avant abonnement / relance essai non converti)

**Objet :** Avant de choisir une offre, voici ce que The Capital vient d'ajouter

**Corps :**

> Bonjour {{prenom}},
>
> Avant de comparer nos offres, un point rapide sur ce qui est déjà inclus
> aujourd'hui :
>
> - **Free** : marché BRVM, fiches sociétés, évènements sur valeurs, reporting
>   public — sans carte bancaire.
> - **Investor** : + marché obligataire, dividendes brut/net, alertes de prix,
>   suivi de portefeuille multi-comptes.
> - **Professional** : + screener, backtesting, analyse technique v3,
>   valorisation DCF.
>
> Chaque offre payante s'essaie 14 jours, sans engagement.
>
> [Voir le détail des nouveautés]({{lien_nouveautes}}) · [Comparer les offres]({{lien_offres}})
>
> L'équipe The Capital

---

## 3. LinkedIn (ton institutionnel)

> **The Capital continue d'étoffer son socle de données sur la BRVM.**
>
> Dernières mises en production :
> → Fiches techniques obligataires par ISIN (DC/BR UEMOA)
> → Suivi des évènements sur valeurs (AG, résultats, dividendes) par société
> → Reporting de marché public, mis à jour à chaque séance
> → Analyse technique v3 et screener retravaillés pour les profils Professional
>
> Le détail : {{lien_nouveautes}}
>
> #BRVM #UEMOA #InvestissementAfrique #MarchésFinanciers

---

## 4. X / Facebook (court)

> 🔔 Nouveau sur The Capital : marché obligataire par ISIN, suivi des
> évènements sur valeurs, reporting BRVM public et analyse technique v3.
> Le détail → {{lien_nouveautes}}

---

## 5. Accroche bannière / pop-up site (courte)

> Nouveau : marché obligataire, évènements sur valeurs et reporting public.
> [Voir les nouveautés →]

*(Une version de ce lien est déjà en place sur la page d'inscription :
[register.html](../../public/register.html) et en section dédiée sur la
page d'accueil, avant l'offre — voir `#nouveautes` sur
[index.html](../../public/index.html).)*

---

## Notes d'usage

- Remplacer `{{lien_nouveautes}}` par `https://thecapitalinvest.com/nouveautes.html`
  et `{{lien_offres}}` par `https://thecapitalinvest.com/#offres` avant diffusion.
- Le contenu de `/nouveautes.html` doit rester la source de vérité : si une
  fonctionnalité y est ajoutée ou retirée, mettre à jour les emails/posts en
  conséquence avant l'envoi.
- Aucun envoi n'a été effectué — ces textes sont des brouillons à valider puis
  à diffuser via vos propres outils (ESP email, réseaux sociaux).
