// Cost per serving, calculated from a recipe's ingredient list, the same
// ingredient rules the nutrition engine uses, and a table of average US
// grocery prices. Plain JS so the scripts, the site, and the Node test runner
// all use the same code; the iOS app runs a line-for-line Swift port.
//
// Inputs:
//   rules   content/nutrition/ingredient-rules.json   ingredient phrases -> USDA food + gram weights
//   prices  content/cost/food-prices.json             US dollars per kilogram as bought, per USDA food
//
// What is paid for: every ingredient as listed, at the weight bought (the
// whole can, the untrimmed cut, all of the frying oil). Not counted: optional
// ingredients, anything listed "for serving", water, and seasoning with no
// amount. The result is an estimate within about 20%, not a receipt.

import { createMatcher, exclusionFor, gramsFor } from '../nutrition/compute.mjs'

/** Rounds to whole cents the same way in JS and Swift (half away from zero). */
export function roundCents(dollars) {
  return Math.round(dollars * 100) / 100
}

/**
 * @param {{ servings: number, ingredients: { name: string, amount: string | null, unit: string | null, isOptional?: boolean }[] }} recipe
 * @param {{ rules: object[], prices: Record<string, { perKg: number }>, resolve?: Function, overrides?: Record<string, number>, priceScale?: number }} reference
 *   `overrides` are a cook's own prices per kilogram, keyed by USDA food id; they beat the table.
 *   `priceScale` scales the table's national prices to the cook's region (1 = US average); it never touches overrides.
 */
export function computeRecipeCost(recipe, reference) {
  const resolve = reference.resolve ?? createMatcher(reference.rules)
  const overrides = reference.overrides ?? {}
  const scale = typeof reference.priceScale === 'number' && reference.priceScale > 0 ? reference.priceScale : 1
  let total = 0
  let counted = 0
  let missed = 0
  const lines = []

  for (const ingredient of recipe.ingredients) {
    const line = { name: ingredient.name, status: 'counted', fdcId: null, boughtGrams: null, cost: null, detail: '' }
    lines.push(line)
    const excluded = exclusionFor(ingredient)
    if (excluded) { line.status = 'excluded'; line.detail = excluded; continue }
    const hit = resolve(ingredient.name)
    if (!hit) { line.status = 'unmatched'; missed += 1; continue }
    if (hit.rule.skip) { line.status = 'skipped'; line.detail = 'free'; continue }
    line.fdcId = hit.rule.fdcId
    const own = overrides[String(hit.rule.fdcId)]
    const table = reference.prices[String(hit.rule.fdcId)]?.perKg
    const perKg = typeof own === 'number' ? own : (typeof table === 'number' ? table * scale : undefined)
    if (typeof perKg !== 'number') { line.status = 'unpriced'; missed += 1; continue }
    const weight = gramsFor(ingredient, hit.rule)
    if (!weight) { line.status = 'unweighed'; missed += 1; continue }
    const cost = weight.bought * perKg / 1000
    line.boughtGrams = Math.round(weight.bought * 10) / 10
    line.cost = roundCents(cost)
    line.detail = `${perKg} per kg; ${weight.basis}`
    counted += 1
    total += cost
  }

  const servings = Math.max(1, Number(recipe.servings) || 1)
  const coverage = counted + missed === 0 ? 0 : counted / (counted + missed)
  return { total: roundCents(total), perServing: roundCents(total / servings), coverage: Math.round(coverage * 10000) / 10000, counted, missed, lines }
}

/** "$2.10", or "$0.45" — never "$2.1". */
export function formatCost(dollars) {
  return `$${Number(dollars).toFixed(2)}`
}
