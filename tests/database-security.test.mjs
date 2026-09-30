import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const community = await readFile(new URL('../supabase/migrations/20260928160000_savry_community.sql', import.meta.url), 'utf8')
const publish = await readFile(new URL('../supabase/migrations/20260929193000_web_soft_launch.sql', import.meta.url), 'utf8')
const publishV2 = await readFile(new URL('../supabase/migrations/20260930110000_publish_recipe_v2_nutrition.sql', import.meta.url), 'utf8')

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
