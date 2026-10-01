-- Recipe review for the admin area: publishing a draft stamps its publish time,
-- and admins can read any recipe in full (drafts included) to review it.

create or replace function public.admin_set_recipe_visibility(target uuid, new_visibility text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if new_visibility not in ('public', 'unlisted', 'private') then raise exception 'Bad visibility'; end if;
  update public.recipes
     set visibility = new_visibility::public.recipe_visibility,
         review_hold = false,
         report_count = case when new_visibility = 'public' then 0 else report_count end,
         published_at = case when new_visibility = 'public' then coalesce(published_at, now()) else published_at end
   where id = target;
end $$;
revoke all on function public.admin_set_recipe_visibility(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_recipe_visibility(uuid, text) to service_role;

create or replace function public.admin_recipe_detail(target uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'slug', r.slug, 'title', r.title, 'description', r.description, 'visibility', r.visibility,
    'reviewHold', r.review_hold, 'imageUrl', r.image_url, 'prepTime', r.prep_time_minutes, 'cookTime', r.cook_time_minutes,
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
revoke all on function public.admin_recipe_detail(uuid) from public, anon, authenticated;
grant execute on function public.admin_recipe_detail(uuid) to service_role;

-- A larger page so a whole batch of drafts fits on one screen.
create or replace function public.admin_recipes(query text default null, page_limit integer default 50) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(row_to_json(x) order by x."createdAt" desc), '[]'::jsonb)
  from (
    select r.id, r.slug, r.title, r.visibility, r.review_hold as "reviewHold", r.report_count as "reportCount",
           r.made_count as "madeCount", r.comment_count as "commentCount", r.version, r.image_url as "imageUrl",
           r.created_at as "createdAt", r.published_at as "publishedAt", r.category, r.cuisine,
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
