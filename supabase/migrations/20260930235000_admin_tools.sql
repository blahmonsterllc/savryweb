-- Admin tools for the website's /admin area. Every function here is callable
-- only by the service role (the server-side admin client behind the Google
-- admin sign-in). Nothing in this file is reachable from a browser session.

insert into public.app_settings (key, value) values ('apple_secret_expires_at', '2027-03-29')
on conflict (key) do update set value = excluded.value;

-- ---------------------------------------------------------------------------
-- Defence in depth: Supabase's default privileges hand every new table to
-- anon and authenticated. RLS already blocks the writes, but the grants
-- should not exist at all. Anonymous visitors never write; members write
-- protected tables only through the screened functions.
-- ---------------------------------------------------------------------------
revoke insert, update, delete on all tables in schema public from anon;
revoke insert, update, delete on
  public.profiles, public.recipe_versions, public.reports, public.moderation_queue, public.daily_usage,
  public.app_settings, public.memberships, public.reserved_usernames, public.recipes, public.recipe_ingredients, public.recipe_steps
from authenticated;
alter default privileges in schema public revoke insert, update, delete on tables from anon;

-- ---------------------------------------------------------------------------
-- Overview numbers
-- ---------------------------------------------------------------------------
create or replace function public.admin_stats() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'members', (select count(*) from public.profiles),
    'membersLast7Days', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'plusMembers', (select count(*) from public.profiles where tier in ('plus', 'pro')),
    'bannedMembers', (select count(*) from public.profiles where is_banned),
    'unconfirmedMembers', (select count(*) from auth.users where email_confirmed_at is null),
    'publicRecipes', (select count(*) from public.recipes where visibility = 'public'),
    'recipesLast7Days', (select count(*) from public.recipes where visibility = 'public' and published_at > now() - interval '7 days'),
    'recipesOnHold', (select count(*) from public.recipes where review_hold),
    'madeItsLast7Days', (select count(*) from public.contributions where made_it and created_at > now() - interval '7 days'),
    'commentsLast7Days', (select count(*) from public.contributions where not made_it and created_at > now() - interval '7 days'),
    'pendingTweaks', (select count(*) from public.contributions where status = 'pending'),
    'reportsLast7Days', (select count(*) from public.reports where created_at > now() - interval '7 days'),
    'moderationOpen', (select count(*) from public.moderation_queue where status = 'open'),
    'moderationStale', (select count(*) from public.moderation_queue where status = 'open' and created_at < now() - interval '48 hours'),
    'storageObjects', (select count(*) from storage.objects where bucket_id = 'recipe-images'),
    'storageBytes', (select coalesce(sum((metadata ->> 'size')::bigint), 0) from storage.objects where bucket_id = 'recipe-images'),
    'generatedAt', now()
  )
$$;
revoke all on function public.admin_stats() from public, anon, authenticated;
grant execute on function public.admin_stats() to service_role;

-- ---------------------------------------------------------------------------
-- Live security audit of the database itself
-- ---------------------------------------------------------------------------
create or replace function public.admin_security_audit() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  checks jsonb := '[]'::jsonb;
  offenders text[];
  n integer;
  apple_expiry date;
