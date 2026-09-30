import test from 'node:test'
import assert from 'node:assert/strict'
import { legacyAppApiEnabled, safeReturnPath, securityHeaders } from '../lib/security-policy.mjs'

test('auth callbacks only return to local application paths', () => {
  assert.equal(safeReturnPath('/account'), '/account')
  assert.equal(safeReturnPath('/recipes/new?from=login'), '/recipes/new?from=login')
  for (const attack of ['https://evil.example', '//evil.example', '/\\evil.example', '\\evil.example', '', null]) {
    assert.equal(safeReturnPath(attack), '/account')
  }
})

test('legacy app APIs require an explicit opt-in', () => {
  assert.equal(legacyAppApiEnabled(undefined), false)
  assert.equal(legacyAppApiEnabled('false'), false)
  assert.equal(legacyAppApiEnabled('TRUE'), false)
  assert.equal(legacyAppApiEnabled('true'), true)
})

test('baseline browser security headers remain enabled', () => {
  const headers = Object.fromEntries(securityHeaders().map(({ key, value }) => [key, value]))
  assert.equal(headers['X-Content-Type-Options'], 'nosniff')
  assert.equal(headers['X-Frame-Options'], 'DENY')
  assert.match(headers['Permissions-Policy'], /camera=\(\)/)
  assert.equal(headers['Cross-Origin-Opener-Policy'], 'same-origin')
})
