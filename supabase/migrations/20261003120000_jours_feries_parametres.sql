-- Jours fériés de la BRVM (Abidjan), gérés depuis l'admin (module « Jours fériés »).
-- Ils neutralisent les jours sans séance dans les calendriers de contrôle et
-- alimentent les horaires de marché de l'application. Lecture publique,
-- écriture réservée à l'administration.
create table if not exists public.jours_feries (
  date date primary key,
  libelle text not null,
  created_at timestamptz not null default now()
);
alter table public.jours_feries enable row level security;
drop policy if exists public_read_jours_feries on public.jours_feries;
create policy public_read_jours_feries on public.jours_feries for select to anon, authenticated using (true);
drop policy if exists tc_admin_write_jours_feries on public.jours_feries;
create policy tc_admin_write_jours_feries on public.jours_feries for all to authenticated
  using ((select private.tc_is_admin())) with check ((select private.tc_is_admin()));

-- Paramètres publics réglés par l'administration (simulateur obligataire…).
create table if not exists public.parametres_publics (
  cle text primary key,
  valeur jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.parametres_publics enable row level security;
drop policy if exists public_read_parametres_publics on public.parametres_publics;
create policy public_read_parametres_publics on public.parametres_publics for select to anon, authenticated using (true);
drop policy if exists tc_admin_write_parametres_publics on public.parametres_publics;
create policy tc_admin_write_parametres_publics on public.parametres_publics for all to authenticated
  using ((select private.tc_is_admin())) with check ((select private.tc_is_admin()));

-- 2020-2025 : jours ouvrés sans aucune séance en base (tous des fériés ivoiriens
-- connus) ; 2026 : calendrier BRVM publié, lendemain de la Nuit du destin
-- observé le lundi 16/03 (séance cotée le 17/03, aucune le 16/03). Les trous d'août-septembre 2026 ne
-- sont PAS des fériés (séances manquantes) et ne figurent pas ici.
insert into public.jours_feries (date, libelle) values
('2020-01-01', 'Jour de l''an'),
('2020-04-13', 'Lundi de Pâques'),
('2020-05-01', 'Fête du Travail'),
('2020-05-20', 'Jour férié (fête religieuse)'),
('2020-05-21', 'Ascension'),
('2020-06-01', 'Lundi de Pentecôte'),
('2020-07-31', 'Jour férié (fête religieuse)'),
('2020-08-07', 'Fête de l''Indépendance'),
('2020-10-29', 'Jour férié (fête religieuse)'),
('2020-12-25', 'Noël'),
('2021-01-01', 'Jour de l''an'),
('2021-04-05', 'Lundi de Pâques'),
('2021-05-12', 'Jour férié (fête religieuse)'),
('2021-05-13', 'Ascension'),
('2021-05-24', 'Lundi de Pentecôte'),
('2021-07-20', 'Jour férié (fête religieuse)'),
('2021-10-18', 'Jour férié (fête religieuse)'),
('2021-11-01', 'Toussaint'),
('2021-11-15', 'Journée nationale de la Paix'),
('2022-04-18', 'Lundi de Pâques'),
('2022-04-28', 'Jour férié (fête religieuse)'),
('2022-05-02', 'Jour férié (fête religieuse)'),
('2022-05-26', 'Ascension'),
('2022-06-06', 'Lundi de Pentecôte'),
('2022-08-08', 'Jour férié (fête religieuse)'),
('2022-08-15', 'Assomption'),
('2022-11-01', 'Toussaint'),
('2022-11-15', 'Journée nationale de la Paix'),
('2022-12-26', 'Lendemain de Noël'),
('2023-04-10', 'Lundi de Pâques'),
('2023-04-18', 'Jour férié (fête religieuse)'),
('2023-04-21', 'Jour férié (fête religieuse)'),
('2023-05-01', 'Fête du Travail'),
('2023-05-18', 'Ascension'),
('2023-05-29', 'Lundi de Pentecôte'),
('2023-06-28', 'Jour férié (fête religieuse)'),
('2023-08-07', 'Fête de l''Indépendance'),
('2023-08-15', 'Assomption'),
('2023-09-27', 'Jour férié (fête religieuse)'),
('2023-11-01', 'Toussaint'),
('2023-11-15', 'Journée nationale de la Paix'),
('2023-12-25', 'Noël'),
('2024-01-01', 'Jour de l''an'),
('2024-02-12', 'Jour férié (fête religieuse)'),
('2024-04-01', 'Lundi de Pâques'),
('2024-04-10', 'Jour férié (fête religieuse)'),
('2024-05-01', 'Fête du Travail'),
('2024-05-09', 'Ascension'),
('2024-05-20', 'Lundi de Pentecôte'),
('2024-06-17', 'Jour férié (fête religieuse)'),
('2024-08-07', 'Fête de l''Indépendance'),
('2024-08-15', 'Assomption'),
('2024-11-01', 'Toussaint'),
('2024-11-15', 'Journée nationale de la Paix'),
('2024-12-25', 'Noël'),
('2025-01-01', 'Jour de l''an'),
('2025-03-27', 'Jour férié (fête religieuse)'),
('2025-03-31', 'Jour férié (fête religieuse)'),
('2025-04-21', 'Lundi de Pâques'),
('2025-05-01', 'Fête du Travail'),
('2025-05-29', 'Ascension'),
('2025-06-06', 'Jour férié (fête religieuse)'),
('2025-06-09', 'Lundi de Pentecôte'),
('2025-08-07', 'Fête de l''Indépendance'),
('2025-08-15', 'Assomption'),
('2025-09-04', 'Jour férié (fête religieuse)'),
('2025-12-25', 'Noël'),
('2026-01-01', 'Jour de l''an'),
('2026-03-16', 'Lendemain de la Nuit du destin'),
('2026-03-20', 'Fête du Ramadan'),
('2026-04-06', 'Lundi de Pâques'),
('2026-05-01', 'Fête du Travail'),
('2026-05-14', 'Ascension'),
('2026-05-25', 'Lundi de Pentecôte'),
('2026-05-27', 'Fête de la Tabaski'),
('2026-08-07', 'Fête de l''Indépendance'),
('2026-08-25', 'Fête du Maouloud'),
('2026-12-25', 'Noël')
on conflict (date) do nothing;

-- Paramètres par défaut du simulateur d'ordre obligataire (modèle propriétaire).
insert into public.parametres_publics (cle, valeur) values ('simulateur_obligataire', '{
  "commission_sgi_pct": 0.4, "commission_sgi_libelle": "Commission ICF",
  "taf_pct": 17, "taf_sur_apporteur": false,
  "apporteur_par_titre": 100, "apporteur_actif": true,
  "brvm_dcbr_pct": 0.11742, "brvm_dcbr_base": "nominal", "brvm_dcbr_actif": true,
  "delai_reglement_jours": 2, "base_coupon": "act_act",
  "masquer": []
}'::jsonb) on conflict (cle) do nothing;

-- Dates de séance présentes en base sur une période (une ligne par séance),
-- pour le contrôle des jours ouvrés sans cotation sans rapatrier tout
-- l'historique ligne à ligne.
create or replace function public.seances_dates(debut date, fin date)
returns table (date_seance date, nb_valeurs integer)
language sql stable security invoker set search_path = public as $$
  select h.date_seance, count(*)::int from public.historique h
  where h.date_seance >= debut and h.date_seance < fin
  group by h.date_seance order by h.date_seance
$$;
revoke execute on function public.seances_dates(date, date) from public;
grant execute on function public.seances_dates(date, date) to anon, authenticated;
