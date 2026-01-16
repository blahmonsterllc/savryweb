/**
 * iOS App Grocery List Generation Endpoint
 * Generates grocery lists from meal plans or recipes using ChatGPT
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { verify } from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { generateGroceryList } from '@/lib/openai'
import { z } from 'zod'

const generateGroceryListSchema = z.object({
  mealPlanId: z.string().optional(),
  recipeIds: z.array(z.string()).optional(),
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Verify iOS app token
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing or invalid authorization header' })
    }

    const token = authHeader.substring(7)
    let decoded: any
    
    try {
      decoded = verify(token, process.env.NEXTAUTH_SECRET || 'your-secret-key')
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired token' })
    }

    const userId = decoded.userId
    const params = generateGroceryListSchema.parse(req.body)

    if (!params.mealPlanId && (!params.recipeIds || params.recipeIds.length === 0)) {
      return res.status(400).json({ message: 'Either mealPlanId or recipeIds must be provided' })
    }

    let recipes = []

    if (params.mealPlanId) {
      // Get recipes from meal plan
      const mealPlan = await prisma.mealPlan.findUnique({
        where: { id: params.mealPlanId },
        include: {
          recipes: {
            include: {
              recipe: true,
            }
          }
        }
      })

      if (!mealPlan) {
        return res.status(404).json({ message: 'Meal plan not found' })
      }

      if (mealPlan.userId !== userId) {
        return res.status(403).json({ message: 'Forbidden' })
      }

      recipes = mealPlan.recipes.map(r => r.recipe)
    } else if (params.recipeIds) {
      // Get specific recipes
      recipes = await prisma.recipe.findMany({
        where: {
          id: { in: params.recipeIds },
        }
      })
    }

    // Generate consolidated grocery list using ChatGPT (server-side only!)
    const groceryListData = await generateGroceryList(recipes)

    // Save grocery list
    const groceryList = await prisma.groceryList.create({
      data: {
        userId,
        mealPlanId: params.mealPlanId,
        name: params.mealPlanId 
          ? `Grocery List for Meal Plan` 
          : `Grocery List (${recipes.length} recipes)`,
        items: groceryListData.items,
      }
    })

    return res.status(200).json({
      groceryList: {
        id: groceryList.id,
        name: groceryList.name,
        items: groceryList.items,
        createdAt: groceryList.createdAt,
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors })
    }
    
    console.error('iOS grocery list generation error:', error)
    return res.status(500).json({ message: 'Failed to generate grocery list' })
  }
}







