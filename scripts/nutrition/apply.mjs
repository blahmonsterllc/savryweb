#!/usr/bin/env node
/**
 * Calculates nutrition per serving for recipes from their ingredient lists and
 * USDA FoodData Central values, and stores it on the recipe.
 *
 *   node scripts/nutrition/apply.mjs --project-ref <ref> [--dry-run] [--slug <slug>] [--min-coverage 0.95] [--report file.json]
 *
 * A recipe gets nutrition only when at least --min-coverage of its counted
 * ingredients were matched and weighed (default 0.95); below that it is left
 * untouched and listed so the rules can be improved. Recipes whose nutrition
 * came from somewhere else (the app, a package label) are never overwritten.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { computeRecipeNutrition, createMatcher } from '../../lib/nutrition/compute.mjs'

const flag = (name) => process.argv.includes(`--${name}`)
const value = (name) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined }

async function main() {
  const expectedRef = value('project-ref')
  if (!expectedRef) { console.error('usage: apply.mjs --project-ref <ref> [--dry-run] [--slug <slug>] [--min-coverage 0.95] [--report file.json]'); process.exit(1) }
  const dryRun = flag('dry-run')
  const minCoverage = Number(value('min-coverage') ?? 0.95)

  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
  const rules = JSON.parse(await readFile(path.join(root, 'content/nutrition/ingredient-rules.json'), 'utf8'))
  const { foods } = JSON.parse(await readFile(path.join(root, 'content/nutrition/usda-foods.json'), 'utf8'))
  const reference = { rules, foods, resolve: createMatcher(rules) }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secret) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required')
  const host = new URL(url).hostname
  if (host.split('.')[0] !== expectedRef && !(expectedRef === 'local' && /^(127\.0\.0\.1|localhost)$/.test(host))) throw new Error('Project guard failed: the URL does not match --project-ref')
  const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } })

  let query = supabase.from('recipes').select('id, slug, title, servings, visibility, nutrition_source, recipe_ingredients(id, position, name, amount, unit, is_optional)').order('slug')
  if (value('slug')) query = query.eq('slug', value('slug'))
  const { data: recipes, error } = await query
  if (error) throw error

  const report = []
  let written = 0
  let skipped = 0
  let low = 0
  for (const recipe of recipes) {
    if (recipe.nutrition_source && recipe.nutrition_source !== 'usda_food_data_central') { skipped += 1; continue }
    const ingredients = [...recipe.recipe_ingredients].sort((a, b) => a.position - b.position).map((i) => ({ id: i.id, name: i.name, amount: i.amount, unit: i.unit, isOptional: i.is_optional }))
    const result = computeRecipeNutrition({ servings: recipe.servings, ingredients }, reference)
    report.push({ slug: recipe.slug, title: recipe.title, servings: recipe.servings, visibility: recipe.visibility, ...result })
    if (result.coverage < minCoverage) {
      low += 1
      console.log(`  below ${minCoverage}  ${recipe.slug}  coverage ${result.coverage}: ${result.lines.filter((l) => l.status === 'unmatched' || l.status === 'unweighed').map((l) => `${l.status} "${l.name}"`).join('; ')}`)
      continue
    }
    if (dryRun) continue

    const n = result.perServing
    const { error: updateError } = await supabase.from('recipes').update({
      nutrition_per_serving: { calories: n.calories, protein: n.protein, carbohydrates: n.carbohydrates, fat: n.fat, fiber: n.fiber, sugar: n.sugar, sodium: n.sodium, cholesterol: n.cholesterol, saturatedFat: n.saturatedFat, servingGrams: result.servingGrams },
      nutrition_source: 'usda_food_data_central',
      nutrition_coverage: result.coverage,
    }).eq('id', recipe.id)
    if (updateError) throw updateError
    // Record which USDA food and weight each line was counted as.
    for (let index = 0; index < ingredients.length; index += 1) {
      const line = result.lines[index]
      if (line.status !== 'counted') continue
      const { error: lineError } = await supabase.from('recipe_ingredients').update({ normalized_food_id: `fdc:${line.fdcId}`, gram_weight: line.grams }).eq('id', ingredients[index].id)
      if (lineError) throw lineError
    }
    written += 1
  }

  if (value('report')) await writeFile(value('report'), JSON.stringify(report, null, 1))
  console.log(`${recipes.length} recipes: ${dryRun ? 'dry run, nothing written' : `${written} updated`}, ${low} below coverage, ${skipped} with nutrition from another source left alone`)
}

main().catch((error) => { console.error(error.message ?? error); process.exit(1) })
