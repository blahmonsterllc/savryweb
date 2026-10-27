-- Kitchen scans read by Claude (Savry+). Each request is counted before the
-- model is called, by the number of photos in it, and a member can send up
-- to 20 photos in any 24 hours: a guard against abuse, far above a weekly
-- scan of the fridge, pantry and spice rack. Service role only.

create table if not exists public.ai_pantry_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  photos integer not null check (photos between 1 and 3),
  created_at timestamptz not null default now()
);
create index if not exists ai_pantry_usage_user_time on public.ai_pantry_usage (user_id, created_at desc);

alter table public.ai_pantry_usage enable row level security;
revoke all on public.ai_pantry_usage from public, anon, authenticated;

create or replace function public.take_ai_pantry(p_user uuid, p_photos integer)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  daily_photos constant int := 20;
  used int;
begin
  if p_photos is null or p_photos < 1 or p_photos > 3 then raise exception 'Bad photo count'; end if;
  perform pg_advisory_xact_lock(hashtext('ai_pantry:' || p_user::text));
  select coalesce(sum(photos), 0) into used from public.ai_pantry_usage
   where user_id = p_user and created_at > now() - interval '1 day';
  if used + p_photos > daily_photos then
    return jsonb_build_object('allowed', false, 'remaining', greatest(0, daily_photos - used));
  end if;
  insert into public.ai_pantry_usage (user_id, photos) values (p_user, p_photos);
  return jsonb_build_object('allowed', true, 'remaining', daily_photos - used - p_photos);
end $$;

-- A scan the model then fails to read gives its photos back.
create or replace function public.return_ai_pantry(p_user uuid)
returns void
language sql security definer set search_path = '' as $$
  delete from public.ai_pantry_usage
   where id = (select id from public.ai_pantry_usage where user_id = p_user order by created_at desc limit 1)
$$;

revoke all on function public.take_ai_pantry(uuid, integer) from public, anon, authenticated;
revoke all on function public.return_ai_pantry(uuid) from public, anon, authenticated;
grant execute on function public.take_ai_pantry(uuid, integer) to service_role;
grant execute on function public.return_ai_pantry(uuid) to service_role;
