-- Setting the table: a new cook says what they like to cook and eat, follows
-- a few cooks, saves a few recipes. The follows and saves use the existing
-- functions; this records the tastes and that the setup happened.

alter table public.profiles
  add column if not exists favorite_cuisines text[] not null default '{}',
  add column if not exists diet_tags text[] not null default '{}',
  add column if not exists onboarded_at timestamptz;

create or replace function public.finish_onboarding(cuisines text[] default '{}', diets text[] default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  clean_cuisines text[];
  clean_diets text[];
begin
  if actor is null then raise exception 'Sign in first'; end if;
  select coalesce(array_agg(distinct left(btrim(c), 40)) filter (where btrim(c) <> ''), '{}') into clean_cuisines
  from unnest(coalesce(cuisines, '{}')) c;
  select coalesce(array_agg(distinct lower(left(btrim(d), 40))) filter (where btrim(d) <> ''), '{}') into clean_diets
  from unnest(coalesce(diets, '{}')) d;
  if array_length(clean_cuisines, 1) > 12 or array_length(clean_diets, 1) > 12 then
    raise exception 'Pick up to twelve of each';
  end if;
  update public.profiles
  set favorite_cuisines = clean_cuisines, diet_tags = clean_diets, onboarded_at = coalesce(onboarded_at, now()), updated_at = now()
  where id = actor;
  return jsonb_build_object('favoriteCuisines', to_jsonb(clean_cuisines), 'dietTags', to_jsonb(clean_diets));
end $$;
revoke all on function public.finish_onboarding(text[], text[]) from public, anon;
grant execute on function public.finish_onboarding(text[], text[]) to authenticated;

-- my_profile now says whether the table has been set, and what the cook likes.
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
    'madeCount', (select coalesce(sum(r.made_count), 0) from public.recipes r where r.author_id = actor),
    'followerCount', p.follower_count,
    'followingCount', p.following_count,
    'favoriteCuisines', to_jsonb(p.favorite_cuisines),
    'dietTags', to_jsonb(p.diet_tags),
    'onboardedAt', p.onboarded_at
  );
end $$;
