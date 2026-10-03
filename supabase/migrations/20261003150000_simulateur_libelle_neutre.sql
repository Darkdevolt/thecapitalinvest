-- Simulateur d'ordre obligataire : libellé neutre par défaut (« Commission SGI »),
-- le nom de la SGI n'est pas imposé aux abonnés (chacun peut saisir le sien).
update public.parametres_publics
   set valeur = jsonb_set(valeur, '{commission_sgi_libelle}', '"Commission SGI"'), updated_at = now()
 where cle = 'simulateur_obligataire' and valeur->>'commission_sgi_libelle' = 'Commission ICF';
