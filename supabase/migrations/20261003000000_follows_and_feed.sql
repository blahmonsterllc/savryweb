-- Following cooks, and the home feed built from it. First piece of making
-- Savry a community rather than a catalogue.
--
-- Follows were a table nobody used. They are now written only through
-- toggle_follow (so the counts on profiles stay right and blocked or banned
-- cooks can't be followed), and read through follow_state, my_following,
-- suggested_cooks, and home_feed. The feed is a time-ordered mix of three
-- kinds of event from the cooks you follow (or everyone): a recipe joining
-- the table, a cook making a recipe, and a suggested tweak being accepted.

alter table public.profiles
  add column if not exists follower_count integer not null default 0 check (follower_count >= 0),
  add column if not exists following_count integer not null default 0 check (following_count >= 0);
grant select (follower_count, following_count) on public.profiles to anon, authenticated;

create index if not exists profile_follows_followed_idx on public.profile_follows (followed_id, created_at desc);

-- Backfill for any follows that already exist.
update public.profiles p set follower_count = (select count(*) from public.profile_follows f where f.followed_id = p.id),
                             following_count = (select count(*) from public.profile_follows f where f.follower_id = p.id);

-- Counts are kept by the server, so clients may no longer write follows directly.
revoke insert, update, delete on public.profile_follows from anon, authenticated;
drop policy if exists "members manage follows" on public.profile_follows;
drop policy if exists "members read their own follows" on public.profile_follows;
create policy "members read their own follows" on public.profile_follows
  for select to authenticated using (follower_id = (select auth.uid()) or followed_id = (select auth.uid()));

-- Blocking someone ends any follow between the two, both ways.
create or replace function public.drop_follows_on_block() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.profile_follows
  where (follower_id = new.blocker_id and followed_id = new.blocked_id)
     or (follower_id = new.blocked_id and followed_id = new.blocker_id);
  update public.profiles p
  set follower_count = (select count(*) from public.profile_follows f where f.followed_id = p.id),
      following_count = (select count(*) from public.profile_follows f where f.follower_id = p.id)
  where p.id in (new.blocker_id, new.blocked_id);
  return new;
end $$;
drop trigger if exists user_blocks_drop_follows on public.user_blocks;
create trigger user_blocks_drop_follows after insert on public.user_blocks
for each row execute function public.drop_follows_on_block();

-- Who a cook is, for feeds and lists.
create or replace function public.cook_card(p public.profiles) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'username', p.username::text, 'displayName', p.display_name, 'chefTitle', p.chef_title,
    'avatarUrl', case when p.avatar_path is null then null else public.setting('storage_public_base') || '/' || p.avatar_path end,
    'followerCount', p.follower_count, 'recipeCount', (select count(*) from public.recipes r where r.author_id = p.id and r.visibility = 'public')
  )
$$;

create or replace function public.toggle_follow(target_username text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target public.profiles%rowtype;
  now_following boolean;
begin
  perform public.assert_can_write(actor);
  select * into target from public.profiles where username = public.normalize_username(target_username);
  if target.id is null or target.is_banned then raise exception 'That cook is not on Savry'; end if;
  if target.id = actor then raise exception 'You are already you'; end if;

  if exists (select 1 from public.profile_follows f where f.follower_id = actor and f.followed_id = target.id) then
    -- Unfollowing is always allowed.
    delete from public.profile_follows where follower_id = actor and followed_id = target.id;
    now_following := false;
  else
    if exists (select 1 from public.user_blocks b where (b.blocker_id = actor and b.blocked_id = target.id) or (b.blocker_id = target.id and b.blocked_id = actor)) then
      raise exception 'You can''t follow this cook';
    end if;
    insert into public.profile_follows (follower_id, followed_id) values (actor, target.id);
    now_following := true;
  end if;

  update public.profiles set follower_count = (select count(*) from public.profile_follows f where f.followed_id = target.id) where id = target.id;
  update public.profiles set following_count = (select count(*) from public.profile_follows f where f.follower_id = actor) where id = actor;
  return jsonb_build_object('following', now_following, 'followerCount', (select follower_count from public.profiles where id = target.id));
end $$;

create or replace function public.follow_state(target_username text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'following', exists (select 1 from public.profile_follows f where f.follower_id = auth.uid() and f.followed_id = p.id),
    'followerCount', p.follower_count, 'followingCount', p.following_count,
    'isSelf', p.id = auth.uid()
  )
  from public.profiles p where p.username = public.normalize_username(target_username) and not p.is_banned
$$;

create or replace function public.my_following(result_limit integer default 100) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('cooks', coalesce(jsonb_agg(public.cook_card(x.p) order by x.followed_at desc), '[]'::jsonb))
  from (
    select p, f.created_at as followed_at
    from public.profile_follows f join public.profiles p on p.id = f.followed_id
    where f.follower_id = auth.uid() and not p.is_banned
    order by f.created_at desc
    limit greatest(1, least(coalesce(result_limit, 100), 500))
  ) x
$$;

-- Cooks worth following: featured first (Savry Kitchen), then by how much they
-- have on the table. Never yourself, anyone you follow, or anyone blocked.
create or replace function public.suggested_cooks(result_limit integer default 8) returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as id)
  select jsonb_build_object('cooks', coalesce(jsonb_agg(public.cook_card(x.p) order by x.is_featured desc, x.featured_rank nulls last, x.recipe_count desc, x.made_count desc), '[]'::jsonb))
  from (
    select p, p.is_featured, p.featured_rank,
      (select count(*) from public.recipes r where r.author_id = p.id and r.visibility = 'public') as recipe_count,
      (select coalesce(sum(r.made_count), 0) from public.recipes r where r.author_id = p.id and r.visibility = 'public') as made_count
    from public.profiles p
    where not p.is_banned and p.username is not null
      and p.id is distinct from (select id from me)
      and not exists (select 1 from public.profile_follows f where f.follower_id = (select id from me) and f.followed_id = p.id)
      and not exists (select 1 from public.user_blocks b where (b.blocker_id = (select id from me) and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = (select id from me)))
      and exists (select 1 from public.recipes r where r.author_id = p.id and r.visibility = 'public')
    order by p.is_featured desc, p.featured_rank nulls last, recipe_count desc, made_count desc
    limit greatest(1, least(coalesce(result_limit, 8), 50))
  ) x
