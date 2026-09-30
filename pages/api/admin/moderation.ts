/**
 * Admin moderation queue. middleware.ts already restricts /api/admin/* to the
 * admin Google accounts, so there is no extra auth here.
 *
 * GET  /api/admin/moderation                      open items, newest first
 * POST /api/admin/moderation  { id, action }      action: restore | remove | ban
 *   restore  un-hide the comment/tweak or make the recipe public again
 *   remove   delete the comment/tweak, or keep the recipe private for good
 *   ban      remove + set users/{id}.banned (blocks every future write)
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { db, timestampToDate } from '@/lib/firebase'
import { COLLECTION } from '@/lib/community-recipes'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const snap = await db.collection('moderation_queue').orderBy('createdAt', 'desc').limit(100).get()
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data(), createdAt: (timestampToDate(d.data().createdAt) as Date)?.toISOString?.() ?? null }))
      .filter((i: any) => i.status === 'open')
    return res.status(200).json({ success: true, items })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const id = typeof req.body?.id === 'string' ? req.body.id : ''
  const action = req.body?.action as 'restore' | 'remove' | 'ban'
  if (!id || !['restore', 'remove', 'ban'].includes(action)) return res.status(400).json({ success: false, error: 'Bad request' })

  const queueRef = db.collection('moderation_queue').doc(id)
  const item = (await queueRef.get()).data()
  if (!item) return res.status(404).json({ success: false, error: 'Not in the queue' })

  const recipeRef = db.collection(COLLECTION).doc(item.recipeId)
  const now = new Date()
  if (item.contributionId) {
    const target = recipeRef.collection('contributions').doc(item.contributionId)
    if (action === 'restore') await target.update({ hidden: false, reportCount: 0 })
    else await target.delete()
  } else {
    if (action === 'restore') await recipeRef.update({ isPublic: true, underReview: false, reportCount: 0 })
    else await recipeRef.update({ isPublic: false, underReview: false, removedAt: now })
  }
  if (action === 'ban' && item.targetUserId) {
    await db.collection('users').doc(item.targetUserId).set({ banned: true, bannedAt: now }, { merge: true })
  }
  await queueRef.update({ status: action === 'restore' ? 'restored' : action === 'ban' ? 'banned' : 'removed', resolvedAt: now })
  return res.status(200).json({ success: true })
}
