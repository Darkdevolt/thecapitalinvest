-- Connexion Google / Apple : le nom arrive dans full_name / name, pas dans nom.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.users (id, email, nom, plan, is_admin)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'nom', new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), ''),
    'free',
    false
  )
  on conflict (id) do update
    set email = excluded.email,
        nom = coalesce(excluded.nom, public.users.nom),
        updated_at = now();
  return new;
end;
$function$;
