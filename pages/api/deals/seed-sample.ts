import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/firebase'

/**
 * Seed sample supermarket deals for testing
 * In production, this would be replaced with:
 * 1. Web scraping from store websites
 * 2. Store API integrations
 * 3. Manual admin entry
 * 4. Third-party deal aggregators
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { location, storeName } = req.body

    if (!location || !storeName) {
      return res.status(400).json({ 
        message: 'Location and storeName are required' 
      })
    }

    // Sample deals data (aisle info intentionally disabled for now)
    const sampleDeals = [
      // Produce
      {
        storeName,
        location,
        itemName: 'Bananas',
        category: 'Produce',
        originalPrice: 2.99,
        discountPrice: 1.99,
        discountPercent: 33,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        aisle: null,
        section: null
      },
      {
        storeName,
        location,
        itemName: 'Red Apples (3 lb bag)',
        category: 'Produce',
        originalPrice: 5.99,
        discountPrice: 3.99,
        discountPercent: 33,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },
      {
        storeName,
        location,
        itemName: 'Fresh Spinach',
        category: 'Produce',
        originalPrice: 3.49,
        discountPrice: 2.49,
        discountPercent: 29,
        validUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },
      {
        storeName,
        location,
        itemName: 'Roma Tomatoes (per lb)',
        category: 'Produce',
        originalPrice: 2.49,
        discountPrice: 1.49,
        discountPercent: 40,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },
      {
        storeName,
        location,
        itemName: 'Baby Carrots (1 lb)',
        category: 'Produce',
        originalPrice: 2.99,
        discountPrice: 1.99,
        discountPercent: 33,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },

      // Meat & Seafood
      {
        storeName,
        location,
        itemName: 'Chicken Breast (per lb)',
        category: 'Meat',
        originalPrice: 8.99,
        discountPrice: 5.99,
        discountPercent: 33,
        validUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },
      {
        storeName,
        location,
        itemName: 'Ground Beef (80/20, per lb)',
        category: 'Meat',
        originalPrice: 6.99,
        discountPrice: 4.99,
        discountPercent: 29,
        validUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },
      {
        storeName,
        location,
        itemName: 'Salmon Fillets (per lb)',
        category: 'Seafood',
        originalPrice: 12.99,
        discountPrice: 9.99,
        discountPercent: 23,
        validUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },

      // Dairy
      {
        storeName,
        location,
        itemName: 'Whole Milk (1 gallon)',
        category: 'Dairy',
        originalPrice: 4.99,
        discountPrice: 3.49,
        discountPercent: 30,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },
      {
        storeName,
        location,
        itemName: 'Eggs (12 count)',
        category: 'Dairy',
        originalPrice: 4.49,
        discountPrice: 2.99,
        discountPercent: 33,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },
      {
        storeName,
        location,
        itemName: 'Cheddar Cheese (8 oz)',
        category: 'Dairy',
        originalPrice: 4.99,
        discountPrice: 3.49,
        discountPercent: 30,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },
      {
        storeName,
        location,
        itemName: 'Greek Yogurt (32 oz)',
        category: 'Dairy',
        originalPrice: 5.99,
        discountPrice: 4.49,
        discountPercent: 25,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },

      // Pantry
      {
        storeName,
        location,
        itemName: 'Pasta (16 oz)',
        category: 'Pantry',
        originalPrice: 2.49,
        discountPrice: 1.49,
        discountPercent: 40,
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },
      {
        storeName,
        location,
        itemName: 'White Rice (2 lb)',
        category: 'Pantry',
        originalPrice: 3.99,
        discountPrice: 2.99,
        discountPercent: 25,
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },
      {
        storeName,
        location,
        itemName: 'Canned Tomatoes (28 oz)',
        category: 'Pantry',
        originalPrice: 2.99,
        discountPrice: 1.99,
        discountPercent: 33,
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },
      {
        storeName,
        location,
        itemName: 'Black Beans (15 oz can)',
        category: 'Pantry',
        originalPrice: 1.49,
        discountPrice: 0.99,
        discountPercent: 34,
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },
      {
        storeName,
        location,
        itemName: 'Olive Oil (16 oz)',
        category: 'Pantry',
        originalPrice: 8.99,
        discountPrice: 6.99,
        discountPercent: 22,
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },

      // Bakery
      {
        storeName,
        location,
        itemName: 'Whole Wheat Bread',
        category: 'Bakery',
        originalPrice: 3.99,
        discountPrice: 2.99,
        discountPercent: 25,
        validUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },

      // Frozen
      {
        storeName,
        location,
        itemName: 'Mixed Vegetables (16 oz)',
        category: 'Frozen',
        originalPrice: 2.99,
        discountPrice: 1.99,
        discountPercent: 33,
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },
      {
        storeName,
        location,
        itemName: 'Frozen Broccoli (12 oz)',
        category: 'Frozen',
        originalPrice: 2.49,
        discountPrice: 1.49,
        discountPercent: 40,
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },

      // Snacks
      {
        storeName,
        location,
        itemName: 'Crackers',
        category: 'Snacks',
        originalPrice: 3.99,
        discountPrice: 2.49,
        discountPercent: 38,
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        aisle: null,
        section: null
      },
    ]

    // Add all deals to Firestore
    const batch = db.batch()
    let count = 0

    for (const deal of sampleDeals) {
      const dealRef = db.collection('supermarketDiscounts').doc()
      batch.set(dealRef, {
        ...deal,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      count++
    }

    await batch.commit()

    return res.status(200).json({
      success: true,
      message: `Successfully seeded ${count} sample deals for ${storeName} in ${location}`,
      dealsCount: count,
    })

  } catch (error: any) {
    console.error('Seed deals error:', error)
    return res.status(500).json({ 
      message: 'Failed to seed sample deals',
      error: error.message 
    })
  }
}






