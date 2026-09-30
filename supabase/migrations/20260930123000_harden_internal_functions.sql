-- Remove direct API access to trigger/helper functions. PostgreSQL triggers
-- continue to invoke these as their owner; clients have no reason to call them.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.ingredient_search_trigger() from public, anon, authenticated;
revoke all on function public.refresh_recipe_search(uuid) from public, anon, authenticated;
revoke all on function public.sync_membership_tier() from public, anon, authenticated;

-- All current clients use v2. Keeping v1 defined lets v2 reuse its atomic core,
-- but prevents clients from bypassing v2 nutrition validation and provenance.
revoke all on function public.publish_recipe(jsonb) from authenticated;

-- A public bucket can serve a known public object URL without an object SELECT
-- policy. Removing this broad policy prevents anonymous bucket enumeration.
drop policy if exists "recipe images public" on storage.objects;

comment on function public.publish_recipe_v2(jsonb) is
  'Only client-callable recipe publisher. Authenticated, rights-attested, rate-limited, owner-scoped, and nutrition-validated.';
