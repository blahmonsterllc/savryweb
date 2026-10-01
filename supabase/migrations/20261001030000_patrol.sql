-- Patrol: an automated reviewer reads what members post (recipes, comments,
-- Made Its, tweaks, profiles) and flags anything that breaks the family-site
-- rules for a human to review. It only ever flags. Hiding content and banning
-- accounts stay admin decisions, made from /admin/patrol.
--
-- Every function here is service-role only. The site's scheduled job calls
-- patrol_next_batch / patrol_record; the admin pages call the admin_* ones.

create table if not exists public.patrol_reviews (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('recipe', 'contribution', 'profile')),
  target_id uuid not null,
  user_id uuid references public.profiles (id) on delete cascade,
  recipe_id uuid references public.recipes (id) on delete cascade,
  -- What was reviewed. An edit changes the hash, so the new text is read again.
  content_hash text not null,
  verdict text not null check (verdict in ('ok', 'review', 'severe')),
  categories text[] not null default '{}',
  reason text check (char_length(reason) <= 500),
  preview text check (char_length(preview) <= 600),
  model text,
  status text not null default 'closed' check (status in ('open', 'dismissed', 'removed', 'banned', 'closed')),
  reviewed_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  unique (kind, target_id, content_hash)
);
create index if not exists patrol_reviews_open_idx on public.patrol_reviews (reviewed_at desc) where status = 'open';
create index if not exists patrol_reviews_user_idx on public.patrol_reviews (user_id, reviewed_at desc) where verdict <> 'ok';

create table if not exists public.patrol_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  reviewed integer not null default 0,
  flagged integer not null default 0,
  errors integer not null default 0,
  note text check (char_length(note) <= 300)
);

alter table public.patrol_reviews enable row level security;
alter table public.patrol_runs enable row level security;
revoke all on public.patrol_reviews from public, anon, authenticated;
revoke all on public.patrol_runs from public, anon, authenticated;
grant select, insert, update, delete on public.patrol_reviews to service_role;
grant select, insert, update, delete on public.patrol_runs to service_role;

-- ---------------------------------------------------------------------------
-- What still needs reading: anything visible to other people whose current
-- content has no review yet. Oldest first.
-- ---------------------------------------------------------------------------
create or replace function public.patrol_next_batch(batch_limit integer default 12) returns jsonb
language sql stable security definer set search_path = '' as $$
  with recipe_items as (
    select 'recipe'::text as kind, r.id as target_id, r.author_id as user_id, r.id as recipe_id,
           md5(r.content_hash || '|' || coalesce(r.image_path, '') || '|' || coalesce(r.image_url, '')) as content_hash,
           r.updated_at as changed_at,
           jsonb_build_object(
             'title', r.title, 'description', r.description, 'notes', r.notes, 'category', r.category, 'cuisine', r.cuisine,
             'tags', to_jsonb(r.tags), 'sourceUrl', r.source_url,
             'ingredients', coalesce((select jsonb_agg(btrim(concat_ws(' ', i.amount, i.unit, i.name)) order by i.position)
                                        from public.recipe_ingredients i where i.recipe_id = r.id), '[]'::jsonb),
             'steps', coalesce((select jsonb_agg(s.instruction order by s.position) from public.recipe_steps s where s.recipe_id = r.id), '[]'::jsonb)
           ) as content,
           r.image_url as image_url, r.image_path as image_path
      from public.recipes r
     where r.visibility in ('public', 'unlisted')
  ), contribution_items as (
    select 'contribution'::text, c.id, c.user_id, c.recipe_id,
           md5(coalesce(c.text, '') || '|' || c.changes::text || '|' || coalesce(c.photo_path, '')),
           c.updated_at,
           jsonb_build_object('type', c.type, 'text', c.text, 'changes', c.changes, 'recipeTitle', r.title),
           null::text, c.photo_path
      from public.contributions c join public.recipes r on r.id = c.recipe_id
     where not c.hidden and r.visibility in ('public', 'unlisted')
  ), profile_items as (
    select 'profile'::text, p.id, p.id, null::uuid,
           md5(coalesce(p.display_name, '') || '|' || coalesce(p.username::text, '') || '|' || coalesce(p.bio, '') || '|' || p.social_links::text || '|' || coalesce(p.avatar_path, '')),
           p.updated_at,
           jsonb_build_object('displayName', p.display_name, 'username', p.username, 'bio', p.bio, 'socialLinks', p.social_links),
           null::text, p.avatar_path
      from public.profiles p
     where not p.is_banned
  ), pending as (
    select * from recipe_items union all select * from contribution_items union all select * from profile_items
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', x.kind, 'targetId', x.target_id, 'userId', x.user_id, 'recipeId', x.recipe_id, 'contentHash', x.content_hash,
           'content', x.content, 'imageUrl', x.image_url, 'imagePath', x.image_path) order by x.changed_at), '[]'::jsonb)
  from (
    select p.* from pending p
     where not exists (select 1 from public.patrol_reviews v where v.kind = p.kind and v.target_id = p.target_id and v.content_hash = p.content_hash)
     order by p.changed_at
     limit least(greatest(coalesce(batch_limit, 12), 1), 50)
  ) x
