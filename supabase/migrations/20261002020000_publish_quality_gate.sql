-- Keeps the shared table free of one-word recipes. Two rules, both enforced
-- on the server so the app and the website behave the same:
--
--   1. A recipe must look like a recipe: a real name, at least two
--      ingredients, and a method of at least two steps a cook can follow.
--   2. A cook's first two recipes wait for an editor. They are saved as the
--      cook's private recipe with review_hold set, show up under "Drafts to
--      review" in admin, and go live when an admin publishes them. After two
--      published recipes a cook's new recipes go straight to the table.
--      Admins are trusted from the start. Edits to a recipe that is already
--      public stay public; reports and the patrol cover those.

create or replace function public.recipe_quality_problem(payload jsonb)
returns text
language plpgsql immutable set search_path = '' as $$
declare
  title text := btrim(coalesce(payload ->> 'title', ''));
  title_words integer := coalesce(array_length(regexp_split_to_array(title, '\s+'), 1), 0);
  title_letters integer := length(regexp_replace(title, '[^[:alpha:]]', '', 'g'));
  named_ingredients integer;
  usable_steps integer;
  method_length integer;
begin
  if title = '' then
    return 'Give the recipe a name.';
  end if;
  if title_words < 2 and title_letters < 8 then
    return 'Give the recipe a real name, like "Pork chops with apples", not a single word.';
  end if;

  select count(*) into named_ingredients
  from jsonb_array_elements(coalesce(payload -> 'ingredients', '[]'::jsonb)) e
  where length(btrim(coalesce(e ->> 'name', ''))) >= 2;
  if named_ingredients < 2 then
    return 'List at least two ingredients.';
  end if;

  select count(*) filter (where length(step) >= 12), coalesce(sum(length(step)), 0)
  into usable_steps, method_length
  from (
    select btrim(coalesce(e ->> 'instruction', e ->> 'text', e #>> '{}')) as step
    from jsonb_array_elements(coalesce(payload -> 'instructions', '[]'::jsonb)) e
  ) steps;
  if usable_steps < 2 or method_length < 80 then
    return 'Write the method in at least two steps a cook can follow, about a sentence each.';
  end if;

  return null;
end $$;

-- Whether a cook's new recipes go live without an editor reading them first.
-- `excluding` is the recipe being published right now, which publish_recipe
-- has already written as public; it must not count toward the cook's record.
create or replace function public.cook_is_trusted(cook uuid, excluding uuid default null)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users a where a.user_id = cook)
      or (select count(*) from public.recipes r
          where r.author_id = cook and r.visibility = 'public' and r.published_at is not null
            and (excluding is null or r.id <> excluding)) >= 2
$$;

create or replace function public.publish_recipe_v2(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  result jsonb;
  target_id uuid;
  problem text;
  already_public boolean;
  standing text := 'live';
  nutrition jsonb := payload -> 'nutritionPerServing';
  calories numeric;
  protein numeric;
  carbohydrates numeric;
  fat numeric;
  fiber numeric;
  sugar numeric;
  sodium numeric;
  cholesterol numeric;
  coverage numeric;
  source public.nutrition_source;
begin
  if actor is null then raise exception 'Sign in to publish'; end if;

  problem := public.recipe_quality_problem(payload);
  if problem is not null then raise exception '%', problem; end if;

  already_public := exists (
    select 1 from public.recipes r
    where r.author_id = actor
      and r.client_recipe_id = nullif(btrim(coalesce(payload ->> 'clientRecipeId', '')), '')
      and r.visibility = 'public'
  );

  -- publish_recipe performs the canonical identity, rate-limit, rights,
  -- ownership, ingredient, step, image-path, and length checks.
  result := public.publish_recipe(payload);
  target_id := (result ->> 'id')::uuid;

  if nutrition is not null and nutrition <> 'null'::jsonb then
    if jsonb_typeof(nutrition) <> 'object' then
      raise exception 'Nutrition must be an object';
    end if;
    if not (nutrition ?& array[
      'calories', 'protein', 'carbohydrates', 'fat',
      'fiber', 'sugar', 'sodium', 'cholesterol'
    ]) then
      raise exception 'Nutrition is incomplete';
    end if;

    -- Casting is intentional: non-numeric input aborts the transaction.
    calories := (nutrition ->> 'calories')::numeric;
    protein := (nutrition ->> 'protein')::numeric;
    carbohydrates := (nutrition ->> 'carbohydrates')::numeric;
    fat := (nutrition ->> 'fat')::numeric;
    fiber := (nutrition ->> 'fiber')::numeric;
    sugar := (nutrition ->> 'sugar')::numeric;
    sodium := (nutrition ->> 'sodium')::numeric;
    cholesterol := (nutrition ->> 'cholesterol')::numeric;
    coverage := case
      when nutrition ->> 'ingredientCoverage' is null then null
      else (nutrition ->> 'ingredientCoverage')::numeric
    end;

    if calories < 0 or calories > 20000
      or protein < 0 or protein > 5000
      or carbohydrates < 0 or carbohydrates > 5000
      or fat < 0 or fat > 5000
      or fiber < 0 or fiber > 1000
      or sugar < 0 or sugar > 5000
      or sodium < 0 or sodium > 100000
      or cholesterol < 0 or cholesterol > 10000
      or (coverage is not null and (coverage < 0 or coverage > 1)) then
      raise exception 'Nutrition values are outside supported ranges';
    end if;

    source := case nutrition ->> 'source'
      when 'usdaFoodDataCentral' then 'usda_food_data_central'::public.nutrition_source
      when 'packageLabel' then 'package_label'::public.nutrition_source
      when 'localReference' then 'local_reference'::public.nutrition_source
      when 'imported' then 'imported'::public.nutrition_source
      else 'on_device_estimate'::public.nutrition_source
    end;

    update public.recipes
    set nutrition_per_serving = jsonb_build_object(
          'calories', calories,
          'protein', protein,
          'carbohydrates', carbohydrates,
          'fat', fat,
          'fiber', fiber,
          'sugar', sugar,
          'sodium', sodium,
          'cholesterol', cholesterol
        ),
        nutrition_source = source,
        nutrition_coverage = coverage,
        updated_at = now()
    where id = target_id and author_id = actor;

    if not found then raise exception 'Published recipe ownership check failed'; end if;
  else
    -- An edit that removes nutrition should not leave stale values behind.
    update public.recipes
    set nutrition_per_serving = null,
        nutrition_source = null,
        nutrition_coverage = null,
        updated_at = now()
    where id = target_id and author_id = actor;
  end if;

  -- A new cook's recipe waits for an editor; it stays theirs to see and edit.
  if not already_public and not public.cook_is_trusted(actor, target_id) then
    update public.recipes
    set visibility = 'private', review_hold = true, published_at = null
    where id = target_id and author_id = actor;
    standing := 'pending_review';
  end if;

  return result || jsonb_build_object('schemaVersion', 2, 'status', standing);
end;
$$;
revoke all on function public.publish_recipe_v2(jsonb) from public, anon;
grant execute on function public.publish_recipe_v2(jsonb) to authenticated;
revoke all on function public.recipe_quality_problem(jsonb) from public, anon;
grant execute on function public.recipe_quality_problem(jsonb) to authenticated;
revoke all on function public.cook_is_trusted(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cook_is_trusted(uuid, uuid) to service_role;

comment on function public.publish_recipe_v2(jsonb) is
  'Publishes a rights-attested recipe that passes the quality gate; a cook''s first two recipes are held for editor review.';
