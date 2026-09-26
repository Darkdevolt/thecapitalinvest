-- Attribution d'abonnement depuis l'administration (validé par le propriétaire le 2026-09-26).
--
-- Les déclencheurs de protection de public.users refusaient toute modification
-- d'offre (plan, échéance, essai, rôle) sans session administrateur, y compris
-- celles du serveur : l'API d'administration (clé service_role, auth.uid() nul)
-- échouait en attribuant ou prolongeant un abonnement (vérifié le 2026-09-26 par
-- une mise à jour annulée : « Modification of protected user fields is restricted »).
--
-- Seules les requêtes portant le rôle service_role (serveur The Capital, jamais
-- exposé au navigateur) sont désormais exemptées. Les sessions client
-- (authenticated) et anonymes restent contrôlées exactement comme avant.
create or replace function public.protect_user_privileged_fields()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if coalesce(auth.jwt()->>'role', '') = 'service_role' then
    return new;
  end if;
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

create or replace function private.protect_user_role_fields()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if coalesce(auth.jwt()->>'role', '') = 'service_role' then
    return new;
  end if;
  if not private.is_admin() then
    if new.is_admin is distinct from old.is_admin
       or new.plan is distinct from old.plan
       or new.plan_expire_at is distinct from old.plan_expire_at then
      raise exception 'protected account fields may only be changed by an administrator';
    end if;
  end if;
  return new;
end;
$$;
