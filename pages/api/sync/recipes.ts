import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/firebase'
import { verifyJWT } from '@/lib/auth'

/**
 * GET/POST /api/sync/recipes
 * 
 * GET: Fetch recipes updated since timestamp
 * POST: Upload/update recipes
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Verify JWT token
    const payload = verifyJWT(req)
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
    console.error('Recipe sync error:', error)
    return res.status(500).json({
      message: 'Failed to sync recipes',
      error: error.message
    })
  }
}

// GET: Fetch recipes
async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const { since, limit = 100, offset = 0 } = req.query

  const recipesRef = db.collection('users').doc(userId).collection('recipes')
  
  let query = recipesRef.orderBy('updatedAt', 'desc')

  // Filter by timestamp if provided
  if (since && typeof since === 'string') {
    const sinceDate = new Date(since)
    query = query.where('updatedAt', '>', sinceDate) as any
  }

  // Apply pagination
  query = query.limit(Number(limit)).offset(Number(offset)) as any

  const snapshot = await query.get()
  
  const recipes = snapshot.docs.map(doc => ({
    recipeId: doc.id,
    ...doc.data()
  }))

  return res.status(200).json({
    success: true,
    recipes,
    total: recipes.length,
    hasMore: recipes.length === Number(limit),
    lastSyncedAt: new Date().toISOString()
  })
}

// POST: Upload/update recipes
async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const { recipes } = req.body

  if (!recipes || !Array.isArray(recipes)) {
    return res.status(400).json({ message: 'recipes array is required' })
  }

  const recipesRef = db.collection('users').doc(userId).collection('recipes')
  const batch = db.batch()

  let created = 0
  let updated = 0
  const savedRecipes = []

  for (const recipe of recipes) {
    const recipeId = recipe.recipeId || recipesRef.doc().id
    const recipeDocRef = recipesRef.doc(recipeId)

    const recipeData = {
      ...recipe,
      recipeId,
      updatedAt: new Date(),
      userId
    }

    if (!recipe.recipeId) {
      // New recipe
      recipeData.createdAt = new Date()
      created++
    } else {
      // Update existing
      updated++
    }

    batch.set(recipeDocRef, recipeData, { merge: true })
    savedRecipes.push({ recipeId, ...recipeData })
  }

  await batch.commit()

  return res.status(200).json({
    success: true,
    created,
    updated,
    recipes: savedRecipes
  })
}




