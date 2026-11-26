-- Admin sign-in security: two-factor for every admin, and an admin activity log.
--
-- Supabase marks a session "aal2" in its signed JWT once the member has also
-- entered a code from an authenticator app. PostgREST verifies that JWT before
-- any of these functions run, so auth.jwt() can be trusted here.

-- ---------------------------------------------------------------------------
-- Two-factor
-- ---------------------------------------------------------------------------

-- An admin counts as an admin only in a two-factor session. The site's
-- middleware asks this with the member's own session.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
     and exists (
       select 1
         from public.admin_users a
         join public.profiles p on p.id = a.user_id
        where a.user_id = (select auth.uid())
          and not p.is_banned
     )
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- True when the caller is on the admin list but this session has not had the
-- second factor yet: the middleware sends them to /admin/two-factor instead
-- of turning them away. Answers only about the caller.
create or replace function public.needs_admin_second_factor() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2'
     and exists (
       select 1
         from public.admin_users a
         join public.profiles p on p.id = a.user_id
        where a.user_id = (select auth.uid())
          and not p.is_banned
     )
$$;
revoke all on function public.needs_admin_second_factor() from public, anon;
grant execute on function public.needs_admin_second_factor() to authenticated, service_role;

-- How many admins have an authenticator app set up, for /admin/security.
create or replace function public.admin_two_factor_coverage() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'admins', (select count(*) from public.admin_users),
    'withTwoFactor', (
      select count(*) from public.admin_users a
       where exists (select 1 from auth.mfa_factors f where f.user_id = a.user_id and f.status = 'verified')
    )
  )
$$;
revoke all on function public.admin_two_factor_coverage() from public, anon, authenticated;
grant execute on function public.admin_two_factor_coverage() to service_role;

-- ---------------------------------------------------------------------------
-- Admin activity log
-- ---------------------------------------------------------------------------
-- Every admin sign-in, every change an admin makes, every member search, and
-- every time a signed-in member who is not an admin tries to open the admin
-- area. Append-only: nothing on the site can change or delete a row, and the
-- trigger below refuses updates and deletes from anyone.
--
-- actor_id has no foreign key on purpose: the entry outlives the account.

create table if not exists public.admin_activity (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor_id uuid,
  action text not null check (char_length(action) <= 60 and action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  target_type text check (char_length(target_type) <= 40),
  target_id text check (char_length(target_id) <= 200),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 4096),
  session_id uuid,
  ip text check (char_length(ip) <= 64),
  user_agent text check (char_length(user_agent) <= 300)
);

create index if not exists admin_activity_at_idx on public.admin_activity (at desc);
create index if not exists admin_activity_actor_idx on public.admin_activity (actor_id, at desc);
-- One sign-in entry per admin session.
create unique index if not exists admin_activity_one_sign_in_per_session
  on public.admin_activity (session_id) where action = 'admin.signed_in';

-- No policies: no browser session can read or write the log. The server reads
-- it with the service role; rows are added only through the functions below.
alter table public.admin_activity enable row level security;
revoke all on public.admin_activity from public, anon, authenticated, service_role;
grant select on public.admin_activity to service_role;

create or replace function public.guard_admin_activity_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'The admin activity log is append-only';
end $$;
revoke all on function public.guard_admin_activity_append_only() from public, anon, authenticated;

drop trigger if exists admin_activity_append_only on public.admin_activity;
create trigger admin_activity_append_only
  before update or delete on public.admin_activity
  for each row execute function public.guard_admin_activity_append_only();

drop trigger if exists admin_activity_no_truncate on public.admin_activity;
create trigger admin_activity_no_truncate
  before truncate on public.admin_activity
  for each statement execute function public.guard_admin_activity_append_only();