begin
  -- 1. Row-level security on every public table.
  select coalesce(array_agg(c.relname order by c.relname), '{}') into offenders
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  checks := checks || jsonb_build_object('id', 'rls', 'label', 'Row-level security is on for every table',
    'ok', cardinality(offenders) = 0, 'detail', case when cardinality(offenders) = 0 then 'All public tables' else 'Missing on: ' || array_to_string(offenders, ', ') end);

  -- 2. Anonymous visitors can never write.
  select coalesce(array_agg(distinct table_name::text order by table_name::text), '{}') into offenders
    from information_schema.role_table_grants
   where grantee = 'anon' and table_schema = 'public' and privilege_type in ('INSERT', 'UPDATE', 'DELETE');
  checks := checks || jsonb_build_object('id', 'anon-writes', 'label', 'Anonymous visitors have no write access',
    'ok', cardinality(offenders) = 0, 'detail', case when cardinality(offenders) = 0 then 'No insert, update, or delete grants' else 'Writable by anon: ' || array_to_string(offenders, ', ') end);

  -- 3. Signed-in members cannot write protected tables directly (only through RPCs).
  select coalesce(array_agg(distinct table_name::text || ':' || lower(privilege_type) order by table_name::text || ':' || lower(privilege_type)), '{}') into offenders
    from information_schema.role_table_grants
   where grantee = 'authenticated' and table_schema = 'public'
     and table_name in ('recipes', 'recipe_ingredients', 'recipe_steps', 'recipe_versions', 'reports', 'moderation_queue', 'daily_usage', 'app_settings', 'memberships', 'profiles', 'reserved_usernames')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE');
  checks := checks || jsonb_build_object('id', 'member-writes', 'label', 'Members write only through screened functions',
    'ok', cardinality(offenders) = 0, 'detail', case when cardinality(offenders) = 0 then 'Recipes, reports, profiles, and settings are RPC-only' else 'Direct grants: ' || array_to_string(offenders, ', ') end);

  -- 4. Every SECURITY DEFINER function pins its search_path.
  select coalesce(array_agg(p.proname::text order by p.proname), '{}') into offenders
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%');
  checks := checks || jsonb_build_object('id', 'definer-path', 'label', 'Privileged functions pin their search path',
    'ok', cardinality(offenders) = 0, 'detail', case when cardinality(offenders) = 0 then 'All SECURITY DEFINER functions' else 'Unpinned: ' || array_to_string(offenders, ', ') end);

  -- 5. Admin and destructive functions are not callable from browser sessions.
  select coalesce(array_agg(distinct p.proname::text order by p.proname::text), '{}') into offenders
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and (p.proname like 'admin\_%' or p.proname in ('screen_text', 'assert_can_write', 'snapshot_recipe_version', 'take_daily_allowance', 'normalize_username', 'clean_social_links'))
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
  checks := checks || jsonb_build_object('id', 'admin-functions', 'label', 'Admin and internal functions are server-only',
    'ok', cardinality(offenders) = 0, 'detail', case when cardinality(offenders) = 0 then 'No admin_* or helper function is exposed' else 'Exposed: ' || array_to_string(offenders, ', ') end);

  -- 6. Storage bucket limits.
  select count(*) into n from storage.buckets where id = 'recipe-images' and coalesce(file_size_limit, 0) between 1 and 2097152;
  checks := checks || jsonb_build_object('id', 'storage-limit', 'label', 'Photo uploads are capped at 2 MB',
    'ok', n = 1, 'detail', case when n = 1 then 'recipe-images bucket' else 'recipe-images has no size limit or it is above 2 MB' end);

  -- 7. Banned members have nothing public.
  select count(*) into n from public.recipes r join public.profiles p on p.id = r.author_id where p.is_banned and r.visibility = 'public';
  checks := checks || jsonb_build_object('id', 'banned-content', 'label', 'Banned members have no public recipes',
    'ok', n = 0, 'detail', case when n = 0 then 'Clean' else n || ' public recipe(s) belong to banned members' end);

  -- 8. Moderation queue is being worked.
  select count(*) into n from public.moderation_queue where status = 'open' and created_at < now() - interval '48 hours';
  checks := checks || jsonb_build_object('id', 'moderation-stale', 'label', 'No report waits more than 48 hours',
    'ok', n = 0, 'detail', case when n = 0 then 'Queue is current' else n || ' item(s) older than 48 hours' end);

  -- 9. Apple sign-in secret has not expired and is not about to.
  apple_expiry := nullif(public.setting('apple_secret_expires_at'), '')::date;
  checks := checks || jsonb_build_object('id', 'apple-secret', 'label', 'Apple sign-in secret is current',
    'ok', apple_expiry is not null and apple_expiry > current_date + 30,
    'detail', case when apple_expiry is null then 'No expiry recorded' when apple_expiry <= current_date then 'Expired on ' || apple_expiry else 'Expires ' || apple_expiry || ' (rotate with scripts/auth/apple-signin.mjs)' end);

  -- 10. Reserved names are actually reserved.
  select count(*) into n from public.profiles where username in (select username from public.reserved_usernames) and not is_featured;
  checks := checks || jsonb_build_object('id', 'reserved-names', 'label', 'No member holds a reserved username',
    'ok', n = 0, 'detail', case when n = 0 then 'Clean' else n || ' member(s) hold reserved handles' end);

  return jsonb_build_object('checkedAt', now(), 'checks', checks);
end $$;
revoke all on function public.admin_security_audit() from public, anon, authenticated;
grant execute on function public.admin_security_audit() to service_role;

