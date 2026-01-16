import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { db } from '@/lib/firebase'

/**
 * Admin-only (middleware protected):
 * Search stored deals in Firestore (no scraping here).
 *
 * GET /api/deals/search?zipCode=11764&storeName=Target&q=chicken&limit=25
 */

const querySchema = z.object({
  zipCode: z.string().min(1),
  storeName: z.string().min(1).optional(),
  q: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(25),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { zipCode, storeName, q, limit } = querySchema.parse(req.query)

    let query = db
      .collection('supermarketDiscounts')
      .where('zipCode', '==', zipCode)
      .where('validUntil', '>', new Date())

    if (storeName) {
      query = query.where('storeName', '==', storeName)
    }

    // If a search term is provided, do a simple prefix search against itemNameLower.
    // Requires itemNameLower to be present on docs (we write it in scrape-live).
    if (q) {
      const term = q.toLowerCase()
      query = query
        .where('itemNameLower', '>=', term)
        .where('itemNameLower', '<=', term + '\uf8ff')
        .orderBy('itemNameLower')
    } else {
      query = query.orderBy('discountPercent', 'desc')
    }

    query = query.limit(limit)

    const snap = await query.get()
    const deals = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

    return res.status(200).json({ success: true, deals, count: deals.length })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors })
    }
    console.error('Deal search error:', error)
    return res.status(500).json({ message: 'Server error' })
  }
}



