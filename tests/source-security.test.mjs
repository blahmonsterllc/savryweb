import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin API is covered by the authenticated middleware branch', async () => {
  const middleware = await source('middleware.ts')
  assert.doesNotMatch(middleware, /Always allow admin auth endpoints/)
  assert.match(middleware, /pathname\.startsWith\('\/api\/admin'\)/)
  assert.match(middleware, /Admin authorization required/)
})




test('native bootstrap exposes only publishable Supabase configuration', async () => {
  const config = await source('pages/api/public/config.ts')
  assert.match(config, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/)
  assert.doesNotMatch(config, /SUPABASE_SECRET_KEY/)
  assert.doesNotMatch(config, /service.role/i)
})

test('recipe discussion uses Supabase RPCs and never the retired app API', async () => {
  const discussion = await source('components/RecipeDiscussion.tsx')
  assert.match(discussion, /get_recipe_discussion/)
  assert.match(discussion, /post_recipe_discussion/)
  assert.match(discussion, /toggle_recipe_discussion_like/)
  assert.match(discussion, /moderate_recipe_suggestion/)
  assert.doesNotMatch(discussion, /\/api\/app\/community/)
})

test('advertising is consent-aware and loaded only from the official Google endpoint', async () => {
  const ad = await source('components/AdSlotClient.tsx')
  assert.match(ad, /savry_ad_consent/)
  assert.match(ad, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/)
  assert.match(ad, /Advertisement/)
})

test('ad slots are hidden for Savry+ members on the server', async () => {
  const wrapper = await source('components/AdSlot.tsx')
  assert.match(wrapper, /getViewerMembership/)
  assert.match(wrapper, /if \(isMember\) return null/)
  const membership = await source('lib/viewer-membership.ts')
  assert.match(membership, /server-only/)
})

test('nothing on the site links back to Firebase or the legacy app API', async () => {
  const { readdir } = await import('node:fs/promises')
  const path = await import('node:path')
  async function walk(dir) {
    const out = []
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...await walk(full))
      else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) out.push(full)
    }
    return out
  }
  const root = new URL('..', import.meta.url).pathname
  const files = (await Promise.all(['app', 'components', 'lib', 'pages', 'middleware.ts'].map(async (p) => {
    const full = path.join(root, p)
    return p.endsWith('.ts') ? [full] : walk(full)
  }))).flat()
  for (const file of files) {
    const text = await source(path.relative(root, file))
    // The admin health check names the retired variables on purpose, to flag them if they ever come back.
    if (file.endsWith('pages/api/admin/health.ts')) {
      assert.match(text, /retired-env/, 'health check must keep flagging retired secrets')
      continue
    }
    assert.doesNotMatch(text, /firebase|firestore|ENABLE_LEGACY_APP_API|\/api\/app\//i, `${file} still references Firebase or the legacy API`)
    // Media lives in the Savry Supabase project only. Cloudflare R2 belongs to a
    // different project (the "jobsite" bucket) and must never be wired in here.
    assert.doesNotMatch(text, /jobsite|r2\.cloudflarestorage\.com|r2\.dev|@aws-sdk\/client-s3|R2_(ACCOUNT|ACCESS|SECRET|BUCKET)/i, `${file} references Cloudflare R2 storage; Savry media stays in Supabase`)
  }
})

test('uploads go only to the Savry Supabase recipe-images bucket', async () => {
  for (const file of ['components/RecipeComposer.tsx', 'components/RecipeDiscussion.tsx']) {
    const text = await source(file)
    for (const match of text.matchAll(/storage\.from\(['"]([^'"]+)['"]\)/g)) {
      assert.equal(match[1], 'recipe-images', `${file} uploads to an unexpected bucket: ${match[1]}`)
    }
  }
  const migration = await source('supabase/migrations/20260930210000_lockdown_and_community_rpcs.sql')
  assert.match(migration, /storage_public_base', 'https:\/\/qnpekzrchqftdoaebzuf\.supabase\.co\/storage\/v1\/object\/public\/recipe-images'/, 'storage base must be the Savry Supabase bucket')
  assert.match(migration, /requested_image_url not like storage_base \|\| '\/%'/, 'publish_recipe must reject image URLs outside the Savry bucket')
})

test('recipe pages escape JSON-LD', async () => {
  const page = await source('app/recipes/[slug]/page.tsx')
  assert.match(page, /safeJsonLd\(/)
  assert.doesNotMatch(page, /__html: JSON\.stringify/)
})
