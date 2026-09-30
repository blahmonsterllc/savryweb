-- Recipe-specific community conversations. The public surface is deliberately
-- RPC-only for writes so rate limits, parent validation, and author decisions
-- cannot be bypassed by a browser or native client.

alter table public.contributions
  add column if not exists parent_id uuid references public.contributions(id) on delete cascade,
  add column if not exists topic text,
  add column if not exists like_count integer not null default 0 check (like_count >= 0),
  add column if not exists reply_count integer not null default 0 check (reply_count >= 0);

alter table public.contributions
  drop constraint if exists contributions_topic_check;
alter table public.contributions
  add constraint contributions_topic_check check (
    topic is null or topic in ('addition', 'revision', 'substitution', 'technique', 'question')
  );

create index if not exists contributions_thread_idx
  on public.contributions (recipe_id, parent_id, created_at) where hidden = false;

create table if not exists public.contribution_likes (
  contribution_id uuid not null references public.contributions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contribution_id, user_id)
);
alter table public.contribution_likes enable row level security;
revoke all on public.contribution_likes from public, anon, authenticated;

drop policy if exists "members contribute" on public.contributions;
revoke insert, update, delete on public.contributions from anon, authenticated;

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
  select * into target_recipe
  from public.recipes
  where slug = target_slug and visibility = 'public';

  if target_recipe.id is null then
    raise exception 'Recipe not found';
  end if;

  select coalesce(jsonb_agg(post order by root_created desc, created asc), '[]'::jsonb)
  into result_posts
  from (
    select
      coalesce(root.created_at, c.created_at) as root_created,
      c.created_at as created,
      jsonb_build_object(
        'id', c.id,
        'parentId', c.parent_id,
        'kind', case when c.type = 'tweak' then 'suggestion' else 'comment' end,
        'topic', c.topic,
        'text', c.text,
        'status', c.status,
        'userId', c.user_id,
        'userName', p.display_name,
        'isRecipeAuthor', c.user_id = target_recipe.author_id,
        'likeCount', c.like_count,
        'replyCount', c.reply_count,
        'viewerLiked', exists (
          select 1 from public.contribution_likes l
          where l.contribution_id = c.id and l.user_id = actor
        ),
        'createdAt', c.created_at
      ) as post
    from public.contributions c
    join public.profiles p on p.id = c.user_id
    left join public.contributions root on root.id = c.parent_id
    where c.recipe_id = target_recipe.id
      and c.type in ('comment', 'tweak')
      and not c.hidden
  ) discussion;

  return jsonb_build_object(
    'recipeId', target_recipe.id,
    'recipeAuthorId', target_recipe.author_id,
    'viewerId', actor,
    'count', target_recipe.comment_count,
    'posts', result_posts
  );
end;
$$;

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
  usage_row public.daily_usage%rowtype;
begin
  if actor is null then raise exception 'Sign in to join the discussion'; end if;
  if not exists (select 1 from public.profiles where id = actor and not is_banned) then
    raise exception 'Account is not permitted to post';
  end if;
  if char_length(body) < 2 or char_length(body) > 2000 then
    raise exception 'Post must be between 2 and 2000 characters';
  end if;
  if requested_kind not in ('comment', 'suggestion') then
    raise exception 'Invalid discussion type';
  end if;
  if requested_topic is not null and requested_topic not in ('addition', 'revision', 'substitution', 'technique', 'question') then
    raise exception 'Invalid suggestion topic';
  end if;

  select * into target_recipe
  from public.recipes
  where slug = payload ->> 'recipeSlug' and visibility = 'public'
  for update;
  if target_recipe.id is null then raise exception 'Recipe not found'; end if;

  if nullif(payload ->> 'parentId', '') is not null then
    requested_parent := (payload ->> 'parentId')::uuid;
    select * into parent_post from public.contributions
      where id = requested_parent
        and recipe_id = target_recipe.id
        and parent_id is null
        and type in ('comment', 'tweak')
        and not hidden;
    if parent_post.id is null then raise exception 'Conversation no longer exists'; end if;
    requested_kind := 'comment';
    requested_topic := null;
  elsif requested_kind = 'suggestion' and requested_topic is null then
    requested_topic := 'revision';
  end if;

  insert into public.daily_usage (user_id, day, contributions, tweaks)
  values (actor, current_date, 1, case when requested_kind = 'suggestion' then 1 else 0 end)
  on conflict (user_id, day) do update set
    contributions = public.daily_usage.contributions + 1,
    tweaks = public.daily_usage.tweaks + excluded.tweaks,
    updated_at = now()
  returning * into usage_row;

  if usage_row.contributions > 50 then raise exception 'Daily discussion limit reached'; end if;
  if usage_row.tweaks > 10 then raise exception 'Daily suggestion limit reached'; end if;

  insert into public.contributions (recipe_id, user_id, type, status, text, parent_id, topic)
  values (
    target_recipe.id,
    actor,
    case when requested_kind = 'suggestion' then 'tweak'::public.contribution_type else 'comment'::public.contribution_type end,
    case when requested_kind = 'suggestion' then 'pending'::public.contribution_status else null end,
    body,
    requested_parent,
    requested_topic
  ) returning * into new_post;

  if requested_parent is not null then
    update public.contributions set reply_count = reply_count + 1 where id = requested_parent;
  end if;
  update public.recipes set
    comment_count = comment_count + 1,
    community_score = community_score + case when requested_kind = 'suggestion' then 2 else 1 end
  where id = target_recipe.id;

  return jsonb_build_object('id', new_post.id, 'count', target_recipe.comment_count + 1);
