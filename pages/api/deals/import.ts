import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { db } from '@/lib/firebase'
import { Timestamp } from 'firebase-admin/firestore'

/**
 * Admin-only (middleware protected):
 * Import VERIFIED deals (no scraping, no guessing).
 *
 * POST /api/deals/import
 * Body:
 * {
 *   "storeName": "Target",
 *   "zipCode": "11764",
 *   "location": "Miller Place, NY",
 *   "sourceUrl": "https://...",
 *   "validUntil": "2026-01-07T23:59:59.999Z",
 *   "deals": [
 *     { "itemName": "Chicken Breast (per lb)", "category": "Meat", "originalPrice": 4.99, "discountPrice": 3.49, "aisle": null, "section": "Meat & Seafood" }
 *   ]
 * }
 */

const dealItemSchema = z.object({
  itemName: z.string().min(1),
  category: z.string().optional().nullable(),
  originalPrice: z.number().min(0).optional().nullable(),
  discountPrice: z.number().min(0),
  aisle: z.string().optional().nullable(),
  section: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
})

const importSchema = z.object({
  storeName: z.string().min(1),
  zipCode: z.string().min(1),
  location: z.string().optional().nullable(),
  sourceUrl: z.string().url(),
  validUntil: z.string().datetime().optional(), // ISO
  deals: z.array(dealItemSchema).min(1),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const params = importSchema.parse(req.body)
    const now = Timestamp.now()
    const validUntil = params.validUntil ? new Date(params.validUntil) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const batch = db.batch()

    for (const deal of params.deals) {
      const dealRef = db.collection('supermarketDiscounts').doc()
      const originalPrice = deal.originalPrice ?? null
      const discountPercent =
        originalPrice && originalPrice > 0
          ? Math.round(((originalPrice - deal.discountPrice) / originalPrice) * 100)
          : null

      batch.set(dealRef, {
        storeName: params.storeName,
        location: params.location ?? null,
        zipCode: params.zipCode,
        itemName: deal.itemName,
        itemNameLower: deal.itemName.toLowerCase(),
        category: deal.category ?? null,
        originalPrice,
        discountPrice: deal.discountPrice,
        discountPercent,
        validUntil,
        aisle: deal.aisle ?? null,
        section: deal.section ?? null,
        aisleSource: deal.aisle ? 'PROVIDED' : 'UNKNOWN',
        dealSource: 'MANUAL_IMPORT',
        sourceProvider: 'MANUAL_IMPORT',
        sourceUrl: params.sourceUrl,
        verifiedAt: now,
        imageUrl: deal.imageUrl ?? null,
        description: deal.description ?? null,
        createdAt: now,
        updatedAt: now,
      })
    }

    await batch.commit()

    return res.status(200).json({
      success: true,
      imported: params.deals.length,
      storeName: params.storeName,
      zipCode: params.zipCode,
      validUntil: validUntil.toISOString(),
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors })
    }
    console.error('Deals import error:', error)
    return res.status(500).json({ message: 'Server error' })
  }
}



