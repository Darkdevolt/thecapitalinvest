-- Correctif des règles d'écriture du bucket logos-societes.
-- La première version testait la table public.profils, vide dans cette base :
-- le téléversement d'un administrateur était refusé (« new row violates
-- row-level security policy »). Les tables du projet reconnaissent un
-- administrateur par public.is_admin() (table public.users) ; le bucket
-- applique désormais la même règle.

drop policy if exists "logos_societes_insertion_admin" on storage.objects;
create policy "logos_societes_insertion_admin" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos-societes' and (select public.is_admin()));

drop policy if exists "logos_societes_maj_admin" on storage.objects;
create policy "logos_societes_maj_admin" on storage.objects for update to authenticated
  using (bucket_id = 'logos-societes' and (select public.is_admin()))
  with check (bucket_id = 'logos-societes' and (select public.is_admin()));

drop policy if exists "logos_societes_suppression_admin" on storage.objects;
create policy "logos_societes_suppression_admin" on storage.objects for delete to authenticated
  using (bucket_id = 'logos-societes' and (select public.is_admin()));
