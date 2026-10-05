/**
 * Shelf prices at the cook's nearest Kroger-family store, per Savry food.
 *
 * GET /api/prices/store?zip=43017&foods=171077,170000,168894
 *
 * → 200 { store: { name, chain, city, state } | null, prices: { "<fdcId>": { perKg, promoPerKg, description, size, listings, storeBrand } }, partial, asOf }
 *   400 bad ZIP or food list · 429 too many requests · 503 not configured
 *
 * perKg is the store's regular price (the store's everyday label when it
 * carries one, else the median across what it carries); a sale price comes
 * back as promoPerKg and is not used for the estimate. A store price far
 * outside Savry's regional figure for the food is dropped as a wrong match.
 *
 * Kroger's daily allowance is a shared resource, so it is guarded four ways:
 * only foods Savry prices are looked up (normalised, deduplicated, capped);
 * store lookups and listings are cached per ZIP and per store and food,
 * including empty answers; each caller is limited per server instance; and
 * every Kroger call draws on a daily budget and a per-caller hourly budget
 * kept in the database across all instances (callers are a hash of their IP). When the budget is spent the answer is `partial` and the app
 * keeps its regional prices. The ZIP is used for the store lookup only and is
 * not stored against anyone, though like any URL it appears in request logs.
 *
 * Store prices are a Savry+ feature: the app sends Apple's signed copy of
 * the member's current Savry+ transaction in X-Savry-Plus, verified here
 * against Apple's root certificate (no Savry account needed). Without a
 * live membership the answer is 402 and the app keeps its regional prices.
 *
 * ?explain=1 (admins only) lists what the store returned for one food.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { createHash } from 'node:crypto'
import rules from '@/content/nutrition/ingredient-rules.json'
import priceFile from '@/content/cost/food-prices.json'
import regional from '@/content/cost/regional-prices.json'
import { krogerConfigured, nearestStore, searchProducts, type KrogerProduct, type KrogerStore } from '@/lib/kroger'
import { STORE_SEARCH, isValueBrand, packageGrams, searchTerm, storePrice } from '@/lib/cost/store-prices.mjs'
import { regionalPrice } from '@/lib/cost/regional.mjs'
import { requireAdmin } from '@/lib/admin-session'
import { readSavryPlusPurchase } from '@/lib/app-store-membership'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const MAX_FOODS = 25
const LISTING_TTL = 12 * 60 * 60 * 1000
const STORE_TTL = 24 * 60 * 60 * 1000
/** Kroger allows about 1,600 location and 10,000 product calls a day; Savry stays well under both. */
const DAILY_CAP = { locations: 1200, products: 8000 } as const
/** Per caller, per server instance: a cheap first line before the database is asked. */
const CALLER_LIMIT = { requests: 20, windowMs: 10 * 60 * 1000 }
/** Per caller across every instance, in Kroger calls an hour: the app needs about 26 a day. */
const CALLER_KROGER_CALLS_PER_HOUR = 60
/** Foods sold by the count; what one weighs so "12 ct" becomes a weight. */
const GRAMS_PER_COUNT: Record<string, number> = { '171287': 50, '172184': 50 }

const prices = priceFile.prices as Record<string, { perKg: number }>
const regionalTable = regional as unknown as Parameters<typeof regionalPrice>[1]
const ruleList = rules as { fdcId?: number; phrases?: string[] }[]

const storeCache = new Map<string, { at: number; store: KrogerStore | null }>()
const listingCache = new Map<string, { at: number; products: KrogerProduct[] }>()
const callers = new Map<string, { start: number; count: number }>()

function callerIp(req: NextApiRequest): string {
  return String(req.headers['x-real-ip'] ?? req.headers['x-forwarded-for'] ?? 'unknown').split(',')[0].trim()
}

/** The caller as the database knows it: a hash of the IP address, never the address. */
function callerKey(req: NextApiRequest): string {
  return createHash('sha256').update(`savry-kroger:${callerIp(req)}`).digest('hex')
}

function callerAllowed(req: NextApiRequest): boolean {
  const ip = callerIp(req)
  const now = Date.now()
  const seen = callers.get(ip)
  if (!seen || now - seen.start > CALLER_LIMIT.windowMs) {
    if (callers.size > 5000) callers.clear()
    callers.set(ip, { start: now, count: 1 })
    return true
  }
  seen.count += 1
  return seen.count <= CALLER_LIMIT.requests
}

async function takeBudget(req: NextApiRequest, kind: keyof typeof DAILY_CAP, calls: number): Promise<boolean> {
  if (calls < 1) return true
  const { data, error } = await getSupabaseAdmin().rpc('take_kroger_calls', { p_kind: kind, p_calls: calls, p_daily_cap: DAILY_CAP[kind], p_caller: callerKey(req), p_caller_cap: CALLER_KROGER_CALLS_PER_HOUR })
  if (error) { console.error('[prices/store] budget', error.message); return false }
  return data === true
}

