/** Shared, dependency-free security rules used by server routes and tests. */

export function safeReturnPath(value, fallback = '/account') {
  if (typeof value !== 'string') return fallback
  if (!/^\/[A-Za-z0-9]/.test(value)) return fallback
  if (value.includes('\\') || value.includes('\0')) return fallback
  return value
}

export function legacyAppApiEnabled(value) {
  return value === 'true'
}

export function securityHeaders() {
  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  ]
}
