import 'server-only'

import rules from '@/content/nutrition/ingredient-rules.json'
import usda from '@/content/nutrition/usda-foods.json'
import { computeRecipeNutrition, createMatcher } from '@/lib/nutrition/compute.mjs'

const ruleList = rules as object[]
const reference = { rules: ruleList, foods: (usda as { foods: Record<string, object> }).foods, resolve: createMatcher(ruleList) }

type IngredientRow = { name: string; amount: string | null; unit: string | null; isOptional: boolean }

/**
 * The nutrition columns for a recipe, worked out on the server with the same
 * USDA engine as everywhere else. Below 95% coverage nothing is shown rather
 * than a label that leaves things out.
 */
export function nutritionColumns(servings: number, ingredients: IngredientRow[]) {
  const result = computeRecipeNutrition({ servings, ingredients }, reference)
  if (result.coverage < 0.95) return { nutrition_per_serving: null, nutrition_source: null, nutrition_coverage: result.coverage }
  const n = result.perServing
  return {
    nutrition_per_serving: { calories: n.calories, protein: n.protein, carbohydrates: n.carbohydrates, fat: n.fat, fiber: n.fiber, sugar: n.sugar, sodium: n.sodium, cholesterol: n.cholesterol, saturatedFat: n.saturatedFat, servingGrams: result.servingGrams },
    nutrition_source: 'usda_food_data_central',
    nutrition_coverage: result.coverage,
  }
}
