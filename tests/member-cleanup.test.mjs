import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ownPhotoPaths, recipePagePaths } from '../lib/member-cleanup.mjs'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const me = '0b6f6a52-6a0e-4c1f-9d55-7c8e0c1d2e3f'
const them = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d'

test('photo cleanup keeps only paths in the caller\'s own folder', () => {
  assert.deepEqual(
    ownPhotoPaths(me, [`${me}/recipe-1.jpg`, `${them}/recipe-2.jpg`, `${me}/avatar-1.jpg`, `${me}/recipe-1.jpg`, null, 42, '']),
    [`${me}/recipe-1.jpg`, `${me}/avatar-1.jpg`],
  )
  assert.deepEqual(ownPhotoPaths(me, [`${me}/../${them}/x.jpg`, `${me}//x.jpg`, `${me}/`, `${me}x/y.jpg`, `/${me}/x.jpg`, `${me}\\x.jpg`]), [], 'no traversal, no look-alike folders')
  assert.deepEqual(ownPhotoPaths(me, [`${me}/made/one.jpg`]), [`${me}/made/one.jpg`], 'subfolders of the caller\'s own folder are theirs')
  assert.deepEqual(ownPhotoPaths('', [`/x.jpg`]), [], 'no user id, nothing')
  assert.deepEqual(ownPhotoPaths('not-a-uuid', ['not-a-uuid/x.jpg']), [])
})

test('a recipe change refreshes its page, the lists, and its cook\'s page', () => {
  assert.deepEqual(recipePagePaths({ slug: 'lemon-bars', username: 'ann.cooks' }), ['/recipes/lemon-bars', '/recipes', '/', '/cooks/ann.cooks'])
  assert.deepEqual(recipePagePaths({ slug: null, username: null }), ['/recipes', '/'])
  assert.deepEqual(recipePagePaths({ slug: '../admin', username: 'a/b' }), ['/recipes', '/'], 'nothing odd is revalidated')
  assert.deepEqual(recipePagePaths({ slug: 'lemon-bars', username: 'ann.cooks' }, { lists: false }), ['/recipes/lemon-bars', '/cooks/ann.cooks'], 'member-called refreshes skip the list pages')
})

test('member delete and refresh routes verify the caller and touch only what is theirs', async () => {
  const middleware = await source('middleware.ts')
  for (const path of ['/api/recipes/delete', '/api/recipes/refresh', '/api/account/delete']) {
    assert.ok(middleware.includes(`pathname === '${path}'`), `${path} must reach its own session check`)
  }
  const helper = await source('lib/member-api.ts')
  assert.match(helper, /import 'server-only'/)
  assert.match(helper, /auth\.getUser\(token\)/, 'the session is verified, not just decoded')
  assert.match(helper, /const own = ownPhotoPaths\(userId, paths\)/, 'removal is limited to the caller\'s folder')

  const recipe = await source('pages/api/recipes/delete.ts')
  assert.ok(recipe.indexOf('requireMember(req, res)') < recipe.indexOf('getSupabaseAdmin()'), 'the member is verified before the service role is used')
  assert.match(recipe, /\.eq\('author_id', userId\)/, 'only the caller\'s own recipe')
  assert.match(recipe, /rpc\('delete_my_recipe'/, 'the delete runs as the member')
  assert.doesNotMatch(recipe, /req\.body\?\.(path|imagePath|image_path|paths)/, 'the browser never names a file to delete')

  const refresh = await source('pages/api/recipes/refresh.ts')
  assert.match(refresh, /\.eq\('author_id', member\.user\.id\)/)

  const account = await source('pages/api/account/delete.ts')
  assert.ok(account.indexOf('listOwnPhotos(userId)') < account.indexOf("rpc('delete_my_account')"), 'photos are found before the account goes')
  assert.ok(account.indexOf("rpc('delete_my_account')") < account.indexOf('removeOwnPhotos('), 'photos go only once the account is gone')
  assert.doesNotMatch(account, /req\.body/, 'nothing is taken on the caller\'s word')

  const hub = await source('components/AccountHub.tsx')
  assert.match(hub, /memberPost\('\/api\/account\/delete'\)/)
  assert.match(hub, /memberPost\('\/api\/recipes\/delete'/)
  assert.doesNotMatch(hub, /storage\.from\('recipe-images'\)\.remove/, 'the browser cannot delete storage objects; the server does it')
})
