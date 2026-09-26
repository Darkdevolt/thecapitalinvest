-- Administration : gestion des comptes clients et options de l'application.
--
-- 1. Les dates d'essai rejoignent les champs protégés de public.users : un
--    client ne pouvait pas changer son offre, mais pouvait prolonger son propre
--    essai (accès Pro) par l'API REST. Seul un administrateur peut désormais
--    les modifier. La règle d'autorisation elle-même est inchangée.
create or replace function public.protect_user_privileged_fields()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if not (select private.is_admin()) then
    if new.is_admin is distinct from old.is_admin
       or new.plan is distinct from old.plan
       or new.plan_expire_at is distinct from old.plan_expire_at
       or new.trial_started_at is distinct from old.trial_started_at
       or new.trial_ends_at is distinct from old.trial_ends_at
       or new.email is distinct from old.email
       or new.created_at is distinct from old.created_at
       or new.last_sign_in_at is distinct from old.last_sign_in_at then
      raise exception 'Modification of protected user fields is restricted';
    end if;
  end if;
  return new;
end;
$$;

-- 2. Options de l'application, modifiables depuis l'administration.
insert into public.admin_settings(key, value, updated_at) values ('app_config', jsonb_build_object(
  'maintenance', false,
  'maintenance_message', 'The Capital est en maintenance. Nous revenons très vite.',
  'banner_enabled', false,
  'banner_text', '',
  'banner_level', 'info',
  'banner_link', '',
  'banner_until', null,
  'signups_open', true,
  'trial_days', 14,
  'support_email', '',
  'support_whatsapp', ''
), now())
on conflict (key) do nothing;

-- Durée de l'essai gratuit à l'inscription : lue dans les options (14 jours par défaut).
create or replace function public.initialize_new_user_trial()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  auth_meta jsonb;
  v_days int;
begin
  if coalesce(new.plan, 'free') = 'free' and new.trial_started_at is null and new.trial_ends_at is null then
    select (value->>'trial_days')::int into v_days from public.admin_settings where key = 'app_config';
    v_days := greatest(0, least(coalesce(v_days, 14), 365));
    if v_days > 0 then
      new.trial_started_at := coalesce(new.created_at, now());
      new.trial_ends_at := coalesce(new.created_at, now()) + make_interval(days => v_days);
    end if;
  end if;
  begin
    select raw_user_meta_data into auth_meta from auth.users where id = new.id;
    if new.legal_consent_at is null then
      new.legal_consent_at := nullif(auth_meta->>'legal_consent_at','')::timestamptz;
    end if;
    if new.legal_version is null then
      new.legal_version := nullif(auth_meta->>'legal_version','');
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

-- 3. Notes internes sur un client (suivi commercial / support), réservées aux administrateurs.
create table if not exists public.user_admin_notes (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  author_id uuid,
  note text not null check (length(note) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists user_admin_notes_user_idx on public.user_admin_notes(user_id, created_at desc);
alter table public.user_admin_notes enable row level security;
drop policy if exists user_admin_notes_admin on public.user_admin_notes;
create policy user_admin_notes_admin on public.user_admin_notes for all
  using ((select public.is_admin())) with check ((select public.is_admin()));
