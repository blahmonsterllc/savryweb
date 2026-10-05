// Turns a supermarket's product listings into the price per kilogram Savry's
// cost engine uses. Plain JS so the API route and the tests share it.
//
// A listing says "16 oz" or "1 lb" or "per lb" or "64 fl oz"; a count ("12
// ct") only converts when the caller says what one counts weighs (eggs).
//
// The estimate uses the store's regular price, never a sale price: a sale is
// true this week and gone next, and a recipe's cost should not jump around.
// The sale price rides along as information.

const GRAMS = { lb: 453.59, lbs: 453.59, oz: 28.35, g: 1, kg: 1000, 'fl oz': 29.57, floz: 29.57, ml: 1, l: 1000, gal: 3785, gallon: 3785, qt: 946, quart: 946, pt: 473, pint: 473 }

/** A store price this far from Savry's regional figure is a wrong product match, not a bargain. */
export const SANITY_BAND = { low: 0.4, high: 2.5 }

/**
 * Grams in one package, read from the size text, or null when it cannot be read.
 * Liquids are taken at water's density, which is close enough for milk, broth and juice.
 * @param {string} size
 * @param {{ gramsPerCount?: number }} [options]
 */
export function packageGrams(size, options = {}) {
  const text = String(size ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  if (!text) return null
  // "per lb", "lb" alone: sold by weight, the price is already per pound.
  if (/^(?:per )?lbs?$/.test(text) || /^(?:per )?pound$/.test(text)) return GRAMS.lb
  // "2 x 16 oz", "6 pk / 12 fl oz"
  const multi = text.match(/^(\d+(?:\.\d+)?)\s*(?:x|pk|pack|ct)\s*[/x]?\s*(\d+(?:\.\d+)?)\s*(fl oz|floz|oz|lbs?|g|kg|ml|l)\b/)
  if (multi) return Number(multi[1]) * Number(multi[2]) * GRAMS[multi[3]]
  const single = text.match(/^(\d+(?:\.\d+)?)\s*(fl oz|floz|oz|lbs?|g|kg|ml|l|gal|gallon|qt|quart|pt|pint)\b/)
  if (single) return Number(single[1]) * GRAMS[single[2]]
  const count = text.match(/^(\d+)\s*(?:ct|count|each|ea)\b/)
  if (count && options.gramsPerCount) return Number(count[1]) * options.gramsPerCount
  return null
}

const perKg = (price, grams) => (price && price > 0 && grams ? Math.round((price / grams) * 1000 * 100) / 100 : null)

/**
 * What a store listing works out to per kilogram at the regular price, with
 * the sale price alongside when there is one; null when the size or price
 * cannot be read.
 * @param {{ size?: string, price?: { regular?: number, promo?: number } }} item one entry of a Kroger product's `items`
 * @param {{ gramsPerCount?: number }} [options]
 * @returns {{ perKg: number, promoPerKg: number | null } | null}
 */
export function perKgFromItem(item, options = {}) {
  const grams = packageGrams(item?.size, options)
  const regular = perKg(item?.price?.regular, grams)
  if (!regular) return null
  const promo = perKg(item?.price?.promo, grams)
  return { perKg: regular, promoPerKg: promo && promo < regular ? promo : null }
}

/**
 * One price for a food from the store's search results: the median regular
 * price of the listings that could be read, so one odd match (a tiny jar, a
 * bulk box) does not set the price. With a `baseline` (Savry's regional
 * figure for the food) a median far outside it is taken for a wrong product
 * match and nothing is returned, so the regional figure stands.
 * @param {{ description?: string, items?: object[] }[]} products
 * @param {{ gramsPerCount?: number, baseline?: number }} [options]
 * @returns {{ perKg: number, promoPerKg: number | null, description: string, size: string, listings: number } | null}
 */
export function storePrice(products, options = {}) {
  const candidates = []
  for (const product of products ?? []) {
    for (const item of product.items ?? []) {
      const read = perKgFromItem(item, options)
      if (read) candidates.push({ ...read, description: product.description ?? '', size: item.size ?? '' })
    }
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.perKg - b.perKg)
  const chosen = candidates[Math.floor((candidates.length - 1) / 2)]
  if (typeof options.baseline === 'number' && options.baseline > 0) {
    const ratio = chosen.perKg / options.baseline
    if (ratio < SANITY_BAND.low || ratio > SANITY_BAND.high) return null
  }
  return { ...chosen, listings: candidates.length }
}

/** The words Savry searches a store for, for one of its foods: the shortest phrase of any rule that uses it. */
export function searchTerm(fdcId, rules) {
  let best = null
  for (const rule of rules) {
    if (rule.fdcId !== fdcId) continue
    for (const phrase of rule.phrases ?? []) {
      const clean = phrase.replace(/\(.*?\)/g, '').trim()
      if (clean && (!best || clean.length < best.length)) best = clean
    }
  }
  return best
}
