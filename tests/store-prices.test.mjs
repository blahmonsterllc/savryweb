import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { STORE_SEARCH, packageGrams, perKgFromItem, searchTerm, storePrice } from '../lib/cost/store-prices.mjs'
import { describeMultiplier, regionalPrice } from '../lib/cost/regional.mjs'
import { computeRecipeCost } from '../lib/cost/compute.mjs'
import { createMatcher } from '../lib/nutrition/compute.mjs'

const rules = JSON.parse(await readFile(new URL('../content/nutrition/ingredient-rules.json', import.meta.url), 'utf8'))
const regional = JSON.parse(await readFile(new URL('../content/cost/regional-prices.json', import.meta.url), 'utf8'))
const priceFile = JSON.parse(await readFile(new URL('../content/cost/food-prices.json', import.meta.url), 'utf8'))

test('a ZIP code finds its state and the state its price level', () => {
  assert.deepEqual(regionalPrice('43017', regional), { multiplier: 0.94, state: 'OH', stateName: 'Ohio' })
  assert.equal(regionalPrice('96813', regional).state, 'HI')
  assert.equal(regionalPrice('10001-1234', regional).state, 'NY')
  assert.equal(regionalPrice('20001', regional).state, 'DC')
  assert.equal(regionalPrice('20101', regional).state, 'VA')
  assert.deepEqual(regionalPrice('00901', regional), { multiplier: 1, state: null, stateName: null }, 'Puerto Rico has no parity: national average')
  assert.deepEqual(regionalPrice('abc', regional).multiplier, 1)
  assert.equal(describeMultiplier(0.94), '6% below the US average')
  assert.equal(describeMultiplier(1.12), '12% above the US average')
  assert.equal(describeMultiplier(1.004), 'about the US average')
})

test('every state in the table has a ZIP range and a sane multiplier', () => {
  const covered = new Set(regional.zipPrefixes.map(([, , state]) => state))
  for (const [code, state] of Object.entries(regional.states)) {
    assert.ok(covered.has(code), `${state.name} has no ZIP prefixes`)
    assert.ok(state.multiplier > 0.85 && state.multiplier < 1.25, `${state.name} multiplier ${state.multiplier}`)
  }
  // Ranges never overlap.
  const sorted = [...regional.zipPrefixes].sort((a, b) => a[0] - b[0])
  for (let i = 1; i < sorted.length; i += 1) assert.ok(sorted[i][0] > sorted[i - 1][1], `overlap at ${sorted[i][0]}`)
})

test('the regional multiplier scales table prices but never a cook\'s own price', () => {
  const resolve = createMatcher(rules)
  const recipe = { servings: 1, ingredients: [{ name: 'all-purpose flour', amount: '1', unit: 'kg', isOptional: false }, { name: 'whole milk', amount: '1', unit: 'l', isOptional: false }] }
  const base = computeRecipeCost(recipe, { rules, prices: priceFile.prices, resolve })
  const hawaii = computeRecipeCost(recipe, { rules, prices: priceFile.prices, resolve, priceScale: 1.12 })
  assert.equal(hawaii.lines[0].cost, Math.round(base.lines[0].cost * 1.12 * 100) / 100)
  const own = computeRecipeCost(recipe, { rules, prices: priceFile.prices, resolve, priceScale: 1.12, overrides: { [String(base.lines[0].fdcId)]: 2 } })
  assert.equal(own.lines[0].cost, 2, 'the cook said $2/kg; the region does not change that')
})

test('store package sizes become grams', () => {
  assert.equal(packageGrams('16 oz'), 16 * 28.35)
  assert.equal(packageGrams('1 lb'), 453.59)
  assert.equal(packageGrams('per lb'), 453.59)
  assert.equal(packageGrams('lb'), 453.59)
  assert.equal(packageGrams('2.5 lbs'), 2.5 * 453.59)
  assert.equal(packageGrams('64 fl oz'), 64 * 29.57)
  assert.equal(packageGrams('1 gal'), 3785)
  assert.equal(packageGrams('2 x 16 oz'), 2 * 16 * 28.35)
  assert.equal(packageGrams('12 ct'), null)
  assert.equal(packageGrams('12 ct', { gramsPerCount: 50 }), 600)
  assert.equal(packageGrams('each'), null)
})

test('a listing becomes a regular price per kilogram; a sale rides along but never sets the estimate', () => {
  assert.deepEqual(perKgFromItem({ size: '1 lb', price: { regular: 4.99 } }), { perKg: 11, promoPerKg: null })
  assert.deepEqual(perKgFromItem({ size: '1 lb', price: { regular: 4.99, promo: 2.99 } }), { perKg: 11, promoPerKg: 6.59 })
  assert.equal(perKgFromItem({ size: '12 ct', price: { regular: 3.49 } }), null)
  assert.equal(perKgFromItem({ size: '1 lb', price: { promo: 2.99 } }), null, 'no regular price, no estimate')
})

test('the median regular price across the shelf wins, and a wild match is dropped against the regional figure', () => {
  const products = [
    { description: 'Kroger Chicken Breast', items: [{ size: 'per lb', price: { regular: 3.99, promo: 1.99 } }] },
    { description: 'Organic Chicken Breast', items: [{ size: 'per lb', price: { regular: 8.99 } }] },
    { description: 'Chicken Breast Tenders', items: [{ size: '1 lb', price: { regular: 5.49 } }] },
    { description: 'Mystery', items: [{ size: 'each', price: { regular: 1 } }] },
  ]
  const chosen = storePrice(products)
  assert.equal(chosen.description, 'Chicken Breast Tenders')
  assert.equal(chosen.listings, 3)
  assert.equal(storePrice(products, { baseline: 9.3 }).perKg, 12.1, 'inside the band, the store price stands')
  assert.equal(storePrice(products, { baseline: 1 }), null, 'twelve times the regional figure is a wrong product, not chicken')
  assert.equal(storePrice(products, { baseline: 100 }), null, 'a tenth of the regional figure is a wrong product too')
  assert.equal(storePrice([]), null)
})

test('curated searches keep the wrong products out of the median', () => {
  const butter = [
    { description: 'Kroger® Butter with Olive Oil and Sea Salt Spreadable Tub', items: [{ size: '15 oz', price: { regular: 3.99 } }] },
    { description: 'Kroger® Unsalted Butter Sticks', items: [{ size: '16 oz', price: { regular: 4.49 } }] },
    { description: 'Land O Lakes® Unsalted Butter', items: [{ size: '16 oz', price: { regular: 5.99 } }] },
  ]
  const chosen = storePrice(butter, { exclude: STORE_SEARCH[173430].exclude })
  assert.equal(chosen.listings, 2, 'the spread is not butter')
  assert.match(chosen.description, /Unsalted Butter Sticks/)
  assert.equal(searchTerm(173430, rules), 'unsalted butter')
  assert.equal(searchTerm(169655, rules), 'granulated sugar')
  assert.ok(STORE_SEARCH[169655].exclude.test('Kroger® Light Brown Sugar'))
  assert.ok(STORE_SEARCH[170027].exclude.test('Lay\'s Classic Potato Chips'))
  for (const id of Object.keys(STORE_SEARCH)) assert.ok(priceFile.prices[id], `curated search for ${id}, which Savry does not price`)
})

test('each priced food has words to search a store for', () => {
  for (const id of Object.keys(priceFile.prices)) {
    const term = searchTerm(Number(id), rules)
    assert.ok(term && term.length >= 3, `no search term for ${id}`)
  }
  assert.equal(searchTerm(171077, rules).includes('chicken'), true)
})
