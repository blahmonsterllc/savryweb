import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/firebase'
import { verifyJWT } from '@/lib/auth'

/**
 * GET/PUT/DELETE /api/sync/recipes/{recipeId}
 * 
 * GET: Get specific recipe
 * PUT: Update specific recipe
 * DELETE: Delete recipe
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
    const { recipeId } = req.query

    if (!recipeId || typeof recipeId !== 'string') {
      return res.status(400).json({ message: 'recipeId is required' })
    }

    const recipeRef = db
      .collection('users')
      .doc(userId)
      .collection('recipes')
      .doc(recipeId)

    if (req.method === 'GET') {
      const recipeDoc = await recipeRef.get()
      
      if (!recipeDoc.exists) {
        return res.status(404).json({ message: 'Recipe not found' })
      }

      return res.status(200).json({
        success: true,
        recipe: {
          recipeId: recipeDoc.id,
          ...recipeDoc.data()
        }
      })

    } else if (req.method === 'PUT') {
      const updateData = {
        ...req.body,
        updatedAt: new Date()
      }

      await recipeRef.update(updateData)
      
      const updatedDoc = await recipeRef.get()
      
      return res.status(200).json({
        success: true,
        recipe: {
          recipeId: updatedDoc.id,
          ...updatedDoc.data()
        },
        updatedAt: updateData.updatedAt
      })

    } else if (req.method === 'DELETE') {
      await recipeRef.delete()
      
      return res.status(200).json({
        success: true,
        recipeId
      })

    } else {
      return res.status(405).json({ message: 'Method not allowed' })
    }

  } catch (error: any) {
    console.error('Recipe operation error:', error)
    return res.status(500).json({
      message: 'Failed to process recipe',
      error: error.message
    })
  }
}




