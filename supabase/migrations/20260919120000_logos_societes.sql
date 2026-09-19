-- Logos des sociétés cotées.
-- Lecture publique (le site les affiche à tous), écriture réservée aux
-- administrateurs, selon la même règle que les buckets bulletins et
-- etats-financiers. Le téléversement se fait depuis l'admin, directement
-- vers le stockage, sans fonction serverless supplémentaire.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos-societes', 'logos-societes', true, 1048576,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "logos_societes_lecture_publique" on storage.objects;
create policy "logos_societes_lecture_publique" on storage.objects
  for select using (bucket_id = 'logos-societes');

drop policy if exists "logos_societes_insertion_admin" on storage.objects;
create policy "logos_societes_insertion_admin" on storage.objects
  for insert with check (
    bucket_id = 'logos-societes'
    and auth.uid() in (select id from public.profils where is_admin = true)
  );

drop policy if exists "logos_societes_maj_admin" on storage.objects;
create policy "logos_societes_maj_admin" on storage.objects
  for update using (
    bucket_id = 'logos-societes'
    and auth.uid() in (select id from public.profils where is_admin = true)
  );

drop policy if exists "logos_societes_suppression_admin" on storage.objects;
create policy "logos_societes_suppression_admin" on storage.objects
  for delete using (
    bucket_id = 'logos-societes'
    and auth.uid() in (select id from public.profils where is_admin = true)
  );
