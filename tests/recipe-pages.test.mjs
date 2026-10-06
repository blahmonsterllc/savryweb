import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { compareCheapest, explorerRecipe, mealCost } from '../lib/explorer-recipes.mjs'
import { singularUnit } from '../lib/scale-ingredients.mjs'
import { computeRecipeCost } from '../lib/cost/compute.mjs'
import { createMatcher } from '../lib/nutrition/compute.mjs'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const full = {
  id: '1', slug: 'soup', url: 'https://www.savry.io/recipes/soup', title: 'Soup', description: 'Warm', imageUrl: null,
  authorName: 'Ann', authorUsername: 'ann', publishedAt: '2026-10-01T00:00:00Z', prepTime: 5, cookTime: 20, totalTime: 25,
  servings: 4, servingType: 'servings', yieldUnit: null, difficulty: 'Easy', category: 'Soup', cuisine: null, tags: ['cozy'],
  dietaryTags: ['vegan'], allergens: [], equipment: ['pot'], ovenTemp: null, notes: 'Long notes '.repeat(50),
  ingredients: [{ name: 'carrots', amount: '2', unit: null, section: null, isOptional: false }],
  instructions: ['Chop.', 'Simmer.'], nutritionPerServing: { calories: 120 }, costPerServing: 1.4, sourceURL: null,
  viewCount: 9, madeCount: 3, commentCount: 1, version: 2,
}

test('the explorer gets only the fields it uses', () => {
  const slim = explorerRecipe(full)
  assert.deepEqual(Object.keys(slim).sort(), ['authorName', 'category', 'commentCount', 'costPerServing', 'cuisine', 'description', 'dietaryTags', 'difficulty', 'id', 'imageUrl', 'ingredientNames', 'madeCount', 'publishedAt', 'servingType', 'slug', 'tags', 'title', 'totalTime', 'version'])
  assert.deepEqual(slim.ingredientNames, ['carrots'])
  assert.ok(JSON.stringify(slim).length < JSON.stringify(full).length / 3)
})

test('cheapest per serving ranks meals only; recipes that make items follow, in their own order', () => {
  const soup = { id: 'soup', costPerServing: 1.4, servingType: 'servings' }
  const stew = { id: 'stew', costPerServing: 2.1, servingType: 'servings' }
  const cookies = { id: 'cookies', costPerServing: 0.09, servingType: 'yields' }
  const unpriced = { id: 'unpriced', costPerServing: null, servingType: 'servings' }
  const bread = { id: 'bread', costPerServing: 0.3, servingType: 'yields' }
  const order = [cookies, stew, unpriced, soup, bread].sort(compareCheapest).map((r) => r.id)
  assert.deepEqual(order, ['soup', 'stew', 'cookies', 'unpriced', 'bread'])
  assert.equal(mealCost(cookies), null, 'a per-cookie price is not a per-meal price')
  assert.equal(mealCost(soup), 1.4)
})

test('yield words become singular properly', () => {
  for (const [many, one] of [['sandwiches', 'sandwich'], ['loaves', 'loaf'], ['cookies', 'cookie'], ['slices', 'slice'], ['patties', 'patty'],
    ['potatoes', 'potato'], ['servings', 'serving'], ['mini muffins', 'mini muffin'], ['brownies', 'brownie'], ['pies', 'pie'],
    ['quiches', 'quiche'], ['glass', 'glass'], ['dozen', 'dozen'], ['bar', 'bar'], ['Tacos', 'Taco'], ['wedges', 'wedge'], ['', '']]) {
    assert.equal(singularUnit(many), one, many)
  }
  assert.equal(singularUnit(null), '')
})

test('the whole-recipe cost is the engine total, not the rounded per-serving times servings', async () => {
  const rules = JSON.parse(await readFile(new URL('../content/nutrition/ingredient-rules.json', import.meta.url), 'utf8'))
  const priceFile = JSON.parse(await readFile(new URL('../content/cost/food-prices.json', import.meta.url), 'utf8'))
  const reference = { rules, prices: priceFile.prices, resolve: createMatcher(rules) }
  const result = computeRecipeCost({ servings: 7, ingredients: [{ name: 'all-purpose flour', amount: '3', unit: 'cup', isOptional: false }, { name: 'butter', amount: '1', unit: 'cup', isOptional: false }] }, reference)
  assert.ok(Math.abs(result.total - result.perServing * 7) <= 0.035 + 1e-9, 'rounding per serving drifts by up to half a cent per serving')

  const helper = await source('lib/cost/recipe-cost.ts')
  assert.match(helper, /return \{ total: result\.total, perServing: result\.perServing \}/)
  const page = await source('app/recipes/[slug]/page.tsx')
  assert.match(page, /total=\{cost\.total\}/)
  assert.doesNotMatch(page, /replace\(\/s\$\/, ''\)/, 'no chopping a trailing s off a word')
  const component = await source('components/RecipeCost.tsx')
  assert.doesNotMatch(component, /perServing \* /, 'the total is never rebuilt from the rounded per-serving figure')
})

test('cached list pages keep the last good copy when the database fails', async () => {
  const helper = await source('lib/last-good-page.ts')
  assert.match(helper, /phase-production-build/)
  assert.match(helper, /throw error/)
  for (const file of ['app/recipes/page.tsx', 'app/sitemap.ts', 'app/recipes/[slug]/page.tsx']) {
    const page = await source(file)
    assert.match(page, /failOrFallback\(/, `${file} must not cache an empty or missing page after a failed read`)
  }
  const index = await source('app/recipes/page.tsx')
  assert.match(index, /recipes=\{recipes\.map\(explorerRecipe\)\}/, 'only the explorer fields are sent to the browser')

  const card = await source('supabase/migrations/20261006020000_recipe_card_serving_type.sql')
  assert.match(card, /'servingType', r\.serving_type, 'yieldUnit', r\.yield_unit/)
  assert.match(card, /'costPerServing', case when r\.cost_coverage >= 0\.95 then r\.cost_per_serving end/, 'the 95% bar stays')
  assert.match(card, /revoke all on function public\.recipe_card\(public\.recipes, uuid\) from public, anon, authenticated/)
})
