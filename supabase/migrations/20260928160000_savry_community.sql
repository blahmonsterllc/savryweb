-- Savry community database. Private iOS recipes remain in Core Data +
-- CloudKit until the user explicitly publishes or saves community content.
create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_trgm;

create type public.recipe_visibility as enum ('private', 'unlisted', 'public');
create type public.recipe_serving_type as enum ('servings', 'yields');
create type public.contribution_type as enum ('made', 'comment', 'tweak');
create type public.contribution_status as enum ('pending', 'accepted', 'declined');
create type public.report_reason as enum ('spam', 'abusive', 'unsafe', 'not_a_recipe', 'copied', 'other');
create type public.nutrition_source as enum ('usda_food_data_central', 'package_label', 'on_device_estimate', 'local_reference', 'imported');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext unique,
  display_name text not null default 'Savry cook',
  avatar_path text,
  bio text check (char_length(bio) <= 500),
  tier text not null default 'free' check (tier in ('free', 'plus', 'pro')),
  is_banned boolean not null default false,
  email_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  client_recipe_id text,
  slug citext not null unique,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 2000),
  prep_time_minutes integer not null default 0 check (prep_time_minutes between 0 and 6000),
  cook_time_minutes integer not null default 0 check (cook_time_minutes between 0 and 6000),
  servings integer not null default 1 check (servings between 1 and 500),
  serving_type public.recipe_serving_type not null default 'servings',
  yield_unit text check (char_length(yield_unit) <= 40),
  difficulty text not null default 'Medium' check (char_length(difficulty) <= 20),
  category text not null default 'Other' check (char_length(category) <= 40),
  cuisine text check (char_length(cuisine) <= 60),
  tags text[] not null default '{}',
  dietary_tags text[] not null default '{}',
  allergens text[] not null default '{}',
  equipment text[] not null default '{}',
  oven_temp_f integer check (oven_temp_f between 100 and 700),
  notes text check (char_length(notes) <= 2000),
  source_url text,
  image_path text,
  image_url text,
  visibility public.recipe_visibility not null default 'private',
  published_at timestamptz,
  version integer not null default 1 check (version > 0),
  content_hash text not null,
  schema_version integer not null default 1,
  quality_score smallint not null default 0 check (quality_score between 0 and 100),
  community_score integer not null default 0,
  view_count bigint not null default 0 check (view_count >= 0),
  made_count bigint not null default 0 check (made_count >= 0),
  comment_count bigint not null default 0 check (comment_count >= 0),
  save_count bigint not null default 0 check (save_count >= 0),
  nutrition_per_serving jsonb,
  nutrition_source public.nutrition_source,
  nutrition_coverage numeric(5,4) check (nutrition_coverage between 0 and 1),
  search_document tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, client_recipe_id)
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(), recipe_id uuid not null references public.recipes(id) on delete cascade,
  position smallint not null check (position >= 0), section text check (char_length(section) <= 60),
  name text not null check (char_length(name) between 1 and 200), amount text check (char_length(amount) <= 40),
  unit text check (char_length(unit) <= 40), is_optional boolean not null default false,
  normalized_food_id text, gram_weight numeric(10,3) check (gram_weight >= 0), created_at timestamptz not null default now(),
  unique (recipe_id, position)
);

create table public.recipe_steps (
  id uuid primary key default gen_random_uuid(), recipe_id uuid not null references public.recipes(id) on delete cascade,
  position smallint not null check (position >= 0), section text check (char_length(section) <= 60),
  instruction text not null check (char_length(instruction) between 1 and 2000),
  timer_seconds integer check (timer_seconds >= 0), created_at timestamptz not null default now(),
  unique (recipe_id, position)
);

create table public.recipe_versions (
  id uuid primary key default gen_random_uuid(), recipe_id uuid not null references public.recipes(id) on delete cascade,
  version integer not null check (version > 0), snapshot jsonb not null, change_summary text,
  created_by uuid references public.profiles(id) on delete set null, contribution_id uuid,
  created_at timestamptz not null default now(), unique (recipe_id, version)
);

create table public.contributions (
  id uuid primary key default gen_random_uuid(), recipe_id uuid not null references public.recipes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, type public.contribution_type not null,
  status public.contribution_status, text text check (char_length(text) <= 2000), changes jsonb not null default '[]'::jsonb,
  proof jsonb, photo_path text, safety_flags text[] not null default '{}', made_count integer not null default 0,
  accepted_in_version integer, hidden boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((type = 'tweak' and status is not null) or (type <> 'tweak' and status is null))
);
alter table public.recipe_versions add constraint recipe_versions_contribution_fkey
  foreign key (contribution_id) references public.contributions(id) on delete set null;

