/**
 * Samples Kroger-family shelf prices at one region's store a day (rotating
 * through SAMPLE_ZIPS), for every food Savry prices from a shelf estimate.
 * The samples are a gauge for the national table (scripts/cost/refresh-bls.mjs
 * blends them in monthly), not anyone's own store price. Vercel Cron calls
 * this daily with `Authorization: Bearer <CRON_SECRET>`; nothing else may.
 *
 * GET /api/cron/kroger-sample → { zip, store, sampled, skipped }
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { createHash, timingSafeEqual } from 'node:crypto'
import rules from '@/content/nutrition/ingredient-rules.json'
import priceFile from '@/content/cost/food-prices.json'
import regional from '@/content/cost/regional-prices.json'
import { krogerConfigured, nearestStore, searchProducts } from '@/lib/kroger'
import { STORE_SEARCH, searchTerm, storePrice } from '@/lib/cost/store-prices.mjs'
import { regionalPrice } from '@/lib/cost/regional.mjs'
import { SAMPLE_ZIPS, nationalEquivalent } from '@/lib/cost/calibrate.mjs'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const config = { maxDuration: 300 }

const PARALLEL = 5
const GRAMS_PER_COUNT: Record<string, number> = { '171287': 50, '172184': 50 }

function sameSecret(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return res.status(503).json({ configured: false, error: 'CRON_SECRET is not set' })
  const header = req.headers.authorization ?? ''
  if (!header.startsWith('Bearer ') || !sameSecret(header.slice(7), secret)) return res.status(401).json({ error: 'Unauthorized' })
  if (!krogerConfigured()) return res.status(503).json({ error: 'Store prices are not configured' })

  const day = Math.floor(Date.now() / 86_400_000)
  const zip = SAMPLE_ZIPS[day % SAMPLE_ZIPS.length]
  const region = regionalPrice(zip, regional as unknown as Parameters<typeof regionalPrice>[1])
  const prices = priceFile.prices as Record<string, { perKg: number; basis: string }>
  // Shelf-estimate foods only; BLS foods keep the government figure.
  const foods = Object.keys(prices).filter((id) => prices[id].basis !== 'bls' && !STORE_SEARCH[Number(id)]?.skip)
  const supabase = getSupabaseAdmin()
  const caller = createHash('sha256').update('savry-kroger:cron-sampler').digest('hex')

  try {
    const granted = await supabase.rpc('take_kroger_calls', { p_kind: 'products', p_calls: foods.length, p_daily_cap: 8000, p_caller: caller, p_caller_cap: 1000 })
    if (granted.error || granted.data !== true) return res.status(200).json({ zip, store: null, sampled: 0, skipped: 'daily Kroger budget is spent' })
    const store = await nearestStore(zip)
    if (!store) return res.status(200).json({ zip, store: null, sampled: 0 })

    const rows: object[] = []
    for (let i = 0; i < foods.length; i += PARALLEL) {
      const slice = foods.slice(i, i + PARALLEL)
      const results = await Promise.all(slice.map(async (food) => {
        const term = searchTerm(Number(food), rules as { fdcId?: number; phrases?: string[] }[])
        if (!term) return null
        const curated = STORE_SEARCH[Number(food)]
        const products = await searchProducts(term, store.locationId, 15).catch(() => [])
        const price = storePrice(products, { gramsPerCount: GRAMS_PER_COUNT[food], baseline: prices[food].perKg * region.multiplier, exclude: curated?.exclude, require: curated?.require })
        if (!price) return null
        return {
          zip, state: region.state, location_id: store.locationId, fdc_id: Number(food), per_kg: price.perKg,
          national_per_kg: nationalEquivalent(price.perKg, region.multiplier), store_brand: price.storeBrand, listings: price.listings,
        }
      }))
      for (const row of results) if (row) rows.push(row)
    }
    if (rows.length > 0) {
      const { error } = await supabase.from('kroger_price_samples').upsert(rows, { onConflict: 'sampled_on,location_id,fdc_id' })
      if (error) throw error
    }
    return res.status(200).json({ zip, store: store.name, sampled: rows.length, of: foods.length })
  } catch (error: any) {
    console.error('[cron/kroger-sample]', error?.message ?? error)
    return res.status(500).json({ error: 'Sampling failed', zip })
  }
}
