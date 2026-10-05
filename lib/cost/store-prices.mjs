// Turns a supermarket's product listings into the price per kilogram Savry's
// cost engine uses. Plain JS so the API route and the tests share it.
//
// A listing says "16 oz" or "1 lb" or "per lb" or "64 fl oz"; a count ("12
// ct") only converts when the caller says what one counts weighs (eggs).

const GRAMS = { lb: 453.59, lbs: 453.59, oz: 28.35, g: 1, kg: 1000, 'fl oz': 29.57, floz: 29.57, ml: 1, l: 1000, gal: 3785, gallon: 3785, qt: 946, quart: 946, pt: 473, pint: 473 }

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

/**
 * The price per kilogram a store listing works out to, or null.
 * @param {{ size?: string, price?: { regular?: number, promo?: number } }} item one entry of a Kroger product's `items`
 * @param {{ gramsPerCount?: number }} [options]
 */
export function perKgFromItem(item, options = {}) {
  const grams = packageGrams(item?.size, options)
  const price = item?.price?.promo && item.price.promo > 0 ? item.price.promo : item?.price?.regular
  if (!grams || !price || price <= 0) return null
  return Math.round((price / grams) * 1000 * 100) / 100
}

/**
 * One price for a food from the store's search results: the median of the
 * listings that could be read, so one odd match (a tiny jar, a bulk box)
 * does not set the price.
 * @param {{ description?: string, items?: object[] }[]} products
 * @param {{ gramsPerCount?: number }} [options]
 * @returns {{ perKg: number, description: string, size: string, promo: boolean } | null}
 */
export function storePrice(products, options = {}) {
  const candidates = []
  for (const product of products ?? []) {
    for (const item of product.items ?? []) {
      const perKg = perKgFromItem(item, options)
      if (perKg) candidates.push({ perKg, description: product.description ?? '', size: item.size ?? '', promo: Boolean(item.price?.promo && item.price.promo > 0) })
    }
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.perKg - b.perKg)
  return candidates[Math.floor((candidates.length - 1) / 2)]
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
