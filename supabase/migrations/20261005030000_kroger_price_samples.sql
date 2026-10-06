-- Kroger-family shelf prices sampled across regions, used as a gauge for
-- Savry's national price table rather than as anyone's own store price.
-- Written only by /api/cron/kroger-sample (service role); read only in
-- aggregate by /api/prices/observations. No client may touch the rows.

create table if not exists public.kroger_price_samples (
  id bigserial primary key,
  sampled_on date not null default ((now() at time zone 'utc')::date),
  zip text not null check (zip ~ '^[0-9]{5}$'),
  state text not null check (state ~ '^[A-Z]{2}$'),
  location_id text not null,
  fdc_id integer not null,
  per_kg numeric(10, 2) not null check (per_kg > 0 and per_kg <= 500),
  -- The shelf price divided by the state's price level: what it would cost at the US average.
  national_per_kg numeric(10, 2) not null check (national_per_kg > 0 and national_per_kg <= 500),
  store_brand boolean not null,
  listings integer not null check (listings > 0),
  unique (sampled_on, location_id, fdc_id)
);
create index if not exists kroger_price_samples_food_idx on public.kroger_price_samples (fdc_id, sampled_on desc);
alter table public.kroger_price_samples enable row level security;
revoke all on public.kroger_price_samples from public, anon, authenticated;
revoke all on sequence public.kroger_price_samples_id_seq from public, anon, authenticated;
