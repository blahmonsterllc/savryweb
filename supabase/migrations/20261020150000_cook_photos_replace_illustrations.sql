-- Cook photos replace Savry Kitchen's stand-in pictures.
--
-- Savry Kitchen's recipe pictures are stand-ins: illustrations made with an
-- image model, or licensed photos (Unsplash, Pexels, Wikimedia Commons...)
-- credited to their photographer through image_credit_name/url/license.
-- When a cook posts a Made It photo of the dish, the patrol checks it like any
-- other post; if it is fine for a family site AND clearly shows that dish,
-- the photo becomes the recipe's picture, credited to the cook. A recipe with
-- no picture at all gets one the same way. A cook's own recipe photo is never
-- replaced.
--
-- The swap undoes itself: when the photo's Made It is hidden, edited or
-- deleted, the next qualifying photo (or the illustration) comes back. The
-- patrol still only judges; this only chooses between already-cleared photos.

alter table public.recipes
  add column if not exists image_is_illustration boolean not null default false,
  add column if not exists illustration_url text,
  add column if not exists image_photo_contribution uuid,
  add column if not exists image_credit_user uuid references public.profiles (id) on delete set null,
  -- A licensed photo by someone outside Savry: who took it, where it came
  -- from, and the license that lets Savry use it (shown with the picture).
  add column if not exists image_credit_name text check (char_length(image_credit_name) <= 120),
  add column if not exists image_credit_url text check (image_credit_url ~ '^https://' and char_length(image_credit_url) <= 500),
  add column if not exists image_license text check (char_length(image_license) <= 80);

alter table public.patrol_reviews
  add column if not exists shows_dish boolean;

-- Savry Kitchen's pictures so far are all illustrations.
update public.recipes r
   set image_is_illustration = true
  from public.profiles p
 where p.id = r.author_id and p.username = 'savry-kitchen'
   and r.image_url is not null and not r.image_is_illustration;

-- The patrol's hash of a contribution, as patrol_next_batch computes it.
create or replace function public.contribution_content_hash(c public.contributions) returns text
language sql immutable set search_path = '' as $$
  select md5(coalesce(c.text, '') || '|' || c.changes::text || '|' || coalesce(c.photo_path, ''))
$$;

