-- From the 2026-10-04 security review.
--
-- 1. A member could select every other member's tier, email_opt_in and
--    terms_accepted_at straight from profiles: those column grants were made
--    for the site's own membership check, which now reads my_profile()
--    (SECURITY DEFINER, own row only) instead. Public display columns stay.
revoke select (tier, is_banned, email_opt_in, terms_accepted_at, updated_at) on public.profiles from authenticated;

-- 2. A recipe's image path can only point inside the author's own folder;
--    publish_recipe checks the prefix, this closes the ".." case too.
alter table public.recipes drop constraint if exists recipes_image_path_no_traversal;
alter table public.recipes add constraint recipes_image_path_no_traversal
  check (image_path is null or (image_path !~ '\.\.' and image_path !~ '^/'));
alter table public.profiles drop constraint if exists profiles_avatar_path_no_traversal;
alter table public.profiles add constraint profiles_avatar_path_no_traversal
  check (avatar_path is null or (avatar_path !~ '\.\.' and avatar_path !~ '^/'));
