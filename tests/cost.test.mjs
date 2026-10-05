import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { computeRecipeCost, formatCost, roundCents } from '../lib/cost/compute.mjs'
import { createMatcher, gramsFor } from '../lib/nutrition/compute.mjs'

const rules = JSON.parse(await readFile(new URL('../content/nutrition/ingredient-rules.json', import.meta.url), 'utf8'))
const { foods } = JSON.parse(await readFile(new URL('../content/nutrition/usda-foods.json', import.meta.url), 'utf8'))
const priceFile = JSON.parse(await readFile(new URL('../content/cost/food-prices.json', import.meta.url), 'utf8'))
const resolve = createMatcher(rules)
const reference = { rules, prices: priceFile.prices, resolve }
const line = (name, amount, unit, isOptional = false) => ({ name, amount, unit, isOptional })

test('every food the rules use has a price, and every price names a real food', () => {
  for (const rule of rules) {
    if (rule.skip || !rule.fdcId) continue
    assert.ok(priceFile.prices[String(rule.fdcId)], `no price for ${rule.fdcId} (${rule.phrases[0]})`)
  }
  for (const [id, price] of Object.entries(priceFile.prices)) {
    assert.ok(foods[id], `price for unknown food ${id}`)
    assert.ok(price.perKg > 0 && Number.isFinite(price.perKg), `bad price for ${id}`)
    assert.ok(price.basis in priceFile.basis, `unknown basis for ${id}`)
  }
})

test('cost is paid on what is bought, not on what is eaten', () => {
  const bought = (ingredient) => { const hit = resolve(ingredient.name); return gramsFor(ingredient, hit.rule) }
  // A can of beans: the whole can is bought even when it is drained.
  const beans = bought(line('black beans (15 oz each), drained and rinsed', '1', 'can'))
  assert.equal(beans.grams, 255)
  assert.equal(beans.bought, 425)
  // Bone-in chicken is paid for by the pound, bones included.
  const thighs = bought(line('bone-in, skin-on chicken thighs', '1', 'lb'))
  assert.ok(thighs.grams < thighs.bought, 'only the edible share is eaten')
  assert.equal(Math.round(thighs.bought), 454)
  // All of the frying oil is bought though a quarter ends up in the food.
  const oil = bought(line('neutral oil, for frying', '2', 'cups'))
  assert.equal(oil.bought, oil.grams * 4)
})

test('a simple recipe prices out line by line and per serving', () => {
  const result = computeRecipeCost({
    servings: 4,
    ingredients: [
      line('all-purpose flour', '2', 'cups'), line('large eggs', '2', null), line('whole milk', '1', 'cup'),
      line('kosher salt', '', null), line('water', '1', 'cup'), line('fresh parsley, for garnish', '2', 'tbsp'),
      line('toasted sesame seeds', '1', 'tbsp', true),
    ],
  }, reference)
  assert.deepEqual(result.lines.map((l) => l.status), ['counted', 'counted', 'counted', 'excluded', 'skipped', 'excluded', 'excluded'])
  assert.equal(result.coverage, 1)
  assert.equal(result.counted, 3)
  const flour = result.lines[0]
  assert.equal(flour.boughtGrams, 250)
  assert.equal(flour.cost, roundCents((250 * priceFile.prices['168894'].perKg) / 1000))
  assert.equal(result.total, roundCents(result.lines.filter((l) => l.cost).reduce((sum, l) => sum + l.boughtGrams * priceFile.prices[String(l.fdcId)].perKg / 1000, 0)))
  assert.equal(result.perServing, roundCents(result.total / 4))
  assert.ok(result.perServing > 0.2 && result.perServing < 1, `a crepe batter is cheap: $${result.perServing}`)
})

test('unknown ingredients lower coverage instead of being guessed, and a cook can override a price', () => {
  const recipe = { servings: 2, ingredients: [line('dragon fruit powder', '1', 'tsp'), line('boneless skinless chicken breast', '1', 'lb')] }
  const result = computeRecipeCost(recipe, reference)
  assert.equal(result.lines[0].status, 'unmatched')
  assert.equal(result.coverage, 0.5)
  const chicken = result.lines[1]
  const own = computeRecipeCost(recipe, { ...reference, overrides: { [String(chicken.fdcId)]: 2 } })
  assert.equal(own.lines[1].cost, roundCents(453.59 * 2 / 1000))
})

test('money is shown with two decimals', () => {
  assert.equal(formatCost(2.1), '$2.10')
  assert.equal(formatCost(0.455), '$0.46')
  assert.equal(roundCents(0.125), 0.13)
  assert.equal(roundCents(2.1 + 0.2), 2.3)
})
