import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { db } from '@/lib/firebase'

/**
 * Admin-only (middleware protected):
 * Delete existing deals for a store+zip so you can re-import fresh verified data.
 *
 * DELETE /api/deals/clear?zipCode=11764&storeName=Target
 */

const querySchema = z.object({
  zipCode: z.string().min(1),
  storeName: z.string().min(1),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { zipCode, storeName } = querySchema.parse(req.query)

    // Firestore doesn't support mass delete; batch in chunks.
    let deleted = 0
    while (true) {
      const snap = await db
        .collection('supermarketDiscounts')
        .where('zipCode', '==', zipCode)
        .where('storeName', '==', storeName)
        .limit(400)
        .get()

      if (snap.empty) break

      const batch = db.batch()
      snap.docs.forEach((d) => batch.delete(d.ref))
      await batch.commit()
      deleted += snap.size

      // Safety: don't loop forever accidentally.
      if (snap.size < 400) break
    }

    return res.status(200).json({ success: true, deleted, zipCode, storeName })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors })
    }
    console.error('Deals clear error:', error)
    return res.status(500).json({ message: 'Server error' })
  }
}



