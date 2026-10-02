#!/usr/bin/env node
/**
 * Keeps the iOS app's nutrition calculator in step with the site's.
 *
 * The app (whiskit/Services/USDANutritionCalculator.swift) is a line-for-line
 * port of lib/nutrition/compute.mjs and reads the same two reference files.
 * This script copies the reference into the app and writes the fixture the
 * app's parity check runs against: every catalog recipe plus a set of edge
 * cases, with the results this engine gives.
 *
 *   node scripts/nutrition/sync-ios.mjs [--ios-dir ../foodprep]
 *
 * Then, in the app repo:  Tools/nutrition-parity/check.sh
 */
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { computeRecipeNutrition, createMatcher, NUTRIENT_KEYS } from '../../lib/nutrition/compute.mjs'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const at = process.argv.indexOf('--ios-dir')
const iosDir = path.resolve(at > -1 ? process.argv[at + 1] : path.join(root, '../foodprep'))

const rules = JSON.parse(await readFile(path.join(root, 'content/nutrition/ingredient-rules.json'), 'utf8'))
const { foods } = JSON.parse(await readFile(path.join(root, 'content/nutrition/usda-foods.json'), 'utf8'))
const reference = { rules, foods, resolve: createMatcher(rules) }

const batchDir = path.join(root, 'content/launch-catalog/batches')
const recipes = []
for (const file of (await readdir(batchDir)).filter((name) => name.endsWith('.json')).sort()) {
  for (const recipe of JSON.parse(await readFile(path.join(batchDir, file), 'utf8'))) {
    recipes.push({ slug: recipe.slug, servings: recipe.servings, ingredients: recipe.ingredients.map((i) => ({ name: i.name, amount: i.amount ?? null, unit: i.unit ?? null, isOptional: Boolean(i.isOptional ?? i.optional) })) })
  }
}

// Spellings and shapes the catalog does not use but cooks do.
const line = (name, amount, unit, isOptional = false) => ({ name, amount, unit, isOptional })
recipes.push({
  slug: 'edge-cases',
  servings: 3,
  ingredients: [
    line('all-purpose flour', '250', 'grams'), line('unsalted butter', '0.25', 'kg'), line('olive oil', '2', 'Tablespoons'), line('whole milk', '300', 'ml'),
    line('olive oil', '1', 'fl oz'), line('garlic', '4', 'cloves'), line('large eggs', '2', 'each'), line('granulated sugar', '1½', 'Cups'), line('kosher salt', '¾', 'tsp.'),
    line('yellow onion, diced', '2-3', null), line('small yellow onion', '1', ''), line('extra-large eggs', '2', null), line('lemon juice', '2 to 3', 'tbsp'),
    line('dragon fruit powder', '1', 'tsp'), line('chicken breast', '1', 'bucket'), line('water', '2', 'quarts'), line('fresh basil leaves, for garnish', '6', null),
    line('toasted sesame seeds', '1', 'tbsp', true), line('neutral oil, for frying', '2', 'cups'), line('kosher salt, for the pasta water', '2', 'tbsp'),
    line('black beans (15 oz each), drained and rinsed', '2', 'cans'), line('crushed tomatoes, 28 ounces', '1', 'can'), line('(13.5 oz) full-fat coconut milk', '1', 'can'),
    line('bone-in, skin-on chicken thighs (about 6 oz each)', '4', null), line('sweet potatoes (about 2 medium), peeled and cubed', '1', 'lb'),
    line('medium sweet potatoes (about 1 1/4 lb), scrubbed', '2', null), line('whole wheat flour', '', 'cup'), line('red pepper flakes, or more to taste', '1/2', 'teaspoon'),
    line('Gruyère cheese, coarsely grated (about 1 cup)', '4', 'ounces'), line('fresh thyme', '3', 'sprigs'), line('honey', '1', 'dash'),
    line('yellow onion, diced', '1', 'large'), line('red bell pepper, seeded and diced', '1', 'Large'), line('eggs', '2', 'large'), line('carrots', '3', 'small'),
    line('celery', '2', 'stalks'), line('garlic', '1', 'head'), line('fresh basil', '6', 'leaves'), line('yellow onion', '2', 'bucket'),
  ],
})

const fixture = {
  nutrientKeys: NUTRIENT_KEYS,
  recipes: recipes.map((recipe) => {
    const result = computeRecipeNutrition(recipe, reference)
    return { ...recipe, expected: { perServing: result.perServing, servingGrams: result.servingGrams, coverage: result.coverage, counted: result.counted, missed: result.missed, lines: result.lines.map((l) => ({ status: l.status, fdcId: l.fdcId, grams: l.grams })) } }
  }),
}

const resources = path.join(iosDir, 'whiskit/Resources/Nutrition')
const fixtures = path.join(iosDir, 'whiskitTests/Fixtures')
await mkdir(resources, { recursive: true })
await mkdir(fixtures, { recursive: true })
await copyFile(path.join(root, 'content/nutrition/ingredient-rules.json'), path.join(resources, 'ingredient-rules.json'))
await copyFile(path.join(root, 'content/nutrition/usda-foods.json'), path.join(resources, 'usda-foods.json'))
await writeFile(path.join(fixtures, 'usda-parity.json'), JSON.stringify(fixture) + '\n')
console.log(`Reference copied and fixture written for ${fixture.recipes.length} recipes (${fixture.recipes.reduce((n, r) => n + r.ingredients.length, 0)} ingredient lines) -> ${iosDir}`)
