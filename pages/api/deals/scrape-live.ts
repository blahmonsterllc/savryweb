import { NextApiRequest, NextApiResponse } from 'next'
import { supermarketScraper } from '@/lib/supermarket-scraper'
import { db } from '@/lib/firebase'

/**
 * Scrape live deals from supermarket websites
 * 
 * IMPORTANT: This endpoint should be:
 * 1. Rate-limited (max 1 request per minute per user)
 * 2. Cached (store results for 24 hours)
 * 3. Run on a schedule (cron job), not on-demand
 * 4. Protected with authentication
 * 
 * For production:
 * - Run this as a background job (cron) every 24 hours
 * - Don't expose to end users directly
 * - Add retry logic and error handling
 * - Monitor for changes in website structure
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { store, location, zipCode } = req.body

    if (!store || !zipCode) {
      return res.status(400).json({ 
        message: 'Store and zipCode are required' 
      })
    }

    // Check if we recently scraped this store (cache for 24 hours)
    const cacheKey = `${store}-${zipCode}`
    const cacheDoc = await db.collection('scrapeCache').doc(cacheKey).get()
    
    if (cacheDoc.exists) {
      const cacheData = cacheDoc.data()
      const cacheAge = Date.now() - cacheData.timestamp.toMillis()
      const twentyFourHours = 24 * 60 * 60 * 1000

      if (cacheAge < twentyFourHours) {
        return res.status(200).json({
          success: true,
          cached: true,
          dealsCount: cacheData.dealsCount,
          message: 'Returning cached deals (less than 24 hours old)',
          nextScrapeAvailable: new Date(cacheData.timestamp.toMillis() + twentyFourHours),
        })
      }
    }

    // Scrape based on store
    let deals = []
    
    switch (store.toLowerCase().replace(/[^a-z]/g, '')) { // Remove spaces and special chars
      case 'kroger':
        deals = await supermarketScraper.scrapeKrogerDeals(zipCode)
        break
      case 'walmart':
        deals = await supermarketScraper.scrapeWalmartDeals(zipCode)
        break
      case 'target':
        deals = await supermarketScraper.scrapeTargetDeals(zipCode)
        break
      case 'safeway':
        deals = await supermarketScraper.scrapeSafewayDeals(zipCode)
        break
      case 'stopshop':
      case 'stopandshop':
        deals = await supermarketScraper.scrapeStopAndShopDeals(zipCode)
        break
      case 'wegmans':
        deals = await supermarketScraper.scrapeWegmansDeals(zipCode)
        break
      case 'publix':
        deals = await supermarketScraper.scrapePublixDeals(zipCode)
        break
      default:
        return res.status(400).json({ 
          message: `Scraping not implemented for store: ${store}`,
          supportedStores: [
            'Kroger', 'Walmart', 'Target', 'Safeway', 
            'Stop & Shop', 'Wegmans', 'Publix'
          ]
        })
    }

    if (deals.length === 0) {
      return res.status(404).json({ 
        message: 'No deals found. Website structure may have changed or location not available.' 
      })
    }

    // Save to Firestore (aisle info intentionally disabled for now)
    const batch = db.batch()
    let savedCount = 0

    for (const deal of deals) {
      // Even if a source provides aisle/section, we're keeping aisle info "off" for now.
      const aisle = null
      const section = null
      
      const dealRef = db.collection('supermarketDiscounts').doc()
      batch.set(dealRef, {
        storeName: store,
        location: location || null,
        zipCode,
        itemName: deal.itemName,
        itemNameLower: String(deal.itemName || '').toLowerCase(),
        category: deal.category,
        originalPrice: deal.originalPrice,
        discountPrice: deal.discountPrice,
        discountPercent: deal.discountPercent,
        validUntil: deal.validUntil,
        aisle,
        section,
        aisleSource: 'OFF',
        dealSource: 'SCRAPE_LIVE',
        sourceProvider: String(store),
        imageUrl: deal.imageUrl,
        description: deal.description,
        scrapedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      savedCount++
    }

    await batch.commit()

    // Update cache
    await db.collection('scrapeCache').doc(cacheKey).set({
      store,
      zipCode,
      dealsCount: savedCount,
      timestamp: new Date(),
    })

    return res.status(200).json({
      success: true,
      cached: false,
      message: `Successfully scraped and saved ${savedCount} deals from ${store}`,
      dealsCount: savedCount,
      location,
      store,
    })

  } catch (error: any) {
    console.error('Scraping error:', error)
    return res.status(500).json({ 
      message: 'Failed to scrape deals',
      error: error.message,
      hint: 'Website structure may have changed. Manual update needed.'
    })
  }
}