$$;

-- ---------------------------------------------------------------------------
-- Store one verdict. Anything other than 'ok' opens a flag for an admin.
-- This function never hides content and never touches is_banned.
-- ---------------------------------------------------------------------------
create or replace function public.patrol_record(payload jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_kind text := payload ->> 'kind';
  v_verdict text := lower(coalesce(payload ->> 'verdict', ''));
  v_user uuid := nullif(payload ->> 'userId', '')::uuid;
  inserted integer;
begin
  if v_kind not in ('recipe', 'contribution', 'profile') then raise exception 'Bad kind'; end if;
  if v_verdict not in ('ok', 'review', 'severe') then raise exception 'Bad verdict'; end if;
  -- The author may have deleted their account while the review was running.
  if v_user is not null and not exists (select 1 from public.profiles where id = v_user) then return false; end if;
  insert into public.patrol_reviews (kind, target_id, user_id, recipe_id, content_hash, verdict, categories, reason, preview, model, status)
  values (
    v_kind, (payload ->> 'targetId')::uuid, v_user,
    (select r.id from public.recipes r where r.id = nullif(payload ->> 'recipeId', '')::uuid),
    payload ->> 'contentHash', v_verdict,
    coalesce((select array_agg(left(lower(c.value), 40)) from (select value from jsonb_array_elements_text(coalesce(payload -> 'categories', '[]'::jsonb)) limit 8) c), '{}'),
    left(payload ->> 'reason', 500), left(payload ->> 'preview', 600), left(payload ->> 'model', 80),
    case when v_verdict = 'ok' then 'closed' else 'open' end
  )
  on conflict (kind, target_id, content_hash) do nothing;
  get diagnostics inserted = row_count;
  return inserted > 0;
end $$;

create or replace function public.patrol_log_run(payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.patrol_runs (started_at, finished_at, reviewed, flagged, errors, note)
  values (coalesce((payload ->> 'startedAt')::timestamptz, now()), now(),
          coalesce((payload ->> 'reviewed')::integer, 0), coalesce((payload ->> 'flagged')::integer, 0),
          coalesce((payload ->> 'errors')::integer, 0), left(payload ->> 'note', 300));
  delete from public.patrol_runs where id < (select max(id) - 2000 from public.patrol_runs);
end $$;

-- ---------------------------------------------------------------------------
-- Admin: open flags, with the member's history beside each one.
-- ---------------------------------------------------------------------------
create or replace function public.admin_patrol_flags(page_limit integer default 100) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(row_to_json(x) order by x."severe" desc, x."reviewedAt" desc), '[]'::jsonb)
  from (
    select v.id, v.kind, v.verdict, (v.verdict = 'severe') as "severe", to_jsonb(v.categories) as categories, v.reason, v.preview,
           v.reviewed_at as "reviewedAt", v.target_id as "targetId",
           r.slug as "recipeSlug", r.title as "recipeTitle", r.visibility as "recipeVisibility",
           p.id as "userId", p.display_name as "userName", p.username as "userUsername", p.created_at as "userJoined", p.is_banned as "userBanned",
           (select count(*) from public.patrol_reviews o where o.user_id = v.user_id and o.verdict <> 'ok' and o.status <> 'dismissed'
              and o.reviewed_at > now() - interval '30 days') as "userFlags30d",
           (select count(*) from public.reports rp
              left join public.contributions rc on rc.id = rp.contribution_id
              join public.recipes rr on rr.id = rp.recipe_id
             where coalesce(rc.user_id, rr.author_id) = v.user_id and rp.created_at > now() - interval '30 days') as "userReports30d"
      from public.patrol_reviews v
      left join public.profiles p on p.id = v.user_id
      left join public.recipes r on r.id = v.recipe_id
     where v.status = 'open'
     order by (v.verdict = 'severe') desc, v.reviewed_at desc
     limit least(greatest(coalesce(page_limit, 100), 1), 300)
  ) x
$$;

-- Admin: is the patrol running, and who keeps getting flagged.
create or replace function public.admin_patrol_summary() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'lastRun', (select jsonb_build_object('finishedAt', finished_at, 'reviewed', reviewed, 'flagged', flagged, 'errors', errors, 'note', note)
                  from public.patrol_runs order by id desc limit 1),
    'runs24h', (select count(*) from public.patrol_runs where started_at > now() - interval '24 hours'),
    'reviewed24h', (select count(*) from public.patrol_reviews where reviewed_at > now() - interval '24 hours'),
    'reviewedTotal', (select count(*) from public.patrol_reviews),
    'openFlags', (select count(*) from public.patrol_reviews where status = 'open'),
    'openSevere', (select count(*) from public.patrol_reviews where status = 'open' and verdict = 'severe'),
    'waiting', jsonb_array_length(public.patrol_next_batch(50)),
    'watchList', coalesce((
      select jsonb_agg(row_to_json(w) order by w.flags desc)
      from (
        select p.id as "userId", p.display_name as "userName", p.username as "userUsername", p.is_banned as "userBanned",
               p.created_at as "userJoined", count(*) as flags, max(v.reviewed_at) as "lastFlagAt"
          from public.patrol_reviews v join public.profiles p on p.id = v.user_id
         where v.verdict <> 'ok' and v.status <> 'dismissed' and v.reviewed_at > now() - interval '30 days'
         group by p.id
        having count(*) >= 2
         order by count(*) desc
         limit 25
      ) w), '[]'::jsonb)
  )
