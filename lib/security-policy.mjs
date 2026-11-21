/** Shared, dependency-free security rules used by server routes and tests. */

export function safeReturnPath(value, fallback = '/account') {
  if (typeof value !== 'string') return fallback
  if (!/^\/[A-Za-z0-9]/.test(value)) return fallback
  if (value.includes('\\') || value.includes('\0')) return fallback
  return value
}

/**
 * Serialize JSON for a <script type="application/ld+json"> block. Escaping
 * `<`, `>`, `&` and U+2028/2029 means untrusted text (a recipe title) can
 * never close the script element or break the page.
 */
export function safeJsonLd(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/**
 * The Cloudflare Web Analytics beacon token (public: it is in every page),
 * or null when visit counting is off. Cookie-free; see /privacy.
 */
export function webAnalyticsToken(env = process.env) {
  const token = String(env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN ?? '').trim()
  return /^[A-Za-z0-9]{16,64}$/.test(token) ? token : null
}

/**
 * Content Security Policy. Scripts: self only; Supabase is data only
 * (connect-src); fonts come from Google Fonts. 'unsafe-inline' is required by
 * Next.js inline runtime scripts; JSON-LD is escaped separately (safeJsonLd).
 * Cloudflare's visit counter is allowed only while its token is set.
 */
export function contentSecurityPolicy(env = process.env) {
  // `next dev` hot reloading evaluates code with eval(); production bundles never do.
  const dev = env.NODE_ENV === 'development'
  const devEval = dev ? " 'unsafe-eval'" : ''
  const analytics = webAnalyticsToken(env) !== null
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'" + devEval + (analytics ? ' https://static.cloudflareinsights.com' : ''),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co" + (analytics ? ' https://cloudflareinsights.com' : ''),
    "frame-src 'none'",
    // Not on `next dev`: Safari would move http://localhost assets to https and the page loads unstyled.
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ')
}

export function securityHeaders() {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
    // Production only: Safari keeps HSTS for localhost too, which breaks local development.
    ...(process.env.NODE_ENV === 'development' ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]),
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    // Public pages, photos and share cards may be embedded elsewhere (mail clients, link previews); nothing private is served to browsers.
    { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
  ]
}
