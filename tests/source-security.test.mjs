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

test('the site carries no advertising, ad scripts, or advertising cookies', async () => {
  const { readdir } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const root = new URL('../', import.meta.url).pathname
  const files = []
  async function walk(dir) {
    for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
      const rel = join(dir, entry.name)
      if (entry.isDirectory()) await walk(rel)
      else if (/\.(tsx?|mjs|css)$/.test(entry.name)) files.push(rel)
    }
  }
  for (const dir of ['app', 'components', 'lib', 'pages']) await walk(dir)
  files.push('middleware.ts')
  for (const file of files) {
    const text = await source(file)
    assert.doesNotMatch(text, /googlesyndication|adsbygoogle|fundingchoices|doubleclick|AdSense|NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID(?!'\])/, `${file} still refers to advertising`)
    assert.doesNotMatch(text, /components\/AdSlot|components\/AdConsent|lib\/ads'/, `${file} imports a removed ad component`)
  }
  const policy = await source('lib/security-policy.mjs')
  assert.match(policy, /"script-src 'self' 'unsafe-inline'" \+ devEval \+ "",/, 'no third-party scripts')
  assert.match(policy, /frame-src 'none'/)
  const terms = await source('app/terms/page.tsx')
  assert.match(terms, /does not show advertisements/)
  const privacy = await source('app/privacy/page.tsx')
  assert.match(privacy, /no advertising/)
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

test('Apple revocation endpoint authenticates the cook and never stores or returns tokens', async () => {
  const route = await source('pages/api/account/apple-revoke.ts')
  assert.match(route, /auth\.getUser\(token\)/, 'must verify the Supabase session before talking to Apple')
  assert.ok(route.indexOf('auth.getUser(token)') < route.indexOf("appleForm('/auth/token'"), 'session check must come before the Apple exchange')
  assert.match(route, /appleid\.apple\.com/, 'talks only to Apple')
  assert.doesNotMatch(route, /res\.status\(200\)\.json\(\{[^}]*(refresh|token)/i, 'must not return tokens')
  assert.doesNotMatch(route, /getSupabaseAdmin\(\)\.from\(|\.insert\(|\.upsert\(|\.storage\./, 'must not persist anything')
})

test('catalog batches are seeded as private drafts only', async () => {
  const seed = await source('scripts/catalog/seed-batch.mjs')
  assert.match(seed, /visibility: 'private', published_at: null/, 'new recipes start private')
  assert.doesNotMatch(seed, /visibility: 'public'/, 'the seeding script must never publish')
  assert.match(seed, /Project guard failed/, 'project guard stays in place')
})

test('member API routes are reachable through the middleware and admin routes are not', async () => {
  const middleware = await source('middleware.ts')
  assert.match(middleware, /pathname === '\/api\/account\/apple-revoke'/, 'the revoke endpoint must pass the middleware to reach its own session check')
  assert.doesNotMatch(middleware, /pathname\.startsWith\('\/api\/admin'\)\s*\|\|\s*\n?\s*pathname === '\/api\/public/, 'admin routes must never be in the public allowlist')
  const allowlist = middleware.slice(middleware.indexOf('function isPublicApiRoute'), middleware.indexOf('type AdminGate'))
  assert.doesNotMatch(allowlist, /admin/, 'nothing under /api/admin may be public')
})

test('no Google OAuth client secret is committed', async () => {
  const { execFileSync } = await import('node:child_process')
  let hits = ''
  try {
    hits = execFileSync('git', ['grep', '-lE', 'GOCSPX-[A-Za-z0-9_-]{20,}', '--', '.', ':!tests'], { encoding: 'utf8' })
  } catch {
    hits = ''
  }
  assert.equal(hits.trim(), '', `secret found in: ${hits}`)
})

test('admin access is a verified Savry session on the admin list, checked twice', async () => {
  const middleware = await source('middleware.ts')
  assert.match(middleware, /supabase\.auth\.getUser\(\)/, 'the session must be verified with Supabase Auth, not just decoded')
  assert.match(middleware, /supabase\.rpc\('is_admin'\)/)
  assert.match(middleware, /isAdmin !== true/, 'anything but an explicit true is not an admin')
  assert.doesNotMatch(middleware, /getSession\(\)/, 'getSession trusts the cookie without verifying it')

  const guard = await source('lib/admin-session.ts')
  assert.match(guard, /supabase\.auth\.getUser\(\)/)
  assert.match(guard, /rpc\('admin_is_admin', \{ target: user\.id \}\)/)
  for (const name of ['health', 'members', 'moderation', 'recipes', 'reports', 'stats']) {
    const handler = await source(`pages/api/admin/${name}.ts`)
    const guardAt = handler.indexOf('if (!(await requireAdmin(req, res))) return')
    const firstUse = handler.indexOf('getSupabaseAdmin()', handler.indexOf('export default async function handler'))
    assert.ok(guardAt > 0, `${name} must check the admin itself`)
    assert.ok(firstUse === -1 || guardAt < firstUse, `${name} must check the admin before using the service role`)
  }

  const migration = await source('supabase/migrations/20261001020000_admin_users.sql')
  assert.match(migration, /alter table public\.admin_users enable row level security/)
  assert.match(migration, /revoke all on public\.admin_users from public, anon, authenticated/)
  assert.doesNotMatch(migration, /create policy/, 'no client may read or write the admin list')
  assert.match(migration, /revoke all on function public\.is_admin\(\) from public, anon/)
  assert.match(migration, /revoke all on function public\.admin_is_admin\(uuid\) from public, anon, authenticated/)
  assert.doesNotMatch(migration, /insert into public\.admin_users/, 'admins are added by hand, never by a migration in a public repo')

  const pkg = JSON.parse(await source('package.json'))
  assert.equal(pkg.dependencies['next-auth'], undefined, 'the Google admin login is retired')
})

test('content patrol only flags, is service-role only, and its schedule needs a secret', async () => {
  const migration = await source('supabase/migrations/20261001030000_patrol.sql')
  for (const fn of ['patrol_next_batch(integer)', 'patrol_record(jsonb)', 'patrol_log_run(jsonb)', 'admin_patrol_flags(integer)', 'admin_patrol_summary()', 'admin_patrol_resolve(uuid, text, uuid)']) {
    const escaped = fn.replace(/[()]/g, (m) => '\\' + m)
    assert.match(migration, new RegExp(`revoke all on function public\\.${escaped} from public, anon, authenticated`), `${fn} must be revoked from clients`)
    assert.match(migration, new RegExp(`grant execute on function public\\.${escaped} to service_role`))
  }
  for (const table of ['patrol_reviews', 'patrol_runs']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`))
    assert.match(migration, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`))
  }
  assert.doesNotMatch(migration, /create policy/, 'patrol tables are closed to clients')

  // The automated side records verdicts and nothing else: no hiding, no bans.
  const record = migration.slice(migration.indexOf('function public.patrol_record'), migration.indexOf('function public.patrol_log_run'))
  assert.doesNotMatch(record, /is_banned|admin_set_ban|set hidden|set visibility/, 'patrol_record must never act on content or accounts')
  const patrol = await source('lib/patrol.ts')
  assert.doesNotMatch(patrol, /admin_set_ban|admin_patrol_resolve|is_banned|\.update\(|\.delete\(/, 'the reviewer must never act on content or accounts')
  assert.match(patrol, /import 'server-only'/)
  assert.doesNotMatch(patrol, /NEXT_PUBLIC_ANTHROPIC/)
  assert.match(patrol, /startsWith\(base\)/, 'only photos in the Savry bucket are fetched')

  const cron = await source('pages/api/cron/patrol.ts')
  assert.match(cron, /timingSafeEqual/)
  assert.match(cron, /if \(!secret\) return res\.status\(503\)/, 'no secret means no runs, never an open endpoint')
  assert.ok(cron.indexOf('return res.status(401)') < cron.indexOf('runPatrol()'), 'the secret is checked before anything runs')

  const admin = await source('pages/api/admin/patrol.ts')
  assert.ok(admin.indexOf('requireAdmin(req, res)') < admin.indexOf('getSupabaseAdmin()'), 'admin check comes first')

  const middleware = await source('middleware.ts')
  assert.match(middleware, /pathname === '\/api\/cron\/patrol'/)
  assert.doesNotMatch(middleware, /startsWith\('\/api\/cron'\)/, 'only the one cron path is public')

  const terms = await source('app/terms/page.tsx')
  assert.match(terms, /Savry is a family site/)
  assert.match(terms, /automated reviewer/)
  const privacy = await source('app/privacy/page.tsx')
  assert.match(privacy, /Anthropic/)
})

test('community browse and saves: one server contract, counts kept by the server', async () => {
  const migration = await source('supabase/migrations/20261002000000_community_browse_and_saves.sql')
  for (const fn of ['recipe_card', 'browse_public_recipes', 'recipe_save_state', 'toggle_recipe_save', 'my_saved_recipes', 'my_published_recipes']) {
    const body = migration.slice(migration.indexOf(`function public.${fn}(`))
    assert.match(body.slice(0, body.indexOf('$$')), /security definer set search_path = ''/, `${fn} pins its search path`)
  }
  assert.match(migration, /revoke all on function public\.recipe_card\(public\.recipes, uuid\) from public, anon, authenticated/, 'the card helper takes any viewer id, so clients must not call it')
  assert.match(migration, /revoke all on function public\.toggle_recipe_save\(text\) from public, anon/)
  assert.match(migration, /revoke all on function public\.my_saved_recipes\(integer, integer\) from public, anon/)
  assert.match(migration, /revoke insert, update, delete on public\.recipe_saves from anon, authenticated/, 'saves go through the function so save_count stays right')
  const browse = migration.slice(migration.indexOf('function public.browse_public_recipes'), migration.indexOf('function public.recipe_save_state'))
  assert.match(browse, /r\.visibility = 'public' and not p\.is_banned/, 'only public recipes from members in good standing')
  assert.match(browse, /user_blocks/, 'blocked cooks are hidden from the member who blocked them')
  assert.match(browse, /least\(greatest\(coalesce\(result_limit, 24\), 1\), 60\)/, 'page size is capped')

  const button = await source('components/SaveRecipeButton.tsx')
  assert.match(button, /rpc\('toggle_recipe_save'/)
  assert.doesNotMatch(button, /from\('recipe_saves'\)/, 'the site never writes saves directly')
})

test('photo uploads are plain inserts of prepared JPEGs into the member\'s own folder', async () => {
  for (const file of ['components/RecipeComposer.tsx', 'components/RecipeDiscussion.tsx', 'components/AccountHub.tsx']) {
    const code = await source(file)
    assert.doesNotMatch(code, /upsert:\s*true/, `${file}: storage refuses an overwrite, so an upsert upload always fails`)
  }
  const discussion = await source('components/RecipeDiscussion.tsx')
  assert.match(discussion, /photoToJPEG\(photo\)/, 'Made It photos are shrunk before upload; raw phone photos exceed the 2 MB limit')
  const helper = await source('lib/photo-upload.ts')
  assert.match(helper, /`\$\{userId\}\/\$\{label\}-\$\{random\}\.jpg`/, 'every upload gets a new path inside the member folder')
})

test('Savry+ purchases reach the site only with Apple\'s signature and the member\'s own session', async () => {
  const sync = await source('pages/api/membership/sync.ts')
  assert.ok(sync.indexOf('auth.getUser(token)') < sync.indexOf('readSavryPlusPurchase('), 'the member is identified before the purchase is read')
  assert.ok(sync.indexOf('readSavryPlusPurchase(') < sync.indexOf("rpc('record_app_store_membership'"), 'the purchase is verified before it is stored')
  assert.match(sync, /target_user: userData\.user\.id/, 'a membership is only ever linked to the caller')
  assert.match(sync, /readSavryPlusPurchase\(req\.body\?\.signedTransaction, userData\.user\.id\)/, 'a purchase bought under another account id is refused')
  assert.doesNotMatch(sync, /req\.body\?\.(userId|user_id|tier|status|expires)/, 'nothing about the membership is taken on the caller\'s word')

  const notifications = await source('pages/api/app-store/notifications.ts')
  assert.ok(notifications.indexOf('verifyAppStoreJWS(req.body?.signedPayload)') < notifications.indexOf('getSupabaseAdmin()'), 'Apple\'s signature is checked before the database is touched')
  assert.match(notifications, /readSavryPlusPurchase\(signedTransaction\)/, 'the transaction inside a notification is verified too')

  const membership = await source('lib/app-store-membership.ts')
  assert.match(membership, /import 'server-only'/)
  assert.match(membership, /verifyAppStoreJWS\(signedTransaction as string\)/, 'the default pinned Apple root is used, never a caller-supplied one')
  assert.doesNotMatch(membership, /trustedRoots/)
  assert.match(membership, /APP_STORE_ALLOW_SANDBOX === 'true'/, 'test purchases count only when switched on')

  const cron = await source('pages/api/cron/memberships.ts')
  assert.match(cron, /timingSafeEqual/)
  assert.match(cron, /if \(!secret\) return res\.status\(503\)/)
  assert.ok(cron.indexOf('return res.status(401)') < cron.indexOf('getSupabaseAdmin()'), 'the secret is checked before anything runs')

  const middleware = await source('middleware.ts')
  assert.match(middleware, /pathname === '\/api\/membership\/sync'/)
  assert.match(middleware, /pathname === '\/api\/cron\/memberships'/)
  assert.match(middleware, /const APP_STORE_NOTIFICATIONS_PATH = '\/api\/app-store\/notifications'/)
  assert.doesNotMatch(middleware, /startsWith\('\/api\/(membership|app-store)'\)/, 'only the exact paths are public')

  const cronConfig = JSON.parse(await source('vercel.json'))
  assert.ok(cronConfig.crons.some((entry) => entry.path === '/api/cron/memberships'), 'the membership expiry runs on a schedule')
})

test('the weekly email sends only to opted-in, confirmed cooks, through a protected cron, with one-click unsubscribe', async () => {
  const cron = await source('pages/api/cron/weekly-email.ts')
  assert.match(cron, /timingSafeEqual/)
  assert.match(cron, /if \(!secret\) return res\.status\(503\)/)
  assert.ok(cron.indexOf('return res.status(401)') < cron.indexOf('sendWeeklyDigests('), 'the secret is checked before anything sends')

  const digest = await source('lib/weekly-digest.ts')
  assert.match(digest, /import 'server-only'/)
  assert.match(digest, /List-Unsubscribe-Post/, 'one-click unsubscribe header on every message')
  assert.match(digest, /if \(!result\.configured && !options\.dryRun\) return result/, 'no key means no sends, never an error')
  assert.doesNotMatch(digest, /NEXT_PUBLIC_RESEND/)

  const unsubscribe = await source('pages/api/email/unsubscribe.ts')
  assert.match(unsubscribe, /unsubscribe_by_token/)
  assert.match(unsubscribe, /name="robots" content="noindex"/)

  const middleware = await source('middleware.ts')
  assert.match(middleware, /pathname === '\/api\/cron\/weekly-email'/)
  assert.match(middleware, /pathname === '\/api\/email\/unsubscribe'/)
  const cronConfig = JSON.parse(await source('vercel.json'))
  assert.deepEqual(cronConfig.crons.map((entry) => entry.path), ['/api/cron/patrol', '/api/cron/memberships', '/api/cron/weekly-email', '/api/cron/recost'])

  const preview = await source('pages/api/admin/digest-preview.ts')
  assert.ok(preview.indexOf('requireAdmin(req, res)') < preview.indexOf('getSupabaseAdmin()'), 'admin check comes first')
})

test('the recipe share card is built from public recipe data only', async () => {
  const card = await source('app/recipes/[slug]/opengraph-image.tsx')
  assert.match(card, /getPublicRecipeBySlug\(params\.slug\)/, 'the same public loader as the page')
  assert.doesNotMatch(card, /getSupabaseAdmin|SUPABASE_SECRET_KEY|service_role/, 'no privileged access')
  assert.match(card, /fonts\.googleapis\.com|fonts\.gstatic\.com/, 'fonts come only from Google Fonts')
  const page = await source('app/recipes/[slug]/page.tsx')
  assert.match(page, /opengraph-image/, 'social previews use the branded card')
})

test('a recipe published on the web gets nutrition from the same USDA engine, or none', async () => {
  const composer = await source('components/RecipeComposer.tsx')
  assert.match(composer, /import\('@\/lib\/nutrition\/compute\.mjs'\)/, 'the shared engine, loaded only at publish')
  assert.match(composer, /result\.coverage < 0\.95\) return null/, 'the same 95% coverage bar as the Savry Kitchen recipes')
  assert.match(composer, /source: 'usdaFoodDataCentral'/)
  assert.match(composer, /nutritionPerServing,/, 'the figures ride along on publish_recipe_v2, which range-checks them')
})

test('the monthly re-price is a protected cron and the price table holds nothing private', async () => {
  const cron = await source('pages/api/cron/recost.ts')
  assert.match(cron, /timingSafeEqual/)
  assert.match(cron, /if \(!secret\) return res\.status\(503\)/)
  assert.ok(cron.indexOf('return res.status(401)') < cron.indexOf('getSupabaseAdmin()'), 'the secret is checked before the database is touched')

  const table = await source('pages/api/prices/table.ts')
  assert.doesNotMatch(table, /supabase|process\.env/i, 'the public table is the shipped file and nothing else')

  const workflow = await source('.github/workflows/bls-prices.yml')
  assert.doesNotMatch(workflow, /SUPABASE_SECRET|SERVICE_ROLE|CRON_SECRET|KROGER_CLIENT_SECRET|sb_secret_/, 'no database key or cron secret lives in GitHub')
  assert.match(workflow, /node --test tests\/\*\.test\.mjs/, 'prices are committed only after the tests pass')
})

test('price pipeline: quota guarded, costs computed on the server, workflow keeps its token to itself', async () => {
  const store = await source('pages/api/prices/store.ts')
  assert.ok(store.indexOf('requireAdmin(req, res)') > -1 && store.indexOf("explain && !(await requireAdmin") > -1, 'explain mode is for admins only')
  assert.match(store, /take_kroger_calls/, 'every Kroger call draws on the shared daily and per-caller budget')
  assert.match(store, /createHash\('sha256'\)/, 'callers are stored as a hash, never an IP address')
  assert.match(store, /callerAllowed\(req\)/, 'each caller is limited')
  assert.match(store, /prices\[id\] && !STORE_SEARCH/, 'only foods Savry prices are looked up')
  assert.doesNotMatch(store, /error\?\.message[^\n]*res\.status/, 'upstream error text never reaches the caller')

  const cost = await source('pages/api/recipes/cost.ts')
  assert.match(cost, /\.eq\('author_id', userData\.user\.id\)/, 'only the caller\'s own recipe')
  assert.match(cost, /is_banned/)
  assert.doesNotMatch(cost, /req\.body\?\.(cost|perServing|price)/, 'the browser never sends a cost')
  const composer = await source('components/RecipeComposer.tsx')
  assert.doesNotMatch(composer, /set_my_recipe_cost/)

  const migration = await source('supabase/migrations/20261005010000_price_pipeline_hardening.sql')
  assert.match(migration, /drop function if exists public\.set_my_recipe_cost/)
  const perCaller = await source('supabase/migrations/20261005020000_kroger_budget_per_caller.sql')
  assert.match(perCaller, /revoke all on function public\.take_kroger_calls\(text, integer, integer, text, integer\) from public, anon, authenticated/)
  assert.match(perCaller, /revoke all on public\.kroger_caller_usage from public, anon, authenticated/)

  const workflow = await source('.github/workflows/bls-prices.yml')
  assert.match(workflow, /persist-credentials: false/)
  assert.match(workflow, /uses: actions\/checkout@[0-9a-f]{40}/, 'actions are pinned to a commit')
  assert.match(workflow, /uses: actions\/setup-node@[0-9a-f]{40}/)
  assert.match(workflow, /npm run build/, 'the price commit is built before it is pushed')

  const refresh = await source('scripts/cost/refresh-bls.mjs')
  assert.match(refresh, /accept-large-moves/, 'a large month-on-month move stops the run')
})
