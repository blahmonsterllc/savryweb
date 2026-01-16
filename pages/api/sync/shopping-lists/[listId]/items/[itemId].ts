import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/firebase'
import { verifyJWT } from '@/lib/auth'

/**
 * PUT /api/sync/shopping-lists/{listId}/items/{itemId}
 * Mark shopping list item as purchased/unpurchased
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Verify JWT token
    const payload = verifyJWT(req)
    if (!payload) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const userId = payload.userId
    const { listId, itemId } = req.query
    const { isPurchased, actualPrice, purchasedAt } = req.body

    if (!listId || typeof listId !== 'string') {
      return res.status(400).json({ message: 'listId is required' })
    }

    if (!itemId || typeof itemId !== 'string') {
      return res.status(400).json({ message: 'itemId is required' })
    }

    const listRef = db
      .collection('users')
      .doc(userId)
      .collection('shoppingLists')
      .doc(listId)

    const listDoc = await listRef.get()

    if (!listDoc.exists) {
      return res.status(404).json({ message: 'Shopping list not found' })
    }

    const listData = listDoc.data()
    const items = listData?.items || []

    // Find and update the item
    const itemIndex = items.findIndex((item: any) => item.itemId === itemId)

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in shopping list' })
    }

    items[itemIndex] = {
      ...items[itemIndex],
      isPurchased: isPurchased !== undefined ? isPurchased : items[itemIndex].isPurchased,
      actualPrice: actualPrice !== undefined ? actualPrice : items[itemIndex].actualPrice,
      purchasedAt: purchasedAt || (isPurchased ? new Date() : null)
    }

    // Update the list
    await listRef.update({
      items,
      updatedAt: new Date()
    })

    // Get updated list
    const updatedDoc = await listRef.get()

    return res.status(200).json({
      success: true,
      shoppingList: {
        listId: updatedDoc.id,
        ...updatedDoc.data()
      },
      updatedAt: new Date()
    })

  } catch (error: any) {
    console.error('Update shopping list item error:', error)
    return res.status(500).json({
      message: 'Failed to update shopping list item',
      error: error.message
    })
  }
}




