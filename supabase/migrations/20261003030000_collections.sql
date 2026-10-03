-- Collections: a cook's named lists of recipes ("Sunday roasts", "Kid-approved"),
-- public by default so they can be shared, private when the cook says so.
-- Saves stay what they are (one private list); collections are the social
-- layer on top. Written only through the functions below.

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null,
  title text not null check (char_length(title) between 1 and 80),
  description text check (char_length(description) <= 300),
  is_public boolean not null default true,
  item_count integer not null default 0 check (item_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);
create index if not exists collections_public_idx on public.collections (owner_id, updated_at desc) where is_public;

create table if not exists public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, recipe_id)
);
create index if not exists collection_items_recipe_idx on public.collection_items (recipe_id);

alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
revoke all on public.collections, public.collection_items from public, anon, authenticated;
grant select, insert, update, delete on public.collections, public.collection_items to service_role;

drop trigger if exists collections_touch on public.collections;
create trigger collections_touch before update on public.collections
for each row execute function public.touch_updated_at();

-- Shape used everywhere a collection is listed.
create or replace function public.collection_card(c public.collections, viewer uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'title', c.title, 'description', c.description, 'isPublic', c.is_public,
    'itemCount', c.item_count, 'updatedAt', c.updated_at,
    'ownerUsername', p.username::text, 'ownerName', p.display_name,
    'mine', (viewer is not null and c.owner_id = viewer),
    'coverUrls', coalesce((
      select jsonb_agg(r.image_url order by i.added_at desc)
      from (select * from public.collection_items i where i.collection_id = c.id order by i.added_at desc limit 4) i
      join public.recipes r on r.id = i.recipe_id and r.image_url is not null
    ), '[]'::jsonb)
  )
  from public.profiles p where p.id = c.owner_id
$$;

