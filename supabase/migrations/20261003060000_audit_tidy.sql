-- Audit tidy-up: trigger functions are never meant to be called by clients.
-- Postgres refuses to run them outside a trigger anyway; this removes the
-- grant so the audit's "anon may execute" list is exactly the read set.
revoke all on function public.drop_follows_on_block() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.recipe_row_search_trigger() from public, anon, authenticated;
