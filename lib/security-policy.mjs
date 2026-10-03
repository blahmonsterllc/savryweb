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
 * Content Security Policy. Scripts: self only; Supabase is data only
 * (connect-src); fonts come from Google Fonts. 'unsafe-inline' is required by
 * Next.js inline runtime scripts; JSON-LD is escaped separately (safeJsonLd).
 */
export function contentSecurityPolicy() {
  // `next dev` hot reloading evaluates code with eval(); production bundles never do.
  const devEval = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'" + devEval + "",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-src 'none'",
    "upgrade-insecure-requests",
  ].join('; ')
}

export function securityHeaders() {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  ]
}
