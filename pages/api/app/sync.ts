/**
 * iOS App Data Sync Endpoint
 * Allows the iOS app to sync user data (recipes, meal plans, grocery lists)
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { verify } from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
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
    const { lastSync } = req.query

    const lastSyncDate = lastSync ? new Date(lastSync as string) : undefined

    // Fetch user's data since last sync
    const where: any = { userId }
    if (lastSyncDate) {
      where.updatedAt = { gte: lastSyncDate }
    }

    const [recipes, mealPlans, groceryLists, savedRecipes] = await Promise.all([
      prisma.recipe.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      prisma.mealPlan.findMany({
        where,
        include: {
          recipes: {
            include: {
              recipe: true,
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      prisma.groceryList.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      prisma.savedRecipe.findMany({
        where: { userId },
        include: {
          recipe: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ])

    return res.status(200).json({
      recipes,
      mealPlans,
      groceryLists,
      savedRecipes: savedRecipes.map(sr => sr.recipe),
      syncTime: new Date().toISOString(),
    })
  } catch (error) {
    console.error('iOS sync error:', error)
    return res.status(500).json({ message: 'Failed to sync data' })
  }
}







