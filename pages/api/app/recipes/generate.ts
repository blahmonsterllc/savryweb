/**
 * iOS App Recipe Generation Endpoint
 * The iOS app calls this endpoint to generate recipes
 * All processing happens server-side to keep the API key secure
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '@/lib/firebase'
import { validateIOSAPIRequest } from '@/lib/ios-api-security'
import {
  generateSavryRecipe,
  SavryModelUnavailableError,
  savryRecipeRequestSchema,
} from '@/lib/savry-model'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const security = await validateIOSAPIRequest(req)
  if (!security.allowed) {
    return res.status(security.statusCode || 403).json({ success: false, error: security.reason || 'Access denied' })
  }

  const parsed = savryRecipeRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid recipe request' })
  }

  try {
    const recipe = await generateSavryRecipe(parsed.data)
    const currentMonth = new Date().toISOString().slice(0, 7)
    const usageRef = db.collection('ai_usage').doc(security.userId!)
    const usage = await usageRef.get()
    if (usage.data()?.month === currentMonth) {
      await usageRef.set({ count: FieldValue.increment(1), lastUsed: new Date() }, { merge: true })
    } else {
      await usageRef.set({ userId: security.userId, count: 1, month: currentMonth, lastUsed: new Date() })
    }

    return res.status(200).json({
      success: true,
      recipe,
      model: process.env.SAVRY_MODEL_ID || 'savry-recipe-v1',
      provider: 'savry',
    })
  } catch (error) {
    if (error instanceof SavryModelUnavailableError) {
      return res.status(503).json({ success: false, error: error.message, code: 'savry_model_unavailable' })
    }
    console.error('Savry recipe generation failed', error)
    return res.status(500).json({ success: false, error: 'Could not build that recipe right now' })
  }
}