-- ---------------------------------------------------------------------------
-- Members
-- ---------------------------------------------------------------------------
create or replace function public.admin_members(query text default null, page_limit integer default 50) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(row_to_json(m) order by m."createdAt" desc), '[]'::jsonb)
  from (
    select p.id, p.display_name as "displayName", p.username, u.email, p.tier, p.is_banned as "isBanned", p.is_featured as "isFeatured",
           p.created_at as "createdAt", u.last_sign_in_at as "lastSeenAt", u.email_confirmed_at is not null as "emailConfirmed",
           coalesce(u.raw_app_meta_data ->> 'provider', 'email') as provider,
           (select count(*) from public.recipes r where r.author_id = p.id and r.visibility = 'public') as "recipeCount",
           (select count(*) from public.contributions c where c.user_id = p.id) as "contributionCount",
           (select count(*) from public.reports rp where rp.contribution_id in (select id from public.contributions c where c.user_id = p.id)
               or rp.recipe_id in (select id from public.recipes r where r.author_id = p.id)) as "reportsAgainst"
      from public.profiles p join auth.users u on u.id = p.id
     where query is null or btrim(query) = ''
        or p.display_name ilike '%' || btrim(query) || '%'
        or p.username::text ilike '%' || btrim(query) || '%'
        or u.email ilike '%' || btrim(query) || '%'
        or p.id::text = btrim(query)
     order by p.created_at desc
     limit least(greatest(coalesce(page_limit, 50), 1), 200)
  ) m
$$;
revoke all on function public.admin_members(text, integer) from public, anon, authenticated;
grant execute on function public.admin_members(text, integer) to service_role;
grant execute on function public.admin_set_ban(uuid, boolean) to service_role;

-- Ban also hides everything the member posted; unban leaves content private for review.
create or replace function public.admin_set_ban(target uuid, banned boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set is_banned = banned where id = target;
  if banned then
    update public.contributions set hidden = true where user_id = target;
    update public.recipes set visibility = 'private' where author_id = target and visibility <> 'private';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Reports and recipes
-- ---------------------------------------------------------------------------
create or replace function public.admin_reports(page_limit integer default 100) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(row_to_json(x) order by x."createdAt" desc), '[]'::jsonb)
  from (
    select rp.id, rp.reason, rp.detail, rp.created_at as "createdAt",
           reporter.display_name as "reporterName", rp.reporter_id as "reporterId",
           r.slug as "recipeSlug", r.title as "recipeTitle", r.visibility as "recipeVisibility",
           rp.contribution_id as "contributionId", left(c.text, 160) as "contributionText", c.hidden as "contributionHidden",
           coalesce(c.user_id, r.author_id) as "targetUserId", target.display_name as "targetName", target.is_banned as "targetBanned"
      from public.reports rp
      join public.profiles reporter on reporter.id = rp.reporter_id
      left join public.contributions c on c.id = rp.contribution_id
      left join public.recipes r on r.id = coalesce(rp.recipe_id, c.recipe_id)
      left join public.profiles target on target.id = coalesce(c.user_id, r.author_id)
     order by rp.created_at desc
     limit least(greatest(coalesce(page_limit, 100), 1), 500)
  ) x
$$;
revoke all on function public.admin_reports(integer) from public, anon, authenticated;
grant execute on function public.admin_reports(integer) to service_role;

create or replace function public.admin_set_recipe_visibility(target uuid, new_visibility text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if new_visibility not in ('public', 'unlisted', 'private') then raise exception 'Bad visibility'; end if;
  update public.recipes set visibility = new_visibility::public.recipe_visibility, review_hold = false, report_count = case when new_visibility = 'public' then 0 else report_count end
   where id = target;
end $$;
revoke all on function public.admin_set_recipe_visibility(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_recipe_visibility(uuid, text) to service_role;

create or replace function public.admin_recipes(query text default null, page_limit integer default 50) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(row_to_json(x) order by x."createdAt" desc), '[]'::jsonb)
  from (
    select r.id, r.slug, r.title, r.visibility, r.review_hold as "reviewHold", r.report_count as "reportCount",
           r.made_count as "madeCount", r.comment_count as "commentCount", r.version, r.image_url as "imageUrl",
           r.created_at as "createdAt", r.published_at as "publishedAt",
           p.display_name as "authorName", p.username as "authorUsername", p.id as "authorId", p.is_banned as "authorBanned"
      from public.recipes r join public.profiles p on p.id = r.author_id
     where query is null or btrim(query) = ''
        or r.title ilike '%' || btrim(query) || '%'
        or r.slug ilike '%' || btrim(query) || '%'
        or p.display_name ilike '%' || btrim(query) || '%'
     order by r.created_at desc
     limit least(greatest(coalesce(page_limit, 50), 1), 200)
  ) x
$$;
revoke all on function public.admin_recipes(text, integer) from public, anon, authenticated;
grant execute on function public.admin_recipes(text, integer) to service_role;
