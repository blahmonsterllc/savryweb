-- Savry+ founding membership. Billing providers write this table only through
-- trusted server-side webhook handlers; clients can read their own membership.
create type public.membership_provider as enum ('app_store', 'stripe');
create type public.membership_status as enum ('trialing', 'active', 'past_due', 'paused', 'canceled', 'expired');

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  plan_key text not null default 'savry_plus_founding_annual'
    check (plan_key in ('savry_plus_founding_annual')),
  provider public.membership_provider not null,
  provider_customer_id text,
  provider_subscription_id text not null unique,
  provider_product_id text not null,
  status public.membership_status not null,
  price_cents integer not null default 2999 check (price_cents >= 0),
  currency text not null default 'usd' check (char_length(currency) = 3),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index memberships_provider_customer_idx on public.memberships (provider, provider_customer_id);
create index memberships_status_period_idx on public.memberships (status, current_period_end);

create trigger memberships_touch before update on public.memberships
for each row execute function public.touch_updated_at();

create or replace function public.sync_membership_tier() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    update public.profiles set tier = 'free' where id = old.user_id and tier = 'plus';
    return old;
  end if;

  update public.profiles
  set tier = case
    when new.status in ('trialing', 'active')
      and (new.current_period_end is null or new.current_period_end > now()) then 'plus'
    else 'free'
  end
  where id = new.user_id and tier <> 'pro';
  return new;
end; $$;

create trigger membership_sync_profile
after insert or update of status, current_period_end or delete on public.memberships
for each row execute function public.sync_membership_tier();

alter table public.memberships enable row level security;
create policy "members read own membership" on public.memberships
for select to authenticated using (user_id = (select auth.uid()));

grant select on public.memberships to authenticated;
revoke insert, update, delete on public.memberships from anon, authenticated;

comment on table public.memberships is
  'Server-managed Savry+ entitlement state synchronized from Stripe or the App Store.';
comment on column public.memberships.price_cents is
  'Price snapshot at purchase time; founding annual membership launches at USD 29.99.';
