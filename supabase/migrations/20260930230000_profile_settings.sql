-- Profile settings for the website account page and the app: a chosen display
-- name, an @username, bio, avatar, social links, and the email preference.
-- Identity fields change only through update_my_profile so every value is
-- validated and screened the same way as posts.

alter table public.profiles add column if not exists social_links jsonb not null default '{}'::jsonb;
alter table public.profiles drop constraint if exists profiles_social_links_check;
alter table public.profiles add constraint profiles_social_links_check
  check (jsonb_typeof(social_links) = 'object' and pg_column_size(social_links) <= 1500);

-- Handles nobody may claim.
create table if not exists public.reserved_usernames (username public.citext primary key);
alter table public.reserved_usernames enable row level security;
revoke all on public.reserved_usernames from anon, authenticated;
insert into public.reserved_usernames (username) values
  ('savry'), ('savrykitchen'), ('savry-kitchen'), ('savry_kitchen'), ('savryplus'), ('savry-plus'),
  ('admin'), ('administrator'), ('moderator'), ('mod'), ('staff'), ('official'), ('support'), ('help'),
  ('team'), ('root'), ('system'), ('null'), ('undefined'), ('api'), ('www'), ('mail'),
  ('recipes'), ('recipe'), ('cooks'), ('cook'), ('account'), ('settings'), ('login'), ('signup'),
  ('about'), ('privacy'), ('terms'), ('advertise'), ('blahmonster')
on conflict do nothing;

-- Public identity: anyone may read the public fields of cooks who chose a
-- handle or published a recipe. Tier, email preference, and bans stay private.
grant select (social_links) on public.profiles to anon, authenticated;
drop policy if exists "public read published authors" on public.profiles;
drop policy if exists "public read cook profiles" on public.profiles;
create policy "public read cook profiles" on public.profiles for select to anon using (
  not is_banned and (
    username is not null
    or exists (select 1 from public.recipes r where r.author_id = profiles.id and r.visibility = 'public')
  )
);

-- No direct client writes to profiles any more; everything goes through the RPC.
revoke update on public.profiles from authenticated;

