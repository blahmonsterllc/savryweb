-- The list card says whether a recipe serves people or makes things
-- (servingType 'servings' | 'yields', and the yieldUnit: "cookies",
-- "slices"). For a yields recipe costPerServing is the cost of one item, not
-- of a meal, so anything that ranks or compares costs needs to tell the two
-- apart. Otherwise recipe_card is unchanged from
-- 20261005010000_price_pipeline_hardening.sql.

create or replace function public.recipe_card(r public.recipes, viewer uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'slug', r.slug::text, 'title', r.title, 'description', r.description, 'imageUrl', r.image_url,
    'category', r.category, 'cuisine', r.cuisine, 'totalTime', r.prep_time_minutes + r.cook_time_minutes, 'servings', r.servings,
    'servingType', r.serving_type, 'yieldUnit', r.yield_unit,
    'dietaryTags', to_jsonb(r.dietary_tags), 'allergens', to_jsonb(r.allergens),
    'calories', (r.nutrition_per_serving ->> 'calories')::integer,
    'nutritionSource', r.nutrition_source, 'nutritionCoverage', r.nutrition_coverage,
    'costPerServing', case when r.cost_coverage >= 0.95 then r.cost_per_serving end,
    'madeCount', r.made_count, 'saveCount', r.save_count, 'publishedAt', r.published_at, 'visibility', r.visibility,
    'editorsPick', (r.editors_pick_at is not null),
    'authorName', p.display_name, 'authorUsername', p.username::text,
    'mine', (viewer is not null and r.author_id = viewer),
    'saved', (viewer is not null and exists (select 1 from public.recipe_saves s where s.user_id = viewer and s.recipe_id = r.id))
  )
  from public.profiles p where p.id = r.author_id
$$;

-- The card helper takes any viewer id, so clients must not call it directly.
revoke all on function public.recipe_card(public.recipes, uuid) from public, anon, authenticated;
grant execute on function public.recipe_card(public.recipes, uuid) to service_role;
