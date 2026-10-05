import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { computeRecipeNutrition, createMatcher, exclusionFor, gramsFor, normalizeUnit } from '../lib/nutrition/compute.mjs'

const rules = [
  { phrases: ['all-purpose flour', 'flour'], fdcId: 1, cupGrams: 125 },
  { phrases: ['butter'], fdcId: 2, cupGrams: 227 },
  { phrases: ['butter beans'], fdcId: 3, cupGrams: 180, unitGrams: { can: 425 }, drainedCan: { grams: 255, ofOz: 15 } },
  { phrases: ['peanut butter'], fdcId: 4, cupGrams: 258 },
  { phrases: ['garlic'], fdcId: 5, unitGrams: { clove: 3 } },
  { phrases: ['garlic powder'], fdcId: 6, cupGrams: 149 },
  { phrases: ['yellow onion', 'onion'], fdcId: 7, eachGrams: 110, cupGrams: 160 },
  { phrases: ['egg'], fdcId: 8, eachGrams: 50, fixedSize: true },
  { phrases: ['chicken thigh'], fdcId: 9, edible: 0.7 },
  { phrases: ['sweet potato'], fdcId: 9, eachGrams: 130, peeled: 0.8 },
  { phrases: ['coconut milk'], fdcId: 9, cupGrams: 240, fluidCan: true, unitGrams: { can: 400 } },
  { phrases: ['tuna'], fdcId: 9, unitGrams: { can: 142 }, drainedCan: { grams: 113, ofOz: 5 } },
  { phrases: ['crushed tomatoes'], fdcId: 10, unitGrams: { can: 425 } },
  { phrases: ['olive oil', 'neutral oil'], fdcId: 11, cupGrams: 216 },
  { phrases: ['salt'], fdcId: 12, cupGrams: 288 },
  { phrases: ['rice'], fdcId: 13, cupGrams: 185 },
  { phrases: ['water'], skip: true },
]
const food = (calories, extra = {}) => ({ description: 'test food', per100g: { calories, protein: 0, carbohydrates: 0, fat: 0, saturatedFat: 0, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0, ...extra } })
const foods = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [String(i + 1), food(100)]))
foods['12'] = food(0, { sodium: 38758 })
const resolve = createMatcher(rules)
const ruleFor = (name) => resolve(name)?.rule
const grams = (name, amount, unit) => Math.round(gramsFor({ name, amount, unit }, ruleFor(name))?.grams ?? -1)

test('the earliest, then longest, phrase decides which food an ingredient is', () => {
  assert.equal(ruleFor('cold unsalted butter, cubed').fdcId, 2)
  assert.equal(ruleFor('butter beans (15 oz each), drained and rinsed').fdcId, 3)
  assert.equal(ruleFor('creamy peanut butter').fdcId, 4)
  assert.equal(ruleFor('garlic powder').fdcId, 6)
  assert.equal(ruleFor('garlic, minced').fdcId, 5)
  assert.equal(ruleFor('medium yellow onions, diced').fdcId, 7)
  assert.equal(ruleFor('extra-virgin olive oil, plus more for drizzling').fdcId, 11)
  assert.equal(resolve('saffron threads'), null)
})

test('weights follow the recipe: stated grams, then weight, can size, volume, named unit, count', () => {
  assert.equal(grams('all-purpose flour (315 g), plus more for the counter', '2 1/2', 'cup'), 315, 'a stated weight beats the cup measure')
  assert.equal(grams('all-purpose flour', '2', 'cup'), 250)
  assert.equal(grams('all-purpose flour', '3', 'tbsp'), 23)
  assert.equal(grams('unsalted butter', '4', 'oz'), 113)
  assert.equal(grams('bone-in, skin-on chicken thighs (about 8)', '3', 'lb'), Math.round(3 * 453.59 * 0.7), 'bone-in weight is reduced to the edible share')
  assert.equal(grams('crushed tomatoes (28 oz)', '1', 'can'), 794)
  assert.equal(grams('(15 oz) crushed tomatoes', '2', 'can'), 851)
  assert.equal(grams('butter beans (15 oz each), drained and rinsed', '2', 'can'), 510, 'drained cans use the drained weight')
  assert.equal(grams('butter beans, drained', '1', 'can'), 255)
  assert.equal(grams('tuna (5 oz each), drained well', '2', 'can'), 226, 'drained weights scale from the rule\'s own can size')
  assert.equal(grams('crushed tomatoes, 28 ounces', '1', 'can'), 794)
  assert.equal(grams('(13.5 oz) full-fat coconut milk, unshaken', '1', 'can'), 405, 'liquid cans are in fluid ounces')
  assert.equal(grams('medium sweet potatoes (about 1 1/4 lb), scrubbed', '2', null), 567, 'a stated total weight beats a count')
  assert.equal(grams('sweet potatoes (about 2 medium), peeled and cubed', '1', 'lb'), 363, 'peel is taken off only when the recipe peels')
  assert.equal(grams('sweet potatoes, scrubbed', '1', 'lb'), 454)
  assert.equal(grams('bone-in chicken thighs (about 10 oz each)', '4', null), Math.round(4 * 10 * 28.35 * 0.7))
  assert.equal(grams('garlic, minced', '4', 'clove'), 12)
  assert.equal(grams('medium yellow onion, diced', '1', null), 110)
  assert.equal(grams('large yellow onion, diced', '1', null), 143)
  assert.equal(grams('small yellow onion', '2', null), 165)
  assert.equal(grams('large eggs', '3', null), 150, 'egg weight is already for a large egg')
  assert.equal(grams('yellow onion, chopped', '1/2', 'cup'), 80)
  assert.equal(grams('fine sea salt', '1', 'pinch'), 0, 'a pinch rounds to nothing but is still weighed')
  assert.equal(gramsFor({ name: 'garlic', amount: '2', unit: 'sprig' }, ruleFor('garlic')), null, 'an unknown unit is never guessed')
  assert.equal(grams('olive oil or neutral oil, for frying', '1/2', 'cup'), 27, 'only part of frying oil is absorbed')
})

