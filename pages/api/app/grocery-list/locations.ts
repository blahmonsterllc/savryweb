/**
 * iOS App Grocery List with Store Locations (Pro Feature)
 * Returns optimized shopping route with aisle locations
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { verify } from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { storeLocationService } from '@/lib/store-locations'
import { z } from 'zod'

const locationSchema = z.object({
  groceryListId: z.string(),
  storeName: z.string(),
  zipCode: z.string(),
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
    const userTier = decoded.tier

    // Pro feature only
    if (userTier !== 'PRO') {
      return res.status(403).json({
        message: 'Store location mapping is a Pro feature',
        upgrade: true,
      })
    }

    const params = locationSchema.parse(req.body)

    // Get grocery list
    const groceryList = await prisma.groceryList.findUnique({
      where: { id: params.groceryListId },
    })

    if (!groceryList) {
      return res.status(404).json({ message: 'Grocery list not found' })
    }

    if (groceryList.userId !== userId) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    // Get items from grocery list
    const items = groceryList.items as Array<{
      name: string
      quantity: string
      unit: string
      category: string
    }>

    // Get optimized shopping route with store locations
    const optimizedRoute = await storeLocationService.getOptimizedShoppingRoute(
      items,
      params.storeName,
      params.zipCode
    )

    // Group items by section for easier shopping
    const groupedBySection = optimizedRoute.reduce((acc, item) => {
      const section = item.section || 'Other'
      if (!acc[section]) {
        acc[section] = []
      }
      acc[section].push(item)
      return acc
    }, {} as Record<string, typeof optimizedRoute>)

    return res.status(200).json({
      groceryListId: params.groceryListId,
      storeName: params.storeName,
      optimizedRoute,
      groupedBySection,
      totalItems: optimizedRoute.length,
      itemsWithLocations: optimizedRoute.filter(i => i.aisle).length,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors })
    }
    
    console.error('Store locations error:', error)
    return res.status(500).json({ message: 'Failed to get store locations' })
  }
}







