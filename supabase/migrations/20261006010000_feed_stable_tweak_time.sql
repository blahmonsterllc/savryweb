-- The feed dated accepted tweaks by contributions.updated_at, which moves
-- every time the tweak is liked, replied to, or credited in a Made It, so old
-- tweaks kept jumping back to the top. They are now dated by when they were
-- accepted (the recipe version saved at that moment), falling back to when
-- they were suggested. Otherwise home_feed is unchanged.

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
    -- A suggested tweak the author accepted, dated when it was accepted: the
    -- version it went into was saved then. A tweak accepted without changes
    -- has no version and keeps the day it was suggested. Never updated_at,
    -- which every like, reply and Made It credit moves.
    select coalesce((select min(v.created_at) from public.recipe_versions v where v.recipe_id = c.recipe_id and v.contribution_id = c.id), c.created_at),
      'tweak', c.user_id, c.recipe_id, c.id
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

revoke all on function public.home_feed(text, integer, integer) from public;
grant execute on function public.home_feed(text, integer, integer) to anon, authenticated, service_role;