test('units are understood however the cook writes them', () => {
  assert.equal(normalizeUnit('Tablespoons'), 'tbsp')
  assert.equal(normalizeUnit('tsp.'), 'tsp')
  assert.equal(normalizeUnit('cups'), 'cup')
  assert.equal(normalizeUnit('lbs'), 'lb')
  assert.equal(normalizeUnit('grams'), 'g')
  assert.equal(normalizeUnit('cloves'), 'clove')
  assert.equal(normalizeUnit(''), null)
  assert.equal(normalizeUnit('each'), null)
  assert.equal(grams('all-purpose flour', '250', 'grams'), 250)
  assert.equal(grams('unsalted butter', '0.5', 'kg'), 500)
  assert.equal(grams('olive oil', '2', 'Tablespoons'), 27)
  assert.equal(grams('olive oil', '100', 'ml'), 91)
  assert.equal(grams('olive oil', '1', 'fl oz'), 27)
  assert.equal(grams('garlic', '4', 'cloves'), 12)
  assert.equal(grams('large eggs', '2', 'each'), 100)
  assert.equal(grams('yellow onion, diced', '1', 'large'), 143, 'a size word in the unit box is a size, not a unit')
  assert.equal(grams('yellow onion', '2', 'Small'), 165)
  assert.equal(grams('eggs', '2', 'large'), 100, 'egg weight is already for a large egg')
  assert.equal(grams('yellow onion', '2', 'heads'), 220, 'a counting word falls back to the weight of one')
  assert.equal(gramsFor({ name: 'yellow onion', amount: '2', unit: 'bucket' }, ruleFor('yellow onion')), null)
})

test('optional items and serving suggestions are left out', () => {
  assert.equal(exclusionFor({ name: 'hot steamed jasmine rice, for serving' }), 'for serving')
  assert.equal(exclusionFor({ name: 'kosher salt, for the pasta water' }), null, 'cooking-water salt counts, at the share the food takes up')
  assert.equal(Math.round(gramsFor({ name: 'fine sea salt, for the cooking water', amount: '1', unit: 'tbsp' }, ruleFor('fine sea salt')).grams * 10) / 10, 1.8)
  assert.equal(exclusionFor({ name: 'toasted sesame seeds', isOptional: true }), 'optional')
  assert.equal(exclusionFor({ name: 'coarsely ground black pepper, plus more to serve', amount: '1/2' }), null, 'the measured amount still counts')
  assert.equal(exclusionFor({ name: 'freshly ground black pepper' }), 'to taste', 'pepper with no amount is seasoning, not a missing weight')
  assert.equal(exclusionFor({ name: 'flaky sea salt, for the top' }), null)
})

test('a recipe is totalled per serving with honest coverage', () => {
  const recipe = {
    servings: 4,
    ingredients: [
      { name: 'all-purpose flour (200 g)', amount: '1 2/3', unit: 'cup' }, // 200 kcal
      { name: 'unsalted butter', amount: '100', unit: 'g-not-a-unit' }, // cannot be weighed
      { name: 'large eggs', amount: '2', unit: null }, // 100 kcal
      { name: 'fine sea salt', amount: '1', unit: 'tsp' }, // 6 g -> 2325 mg sodium
      { name: 'water', amount: '1', unit: 'cup' },
      { name: 'hot steamed jasmine rice, for serving', amount: '4', unit: 'cup' },
      { name: 'saffron threads', amount: '1', unit: 'pinch' }, // no rule
    ],
  }
  const result = computeRecipeNutrition(recipe, { rules, foods })
  assert.equal(result.perServing.calories, 75)
  assert.equal(result.perServing.sodium, 581)
  assert.deepEqual(result.lines.map((l) => l.status), ['counted', 'unweighed', 'counted', 'counted', 'skipped', 'excluded', 'unmatched'])
  assert.equal(result.coverage, 0.6, 'three of five countable ingredients were weighed')
  assert.equal(result.servingGrams, Math.round((200 + 100 + 6) / 4))
})

test('the shipped reference is complete and self-consistent', async () => {
  const shippedRules = JSON.parse(await readFile(new URL('../content/nutrition/ingredient-rules.json', import.meta.url), 'utf8'))
  const { foods: shippedFoods } = JSON.parse(await readFile(new URL('../content/nutrition/usda-foods.json', import.meta.url), 'utf8'))
  const seen = new Map()
  for (const rule of shippedRules) {
    assert.ok(Array.isArray(rule.phrases) && rule.phrases.length > 0, 'every rule has phrases')
    if (rule.skip) continue
    const item = shippedFoods[String(rule.fdcId)]
    assert.ok(item, `USDA food ${rule.fdcId} for "${rule.phrases[0]}" is in the reference`)
    assert.ok(item.per100g.calories >= 0 && item.per100g.calories <= 902, `${item.description}: energy per 100 g is physically possible`)
    for (const phrase of rule.phrases) {
      assert.equal(phrase, phrase.toLowerCase())
      assert.ok(!seen.has(phrase) || seen.get(phrase) === rule.fdcId, `phrase "${phrase}" points at one food only`)
      seen.set(phrase, rule.fdcId)
    }
    if (rule.cupGrams) assert.ok(rule.cupGrams > 5 && rule.cupGrams < 400, `${rule.phrases[0]}: cup weight is plausible`)
    if (rule.edible) assert.ok(rule.edible > 0.3 && rule.edible <= 1)
  }
})