$$;

-- The feed. scope 'following' (default when signed in) or 'everyone'.
create or replace function public.home_feed(scope text default 'following', result_limit integer default 20, result_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  use_following boolean := viewer is not null and coalesce(scope, 'following') <> 'everyone';
  page_size integer := greatest(1, least(coalesce(result_limit, 20), 50));
  page_offset integer := greatest(0, coalesce(result_offset, 0));
  following_count integer := 0;
  items jsonb;
begin
  if viewer is not null then
    select count(*) into following_count from public.profile_follows f where f.follower_id = viewer;
  end if;

  with events as (
    -- A recipe joining the table.
    select r.published_at as at, 'recipe'::text as kind, r.author_id as cook_id, r.id as recipe_id, null::uuid as contribution_id
    from public.recipes r
    where r.visibility = 'public' and r.published_at is not null
    union all
    -- A cook made a recipe (with a photo or a note; silent made-its stay on the recipe page).
    select c.created_at, 'made', c.user_id, c.recipe_id, c.id
    from public.contributions c
    join public.recipes r on r.id = c.recipe_id and r.visibility = 'public'
    where c.type = 'made' and not c.hidden and (c.photo_path is not null or nullif(btrim(coalesce(c.text, '')), '') is not null)
    union all
    -- A suggested tweak the author accepted.
    select c.updated_at, 'tweak', c.user_id, c.recipe_id, c.id
    from public.contributions c
    join public.recipes r on r.id = c.recipe_id and r.visibility = 'public'
    where c.type = 'tweak' and c.status = 'accepted' and not c.hidden
  ), page as (
    select e.* from events e
    join public.profiles p on p.id = e.cook_id
    where not p.is_banned
      and (not use_following or e.cook_id = viewer or exists (select 1 from public.profile_follows f where f.follower_id = viewer and f.followed_id = e.cook_id))
      and (viewer is null or not exists (select 1 from public.user_blocks b where b.blocker_id = viewer and b.blocked_id = e.cook_id))
    order by e.at desc
    limit page_size offset page_offset
  )
  -- Cards are built only for the page being shown.
  select coalesce(jsonb_agg(
    jsonb_build_object('kind', x.kind, 'at', x.at, 'cook', public.cook_card(p))
    || case when x.kind = 'recipe' then jsonb_build_object('recipe', public.recipe_card(r, viewer))
       else jsonb_build_object(
         'note', c.text, 'version', c.accepted_in_version,
         'photoUrl', case when c.photo_path is null then null else public.setting('storage_public_base') || '/' || c.photo_path end,
         'recipe', jsonb_build_object('slug', r.slug::text, 'title', r.title, 'imageUrl', r.image_url, 'authorName', a.display_name, 'authorUsername', a.username::text))
       end
    order by x.at desc), '[]'::jsonb)
  into items
  from page x
  join public.profiles p on p.id = x.cook_id
  join public.recipes r on r.id = x.recipe_id
  join public.profiles a on a.id = r.author_id
  left join public.contributions c on c.id = x.contribution_id;

  return jsonb_build_object('scope', case when use_following then 'following' else 'everyone' end, 'following', following_count, 'items', items);
end $$;

revoke all on function public.cook_card(public.profiles) from public, anon, authenticated;
revoke all on function public.toggle_follow(text) from public, anon;
revoke all on function public.follow_state(text) from public;
revoke all on function public.my_following(integer) from public, anon;
revoke all on function public.suggested_cooks(integer) from public;
revoke all on function public.home_feed(text, integer, integer) from public;
grant execute on function public.cook_card(public.profiles) to service_role;
grant execute on function public.toggle_follow(text) to authenticated;
grant execute on function public.follow_state(text) to anon, authenticated, service_role;
grant execute on function public.my_following(integer) to authenticated, service_role;
grant execute on function public.suggested_cooks(integer) to anon, authenticated, service_role;
grant execute on function public.home_feed(text, integer, integer) to anon, authenticated, service_role;
