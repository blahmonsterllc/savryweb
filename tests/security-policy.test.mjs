import test from 'node:test'
import assert from 'node:assert/strict'
import { safeJsonLd, safeReturnPath, securityHeaders } from '../lib/security-policy.mjs'

test('auth callbacks only return to local application paths', () => {
  assert.equal(safeReturnPath('/account'), '/account')
  assert.equal(safeReturnPath('/recipes/new?from=login'), '/recipes/new?from=login')
  for (const attack of ['https://evil.example', '//evil.example', '/\\evil.example', '\\evil.example', '', null]) {
    assert.equal(safeReturnPath(attack), '/account')
  }
})


test('baseline browser security headers remain enabled', () => {
  const headers = Object.fromEntries(securityHeaders().map(({ key, value }) => [key, value]))
  assert.equal(headers['X-Content-Type-Options'], 'nosniff')
  assert.equal(headers['X-Frame-Options'], 'DENY')
  assert.match(headers['Permissions-Policy'], /camera=\(\)/)
  assert.equal(headers['Cross-Origin-Opener-Policy'], 'same-origin')
})

test('JSON-LD cannot break out of its script element', () => {
  const out = safeJsonLd({ title: '</script><script>alert(1)</script> & \u2028' })
  assert.doesNotMatch(out, /<\/script>/i)
  assert.doesNotMatch(out, /[<>&\u2028\u2029]/)
})

test('security headers include a CSP and HSTS', () => {
  const keys = securityHeaders().map((h) => h.key)
  assert.ok(keys.includes('Content-Security-Policy'))
  assert.ok(keys.includes('Strict-Transport-Security'))
  const csp = securityHeaders().find((h) => h.key === 'Content-Security-Policy').value
  assert.match(csp, /frame-ancestors 'none'/)
  assert.match(csp, /object-src 'none'/)
})
