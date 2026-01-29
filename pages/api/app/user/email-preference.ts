import { NextApiRequest, NextApiResponse } from 'next'
import { verifyJWT } from '@/lib/auth'
import { db } from '@/lib/firebase'

/**
 * Email Marketing Preference API
 * Allows users to opt in/out of marketing emails
 * Apple compliant - requires explicit consent
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.replace('Bearer ', '')
    const decoded = await verifyJWT(token)
    
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const { optIn, source = 'app_settings' } = req.body

    if (typeof optIn !== 'boolean') {
      return res.status(400).json({ error: 'optIn must be boolean' })
    }

    // Update user preferences
    const updateData: any = {
      emailMarketingConsent: optIn,
      emailMarketingConsentDate: new Date(),
      emailMarketingConsentSource: source,
      updatedAt: new Date()
    }

    if (!optIn) {
      // User unsubscribed
      updateData.emailUnsubscribed = true
      updateData.emailUnsubscribedDate = new Date()
    } else {
      // User re-subscribed
      updateData.emailUnsubscribed = false
    }

    await db.collection('users').doc(decoded.userId).update(updateData)

    console.log(`📧 Email preference updated for ${decoded.email}: ${optIn ? 'OPT-IN ✅' : 'OPT-OUT ❌'}`)

    return res.status(200).json({
      success: true,
      emailMarketingConsent: optIn,
      message: optIn 
        ? 'You will receive recipe ideas and cooking tips'
        : 'You will not receive marketing emails'
    })

  } catch (error: any) {
    console.error('❌ Email preference error:', error)
    return res.status(500).json({ error: error.message })
  }
}
