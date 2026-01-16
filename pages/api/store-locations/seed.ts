/**
 * Seed store location data
 * Call this endpoint once to populate sample store locations
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { storeLocationService } from '@/lib/store-locations'
import { z } from 'zod'

const seedSchema = z.object({
  storeName: z.string(),
  location: z.string(),
  adminKey: z.string(),
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const params = seedSchema.parse(req.body)

    // Simple admin protection (in production, use proper authentication)
    if (params.adminKey !== process.env.ADMIN_SEED_KEY) {
      return res.status(403).json({ message: 'Invalid admin key' })
    }

    await storeLocationService.seedSampleLocations(
      params.storeName,
      params.location
    )

    return res.status(200).json({
      message: 'Store locations seeded successfully',
      storeName: params.storeName,
      location: params.location,
    })
  } catch (error) {
    console.error('Seed error:', error)
    return res.status(500).json({ message: 'Failed to seed store locations' })
  }
}







