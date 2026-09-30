/**
 * POST /api/app/recipes/publish
 *
 * Called by the Savry iOS app ("Publish to Savry.io"). Requires the site JWT
 * as a Bearer token (obtained through /app-login). Creates a public document
 * in `community_recipes`, or updates the one this device already published
 * for the same recipe, and returns its public page URL.
 *
 * Body:     PublishPayload (see lib/community-recipes.ts)
 * Response: { success: true, id, slug, url, updated: boolean }
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getStorage } from 'firebase-admin/storage'
import { db } from '@/lib/firebase'
import { verifyJWT } from '@/lib/auth'
import { buildRecipeIndex, COLLECTION, publishPayloadSchema, publishedRecipeId, recipeContentHash, slugify } from '@/lib/community-recipes'
import { recipePageURL } from '@/lib/site-url'
import { guardWrite, screenText, takeDailyAllowance } from '@/lib/community-guard'

export const config = {
  api: { bodyParser: { sizeLimit: '2mb' } },
}

async function uploadImage(docId: string, base64: string): Promise<string | null> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  if (!bucketName) {
    console.warn('publish: no storage bucket configured, skipping image')
    return null
  }
  try {
    const buffer = Buffer.from(base64, 'base64')
    if (buffer.length === 0 || buffer.length > 900_000) return null
    const bucket = getStorage().bucket(bucketName)
    const path = `community-recipes/${docId}.jpg`
    const file = bucket.file(path)
    await file.save(buffer, { contentType: 'image/jpeg', public: true, resumable: false, metadata: { cacheControl: 'public, max-age=31536000' } })
    return `https://storage.googleapis.com/${bucket.name}/${path}`
  } catch (error) {
    console.error('publish: image upload failed', error)
    return null
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  // Auth: site JWT only. Ownership comes from the token, never the body.
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return res.status(401).json({ success: false, error: 'Sign in to publish' })
  let userId: string
  let email: string
  try {
    const decoded = await verifyJWT(token)
    userId = decoded.userId
    email = decoded.email
  } catch {
    return res.status(401).json({ success: false, error: 'Session expired. Please sign in again.' })
  }

  const parsed = publishPayloadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Recipe is missing required fields', details: parsed.error.flatten() })
  }
  const p = parsed.data

  if (p.sourceClient === 'savry-web' && !p.rightsAttested) {
    return res.status(400).json({ success: false, error: 'Confirm that you have permission to share this recipe.' })
  }

  try {
    // Safeguards: account standing, content, daily limit.
    const guard = await guardWrite(userId, email)
    if (!guard.ok) return res.status(guard.status).json({ success: false, error: guard.error, code: guard.code })
    const texts = [p.title, p.description, p.notes, ...p.instructions, ...p.ingredients.map((i) => i.name), ...p.tags]
    for (const t of texts) {
      const screen = screenText(t)
      if (!screen.ok) return res.status(400).json({ success: false, error: `Can’t publish: ${screen.error}`, code: 'content' })
    }
    if (!(await takeDailyAllowance(userId, 'publish'))) {
      return res.status(429).json({ success: false, error: 'You’ve reached today’s publishing limit. Try again tomorrow.', code: 'rate_limited' })
    }
    const authorName: string = guard.userName

    // A stable id makes retries idempotent and prevents duplicate pages when
    // two devices publish the same private recipe at nearly the same time.
    const ref = db.collection(COLLECTION).doc(publishedRecipeId(userId, p.clientRecipeId))
    const before = await ref.get()
    const beforeData = before.data()
    if (before.exists && beforeData?.importedBy !== userId) {
      return res.status(409).json({ success: false, error: 'That recipe id is already in use' })
    }
    const slug: string = beforeData?.slug ?? `${slugify(p.title)}-${ref.id.slice(-6)}`

    const uploadedImage = p.imageBase64 ? await uploadImage(ref.id, p.imageBase64) : null
    const imageUrl = uploadedImage ?? beforeData?.recipe?.imageUrl ?? beforeData?.imageUrl ?? null
    const now = new Date()

    const recipe = {
      title: p.title,
      description: p.description ?? null,
      prepTime: p.prepTime,
      cookTime: p.cookTime,
      totalTime: p.prepTime + p.cookTime,
      servings: p.servings,
      servingType: p.servingType,
      yieldUnit: p.yieldUnit ?? null,
      difficulty: p.difficulty,
      category: p.category,
      cuisine: p.cuisine ?? null,
      tags: p.tags,
      dietaryTags: p.dietaryTags,
      dietary: p.dietaryTags, // older field name used by video imports
      allergens: p.allergens,
      equipment: p.equipment,
      ovenTemp: p.ovenTemp ?? null,
      notes: p.notes ?? null,
      ingredients: p.ingredients.map((i) => ({
        name: i.name,
        amount: i.amount ?? null,
        unit: i.unit ?? null,
        section: i.section ?? null,
        isOptional: i.isOptional,
      })),
      instructions: p.instructions.map((text, i) => ({ step: i + 1, text })),
      nutritionPerServing: p.nutritionPerServing ?? null,
      imageUrl,
    }

    const index = buildRecipeIndex(recipe, authorName)
    const doc = {
      recipe,
      slug,
      title: p.title, // top-level copy for simple queries
      clientRecipeId: p.clientRecipeId,
      importedBy: userId,
      importedByUsername: authorName,
      sourceType: p.sourceClient === 'savry-web' ? 'web' : 'app',
      sourcePlatform: p.sourceClient,
      sourceUrl: p.sourceURL ?? null,
      extractionMethod: 'user_published',
      status: 'published',
      isPublic: true,
      permissions: {
        allowCommunitySaves: true,
        allowCommunityTweaks: true,
        allowPersonalAdaptations: true,
        authorControlsCanonicalVersion: true,
        rightsAttested: p.rightsAttested,
        rightsAttestedAt: p.rightsAttested ? now : null,
        consentVersion: 'community-publish-2026-09-28',
      },
      isFeatured: beforeData?.isFeatured ?? false,
      isVerified: false,
      updatedAt: now,
      ...index,
    }

    const saved = await db.runTransaction(async (tx) => {
      const current = await tx.get(ref)
      const currentData = current.data()
      if (current.exists && currentData?.importedBy !== userId) throw new Error('ownership_conflict')

      const currentVersion = Number(currentData?.version ?? 1)
      const currentHash = currentData?.contentHash ?? (currentData?.recipe ? recipeContentHash(currentData.recipe) : null)
      const contentChanged = !current.exists || currentHash !== index.contentHash
      const nextVersion = current.exists && contentChanged ? currentVersion + 1 : currentVersion

      if (current.exists && contentChanged) {
        tx.set(ref.collection('versions').doc(String(currentVersion)), {
          version: currentVersion,
          recipe: currentData?.recipe,
          contentHash: currentHash,
          archivedAt: now,
          archivedBy: userId,
          reason: p.sourceClient === 'savry-web' ? 'web_republish' : 'app_republish',
        })
      }

      const madeCount = Number(currentData?.madeCount ?? 0)
      const commentCount = Number(currentData?.commentCount ?? 0)
      tx.set(
        ref,
        {
          ...doc,
          version: nextVersion,
          communityScore: index.qualityScore + madeCount * 5 + commentCount,
          ...(current.exists
            ? {}
            : {
                createdAt: now,
                publishedAt: now,
                importCount: 0,
                viewCount: 0,
                likeCount: 0,
                madeCount: 0,
                commentCount: 0,
              }),
        },
        { merge: true }
      )
      return { updated: current.exists, version: nextVersion, contentChanged }
    })

    return res.status(200).json({ success: true, id: ref.id, slug, url: recipePageURL(slug), ...saved })
  } catch (error: any) {
    console.error('publish failed:', error)
    return res.status(500).json({ success: false, error: 'Could not publish this recipe right now' })
  }
}
