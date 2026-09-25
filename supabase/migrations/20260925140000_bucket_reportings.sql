-- Bucket des bulletins prêts à publier (/api/telegram-report) : le bucket `bulletins`
-- existant n'accepte que le PDF ; celui-ci prend aussi les visuels PNG et les textes JSON.
-- Public en lecture (liens partageables), écriture par le seul rôle serveur.
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('reportings', 'reportings', true, array['image/png', 'application/pdf', 'application/json'], 20971520)
on conflict (id) do update set public = excluded.public, allowed_mime_types = excluded.allowed_mime_types,
  file_size_limit = excluded.file_size_limit;
