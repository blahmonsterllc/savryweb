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
  // Kroger writes "4 sticks / 16 oz" and "4 sticks / 16 oz / 2 pk": the weight
  // is one part, a pack count another, and a count of pieces inside the weight
  // ("4 sticks") changes nothing.
  if (text.includes('/') && !/^\d+\/\d+/.test(text)) {
    const parts = text.split('/').map((part) => part.trim())
    const weight = parts.map((part) => packageGrams(part, options)).find((grams) => grams)
    if (!weight) return null
    const pack = parts.map((part) => part.match(/^(\d+)\s*(?:pk|pack|packs)$/)).find(Boolean)
    return pack ? weight * Number(pack[1]) : weight
  }
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
 * The store's own everyday labels across the Kroger family: what a cook
 * watching the budget actually puts in the cart. Premium and organic house
 * lines (Private Selection, Simple Truth) are left out on purpose; they are
 * store brands but not the budget choice.
 */
const VALUE_BRANDS = /^(kroger|smart way|heritage farm|harris teeter|hemisfares|big k|home sense|ralphs|fred meyer|king soopers|fry's|smith's|qfc|dillons|city market|food 4 less|foods co|mariano's|pick 'n save|metro market|baker's|gerbes|jay c|pay less|ruler)\b/i

/** True when a product is the store's everyday label, by its brand or, failing that, its name. */
export function isValueBrand(product) {
  const brand = String(product?.brand ?? '').trim()
  if (brand) return VALUE_BRANDS.test(brand)
  return VALUE_BRANDS.test(String(product?.description ?? '').replace(/[®™]/g, '').trim())
}

/**
 * One price for a food from the store's search results. The store's own
 * everyday label sets it when the store carries one (the median across those
 * listings); otherwise the median regular price of every listing that could
 * be read, so one odd match (a tiny jar, a bulk box, a premium brand) does not
 * set the price. With a `baseline` (Savry's regional figure for the food) a
 * price far outside it is taken for a wrong product match and nothing is
 * returned, so the regional figure stands.
 * @param {{ description?: string, brand?: string, items?: object[] }[]} products
 * @param {{ gramsPerCount?: number, baseline?: number, exclude?: RegExp, require?: RegExp }} [options]
 * @returns {{ perKg: number, promoPerKg: number | null, description: string, size: string, listings: number, storeBrand: boolean } | null}
 */
export function storePrice(products, options = {}) {
  const candidates = []
  for (const product of products ?? []) {
    if (options.exclude && options.exclude.test(product.description ?? '')) continue
    if (options.require && !options.require.test(product.description ?? '')) continue
    const storeBrand = isValueBrand(product)
    for (const item of product.items ?? []) {
      const read = perKgFromItem(item, options)
      if (read) candidates.push({ ...read, description: product.description ?? '', size: item.size ?? '', storeBrand })
    }
  }
  if (candidates.length === 0) return null
  const house = candidates.filter((c) => c.storeBrand)
  const pool = house.length > 0 ? house : candidates
  pool.sort((a, b) => a.perKg - b.perKg)
  const chosen = pool[Math.floor((pool.length - 1) / 2)]
  if (typeof options.baseline === 'number' && options.baseline > 0) {
    const ratio = chosen.perKg / options.baseline
    if (ratio < SANITY_BAND.low || ratio > SANITY_BAND.high) return null
  }
  return { ...chosen, listings: candidates.length }
}

/**
 * Store searches for the foods Savry's recipes use most, where the shortest
 * rule phrase pulls the wrong product ("butter" finds spreads, "potato" finds
 * chips). `exclude` drops listings whose description matches, before the
 * median is taken. Everything else falls back to the shortest rule phrase.
 * `require` must match the description too; `skip` foods are sold by the each
 * (lemons, limes, garlic heads), so a shelf listing carries no weight and the
 * regional price stands.
 * @type {Record<number, { term: string, exclude?: RegExp, require?: RegExp, skip?: boolean }>}
 */
export const STORE_SEARCH = {
  173468: { term: 'table salt', exclude: /\b(seasoned|garlic salt|celery salt|flake|pink|smoked)\b/i },
  169230: { term: 'fresh garlic', skip: true },
  170000: { term: 'yellow onions', require: /\bonions?\b/i, exclude: /\b(fried|french|soup|dip|rings|powder|diced|chopped)\b/i },
  170931: { term: 'ground black pepper', exclude: /\b(grinder|lemon|seasoning|blend|whole|steak)\b/i },
  171413: { term: 'olive oil', exclude: /\b(spray|blend|butter|infused|garlic|light)\b/i },
  172336: { term: 'canola oil', exclude: /\b(spray|blend)\b/i },
  167747: { term: 'lemons', skip: true },
  173430: { term: 'unsalted butter', require: /\bbutter\b/i, exclude: /\b(spread|tub|olive oil|whipped|blend|margarine|plant|vegan|peanut|almond|cookie|garlic)\b/i },
  169655: { term: 'granulated sugar', exclude: /\b(brown|powdered|confectioners|substitute|zero|stevia|monk|cane syrup|cubes)\b/i },
  169231: { term: 'fresh ginger root', exclude: /\b(ground|paste|ale|tea|candied|crystallized|pickled|chews)\b/i },
  170005: { term: 'green onions', exclude: /\b(dip|dried|frozen|seasoning)\b/i },
  168156: { term: 'limes', skip: true },
  170393: { term: 'carrots', require: /\bcarrots?\b/i, exclude: /\b(baby|cake|juice|chips|matchstick|shredded|peas)\b/i },
  171287: { term: 'large eggs', exclude: /\b(egg whites|liquid|hard boiled|bites|noodles|substitute|beaters)\b/i },
  168833: { term: 'light brown sugar', exclude: /\b(substitute|zero|blend|syrup)\b/i },
  168894: { term: 'all purpose flour', exclude: /\b(gluten free|almond|self rising|whole wheat|bread flour|cake)\b/i },
  171609: { term: 'low sodium chicken broth', exclude: /\b(bouillon|cubes|base|soup|stock pot)\b/i },
  171583: { term: 'vegetable broth', exclude: /\b(bouillon|cubes|base|soup)\b/i },
  173627: { term: 'boneless skinless chicken thighs', exclude: /\b(breaded|marinated|cooked|seasoned|nuggets|frozen)\b/i },
  168877: { term: 'long grain white rice', exclude: /\b(instant|minute|ready|microwave|boil in bag|seasoned|mix)\b/i },
  170027: { term: 'russet potatoes', require: /\bpotato(es)?\b/i, exclude: /\b(chips|fries|frozen|instant|mashed|hash|tots|wedges|flakes|sweet)\b/i },
  171265: { term: 'whole milk gallon', exclude: /\b(lactose|chocolate|strawberry|buttermilk|evaporated|condensed|powder|almond|oat)\b/i },
  171077: { term: 'boneless skinless chicken breasts', exclude: /\b(breaded|marinated|cooked|seasoned|nuggets|tenders|strips|grilled)\b/i },
}

/** The words Savry searches a store for, for one of its foods. */
export function searchTerm(fdcId, rules) {
  if (STORE_SEARCH[fdcId]) return STORE_SEARCH[fdcId].term
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
