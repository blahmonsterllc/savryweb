import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/firebase'

/**
 * REAL WORLD TEST - ZIP Code 11764 (Miller Place, NY)
 * 
 * This creates realistic deals based on actual stores in the 11764 area:
 * - Stop & Shop (primary grocery store on Long Island)
 * - King Kullen (Long Island chain)
 * - Target (Port Jefferson Station)
 * - ShopRite (nearby locations)
 * - Walmart (nearby locations)
 * 
 * Prices based on actual Long Island/NYC metro area pricing (typically 10-20% higher than national average)
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const zipCode = '11764'
    console.log(`🗽 Creating realistic deals for Miller Place, NY (${zipCode})`)

    // Long Island stores in the 11764 area
    const deals = [
      // STOP & SHOP - Main grocer in the area
      // Produce
      {
        storeName: 'Stop & Shop',
        itemName: 'Organic Baby Spinach (5 oz)',
        category: 'Produce',
        originalPrice: 3.99,
        discountPrice: 2.49,
        discountPercent: 38,
        aisle: 'Aisle 1',
        section: 'Produce',
        imageUrl: null,
        description: 'Fresh organic baby spinach',
      },
      {
        storeName: 'Stop & Shop',
        itemName: 'Honeycrisp Apples (per lb)',
        category: 'Produce',
        originalPrice: 2.99,
        discountPrice: 1.99,
        discountPercent: 33,
        aisle: 'Aisle 1',
        section: 'Produce',
      },
      {
        storeName: 'Stop & Shop',
        itemName: 'Grape Tomatoes (pint)',
        category: 'Produce',
        originalPrice: 3.49,
        discountPrice: 2.00,
        discountPercent: 43,
        aisle: 'Aisle 1',
        section: 'Produce',
      },
      {
        storeName: 'Stop & Shop',
        itemName: 'Yellow Onions (3 lb bag)',
        category: 'Produce',
        originalPrice: 2.99,
        discountPrice: 1.99,
        discountPercent: 33,
        aisle: 'Aisle 1',
        section: 'Produce',
      },
      {
        storeName: 'Stop & Shop',
        itemName: 'Red Bell Peppers (each)',
        category: 'Produce',
        originalPrice: 1.99,
        discountPrice: 0.99,
        discountPercent: 50,
        aisle: 'Aisle 1',
        section: 'Produce',
      },

      // Meat & Seafood
      {
        storeName: 'Stop & Shop',
        itemName: 'Boneless Chicken Breast (per lb)',
        category: 'Meat',
        originalPrice: 5.99,
        discountPrice: 2.99,
        discountPercent: 50,
        aisle: 'Meat Counter',
        section: 'Meat & Seafood',
        description: '🔥 MEGA DEAL - Family Pack',
      },
      {
        storeName: 'Stop & Shop',
        itemName: 'Ground Beef 80/20 (per lb)',
        category: 'Meat',
        originalPrice: 6.99,
        discountPrice: 4.99,
        discountPercent: 29,
        aisle: 'Meat Counter',
        section: 'Meat & Seafood',
      },
      {
        storeName: 'Stop & Shop',
        itemName: 'Fresh Atlantic Salmon (per lb)',
        category: 'Seafood',
        originalPrice: 12.99,
        discountPrice: 8.99,
        discountPercent: 31,
        aisle: 'Seafood Counter',
        section: 'Seafood',
      },

      // Dairy
      {
        storeName: 'Stop & Shop',
        itemName: 'Large Eggs (dozen)',
        category: 'Dairy',
        originalPrice: 5.49,
        discountPrice: 3.49,
        discountPercent: 36,
        aisle: 'Aisle 10',
        section: 'Dairy',
      },
      {
        storeName: 'Stop & Shop',
        itemName: 'Stop & Shop Whole Milk (gallon)',
        category: 'Dairy',
        originalPrice: 4.99,
        discountPrice: 3.99,
        discountPercent: 20,
        aisle: 'Aisle 10',
        section: 'Dairy',
      },
      {
        storeName: 'Stop & Shop',
        itemName: 'Cabot Cheddar Cheese (8 oz)',
        category: 'Dairy',
        originalPrice: 4.99,
        discountPrice: 2.99,
        discountPercent: 40,
        aisle: 'Aisle 10',
        section: 'Dairy',
      },

      // KING KULLEN - Local Long Island chain
      {
        storeName: 'King Kullen',
        itemName: 'Romaine Lettuce Hearts (3 pack)',
        category: 'Produce',
        originalPrice: 3.99,
        discountPrice: 2.49,
        discountPercent: 38,
        aisle: 'Produce Section',
        section: 'Produce',
      },
      {
        storeName: 'King Kullen',
        itemName: 'Pork Chops (per lb)',
        category: 'Meat',
        originalPrice: 5.99,
        discountPrice: 3.99,
        discountPercent: 33,
        aisle: 'Meat Department',
        section: 'Meat & Seafood',
      },
      {
        storeName: 'King Kullen',
        itemName: 'Italian Bread (fresh baked)',
        category: 'Bakery',
        originalPrice: 2.99,
        discountPrice: 1.99,
        discountPercent: 33,
        aisle: 'Bakery',
        section: 'Bakery',
      },

      // TARGET - Port Jefferson Station location
      {
        storeName: 'Target',
        itemName: 'Good & Gather Organic Pasta (16 oz)',
        category: 'Pantry',
        originalPrice: 2.49,
        discountPrice: 1.49,
        discountPercent: 40,
        aisle: 'Aisle 5',
        section: 'Pasta & Grains',
      },
      {
        storeName: 'Target',
        itemName: 'Market Pantry Rice (2 lb)',
        category: 'Pantry',
        originalPrice: 3.99,
        discountPrice: 2.99,
        discountPercent: 25,
        aisle: 'Aisle 5',
        section: 'Pasta & Grains',
      },
      {
        storeName: 'Target',
        itemName: 'Good & Gather Frozen Vegetables (12 oz)',
        category: 'Frozen',
        originalPrice: 2.49,
        discountPrice: 1.50,
        discountPercent: 40,
        aisle: 'Frozen Section',
        section: 'Frozen Foods',
      },

      // SHOPRITE - Nearby locations
      {
        storeName: 'ShopRite',
        itemName: 'ShopRite Brand Whole Wheat Bread',
        category: 'Bakery',
        originalPrice: 3.49,
        discountPrice: 2.49,
        discountPercent: 29,
        aisle: 'Aisle 3',
        section: 'Bakery',
      },
      {
        storeName: 'ShopRite',
        itemName: 'Bowl & Basket Extra Virgin Olive Oil (17 oz)',
        category: 'Pantry',
        originalPrice: 9.99,
        discountPrice: 6.99,
        discountPercent: 30,
        aisle: 'Aisle 7',
        section: 'Oils & Condiments',
      },
      {
        storeName: 'ShopRite',
        itemName: 'ShopRite Canned Tomatoes (28 oz)',
        category: 'Pantry',
        originalPrice: 2.79,
        discountPrice: 1.79,
        discountPercent: 36,
        aisle: 'Aisle 6',
        section: 'Canned Goods',
      },
      {
        storeName: 'ShopRite',
        itemName: 'Black Beans (15 oz can)',
        category: 'Pantry',
        originalPrice: 1.49,
        discountPrice: 0.99,
        discountPercent: 34,
        aisle: 'Aisle 6',
        section: 'Canned Goods',
      },

      // WALMART - Nearby location
      {
        storeName: 'Walmart',
        itemName: 'Great Value Tortillas (10 count)',
        category: 'Bakery',
        originalPrice: 2.98,
        discountPrice: 1.98,
        discountPercent: 34,
        aisle: 'Aisle 3',
        section: 'Bakery',
      },
      {
        storeName: 'Walmart',
        itemName: 'Great Value Shredded Mozzarella (8 oz)',
        category: 'Dairy',
        originalPrice: 3.48,
        discountPrice: 2.48,
        discountPercent: 29,
        aisle: 'Dairy Section',
        section: 'Dairy',
      },
      {
        storeName: 'Walmart',
        itemName: 'Great Value Chicken Broth (32 oz)',
        category: 'Pantry',
        originalPrice: 2.48,
        discountPrice: 1.48,
        discountPercent: 40,
        aisle: 'Aisle 6',
        section: 'Canned Goods',
      },
    ]

    // Add common metadata to all deals
    const validUntil = getNextSunday()
    const dealsWithMetadata = deals.map(deal => ({
      ...deal,
      zipCode,
      location: 'Miller Place, NY',
      validUntil,
      scrapedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      source: 'TEST_11764_REALISTIC',
    }))

    // Save to Firebase
    console.log(`💾 Saving ${dealsWithMetadata.length} deals to Firebase...`)
    const batch = db.batch()
    
    for (const deal of dealsWithMetadata) {
      const dealRef = db.collection('supermarketDiscounts').doc()
      batch.set(dealRef, deal)
    }
    
    await batch.commit()
    console.log(`✅ Successfully saved ${dealsWithMetadata.length} deals!`)

    // Calculate total savings
    const totalSavings = dealsWithMetadata.reduce((sum, deal) => 
      sum + (deal.originalPrice - deal.discountPrice), 0
    )

    return res.status(200).json({
      success: true,
      message: `Created realistic deals for Miller Place, NY (${zipCode})`,
      zipCode,
      location: 'Miller Place, NY',
      stores: ['Stop & Shop', 'King Kullen', 'Target', 'ShopRite', 'Walmart'],
      dealsCreated: dealsWithMetadata.length,
      totalPotentialSavings: totalSavings.toFixed(2),
      validUntil,
      breakdown: {
        'Stop & Shop': dealsWithMetadata.filter(d => d.storeName === 'Stop & Shop').length,
        'King Kullen': dealsWithMetadata.filter(d => d.storeName === 'King Kullen').length,
        'Target': dealsWithMetadata.filter(d => d.storeName === 'Target').length,
        'ShopRite': dealsWithMetadata.filter(d => d.storeName === 'ShopRite').length,
        'Walmart': dealsWithMetadata.filter(d => d.storeName === 'Walmart').length,
      },
      sampleDeals: dealsWithMetadata.slice(0, 5).map(d => ({
        store: d.storeName,
        item: d.itemName,
        price: d.discountPrice,
        originalPrice: d.originalPrice,
        savings: (d.originalPrice - d.discountPrice).toFixed(2),
        aisle: d.aisle,
      })),
      nextSteps: [
        'Visit http://localhost:3000/smart-meal-plan',
        'Enter ZIP code: 11764',
        'Select stores: Stop & Shop, ShopRite, Target',
        'Generate meal plan to see deals in action!'
      ]
    })

  } catch (error: any) {
    console.error('Error creating test deals:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to create test deals',
      error: error.message
    })
  }
}

function getNextSunday(): Date {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek
  const sunday = new Date(now)
  sunday.setDate(now.getDate() + daysUntilSunday)
  sunday.setHours(23, 59, 59, 999)
  return sunday
}




