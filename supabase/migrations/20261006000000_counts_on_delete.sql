-- Counts stay right when rows go away. The stored counts (followers and
-- following on profiles, saves / made-its / comments on recipes, likes /
-- replies / made-its on contributions, items in a collection) were only
-- updated inside the toggle and post functions, so anything removed another
-- way left them too high: an account deletion cascading its follows, saves,
-- likes and Made Its; a recipe deletion emptying collections; an admin
-- removing a comment.
--
-- These AFTER DELETE triggers keep them right however a row is removed.
-- Counts the functions recompute from their table (followers, saves, likes,
-- collection items) are recomputed the same way. Counts the functions only
-- ever add to (made-its, comments, replies) are taken back down by one per
-- removed row, matching exactly what was added, so seeded or imported
-- figures are not reset. Updates that land on a row being deleted in the
-- same cascade find nothing and do nothing, so account and recipe deletion
-- cascades still complete.

-- Follows: both cooks' counts.
create or replace function public.recount_follows_on_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles p
  set follower_count = (select count(*) from public.profile_follows f where f.followed_id = p.id),
      following_count = (select count(*) from public.profile_follows f where f.follower_id = p.id)
  where p.id in (old.follower_id, old.followed_id);
  return old;
end $$;
drop trigger if exists profile_follows_recount on public.profile_follows;
create trigger profile_follows_recount after delete on public.profile_follows
for each row execute function public.recount_follows_on_delete();

-- Saves: the recipe's save count.
create or replace function public.recount_saves_on_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.recipes r
  set save_count = (select count(*) from public.recipe_saves s where s.recipe_id = r.id)
  where r.id = old.recipe_id;
  return old;
end $$;
drop trigger if exists recipe_saves_recount on public.recipe_saves;
create trigger recipe_saves_recount after delete on public.recipe_saves
for each row execute function public.recount_saves_on_delete();

-- Likes: the post's like count.
create or replace function public.recount_likes_on_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.contributions c
  set like_count = (select count(*) from public.contribution_likes l where l.contribution_id = c.id)
  where c.id = old.contribution_id;
  return old;
end $$;
drop trigger if exists contribution_likes_recount on public.contribution_likes;
create trigger contribution_likes_recount after delete on public.contribution_likes
for each row execute function public.recount_likes_on_delete();

-- Collection items: the collection's item count.
create or replace function public.recount_collection_on_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.collections c
  set item_count = (select count(*) from public.collection_items i where i.collection_id = c.id)
  where c.id = old.collection_id;
  return old;
end $$;
drop trigger if exists collection_items_recount on public.collection_items;
create trigger collection_items_recount after delete on public.collection_items
for each row execute function public.recount_collection_on_delete();

-- Contributions: take back exactly what posting one added.
--   made     → recipe made_count (record_made_it), and the tweak it was made
--              with, when that tweak is someone else's
--   comment  → recipe comment_count, and the parent's reply_count for a reply
--   tweak    → recipe comment_count (post_tweak and suggestions both count)
create or replace function public.uncount_contribution_on_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.type = 'made' then
    update public.recipes set made_count = greatest(made_count - 1, 0) where id = old.recipe_id;
    if old.tweak_id is not null then
      update public.contributions set made_count = greatest(made_count - 1, 0)
      where id = old.tweak_id and user_id <> old.user_id;
    end if;
  elsif old.type in ('comment', 'tweak') then
    update public.recipes set comment_count = greatest(comment_count - 1, 0) where id = old.recipe_id;
    if old.parent_id is not null then
      update public.contributions set reply_count = greatest(reply_count - 1, 0) where id = old.parent_id;
    end if;
  end if;
  return old;
end $$;
drop trigger if exists contributions_uncount on public.contributions;
create trigger contributions_uncount after delete on public.contributions
for each row execute function public.uncount_contribution_on_delete();

revoke all on function public.recount_follows_on_delete() from public, anon, authenticated;
revoke all on function public.recount_saves_on_delete() from public, anon, authenticated;
revoke all on function public.recount_likes_on_delete() from public, anon, authenticated;
revoke all on function public.recount_collection_on_delete() from public, anon, authenticated;
revoke all on function public.uncount_contribution_on_delete() from public, anon, authenticated;

-- One-time repair of the counts that are recomputed from their table, for
-- deletions that already happened. (Made-it and comment counts are additive
-- and are left as they are.)
update public.profiles p
set follower_count = (select count(*) from public.profile_follows f where f.followed_id = p.id),
    following_count = (select count(*) from public.profile_follows f where f.follower_id = p.id)
where follower_count <> (select count(*) from public.profile_follows f where f.followed_id = p.id)
   or following_count <> (select count(*) from public.profile_follows f where f.follower_id = p.id);
update public.recipes r set save_count = (select count(*) from public.recipe_saves s where s.recipe_id = r.id)
where save_count <> (select count(*) from public.recipe_saves s where s.recipe_id = r.id);
update public.contributions c set like_count = (select count(*) from public.contribution_likes l where l.contribution_id = c.id)
where like_count <> (select count(*) from public.contribution_likes l where l.contribution_id = c.id);
update public.collections c set item_count = (select count(*) from public.collection_items i where i.collection_id = c.id)
where item_count <> (select count(*) from public.collection_items i where i.collection_id = c.id);
