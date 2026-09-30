/**
 * POST /api/app/community/{slug|id}/revert   { version: number }
 *
 * Author only. Restores the recipe as it was at `version` (kept in
 * versions/{n} whenever a tweak is accepted). The restore is itself a new
 * version, so nothing is ever lost and a restore can be undone too.
 *
 * GET returns the list of stored versions for the author.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { db, timestampToDate } from '@/lib/firebase'
import { verifyJWT } from '@/lib/auth'
import { findRecipeRef } from '@/lib/community'
import { buildRecipeIndex, toPublicRecipe } from '@/lib/community-recipes'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const header = req.headers.authorization ?? ''
  if (!header.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Sign in first' })
  let userId: string
  try {
    userId = (await verifyJWT(header.slice(7))).userId
  } catch {
    return res.status(401).json({ success: false, error: 'Session expired. Please sign in again.' })
  }

  const ref = await findRecipeRef(String(req.query.recipe ?? ''))
  if (!ref) return res.status(404).json({ success: false, error: 'Recipe not found' })
  const doc = await ref.get()
  if (doc.data()?.importedBy !== userId) return res.status(403).json({ success: false, error: 'Only the recipe author can do that' })

  if (req.method === 'GET') {
    const snap = await ref.collection('versions').orderBy('version', 'desc').limit(30).get()
    return res.status(200).json({
      success: true,
      current: Number(doc.data()?.version ?? 1),
      versions: snap.docs.map((d) => ({
        version: d.data().version,
        archivedAt: (timestampToDate(d.data().archivedAt) as Date)?.toISOString?.() ?? null,
        replacedByTweak: d.data().replacedByTweak ?? null,
        ingredientCount: d.data().recipe?.ingredients?.length ?? 0,
        stepCount: d.data().recipe?.instructions?.length ?? 0,
      })),
    })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const version = Number(req.body?.version)
  if (!Number.isInteger(version) || version < 1) return res.status(400).json({ success: false, error: 'Choose a version to restore' })

  try {
    const result = await db.runTransaction(async (tx) => {
      const current = await tx.get(ref)
      const data = current.data()!
      const old = await tx.get(ref.collection('versions').doc(String(version)))
      if (!old.exists) return null
      const now = new Date()
      const currentVersion = Number(data.version ?? 1)
      tx.set(ref.collection('versions').doc(String(currentVersion)), {
        version: currentVersion,
        recipe: data.recipe,
        archivedAt: now,
        replacedByRevertTo: version,
      })
      const restoredRecipe = old.data()!.recipe
      tx.update(ref, {
        recipe: restoredRecipe,
        version: currentVersion + 1,
        updatedAt: now,
        ...buildRecipeIndex(restoredRecipe, data.importedByUsername),
      })
      return { ...data, recipe: restoredRecipe, version: currentVersion + 1 }
    })
    if (!result) return res.status(404).json({ success: false, error: 'That version isn’t stored' })
    return res.status(200).json({ success: true, recipe: toPublicRecipe(ref.id, result) })
  } catch (error) {
    console.error('revert failed', error)
    return res.status(500).json({ success: false, error: 'Could not restore that version right now' })
  }
}
