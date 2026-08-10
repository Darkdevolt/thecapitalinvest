-- The Capital — Admin boundary
-- Admin UI remains under public/admin.html; database policies enforce the same boundary.

create or replace function public.tc_is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin, false) = true);
$$;
revoke all on function public.tc_is_admin() from public;
grant execute on function public.tc_is_admin() to authenticated;

do $$
declare t text; tables text[] := array['entreprises','cours','historique','financials','dividendes_calendrier','analyses','indices','actionnaires'];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "tc_public_read_%s" on public.%I', t, t);
      execute format('create policy "tc_public_read_%s" on public.%I for select to anon, authenticated using (true)', t, t);
      execute format('drop policy if exists "tc_admin_insert_%s" on public.%I', t, t);
      execute format('create policy "tc_admin_insert_%s" on public.%I for insert to authenticated with check (public.tc_is_admin())', t, t);
      execute format('drop policy if exists "tc_admin_update_%s" on public.%I', t, t);
      execute format('create policy "tc_admin_update_%s" on public.%I for update to authenticated using (public.tc_is_admin()) with check (public.tc_is_admin())', t, t);
      execute format('drop policy if exists "tc_admin_delete_%s" on public.%I', t, t);
      execute format('create policy "tc_admin_delete_%s" on public.%I for delete to authenticated using (public.tc_is_admin())', t, t);
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.users') is not null then
    alter table public.users enable row level security;
    drop policy if exists "tc_user_read_self" on public.users;
    create policy "tc_user_read_self" on public.users for select to authenticated using (id = auth.uid() or public.tc_is_admin());
    drop policy if exists "tc_user_insert_self" on public.users;
    create policy "tc_user_insert_self" on public.users for insert to authenticated with check (id = auth.uid() and coalesce(is_admin, false) = false);
    drop policy if exists "tc_user_update_self" on public.users;
    create policy "tc_user_update_self" on public.users for update to authenticated using (id = auth.uid() and coalesce(is_admin, false) = false) with check (id = auth.uid() and coalesce(is_admin, false) = false);
    drop policy if exists "tc_admin_update_users" on public.users;
    create policy "tc_admin_update_users" on public.users for update to authenticated using (public.tc_is_admin()) with check (public.tc_is_admin());
    drop policy if exists "tc_admin_delete_users" on public.users;
    create policy "tc_admin_delete_users" on public.users for delete to authenticated using (public.tc_is_admin());
  end if;
end $$;

comment on function public.tc_is_admin() is 'The Capital: authorizes privileged Admin UI/database mutations. Anonymous clients cannot use admin mutations.';
