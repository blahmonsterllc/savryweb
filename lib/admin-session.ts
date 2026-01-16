const COOKIE_NAME = 'savry_admin'

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`${name} is not configured`)
  return val
}

// Web Crypto API version for Edge runtime (middleware)
async function hmacWebCrypto(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function getAdminCookieName(): string {
  return COOKIE_NAME
}

// For API routes (Node.js runtime)
export async function createAdminSessionToken(): Promise<string> {
  const secret = requireEnv('ADMIN_SESSION_SECRET')
  const payload = JSON.stringify({
    v: 1,
    iat: Date.now(),
  })
  
  // Use TextEncoder for cross-runtime compatibility
  const encoder = new TextEncoder()
  const payloadBytes = encoder.encode(payload)
  const b64 = btoa(String.fromCharCode(...payloadBytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  
  const sig = await hmacWebCrypto(b64, secret)
  return `${b64}.${sig}`
}

// For middleware (Edge runtime)
export async function isValidAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [b64, sig] = parts
  if (!b64 || !sig) return false
  
  try {
    const secret = requireEnv('ADMIN_SESSION_SECRET')
    const expected = await hmacWebCrypto(b64, secret)
    return sig === expected
  } catch {
    return false
  }
}

// For API routes (Node.js runtime)
export function isValidAdminPassword(password: string): boolean {
  const expected = requireEnv('ADMIN_PASSWORD')
  return password === expected
}



