-- Web soft launch: honest Savry Kitchen seed authors, future featured chefs,
-- and one atomic, RLS-aware recipe publishing entry point for web clients.

alter table public.profiles
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_rank smallint,
  add column if not exists chef_title text check (char_length(chef_title) <= 80);

create index if not exists profiles_featured_idx
  on public.profiles (featured_rank, created_at)
  where is_featured = true and is_banned = false;

-- Anonymous visitors may see the public-facing identity of recipe authors.
-- Email addresses live in auth.users and are never exposed by this policy.
create policy "public read published authors" on public.profiles
for select to anon using (
  not is_banned and exists (
    select 1 from public.recipes r
    where r.author_id = profiles.id and r.visibility = 'public'
  )
);

create or replace function public.publish_recipe(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  recipe_id uuid;
  recipe_slug text;
  existing_id uuid;
  ingredient_count integer := jsonb_array_length(coalesce(payload -> 'ingredients', '[]'::jsonb));
  step_count integer := jsonb_array_length(coalesce(payload -> 'instructions', '[]'::jsonb));
  publish_count integer;
  recipe_title text := btrim(coalesce(payload ->> 'title', ''));
  client_id text := nullif(btrim(coalesce(payload ->> 'clientRecipeId', '')), '');
  requested_image_path text := nullif(payload ->> 'imagePath', '');
begin
  if actor is null then raise exception 'Sign in to publish'; end if;
  if coalesce((payload ->> 'rightsAttested')::boolean, false) is not true then
    raise exception 'Confirm that you have permission to publish this recipe';
  end if;
  if length(recipe_title) not between 1 and 200 then raise exception 'Recipe title is required'; end if;
  if client_id is null or length(client_id) > 200 then raise exception 'Invalid recipe draft identifier'; end if;
  if ingredient_count not between 1 and 80 then raise exception 'Add between 1 and 80 ingredients'; end if;
  if step_count not between 1 and 60 then raise exception 'Add between 1 and 60 cooking steps'; end if;
  if exists (select 1 from public.profiles where id = actor and is_banned) then
    raise exception 'This account cannot publish';
  end if;
  if requested_image_path is not null and requested_image_path not like actor::text || '/%' then
    raise exception 'Invalid recipe image path';
  end if;

  select id, slug::text into existing_id, recipe_slug
  from public.recipes where author_id = actor and client_recipe_id = client_id;

  if existing_id is null then
    insert into public.daily_usage (user_id, day, publishes)
    values (actor, current_date, 1)
    on conflict (user_id, day) do update
      set publishes = public.daily_usage.publishes + 1, updated_at = now()
      where public.daily_usage.publishes < 10
    returning publishes into publish_count;
    if publish_count is null then raise exception 'Daily publishing limit reached'; end if;

    recipe_slug := trim(both '-' from regexp_replace(lower(recipe_title), '[^a-z0-9]+', '-', 'g'));
    if recipe_slug = '' then recipe_slug := 'recipe'; end if;
    recipe_slug := left(recipe_slug, 60) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);
    recipe_id := gen_random_uuid();
  else
    recipe_id := existing_id;
    delete from public.recipe_ingredients where recipe_id = existing_id;
    delete from public.recipe_steps where recipe_id = existing_id;
  end if;

  insert into public.recipes (
    id, author_id, client_recipe_id, slug, title, description,
    prep_time_minutes, cook_time_minutes, servings, serving_type, yield_unit,
    difficulty, category, cuisine, tags, dietary_tags, allergens, equipment,
    oven_temp_f, notes, source_url, image_path, image_url, visibility,
    published_at, content_hash, schema_version, quality_score
  ) values (
    recipe_id, actor, client_id, recipe_slug, recipe_title, nullif(payload ->> 'description', ''),
    greatest(0, least(6000, coalesce((payload ->> 'prepTime')::integer, 0))),
    greatest(0, least(6000, coalesce((payload ->> 'cookTime')::integer, 0))),
    greatest(1, least(500, coalesce((payload ->> 'servings')::integer, 1))),
    case when payload ->> 'servingType' = 'yields' then 'yields'::public.recipe_serving_type else 'servings'::public.recipe_serving_type end,
    nullif(payload ->> 'yieldUnit', ''),
    left(coalesce(nullif(payload ->> 'difficulty', ''), 'Medium'), 20),
    left(coalesce(nullif(payload ->> 'category', ''), 'Other'), 40),
    nullif(left(payload ->> 'cuisine', 60), ''),
    coalesce((select array_agg(left(value, 40)) from jsonb_array_elements_text(coalesce(payload -> 'tags', '[]'::jsonb))), '{}'::text[]),
    coalesce((select array_agg(left(value, 40)) from jsonb_array_elements_text(coalesce(payload -> 'dietaryTags', '[]'::jsonb))), '{}'::text[]),
    coalesce((select array_agg(left(value, 40)) from jsonb_array_elements_text(coalesce(payload -> 'allergens', '[]'::jsonb))), '{}'::text[]),
    coalesce((select array_agg(left(value, 60)) from jsonb_array_elements_text(coalesce(payload -> 'equipment', '[]'::jsonb))), '{}'::text[]),
    case when (payload ->> 'ovenTemp') is null then null else greatest(100, least(700, (payload ->> 'ovenTemp')::integer)) end,
    nullif(left(payload ->> 'notes', 2000), ''),
    nullif(left(payload ->> 'sourceURL', 2000), ''),
    requested_image_path,
    nullif(payload ->> 'imageURL', ''),
    'public', now(), encode(digest(payload::text, 'sha256'), 'hex'), 2,
    least(100, 45 + case when payload ->> 'imageURL' is not null then 15 else 0 end + case when length(coalesce(payload ->> 'description', '')) >= 40 then 10 else 0 end)
  )
  on conflict (id) do update set
    title = excluded.title, description = excluded.description,
    prep_time_minutes = excluded.prep_time_minutes, cook_time_minutes = excluded.cook_time_minutes,
    servings = excluded.servings, serving_type = excluded.serving_type, yield_unit = excluded.yield_unit,
    difficulty = excluded.difficulty, category = excluded.category, cuisine = excluded.cuisine,
    tags = excluded.tags, dietary_tags = excluded.dietary_tags, allergens = excluded.allergens,
    equipment = excluded.equipment, oven_temp_f = excluded.oven_temp_f, notes = excluded.notes,
    source_url = excluded.source_url, image_path = excluded.image_path, image_url = excluded.image_url,
    visibility = 'public', published_at = coalesce(public.recipes.published_at, now()),
    content_hash = excluded.content_hash, schema_version = 2, quality_score = excluded.quality_score;

  insert into public.recipe_ingredients (recipe_id, position, section, name, amount, unit, is_optional)
  select recipe_id, (entry.ordinality - 1)::smallint,
    nullif(left(entry.value ->> 'section', 60), ''),
    left(btrim(entry.value ->> 'name'), 200),
    nullif(left(entry.value ->> 'amount', 40), ''),
    nullif(left(entry.value ->> 'unit', 40), ''),
    coalesce((entry.value ->> 'isOptional')::boolean, false)
  from jsonb_array_elements(payload -> 'ingredients') with ordinality as entry(value, ordinality)
  where length(btrim(coalesce(entry.value ->> 'name', ''))) > 0;

  insert into public.recipe_steps (recipe_id, position, instruction)
  select recipe_id, (entry.ordinality - 1)::smallint, left(btrim(entry.value #>> '{}'), 2000)
  from jsonb_array_elements(payload -> 'instructions') with ordinality as entry(value, ordinality)
  where length(btrim(coalesce(entry.value #>> '{}', ''))) > 0;

  insert into public.recipe_versions (recipe_id, version, snapshot, change_summary, created_by)
  values (recipe_id, 1, payload, 'Published from the Savry web preview', actor)
  on conflict (recipe_id, version) do update set snapshot = excluded.snapshot, created_by = actor;

  return jsonb_build_object(
    'success', true,
    'id', recipe_id,
    'slug', recipe_slug,
    'url', '/recipes/' || recipe_slug
  );
end;
$$;

revoke all on function public.publish_recipe(jsonb) from public, anon;
grant execute on function public.publish_recipe(jsonb) to authenticated;

comment on function public.publish_recipe(jsonb) is
  'Atomically publishes a rights-attested community recipe for the authenticated Savry member.';
