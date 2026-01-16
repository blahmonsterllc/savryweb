import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/firebase'
import { verifyJWT } from '@/lib/auth'

/**
 * GET /api/sync/user
 * Get current user data and sync info
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Verify JWT token
    const payload = verifyJWT(req)
    if (!payload) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const userId = payload.userId

    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(userId).get()

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' })
    }

    const userData = userDoc.data()

    return res.status(200).json({
      success: true,
      user: {
        userId,
        email: userData?.email,
        displayName: userData?.displayName,
        subscription: userData?.subscription || 'free',
        zipCode: userData?.zipCode,
        preferredStores: userData?.preferredStores || [],
        dietaryRestrictions: userData?.dietaryRestrictions || [],
        defaultServings: userData?.defaultServings || 4,
        defaultBudget: userData?.defaultBudget || 100,
        lastSyncedAt: userData?.lastSyncedAt || new Date().toISOString(),
        createdAt: userData?.createdAt,
        updatedAt: userData?.updatedAt
      }
    })

  } catch (error: any) {
    console.error('User sync error:', error)
    return res.status(500).json({
      message: 'Failed to sync user data',
      error: error.message
    })
  }
}