create or replace function public.normalize_username(candidate text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  handle text := lower(btrim(coalesce(candidate, '')));
begin
  handle := regexp_replace(handle, '^@', '');
  if handle = '' then return null; end if;
  if char_length(handle) < 3 or char_length(handle) > 30 then
    raise exception 'Usernames are 3 to 30 characters.';
  end if;
  if handle !~ '^[a-z0-9][a-z0-9_.-]*$' then
    raise exception 'Usernames can only use letters, numbers, dots, dashes, and underscores.';
  end if;
  if handle ~ '[._-]{2}' or handle ~ '[._-]$' then
    raise exception 'Usernames can''t end with or repeat punctuation.';
  end if;
  return handle;
end $$;
revoke all on function public.normalize_username(text) from public, anon, authenticated;

-- Live check for the username field. Never raises; invalid input is "not available".
create or replace function public.username_available(candidate text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  handle text;
  actor uuid := auth.uid();
begin
  handle := public.normalize_username(candidate);
  if handle is null then return false; end if;
  if exists (select 1 from public.reserved_usernames r where r.username = handle::public.citext) then return false; end if;
  if public.screen_text(handle) is not null then return false; end if;
  return not exists (
    select 1 from public.profiles p where p.username = handle::public.citext and p.id is distinct from actor
  );
exception when others then
  return false;
end $$;
grant execute on function public.username_available(text) to anon, authenticated;

-- Social links are stored as handles (or one https website), never free text.
create or replace function public.clean_social_links(input jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  cleaned jsonb := '{}'::jsonb;
  entry record;
  val text;
begin
  if input is null or jsonb_typeof(input) <> 'object' then return cleaned; end if;
  for entry in select key, value from jsonb_each_text(input) loop
    val := regexp_replace(btrim(coalesce(entry.value, '')), '^@', '');
    if val = '' then continue; end if;
    if entry.key in ('instagram', 'tiktok', 'threads', 'x', 'youtube', 'pinterest', 'facebook') then
      -- Accept a pasted profile URL and keep only the handle.
      val := regexp_replace(val, '^https?://(www\.)?[a-z0-9.-]+/(@)?', '', 'i');
      val := regexp_replace(val, '[/?#].*$', '');
      if val !~ '^[A-Za-z0-9._-]{1,40}$' then
        raise exception 'That % handle doesn''t look right.', entry.key;
      end if;
      cleaned := cleaned || jsonb_build_object(entry.key, val);
    elsif entry.key = 'website' then
      if char_length(val) > 200 or val !~* '^https://[a-z0-9-]+(\.[a-z0-9-]+)+(/[^\s]*)?$' then
        raise exception 'Website links must start with https:// and point at a real domain.';
      end if;
      cleaned := cleaned || jsonb_build_object('website', val);
    end if;
  end loop;
  return cleaned;
end $$;
revoke all on function public.clean_social_links(jsonb) from public, anon, authenticated;

-- Everything the account page and the app's profile editor need, for the signed-in cook only.
create or replace function public.my_profile() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  p public.profiles;
  u_email text;
  u_confirmed timestamptz;
  providers text[];
begin
  if actor is null then raise exception 'Sign in first'; end if;
  select * into p from public.profiles where id = actor;
  if p.id is null then raise exception 'Account not found'; end if;
  select u.email, u.email_confirmed_at,
         coalesce(array(select jsonb_array_elements_text(u.raw_app_meta_data -> 'providers')), '{}'::text[])
    into u_email, u_confirmed, providers
    from auth.users u where u.id = actor;
  return jsonb_build_object(
    'id', p.id,
    'displayName', p.display_name,
    'username', p.username,
    'bio', p.bio,
    'avatarUrl', case when p.avatar_path is null then null else public.setting('storage_public_base') || '/' || p.avatar_path end,
    'socialLinks', p.social_links,
    'emailOptIn', p.email_opt_in,
    'tier', p.tier,
    'email', u_email,
    'emailConfirmed', u_confirmed is not null,
    'providers', to_jsonb(providers),
    'termsAcceptedAt', p.terms_accepted_at,
    'memberSince', p.created_at,
    'recipeCount', (select count(*) from public.recipes r where r.author_id = actor and r.visibility = 'public'),
    'madeCount', (select coalesce(sum(r.made_count), 0) from public.recipes r where r.author_id = actor)
  );
end $$;
revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- Partial update: only keys present in the payload change.
--   { displayName, username, bio, socialLinks: {instagram,...,website}, avatarPath, emailOptIn }
create or replace function public.update_my_profile(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  banned boolean;
  new_name text;
  new_handle text;
  new_bio text;
  new_avatar text;
  reason text;
begin
  if actor is null then raise exception 'Sign in first'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then raise exception 'Nothing to update'; end if;
  select is_banned into banned from public.profiles where id = actor;
  if banned is null then raise exception 'Account not found'; end if;
  if banned then raise exception 'This account can no longer be changed'; end if;

  if payload ? 'displayName' then
    new_name := regexp_replace(btrim(coalesce(payload ->> 'displayName', '')), '\s+', ' ', 'g');
    if char_length(new_name) < 1 or char_length(new_name) > 60 then
      raise exception 'Display names are 1 to 60 characters.';
    end if;
    if new_name ~* '(^|\s)(savry|admin|moderator|staff|official)(\s|$)' then
      raise exception 'That name is reserved for Savry staff.';
    end if;
    reason := public.screen_text(new_name);
    if reason is not null then raise exception '%', reason; end if;
    update public.profiles set display_name = new_name where id = actor;
  end if;

  if payload ? 'username' then
    new_handle := public.normalize_username(payload ->> 'username');
    if new_handle is not null then
      if exists (select 1 from public.reserved_usernames r where r.username = new_handle::public.citext) then
        raise exception 'That username is reserved.';
      end if;
      if exists (select 1 from public.profiles p where p.username = new_handle::public.citext and p.id <> actor) then
        raise exception 'That username is taken.';
      end if;
      reason := public.screen_text(new_handle);
      if reason is not null then raise exception '%', reason; end if;
    end if;
    update public.profiles set username = new_handle::public.citext where id = actor;
  end if;

  if payload ? 'bio' then
    new_bio := nullif(regexp_replace(btrim(coalesce(payload ->> 'bio', '')), '\s{3,}', '  ', 'g'), '');
    if char_length(new_bio) > 280 then raise exception 'Bios are up to 280 characters.'; end if;
    reason := public.screen_text(new_bio);
    if reason is not null then raise exception '%', reason; end if;
    update public.profiles set bio = new_bio where id = actor;
  end if;

  if payload ? 'socialLinks' then
    update public.profiles set social_links = public.clean_social_links(payload -> 'socialLinks') where id = actor;
  end if;

  if payload ? 'avatarPath' then
    new_avatar := nullif(btrim(coalesce(payload ->> 'avatarPath', '')), '');
    if new_avatar is not null and (new_avatar not like actor::text || '/%' or new_avatar ~ '\.\.') then
      raise exception 'Profile photos must be uploaded to your own folder.';
    end if;
    update public.profiles set avatar_path = new_avatar where id = actor;
  end if;

  if payload ? 'emailOptIn' then
    update public.profiles set email_opt_in = coalesce((payload ->> 'emailOptIn')::boolean, false) where id = actor;
  end if;

  return public.my_profile();
end $$;
revoke all on function public.update_my_profile(jsonb) from public, anon;
grant execute on function public.update_my_profile(jsonb) to authenticated;
