/**
 * Kitchen scan for Savry+ members: Claude names the food in up to three
 * photos of a fridge, pantry or spice rack.
 *
 * POST /api/ai/pantry
 *   Authorization: Bearer <Supabase access token>
 *   X-Savry-Plus: <Apple-signed Savry+ transaction>   (required)
 *   { "photos": ["<base64 JPEG or PNG>", ...] }       (1 to 3)
 *
 * → 200 { foods, remaining }
 *   401 not signed in · 403 not a Savry+ member · 402 today's photos used
 *   400 bad photos · 413 too large · 502/503 the model could not answer
 *
 * Photos are counted before the model is called (take_ai_pantry) and given
 * back if it fails. Nothing about the photos is stored.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireMember } from '@/lib/member-api'
import { readSavryPlusPurchase } from '@/lib/app-store-membership'
import { AIRecipeError } from '@/lib/ai-recipes'
import { seeFoods, type PantryPhoto } from '@/lib/ai-pantry'

export const config = { maxDuration: 60, api: { bodyParser: { sizeLimit: '4mb' } } }

const MAX_PHOTOS = 3
const MAX_PHOTO_CHARS = 1_400_000 // about 1 MB of image, base64

function isSavryPlus(req: NextApiRequest, userId: string): boolean {
  const signed = req.headers['x-savry-plus']
  if (typeof signed !== 'string' || signed.length > 20_000) return false
  const result = readSavryPlusPurchase(signed, userId)
  if ('rejected' in result) return false
  const { expiresAt, revoked } = result.purchase
  return !revoked && Date.parse(expiresAt) > Date.now()
}

/** Only real JPEG or PNG data, recognised by its first bytes. */
function photoFrom(value: unknown): PantryPhoto | null {
  if (typeof value !== 'string' || value.length < 100 || value.length > MAX_PHOTO_CHARS) return null
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null
  if (value.startsWith('/9j/')) return { mediaType: 'image/jpeg', data: value }
  if (value.startsWith('iVBORw0KGgo')) return { mediaType: 'image/png', data: value }
  return null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const member = await requireMember(req, res)
  if (!member) return
  if (!isSavryPlus(req, member.user.id)) return res.status(403).json({ error: 'Kitchen scans are part of Savry+.' })

  const raw = Array.isArray(req.body?.photos) ? req.body.photos : []
  if (raw.length < 1 || raw.length > MAX_PHOTOS) return res.status(400).json({ error: 'Send one to three photos.' })
  const photos = raw.map(photoFrom)
  if (photos.some((photo: PantryPhoto | null) => photo === null)) return res.status(400).json({ error: 'Those photos could not be read.' })

  const supabase = getSupabaseAdmin()
  const { data: allowance, error } = await supabase.rpc('take_ai_pantry', { p_user: member.user.id, p_photos: photos.length })
  if (error) {
    console.error('ai pantry: allowance check failed', error.message)
    return res.status(503).json({ error: 'The kitchen scan is busy right now. Try again in a minute.' })
  }
  const taken = allowance as { allowed: boolean; remaining: number }
  if (!taken.allowed) return res.status(402).json({ error: 'That’s today’s kitchen scans used up. They reset tomorrow.', remaining: taken.remaining })

  try {
    const foods = await seeFoods(photos as PantryPhoto[])
    return res.status(200).json({ foods, remaining: taken.remaining })
  } catch (failure) {
    await supabase.rpc('return_ai_pantry', { p_user: member.user.id }).then(() => undefined, () => undefined)
    if (failure instanceof AIRecipeError) return res.status(failure.status).json({ error: failure.message })
    console.error('ai pantry: unexpected failure', failure)
    return res.status(502).json({ error: 'Those photos could not be read. Try again.' })
  }
}
