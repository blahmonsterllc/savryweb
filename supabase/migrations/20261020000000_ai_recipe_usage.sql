-- Recipe help from Savry's server (for iPhones without Apple Intelligence).
-- Each request is counted against the member's allowance before the model is
-- called: free accounts get their first 10, then 4 each calendar month (UTC);
-- Savry+ members get up to 30 a day, a guard against abuse rather than a
-- limit anyone cooking will reach. Service role only.

create table if not exists public.ai_recipe_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  savry_plus boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ai_recipe_usage_user_time on public.ai_recipe_usage (user_id, created_at desc);

alter table public.ai_recipe_usage enable row level security;
revoke all on public.ai_recipe_usage from public, anon, authenticated;

-- Records one use and returns whether it was allowed, with what is left.
create or replace function public.take_ai_recipe(p_user uuid, p_savry_plus boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  free_starter constant int := 10;
  free_monthly constant int := 4;
  plus_daily constant int := 30;
  total_free int;
  this_month_free int;
  today int;
begin
  -- One caller at a time per member, so two quick taps can't both slip under the limit.
  perform pg_advisory_xact_lock(hashtext('ai_recipe:' || p_user::text));

  if p_savry_plus then
    select count(*) into today from public.ai_recipe_usage
     where user_id = p_user and savry_plus and created_at > now() - interval '1 day';
    if today >= plus_daily then
      return jsonb_build_object('allowed', false, 'reason', 'daily_limit', 'remaining', 0);
    end if;
    insert into public.ai_recipe_usage (user_id, savry_plus) values (p_user, true);
    return jsonb_build_object('allowed', true, 'remaining', plus_daily - today - 1);
  end if;

  select count(*) into total_free from public.ai_recipe_usage where user_id = p_user and not savry_plus;
  if total_free < free_starter then
    insert into public.ai_recipe_usage (user_id, savry_plus) values (p_user, false);
    return jsonb_build_object('allowed', true, 'remaining', free_starter - total_free - 1, 'starter', true);
  end if;

  select count(*) into this_month_free from public.ai_recipe_usage
   where user_id = p_user and not savry_plus
     and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  -- The starter recipes made this month don't count against the monthly four.
  this_month_free := this_month_free - greatest(0, free_starter - (total_free - this_month_free));
  if this_month_free >= free_monthly then
    return jsonb_build_object('allowed', false, 'reason', 'monthly_limit', 'remaining', 0);
  end if;
  insert into public.ai_recipe_usage (user_id, savry_plus) values (p_user, false);
  return jsonb_build_object('allowed', true, 'remaining', free_monthly - this_month_free - 1);
end $$;

-- A request the model then fails to answer gives the use back.
create or replace function public.return_ai_recipe(p_user uuid)
returns void
language sql security definer set search_path = '' as $$
  delete from public.ai_recipe_usage
   where id = (select id from public.ai_recipe_usage where user_id = p_user order by created_at desc limit 1)
$$;

revoke all on function public.take_ai_recipe(uuid, boolean) from public, anon, authenticated;
revoke all on function public.return_ai_recipe(uuid) from public, anon, authenticated;
grant execute on function public.take_ai_recipe(uuid, boolean) to service_role;
grant execute on function public.return_ai_recipe(uuid) to service_role;
