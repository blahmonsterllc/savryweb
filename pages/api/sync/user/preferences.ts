import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/firebase'
import { verifyJWT } from '@/lib/auth'

/**
 * PUT /api/sync/user/preferences
 * Update user preferences
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Verify JWT token
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    const token = authHeader.substring(7)
    const payload = await verifyJWT(token)
    if (!payload) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const userId = payload.userId
    const {
      zipCode,
      preferredStores,
      dietaryRestrictions,
      defaultServings,
      defaultBudget
    } = req.body

    // Update user preferences in Firestore
    const userRef = db.collection('users').doc(userId)
    
    const updateData: any = {
      updatedAt: new Date(),
      lastSyncedAt: new Date()
    }

    if (zipCode !== undefined) updateData.zipCode = zipCode
    if (preferredStores !== undefined) updateData.preferredStores = preferredStores
    if (dietaryRestrictions !== undefined) updateData.dietaryRestrictions = dietaryRestrictions
    if (defaultServings !== undefined) updateData.defaultServings = defaultServings
    if (defaultBudget !== undefined) updateData.defaultBudget = defaultBudget

    await userRef.update(updateData)

    // Get updated user data
    const userDoc = await userRef.get()
    const userData = userDoc.data()

    return res.status(200).json({
      success: true,
      user: {
        userId,
        ...userData
      },
      updatedAt: updateData.updatedAt
    })

  } catch (error: any) {
    console.error('Update preferences error:', error)
    return res.status(500).json({
      message: 'Failed to update preferences',
      error: error.message
    })
  }
}




