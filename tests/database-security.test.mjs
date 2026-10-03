import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const community = await readFile(new URL('../supabase/migrations/20260928160000_savry_community.sql', import.meta.url), 'utf8')
const publish = await readFile(new URL('../supabase/migrations/20260929193000_web_soft_launch.sql', import.meta.url), 'utf8')
const publishV2 = await readFile(new URL('../supabase/migrations/20260930110000_publish_recipe_v2_nutrition.sql', import.meta.url), 'utf8')
const hardening = await readFile(new URL('../supabase/migrations/20260930123000_harden_internal_functions.sql', import.meta.url), 'utf8')
const discussions = await readFile(new URL('../supabase/migrations/20260930150000_recipe_discussions.sql', import.meta.url), 'utf8')
const lockdown = await readFile(new URL('../supabase/migrations/20260930210000_lockdown_and_community_rpcs.sql', import.meta.url), 'utf8')

test('community tables use row-level security and private operational tables are revoked', () => {
  for (const table of ['profiles', 'recipes', 'recipe_ingredients', 'recipe_steps', 'recipe_versions', 'contributions', 'recipe_saves', 'profile_follows', 'reports', 'moderation_queue', 'daily_usage']) {
    assert.match(community, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
  }
  assert.match(community, /revoke all on public\.moderation_queue, public\.daily_usage from anon, authenticated/i)
})

test('publishing is authenticated, rights-attested, rate-limited, and path-isolated', () => {
  assert.match(publish, /if actor is null then raise exception 'Sign in to publish'/)
  assert.match(publish, /rightsAttested/)
  assert.match(publish, /Daily publishing limit reached/)
  assert.match(publish, /requested_image_path not like actor::text \|\| '\/%'/)
  assert.match(publish, /revoke all on function public\.publish_recipe\(jsonb\) from public, anon/)
  assert.match(publish, /grant execute on function public\.publish_recipe\(jsonb\) to authenticated/)
})

test('v2 publishing validates nutrition, records provenance, and remains authenticated', () => {
  assert.match(publishV2, /nutrition \?& array/)
  assert.match(publishV2, /calories > 20000/)
  assert.match(publishV2, /sodium > 100000/)
  assert.match(publishV2, /coverage > 1/)
  assert.match(publishV2, /usdaFoodDataCentral/)
  assert.match(publishV2, /where id = target_id and author_id = actor/)
  assert.match(publishV2, /revoke all on function public\.publish_recipe_v2\(jsonb\) from public, anon/)
  assert.match(publishV2, /grant execute on function public\.publish_recipe_v2\(jsonb\) to authenticated/)
})

test('internal database helpers and storage listing are not client-callable', () => {
  for (const signature of [
    'handle_new_user\\(\\)',
    'ingredient_search_trigger\\(\\)',
    'refresh_recipe_search\\(uuid\\)',
    'sync_membership_tier\\(\\)',
  ]) {
    assert.match(hardening, new RegExp(`revoke all on function public\\.${signature} from public, anon, authenticated`, 'i'))
  }
  assert.match(hardening, /revoke all on function public\.publish_recipe\(jsonb\) from authenticated/i)
  assert.match(hardening, /drop policy if exists "recipe images public" on storage\.objects/i)
})

test('recipe discussions are authenticated, rate-limited, threaded, and RPC-only for writes', () => {
  assert.match(discussions, /if actor is null then raise exception 'Sign in to join the discussion'/)
  assert.match(discussions, /char_length\(body\) < 2 or char_length\(body\) > 2000/)
  assert.match(discussions, /usage_row\.contributions > 50/)
  assert.match(discussions, /usage_row\.tweaks > 10/)
  assert.match(discussions, /parent_id is null/)
  assert.match(discussions, /recipe_id = target_recipe\.id/)
  assert.match(discussions, /r\.author_id = actor/)
  assert.match(discussions, /drop policy if exists "members contribute"/i)
  assert.match(discussions, /revoke insert, update, delete on public\.contributions from anon, authenticated/i)
  assert.match(discussions, /revoke all on public\.contribution_likes from public, anon, authenticated/i)
  assert.match(discussions, /grant execute on function public\.get_recipe_discussion\(text\) to anon, authenticated/i)
  for (const signature of ['post_recipe_discussion\\(jsonb\\)', 'toggle_recipe_discussion_like\\(uuid\\)', 'moderate_recipe_suggestion\\(jsonb\\)']) {
    assert.match(discussions, new RegExp(`grant execute on function public\\.${signature} to authenticated`, 'i'))
  }
})

test('clients cannot write recipes, ingredients, steps, or reports directly', () => {
  assert.match(lockdown, /revoke insert, update, delete on public\.recipes, public\.recipe_ingredients, public\.recipe_steps from anon, authenticated/)
  assert.match(lockdown, /revoke insert on public\.reports from anon, authenticated/)
  assert.match(lockdown, /drop policy if exists "members create recipes"/)
})

test('members can only edit harmless profile columns', () => {
  assert.match(lockdown, /revoke update on public\.profiles from authenticated/)
  assert.match(lockdown, /grant update \(display_name, bio, avatar_path, username, email_opt_in\) on public\.profiles to authenticated/)
  assert.match(lockdown, /profiles_display_name_check/)
})

test('community writes require standing, screening, and proof', () => {
  assert.match(lockdown, /create or replace function public\.assert_can_write/)
  assert.match(lockdown, /email_confirmed_at/)
  assert.match(lockdown, /create or replace function public\.screen_text/)
  assert.match(lockdown, /if proof_kind not in \('cooking_mode', 'mark_made'\)/)
  assert.match(lockdown, /Add a photo of your finished dish to count a Made It/)
  assert.match(lockdown, /contributions_made_daily_idx/)
  assert.match(lockdown, /contributions_one_pending_tweak_idx/)
})

test('reports auto-hide and admin functions are service-role only', () => {
  assert.match(lockdown, /hide := new_count >= threshold or \(reason = 'unsafe' and new_count >= 2\)/)
  assert.match(lockdown, /grant execute on function public\.admin_moderate\(jsonb\) to service_role/)
  assert.match(lockdown, /revoke all on function public\.admin_moderate\(jsonb\) from public, anon, authenticated/)
})

test('republishing and accepted tweaks keep version history', () => {
  assert.match(lockdown, /snapshot_recipe_version\(existing_id, actor, 'Republished by the author'\)/)
  assert.match(lockdown, /snapshot_recipe_version\(recipe\.id, actor, 'Accepted a community tweak', tweak\.id\)/)
})

test('profile settings: identity fields change only through the screened RPC', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260930230000_profile_settings.sql', import.meta.url), 'utf8')
  assert.match(migration, /revoke update on public\.profiles from authenticated/, 'clients must not update profiles directly')
  assert.doesNotMatch(migration, /grant update[^;]*on public\.profiles/, 'no column-level update grant should come back')
  assert.match(migration, /grant execute on function public\.update_my_profile\(jsonb\) to authenticated/)
  assert.match(migration, /revoke all on function public\.update_my_profile\(jsonb\) from public, anon/)
  assert.match(migration, /grant execute on function public\.username_available\(text\) to anon, authenticated/)
  assert.match(migration, /reserved_usernames/, 'reserved handles table')
  assert.match(migration, /public\.screen_text\(new_name\)/, 'display names are screened')
  assert.match(migration, /public\.screen_text\(new_bio\)/, 'bios are screened')
  assert.match(migration, /new_avatar not like actor::text \|\| '\/%'/, 'avatars must live in the cook\'s own folder')
  assert.match(migration, /website links must start with https:\/\//i, 'only https websites')
  // Anonymous readers only see cooks who opted into a public page or published.
  assert.match(migration, /create policy "public read cook profiles" on public\.profiles for select to anon using \(\s*not is_banned and \(\s*username is not null/s)
})

test('admin tools are service-role only and the audit covers the core invariants', async () => {
  const admin = await readFile(new URL('../supabase/migrations/20260930235000_admin_tools.sql', import.meta.url), 'utf8')
  for (const fn of ['admin_stats()', 'admin_security_audit()', 'admin_members(text, integer)', 'admin_reports(integer)', 'admin_set_recipe_visibility(uuid, text)', 'admin_recipes(text, integer)']) {
    assert.match(admin, new RegExp(`revoke all on function public\\.${fn.replace(/[()]/g, (m) => '\\' + m)} from public, anon, authenticated`), `${fn} must be revoked from clients`)
    assert.match(admin, new RegExp(`grant execute on function public\\.${fn.replace(/[()]/g, (m) => '\\' + m)} to service_role`), `${fn} must be granted to service_role`)
  }
  for (const id of ['rls', 'anon-writes', 'member-writes', 'definer-path', 'admin-functions', 'storage-limit', 'banned-content', 'apple-secret']) {
    assert.match(admin, new RegExp(`'id', '${id}'`), `audit check ${id}`)
  }
})

test('memberships are written only by the server, and one purchase belongs to one account', async () => {
  const membership = await readFile(new URL('../supabase/migrations/20261002010000_app_store_membership.sql', import.meta.url), 'utf8')
  for (const fn of ['record_app_store_membership(uuid, jsonb)', 'apply_app_store_notification(jsonb)', 'expire_lapsed_memberships()']) {
    const escaped = fn.replace(/[()]/g, (m) => '\\' + m)
    assert.match(membership, new RegExp(`revoke all on function public\\.${escaped} from public, anon, authenticated`), `${fn} must be revoked from clients`)
    assert.match(membership, new RegExp(`grant execute on function public\\.${escaped} to service_role`), `${fn} must be granted to service_role`)
  }
  assert.equal((membership.match(/security definer set search_path = ''/g) ?? []).length, 3)
  assert.doesNotMatch(membership, /auth\.uid\(\)/, 'the caller is named by the server, which verified the session')
  assert.match(membership, /owner_id is not null and owner_id <> target_user/, 'a purchase linked to one account is refused for another')
  assert.doesNotMatch(membership, /update public\.profiles/, 'the tier changes only through the membership trigger')
})

test('publishing has a quality gate and new cooks wait for an editor', async () => {
  const gate = await readFile(new URL('../supabase/migrations/20261002020000_publish_quality_gate.sql', import.meta.url), 'utf8')
  assert.ok(gate.indexOf('public.recipe_quality_problem(payload)') < gate.indexOf('result := public.publish_recipe(payload)'), 'the gate runs before anything is written')
  assert.match(gate, /named_ingredients < 2/)
  assert.match(gate, /usable_steps < 2 or method_length < 80/)
  assert.match(gate, /if not already_public and not public\.cook_is_trusted\(actor, target_id\) then/, 'the recipe being published must not count toward trust')
  assert.match(gate, /set visibility = 'private', review_hold = true/)
  assert.match(gate, /revoke all on function public\.cook_is_trusted\(uuid, uuid\) from public, anon, authenticated/)
  assert.doesNotMatch(gate, /payload ->> 'status'|payload ->> 'visibility'|payload ->> 'trusted'/, 'standing is never taken from the client')
})

test('cooks can take down or delete only their own recipes; admins can delete any', async () => {
  const removal = await readFile(new URL('../supabase/migrations/20261002030000_remove_own_recipe.sql', import.meta.url), 'utf8')
  assert.match(removal, /revoke all on function public\.admin_delete_recipe\(uuid\) from public, anon, authenticated/)
  assert.match(removal, /grant execute on function public\.admin_delete_recipe\(uuid\) to service_role/)
  assert.match(removal, /security definer set search_path = ''/)
  assert.match(lockdown, /function public\.unpublish_recipe\(target_slug text\)[\s\S]*?where slug = target_slug and author_id = actor/, 'unpublish touches only the caller\'s own recipe')
  assert.match(lockdown, /function public\.delete_my_recipe\(target_slug text\)[\s\S]*?delete from public\.recipes where slug = target_slug and author_id = actor/, 'delete touches only the caller\'s own recipe')
  const hub = await readFile(new URL('../components/AccountHub.tsx', import.meta.url), 'utf8')
  assert.match(hub, /rpc\('unpublish_recipe'/)
  assert.match(hub, /rpc\('delete_my_recipe'/)
  assert.match(hub, /confirming === recipe\.slug/, 'deleting asks first')
})

test('following is server-managed, respects blocks and bans, and the feed shows only public work', async () => {
  const feed = await readFile(new URL('../supabase/migrations/20261003000000_follows_and_feed.sql', import.meta.url), 'utf8')
  assert.match(feed, /revoke insert, update, delete on public\.profile_follows from anon, authenticated/, 'follows are written only through toggle_follow')
  assert.match(feed, /perform public\.assert_can_write\(actor\)/, 'banned or unconfirmed accounts cannot follow')
  assert.match(feed, /if target\.id is null or target\.is_banned then raise exception/)
  assert.match(feed, /You can''t follow this cook/, 'blocks in either direction stop a follow')
  assert.match(feed, /where r\.visibility = 'public' and r\.published_at is not null/, 'only public recipes reach the feed')
  assert.match(feed, /c\.type = 'made' and not c\.hidden/)
  assert.match(feed, /c\.type = 'tweak' and c\.status = 'accepted' and not c\.hidden/)
  assert.match(feed, /where not p\.is_banned/)
  assert.match(feed, /b\.blocker_id = viewer and b\.blocked_id = e\.cook_id/, 'a member never sees cooks they blocked')
  assert.match(feed, /revoke all on function public\.cook_card\(public\.profiles\) from public, anon, authenticated/)
  assert.match(feed, /create trigger user_blocks_drop_follows after insert on public\.user_blocks/, 'a block ends the follow both ways')
  assert.equal((feed.match(/security definer set search_path = ''/g) ?? []).length, 7)
})

test('notifications are written only by triggers, never for your own actions or from someone you blocked', async () => {
  const n = await readFile(new URL('../supabase/migrations/20261003010000_notifications.sql', import.meta.url), 'utf8')
  assert.match(n, /revoke all on public\.notifications from public, anon, authenticated/, 'clients never touch the table directly')
  assert.match(n, /if recipient is null or recipient = actor then return; end if;/, 'no notification about your own action')
  assert.match(n, /b\.blocker_id = recipient and b\.blocked_id = actor/, 'blocked cooks cannot reach your inbox')
  assert.match(n, /where user_id = actor and read_at is null/, 'you can only mark your own as read')
  assert.match(n, /where n\.user_id = auth\.uid\(\)/, 'you only read your own')
  for (const trigger of ['contributions_notify', 'profile_follows_notify', 'recipes_notify_live']) assert.match(n, new RegExp(`create trigger ${trigger} `))
  assert.equal((n.match(/security definer set search_path = ''/g) ?? []).length, 7)
})

test('onboarding records tastes for the signed-in cook only, bounded', async () => {
  const o = await readFile(new URL('../supabase/migrations/20261003020000_onboarding.sql', import.meta.url), 'utf8')
  assert.match(o, /if actor is null then raise exception 'Sign in first'/)
  assert.match(o, /raise exception 'Pick up to twelve of each'/)
  assert.match(o, /where id = actor;/, 'only the caller\'s profile changes')
  assert.match(o, /revoke all on function public\.finish_onboarding\(text\[\], text\[\]\) from public, anon/)
  assert.match(o, /'onboardedAt', p\.onboarded_at/, 'my_profile reports whether the table is set')
})

test('collections are written only through screened, owner-scoped functions and show only public work', async () => {
  const c = await readFile(new URL('../supabase/migrations/20261003030000_collections.sql', import.meta.url), 'utf8')
  assert.match(c, /revoke all on public\.collections, public\.collection_items from public, anon, authenticated/)
  assert.match(c, /perform public\.assert_can_write\(actor\)/, 'banned or unconfirmed accounts cannot create collections')
  assert.match(c, /perform public\.screen_text_or_raise\(clean_title\)/, 'titles are screened like every other text')
  assert.match(c, /where owner_id = actor and slug = target_slug/, 'updates and deletes touch only the caller\'s own')
  assert.match(c, /r\.visibility = 'public' or r\.author_id = actor/, 'only public recipes or your own go into a collection')
  assert.match(c, /and \(c\.is_public or c\.owner_id = auth\.uid\(\)\)/, 'private collections are the owner\'s alone')
  assert.match(c, /not a\.is_banned/, 'recipes from banned cooks drop out of collections')
  assert.equal((c.match(/security definer set search_path = ''/g) ?? []).length, 8)
})