create table public.recipe_saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (user_id, recipe_id)
);
create table public.profile_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (follower_id, followed_id), check (follower_id <> followed_id)
);
create table public.reports (
  id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  contribution_id uuid references public.contributions(id) on delete cascade,
  reason public.report_reason not null, detail text check (char_length(detail) <= 1000), created_at timestamptz not null default now(),
  unique nulls not distinct (reporter_id, recipe_id, contribution_id)
);
create table public.moderation_queue (
  id uuid primary key default gen_random_uuid(), recipe_id uuid not null references public.recipes(id) on delete cascade,
  contribution_id uuid references public.contributions(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete set null, report_count integer not null default 1,
  status text not null default 'open' check (status in ('open', 'restored', 'removed', 'banned')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique nulls not distinct (recipe_id, contribution_id)
);
create table public.daily_usage (
  user_id uuid not null references public.profiles(id) on delete cascade, day date not null default current_date,
  publishes integer not null default 0, contributions integer not null default 0,
  tweaks integer not null default 0, reports integer not null default 0,
  updated_at timestamptz not null default now(), primary key (user_id, day)
);

create index recipes_public_newest_idx on public.recipes (published_at desc) where visibility = 'public';
create index recipes_public_score_idx on public.recipes (community_score desc, published_at desc) where visibility = 'public';
create index recipes_author_idx on public.recipes (author_id, created_at desc);
create index recipes_category_idx on public.recipes (lower(category), published_at desc) where visibility = 'public';
create index recipes_dietary_idx on public.recipes using gin (dietary_tags);
create index recipes_allergens_idx on public.recipes using gin (allergens);
create index recipes_search_idx on public.recipes using gin (search_document);
create index recipes_title_trgm_idx on public.recipes using gin (title gin_trgm_ops);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, position);
create index recipe_steps_recipe_idx on public.recipe_steps (recipe_id, position);
create index contributions_recipe_idx on public.contributions (recipe_id, created_at desc) where hidden = false;
create index contributions_pending_idx on public.contributions (recipe_id, status, created_at desc) where type = 'tweak';

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger recipes_touch before update on public.recipes for each row execute function public.touch_updated_at();
create trigger contributions_touch before update on public.contributions for each row execute function public.touch_updated_at();
create trigger moderation_touch before update on public.moderation_queue for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name) values (
    new.id, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(split_part(new.email, '@', 1), ''), 'Savry cook')
  ) on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.recipe_row_search_trigger() returns trigger language plpgsql set search_path = '' as $$
begin
  new.search_document =
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('simple', concat_ws(' ', new.category, new.cuisine, array_to_string(new.tags, ' '), array_to_string(new.dietary_tags, ' '))), 'B');
  return new;
end; $$;
create trigger recipe_search before insert or update of title, description, category, cuisine, tags, dietary_tags on public.recipes
for each row execute function public.recipe_row_search_trigger();

