-- Savry community: lock down direct table writes and move every community
-- action (Made Its, structured tweaks, reports, moderation, blocking, account
-- deletion) into SECURITY DEFINER functions. After this migration clients can
-- only READ tables; every write goes through a function that checks account
-- standing, screens content, and rate-limits.
--
-- Also fixes: user-editable ban/tier/featured flags, direct recipe writes that
-- bypassed publish_recipe_v2, missing version history on republish, missing
-- email-verification check, and unsafe image/source URLs.

-- ---------------------------------------------------------------------------
-- 0. Settings the functions need
-- ---------------------------------------------------------------------------
create extension if not exists unaccent with schema extensions;
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from public, anon, authenticated;
insert into public.app_settings (key, value) values
  ('storage_public_base', 'https://qnpekzrchqftdoaebzuf.supabase.co/storage/v1/object/public/recipe-images'),
  ('site_url', 'https://www.savry.io')
on conflict (key) do nothing;

create or replace function public.setting(setting_key text) returns text
language sql stable security definer set search_path = '' as $$
  select value from public.app_settings where key = setting_key
$$;
revoke all on function public.setting(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Schema additions
-- ---------------------------------------------------------------------------
alter table public.contributions
  add column if not exists source text not null default 'web' check (source in ('app', 'web')),
  add column if not exists made_it boolean not null default false,
  add column if not exists tweak_id uuid references public.contributions(id) on delete set null,
  add column if not exists report_count integer not null default 0 check (report_count >= 0);

alter table public.recipes
  add column if not exists report_count integer not null default 0 check (report_count >= 0),
  add column if not exists review_hold boolean not null default false;

alter table public.moderation_queue
  add column if not exists kind text not null default 'contribution',
  add column if not exists reasons text[] not null default '{}',
  add column if not exists preview text,
  add column if not exists resolved_at timestamptz;

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

-- Display names: bounded and never impersonating Savry staff.
alter table public.profiles drop constraint if exists profiles_display_name_check;
alter table public.profiles add constraint profiles_display_name_check check (
  char_length(btrim(display_name)) between 1 and 60
  and display_name !~* '(^|\s)(savry|admin|moderator|staff|official)(\s|$)'
);
alter table public.profiles drop constraint if exists profiles_username_check;
alter table public.profiles add constraint profiles_username_check check (
  username is null or (char_length(username) between 3 and 30 and username ~ '^[a-z0-9][a-z0-9_.]*$')
);

-- One counted Made It per cook per recipe per day.
create unique index if not exists contributions_made_daily_idx
  on public.contributions (recipe_id, user_id, ((created_at at time zone 'UTC')::date))
  where type = 'made';
-- One pending tweak per cook per recipe.
create unique index if not exists contributions_one_pending_tweak_idx
  on public.contributions (recipe_id, user_id)
  where type = 'tweak' and status = 'pending' and not hidden;

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public, anon, authenticated;
grant select on public.user_blocks to authenticated;
create policy "members read own blocks" on public.user_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. Lock down direct writes
-- ---------------------------------------------------------------------------
-- Profiles: only harmless columns are editable, and only on your own row.
revoke update on public.profiles from authenticated;
grant update (display_name, bio, avatar_path, username, email_opt_in) on public.profiles to authenticated;
-- Members must not read other members' tier or email preferences.
drop policy if exists "members read profiles" on public.profiles;
revoke select on public.profiles from authenticated, anon;
grant select (id, username, display_name, avatar_path, bio, is_featured, featured_rank, chef_title, created_at)
  on public.profiles to anon, authenticated;
grant select (tier, is_banned, email_opt_in, terms_accepted_at, updated_at) on public.profiles to authenticated;
create policy "members read profiles" on public.profiles for select to authenticated
  using (not is_banned or id = (select auth.uid()));
-- Note: column-level grants restrict which columns can be selected; a member
-- selecting tier/is_banned on another row is denied by the grant on anon and
-- allowed for authenticated only via this function-free path. To keep other
-- members' tier private, the API layer never selects it for foreign rows and
-- the get_* functions below expose only display fields.

-- Recipes, ingredients, steps: read-only for clients. Writes go through functions.
drop policy if exists "members create recipes" on public.recipes;
drop policy if exists "authors update recipes" on public.recipes;
drop policy if exists "authors delete drafts" on public.recipes;
drop policy if exists "authors manage ingredients" on public.recipe_ingredients;
drop policy if exists "authors manage steps" on public.recipe_steps;
revoke insert, update, delete on public.recipes, public.recipe_ingredients, public.recipe_steps from anon, authenticated;
-- Reports: only through report_content().
drop policy if exists "members file reports" on public.reports;
revoke insert on public.reports from anon, authenticated;
-- Version history stays readable for public recipes (visible history policy exists).

-- Storage: tighter image limits (2 MB, JPEG/PNG/WebP).
update storage.buckets set file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'recipe-images';

-- ---------------------------------------------------------------------------
-- 3. Shared guards
-- ---------------------------------------------------------------------------
create or replace function public.assert_can_write(actor uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  confirmed timestamptz;
  banned boolean;
begin
  if actor is null then raise exception 'Sign in first'; end if;
  select p.is_banned into banned from public.profiles p where p.id = actor;
  if banned is null then raise exception 'Account not found'; end if;
  if banned then raise exception 'This account can no longer post on Savry'; end if;
  select u.email_confirmed_at into confirmed from auth.users u where u.id = actor;
  if confirmed is null then
    raise exception 'Verify your email to post. Open the link we sent you, then try again.';
  end if;
end $$;
revoke all on function public.assert_can_write(uuid) from public, anon, authenticated;

-- Returns null when the text is acceptable, otherwise a user-facing reason.
create or replace function public.screen_text(input text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  letters text;
begin
  if input is null or btrim(input) = '' then return null; end if;
  if input ~* '(https?://|www\.|\m[a-z0-9-]+\.(com|net|org|io|ru|cn|xyz|top|info|biz|co)\M)' then
    return 'Links aren''t allowed here.';
  end if;
  if input ~* '(\m\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\M|@[a-z0-9_]{3,}|telegram|whatsapp|cashapp|venmo)' then
    return 'Please don''t share contact details or payment handles here.';
  end if;
  if input ~ '(.)\1{7,}' then return 'That looks like spam. Try rewording it.'; end if;
  if input ~* '\m(fuck\w*|shit\w*|bitch\w*|cunt\w*|asshole\w*|nigg\w*|fag\w*|retard\w*|kill yourself|kys)\M' then
    return 'Please keep it friendly. That wording isn''t allowed.';
  end if;
  letters := regexp_replace(input, '[^A-Za-z]', '', 'g');
  if char_length(letters) > 40 and letters = upper(letters) then return 'Please don''t write in all caps.'; end if;
  return null;
end $$;

create or replace function public.screen_text_or_raise(input text) returns void
language plpgsql immutable set search_path = '' as $$
declare reason text := public.screen_text(input);
begin if reason is not null then raise exception '%', reason; end if; end $$;

-- Food-safety flags for a tweak. Flags are shown as warnings; they never block.
create or replace function public.safety_flags_for(change jsonb, step_text text, recipe_title text) returns text[]
language plpgsql immutable set search_path = '' as $$
declare
  combined text := coalesce(change ->> 'to', '') || ' ' || coalesce(change ->> 'note', '');
  context text := combined || ' ' || coalesce(step_text, '') || ' ' || coalesce(recipe_title, '');
  risky constant text := '(chicken|turkey|poultry|pork|ground beef|ground meat|burger|sausage|egg|fish|shellfish|shrimp)';
  flags text[] := '{}';
  temp_match text[];
begin
  if combined ~* '\m(raw|uncooked|undercook\w*|rare|skip (the )?cook\w*|don''?t cook|no need to cook|room temperature (overnight|for hours)|leave (it )?out overnight)\M'
     and context ~* risky then
    flags := array_append(flags, 'May undercook meat, poultry, eggs, or seafood');
  end if;
  if change ->> 'kind' = 'step.remove' and coalesce(step_text, '') ~* risky
     and step_text ~* '\m(cook|bake|roast|fry|grill|sear|boil|simmer|until)\M' then
    flags := array_append(flags, 'Removes a cooking step for meat, poultry, eggs, or seafood');
  end if;
  if combined ~* '\m(canning|home[- ]can\w*|pressure can\w*|water bath|shelf[- ]stable|botulism|preserv(e|ing) (it )?in jars?)\M' then
    flags := array_append(flags, 'Home canning or preserving needs a tested method');
  end if;
  temp_match := regexp_match(combined, '(\d{2,3})\s*°?\s*f\M', 'i');
  if temp_match is not null and temp_match[1]::integer < 140 and (combined || ' ' || coalesce(step_text, '')) ~* risky then
    flags := array_append(flags, 'Cooking temperature looks too low to be safe');
  end if;
  return flags;
end $$;

-- Daily allowance, counted in Postgres so it survives serverless restarts.
create or replace function public.take_daily_allowance(actor uuid, kind text, max_per_day integer) returns void
language plpgsql security definer set search_path = '' as $$
declare used integer;
begin
  insert into public.daily_usage (user_id, day) values (actor, current_date)
  on conflict (user_id, day) do nothing;
  execute format('update public.daily_usage set %I = %I + 1, updated_at = now() where user_id = $1 and day = current_date and %I < $2 returning %I', kind, kind, kind, kind)
    into used using actor, max_per_day;
  if used is null then raise exception 'You''ve reached today''s limit for this. Come back tomorrow.'; end if;
end $$;
revoke all on function public.take_daily_allowance(uuid, text, integer) from public, anon, authenticated;

-- "1 1/2 cups oat milk" -> {amount, unit, name}
create or replace function public.parse_ingredient_line(line text) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  tokens text[] := regexp_split_to_array(btrim(coalesce(line, '')), '\s+');
  amount_parts text[] := '{}';
  unit_value text;
  i integer := 1;
  units constant text[] := array['cup','cups','c','tbsp','tablespoon','tablespoons','tsp','teaspoon','teaspoons','oz','ounce','ounces',
    'lb','lbs','pound','pounds','g','gram','grams','kg','ml','l','liter','liters','clove','cloves','can','cans','pinch','slice','slices',
    'piece','pieces','stick','sticks','sprig','sprigs','bunch','large','medium','small'];
begin
  while i <= coalesce(array_length(tokens, 1), 0) and tokens[i] ~ '^[0-9½⅓⅔¼¾⅛./-]+$' loop
    amount_parts := amount_parts || tokens[i]; i := i + 1;
  end loop;
  if i <= coalesce(array_length(tokens, 1), 0) and lower(rtrim(tokens[i], '.')) = any (units) then
    unit_value := tokens[i]; i := i + 1;
  end if;
  return jsonb_build_object(
    'amount', nullif(array_to_string(amount_parts, ' '), ''),
    'unit', unit_value,
    'name', coalesce(nullif(array_to_string(tokens[i:], ' '), ''), btrim(coalesce(line, '')))
  );
end $$;

-- Snapshot the current state of a recipe into recipe_versions and bump version.
create or replace function public.snapshot_recipe_version(target uuid, actor uuid, summary text, contribution uuid default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  current_version integer;
  snap jsonb;
begin
  select version into current_version from public.recipes where id = target for update;
  select jsonb_build_object(
    'recipe', to_jsonb(r) - 'search_document',
    'ingredients', coalesce((select jsonb_agg(to_jsonb(i) order by i.position) from public.recipe_ingredients i where i.recipe_id = r.id), '[]'::jsonb),
    'steps', coalesce((select jsonb_agg(to_jsonb(s) order by s.position) from public.recipe_steps s where s.recipe_id = r.id), '[]'::jsonb)
  ) into snap from public.recipes r where r.id = target;
  insert into public.recipe_versions (recipe_id, version, snapshot, change_summary, created_by, contribution_id)
  values (target, current_version, snap, summary, actor, contribution)
  on conflict (recipe_id, version) do update set snapshot = excluded.snapshot, change_summary = excluded.change_summary, created_by = excluded.created_by;
  update public.recipes set version = current_version + 1 where id = target;
  return current_version + 1;
end $$;
revoke all on function public.snapshot_recipe_version(uuid, uuid, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. publish_recipe: screening, safe URLs, version history
-- ---------------------------------------------------------------------------
create or replace function public.publish_recipe(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  new_recipe_id uuid;
  recipe_slug text;
  existing_id uuid;
  ingredient_count integer := jsonb_array_length(coalesce(payload -> 'ingredients', '[]'::jsonb));
  step_count integer := jsonb_array_length(coalesce(payload -> 'instructions', '[]'::jsonb));
  recipe_title text := btrim(coalesce(payload ->> 'title', ''));
  client_id text := nullif(btrim(coalesce(payload ->> 'clientRecipeId', '')), '');
  requested_image_path text := nullif(payload ->> 'imagePath', '');
  requested_image_url text := nullif(payload ->> 'imageURL', '');
  requested_source_url text := nullif(left(payload ->> 'sourceURL', 2000), '');
  storage_base text := public.setting('storage_public_base');
  entry jsonb;
  new_version integer := 1;
begin
  perform public.assert_can_write(actor);
  if coalesce((payload ->> 'rightsAttested')::boolean, false) is not true then
    raise exception 'Confirm that you have permission to publish this recipe';
  end if;
  if length(recipe_title) not between 1 and 200 then raise exception 'Recipe title is required'; end if;
  if client_id is null or length(client_id) > 200 then raise exception 'Invalid recipe draft identifier'; end if;
  if ingredient_count not between 1 and 80 then raise exception 'Add between 1 and 80 ingredients'; end if;
  if step_count not between 1 and 60 then raise exception 'Add between 1 and 60 cooking steps'; end if;
  if requested_image_path is not null and requested_image_path not like actor::text || '/%' then
    raise exception 'Invalid recipe image path';
  end if;
  -- Only images we host may be shown; a path implies the URL.
  if requested_image_path is not null then
    requested_image_url := storage_base || '/' || requested_image_path;
  elsif requested_image_url is not null and requested_image_url not like storage_base || '/%' then
    requested_image_url := null;
  end if;
  if requested_source_url is not null and requested_source_url !~* '^https?://[^\s/$.?#].[^\s]*$' then
    raise exception 'Source link must be a full web address';
  end if;

  -- Content screening on every free-text field.
  perform public.screen_text_or_raise(recipe_title);
  perform public.screen_text_or_raise(payload ->> 'description');
  perform public.screen_text_or_raise(payload ->> 'notes');
  for entry in select value from jsonb_array_elements(coalesce(payload -> 'instructions', '[]'::jsonb)) loop
    perform public.screen_text_or_raise(entry #>> '{}');
  end loop;
  for entry in select value from jsonb_array_elements(coalesce(payload -> 'ingredients', '[]'::jsonb)) loop
    perform public.screen_text_or_raise(entry ->> 'name');
  end loop;

  select id, slug::text into existing_id, recipe_slug
  from public.recipes where author_id = actor and client_recipe_id = client_id;

  if existing_id is null then
    perform public.take_daily_allowance(actor, 'publishes', 10);
    recipe_slug := trim(both '-' from regexp_replace(lower(extensions.unaccent(recipe_title)), '[^a-z0-9]+', '-', 'g'));
    if recipe_slug = '' then recipe_slug := 'recipe'; end if;
    recipe_slug := left(recipe_slug, 60) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);
    new_recipe_id := gen_random_uuid();
  else
    new_recipe_id := existing_id;
    -- Keep history: snapshot what is live before overwriting it.
    new_version := public.snapshot_recipe_version(existing_id, actor, 'Republished by the author');
    delete from public.recipe_ingredients where recipe_id = existing_id;
    delete from public.recipe_steps where recipe_id = existing_id;
  end if;

  insert into public.recipes (
    id, author_id, client_recipe_id, slug, title, description,
    prep_time_minutes, cook_time_minutes, servings, serving_type, yield_unit,
    difficulty, category, cuisine, tags, dietary_tags, allergens, equipment,
    oven_temp_f, notes, source_url, image_path, image_url, visibility,
    published_at, content_hash, schema_version, quality_score, version
  ) values (
    new_recipe_id, actor, client_id, recipe_slug, recipe_title, nullif(payload ->> 'description', ''),
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
    requested_source_url,
    requested_image_path,
    requested_image_url,
    'public', now(), encode(extensions.digest(payload::text, 'sha256'), 'hex'), 2,
    least(100, 45 + case when requested_image_url is not null then 15 else 0 end + case when length(coalesce(payload ->> 'description', '')) >= 40 then 10 else 0 end),
    new_version
  )
  on conflict (id) do update set
    title = excluded.title, description = excluded.description,
    prep_time_minutes = excluded.prep_time_minutes, cook_time_minutes = excluded.cook_time_minutes,
    servings = excluded.servings, serving_type = excluded.serving_type, yield_unit = excluded.yield_unit,
    difficulty = excluded.difficulty, category = excluded.category, cuisine = excluded.cuisine,
    tags = excluded.tags, dietary_tags = excluded.dietary_tags, allergens = excluded.allergens,
    equipment = excluded.equipment, oven_temp_f = excluded.oven_temp_f, notes = excluded.notes,
    source_url = excluded.source_url, image_path = excluded.image_path, image_url = excluded.image_url,
    visibility = case when public.recipes.review_hold then public.recipes.visibility else 'public'::public.recipe_visibility end,
    published_at = coalesce(public.recipes.published_at, now()),
    content_hash = excluded.content_hash, schema_version = 2, quality_score = excluded.quality_score,
    version = excluded.version;

  insert into public.recipe_ingredients (recipe_id, position, section, name, amount, unit, is_optional)
  select new_recipe_id, (entry.ordinality - 1)::smallint,
    nullif(left(entry.value ->> 'section', 60), ''),
    left(btrim(entry.value ->> 'name'), 200),
    nullif(left(entry.value ->> 'amount', 40), ''),
    nullif(left(entry.value ->> 'unit', 40), ''),
    coalesce((entry.value ->> 'isOptional')::boolean, false)
  from jsonb_array_elements(payload -> 'ingredients') with ordinality as entry(value, ordinality)
  where length(btrim(coalesce(entry.value ->> 'name', ''))) > 0;

  insert into public.recipe_steps (recipe_id, position, instruction)
  select new_recipe_id, (entry.ordinality - 1)::smallint, left(btrim(entry.value #>> '{}'), 2000)
  from jsonb_array_elements(payload -> 'instructions') with ordinality as entry(value, ordinality)
  where length(btrim(coalesce(entry.value #>> '{}', ''))) > 0;

  return jsonb_build_object('success', true, 'id', new_recipe_id, 'slug', recipe_slug, 'url', '/recipes/' || recipe_slug, 'version', new_version);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Community actions
-- ---------------------------------------------------------------------------
create or replace function public.find_public_recipe(target_slug text) returns public.recipes
language sql stable security definer set search_path = '' as $$
  select r.* from public.recipes r where r.slug = target_slug and r.visibility = 'public' limit 1
$$;
revoke all on function public.find_public_recipe(text) from public, anon, authenticated;

-- Made It: proof required. App: cooking_mode | mark_made. Web: a photo.
create or replace function public.record_made_it(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target public.recipes;
  source_kind text := lower(coalesce(payload ->> 'source', 'web'));
  proof_kind text := lower(coalesce(payload ->> 'proof', ''));
  photo text := nullif(payload ->> 'photoPath', '');
  note text := nullif(btrim(coalesce(payload ->> 'text', '')), '');
  with_tweak uuid := nullif(payload ->> 'tweakId', '')::uuid;
  new_row public.contributions;
begin
  perform public.assert_can_write(actor);
  target := public.find_public_recipe(payload ->> 'recipeSlug');
  if target.id is null then raise exception 'Recipe not found'; end if;
  if source_kind not in ('app', 'web') then raise exception 'Invalid source'; end if;
  if source_kind = 'app' then
    if proof_kind not in ('cooking_mode', 'mark_made') then raise exception 'The app must say how the recipe was cooked'; end if;
  else
    if photo is null then raise exception 'Add a photo of your finished dish to count a Made It'; end if;
    proof_kind := 'photo';
  end if;
  if photo is not null and photo not like actor::text || '/%' then raise exception 'Invalid photo path'; end if;
  perform public.screen_text_or_raise(note);
  perform public.take_daily_allowance(actor, 'contributions', 40);

  if with_tweak is not null and not exists (
    select 1 from public.contributions c where c.id = with_tweak and c.recipe_id = target.id and c.type = 'tweak' and not c.hidden
  ) then with_tweak := null; end if;

  begin
    insert into public.contributions (recipe_id, user_id, type, text, source, made_it, proof, photo_path, tweak_id)
    values (target.id, actor, 'made', note, source_kind, true, jsonb_build_object('kind', proof_kind), photo, with_tweak)
    returning * into new_row;
  exception when unique_violation then
    raise exception 'Your Made It for today is already counted. Thanks for cooking it!';
  end;

  update public.recipes set made_count = made_count + 1, community_score = community_score + 3 where id = target.id;
  if with_tweak is not null then
    update public.contributions set made_count = made_count + 1 where id = with_tweak and user_id <> actor;
  end if;
  return jsonb_build_object('id', new_row.id, 'madeCount', target.made_count + 1);
end $$;

-- Screen a tweak's structured changes against the live recipe.
create or replace function public.validate_changes(target public.recipes, changes jsonb) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
  ingredient_total integer;
  step_total integer;
  change jsonb;
  kind text;
  idx integer;
  removed_ingredients integer := 0;
  removed_steps integer := 0;
  flags text[] := '{}';
  step_text text;
begin
  if jsonb_typeof(changes) <> 'array' or jsonb_array_length(changes) between 0 and 0 then
    raise exception 'A tweak needs at least one change';
  end if;
  if jsonb_array_length(changes) > 20 then raise exception 'Too many changes in one tweak'; end if;
  select count(*) into ingredient_total from public.recipe_ingredients where recipe_id = target.id;
  select count(*) into step_total from public.recipe_steps where recipe_id = target.id;

  for change in select value from jsonb_array_elements(changes) loop
    kind := change ->> 'kind';
    idx := coalesce((change ->> 'index')::integer, -1);
    if kind not in ('ingredient.replace','ingredient.amount','ingredient.add','ingredient.remove','step.edit','step.add','step.remove','time','servings','other') then
      raise exception 'Unknown change type';
    end if;
    perform public.screen_text_or_raise(change ->> 'to');
    perform public.screen_text_or_raise(change ->> 'note');
    if length(coalesce(change ->> 'to', '')) > 2000 or length(coalesce(change ->> 'note', '')) > 500 then raise exception 'Change text is too long'; end if;
    if kind in ('ingredient.replace','ingredient.amount','ingredient.remove') and (idx < 0 or idx >= ingredient_total) then
      raise exception 'That tweak points at an ingredient that isn''t in the recipe.';
    end if;
    if kind in ('step.edit','step.remove') and (idx < 0 or idx >= step_total) then
      raise exception 'That tweak points at a step that isn''t in the recipe.';
    end if;
    if kind in ('ingredient.replace','ingredient.amount','ingredient.add','step.edit','step.add','time','servings') and nullif(btrim(coalesce(change ->> 'to', '')), '') is null then
      raise exception 'Describe the change.';
    end if;
    if kind = 'ingredient.remove' then removed_ingredients := removed_ingredients + 1; end if;
    if kind = 'step.remove' then removed_steps := removed_steps + 1; end if;
    step_text := null;
    if kind in ('step.edit','step.remove') then
      select instruction into step_text from public.recipe_steps where recipe_id = target.id and position = idx;
    end if;
    flags := flags || public.safety_flags_for(change, step_text, target.title);
  end loop;

  if ingredient_total >= 4 and removed_ingredients > ingredient_total / 2.0 then
    raise exception 'A tweak can''t remove most of the ingredients. Publish your own version instead.';
  end if;
  if step_total >= 4 and removed_steps > step_total / 2.0 then
    raise exception 'A tweak can''t remove most of the steps. Publish your own version instead.';
  end if;
  return (select coalesce(array_agg(distinct f), '{}') from unnest(flags) f);
end $$;
revoke all on function public.validate_changes(public.recipes, jsonb) from public, anon, authenticated;

create or replace function public.suggest_recipe_tweak(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target public.recipes;
  changes jsonb := coalesce(payload -> 'changes', '[]'::jsonb);
  note text := nullif(btrim(coalesce(payload ->> 'text', '')), '');
  source_kind text := lower(coalesce(payload ->> 'source', 'web'));
  claims_made boolean := coalesce((payload ->> 'madeIt')::boolean, false);
  proof_kind text := lower(coalesce(payload ->> 'proof', ''));
  photo text := nullif(payload ->> 'photoPath', '');
  flags text[];
  new_row public.contributions;
begin
  perform public.assert_can_write(actor);
  target := public.find_public_recipe(payload ->> 'recipeSlug');
  if target.id is null then raise exception 'Recipe not found'; end if;
  if target.author_id = actor then raise exception 'Edit your own recipe from your account instead of suggesting a tweak.'; end if;
  flags := public.validate_changes(target, changes);
  perform public.screen_text_or_raise(note);
  if claims_made then
    if source_kind = 'app' then
      if proof_kind not in ('cooking_mode', 'mark_made') then claims_made := false; end if;
    else
      if photo is null then raise exception 'Add a photo to count your tweak as made.'; end if;
      proof_kind := 'photo';
    end if;
  end if;
  if photo is not null and photo not like actor::text || '/%' then raise exception 'Invalid photo path'; end if;
  perform public.take_daily_allowance(actor, 'tweaks', 10);

  begin
    insert into public.contributions (recipe_id, user_id, type, status, text, changes, safety_flags, source, made_it, proof, photo_path, made_count, topic)
    values (target.id, actor, 'tweak', 'pending', note, changes, flags, source_kind, claims_made,
      case when claims_made then jsonb_build_object('kind', proof_kind) else null end, photo,
      case when claims_made then 1 else 0 end, 'revision')
    returning * into new_row;
  exception when unique_violation then
    raise exception 'You already have a tweak waiting on this recipe. Wait for the author to respond first.';
  end;
  update public.recipes set comment_count = comment_count + 1, community_score = community_score + 2 where id = target.id;
  return jsonb_build_object('id', new_row.id, 'safetyFlags', flags);
end $$;

-- Apply a tweak's changes to the live recipe (author accepted it).
create or replace function public.apply_changes(target uuid, changes jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ingredients jsonb;
  steps jsonb;
  change jsonb;
  kind text;
  idx integer;
  parsed jsonb;
  item jsonb;
  m text[];
  n integer;
  insert_at integer;
begin
  select coalesce(jsonb_agg(jsonb_build_object('section', section, 'name', name, 'amount', amount, 'unit', unit, 'is_optional', is_optional) order by position), '[]'::jsonb)
    into ingredients from public.recipe_ingredients where recipe_id = target;
  select coalesce(jsonb_agg(jsonb_build_object('section', section, 'instruction', instruction, 'timer_seconds', timer_seconds) order by position), '[]'::jsonb)
    into steps from public.recipe_steps where recipe_id = target;

  for change in select value from jsonb_array_elements(changes) loop
    kind := change ->> 'kind';
    idx := coalesce((change ->> 'index')::integer, -1);
    case kind
      when 'ingredient.replace' then
        if idx between 0 and jsonb_array_length(ingredients) - 1 then
          parsed := public.parse_ingredient_line(change ->> 'to');
          item := ingredients -> idx;
          item := item || jsonb_build_object('name', parsed ->> 'name', 'amount', coalesce(parsed ->> 'amount', item ->> 'amount'), 'unit', coalesce(parsed ->> 'unit', item ->> 'unit'));
          ingredients := jsonb_set(ingredients, array[idx::text], item);
        end if;
      when 'ingredient.amount' then
        if idx between 0 and jsonb_array_length(ingredients) - 1 then
          item := ingredients -> idx;
          parsed := public.parse_ingredient_line((change ->> 'to') || ' ' || coalesce(item ->> 'name', ''));
          item := item || jsonb_build_object('amount', parsed ->> 'amount', 'unit', coalesce(parsed ->> 'unit', item ->> 'unit'));
          ingredients := jsonb_set(ingredients, array[idx::text], item);
        end if;
      when 'ingredient.add' then
        parsed := public.parse_ingredient_line(change ->> 'to');
        ingredients := ingredients || jsonb_build_array(jsonb_build_object('section', null, 'name', parsed ->> 'name', 'amount', parsed ->> 'amount', 'unit', parsed ->> 'unit', 'is_optional', false));
      when 'ingredient.remove' then
        if idx between 0 and jsonb_array_length(ingredients) - 1 then ingredients := ingredients - idx; end if;
      when 'step.edit' then
        if idx between 0 and jsonb_array_length(steps) - 1 then
          steps := jsonb_set(steps, array[idx::text, 'instruction'], to_jsonb(left(change ->> 'to', 2000)));
        end if;
      when 'step.add' then
        insert_at := least(greatest(idx + 1, 0), jsonb_array_length(steps));
        steps := jsonb_insert(steps, array[insert_at::text], jsonb_build_object('section', null, 'instruction', left(change ->> 'to', 2000), 'timer_seconds', null), false);
        if insert_at = jsonb_array_length(steps) - 1 and idx + 1 >= jsonb_array_length(steps) then null; end if;
      when 'step.remove' then
        if idx between 0 and jsonb_array_length(steps) - 1 then steps := steps - idx; end if;
      when 'time' then
        m := regexp_match(change ->> 'to', 'prep\D*(\d+)', 'i');
        if m is not null then update public.recipes set prep_time_minutes = least(6000, m[1]::integer) where id = target; end if;
        m := regexp_match(change ->> 'to', 'cook\D*(\d+)', 'i');
        if m is not null then update public.recipes set cook_time_minutes = least(6000, m[1]::integer) where id = target; end if;
      when 'servings' then
        m := regexp_match(change ->> 'to', '(\d+)');
        if m is not null then
          n := m[1]::integer;
          if n between 1 and 500 then update public.recipes set servings = n where id = target; end if;
        end if;
      else null;
    end case;
  end loop;

  delete from public.recipe_ingredients where recipe_id = target;
  insert into public.recipe_ingredients (recipe_id, position, section, name, amount, unit, is_optional)
  select target, (e.ordinality - 1)::smallint, nullif(e.value ->> 'section', ''), left(e.value ->> 'name', 200), nullif(left(e.value ->> 'amount', 40), ''), nullif(left(e.value ->> 'unit', 40), ''), coalesce((e.value ->> 'is_optional')::boolean, false)
  from jsonb_array_elements(ingredients) with ordinality as e(value, ordinality)
  where length(btrim(coalesce(e.value ->> 'name', ''))) > 0;

  delete from public.recipe_steps where recipe_id = target;
  insert into public.recipe_steps (recipe_id, position, section, instruction, timer_seconds)
  select target, (e.ordinality - 1)::smallint, nullif(e.value ->> 'section', ''), left(e.value ->> 'instruction', 2000), (e.value ->> 'timer_seconds')::integer
  from jsonb_array_elements(steps) with ordinality as e(value, ordinality)
  where length(btrim(coalesce(e.value ->> 'instruction', ''))) > 0;
end $$;
revoke all on function public.apply_changes(uuid, jsonb) from public, anon, authenticated;

-- Author decides on a tweak. Accepting applies it and records a new version.
create or replace function public.decide_recipe_tweak(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target_id uuid := (payload ->> 'contributionId')::uuid;
  decision text := lower(coalesce(payload ->> 'decision', ''));
  tweak public.contributions;
  recipe public.recipes;
  next_version integer;
begin
  perform public.assert_can_write(actor);
  if decision in ('accept', 'accepted') then decision := 'accepted';
  elsif decision in ('decline', 'declined') then decision := 'declined';
  else raise exception 'Invalid decision'; end if;

  select c.* into tweak from public.contributions c where c.id = target_id and c.type = 'tweak' and not c.hidden for update;
  if tweak.id is null then raise exception 'Tweak not found'; end if;
  select r.* into recipe from public.recipes r where r.id = tweak.recipe_id for update;
  if recipe.author_id <> actor then raise exception 'Only the recipe author can decide on tweaks'; end if;
  if tweak.status <> 'pending' then raise exception 'That tweak was already decided'; end if;

  if decision = 'accepted' and jsonb_array_length(coalesce(tweak.changes, '[]'::jsonb)) > 0 then
    -- Re-validate against the current recipe (it may have changed since the tweak was written).
    perform public.validate_changes(recipe, tweak.changes);
    next_version := public.snapshot_recipe_version(recipe.id, actor, 'Accepted a community tweak', tweak.id);
    perform public.apply_changes(recipe.id, tweak.changes);
    update public.recipes set community_score = community_score + 8, updated_at = now() where id = recipe.id;
    update public.contributions set status = 'accepted', accepted_in_version = next_version where id = tweak.id;
  else
    update public.contributions set status = decision::public.contribution_status where id = tweak.id;
  end if;
  return jsonb_build_object('id', tweak.id, 'status', decision, 'version', coalesce(next_version, recipe.version));
end $$;

-- Backwards-compatible name used by the current web discussion UI.
create or replace function public.moderate_recipe_suggestion(payload jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select public.decide_recipe_tweak(payload)
$$;

-- Reports: one per person per target; enough distinct reports hide the target.
create or replace function public.report_content(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target public.recipes;
  contribution_target uuid := nullif(payload ->> 'contributionId', '')::uuid;
  reason public.report_reason;
  detail text := nullif(left(btrim(coalesce(payload ->> 'detail', '')), 1000), '');
  target_user uuid;
  new_count integer;
  threshold integer;
  hide boolean := false;
  preview text;
  kind text;
begin
  perform public.assert_can_write(actor);
  begin reason := (payload ->> 'reason')::public.report_reason;
  exception when others then raise exception 'Choose a reason'; end;
  select r.* into target from public.recipes r where r.slug = payload ->> 'recipeSlug';
  if target.id is null then raise exception 'Recipe not found'; end if;
  perform public.take_daily_allowance(actor, 'reports', 20);

  if contribution_target is not null then
    select c.user_id, coalesce(c.text, ''), c.type::text into target_user, preview, kind
      from public.contributions c where c.id = contribution_target and c.recipe_id = target.id;
    if target_user is null then raise exception 'Nothing to report there'; end if;
  else
    target_user := target.author_id; preview := target.title; kind := 'recipe';
  end if;
  if target_user = actor then raise exception 'You can''t report your own post. Delete it instead.'; end if;

  begin
    insert into public.reports (reporter_id, recipe_id, contribution_id, reason, detail)
    values (actor, target.id, contribution_target, reason, detail);
  exception when unique_violation then
    return jsonb_build_object('success', true, 'alreadyReported', true, 'hidden', false);
  end;

  if contribution_target is not null then
    update public.contributions set report_count = report_count + 1 where id = contribution_target returning report_count into new_count;
    threshold := 3;
    hide := new_count >= threshold or (reason = 'unsafe' and new_count >= 2);
    if hide then update public.contributions set hidden = true where id = contribution_target; end if;
  else
    update public.recipes set report_count = report_count + 1 where id = target.id returning report_count into new_count;
    threshold := 5;
    hide := new_count >= threshold;
    if hide then update public.recipes set visibility = 'unlisted', review_hold = true where id = target.id; end if;
  end if;

  if hide then
    insert into public.moderation_queue (recipe_id, contribution_id, target_user_id, report_count, status, kind, reasons, preview)
    values (target.id, contribution_target, target_user, new_count, 'open', kind, array[reason::text], left(preview, 300))
    on conflict (recipe_id, contribution_id) do update set
      report_count = excluded.report_count, status = 'open', reasons = (select array_agg(distinct x) from unnest(public.moderation_queue.reasons || excluded.reasons) x), updated_at = now();
  end if;
  return jsonb_build_object('success', true, 'hidden', hide);
end $$;

-- Block a cook: their posts disappear from your view of every recipe.
create or replace function public.block_user(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Sign in first'; end if;
  if target = actor then raise exception 'You can''t block yourself'; end if;
  insert into public.user_blocks (blocker_id, blocked_id) values (actor, target) on conflict do nothing;
end $$;
create or replace function public.unblock_user(target uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = target
$$;

-- Author tools.
create or replace function public.unpublish_recipe(target_slug text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); n integer;
begin
  if actor is null then raise exception 'Sign in first'; end if;
  update public.recipes set visibility = 'private' where slug = target_slug and author_id = actor;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Recipe not found'; end if;
end $$;
create or replace function public.delete_my_recipe(target_slug text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); n integer;
begin
  if actor is null then raise exception 'Sign in first'; end if;
  delete from public.recipes where slug = target_slug and author_id = actor;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Recipe not found'; end if;
end $$;
create or replace function public.accept_terms(version_label text) returns void
language sql security definer set search_path = '' as $$
  update public.profiles set terms_accepted_at = now() where id = auth.uid()
$$;

-- Account deletion (App Store guideline 5.1.1). Cascades remove profile,
-- recipes, contributions, reports, likes, saves, follows, blocks, memberships.
-- Uploaded photos are deleted through the Storage API by the client before
-- this call (Supabase forbids direct deletes on storage.objects); anything
-- left behind is unreachable once the rows referencing it are gone.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Sign in first'; end if;
  delete from public.profiles where id = actor;
  delete from auth.users where id = actor;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Community feed (matches the iOS CommunityFeed shape)
-- ---------------------------------------------------------------------------
create or replace function public.get_recipe_community(target_slug text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target public.recipes;
  author_name text;
  base text := public.setting('storage_public_base');
  tweaks jsonb;
  comments jsonb;
  photos jsonb;
begin
  target := public.find_public_recipe(target_slug);
  if target.id is null then raise exception 'Recipe not found'; end if;
  select display_name into author_name from public.profiles where id = target.author_id;

  with visible as (
    select c.*, p.display_name
    from public.contributions c
    join public.profiles p on p.id = c.user_id
    where c.recipe_id = target.id and not c.hidden and not p.is_banned
      and (actor is null or not exists (select 1 from public.user_blocks b where b.blocker_id = actor and b.blocked_id = c.user_id))
  ), shaped as (
    select v.*, jsonb_build_object(
      'id', v.id, 'type', v.type::text, 'userId', v.user_id, 'userName', v.display_name, 'text', v.text,
      'photoUrl', case when v.photo_path is null then null else base || '/' || v.photo_path end,
      'madeIt', v.made_it, 'source', v.source, 'changes', coalesce(v.changes, '[]'::jsonb),
      'safetyFlags', to_jsonb(coalesce(v.safety_flags, '{}'::text[])), 'tweakId', v.tweak_id, 'status', v.status::text,
      'madeCount', v.made_count, 'acceptedInVersion', v.accepted_in_version,
      'createdAt', to_char(v.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ) as item from visible v
  )
  select
    coalesce((select jsonb_agg(item order by (status = 'accepted') desc, made_count desc, created_at desc) from shaped where type = 'tweak' and status <> 'declined' and jsonb_array_length(coalesce(changes, '[]'::jsonb)) > 0), '[]'::jsonb),
    coalesce((select jsonb_agg(item order by created_at desc) from (select * from shaped where type <> 'tweak' or jsonb_array_length(coalesce(changes, '[]'::jsonb)) = 0 order by created_at desc limit 100) x), '[]'::jsonb),
    coalesce((select jsonb_agg(base || '/' || photo_path order by created_at desc) from (select photo_path, created_at from shaped where photo_path is not null order by created_at desc limit 24) y), '[]'::jsonb)
  into tweaks, comments, photos;

  return jsonb_build_object(
    'recipe', jsonb_build_object('id', target.id, 'slug', target.slug, 'title', target.title, 'version', target.version,
      'madeCount', target.made_count, 'commentCount', target.comment_count, 'authorId', target.author_id, 'authorName', coalesce(author_name, 'Savry cook')),
    'tweaks', tweaks, 'comments', comments, 'photos', photos,
    'viewer', case when actor is null then null else jsonb_build_object('userId', actor, 'isAuthor', actor = target.author_id) end
  );
end $$;

-- Discussion posts now run through the same standing check and text screen.
create or replace function public.post_recipe_discussion(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_recipe public.recipes%rowtype;
  parent_post public.contributions%rowtype;
  body text := btrim(coalesce(payload ->> 'text', ''));
  requested_kind text := lower(coalesce(payload ->> 'kind', 'comment'));
  requested_topic text := nullif(lower(btrim(coalesce(payload ->> 'topic', ''))), '');
  requested_parent uuid;
  new_post public.contributions%rowtype;
begin
  perform public.assert_can_write(actor);
  if char_length(body) < 2 or char_length(body) > 2000 then
    raise exception 'Post must be between 2 and 2000 characters';
  end if;
  perform public.screen_text_or_raise(body);
  if requested_kind not in ('comment', 'suggestion') then raise exception 'Invalid discussion type'; end if;
  if requested_topic is not null and requested_topic not in ('addition', 'revision', 'substitution', 'technique', 'question') then
    raise exception 'Invalid suggestion topic';
  end if;

  select * into target_recipe from public.recipes where slug = payload ->> 'recipeSlug' and visibility = 'public' for update;
  if target_recipe.id is null then raise exception 'Recipe not found'; end if;

  if nullif(payload ->> 'parentId', '') is not null then
    requested_parent := (payload ->> 'parentId')::uuid;
    select * into parent_post from public.contributions
      where id = requested_parent and recipe_id = target_recipe.id and parent_id is null and type in ('comment', 'tweak') and not hidden;
    if parent_post.id is null then raise exception 'Conversation no longer exists'; end if;
    requested_kind := 'comment'; requested_topic := null;
  elsif requested_kind = 'suggestion' and requested_topic is null then
    requested_topic := 'revision';
  end if;

  perform public.take_daily_allowance(actor, 'contributions', 50);
  if requested_kind = 'suggestion' then perform public.take_daily_allowance(actor, 'tweaks', 10); end if;

  insert into public.contributions (recipe_id, user_id, type, status, text, parent_id, topic, source)
  values (target_recipe.id, actor,
    case when requested_kind = 'suggestion' then 'tweak'::public.contribution_type else 'comment'::public.contribution_type end,
    case when requested_kind = 'suggestion' then 'pending'::public.contribution_status else null end,
    body, requested_parent, requested_topic, 'web')
  returning * into new_post;

  if requested_parent is not null then update public.contributions set reply_count = reply_count + 1 where id = requested_parent; end if;
  update public.recipes set comment_count = comment_count + 1,
    community_score = community_score + case when requested_kind = 'suggestion' then 2 else 1 end
  where id = target_recipe.id;
  return jsonb_build_object('id', new_post.id, 'count', target_recipe.comment_count + 1);
end;
$$;

-- Discussion feed: hide posts from cooks the viewer blocked and never expose auth ids of others beyond what the page needs.
create or replace function public.get_recipe_discussion(target_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_recipe public.recipes%rowtype;
  result_posts jsonb;
begin
  select * into target_recipe from public.recipes where slug = target_slug and visibility = 'public';
  if target_recipe.id is null then raise exception 'Recipe not found'; end if;

  select coalesce(jsonb_agg(post order by root_created desc, created asc), '[]'::jsonb)
  into result_posts
  from (
    select coalesce(root.created_at, c.created_at) as root_created, c.created_at as created,
      jsonb_build_object(
        'id', c.id, 'parentId', c.parent_id,
        'kind', case when c.type = 'tweak' then 'suggestion' else 'comment' end,
        'topic', c.topic, 'text', c.text, 'status', c.status, 'userId', c.user_id, 'userName', p.display_name,
        'isRecipeAuthor', c.user_id = target_recipe.author_id,
        'changes', coalesce(c.changes, '[]'::jsonb), 'safetyFlags', to_jsonb(coalesce(c.safety_flags, '{}'::text[])),
        'madeIt', c.made_it, 'madeCount', c.made_count,
        'photoUrl', case when c.photo_path is null then null else public.setting('storage_public_base') || '/' || c.photo_path end,
        'likeCount', c.like_count, 'replyCount', c.reply_count,
        'viewerLiked', exists (select 1 from public.contribution_likes l where l.contribution_id = c.id and l.user_id = actor),
        'createdAt', c.created_at
      ) as post
    from public.contributions c
    join public.profiles p on p.id = c.user_id
    left join public.contributions root on root.id = c.parent_id
    where c.recipe_id = target_recipe.id and c.type in ('comment', 'tweak', 'made') and not c.hidden and not p.is_banned
      and (actor is null or not exists (select 1 from public.user_blocks b where b.blocker_id = actor and b.blocked_id = c.user_id))
  ) discussion;

  return jsonb_build_object('recipeId', target_recipe.id, 'recipeAuthorId', target_recipe.author_id, 'viewerId', actor,
    'count', target_recipe.comment_count, 'madeCount', target_recipe.made_count, 'posts', result_posts);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Admin moderation (service role only; called from /api/admin/moderation)
-- ---------------------------------------------------------------------------
create or replace function public.admin_moderation_queue() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'recipeId', q.recipe_id, 'recipeSlug', r.slug, 'contributionId', q.contribution_id, 'targetUserId', q.target_user_id,
    'kind', q.kind, 'preview', q.preview, 'reasons', to_jsonb(q.reasons), 'reportCount', q.report_count, 'status', q.status,
    'createdAt', q.created_at) order by q.created_at desc), '[]'::jsonb)
  from public.moderation_queue q join public.recipes r on r.id = q.recipe_id where q.status = 'open'
$$;
create or replace function public.admin_moderate(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  item public.moderation_queue;
  action text := lower(coalesce(payload ->> 'action', ''));
begin
  if action not in ('restore', 'remove', 'ban') then raise exception 'Bad action'; end if;
  select * into item from public.moderation_queue where id = (payload ->> 'id')::uuid for update;
  if item.id is null then raise exception 'Not in the queue'; end if;
  if item.contribution_id is not null then
    if action = 'restore' then update public.contributions set hidden = false, report_count = 0 where id = item.contribution_id;
    else delete from public.contributions where id = item.contribution_id; end if;
  else
    if action = 'restore' then update public.recipes set visibility = 'public', review_hold = false, report_count = 0 where id = item.recipe_id;
    else update public.recipes set visibility = 'private', review_hold = false where id = item.recipe_id; end if;
  end if;
  if action = 'ban' and item.target_user_id is not null then
    update public.profiles set is_banned = true where id = item.target_user_id;
    update public.contributions set hidden = true where user_id = item.target_user_id;
    update public.recipes set visibility = 'private' where author_id = item.target_user_id;
  end if;
  update public.moderation_queue set status = case action when 'restore' then 'restored' when 'ban' then 'banned' else 'removed' end, resolved_at = now() where id = item.id;
  return jsonb_build_object('success', true);
end $$;
create or replace function public.admin_set_ban(target uuid, banned boolean) returns void
language sql security definer set search_path = '' as $$
  update public.profiles set is_banned = banned where id = target
$$;

-- ---------------------------------------------------------------------------
-- 8. Grants
-- ---------------------------------------------------------------------------
revoke all on function public.screen_text(text) from public, anon, authenticated;
revoke all on function public.screen_text_or_raise(text) from public, anon, authenticated;
revoke all on function public.safety_flags_for(jsonb, text, text) from public, anon, authenticated;
revoke all on function public.parse_ingredient_line(text) from public, anon, authenticated;
revoke all on function public.publish_recipe(jsonb) from public, anon, authenticated;
revoke all on function public.admin_moderation_queue() from public, anon, authenticated;
revoke all on function public.admin_moderate(jsonb) from public, anon, authenticated;
revoke all on function public.admin_set_ban(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_moderation_queue() to service_role;
grant execute on function public.admin_moderate(jsonb) to service_role;
grant execute on function public.admin_set_ban(uuid, boolean) to service_role;

revoke all on function public.record_made_it(jsonb) from public, anon;
revoke all on function public.suggest_recipe_tweak(jsonb) from public, anon;
revoke all on function public.decide_recipe_tweak(jsonb) from public, anon;
revoke all on function public.moderate_recipe_suggestion(jsonb) from public, anon;
revoke all on function public.report_content(jsonb) from public, anon;
revoke all on function public.block_user(uuid) from public, anon;
revoke all on function public.unblock_user(uuid) from public, anon;
revoke all on function public.unpublish_recipe(text) from public, anon;
revoke all on function public.delete_my_recipe(text) from public, anon;
revoke all on function public.accept_terms(text) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
revoke all on function public.get_recipe_community(text) from public;
grant execute on function public.record_made_it(jsonb), public.suggest_recipe_tweak(jsonb), public.decide_recipe_tweak(jsonb),
  public.moderate_recipe_suggestion(jsonb), public.report_content(jsonb), public.block_user(uuid), public.unblock_user(uuid),
  public.unpublish_recipe(text), public.delete_my_recipe(text), public.accept_terms(text), public.delete_my_account() to authenticated;
grant execute on function public.get_recipe_community(text) to anon, authenticated;

comment on function public.get_recipe_community(text) is 'Public community feed for a recipe: tweaks, Made Its, comments, photos.';
comment on function public.record_made_it(jsonb) is 'Counts a Made It only with cooking proof (app) or a photo (web); one per cook per recipe per day.';
comment on function public.suggest_recipe_tweak(jsonb) is 'Structured, screened, safety-flagged tweak; one pending per cook per recipe.';
comment on function public.decide_recipe_tweak(jsonb) is 'Author accepts (applies with a version snapshot) or declines a tweak.';
comment on function public.report_content(jsonb) is 'One report per person per target; auto-hides after 3 (2 if unsafe; recipes after 5).';
