import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { db } from '@/lib/firebase'
import { verifyJWT } from '@/lib/auth'
import { Timestamp } from 'firebase-admin/firestore'

const idSchema = z.object({
  id: z.string().min(1),
})

const ingredientSchema = z.union([
  z.string().min(1),
  z.object({
    name: z.string().min(1),
    quantity: z.string().optional(),
    unit: z.string().optional(),
    price: z.number().optional(),
    store: z.string().optional(),
    onSale: z.boolean().optional(),
    aisle: z.string().optional(),
    section: z.string().optional(),
  }),
])

const updateRecipeSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  ingredients: z.array(ingredientSchema).min(1).optional(),
  instructions: z.array(z.string().min(1)).min(1).optional(),
  prepTime: z.number().int().min(0).optional().nullable(),
  cookTime: z.number().int().min(0).optional().nullable(),
  servings: z.number().int().min(1).optional().nullable(),
  calories: z.number().int().min(0).optional().nullable(),
  difficulty: z.string().optional().nullable(),
  cuisine: z.string().optional().nullable(),
  dietaryTags: z.array(z.string()).optional(),
  imageUrl: z.string().url().optional().nullable(),
  estimatedCost: z.number().min(0).optional().nullable(),
  // Intentionally do NOT accept isPublic here yet (private-only for now)
})

function requireBearer(req: NextApiRequest): string {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing Authorization header')
  }
  return authHeader.substring(7)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'PATCH' && req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const token = requireBearer(req)
    const { userId } = await verifyJWT(token)

    const { id } = idSchema.parse(req.query)
    const recipeRef = db.collection('recipes').doc(id)
    const recipeDoc = await recipeRef.get()

    if (!recipeDoc.exists) {
      return res.status(404).json({ message: 'Recipe not found' })
    }

    const data = recipeDoc.data() || {}

    // Private-only for now: user must own it.
    if (data.userId !== userId) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        recipe: { id: recipeDoc.id, ...data },
      })
    }

    if (req.method === 'PATCH') {
      const params = updateRecipeSchema.parse(req.body)
      const update: Record<string, unknown> = {
        ...params,
        updatedAt: Timestamp.now(),
      }

      await recipeRef.update(update)
      const updated = await recipeRef.get()

      return res.status(200).json({
        success: true,
        recipe: { id: updated.id, ...(updated.data() || {}) },
      })
    }

    // DELETE
    await recipeRef.delete()
    return res.status(200).json({ success: true })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors })
    }
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('Missing Authorization')) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    if (msg.includes('Token')) {
      return res.status(401).json({ message: 'Invalid or expired token' })
    }
    console.error('iOS recipe by-id API error:', error)
    return res.status(500).json({ message: 'Server error', error: msg })
  }
}