create or replace function public.create_collection(title text, description text default null, make_public boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  clean_title text := btrim(coalesce(title, ''));
  clean_description text := nullif(btrim(coalesce(description, '')), '');
  base_slug text;
  candidate text;
  n integer := 1;
  created public.collections%rowtype;
begin
  perform public.assert_can_write(actor);
  if char_length(clean_title) not between 1 and 80 then raise exception 'Give the collection a name (up to 80 characters)'; end if;
  if char_length(coalesce(clean_description, '')) > 300 then raise exception 'Keep the description under 300 characters'; end if;
  perform public.screen_text_or_raise(clean_title);
  if clean_description is not null then perform public.screen_text_or_raise(clean_description); end if;
  if (select count(*) from public.collections c where c.owner_id = actor) >= 50 then
    raise exception 'That is plenty of collections for now (50)';
  end if;

  base_slug := coalesce(nullif(trim(both '-' from regexp_replace(lower(extensions.unaccent(clean_title)), '[^a-z0-9]+', '-', 'g')), ''), 'collection');
  candidate := left(base_slug, 60);
  while exists (select 1 from public.collections c where c.owner_id = actor and c.slug = candidate) loop
    n := n + 1;
    candidate := left(base_slug, 56) || '-' || n;
  end loop;

  insert into public.collections (owner_id, slug, title, description, is_public)
  values (actor, candidate, clean_title, clean_description, coalesce(make_public, true))
  returning * into created;
  return public.collection_card(created, actor);
end $$;

create or replace function public.update_collection(target_slug text, payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  c public.collections%rowtype;
  new_title text;
  new_description text;
begin
  if actor is null then raise exception 'Sign in first'; end if;
  select * into c from public.collections where owner_id = actor and slug = target_slug;
  if c.id is null then raise exception 'Collection not found'; end if;
  if payload ? 'title' then
    new_title := btrim(coalesce(payload ->> 'title', ''));
    if char_length(new_title) not between 1 and 80 then raise exception 'Give the collection a name (up to 80 characters)'; end if;
    perform public.screen_text_or_raise(new_title);
    c.title := new_title;
  end if;
  if payload ? 'description' then
    new_description := nullif(btrim(coalesce(payload ->> 'description', '')), '');
    if char_length(coalesce(new_description, '')) > 300 then raise exception 'Keep the description under 300 characters'; end if;
    if new_description is not null then perform public.screen_text_or_raise(new_description); end if;
    c.description := new_description;
  end if;
  if payload ? 'isPublic' then c.is_public := coalesce((payload ->> 'isPublic')::boolean, c.is_public); end if;
  update public.collections set title = c.title, description = c.description, is_public = c.is_public where id = c.id returning * into c;
  return public.collection_card(c, actor);
end $$;

create or replace function public.delete_collection(target_slug text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Sign in first'; end if;
  delete from public.collections where owner_id = actor and slug = target_slug;
  return found;
end $$;

-- Add or remove one recipe. Any public recipe, or any of the cook's own.
create or replace function public.toggle_collection_item(collection_slug text, recipe_slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  c public.collections%rowtype;
  target public.recipes%rowtype;
  now_in boolean;
begin
  if actor is null then raise exception 'Sign in first'; end if;
  select * into c from public.collections where owner_id = actor and slug = collection_slug;
  if c.id is null then raise exception 'Collection not found'; end if;
  select * into target from public.recipes r where r.slug = recipe_slug and (r.visibility = 'public' or r.author_id = actor);
  if target.id is null then raise exception 'Recipe not found'; end if;

  if exists (select 1 from public.collection_items i where i.collection_id = c.id and i.recipe_id = target.id) then
    delete from public.collection_items where collection_id = c.id and recipe_id = target.id;
    now_in := false;
  else
    if c.item_count >= 200 then raise exception 'A collection holds up to 200 recipes'; end if;
    insert into public.collection_items (collection_id, recipe_id) values (c.id, target.id);
    now_in := true;
  end if;
  update public.collections set item_count = (select count(*) from public.collection_items i where i.collection_id = c.id) where id = c.id returning * into c;
  return jsonb_build_object('inCollection', now_in, 'itemCount', c.item_count, 'slug', c.slug);
end $$;

-- The cook's own collections; with a recipe slug, says which ones hold it.
create or replace function public.my_collections(recipe_slug text default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('collections', coalesce(jsonb_agg(
    public.collection_card(c, auth.uid()) || jsonb_build_object('contains',
      recipe_slug is not null and exists (
        select 1 from public.collection_items i join public.recipes r on r.id = i.recipe_id
        where i.collection_id = c.id and r.slug = recipe_slug))
    order by c.updated_at desc), '[]'::jsonb))
  from public.collections c where c.owner_id = auth.uid()
$$;

-- A cook's public collections, for their page.
create or replace function public.cook_collections(target_username text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('collections', coalesce(jsonb_agg(public.collection_card(c, auth.uid()) order by c.updated_at desc), '[]'::jsonb))
  from public.collections c join public.profiles p on p.id = c.owner_id
  where p.username = public.normalize_username(target_username) and not p.is_banned
    and (c.is_public or c.owner_id = auth.uid()) and c.item_count > 0
$$;

-- One collection with its recipes. Public ones for anyone; the owner sees their own either way.
create or replace function public.collection_detail(target_username text, target_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.collection_card(c, auth.uid()) || jsonb_build_object(
    'owner', public.cook_card(p),
    'recipes', coalesce((
      select jsonb_agg(public.recipe_card(r, auth.uid()) order by i.added_at desc)
      from public.collection_items i
      join public.recipes r on r.id = i.recipe_id
      join public.profiles a on a.id = r.author_id
      where i.collection_id = c.id and not a.is_banned
        and (r.visibility = 'public' or r.author_id = auth.uid())
        and (auth.uid() is null or not exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = r.author_id))
    ), '[]'::jsonb)
  )
  from public.collections c join public.profiles p on p.id = c.owner_id
  where p.username = public.normalize_username(target_username) and c.slug = target_slug and not p.is_banned
    and (c.is_public or c.owner_id = auth.uid())
$$;

revoke all on function public.collection_card(public.collections, uuid) from public, anon, authenticated;
revoke all on function public.create_collection(text, text, boolean) from public, anon;
revoke all on function public.update_collection(text, jsonb) from public, anon;
revoke all on function public.delete_collection(text) from public, anon;
revoke all on function public.toggle_collection_item(text, text) from public, anon;
revoke all on function public.my_collections(text) from public, anon;
revoke all on function public.cook_collections(text) from public;
revoke all on function public.collection_detail(text, text) from public;
grant execute on function public.collection_card(public.collections, uuid) to service_role;
grant execute on function public.create_collection(text, text, boolean) to authenticated;
grant execute on function public.update_collection(text, jsonb) to authenticated;
grant execute on function public.delete_collection(text) to authenticated;
grant execute on function public.toggle_collection_item(text, text) to authenticated;
grant execute on function public.my_collections(text) to authenticated, service_role;
grant execute on function public.cook_collections(text) to anon, authenticated, service_role;
grant execute on function public.collection_detail(text, text) to anon, authenticated, service_role;
