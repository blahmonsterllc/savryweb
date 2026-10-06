-- Admin edits kept flattening a recipe: ingredient sections ("For the
-- sauce"), step sections and step timers were dropped on every save, because
-- the editor's text had no way to carry them and admin_update_recipe wrote
-- only name/amount/unit and the instruction.
--
-- The editor text now carries "## Section" headers and "[timer mm:ss]" on a
-- step (lib/ingredient-lines.mjs). admin_update_recipe stores an ingredient's
-- section and a step's section and timer_seconds; a step may still be sent as
-- a plain string. admin_recipe_detail adds stepDetails (section and timer per
-- step) so the editor can show them; steps stays a list of strings for
-- everything that already reads it. Otherwise both are unchanged from
-- 20261005040000_admin_edit_recipe.sql and 20261003050000_trending_and_picks.sql.

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
    'steps', coalesce((select jsonb_agg(s.instruction order by s.position) from public.recipe_steps s where s.recipe_id = r.id), '[]'::jsonb),
    'stepDetails', coalesce((select jsonb_agg(jsonb_build_object('instruction', s.instruction, 'section', s.section, 'timerSeconds', s.timer_seconds) order by s.position)
                               from public.recipe_steps s where s.recipe_id = r.id), '[]'::jsonb)
  )
  from public.recipes r join public.profiles p on p.id = r.author_id
  where r.id = target
$$;

create or replace function public.admin_update_recipe(target uuid, payload jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  current_version integer;
  new_version integer;
  ingredient jsonb;
  step_item jsonb;
  timer integer;
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
    insert into public.recipe_ingredients (recipe_id, position, section, name, amount, unit, is_optional)
    values (target, pos, nullif(left(btrim(coalesce(ingredient->>'section', '')), 60), ''),
            left(btrim(ingredient->>'name'), 200), nullif(left(btrim(coalesce(ingredient->>'amount', '')), 40), ''),
            nullif(left(btrim(coalesce(ingredient->>'unit', '')), 40), ''), coalesce((ingredient->>'isOptional')::boolean, false));
    pos := pos + 1;
  end loop;

  delete from public.recipe_steps where recipe_id = target;
  pos := 0;
  -- Each step is { instruction, section, timerSeconds }, or a plain string as before.
  for step_item in select * from jsonb_array_elements(payload->'steps') loop
    if jsonb_typeof(step_item) = 'string' then
      step_item := jsonb_build_object('instruction', step_item #>> '{}');
    end if;
    timer := case when coalesce(step_item->>'timerSeconds', '') ~ '^\d{1,6}$' then (step_item->>'timerSeconds')::integer end;
    insert into public.recipe_steps (recipe_id, position, section, instruction, timer_seconds)
    values (target, pos, nullif(left(btrim(coalesce(step_item->>'section', '')), 60), ''),
            left(btrim(coalesce(step_item->>'instruction', '')), 2000),
            case when timer between 1 and 86400 then timer end);
    pos := pos + 1;
  end loop;

  return jsonb_build_object('slug', (select slug::text from public.recipes where id = target), 'version', new_version);
end;
$$;

revoke all on function public.admin_recipe_detail(uuid) from public, anon, authenticated;
grant execute on function public.admin_recipe_detail(uuid) to service_role;
revoke all on function public.admin_update_recipe(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_recipe(uuid, jsonb) to service_role;
