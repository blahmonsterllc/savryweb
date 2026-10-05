/**
 * Shelf prices at the cook's nearest Kroger-family store, per Savry food.
 *
 * GET /api/prices/store?zip=43017&foods=171077,170000,168894
 *
 * → 200 { store: { name, chain, city, state } | null, prices: { "<fdcId>": { perKg, promoPerKg, description, size, listings, storeBrand } }, asOf }
 *
 * The store's everyday label (Kroger, Heritage Farm, Smart Way...) sets the
 * price when the store carries one; storeBrand says whether it did.
 *
 * perKg is the store's regular price (the median across what it carries);
 * a sale price comes back as promoPerKg and is not used for the estimate.
 * A store price far outside Savry's regional figure for the food is dropped
 * as a wrong product match.
 *   400 bad ZIP or food list
 *   503 { error } store prices are not configured on this server
 *
 * The ZIP is used for the store lookup and nothing else; nothing is stored
 * against a member. Results are cached in this server process for 12 hours
 * per store and food so Kroger's free daily allowance goes a long way.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import rules from '@/content/nutrition/ingredient-rules.json'
import priceFile from '@/content/cost/food-prices.json'
import regional from '@/content/cost/regional-prices.json'
import { krogerConfigured, nearestStore, searchProducts, type KrogerStore } from '@/lib/kroger'
import { STORE_SEARCH, isValueBrand, packageGrams, searchTerm, storePrice } from '@/lib/cost/store-prices.mjs'
import { regionalPrice } from '@/lib/cost/regional.mjs'

const MAX_FOODS = 40
const PRICE_TTL = 12 * 60 * 60 * 1000
const STORE_TTL = 24 * 60 * 60 * 1000
/** Foods sold by the count; what one weighs so "12 ct" becomes a weight. */
const GRAMS_PER_COUNT: Record<string, number> = { '171287': 50, '172184': 50 }

type StorePriceResult = { perKg: number; promoPerKg: number | null; description: string; size: string; listings: number; storeBrand: boolean } | null
const storeCache = new Map<string, { at: number; store: KrogerStore | null }>()
const priceCache = new Map<string, { at: number; price: StorePriceResult }>()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!krogerConfigured()) return res.status(503).json({ error: 'Store prices are not configured' })

  const zip = String(req.query.zip ?? '').trim()
  if (!/^\d{5}$/.test(zip)) return res.status(400).json({ error: 'A five-digit ZIP code is required' })
  const foods = String(req.query.foods ?? '').split(',').map((s) => s.trim()).filter((s) => /^\d{5,7}$/.test(s)).slice(0, MAX_FOODS)
  if (foods.length === 0) return res.status(400).json({ error: 'List the foods to price' })

  try {
    const cachedStore = storeCache.get(zip)
    let store: KrogerStore | null
    if (cachedStore && cachedStore.at > Date.now() - STORE_TTL) {
      store = cachedStore.store
    } else {
      store = await nearestStore(zip)
      storeCache.set(zip, { at: Date.now(), store })
    }
    if (!store) return res.status(200).json({ store: null, prices: {}, asOf: new Date().toISOString() })

    // The JSON's [first, last, state] rows read as (string | number)[]; the shape is checked by tests/store-prices.test.mjs.
    const { multiplier } = regionalPrice(zip, regional as unknown as Parameters<typeof regionalPrice>[1])

    // ?explain=1 with one food: the listings the store returned and how each was read, for tuning the searches.
    if (req.query.explain === '1' && foods.length === 1) {
      const food = foods[0]
      const curated = STORE_SEARCH[Number(food)]
      const term = curated?.skip ? null : searchTerm(Number(food), rules as { fdcId?: number; phrases?: string[] }[])
      const products = term ? await searchProducts(term, store.locationId, 15) : []
      const listings = products.flatMap((product) => (product.items ?? []).map((item) => ({
        brand: product.brand ?? null,
        description: product.description ?? '',
        size: item.size ?? '',
        regular: item.price?.regular ?? null,
        promo: item.price?.promo ?? null,
        grams: packageGrams(item.size ?? '', { gramsPerCount: GRAMS_PER_COUNT[food] }),
        house: isValueBrand(product),
        excluded: Boolean(curated?.exclude?.test(product.description ?? '')) || Boolean(curated?.require && !curated.require.test(product.description ?? '')),
      })))
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ store: store.name, term, skip: Boolean(curated?.skip), listings })
    }
    const prices: Record<string, NonNullable<StorePriceResult>> = {}
    for (const food of foods) {
      const key = `${store.locationId}:${food}`
      const cached = priceCache.get(key)
      let price: StorePriceResult
      if (cached && cached.at > Date.now() - PRICE_TTL) {
        price = cached.price
      } else {
        const curated = STORE_SEARCH[Number(food)]
        const term = curated?.skip ? null : searchTerm(Number(food), rules as { fdcId?: number; phrases?: string[] }[])
        const table = (priceFile.prices as Record<string, { perKg: number }>)[food]?.perKg
        const baseline = typeof table === 'number' ? table * multiplier : undefined
        // A wider net (15) leaves enough after the curated exclusions to take a fair median.
        price = term ? storePrice(await searchProducts(term, store.locationId, 15), { gramsPerCount: GRAMS_PER_COUNT[food], baseline, exclude: curated?.exclude, require: curated?.require }) : null
        priceCache.set(key, { at: Date.now(), price })
      }
      if (price) prices[food] = price
    }
    return res.status(200).json({ store: { name: store.name, chain: store.chain, city: store.city, state: store.state }, prices, asOf: new Date().toISOString() })
  } catch (error: any) {
    console.error('[prices/store]', error?.message ?? error)
    return res.status(502).json({ error: 'The store could not be reached' })
  }
}
