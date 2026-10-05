-- Cost per serving: an estimate of what a recipe costs to buy, worked out
-- from the ingredient list and a table of average US grocery prices (the
-- same engine on savry.io and in the app: lib/cost/compute.mjs). This is
-- what Savry was for: cooking that saves money.

alter table public.recipes
  add column if not exists cost_per_serving numeric(8,2) check (cost_per_serving >= 0),
  add column if not exists cost_coverage numeric(5,4) check (cost_coverage between 0 and 1),
  add column if not exists cost_source text check (cost_source in ('savry_price_table'));

comment on column public.recipes.cost_per_serving is 'US dollars per serving, estimated from the ingredient list and Savry''s price table.';
comment on column public.recipes.cost_coverage is 'Share of countable ingredients that were matched, priced and weighed, 0..1.';

-- The list card carries the cost next to the calories.
create or replace function public.recipe_card(r public.recipes, viewer uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'slug', r.slug::text, 'title', r.title, 'description', r.description, 'imageUrl', r.image_url,
    'category', r.category, 'cuisine', r.cuisine, 'totalTime', r.prep_time_minutes + r.cook_time_minutes, 'servings', r.servings,
    'dietaryTags', to_jsonb(r.dietary_tags), 'allergens', to_jsonb(r.allergens),
    'calories', (r.nutrition_per_serving ->> 'calories')::integer,
    'nutritionSource', r.nutrition_source, 'nutritionCoverage', r.nutrition_coverage,
    'costPerServing', r.cost_per_serving,
    'madeCount', r.made_count, 'saveCount', r.save_count, 'publishedAt', r.published_at, 'visibility', r.visibility,
    'editorsPick', (r.editors_pick_at is not null),
    'authorName', p.display_name, 'authorUsername', p.username::text,
    'mine', (viewer is not null and r.author_id = viewer),
    'saved', (viewer is not null and exists (select 1 from public.recipe_saves s where s.user_id = viewer and s.recipe_id = r.id))
  )
  from public.profiles p where p.id = r.author_id
$$;

-- A cook records the cost the site worked out when they published, the same
-- way nutrition is recorded. Only the recipe's author may set it.
create or replace function public.set_my_recipe_cost(recipe_slug text, cost numeric, coverage numeric)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Sign in to continue'; end if;
  if cost is null or coverage is null then
    update public.recipes set cost_per_serving = null, cost_coverage = null, cost_source = null, updated_at = now()
     where slug = recipe_slug::public.citext and author_id = actor;
  else
    if cost < 0 or cost > 999999 or coverage < 0 or coverage > 1 then raise exception 'Cost out of range'; end if;
    update public.recipes
       set cost_per_serving = round(cost, 2), cost_coverage = round(coverage, 4), cost_source = 'savry_price_table', updated_at = now()
     where slug = recipe_slug::public.citext and author_id = actor;
  end if;
  if not found then raise exception 'Recipe not found'; end if;
end;
$$;

revoke all on function public.set_my_recipe_cost(text, numeric, numeric) from public, anon;
grant execute on function public.set_my_recipe_cost(text, numeric, numeric) to authenticated;
comment on function public.set_my_recipe_cost(text, numeric, numeric) is 'Stores the estimated cost per serving for one of the caller''s own recipes.';
