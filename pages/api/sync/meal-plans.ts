import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/firebase'
import { verifyJWT } from '@/lib/auth'

/**
 * GET/POST /api/sync/meal-plans
 * 
 * GET: Fetch meal plans updated since timestamp
 * POST: Upload/update meal plan
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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

    if (req.method === 'GET') {
      return await handleGet(req, res, userId)
    } else if (req.method === 'POST') {
      return await handlePost(req, res, userId)
    } else {
      return res.status(405).json({ message: 'Method not allowed' })
    }

  } catch (error: any) {
    console.error('Meal plan sync error:', error)
    return res.status(500).json({
      message: 'Failed to sync meal plans',
      error: error.message
    })
  }
}

// GET: Fetch meal plans
async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const { since, status, limit = 50 } = req.query

  const mealPlansRef = db.collection('users').doc(userId).collection('mealPlans')
  
  let query = mealPlansRef.orderBy('updatedAt', 'desc')

  // Filter by timestamp if provided
  if (since && typeof since === 'string') {
    const sinceDate = new Date(since)
    query = query.where('updatedAt', '>', sinceDate) as any
  }

  // Filter by status if provided
  if (status && typeof status === 'string') {
    query = query.where('status', '==', status) as any
  }

  // Apply limit
  query = query.limit(Number(limit)) as any

  const snapshot = await query.get()
  
  const mealPlans = snapshot.docs.map(doc => ({
    mealPlanId: doc.id,
    ...doc.data()
  }))

  return res.status(200).json({
    success: true,
    mealPlans,
    total: mealPlans.length,
    hasMore: mealPlans.length === Number(limit),
    lastSyncedAt: new Date().toISOString()
  })
}

// POST: Upload/update meal plan
async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const mealPlanData = req.body

  if (!mealPlanData) {
    return res.status(400).json({ message: 'Meal plan data is required' })
  }

  const mealPlansRef = db.collection('users').doc(userId).collection('mealPlans')
  
  const mealPlanId = mealPlanData.mealPlanId || mealPlansRef.doc().id
  const mealPlanDocRef = mealPlansRef.doc(mealPlanId)

  const dataToSave = {
    ...mealPlanData,
    mealPlanId,
    userId,
    updatedAt: new Date()
  }

  if (!mealPlanData.mealPlanId) {
    dataToSave.createdAt = new Date()
  }

  await mealPlanDocRef.set(dataToSave, { merge: true })

  return res.status(200).json({
    success: true,
    mealPlan: dataToSave
  })
}




