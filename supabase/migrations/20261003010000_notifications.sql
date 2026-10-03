-- Notifications: a cook hears when something happens to their work.
--
--   made            someone made your recipe
--   note            someone left a cook note on your recipe
--   reply           someone replied to your note
--   tweak           someone suggested a tweak to your recipe
--   tweak_accepted  the author accepted your tweak
--   tweak_declined  the author declined your tweak
--   follow          someone followed you
--   recipe_live     an editor put your recipe on the table
--
-- Rows are written only by triggers (never by clients), never for your own
-- actions, and never from someone you blocked. Read through my_notifications;
-- mark read through mark_notifications_read.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('made', 'note', 'reply', 'tweak', 'tweak_accepted', 'tweak_declined', 'follow', 'recipe_live')),
  actor_id uuid references public.profiles(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete cascade,
  contribution_id uuid references public.contributions(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_inbox_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;
-- The same event never lands twice (a follow toggled on and off and on again).
create unique index if not exists notifications_once_idx on public.notifications (user_id, kind, actor_id, coalesce(recipe_id, '00000000-0000-0000-0000-000000000000'), coalesce(contribution_id, '00000000-0000-0000-0000-000000000000'));

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select, insert, update, delete on public.notifications to service_role;

-- One place that decides whether a notification is wanted.
create or replace function public.notify(recipient uuid, kind text, actor uuid, recipe uuid default null, contribution uuid default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if recipient is null or recipient = actor then return; end if;
  if actor is not null and exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = recipient and b.blocked_id = actor) or (b.blocker_id = actor and b.blocked_id = recipient)
  ) then return; end if;
  if actor is not null and exists (select 1 from public.profiles p where p.id = actor and p.is_banned) then return; end if;
  insert into public.notifications (user_id, kind, actor_id, recipe_id, contribution_id)
  values (recipient, kind, actor, recipe, contribution)
  on conflict do nothing;
end $$;

create or replace function public.notify_on_contribution() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  author uuid;
  parent_author uuid;
begin
  if new.hidden then return new; end if;
  select r.author_id into author from public.recipes r where r.id = new.recipe_id;

  if tg_op = 'INSERT' then
    if new.type = 'made' then
      perform public.notify(author, 'made', new.user_id, new.recipe_id, new.id);
    elsif new.type = 'tweak' then
      perform public.notify(author, 'tweak', new.user_id, new.recipe_id, new.id);
    elsif new.type = 'comment' then
      if new.parent_id is not null then
        select c.user_id into parent_author from public.contributions c where c.id = new.parent_id;
        perform public.notify(parent_author, 'reply', new.user_id, new.recipe_id, new.id);
        if parent_author is distinct from author then
          perform public.notify(author, 'note', new.user_id, new.recipe_id, new.id);
        end if;
      else
        perform public.notify(author, 'note', new.user_id, new.recipe_id, new.id);
      end if;
    end if;
  elsif tg_op = 'UPDATE' and new.type = 'tweak' and old.status = 'pending' and new.status in ('accepted', 'declined') then
    perform public.notify(new.user_id, 'tweak_' || new.status::text, author, new.recipe_id, new.id);
  end if;
  return new;
end $$;
drop trigger if exists contributions_notify on public.contributions;
create trigger contributions_notify after insert or update of status on public.contributions
for each row execute function public.notify_on_contribution();

create or replace function public.notify_on_follow() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify(new.followed_id, 'follow', new.follower_id);
  return new;
end $$;
drop trigger if exists profile_follows_notify on public.profile_follows;
create trigger profile_follows_notify after insert on public.profile_follows
for each row execute function public.notify_on_follow();

-- An editor publishing a held recipe.
create or replace function public.notify_on_recipe_live() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.review_hold and not new.review_hold and new.visibility = 'public' then
    insert into public.notifications (user_id, kind, recipe_id) values (new.author_id, 'recipe_live', new.id)
    on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists recipes_notify_live on public.recipes;
create trigger recipes_notify_live after update of review_hold, visibility on public.recipes
for each row execute function public.notify_on_recipe_live();

-- Reading
create or replace function public.my_notifications(result_limit integer default 40) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'unread', (select count(*) from public.notifications n where n.user_id = auth.uid() and n.read_at is null),
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'kind', x.kind, 'at', x.created_at, 'read', x.read_at is not null,
      'actor', case when a.id is null then null else public.cook_card(a) end,
      'recipe', case when r.id is null then null else jsonb_build_object('slug', r.slug::text, 'title', r.title, 'imageUrl', r.image_url) end,
      'note', left(c.text, 160),
      'photoUrl', case when c.photo_path is null then null else public.setting('storage_public_base') || '/' || c.photo_path end
    ) order by x.created_at desc), '[]'::jsonb)
  )
  from (
    select n.* from public.notifications n
    where n.user_id = auth.uid()
    order by n.created_at desc
    limit greatest(1, least(coalesce(result_limit, 40), 200))
  ) x
  left join public.profiles a on a.id = x.actor_id
  left join public.recipes r on r.id = x.recipe_id
  left join public.contributions c on c.id = x.contribution_id
$$;

create or replace function public.unread_notification_count() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.notifications n where n.user_id = auth.uid() and n.read_at is null
$$;

create or replace function public.mark_notifications_read(ids uuid[] default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  n integer;
begin
  if actor is null then raise exception 'Sign in first'; end if;
  update public.notifications set read_at = now()
  where user_id = actor and read_at is null and (ids is null or id = any(ids));
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.notify(uuid, text, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.notify_on_contribution() from public, anon, authenticated;
revoke all on function public.notify_on_follow() from public, anon, authenticated;
revoke all on function public.notify_on_recipe_live() from public, anon, authenticated;
revoke all on function public.my_notifications(integer) from public, anon;
revoke all on function public.unread_notification_count() from public, anon;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.my_notifications(integer) to authenticated, service_role;
grant execute on function public.unread_notification_count() to authenticated, service_role;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated, service_role;
