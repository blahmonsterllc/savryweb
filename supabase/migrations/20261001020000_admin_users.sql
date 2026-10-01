-- Admin access rides on a member's own Savry sign-in (Apple or email) instead
-- of a separate Google login. Admins are listed here by user id; rows are
-- added by hand with the service role and never from the site.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  added_at timestamptz not null default now()
);

-- No policies: clients can neither read nor write the list.
alter table public.admin_users enable row level security;
revoke all on public.admin_users from public, anon, authenticated;
grant select, insert, delete on public.admin_users to service_role;

-- True only for the signed-in caller, and never for a banned account. The
-- site's middleware asks this with the member's own session.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.admin_users a
      join public.profiles p on p.id = a.user_id
     where a.user_id = (select auth.uid())
       and not p.is_banned
  )
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- The same answer for a given user, for server code holding the service role.
create or replace function public.admin_is_admin(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.admin_users a
      join public.profiles p on p.id = a.user_id
     where a.user_id = target
       and not p.is_banned
  )
$$;
revoke all on function public.admin_is_admin(uuid) from public, anon, authenticated;
grant execute on function public.admin_is_admin(uuid) to service_role;
