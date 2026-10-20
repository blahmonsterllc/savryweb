/**
 * Recipe help for iPhones without Apple Intelligence. The app sends the
 * request it would have given the on-device model; Claude writes the recipe.
 *
 * POST /api/ai/recipe
 *   Authorization: Bearer <Supabase access token>   (a free Savry account)
 *   X-Savry-Plus: <Apple-signed Savry+ transaction>  (optional; members get more)
 *   { "request": "<the instruction the app built, up to 6,000 characters>" }
 *
 * → 200 { recipe, remaining }
 *   401 not signed in · 402 allowance used up · 400 bad request
 *   422 not a cooking request · 502/503 the model could not answer
 *
 * Every use is counted before the model is called (take_ai_recipe) and given
 * back if the model fails, so the free allowance can't be exceeded by
 * reinstalling the app and the cost stays bounded per account.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireMember } from '@/lib/member-api'
import { readSavryPlusPurchase } from '@/lib/app-store-membership'
import { AIRecipeError, writeRecipe } from '@/lib/ai-recipes'

export const config = { maxDuration: 60 }

const MAX_REQUEST = 6000

/** True when the request carries Apple's signature for this member's live Savry+ membership. */
function isSavryPlus(req: NextApiRequest, userId: string): boolean {
  const signed = req.headers['x-savry-plus']
  if (typeof signed !== 'string' || signed.length > 20_000) return false
  const result = readSavryPlusPurchase(signed, userId)
  if ('rejected' in result) return false
  const { expiresAt, revoked } = result.purchase
  return !revoked && Date.parse(expiresAt) > Date.now()
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const member = await requireMember(req, res)
  if (!member) return

  const request = typeof req.body?.request === 'string' ? req.body.request.trim() : ''
  if (!request || request.length > MAX_REQUEST) return res.status(400).json({ error: 'Describe the recipe in fewer words.' })

  const supabase = getSupabaseAdmin()
  const plus = isSavryPlus(req, member.user.id)
  const { data: allowance, error } = await supabase.rpc('take_ai_recipe', { p_user: member.user.id, p_savry_plus: plus })
  if (error) {
    console.error('ai recipe: allowance check failed', error.message)
    return res.status(503).json({ error: 'Recipe help is busy right now. Try again in a minute.' })
  }
  const taken = allowance as { allowed: boolean; reason?: string; remaining: number }
  if (!taken.allowed) {
    return res.status(402).json({
      error: taken.reason === 'daily_limit'
        ? 'That’s today’s recipe help used up. It resets tomorrow.'
        : 'You’ve used this month’s free recipe help. Savry+ makes it unlimited.',
      reason: taken.reason,
    })
  }

  try {
    const recipe = await writeRecipe(request)
    return res.status(200).json({ recipe, remaining: taken.remaining, savryPlus: plus })
  } catch (failure) {
    await supabase.rpc('return_ai_recipe', { p_user: member.user.id }).then(() => undefined, () => undefined)
    if (failure instanceof AIRecipeError) return res.status(failure.status).json({ error: failure.message })
    console.error('ai recipe: unexpected failure', failure)
    return res.status(502).json({ error: 'Recipe help could not answer that. Try again.' })
  }
}
