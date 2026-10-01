/**
 * Revoke a cook's Sign in with Apple grant when they delete their account.
 * Apple expects apps that offer account deletion to revoke the user's tokens.
 *
 * POST /api/account/apple-revoke
 *   Authorization: Bearer <Supabase access token of the signed-in cook>
 *   { "authorizationCode": "<fresh code from ASAuthorization>", "client": "app" | "web" }
 *
 * The code is exchanged for a refresh token with Apple and that token is
 * revoked. Nothing is stored. The caller deletes the Savry account afterwards
 * whether or not this succeeds, so a failure here never traps anyone in an
 * account they asked to remove.
 *
 * Needs APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY (the .p8 contents)
 * in the environment. Without them it answers 503 { configured: false }.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { createPrivateKey, createSign } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const CLIENT_IDS = {
  app: process.env.APPLE_BUNDLE_ID || 'recipe.foodprep',
  web: process.env.APPLE_SERVICES_ID || 'io.savry.web',
} as const

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function clientSecret(clientId: string): string | null {
  const teamId = process.env.APPLE_TEAM_ID
  const keyId = process.env.APPLE_KEY_ID
  const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!teamId || !keyId || !privateKey) return null
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId }))
  const payload = base64url(JSON.stringify({ iss: teamId, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: clientId }))
  const signer = createSign('SHA256')
  signer.update(`${header}.${payload}`)
  const signature = signer.sign({ key: createPrivateKey(privateKey), dsaEncoding: 'ieee-p1363' })
  return `${header}.${payload}.${base64url(signature)}`
}

async function appleForm(path: string, fields: Record<string, string>): Promise<{ ok: boolean; status: number; body: any }> {
  const response = await fetch(`https://appleid.apple.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  })
  const text = await response.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }
  return { ok: response.ok, status: response.status, body }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ revoked: false, error: 'Method not allowed' })
  }

  // Only the signed-in cook can ask for their own grant to be revoked.
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ revoked: false, error: 'Sign in first' })
  const { data: userData, error: userError } = await getSupabaseAdmin().auth.getUser(token)
  if (userError || !userData.user) return res.status(401).json({ revoked: false, error: 'Sign in first' })

  const code = typeof req.body?.authorizationCode === 'string' ? req.body.authorizationCode.trim() : ''
  const client: keyof typeof CLIENT_IDS = req.body?.client === 'web' ? 'web' : 'app'
  if (!code || code.length > 2048) return res.status(400).json({ revoked: false, error: 'Missing authorization code' })

  const clientId = CLIENT_IDS[client]
  const secret = clientSecret(clientId)
  if (!secret) return res.status(503).json({ revoked: false, configured: false })

  const exchange = await appleForm('/auth/token', { client_id: clientId, client_secret: secret, code, grant_type: 'authorization_code' })
  const refreshToken = exchange.body?.refresh_token
  if (!exchange.ok || typeof refreshToken !== 'string') {
    console.warn('apple-revoke: code exchange failed', exchange.status, exchange.body?.error)
    return res.status(502).json({ revoked: false, error: 'Apple did not accept the authorization code' })
  }

  const revoke = await appleForm('/auth/revoke', { client_id: clientId, client_secret: secret, token: refreshToken, token_type_hint: 'refresh_token' })
  if (!revoke.ok) {
    console.warn('apple-revoke: revoke failed', revoke.status, revoke.body?.error)
    return res.status(502).json({ revoked: false, error: 'Apple did not confirm the revocation' })
  }
  return res.status(200).json({ revoked: true })
}
