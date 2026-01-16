import { NextApiRequest, NextApiResponse } from 'next'
import { getStoresForZip, getRegionFromZip, EXAMPLE_ZIPS } from '@/lib/store-locator'

/**
 * Get stores available in a specific ZIP code
 * 
 * GET /api/stores/by-zip?zipCode=11764
 * 
 * Returns list of actual stores in that area
 */

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { zipCode } = req.query

  if (!zipCode || typeof zipCode !== 'string') {
    return res.status(400).json({ 
      message: 'zipCode query parameter is required',
      example: '/api/stores/by-zip?zipCode=11764'
    })
  }

  try {
    const region = getRegionFromZip(zipCode)
    const stores = getStoresForZip(zipCode)
    
    // Check if we have specific data for this ZIP
    const exampleData = EXAMPLE_ZIPS[zipCode as keyof typeof EXAMPLE_ZIPS]
    
    return res.status(200).json({
      success: true,
      zipCode,
      region: stores.region,
      description: stores.description,
      stores: {
        primary: stores.primaryStores,
        secondary: stores.secondaryStores,
        all: [...stores.primaryStores, ...stores.secondaryStores]
      },
      recommended: [
        ...stores.primaryStores.slice(0, 4),
        'Target',
        'Walmart'
      ],
      // If we have specific example data for this ZIP, include it
      ...(exampleData && {
        localStores: exampleData.stores,
        localDescription: exampleData.description
      })
    })

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get stores for ZIP code',
      error: error.message
    })
  }
}




