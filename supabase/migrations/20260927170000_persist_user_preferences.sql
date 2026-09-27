-- Persist member preferences per user.
alter table public.user_preferences
  add column if not exists theme text not null default 'dark',
  add column if not exists currency text not null default 'XOF',
  add column if not exists market_notifications boolean not null default true,
  add column if not exists portfolio_notifications boolean not null default true;

alter table public.user_preferences drop constraint if exists user_preferences_theme_check;
alter table public.user_preferences add constraint user_preferences_theme_check check (theme in ('dark','light'));
alter table public.user_preferences drop constraint if exists user_preferences_currency_check;
alter table public.user_preferences add constraint user_preferences_currency_check check (currency in ('XOF','EUR','USD'));
