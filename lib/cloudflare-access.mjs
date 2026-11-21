/**
 * Cloudflare Access in front of the admin area.
 *
 * Cloudflare Access asks for its own sign-in (a one-time code by email, Google,
 * GitHub…) before a request to www.savry.io/admin or /api/admin reaches Vercel,
 * and hands the request on with a signed token in the Cf-Access-Jwt-Assertion
 * header. This module checks that token, so the admin area cannot be reached
 * around Cloudflare (for example through the *.vercel.app address).
 *
 * Dependency-free and Web Crypto only, so the same code runs in the Edge
 * middleware, in API routes, and in node:test.
 *
 * Configuration (both are needed; neither is secret):
 *   CLOUDFLARE_ACCESS_TEAM_DOMAIN  e.g. savry.cloudflareaccess.com
 *   CLOUDFLARE_ACCESS_AUD          the Access application's "Application Audience (AUD) Tag"
 */

export const ACCESS_HEADER = 'cf-access-jwt-assertion'

const TEAM_DOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/
const AUD_TAG = /^[A-Za-z0-9]{16,128}$/
const CLOCK_SKEW_SECONDS = 60
const KEYS_TTL_MS = 10 * 60 * 1000

/** Paths Cloudflare Access must cover: the admin pages and the admin API. */
export function isAdminArea(pathname) {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/api/admin' || pathname.startsWith('/api/admin/')
}

/**
 * The Access settings from the environment, or null when they are missing or
 * malformed. A malformed team domain is refused rather than fetched, so the
 * key lookup can only ever go to a *.cloudflareaccess.com host.
 */
export function accessConfig(env = process.env) {
  const teamDomain = String(env.CLOUDFLARE_ACCESS_TEAM_DOMAIN ?? '').trim().toLowerCase().replace(/^https:\/\//, '').replace(/\/$/, '')
  const audience = String(env.CLOUDFLARE_ACCESS_AUD ?? '').trim()
  if (!TEAM_DOMAIN.test(teamDomain) || !AUD_TAG.test(audience)) return null
  return { teamDomain, audience, issuer: `https://${teamDomain}`, certsUrl: `https://${teamDomain}/cdn-cgi/access/certs` }
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function decodeJsonPart(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)))
}

const keyCache = new Map() // certsUrl -> { fetchedAt, keys: Map<kid, CryptoKey> }

async function signingKeys(certsUrl, fetchImpl, { refresh = false } = {}) {
  const cached = keyCache.get(certsUrl)
  if (cached && !refresh && Date.now() - cached.fetchedAt < KEYS_TTL_MS) return cached.keys
  const response = await fetchImpl(certsUrl, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`Cloudflare Access keys: HTTP ${response.status}`)
  const body = await response.json()
  const keys = new Map()
  for (const jwk of Array.isArray(body?.keys) ? body.keys : []) {
    if (jwk?.kty !== 'RSA' || typeof jwk.kid !== 'string' || (jwk.use && jwk.use !== 'sig')) continue
    const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
    keys.set(jwk.kid, key)
  }
  keyCache.set(certsUrl, { fetchedAt: Date.now(), keys })
  return keys
}

/** For tests: forget fetched keys. */
export function clearAccessKeyCache() {
  keyCache.clear()
}

/**
 * Verifies a Cloudflare Access token: RS256 signature by one of the team's
 * current keys, this application's audience, the team's issuer, and the time
 * window. Returns { email, subject } for a good token and null for anything
 * else (missing, malformed, forged, expired, another app's token).
 */
export async function verifyAccessToken(token, config, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (!config || typeof token !== 'string' || token.length > 8192) return null
  const parts = token.split('.')
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return null

  let header, claims
  try {
    header = decodeJsonPart(parts[0])
    claims = decodeJsonPart(parts[1])
  } catch {
    return null
  }
  if (header?.alg !== 'RS256' || typeof header.kid !== 'string') return null

  let keys
  try {
    keys = await signingKeys(config.certsUrl, fetchImpl)
    // Cloudflare rotates its keys; an unknown key id means look again, once.
    if (!keys.has(header.kid)) keys = await signingKeys(config.certsUrl, fetchImpl, { refresh: true })
  } catch {
    return null
  }
  const key = keys.get(header.kid)
  if (!key) return null

  let valid = false
  try {
    valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64UrlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))
  } catch {
    valid = false
  }
  if (!valid) return null

  const seconds = Math.floor(now / 1000)
  const audiences = Array.isArray(claims?.aud) ? claims.aud : [claims?.aud]
  if (!audiences.includes(config.audience)) return null
  if (claims.iss !== config.issuer) return null
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < seconds) return null
  if (typeof claims.nbf === 'number' && claims.nbf - CLOCK_SKEW_SECONDS > seconds) return null
  if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_SECONDS > seconds) return null

  return { email: typeof claims.email === 'string' ? claims.email : null, subject: typeof claims.sub === 'string' ? claims.sub : null }
}

/**
 * The visitor's IP address, for the admin activity log. A request that carried
 * a valid Access token came through Cloudflare, so Cloudflare's
 * CF-Connecting-IP is the person; anything else uses X-Forwarded-For, which
 * Vercel sets itself (a visitor cannot choose it).
 */
export function clientIp(getHeader, viaCloudflare) {
  const first = (raw) => {
    const value = Array.isArray(raw) ? raw[0] : raw
    return typeof value === 'string' ? value.split(',')[0].trim().slice(0, 64) : ''
  }
  return (viaCloudflare && first(getHeader('cf-connecting-ip'))) || first(getHeader('x-forwarded-for')) || first(getHeader('x-real-ip')) || null
}

/**
 * The Access answer for one request: `not-configured` (no Access settings, so
 * the admin area relies on the Savry sign-in alone and /admin/security says
 * so), `allowed` with the Cloudflare identity, or `denied`.
 */
export async function checkAccess(headerValue, env = process.env, options) {
  const config = accessConfig(env)
  if (!config) return { status: 'not-configured' }
  const identity = await verifyAccessToken(headerValue ?? '', config, options)
  return identity ? { status: 'allowed', identity } : { status: 'denied' }
}