end;
$$;

create or replace function public.toggle_recipe_discussion_like(target_contribution uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  removed integer;
  now_liked boolean;
  total integer;
begin
  if actor is null then raise exception 'Sign in to like a post'; end if;
  if not exists (select 1 from public.profiles where id = actor and not is_banned) then
    raise exception 'Account is not permitted to react';
  end if;
  if not exists (
    select 1 from public.contributions c
    join public.recipes r on r.id = c.recipe_id
    where c.id = target_contribution and not c.hidden and r.visibility = 'public'
  ) then raise exception 'Post not found'; end if;

  delete from public.contribution_likes
  where contribution_id = target_contribution and user_id = actor;
  get diagnostics removed = row_count;
  if removed = 0 then
    insert into public.contribution_likes (contribution_id, user_id)
    values (target_contribution, actor);
    now_liked := true;
  else
    now_liked := false;
  end if;

  select count(*)::integer into total from public.contribution_likes
  where contribution_id = target_contribution;
  update public.contributions set like_count = total where id = target_contribution;
  return jsonb_build_object('liked', now_liked, 'likeCount', total);
end;
$$;

create or replace function public.moderate_recipe_suggestion(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_id uuid := (payload ->> 'contributionId')::uuid;
  decision text := lower(coalesce(payload ->> 'decision', ''));
  changed public.contributions%rowtype;
begin
  if actor is null then raise exception 'Sign in to manage suggestions'; end if;
  if decision not in ('accepted', 'declined') then raise exception 'Invalid suggestion decision'; end if;

  update public.contributions c set status = decision::public.contribution_status
  from public.recipes r
  where c.id = target_id
    and c.recipe_id = r.id
    and r.author_id = actor
    and c.type = 'tweak'
    and c.status = 'pending'
    and not c.hidden
  returning c.* into changed;
  if changed.id is null then raise exception 'Suggestion not found or already decided'; end if;

  return jsonb_build_object('id', changed.id, 'status', changed.status);
end;
$$;

revoke all on function public.get_recipe_discussion(text) from public;
revoke all on function public.post_recipe_discussion(jsonb) from public, anon;
revoke all on function public.toggle_recipe_discussion_like(uuid) from public, anon;
revoke all on function public.moderate_recipe_suggestion(jsonb) from public, anon;
grant execute on function public.get_recipe_discussion(text) to anon, authenticated;
grant execute on function public.post_recipe_discussion(jsonb) to authenticated;
grant execute on function public.toggle_recipe_discussion_like(uuid) to authenticated;
grant execute on function public.moderate_recipe_suggestion(jsonb) to authenticated;

comment on function public.get_recipe_discussion(text) is 'Returns safe public recipe discussion data, including viewer-specific like state.';
comment on function public.post_recipe_discussion(jsonb) is 'Creates rate-limited comments, replies, and author-reviewable recipe suggestions.';