create or replace function public.refresh_recipe_search(target_recipe uuid) returns void language sql security definer set search_path = '' as $$
  update public.recipes r set search_document =
    setweight(to_tsvector('english', coalesce(r.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(r.description, '')), 'B') ||
    setweight(to_tsvector('simple', concat_ws(' ', r.category, r.cuisine, array_to_string(r.tags, ' '), array_to_string(r.dietary_tags, ' '))), 'B') ||
    setweight(to_tsvector('simple', coalesce((select string_agg(i.name, ' ') from public.recipe_ingredients i where i.recipe_id = r.id), '')), 'A')
  where r.id = target_recipe;
$$;
create or replace function public.ingredient_search_trigger() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_recipe_search(old.recipe_id); return old;
  end if;
  perform public.refresh_recipe_search(new.recipe_id); return new;
end; $$;
create trigger ingredient_search after insert or update or delete on public.recipe_ingredients
for each row execute function public.ingredient_search_trigger();

create or replace function public.search_public_recipes(search_query text, result_limit integer default 24, result_offset integer default 0)
returns table (id uuid, slug text, title text, description text, image_url text, category text, cuisine text,
  total_time_minutes integer, made_count bigint, save_count bigint, version integer, rank real)
language sql stable set search_path = '' as $$
  select r.id, r.slug::text, r.title, r.description, r.image_url, r.category, r.cuisine,
    r.prep_time_minutes + r.cook_time_minutes, r.made_count, r.save_count, r.version,
    ts_rank(r.search_document, websearch_to_tsquery('english', search_query))
  from public.recipes r where r.visibility = 'public'
    and r.search_document @@ websearch_to_tsquery('english', search_query)
  order by 12 desc, r.community_score desc, r.published_at desc
  limit least(greatest(result_limit, 1), 100) offset greatest(result_offset, 0);
$$;

alter table public.profiles enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;
alter table public.recipe_versions enable row level security;
alter table public.contributions enable row level security;
alter table public.recipe_saves enable row level security;
alter table public.profile_follows enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_queue enable row level security;
alter table public.daily_usage enable row level security;

create policy "members read profiles" on public.profiles for select to authenticated using (not is_banned or id = (select auth.uid()));
create policy "members update profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "visible recipes" on public.recipes for select to anon, authenticated using (visibility = 'public' or author_id = (select auth.uid()));
create policy "members create recipes" on public.recipes for insert to authenticated with check (author_id = (select auth.uid()));
create policy "authors update recipes" on public.recipes for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "authors delete drafts" on public.recipes for delete to authenticated using (author_id = (select auth.uid()) and visibility <> 'public');
create policy "visible ingredients" on public.recipe_ingredients for select to anon, authenticated using
  (exists (select 1 from public.recipes r where r.id = recipe_id and (r.visibility = 'public' or r.author_id = (select auth.uid()))));
create policy "authors manage ingredients" on public.recipe_ingredients for all to authenticated using
  (exists (select 1 from public.recipes r where r.id = recipe_id and r.author_id = (select auth.uid()))) with check
  (exists (select 1 from public.recipes r where r.id = recipe_id and r.author_id = (select auth.uid())));
create policy "visible steps" on public.recipe_steps for select to anon, authenticated using
  (exists (select 1 from public.recipes r where r.id = recipe_id and (r.visibility = 'public' or r.author_id = (select auth.uid()))));
create policy "authors manage steps" on public.recipe_steps for all to authenticated using
  (exists (select 1 from public.recipes r where r.id = recipe_id and r.author_id = (select auth.uid()))) with check
  (exists (select 1 from public.recipes r where r.id = recipe_id and r.author_id = (select auth.uid())));
create policy "visible history" on public.recipe_versions for select to anon, authenticated using
  (exists (select 1 from public.recipes r where r.id = recipe_id and (r.visibility = 'public' or r.author_id = (select auth.uid()))));
create policy "visible contributions" on public.contributions for select to anon, authenticated using
  ((not hidden and exists (select 1 from public.recipes r where r.id = recipe_id and r.visibility = 'public'))
    or user_id = (select auth.uid())
    or exists (select 1 from public.recipes r where r.id = recipe_id and r.author_id = (select auth.uid())));
create policy "members contribute" on public.contributions for insert to authenticated with check
  (user_id = (select auth.uid()) and exists (select 1 from public.recipes r where r.id = recipe_id and r.visibility = 'public'));
create policy "members manage saves" on public.recipe_saves for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "members manage follows" on public.profile_follows for all to authenticated using (follower_id = (select auth.uid())) with check (follower_id = (select auth.uid()));
create policy "members file reports" on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "members read reports" on public.reports for select to authenticated using (reporter_id = (select auth.uid()));
revoke all on public.moderation_queue, public.daily_usage from anon, authenticated;
grant select on public.recipes, public.recipe_ingredients, public.recipe_steps, public.recipe_versions, public.contributions to anon, authenticated;
grant select, insert, update, delete on public.recipes, public.recipe_ingredients, public.recipe_steps, public.contributions, public.recipe_saves, public.profile_follows to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert on public.reports to authenticated;
grant execute on function public.search_public_recipes(text, integer, integer) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', true, 6291456, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create policy "recipe images public" on storage.objects for select to anon, authenticated using (bucket_id = 'recipe-images');
create policy "members upload recipe images" on storage.objects for insert to authenticated with check
  (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "members update recipe images" on storage.objects for update to authenticated using
  (bucket_id = 'recipe-images' and owner_id = (select auth.uid())::text) with check
  (bucket_id = 'recipe-images' and owner_id = (select auth.uid())::text);
create policy "members delete recipe images" on storage.objects for delete to authenticated using
  (bucket_id = 'recipe-images' and owner_id = (select auth.uid())::text);

comment on table public.recipes is 'Canonical Savry community recipes; private app recipes remain in CloudKit until published.';
comment on table public.recipe_versions is 'Immutable snapshots for accepted community improvements and author-controlled reverts.';
