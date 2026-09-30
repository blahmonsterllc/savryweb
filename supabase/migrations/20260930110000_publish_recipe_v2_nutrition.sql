-- Versioned publishing entry point shared by the web and Apple clients.
-- The v1 function remains available for an orderly client rollout; v2 adds
-- strict, per-serving nutrition validation and source provenance.

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

  return result || jsonb_build_object('schemaVersion', 2);
end;
$$;

revoke all on function public.publish_recipe_v2(jsonb) from public, anon;
grant execute on function public.publish_recipe_v2(jsonb) to authenticated;

comment on function public.publish_recipe_v2(jsonb) is
  'Publishes a rights-attested recipe and validates optional per-serving nutrition for the authenticated member.';