-- One change made by an admin. The server calls this (service role) after an
-- /api/admin call succeeds, with the admin's verified user id.
create or replace function public.admin_log_action(
  p_actor uuid,
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_detail jsonb default '{}'::jsonb,
  p_ip text default null,
  p_user_agent text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_actor is null or not public.admin_is_admin(p_actor) then
    raise exception 'Only admin actions are logged here';
  end if;
  insert into public.admin_activity (actor_id, action, target_type, target_id, detail, ip, user_agent)
  values (p_actor, p_action, left(p_target_type, 40), left(p_target_id, 200), coalesce(p_detail, '{}'::jsonb), left(p_ip, 64), left(p_user_agent, 300));
end $$;
revoke all on function public.admin_log_action(uuid, text, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.admin_log_action(uuid, text, text, text, jsonb, text, text) to service_role;

-- An admin's two-factor session reached the admin area: logged once per
-- session, with who, how they signed in, and from where. Called with the
-- admin's own session, so who it is comes from the verified JWT, never from
-- the caller.
create or replace function public.note_admin_session(p_ip text default null, p_user_agent text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  claims jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  sid uuid;
begin
  if not public.is_admin() then return; end if;
  begin
    sid := nullif(claims ->> 'session_id', '')::uuid;
  exception when others then
    sid := null;
  end;
  if sid is null then return; end if;
  insert into public.admin_activity (actor_id, action, session_id, detail, ip, user_agent)
  values (
    (select auth.uid()),
    'admin.signed_in',
    sid,
    jsonb_build_object('methods', coalesce((
      select jsonb_agg(m ->> 'method')
        from jsonb_array_elements(case when jsonb_typeof(claims -> 'amr') = 'array' then claims -> 'amr' else '[]'::jsonb end) m
    ), '[]'::jsonb)),
    left(p_ip, 64),
    left(p_user_agent, 300)
  )
  on conflict (session_id) where action = 'admin.signed_in' do nothing;
end $$;
revoke all on function public.note_admin_session(text, text) from public, anon;
grant execute on function public.note_admin_session(text, text) to authenticated;

-- A signed-in member who is not an admin tried to open the admin area. At most
-- one entry per account every ten minutes, so it cannot be used to flood the log.
create or replace function public.note_admin_denied(p_path text, p_ip text default null, p_user_agent text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or public.is_admin() or public.needs_admin_second_factor() then return; end if;
  if exists (
    select 1 from public.admin_activity
     where actor_id = actor and action = 'admin.denied' and at > now() - interval '10 minutes'
  ) then
    return;
  end if;
  insert into public.admin_activity (actor_id, action, detail, ip, user_agent)
  values (actor, 'admin.denied', jsonb_build_object('path', left(coalesce(p_path, ''), 200)), left(p_ip, 64), left(p_user_agent, 300));
end $$;
revoke all on function public.note_admin_denied(text, text, text) from public, anon;
grant execute on function public.note_admin_denied(text, text, text) to authenticated;

-- The log for /admin/activity, newest first, a page at a time.
create or replace function public.admin_activity_log(page_limit integer default 100, before_at timestamptz default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(row_to_json(e) order by e.at desc), '[]'::jsonb)
  from (
    select a.id, a.at, a.action, a.target_type as "targetType", a.target_id as "targetId", a.detail,
           a.ip, a.user_agent as "userAgent", a.actor_id as "actorId",
           u.email as "actorEmail", p.display_name as "actorName",
           exists (select 1 from public.admin_users au where au.user_id = a.actor_id) as "actorIsAdmin"
      from public.admin_activity a
      left join auth.users u on u.id = a.actor_id
      left join public.profiles p on p.id = a.actor_id
     where before_at is null or a.at < before_at
     order by a.at desc
     limit least(greatest(coalesce(page_limit, 100), 1), 500)
  ) e
$$;
revoke all on function public.admin_activity_log(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_activity_log(integer, timestamptz) to service_role;

-- Counts for the admin overview.
create or replace function public.admin_activity_summary() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'signInsLast7Days', (select count(*) from public.admin_activity where action = 'admin.signed_in' and at > now() - interval '7 days'),
    'actionsLast7Days', (select count(*) from public.admin_activity where action not in ('admin.signed_in', 'admin.denied') and at > now() - interval '7 days'),
    'deniedLast7Days', (select count(*) from public.admin_activity where action = 'admin.denied' and at > now() - interval '7 days'),
    'lastSignInAt', (select max(at) from public.admin_activity where action = 'admin.signed_in')
  )
$$;
revoke all on function public.admin_activity_summary() from public, anon, authenticated;
grant execute on function public.admin_activity_summary() to service_role;
