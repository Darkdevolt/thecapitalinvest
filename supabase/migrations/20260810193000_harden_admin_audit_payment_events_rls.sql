-- The Capital — harden sensitive operational/audit tables.
-- No existing rows are modified or deleted.

alter table public.admin_audit_log enable row level security;
alter table public.payment_events enable row level security;

revoke all on table public.admin_audit_log from anon;
revoke all on table public.payment_events from anon;

create policy admin_audit_log_admin_select
on public.admin_audit_log
for select to authenticated
using (public.is_admin());

create policy payment_events_admin_select
on public.payment_events
for select to authenticated
using (public.is_admin());

-- Audit writes are performed by the existing payment/subscription mutation triggers.
-- SECURITY DEFINER keeps those writes working after RLS is enabled while the function
-- itself still refuses to create an audit row unless the actor is an Admin.
create or replace function public.admin_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_admin() then
    return coalesce(new, old);
  end if;

  insert into public.admin_audit_log(
    actor_id, action, table_name, record_id, old_data, new_data
  ) values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(
      (to_jsonb(new)->>'id'),
      (to_jsonb(old)->>'id'),
      (to_jsonb(new)->>'ticker'),
      (to_jsonb(old)->>'ticker')
    ),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$function$;

revoke all on function public.admin_audit_trigger() from public;
grant execute on function public.admin_audit_trigger() to authenticated;
