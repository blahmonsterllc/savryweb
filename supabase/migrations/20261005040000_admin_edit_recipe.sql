-- Editors revise a recipe from admin (a Savry Kitchen recipe or any other):
-- text, times, servings, labels, ingredients and steps. The version before
-- the edit is kept in recipe_versions, and the recipe's version goes up.
-- Only the server's service role may call this; /api/admin/recipes checks
-- the admin session first and works out nutrition and cost afterwards.

create or replace function public.admin_update_recipe(target uuid, payload jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  current_version integer;
  new_version integer;
  ingredient jsonb;
  step text;
  pos integer;
begin
  select version into current_version from public.recipes where id = target for update;
  if current_version is null then raise exception 'Recipe not found'; end if;

  if char_length(coalesce(payload->>'title', '')) not between 6 and 120 then raise exception 'Title must be 6 to 120 characters'; end if;
  if jsonb_array_length(coalesce(payload->'ingredients', '[]')) not between 2 and 80 then raise exception 'A recipe needs 2 to 80 ingredients'; end if;
  if jsonb_array_length(coalesce(payload->'steps', '[]')) not between 2 and 60 then raise exception 'A recipe needs 2 to 60 steps'; end if;
  if coalesce((payload->>'servings')::integer, 0) not between 1 and 500 then raise exception 'Servings must be 1 to 500'; end if;

  -- Keep what it said before this edit.
  insert into public.recipe_versions (recipe_id, version, snapshot, change_summary)
  values (target, current_version, public.admin_recipe_detail(target), 'Before an edit in admin')
  on conflict (recipe_id, version) do nothing;

  new_version := current_version + 1;
  update public.recipes set
    title = btrim(payload->>'title'),
    description = nullif(btrim(coalesce(payload->>'description', '')), ''),
    notes = nullif(btrim(coalesce(payload->>'notes', '')), ''),
    prep_time_minutes = greatest(0, least(coalesce((payload->>'prepTime')::integer, 0), 2000)),
    cook_time_minutes = greatest(0, least(coalesce((payload->>'cookTime')::integer, 0), 2000)),
    servings = (payload->>'servings')::integer,
    allergens = coalesce(array(select jsonb_array_elements_text(payload->'allergens')), '{}'),
    dietary_tags = coalesce(array(select jsonb_array_elements_text(payload->'dietaryTags')), '{}'),
    version = new_version,
    updated_at = now()
  where id = target;

  delete from public.recipe_ingredients where recipe_id = target;
  pos := 0;
  for ingredient in select * from jsonb_array_elements(payload->'ingredients') loop
    insert into public.recipe_ingredients (recipe_id, position, name, amount, unit, is_optional)
    values (target, pos, left(btrim(ingredient->>'name'), 200), nullif(left(btrim(coalesce(ingredient->>'amount', '')), 40), ''),
            nullif(left(btrim(coalesce(ingredient->>'unit', '')), 40), ''), coalesce((ingredient->>'isOptional')::boolean, false));
    pos := pos + 1;
  end loop;

  delete from public.recipe_steps where recipe_id = target;
  pos := 0;
  for step in select * from jsonb_array_elements_text(payload->'steps') loop
    insert into public.recipe_steps (recipe_id, position, instruction) values (target, pos, left(btrim(step), 2000));
    pos := pos + 1;
  end loop;

  return jsonb_build_object('slug', (select slug::text from public.recipes where id = target), 'version', new_version);
end;
$$;

revoke all on function public.admin_update_recipe(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_recipe(uuid, jsonb) to service_role;
