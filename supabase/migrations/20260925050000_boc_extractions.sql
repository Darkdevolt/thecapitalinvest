-- Journal de la lecture automatique des BOC (GitHub Actions -> /api/process-brvm
-- scope boc_extract). Une ligne par séance : ce qui a été repéré, ajouté,
-- confirmé ou signalé, et le message Telegram envoyé. Écrit uniquement par
-- l'API (clé de service) ; lisible par les administrateurs.
create table if not exists public.boc_extractions (
  date_seance date primary key,
  status text not null default 'done' check (status in ('done', 'error')),
  attempts integer not null default 1,
  pages_total integer,
  pages_scanned integer,
  candidates integer,
  inserted integer,
  promoted integer,
  result jsonb,
  message text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.boc_extractions enable row level security;

drop policy if exists boc_extractions_admin_read on public.boc_extractions;
create policy boc_extractions_admin_read on public.boc_extractions
  for select to authenticated
  using ((select public.is_admin()));
