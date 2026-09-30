/**
 * POST /api/app/community/{slug|id}/accept   { tweakId, decision: 'accept' | 'decline' }
 *
 * Only the recipe's original author may call this. Accepting applies the
 * tweak's structured changes to the recipe, bumps `version`, and keeps the
 * previous recipe as versions/{n} so nothing is lost. The response includes
 * the updated recipe so the app can mirror the change locally.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '@/lib/firebase'
import { verifyJWT } from '@/lib/auth'
import { applyChanges, findRecipeRef } from '@/lib/community'
import { buildRecipeIndex, toPublicRecipe } from '@/lib/community-recipes'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const header = req.headers.authorization ?? ''
  if (!header.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Sign in first' })
  let userId: string
  try {
    userId = (await verifyJWT(header.slice(7))).userId
  } catch {
    return res.status(401).json({ success: false, error: 'Session expired. Please sign in again.' })
  }

  const key = String(req.query.recipe ?? '')
  const tweakId = typeof req.body?.tweakId === 'string' ? req.body.tweakId : ''
  const decision = req.body?.decision === 'decline' ? 'decline' : 'accept'
  if (!key || !tweakId) return res.status(400).json({ success: false, error: 'Missing recipe or tweak' })

  const ref = await findRecipeRef(key)
  if (!ref) return res.status(404).json({ success: false, error: 'Recipe not found' })

  try {
    const result = await db.runTransaction(async (tx) => {
      const recipeDoc = await tx.get(ref)
      const data = recipeDoc.data()
      if (!data) throw new Error('missing')
      if (data.importedBy !== userId) return { status: 403 as const }

      const tweakRef = ref.collection('contributions').doc(tweakId)
      const tweakDoc = await tx.get(tweakRef)
      const tweak = tweakDoc.data()
      if (!tweak || tweak.type !== 'tweak') return { status: 404 as const }
      if (tweak.status === 'accepted') return { status: 200 as const, recipe: data }

      const now = new Date()
      if (decision === 'decline') {
        tx.update(tweakRef, { status: 'declined', decidedAt: now })
        return { status: 200 as const, recipe: data }
      }

      const currentVersion = Number(data.version ?? 1)
      const nextVersion = currentVersion + 1
      tx.set(ref.collection('versions').doc(String(currentVersion)), {
        version: currentVersion,
        recipe: data.recipe,
        archivedAt: now,
        replacedByTweak: tweakId,
      })
      const updatedRecipe = applyChanges(data.recipe, tweak.changes ?? [])
      const index = buildRecipeIndex(updatedRecipe, data.importedByUsername)
      tx.update(ref, {
        recipe: updatedRecipe,
        version: nextVersion,
        updatedAt: now,
        ...index,
        communityScore: FieldValue.increment(8),
      })
      tx.update(tweakRef, { status: 'accepted', acceptedInVersion: nextVersion, decidedAt: now })
      return { status: 200 as const, recipe: { ...data, recipe: updatedRecipe, version: nextVersion } }
    })

    if (result.status === 403) return res.status(403).json({ success: false, error: 'Only the recipe author can accept tweaks' })
    if (result.status === 404) return res.status(404).json({ success: false, error: 'Tweak not found' })
    return res.status(200).json({ success: true, decision, recipe: toPublicRecipe(ref.id, result.recipe) })
  } catch (error) {
    console.error('accept failed', error)
    return res.status(500).json({ success: false, error: 'Could not apply that tweak right now' })
  }
}
