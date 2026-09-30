/**
 * GET  /api/app/community/{slug|id}/contributions   public feed (optional Bearer adds `viewer`)
 * POST /api/app/community/{slug|id}/contributions   add a Made It, comment, or tweak (Bearer required)
 *
 * Made It rules ("they need to make it for it to count"):
 *   - source "web": a photo of the finished dish is required.
 *   - source "app": proof must be "cooking_mode" or "mark_made" (recorded by the app).
 *   - one Made It per cook, per recipe, per day.
 * A tweak may be posted without a Made It; it then starts with madeCount 0 and
 * is shown below tweaks people have actually cooked. One pending tweak per
 * cook per recipe. All writes pass lib/community-guard.ts first.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyJWT } from '@/lib/auth'
import { uploadJPEG } from '@/lib/storage'
import { contributionInputSchema, findRecipeRef, loadFeed, type ContributionType } from '@/lib/community'
import { guardWrite, screenChanges, screenText, takeDailyAllowance } from '@/lib/community-guard'

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } }

async function viewerFrom(req: NextApiRequest): Promise<{ userId: string; email: string } | null> {
  const header = req.headers.authorization ?? ''
  if (!header.startsWith('Bearer ')) return null
  try {
    const d = await verifyJWT(header.slice(7))
    return { userId: d.userId, email: d.email }
  } catch {
    return null
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const key = String(req.query.recipe ?? '')
  if (!key) return res.status(400).json({ success: false, error: 'Missing recipe' })

  const ref = await findRecipeRef(key)
  if (!ref) return res.status(404).json({ success: false, error: 'Recipe not found' })

  if (req.method === 'GET') {
    try {
      const feed = await loadFeed(ref)
      const viewer = await viewerFrom(req)
      return res.status(200).json({
        success: true,
        ...feed,
        viewer: viewer ? { userId: viewer.userId, isAuthor: viewer.userId === feed.recipe.authorId } : null,
      })
    } catch (error) {
      console.error('community feed failed', error)
      return res.status(500).json({ success: false, error: 'Could not load community activity' })
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const viewer = await viewerFrom(req)
  if (!viewer) return res.status(401).json({ success: false, error: 'Sign in to take part' })

  const parsed = contributionInputSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid contribution', details: parsed.error.flatten() })
  }
  const input = parsed.data
  const hasChanges = (input.changes?.length ?? 0) > 0
  const hasText = !!input.text?.trim()

  // Proof rules first: cheapest check, and nothing is stored if it fails.
  const madeIt = input.madeIt
  let proof: string | null = null
  if (madeIt) {
    if (input.source === 'app') {
      if (!input.proof) return res.status(400).json({ success: false, error: 'The app must say how the recipe was cooked' })
      proof = input.proof
    } else {
      if (!input.photoBase64) return res.status(400).json({ success: false, error: 'Add a photo of your finished dish to count a Made It' })
      proof = 'photo'
    }
  }
  if (!madeIt && !hasChanges && !hasText) {
    return res.status(400).json({ success: false, error: 'Write a comment, add a tweak, or share that you made it' })
  }
  const type: ContributionType = hasChanges ? 'tweak' : madeIt ? 'made' : 'comment'

  try {
    // Safeguards: account standing, content, tweak sanity, daily limits.
    const guard = await guardWrite(viewer.userId, viewer.email)
    if (!guard.ok) return res.status(guard.status).json({ success: false, error: guard.error, code: guard.code })

    const textScreen = screenText(input.text)
    if (!textScreen.ok) return res.status(400).json({ success: false, error: textScreen.error, code: 'content' })

    const recipeDoc = await ref.get()
    const recipeData = recipeDoc.data() ?? {}
    if (recipeData.isPublic === false) return res.status(403).json({ success: false, error: 'This recipe is under review.' })

    let safetyFlags: string[] = []
    if (hasChanges) {
      const tweakScreen = screenChanges(recipeData.recipe ?? recipeData, input.changes!)
      if (!tweakScreen.ok) return res.status(400).json({ success: false, error: tweakScreen.error, code: 'content' })
      safetyFlags = tweakScreen.safetyFlags

      const pending = await ref.collection('contributions').where('userId', '==', viewer.userId).where('status', '==', 'pending').limit(1).get()
      if (!pending.empty) {
        return res.status(409).json({ success: false, error: 'You already have a tweak waiting on this recipe. Wait for the author to respond first.', code: 'duplicate' })
      }
    }

    // One Made It per cook per recipe per day: deterministic id makes a repeat a no-op.
    const day = new Date().toISOString().slice(0, 10)
    const contribRef =
      type === 'made' ? ref.collection('contributions').doc(`made_${viewer.userId}_${day}`) : ref.collection('contributions').doc()
    if (type === 'made' && (await contribRef.get()).exists) {
      return res.status(409).json({ success: false, error: 'Your Made It for today is already counted. Thanks for cooking it!', code: 'duplicate' })
    }

    const allowed = await takeDailyAllowance(viewer.userId, type === 'tweak' ? 'tweak' : 'contribution')
    if (!allowed) return res.status(429).json({ success: false, error: 'You’ve reached today’s posting limit. Come back tomorrow.', code: 'rate_limited' })

    const photoUrl = input.photoBase64 ? await uploadJPEG(`community-recipes/${ref.id}/contributions/${contribRef.id}.jpg`, input.photoBase64) : null
    if (madeIt && input.source === 'web' && !photoUrl) {
      return res.status(400).json({ success: false, error: 'That photo could not be saved. Try a smaller JPEG.' })
    }

    // "I made it with this tweak"
    let tweakId: string | null = null
    if (input.tweakId) {
      const tweakRef = ref.collection('contributions').doc(input.tweakId)
      const tweak = await tweakRef.get()
      if (tweak.exists && tweak.data()?.type === 'tweak' && !tweak.data()?.hidden) {
        tweakId = tweakRef.id
        // Your own tweak doesn't gain credibility from your own Made Its.
        if (madeIt && tweak.data()?.userId !== viewer.userId) await tweakRef.update({ madeCount: FieldValue.increment(1) })
      }
    }

    const now = new Date()
    await contribRef.set({
      type,
      userId: viewer.userId,
      userName: guard.userName,
      text: hasText ? input.text!.trim() : null,
      photoUrl,
      madeIt,
      source: input.source,
      proof,
      changes: hasChanges ? input.changes : [],
      safetyFlags,
      tweakId,
      status: type === 'tweak' ? 'pending' : null,
      madeCount: type === 'tweak' && madeIt ? 1 : 0,
      acceptedInVersion: null,
      recipeVersion: Number(recipeData.version ?? 1),
      hidden: false,
      reportCount: 0,
      createdAt: now,
    })

    const counters: Record<string, any> = { updatedAt: now }
    if (madeIt) counters.madeCount = FieldValue.increment(1)
    if (hasText || hasChanges) counters.commentCount = FieldValue.increment(1)
    const communityPoints = (type === 'tweak' ? 2 : type === 'made' ? 5 : 1) + (type === 'tweak' && madeIt ? 5 : 0)
    counters.communityScore = FieldValue.increment(communityPoints)
    await ref.set(counters, { merge: true })

    return res.status(201).json({ success: true, id: contribRef.id, type, photoUrl, safetyFlags })
  } catch (error) {
    console.error('contribution failed', error)
    return res.status(500).json({ success: false, error: 'Could not save your contribution right now' })
  }
}
