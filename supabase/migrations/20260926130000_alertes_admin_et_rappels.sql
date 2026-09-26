-- Alertes Telegram à l'administrateur (bot déjà utilisé pour les bulletins, gratuit)
-- et rappel quotidien de fin d'essai par e-mail.
--
-- Chaque alerte est envoyée par public.tc_send_telegram (pg_net, asynchrone) :
-- une panne Telegram ne bloque jamais l'insertion de la ligne.

create or replace function public.tc_alerte_admin()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_msg text;
  v_user record;
begin
  begin
    if tg_table_name = 'users' then
      v_msg := '🆕 Nouvelle inscription : ' || coalesce(new.nom, '—') || ' <' || coalesce(new.email, '?') || '>';
    elsif tg_table_name = 'payment_proofs' then
      select email, nom into v_user from public.users where id = new.user_id;
      v_msg := '💳 Reçu de paiement à vérifier : ' || coalesce(v_user.nom, v_user.email, new.user_id::text)
        || coalesce(' — ' || to_char(new.claimed_amount, 'FM999G999G999') || ' FCFA', '')
        || coalesce(' — réf. ' || new.transaction_reference, '') || E'\nAdmin → Gestion → Paiements';
    elsif tg_table_name = 'contacts' then
      v_msg := '✉️ Nouveau message de ' || coalesce(nullif(trim(coalesce(new.prenom, '') || ' ' || coalesce(new.nom, '')), ''), '—')
        || ' <' || coalesce(new.email, '?') || '>' || coalesce(E'\nObjet : ' || new.objet, '')
        || E'\n' || left(coalesce(new.message, ''), 400);
    end if;
    if v_msg is not null then
      perform public.tc_send_telegram(v_msg);
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;
revoke all on function public.tc_alerte_admin() from public, anon, authenticated;

drop trigger if exists trg_tc_alerte_inscription on public.users;
create trigger trg_tc_alerte_inscription after insert on public.users
  for each row execute function public.tc_alerte_admin();

drop trigger if exists trg_tc_alerte_paiement on public.payment_proofs;
create trigger trg_tc_alerte_paiement after insert on public.payment_proofs
  for each row execute function public.tc_alerte_admin();

drop trigger if exists trg_tc_alerte_contact on public.contacts;
create trigger trg_tc_alerte_contact after insert on public.contacts
  for each row execute function public.tc_alerte_admin();

-- Rappel de fin d'essai (J-3 et J-1), chaque jour à 09:05 UTC.
select cron.unschedule('tc-rappels-essai') where exists (select 1 from cron.job where jobname = 'tc-rappels-essai');
select cron.schedule('tc-rappels-essai', '5 9 * * *',
  $$select public.tc_call_api('/api/process-brvm', 'POST', '{"scope":"trial-reminders"}'::jsonb)$$);