-- Puts the right picture on one recipe: the newest cleared cook photo when the
-- recipe's own picture may be replaced, otherwise the illustration (or none).
create or replace function public.refresh_recipe_photo(p_recipe uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.recipes;
  pick public.contributions;
  base text := public.setting('storage_public_base');
begin
  select * into r from public.recipes where id = p_recipe for update;
  if not found then return; end if;
  -- Only a stand-in (illustration or licensed photo), a missing picture, or a
  -- cook photo put here earlier. The stand-in's credit stays for its return.
  if not (r.image_is_illustration or r.image_license is not null or r.image_url is null or r.image_photo_contribution is not null) then return; end if;

  select c.* into pick
    from public.contributions c
    join public.profiles p on p.id = c.user_id and not p.is_banned
   where c.recipe_id = p_recipe and c.made_it and c.photo_path is not null and not c.hidden
     and exists (
       select 1 from public.patrol_reviews pr
        where pr.kind = 'contribution' and pr.target_id = c.id
          and pr.content_hash = public.contribution_content_hash(c)
          and pr.verdict = 'ok' and pr.shows_dish)
   order by c.like_count desc, c.created_at desc
   limit 1;

  perform set_config('savry.choosing_photo', 'on', true);
  if pick.id is not null and base is not null then
    if pick.id is distinct from r.image_photo_contribution then
      update public.recipes
         set illustration_url = case when r.image_photo_contribution is null then r.image_url else r.illustration_url end,
             image_url = base || '/' || pick.photo_path,
             image_photo_contribution = pick.id,
             image_credit_user = pick.user_id,
             image_is_illustration = false
       where id = p_recipe;
    end if;
  elsif r.image_photo_contribution is not null then
    update public.recipes
       set image_url = r.illustration_url,
           image_is_illustration = r.illustration_url is not null and r.image_license is null,
           illustration_url = null,
           image_photo_contribution = null,
           image_credit_user = null
     where id = p_recipe;
  end if;
  perform set_config('savry.choosing_photo', 'off', true);
end $$;

-- An author changing the picture themselves takes it back from the cook photo,
-- except when a republish merely resends the old stand-in. A Savry Kitchen
-- picture without a license is an illustration; one with a license is a
-- credited photo (set image_url and the credit columns in the same update).
create or replace function public.recipes_image_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('savry.choosing_photo', true) = 'on' then return new; end if;
  if new.image_url is not distinct from old.image_url then
    -- A credit added to (or taken off) the current stand-in.
    if new.image_license is distinct from old.image_license and new.image_photo_contribution is null then
      new.image_is_illustration := new.image_url is not null and new.image_license is null
        and exists (select 1 from public.profiles p where p.id = new.author_id and p.username = 'savry-kitchen');
    end if;
    return new;
  end if;
  if old.image_photo_contribution is not null and new.image_url is not distinct from old.illustration_url then
    new.image_url := old.image_url;
    return new;
  end if;
  new.image_photo_contribution := null;
  new.image_credit_user := null;
  new.illustration_url := null;
  new.image_is_illustration := new.image_url is not null and new.image_license is null
    and exists (select 1 from public.profiles p where p.id = new.author_id and p.username = 'savry-kitchen');
  return new;
end $$;

drop trigger if exists recipes_image_changed on public.recipes;
create trigger recipes_image_changed before update of image_url, image_license on public.recipes
  for each row execute function public.recipes_image_changed();

-- A Made It hidden, edited, or deleted: re-choose that recipe's picture.
create or replace function public.contributions_photo_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.photo_path is not null then perform public.refresh_recipe_photo(old.recipe_id); end if;
    return old;
  end if;
  if (old.photo_path is not null or new.photo_path is not null)
     and (new.hidden is distinct from old.hidden or new.photo_path is distinct from old.photo_path
          or new.text is distinct from old.text or new.made_it is distinct from old.made_it) then
    perform public.refresh_recipe_photo(new.recipe_id);
  end if;
  return new;
end $$;

drop trigger if exists contributions_photo_changed on public.contributions;
create trigger contributions_photo_changed after update or delete on public.contributions
  for each row execute function public.contributions_photo_changed();

-- The patrol records whether a Made It photo shows the dish, then the recipe's
-- picture is re-chosen. Otherwise unchanged from 20261001030000_patrol.sql.
create or replace function public.patrol_record(payload jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_kind text := payload ->> 'kind';
  v_verdict text := lower(coalesce(payload ->> 'verdict', ''));
  v_user uuid := nullif(payload ->> 'userId', '')::uuid;
  v_recipe uuid := (select r.id from public.recipes r where r.id = nullif(payload ->> 'recipeId', '')::uuid);
  inserted integer;
begin
  if v_kind not in ('recipe', 'contribution', 'profile') then raise exception 'Bad kind'; end if;
  if v_verdict not in ('ok', 'review', 'severe') then raise exception 'Bad verdict'; end if;
  -- The author may have deleted their account while the review was running.
  if v_user is not null and not exists (select 1 from public.profiles where id = v_user) then return false; end if;
  insert into public.patrol_reviews (kind, target_id, user_id, recipe_id, content_hash, verdict, categories, reason, preview, model, status, shows_dish)
  values (
    v_kind, (payload ->> 'targetId')::uuid, v_user, v_recipe,
    payload ->> 'contentHash', v_verdict,
    coalesce((select array_agg(left(lower(c.value), 40)) from (select value from jsonb_array_elements_text(coalesce(payload -> 'categories', '[]'::jsonb)) limit 8) c), '{}'),
    left(payload ->> 'reason', 500), left(payload ->> 'preview', 600), left(payload ->> 'model', 80),
    case when v_verdict = 'ok' then 'closed' else 'open' end,
    case when v_kind = 'contribution' then (payload ->> 'showsDish')::boolean end
  )
  on conflict (kind, target_id, content_hash) do nothing;
  get diagnostics inserted = row_count;
  if inserted > 0 and v_kind = 'contribution' and v_recipe is not null then
    perform public.refresh_recipe_photo(v_recipe);
  end if;
  return inserted > 0;
end $$;

revoke all on function public.contribution_content_hash(public.contributions) from public, anon, authenticated;
revoke all on function public.refresh_recipe_photo(uuid) from public, anon, authenticated;
revoke all on function public.recipes_image_changed() from public, anon, authenticated;
revoke all on function public.contributions_photo_changed() from public, anon, authenticated;
grant execute on function public.refresh_recipe_photo(uuid) to service_role;
