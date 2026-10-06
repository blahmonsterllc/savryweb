-- Every public recipe, compact enough for the app's weekly planner: what a
-- planner needs to choose (category, time, servings, cost, calories, diets,
-- allergen labels) plus the ingredients and steps, so the app can price a
-- recipe against the cook's pantry, check it against the family's allergies
-- and add it to the plan and grocery list without opening each page.
-- Public recipes only, never from banned cooks or cooks the viewer blocked;
-- the same rule as browse_public_recipes. Read-only.

create or replace function public.planning_catalog() returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as id),
  picked as (
    select r.*
      from public.recipes r
      join public.profiles p on p.id = r.author_id
     where r.visibility = 'public' and not p.is_banned
       and not exists (select 1 from public.user_blocks b where b.blocker_id = (select id from me) and b.blocked_id = r.author_id)
     order by r.community_score desc, r.published_at desc nulls last, r.id
     limit 1000
  )
  select jsonb_build_object('recipes', coalesce(jsonb_agg(jsonb_build_object(
    'slug', r.slug::text, 'title', r.title, 'description', r.description, 'imageUrl', r.image_url,
    'category', r.category, 'cuisine', r.cuisine, 'difficulty', r.difficulty,
    'prepTime', r.prep_time_minutes, 'cookTime', r.cook_time_minutes,
    'servings', r.servings, 'servingType', r.serving_type, 'yieldUnit', r.yield_unit,
    'dietaryTags', to_jsonb(r.dietary_tags), 'allergens', to_jsonb(r.allergens),
    'calories', (r.nutrition_per_serving ->> 'calories')::integer,
    'costPerServing', case when r.cost_coverage >= 0.95 then r.cost_per_serving end,
    'notes', r.notes, 'ovenTemp', r.oven_temp_f,
    'ingredients', coalesce((
      select jsonb_agg(jsonb_build_object('name', i.name, 'amount', i.amount, 'unit', i.unit, 'optional', i.is_optional, 'section', i.section) order by i.position)
        from public.recipe_ingredients i where i.recipe_id = r.id), '[]'::jsonb),
    'steps', coalesce((
      select jsonb_agg(s.instruction order by s.position)
        from public.recipe_steps s where s.recipe_id = r.id), '[]'::jsonb)
  ) order by r.community_score desc, r.published_at desc nulls last, r.id), '[]'::jsonb))
  from picked r
$$;

revoke all on function public.planning_catalog() from public;
grant execute on function public.planning_catalog() to anon, authenticated, service_role;