$$;

-- Admin decision on one flag: dismiss it, remove the content, or remove and ban.
create or replace function public.admin_patrol_resolve(flag uuid, action text, admin_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  item public.patrol_reviews;
  act text := lower(coalesce(action, ''));
begin
  if act not in ('dismiss', 'remove', 'ban') then raise exception 'Bad action'; end if;
  select * into item from public.patrol_reviews where id = flag for update;
  if item.id is null then raise exception 'Flag not found'; end if;

  if act in ('remove', 'ban') then
    if item.kind = 'recipe' then
      update public.recipes set visibility = 'private', review_hold = false where id = item.target_id;
    elsif item.kind = 'contribution' then
      update public.contributions set hidden = true where id = item.target_id;
    else
      update public.profiles set bio = null, social_links = '{}'::jsonb, avatar_path = null where id = item.target_id;
    end if;
  end if;
  if act = 'ban' and item.user_id is not null then
    perform public.admin_set_ban(item.user_id, true);
    update public.patrol_reviews set status = 'banned', resolved_at = now(), resolved_by = admin_id
     where user_id = item.user_id and status = 'open';
  end if;

  update public.patrol_reviews
     set status = case act when 'dismiss' then 'dismissed' when 'ban' then 'banned' else 'removed' end,
         resolved_at = now(), resolved_by = admin_id
   where id = item.id;
end $$;

revoke all on function public.patrol_next_batch(integer) from public, anon, authenticated;
revoke all on function public.patrol_record(jsonb) from public, anon, authenticated;
revoke all on function public.patrol_log_run(jsonb) from public, anon, authenticated;
revoke all on function public.admin_patrol_flags(integer) from public, anon, authenticated;
revoke all on function public.admin_patrol_summary() from public, anon, authenticated;
revoke all on function public.admin_patrol_resolve(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.patrol_next_batch(integer) to service_role;
grant execute on function public.patrol_record(jsonb) to service_role;
grant execute on function public.patrol_log_run(jsonb) to service_role;
grant execute on function public.admin_patrol_flags(integer) to service_role;
grant execute on function public.admin_patrol_summary() to service_role;
grant execute on function public.admin_patrol_resolve(uuid, text, uuid) to service_role;
