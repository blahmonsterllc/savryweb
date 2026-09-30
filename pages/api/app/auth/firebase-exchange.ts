/**
 * POST /api/app/auth/firebase-exchange
 *
 * The /app-login page signs the user in with Firebase Auth in the browser and
 * posts the resulting ID token here. We verify it with the Admin SDK, make
 * sure a users/{uid} document exists, and return the site's own 30-day JWT
 * (the same kind every /api/app endpoint accepts as a Bearer token).
 *
 * Body:     { idToken: string }
 * Response: { success: true, accessToken: string, user: { id, email, name } }
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { auth, db } from '@/lib/firebase'
import { generateJWT } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : null
  if (!idToken) {
    return res.status(400).json({ success: false, error: 'idToken is required' })
  }

  try {
    const decoded = await auth.verifyIdToken(idToken, true)
    const email = decoded.email
    if (!email) {
      return res.status(400).json({ success: false, error: 'This account has no email address' })
    }

    const userRef = db.collection('users').doc(decoded.uid)
    const existing = await userRef.get()
    const now = new Date()
    const name = existing.data()?.name || decoded.name || email.split('@')[0]
    const tier: 'FREE' | 'PRO' = existing.data()?.tier === 'PRO' || existing.data()?.isPro ? 'PRO' : 'FREE'

    await userRef.set(
      {
        email,
        name,
        lastLoginAt: now,
        ...(existing.exists ? {} : { createdAt: now, tier: 'FREE', provider: decoded.firebase?.sign_in_provider ?? 'password' }),
      },
      { merge: true }
    )

    const accessToken = generateJWT(decoded.uid, email, tier)
    return res.status(200).json({ success: true, accessToken, user: { id: decoded.uid, email, name } })
  } catch (error: any) {
    console.error('firebase-exchange failed:', error?.message ?? error)
    const message = String(error?.code ?? '').includes('id-token') ? 'Sign-in token is invalid or expired' : 'Could not verify sign-in'
    return res.status(401).json({ success: false, error: message })
  }
}
