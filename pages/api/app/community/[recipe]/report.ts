/**
 * POST /api/app/community/{slug|id}/report   { contributionId?: string, reason, details? }
 *
 * Any signed-in cook in good standing can report a comment, tweak, Made It,
 * or (with no contributionId) the recipe itself. One report per person per
 * target. Enough distinct reports hide the target automatically and put it in
 * `moderation_queue` for an admin to restore or remove. Authors cannot report
 * their way out of criticism: a report never deletes anything by itself.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '@/lib/firebase'
import { verifyJWT } from '@/lib/auth'
import { findRecipeRef } from '@/lib/community'
import { REPORT_REASONS, REPORTS_TO_HIDE_CONTRIBUTION, REPORTS_TO_HIDE_RECIPE, guardWrite, takeDailyAllowance, type ReportReason } from '@/lib/community-guard'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }
  const header = req.headers.authorization ?? ''
  if (!header.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Sign in to report' })
  let userId: string
  let email: string
  try {
    const d = await verifyJWT(header.slice(7))
    userId = d.userId
    email = d.email
  } catch {
    return res.status(401).json({ success: false, error: 'Session expired. Please sign in again.' })
  }

  const reason = REPORT_REASONS.includes(req.body?.reason) ? (req.body.reason as ReportReason) : null
  if (!reason) return res.status(400).json({ success: false, error: 'Choose a reason' })
  const details = typeof req.body?.details === 'string' ? req.body.details.slice(0, 500) : null
  const contributionId = typeof req.body?.contributionId === 'string' ? req.body.contributionId : null

  const ref = await findRecipeRef(String(req.query.recipe ?? ''))
  if (!ref) return res.status(404).json({ success: false, error: 'Recipe not found' })

  try {
    const guard = await guardWrite(userId, email)
    if (!guard.ok) return res.status(guard.status).json({ success: false, error: guard.error, code: guard.code })
    if (!(await takeDailyAllowance(userId, 'report'))) {
      return res.status(429).json({ success: false, error: 'You’ve reached today’s report limit.', code: 'rate_limited' })
    }

    const targetRef = contributionId ? ref.collection('contributions').doc(contributionId) : ref
    const target = await targetRef.get()
    if (!target.exists) return res.status(404).json({ success: false, error: 'Nothing to report there' })
    if (target.data()?.userId === userId || (!contributionId && target.data()?.importedBy === userId)) {
      return res.status(400).json({ success: false, error: 'You can’t report your own post. Delete it instead.' })
    }

    // One report per person per target.
    const reportRef = ref.collection('reports').doc(`${contributionId ?? 'recipe'}_${userId}`)
    if ((await reportRef.get()).exists) return res.status(200).json({ success: true, alreadyReported: true })

    const now = new Date()
    await reportRef.set({ userId, contributionId, reason, details, createdAt: now })
    await targetRef.update({ reportCount: FieldValue.increment(1) })

    const count = Number(target.data()?.reportCount ?? 0) + 1
    const threshold = contributionId ? REPORTS_TO_HIDE_CONTRIBUTION : REPORTS_TO_HIDE_RECIPE
    // "unsafe" reports on a tweak hide it sooner: bad food-safety advice is the costly mistake.
    const hideNow = count >= threshold || (contributionId && reason === 'unsafe' && count >= 2)
    if (hideNow) {
      if (contributionId) await targetRef.update({ hidden: true, hiddenAt: now })
      else await targetRef.update({ isPublic: false, underReview: true, hiddenAt: now })
      await db.collection('moderation_queue').doc(`${ref.id}_${contributionId ?? 'recipe'}`).set({
        recipeId: ref.id,
        recipeSlug: (await ref.get()).data()?.slug ?? ref.id,
        contributionId,
        targetUserId: target.data()?.userId ?? target.data()?.importedBy ?? null,
        kind: contributionId ? target.data()?.type ?? 'contribution' : 'recipe',
        preview: String(target.data()?.text ?? target.data()?.title ?? '').slice(0, 300),
        reasons: FieldValue.arrayUnion(reason),
        reportCount: count,
        status: 'open',
        createdAt: now,
      }, { merge: true })
    }
    return res.status(200).json({ success: true, hidden: !!hideNow })
  } catch (error) {
    console.error('report failed', error)
    return res.status(500).json({ success: false, error: 'Could not send that report right now' })
  }
}
