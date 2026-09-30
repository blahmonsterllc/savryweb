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

test('legacy Apple token shortcut cannot issue sessions', async () => {
  const apple = await source('pages/api/auth/apple.ts')
  assert.match(apple, /LEGACY_AUTH_RETIRED/)
  assert.match(apple, /status\(410\)/)
  assert.doesNotMatch(apple, /substring\(0,\s*20\)/)
  assert.doesNotMatch(apple, /generateJWT/)
})

test('legacy Firebase registration cannot create a second account identity', async () => {
  const register = await source('pages/api/auth/register.ts')
  assert.match(register, /LEGACY_REGISTRATION_RETIRED/)
  assert.match(register, /status\(410\)/)
  assert.doesNotMatch(register, /createUser/)
})

test('legacy app API is fail-closed', async () => {
  const middleware = await source('middleware.ts')
  assert.match(middleware, /ENABLE_LEGACY_APP_API/)
  assert.match(middleware, /status:\s*503/)
})

test('native bootstrap exposes only publishable Supabase configuration', async () => {
  const config = await source('pages/api/public/config.ts')
  assert.match(config, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/)
  assert.doesNotMatch(config, /SUPABASE_SECRET_KEY/)
  assert.doesNotMatch(config, /service.role/i)
})
