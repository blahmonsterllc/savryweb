-- What the table is cooking this week, and what the editors chose.
--
-- Trending is computed, never stored: made-its count three, saves and cook
-- notes one each, over the last `days` days, public recipes only, never from
-- banned cooks or anyone the viewer blocked. Editor's picks are a timestamp an
-- admin sets; recipe cards everywhere carry the flag.

alter table public.recipes add column if not exists editors_pick_at timestamptz;
create index if not exists recipes_editors_pick_idx on public.recipes (editors_pick_at desc) where editors_pick_at is not null and visibility = 'public';

-- recipe_card now says whether a recipe is an editor's pick.
create or replace function public.recipe_card(r public.recipes, viewer uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'slug', r.slug::text, 'title', r.title, 'description', r.description, 'imageUrl', r.image_url,
    'category', r.category, 'cuisine', r.cuisine, 'totalTime', r.prep_time_minutes + r.cook_time_minutes, 'servings', r.servings,
    'dietaryTags', to_jsonb(r.dietary_tags), 'allergens', to_jsonb(r.allergens),
    'calories', (r.nutrition_per_serving ->> 'calories')::integer,
    'nutritionSource', r.nutrition_source, 'nutritionCoverage', r.nutrition_coverage,
    'madeCount', r.made_count, 'saveCount', r.save_count, 'publishedAt', r.published_at, 'visibility', r.visibility,
    'editorsPick', r.editors_pick_at is not null,
    'authorName', p.display_name, 'authorUsername', p.username::text,
    'mine', (viewer is not null and r.author_id = viewer),
    'saved', (viewer is not null and exists (select 1 from public.recipe_saves s where s.user_id = viewer and s.recipe_id = r.id))
  )
  from public.profiles p where p.id = r.author_id
$$;

create or replace function public.trending_recipes(result_limit integer default 6, days integer default 7) returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as id),
  since as (select now() - make_interval(days => greatest(1, least(coalesce(days, 7), 90))) as at),
  scored as (
    select r.id,
      (select count(*) from public.contributions c where c.recipe_id = r.id and c.type = 'made' and not c.hidden and c.created_at >= (select at from since)) * 3
      + (select count(*) from public.recipe_saves s where s.recipe_id = r.id and s.created_at >= (select at from since))
      + (select count(*) from public.contributions c where c.recipe_id = r.id and c.type = 'comment' and not c.hidden and c.created_at >= (select at from since)) as score
    from public.recipes r
    join public.profiles a on a.id = r.author_id and not a.is_banned
    where r.visibility = 'public'
      and not exists (select 1 from public.user_blocks b where b.blocker_id = (select id from me) and b.blocked_id = r.author_id)
  )
  select jsonb_build_object('recipes', coalesce(jsonb_agg(public.recipe_card(r, (select id from me)) || jsonb_build_object('score', x.score) order by x.score desc, r.published_at desc), '[]'::jsonb))
  from (select * from scored where score > 0 order by score desc limit greatest(1, least(coalesce(result_limit, 6), 24))) x
  join public.recipes r on r.id = x.id
$$;

create or replace function public.editors_picks(result_limit integer default 6) returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as id)
  select jsonb_build_object('recipes', coalesce(jsonb_agg(public.recipe_card(r, (select id from me)) order by r.editors_pick_at desc), '[]'::jsonb))
  from (
    select r.* from public.recipes r
    join public.profiles a on a.id = r.author_id and not a.is_banned
    where r.visibility = 'public' and r.editors_pick_at is not null
      and not exists (select 1 from public.user_blocks b where b.blocker_id = (select id from me) and b.blocked_id = r.author_id)
    order by r.editors_pick_at desc
    limit greatest(1, least(coalesce(result_limit, 6), 24))
  ) r
$$;

create or replace function public.admin_set_editors_pick(target uuid, pick boolean) returns void
language sql security definer set search_path = '' as $$
  update public.recipes set editors_pick_at = case when pick then coalesce(editors_pick_at, now()) else null end where id = target
$$;

-- The admin's full view of a recipe now includes the pick.
create or replace function public.admin_recipe_detail(target uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'slug', r.slug, 'title', r.title, 'description', r.description, 'visibility', r.visibility,
    'reviewHold', r.review_hold, 'editorsPickAt', r.editors_pick_at, 'imageUrl', r.image_url, 'prepTime', r.prep_time_minutes, 'cookTime', r.cook_time_minutes,
    'servings', r.servings, 'servingType', r.serving_type, 'yieldUnit', r.yield_unit, 'difficulty', r.difficulty,
    'category', r.category, 'cuisine', r.cuisine, 'tags', to_jsonb(r.tags), 'dietaryTags', to_jsonb(r.dietary_tags),
    'allergens', to_jsonb(r.allergens), 'equipment', to_jsonb(r.equipment), 'ovenTemp', r.oven_temp_f, 'notes', r.notes,
    'authorName', p.display_name, 'createdAt', r.created_at, 'publishedAt', r.published_at,
    'ingredients', coalesce((select jsonb_agg(jsonb_build_object('section', i.section, 'name', i.name, 'amount', i.amount, 'unit', i.unit, 'isOptional', i.is_optional) order by i.position)
                               from public.recipe_ingredients i where i.recipe_id = r.id), '[]'::jsonb),
    'steps', coalesce((select jsonb_agg(s.instruction order by s.position) from public.recipe_steps s where s.recipe_id = r.id), '[]'::jsonb)
  )
  from public.recipes r join public.profiles p on p.id = r.author_id
  where r.id = target
$$;

-- The admin list shows picks too.
create or replace function public.admin_recipes(query text default null, page_limit integer default 50) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(row_to_json(x) order by x."createdAt" desc), '[]'::jsonb)
  from (
    select r.id, r.slug, r.title, r.visibility, r.review_hold as "reviewHold", r.report_count as "reportCount",
           r.made_count as "madeCount", r.comment_count as "commentCount", r.version, r.image_url as "imageUrl",
           r.created_at as "createdAt", r.published_at as "publishedAt", r.editors_pick_at as "editorsPickAt", r.category, r.cuisine,
           to_jsonb(r.dietary_tags) as "dietaryTags", to_jsonb(r.allergens) as allergens,
           p.display_name as "authorName", p.username as "authorUsername", p.id as "authorId", p.is_banned as "authorBanned"
      from public.recipes r join public.profiles p on p.id = r.author_id
     where query is null or btrim(query) = ''
        or r.title ilike '%' || btrim(query) || '%'
        or r.slug ilike '%' || btrim(query) || '%'
        or p.display_name ilike '%' || btrim(query) || '%'
     order by r.created_at desc
     limit least(greatest(coalesce(page_limit, 50), 1), 500)
  ) x
$$;
revoke all on function public.admin_recipes(text, integer) from public, anon, authenticated;
grant execute on function public.admin_recipes(text, integer) to service_role;

revoke all on function public.trending_recipes(integer, integer) from public;
revoke all on function public.editors_picks(integer) from public;
revoke all on function public.admin_set_editors_pick(uuid, boolean) from public, anon, authenticated;
revoke all on function public.admin_recipe_detail(uuid) from public, anon, authenticated;
grant execute on function public.trending_recipes(integer, integer) to anon, authenticated, service_role;
grant execute on function public.editors_picks(integer) to anon, authenticated, service_role;
grant execute on function public.admin_set_editors_pick(uuid, boolean) to service_role;
grant execute on function public.admin_recipe_detail(uuid) to service_role;