/** The foods asked for, as Savry's own ids: numeric, deduplicated, priced, and searchable at a store. */
function foodList(raw: unknown): string[] {
  const ids = String(raw ?? '').split(',').map((s) => s.trim()).filter((s) => /^\d{1,7}$/.test(s)).map((s) => String(Number(s)))
  return [...new Set(ids)].filter((id) => prices[id] && !STORE_SEARCH[Number(id)]?.skip).slice(0, MAX_FOODS)
}

/** True when the request carries Apple's signature for a live Savry+ membership. */
function isSavryPlus(req: NextApiRequest): boolean {
  const signed = req.headers['x-savry-plus']
  if (typeof signed !== 'string' || signed.length > 20_000) return false
  const result = readSavryPlusPurchase(signed)
  if ('rejected' in result) return false
  const { expiresAt, revoked } = result.purchase
  return !revoked && Date.parse(expiresAt) > Date.now()
}

function fail(res: NextApiResponse, status: number, error: string) {
  res.setHeader('Cache-Control', 'no-store')
  return res.status(status).json({ error })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return fail(res, 405, 'Method not allowed')
  }
  if (!krogerConfigured()) return fail(res, 503, 'Store prices are not configured')

  const explain = req.query.explain === '1'
  if (explain && !(await requireAdmin(req, res))) return
  if (!explain && !callerAllowed(req)) return fail(res, 429, 'Too many requests; try again later')
  if (!explain && !isSavryPlus(req)) return fail(res, 402, 'Store prices come with Savry+')

  const zip = String(req.query.zip ?? '').trim()
  const region = regionalPrice(zip, regionalTable)
  if (!/^\d{5}$/.test(zip) || !region.state) return fail(res, 400, 'A US five-digit ZIP code is required')
  const foods = foodList(req.query.foods)
  if (foods.length === 0) return fail(res, 400, 'List the foods to price')

  try {
    const cachedStore = storeCache.get(zip)
    let store: KrogerStore | null
    if (cachedStore && cachedStore.at > Date.now() - STORE_TTL) {
      store = cachedStore.store
    } else {
      if (!(await takeBudget(req, 'locations', 1))) return res.status(200).setHeader('Cache-Control', 'no-store').json({ store: null, prices: {}, partial: true, asOf: new Date().toISOString() })
      store = await nearestStore(zip)
      // An empty answer is remembered too, so a ZIP with no store costs one lookup a day.
      if (storeCache.size > 20000) storeCache.clear()
      storeCache.set(zip, { at: Date.now(), store })
    }
    if (!store) {
      res.setHeader('Cache-Control', 'private, max-age=3600')
      return res.status(200).json({ store: null, prices: {}, partial: false, asOf: new Date().toISOString() })
    }

    if (explain) {
      const food = foods[0]
      const curated = STORE_SEARCH[Number(food)]
      const term = searchTerm(Number(food), ruleList)
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
      return res.status(200).json({ store: store.name, term, listings })
    }

    // Listings are cached raw per store and food; the regional check runs per request, for this caller's region.
    const fresh = (food: string) => {
      const hit = listingCache.get(`${store!.locationId}:${food}`)
      return hit && hit.at > Date.now() - LISTING_TTL ? hit.products : null
    }
    const missing = foods.filter((food) => !fresh(food))
    let partial = false
    let fetchable = missing
    if (missing.length > 0 && !(await takeBudget(req, 'products', missing.length))) {
      partial = true
      fetchable = []
    }
    for (const food of fetchable) {
      const term = searchTerm(Number(food), ruleList)
      const products = term ? await searchProducts(term, store.locationId, 15) : []
      if (listingCache.size > 50000) listingCache.clear()
      listingCache.set(`${store.locationId}:${food}`, { at: Date.now(), products })
    }

    const result: Record<string, NonNullable<ReturnType<typeof storePrice>>> = {}
    for (const food of foods) {
      const products = fresh(food)
      if (!products) continue
      const curated = STORE_SEARCH[Number(food)]
      const price = storePrice(products, { gramsPerCount: GRAMS_PER_COUNT[food], baseline: prices[food].perKg * region.multiplier, exclude: curated?.exclude, require: curated?.require })
      if (price) result[food] = price
    }
    res.setHeader('Cache-Control', partial ? 'no-store' : 'private, max-age=3600')
    return res.status(200).json({ store: { name: store.name, chain: store.chain, city: store.city, state: store.state }, prices: result, partial, asOf: new Date().toISOString() })
  } catch (error: any) {
    console.error('[prices/store]', error?.message ?? error)
    return fail(res, 502, 'The store could not be reached')
  }
}
