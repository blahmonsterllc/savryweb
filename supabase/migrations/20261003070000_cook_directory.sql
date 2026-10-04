-- Cooks as people, not just bylines: a directory to find them, and the
-- dishes each cook has made, on their page. Public work only, cooks in good
-- standing only, never anyone the viewer blocked.

create or replace function public.cook_directory(search_query text default null, result_limit integer default 24, result_offset integer default 0) returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as id)
  select jsonb_build_object('cooks', coalesce(jsonb_agg(
    public.cook_card(x.p) || jsonb_build_object(
      'bio', x.bio, 'madeCount', x.made_count, 'isFeatured', x.is_featured,
      'following', exists (select 1 from public.profile_follows f where f.follower_id = (select id from me) and f.followed_id = x.id)
    ) order by x.is_featured desc, x.featured_rank nulls last, x.recipe_count desc, x.follower_count desc, x.display_name), '[]'::jsonb))
  from (
    select p, p.id, p.bio, p.is_featured, p.featured_rank, p.follower_count, p.display_name,
      (select count(*) from public.recipes r where r.author_id = p.id and r.visibility = 'public') as recipe_count,
      (select coalesce(sum(r.made_count), 0) from public.recipes r where r.author_id = p.id and r.visibility = 'public') as made_count
    from public.profiles p
    where not p.is_banned and p.username is not null
      and exists (select 1 from public.recipes r where r.author_id = p.id and r.visibility = 'public')
      and not exists (select 1 from public.user_blocks b where (b.blocker_id = (select id from me) and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = (select id from me)))
      and (coalesce(btrim(search_query), '') = '' or p.display_name ilike '%' || btrim(search_query) || '%' or p.username::text ilike '%' || btrim(search_query) || '%')
    order by p.is_featured desc, p.featured_rank nulls last, recipe_count desc, p.follower_count desc, p.display_name
    limit greatest(1, least(coalesce(result_limit, 24), 100)) offset greatest(0, coalesce(result_offset, 0))
  ) x
$$;

-- What a cook has made: their Made Its with photos, newest first.
create or replace function public.cook_made_its(target_username text, result_limit integer default 12) returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as id)
  select jsonb_build_object('items', coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'at', c.created_at, 'note', c.text,
    'photoUrl', public.setting('storage_public_base') || '/' || c.photo_path,
    'recipe', jsonb_build_object('slug', r.slug::text, 'title', r.title, 'authorName', a.display_name, 'authorUsername', a.username::text)
  ) order by c.created_at desc), '[]'::jsonb))
  from (
    select c.* from public.contributions c
    join public.profiles p on p.id = c.user_id and p.username = public.normalize_username(target_username) and not p.is_banned
    join public.recipes r on r.id = c.recipe_id and r.visibility = 'public'
    where c.type = 'made' and not c.hidden and c.photo_path is not null
    order by c.created_at desc
    limit greatest(1, least(coalesce(result_limit, 12), 60))
  ) c
  join public.recipes r on r.id = c.recipe_id
  join public.profiles a on a.id = r.author_id and not a.is_banned
  where not exists (select 1 from public.user_blocks b where b.blocker_id = (select id from me) and b.blocked_id in (c.user_id, r.author_id))
$$;

revoke all on function public.cook_directory(text, integer, integer) from public;
revoke all on function public.cook_made_its(text, integer) from public;
grant execute on function public.cook_directory(text, integer, integer) to anon, authenticated, service_role;
grant execute on function public.cook_made_its(text, integer) to anon, authenticated, service_role;
