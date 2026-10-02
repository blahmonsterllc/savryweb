-- Community browsing and saved recipes: one contract for savry.io and the
-- iOS app, so a member sees the same recipes, the same saved list, and the
-- same "mine" markers wherever they sign in.
--
--   browse_public_recipes   search and filter the public catalog   (anyone)
--   recipe_save_state       is this recipe saved, and how many saves (anyone)
--   toggle_recipe_save      save or unsave a recipe                  (members)
--   my_saved_recipes        the member's saved list, newest first    (members)
--   my_published_recipes    what the member has published            (members)

create index if not exists recipe_saves_recipe_idx on public.recipe_saves (recipe_id);
create index if not exists recipe_saves_user_time_idx on public.recipe_saves (user_id, created_at desc);

-- Saves go through toggle_recipe_save so the count on the recipe stays right.
revoke insert, update, delete on public.recipe_saves from anon, authenticated;

-- One recipe as a list card. Internal: callers pass the viewer they resolved
-- from auth.uid(), so this is never exposed to clients.
create or replace function public.recipe_card(r public.recipes, viewer uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'slug', r.slug::text, 'title', r.title, 'description', r.description, 'imageUrl', r.image_url,
    'category', r.category, 'cuisine', r.cuisine, 'totalTime', r.prep_time_minutes + r.cook_time_minutes, 'servings', r.servings,
    'dietaryTags', to_jsonb(r.dietary_tags), 'allergens', to_jsonb(r.allergens),
    'calories', (r.nutrition_per_serving ->> 'calories')::integer,
    'nutritionSource', r.nutrition_source, 'nutritionCoverage', r.nutrition_coverage,
    'madeCount', r.made_count, 'saveCount', r.save_count, 'publishedAt', r.published_at, 'visibility', r.visibility,
    'authorName', p.display_name, 'authorUsername', p.username::text,
    'mine', (viewer is not null and r.author_id = viewer),
    'saved', (viewer is not null and exists (select 1 from public.recipe_saves s where s.user_id = viewer and s.recipe_id = r.id))
  )
  from public.profiles p where p.id = r.author_id
$$;

create or replace function public.browse_public_recipes(
  search_query text default null, category_filter text default null, diet_filter text default null,
  sort_by text default 'newest', result_limit integer default 24, result_offset integer default 0
) returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as id),
  matches as (
    select r, row_number() over (
             order by case when sort_by = 'popular' then r.community_score end desc nulls last, r.published_at desc nulls last, r.id
           ) as position
      from public.recipes r
      join public.profiles p on p.id = r.author_id
     where r.visibility = 'public' and not p.is_banned
       -- A member never sees recipes from someone they blocked.
       and not exists (select 1 from public.user_blocks b where b.blocker_id = (select id from me) and b.blocked_id = r.author_id)
       and (coalesce(btrim(search_query), '') = ''
            or r.search_document @@ websearch_to_tsquery('english', search_query)
            or r.title ilike '%' || replace(replace(btrim(search_query), '%', ''), '_', ' ') || '%')
       and (coalesce(btrim(category_filter), '') = '' or lower(r.category) = lower(btrim(category_filter)))
       and (coalesce(btrim(diet_filter), '') = '' or exists (select 1 from unnest(r.dietary_tags) t where lower(t) = lower(btrim(diet_filter))))
     order by position
     limit least(greatest(coalesce(result_limit, 24), 1), 60) offset greatest(coalesce(result_offset, 0), 0)
  )
  select jsonb_build_object('recipes', coalesce(jsonb_agg(public.recipe_card(m.r, (select id from me)) order by m.position), '[]'::jsonb))
  from matches m
$$;

create or replace function public.recipe_save_state(target_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'saved', (auth.uid() is not null and exists (select 1 from public.recipe_saves s where s.user_id = auth.uid() and s.recipe_id = r.id)),
    'saveCount', r.save_count)
  from public.recipes r
  where r.slug::text = lower(btrim(target_slug)) and (r.visibility in ('public', 'unlisted') or r.author_id = auth.uid())
$$;

create or replace function public.toggle_recipe_save(target_slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  target public.recipes;
  now_saved boolean;
  total bigint;
begin
  if me is null then raise exception 'Sign in to save recipes'; end if;
  if exists (select 1 from public.profiles where id = me and is_banned) then raise exception 'This account cannot save recipes'; end if;
  select * into target from public.recipes r
   where r.slug::text = lower(btrim(target_slug)) and (r.visibility in ('public', 'unlisted') or r.author_id = me);
  if target.id is null then raise exception 'Recipe not found'; end if;

  delete from public.recipe_saves where user_id = me and recipe_id = target.id;
  if found then
    now_saved := false;
  else
    insert into public.recipe_saves (user_id, recipe_id) values (me, target.id);
    now_saved := true;
  end if;
  update public.recipes set save_count = (select count(*) from public.recipe_saves where recipe_id = target.id)
   where id = target.id returning save_count into total;
  return jsonb_build_object('saved', now_saved, 'saveCount', total);
end $$;

create or replace function public.my_saved_recipes(result_limit integer default 60, result_offset integer default 0) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('recipes', coalesce(jsonb_agg(public.recipe_card(x.r, auth.uid()) order by x.saved_at desc), '[]'::jsonb))
  from (
    select r, s.created_at as saved_at
      from public.recipe_saves s join public.recipes r on r.id = s.recipe_id
     where s.user_id = auth.uid() and (r.visibility in ('public', 'unlisted') or r.author_id = auth.uid())
     order by s.created_at desc
     limit least(greatest(coalesce(result_limit, 60), 1), 200) offset greatest(coalesce(result_offset, 0), 0)
  ) x
$$;

create or replace function public.my_published_recipes() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('recipes', coalesce(jsonb_agg(public.recipe_card(r, auth.uid()) order by r.created_at desc), '[]'::jsonb))
  from public.recipes r
  where r.author_id = auth.uid()
$$;

revoke all on function public.recipe_card(public.recipes, uuid) from public, anon, authenticated;
revoke all on function public.browse_public_recipes(text, text, text, text, integer, integer) from public;
revoke all on function public.recipe_save_state(text) from public;
revoke all on function public.toggle_recipe_save(text) from public, anon;
revoke all on function public.my_saved_recipes(integer, integer) from public, anon;
revoke all on function public.my_published_recipes() from public, anon;
grant execute on function public.recipe_card(public.recipes, uuid) to service_role;
grant execute on function public.browse_public_recipes(text, text, text, text, integer, integer) to anon, authenticated, service_role;
grant execute on function public.recipe_save_state(text) to anon, authenticated, service_role;
grant execute on function public.toggle_recipe_save(text) to authenticated, service_role;
grant execute on function public.my_saved_recipes(integer, integer) to authenticated, service_role;
grant execute on function public.my_published_recipes() to authenticated, service_role;

-- Counts were never maintained before this; bring them in line.
update public.recipes r set save_count = (select count(*) from public.recipe_saves s where s.recipe_id = r.id)
 where r.save_count <> (select count(*) from public.recipe_saves s where s.recipe_id = r.id);
