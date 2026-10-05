-- Kroger budget, second pass after testing the first in production:
-- * The first function's parameter `kind` shared a name with the table's
--   column, so the upsert was ambiguous and every draw was refused. The new
--   function's parameters are prefixed.
-- * The per-caller limit moves here from server memory, where each Vercel
--   instance counted on its own. Callers are a SHA-256 of their IP address
--   (never the address) and are counted in Kroger calls per hour. Rows older
--   than a day are pruned as the function runs.

drop function if exists public.take_kroger_budget(text, integer, integer);

create table if not exists public.kroger_caller_usage (
  caller text not null check (caller ~ '^[0-9a-f]{64}$'),
  hour timestamptz not null,
  used integer not null default 0 check (used >= 0),
  primary key (caller, hour)
);
alter table public.kroger_caller_usage enable row level security;
revoke all on public.kroger_caller_usage from public, anon, authenticated;

-- Grants `p_calls` Kroger calls of `p_kind` when today's total stays within
-- `p_daily_cap` and this caller's hour stays within `p_caller_cap`.
create or replace function public.take_kroger_calls(p_kind text, p_calls integer, p_daily_cap integer, p_caller text, p_caller_cap integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  this_hour timestamptz := date_trunc('hour', now());
  today date := (now() at time zone 'utc')::date;
  caller_used integer;
  granted boolean;
begin
  if p_calls is null or p_calls < 1 or p_daily_cap is null or p_calls > p_daily_cap or p_caller_cap is null or p_calls > p_caller_cap
     or p_kind not in ('locations', 'products') or p_caller !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  -- The caller's hour first: one caller cannot spend the day's budget.
  insert into public.kroger_caller_usage as u (caller, hour, used)
  values (p_caller, this_hour, p_calls)
  on conflict (caller, hour) do update set used = u.used + excluded.used
    where u.used + excluded.used <= p_caller_cap
  returning u.used into caller_used;
  if caller_used is null then return false; end if;

  insert into public.kroger_call_budget as b (day, kind, used)
  values (today, p_kind, p_calls)
  on conflict (day, kind) do update set used = b.used + excluded.used
    where b.used + excluded.used <= p_daily_cap
  returning true into granted;

  if granted is null then
    -- Over the daily budget: give the caller's calls back.
    update public.kroger_caller_usage set used = greatest(used - p_calls, 0) where caller = p_caller and hour = this_hour;
    return false;
  end if;

  if random() < 0.02 then delete from public.kroger_caller_usage where hour < now() - interval '1 day'; end if;
  return true;
end;
$$;
revoke all on function public.take_kroger_calls(text, integer, integer, text, integer) from public, anon, authenticated;
grant execute on function public.take_kroger_calls(text, integer, integer, text, integer) to service_role;
