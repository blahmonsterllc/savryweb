import test from 'node:test'
import assert from 'node:assert/strict'
import { accessConfig, checkAccess, clearAccessKeyCache, isAdminArea, verifyAccessToken } from '../lib/cloudflare-access.mjs'

const TEAM = 'savry-test.cloudflareaccess.com'
const AUD = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
const env = { CLOUDFLARE_ACCESS_TEAM_DOMAIN: TEAM, CLOUDFLARE_ACCESS_AUD: AUD }

const b64url = (bytes) => Buffer.from(bytes).toString('base64url')
const json = (value) => b64url(new TextEncoder().encode(JSON.stringify(value)))

async function keyPair(kid) {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  return { kid, privateKey: pair.privateKey, jwk: { kty: 'RSA', n: jwk.n, e: jwk.e, kid, alg: 'RS256', use: 'sig' } }
}

async function sign(key, claims, header = {}) {
  const head = json({ alg: 'RS256', kid: key.kid, typ: 'JWT', ...header })
  const body = json(claims)
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key.privateKey, new TextEncoder().encode(`${head}.${body}`))
  return `${head}.${body}.${b64url(new Uint8Array(signature))}`
}

const now = Date.now()
const seconds = Math.floor(now / 1000)
const goodClaims = { aud: [AUD], iss: `https://${TEAM}`, email: 'owner@example.com', sub: 'user-1', iat: seconds - 10, nbf: seconds - 10, exp: seconds + 3600 }

const good = await keyPair('key-1')
const stranger = await keyPair('key-1') // same kid, different key: a forgery
const rotated = await keyPair('key-2')

function certsFetch(keys, calls = []) {
  return async (url) => {
    calls.push(url)
    assert.equal(url, `https://${TEAM}/cdn-cgi/access/certs`, 'keys come only from the team domain')
    return new Response(JSON.stringify({ keys: keys.map((k) => k.jwk) }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
}

test('admin area covers the admin pages and admin API only', () => {
  for (const path of ['/admin', '/admin/', '/admin/activity', '/admin/login', '/api/admin', '/api/admin/stats']) assert.ok(isAdminArea(path), path)
  for (const path of ['/', '/administrator', '/adminx', '/api/administrator', '/api/ai/recipe', '/recipes/admin']) assert.ok(!isAdminArea(path), path)
})

test('Access settings must name a cloudflareaccess.com team and a real audience tag', () => {
  assert.ok(accessConfig(env))
  assert.equal(accessConfig({ ...env, CLOUDFLARE_ACCESS_TEAM_DOMAIN: 'https://savry-test.cloudflareaccess.com/' }).teamDomain, TEAM)
  for (const teamDomain of ['', 'evil.com', 'savry.cloudflareaccess.com.evil.com', 'savry.cloudflareaccess.com/path', 'a b.cloudflareaccess.com']) {
    assert.equal(accessConfig({ ...env, CLOUDFLARE_ACCESS_TEAM_DOMAIN: teamDomain }), null, teamDomain)
  }
  assert.equal(accessConfig({ ...env, CLOUDFLARE_ACCESS_AUD: '' }), null)
  assert.equal(accessConfig({ ...env, CLOUDFLARE_ACCESS_AUD: 'short' }), null)
})

test('a token signed by the team for this application is accepted', async () => {
  clearAccessKeyCache()
  const identity = await verifyAccessToken(await sign(good, goodClaims), accessConfig(env), { fetchImpl: certsFetch([good]), now })
  assert.deepEqual(identity, { email: 'owner@example.com', subject: 'user-1' })
})

test('forged, altered, expired, early, and other-application tokens are refused', async () => {
  const config = accessConfig(env)
  const options = { fetchImpl: certsFetch([good]), now }
  clearAccessKeyCache()
  const cases = {
    forged: await sign(stranger, goodClaims),
    otherAudience: await sign(good, { ...goodClaims, aud: ['someone-elses-app-tag-0000000000'] }),
    otherIssuer: await sign(good, { ...goodClaims, iss: 'https://evil.cloudflareaccess.com' }),
    expired: await sign(good, { ...goodClaims, exp: seconds - 3600 }),
    notYet: await sign(good, { ...goodClaims, nbf: seconds + 3600 }),
    noExpiry: await sign(good, { ...goodClaims, exp: undefined }),
    unknownKey: await sign(rotated, goodClaims),
    hs256: await sign(good, goodClaims, { alg: 'HS256' }),
  }
  const valid = await sign(good, goodClaims)
  const [head, , sig] = valid.split('.')
  cases.alteredClaims = `${head}.${json({ ...goodClaims, email: 'attacker@example.com' })}.${sig}`
  cases.algNone = `${json({ alg: 'none', kid: 'key-1' })}.${json(goodClaims)}.`
  cases.garbage = 'not-a-token'
  cases.empty = ''
  for (const [name, token] of Object.entries(cases)) {
    assert.equal(await verifyAccessToken(token, config, options), null, name)
  }
})

test('a rotated key is picked up by fetching the keys again, once', async () => {
  clearAccessKeyCache()
  const calls = []
  let keys = [good]
  const fetchImpl = async (url) => certsFetch(keys, calls)(url)
  assert.ok(await verifyAccessToken(await sign(good, goodClaims), accessConfig(env), { fetchImpl, now }))
  keys = [good, rotated]
  assert.ok(await verifyAccessToken(await sign(rotated, goodClaims), accessConfig(env), { fetchImpl, now }))
  assert.equal(calls.length, 2)
})

test('checkAccess: not configured, allowed, or denied', async () => {
  clearAccessKeyCache()
  assert.deepEqual(await checkAccess('anything', {}), { status: 'not-configured' })
  const options = { fetchImpl: certsFetch([good]), now }
  assert.equal((await checkAccess(await sign(good, goodClaims), env, options)).status, 'allowed')
  assert.equal((await checkAccess(undefined, env, options)).status, 'denied')
  assert.equal((await checkAccess(await sign(stranger, goodClaims), env, options)).status, 'denied')
})

test('an unreachable key endpoint denies rather than allows', async () => {
  clearAccessKeyCache()
  const fetchImpl = async () => new Response('down', { status: 503 })
  assert.equal(await verifyAccessToken(await sign(good, goodClaims), accessConfig(env), { fetchImpl, now }), null)
})
