import 'server-only'

import rules from '@/content/nutrition/ingredient-rules.json'
import priceFile from '@/content/cost/food-prices.json'
import { createMatcher } from '@/lib/nutrition/compute.mjs'
import { computeRecipeCost } from '@/lib/cost/compute.mjs'

/** A cost is shown only when this share of the recipe could be priced. */
export const MIN_COST_COVERAGE = 0.95

const ruleList = rules as object[]
const reference = { rules: ruleList, prices: priceFile.prices as Record<string, { perKg: number }>, resolve: createMatcher(ruleList) }

type IngredientRow = { position: number; name: string; amount: string | null; unit: string | null; is_optional: boolean }

/**
 * The columns to store for a recipe's cost, worked out on the server from
 * its stored ingredients. Below the coverage bar the cost is cleared rather
 * than shown half-priced.
 */
export function costColumns(servings: number, ingredients: IngredientRow[]) {
  const ordered = [...ingredients].sort((a, b) => a.position - b.position).map((i) => ({ name: i.name, amount: i.amount, unit: i.unit, isOptional: i.is_optional }))
  const result = computeRecipeCost({ servings, ingredients: ordered }, reference)
  if (result.coverage < MIN_COST_COVERAGE || !Number.isFinite(result.perServing)) {
    return { cost_per_serving: null, cost_coverage: result.coverage, cost_source: null }
  }
  return { cost_per_serving: result.perServing, cost_coverage: result.coverage, cost_source: 'savry_price_table' as const }
}
