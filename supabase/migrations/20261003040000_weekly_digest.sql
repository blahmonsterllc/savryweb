-- The weekly email: what the cooks you follow made and shared this week,
-- what the table is cooking, and how your own recipes did. Only for cooks
-- who opted in (profiles.email_opt_in) with a confirmed address. The server
-- (service role) reads recipients and content here and sends through Resend;
-- nothing in this file is callable by members.

-- A per-cook secret for one-click unsubscribe links. Rotated on use.
alter table public.profiles
  add column if not exists email_token uuid not null default gen_random_uuid();
create unique index if not exists profiles_email_token_idx on public.profiles (email_token);

create table if not exists public.digest_sends (
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  sent_at timestamptz not null default now(),
  status text not null default 'sent' check (status in ('sent', 'skipped', 'failed')),
  primary key (user_id, week_start)
);
alter table public.digest_sends enable row level security;
revoke all on public.digest_sends from public, anon, authenticated;
grant select, insert, update, delete on public.digest_sends to service_role;

-- Who gets this week's email and has not had it yet.
create or replace function public.digest_recipients(week_start date, batch_size integer default 100) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', p.id, 'email', u.email, 'displayName', p.display_name, 'username', p.username::text, 'emailToken', p.email_token
  )), '[]'::jsonb)
  from (
    select p.* from public.profiles p
    join auth.users u on u.id = p.id
    where p.email_opt_in and not p.is_banned and u.email_confirmed_at is not null and u.email is not null
      and not exists (select 1 from public.digest_sends s where s.user_id = p.id and s.week_start = digest_recipients.week_start)
    order by p.created_at
    limit greatest(1, least(coalesce(batch_size, 100), 500))
  ) p
  join auth.users u on u.id = p.id
$$;

-- Everything one cook's email says. Empty sections are empty arrays.
create or replace function public.weekly_digest(target uuid, since timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  cook public.profiles%rowtype;
  from_followed jsonb;
  made_by_followed jsonb;
  trending jsonb;
  your_week jsonb;
begin
  select * into cook from public.profiles where id = target;
  if cook.id is null then return null; end if;

  -- New recipes from cooks you follow.
  select coalesce(jsonb_agg(public.recipe_card(r, target) order by r.published_at desc), '[]'::jsonb) into from_followed
  from (
    select r.* from public.recipes r
    join public.profile_follows f on f.followed_id = r.author_id and f.follower_id = target
    join public.profiles a on a.id = r.author_id and not a.is_banned
    where r.visibility = 'public' and r.published_at >= since
      and not exists (select 1 from public.user_blocks b where b.blocker_id = target and b.blocked_id = r.author_id)
    order by r.published_at desc limit 6
  ) r;

  -- What they made, with photos.
  select coalesce(jsonb_agg(jsonb_build_object(
    'cook', public.cook_card(p), 'note', c.text,
    'photoUrl', public.setting('storage_public_base') || '/' || c.photo_path,
    'recipe', jsonb_build_object('slug', r.slug::text, 'title', r.title)
  ) order by c.created_at desc), '[]'::jsonb) into made_by_followed
  from (
    select c.* from public.contributions c
    join public.profile_follows f on f.followed_id = c.user_id and f.follower_id = target
    join public.recipes r on r.id = c.recipe_id and r.visibility = 'public'
    where c.type = 'made' and not c.hidden and c.photo_path is not null and c.created_at >= since
      and not exists (select 1 from public.user_blocks b where b.blocker_id = target and b.blocked_id = c.user_id)
    order by c.created_at desc limit 4
  ) c
  join public.profiles p on p.id = c.user_id and not p.is_banned
  join public.recipes r on r.id = c.recipe_id;

  -- The table this week: most made and saved public recipes, not already above.
  select coalesce(jsonb_agg(public.recipe_card(r, target) order by t.score desc, r.published_at desc), '[]'::jsonb) into trending
  from (
    select r.id,
      (select count(*) from public.contributions c where c.recipe_id = r.id and c.type = 'made' and not c.hidden and c.created_at >= since) * 3
      + (select count(*) from public.recipe_saves s where s.recipe_id = r.id and s.created_at >= since) as score
    from public.recipes r
    join public.profiles a on a.id = r.author_id and not a.is_banned
    where r.visibility = 'public'
      and not exists (select 1 from jsonb_array_elements(from_followed) e where (e ->> 'id')::uuid = r.id)
      and not exists (select 1 from public.user_blocks b where b.blocker_id = target and b.blocked_id = r.author_id)
  ) t
  join public.recipes r on r.id = t.id
  where t.score > 0
  limit 3;

  -- How your own recipes did.
  select jsonb_build_object(
    'madeOfYours', (select count(*) from public.contributions c join public.recipes r on r.id = c.recipe_id where r.author_id = target and c.type = 'made' and not c.hidden and c.user_id <> target and c.created_at >= since),
    'notesOnYours', (select count(*) from public.notifications n where n.user_id = target and n.kind in ('note', 'reply', 'tweak') and n.created_at >= since),
    'newFollowers', (select count(*) from public.profile_follows f where f.followed_id = target and f.created_at >= since),
    'recipeCount', (select count(*) from public.recipes r where r.author_id = target and r.visibility = 'public')
  ) into your_week;

  return jsonb_build_object(
    'cook', public.cook_card(cook),
    'followingCount', cook.following_count,
    'fromFollowed', from_followed,
    'madeByFollowed', made_by_followed,
    'trending', trending,
    'yourWeek', your_week
  );
end $$;

create or replace function public.record_digest_send(target uuid, week_start date, send_status text) returns void
language sql security definer set search_path = '' as $$
  insert into public.digest_sends (user_id, week_start, status) values (target, week_start, send_status)
  on conflict (user_id, week_start) do update set status = excluded.status, sent_at = now()
$$;

-- One click from the email. Turns the mail off and burns the link.
create or replace function public.unsubscribe_by_token(token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  cook public.profiles%rowtype;
begin
  update public.profiles set email_opt_in = false, email_token = gen_random_uuid(), updated_at = now()
  where email_token = token
  returning * into cook;
  if cook.id is null then return jsonb_build_object('found', false); end if;
  return jsonb_build_object('found', true, 'displayName', cook.display_name);
end $$;

revoke all on function public.digest_recipients(date, integer) from public, anon, authenticated;
revoke all on function public.weekly_digest(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.record_digest_send(uuid, date, text) from public, anon, authenticated;
revoke all on function public.unsubscribe_by_token(uuid) from public, anon, authenticated;
grant execute on function public.digest_recipients(date, integer) to service_role;
grant execute on function public.weekly_digest(uuid, timestamptz) to service_role;
grant execute on function public.record_digest_send(uuid, date, text) to service_role;
grant execute on function public.unsubscribe_by_token(uuid) to service_role;
