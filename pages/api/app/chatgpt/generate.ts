import type { NextApiRequest, NextApiResponse } from 'next'
import { validateIOSAPIRequest } from '@/lib/ios-api-security'
import { generateSavryRecipe, SavryModelUnavailableError } from '@/lib/savry-model'

/**
 * Compatibility route for installed iOS builds that still call the historical
 * endpoint name. It intentionally uses only the Savry-owned recipe model.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const securityCheck = await validateIOSAPIRequest(req)
  if (!securityCheck.allowed) {
    return res.status(securityCheck.statusCode || 403).json({
      success: false,
      error: securityCheck.reason || 'Access denied',
    })
  }

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : ''
  if (!prompt) {
    return res.status(400).json({ success: false, error: 'Missing required field: prompt' })
  }

  try {
    const recipe = await generateSavryRecipe({ request: prompt })

    return res.status(200).json({
      success: true,
      content: JSON.stringify(recipe),
      recipe,
      cached: false,
      meta: {
        model: process.env.SAVRY_MODEL_ID || 'savry-recipe-v1',
        provider: 'savry',
        tier: securityCheck.userTier,
      },
    })
  } catch (error) {
    if (error instanceof SavryModelUnavailableError) {
      return res.status(503).json({
        success: false,
        error: error.message,
        code: 'savry_model_unavailable',
      })
    }

    console.error('Savry compatibility endpoint error:', error)
    return res.status(500).json({ success: false, error: 'Failed to generate recipe' })
  }
}
