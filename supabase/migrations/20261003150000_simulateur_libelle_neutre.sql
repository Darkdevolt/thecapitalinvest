-- Simulateur d'ordre obligataire : libellé neutre par défaut (« Commission SGI »),
-- le nom de la SGI n'est pas imposé aux abonnés (chacun peut saisir le sien).
update public.parametres_publics
   set valeur = jsonb_set(valeur, '{commission_sgi_libelle}', '"Commission SGI"'), updated_at = now()
 where cle = 'simulateur_obligataire' and valeur->>'commission_sgi_libelle' = 'Commission ICF';

-- Taux par défaut alignés sur la fiche SGI de référence la plus récente
-- (EOS.O19, transaction du 29/07/2026) : commission 0,9 %, apporteur 200 FCFA
-- par titre, TAF 17 % de la commission, BRVM/DC-BR 0,11692125 % du nominal, T+2.
update public.parametres_publics
   set valeur = valeur || '{"commission_sgi_pct": 0.9, "apporteur_par_titre": 200, "apporteur_actif": true, "taf_pct": 17, "taf_sur_apporteur": false, "brvm_dcbr_pct": 0.11692125, "brvm_dcbr_base": "nominal", "brvm_dcbr_actif": true, "delai_reglement_jours": 2}'::jsonb,
       updated_at = now()
 where cle = 'simulateur_obligataire';
