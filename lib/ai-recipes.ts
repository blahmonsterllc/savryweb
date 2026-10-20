import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import * as z from 'zod/v4'

/**
 * Recipe help for iPhones without Apple Intelligence: the app sends the
 * cook's request here and Claude writes the recipe in the same shape the
 * on-device model produces (GeneratedRecipe in RecipeIntelligenceService.swift).
 * The app still runs its own allergy check on every recipe it receives.
 */

const MODEL = process.env.AI_RECIPE_MODEL?.trim() || 'claude-haiku-5-5'

const Ingredient = z.object({
  name: z.string().describe("Ingredient name without quantity, e.g. 'boneless chicken thighs'"),
  amount: z.string().nullable().describe("Quantity as written in a recipe, e.g. '2', '1/2', '1.5'; null if not applicable"),
  unit: z.string().nullable().describe("cup, tbsp, tsp, oz, lb, g, clove...; null for counted items like '2 eggs'"),
  section: z.string().nullable().describe("Section such as 'Marinade' or 'Sauce'; null for single-section recipes"),
  isOptional: z.boolean(),
})

const Nutrition = z.object({
  calories: z.number().int(), protein: z.number().int(), carbohydrates: z.number().int(), fat: z.number().int(),
  fiber: z.number().int(), sugar: z.number().int(), sodium: z.number().int(), cholesterol: z.number().int(),
}).describe('Estimated nutrition for ONE serving (or one item when the recipe yields items); sodium and cholesterol in mg, the rest in grams except calories')

export const GeneratedRecipeSchema = z.object({
  title: z.string(),
  description: z.string().describe('One or two sentences about the dish'),
  prepTime: z.number().int().describe('Minutes'),
  cookTime: z.number().int().describe('Minutes'),
  servings: z.number().int().describe('People served, or items made when servingType is yields'),
  servingType: z.enum(['servings', 'yields']),
  yieldUnit: z.string().nullable().describe("e.g. 'cookies' when servingType is yields; null otherwise"),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  cuisine: z.string().nullable(),
  category: z.enum(['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Appetizer', 'Side Dish', 'Beverage', 'Other']),
  ingredients: z.array(Ingredient),
  instructions: z.array(z.string()).describe('Ordered steps, one clear action each, no step numbers in the text'),
  nutrition: Nutrition,
  tags: z.array(z.string()).describe("Up to 6 short tags such as 'quick', 'one-pot'"),
  dietaryTags: z.array(z.string()).describe("Diets the recipe satisfies, e.g. 'vegan', 'gluten-free'"),
  allergens: z.array(z.string()).describe('Major allergens present: Milk, Eggs, Wheat, Soy, Peanuts, Tree Nuts, Fish, Crustacean Shellfish, Sesame'),
  ovenTemp: z.number().int().nullable().describe('Fahrenheit if the oven is used; null otherwise'),
  notes: z.string().nullable().describe('Storage, make-ahead or serving notes; null if nothing useful'),
})

export type GeneratedRecipe = z.infer<typeof GeneratedRecipeSchema>

const SYSTEM = `You are Savry, an expert home-cooking chef. You only help with food: recipes, ingredients, cooking techniques, meal planning and nutrition. If a request is not about food or cooking, return a recipe whose title is exactly "Not a cooking request" and leave the rest minimal.
Recipes must be practical for a home kitchen, use realistic quantities and US customary units, and read like a well-edited cookbook. When the cook lists allergies, never use those ingredients, their derivatives, or foods sold under other names (a hazelnut allergy also rules out Nutella, filberts, gianduja and praline).`

export class AIRecipeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

let client: Anthropic | null = null
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new AIRecipeError('Recipe help is not configured', 503)
  client ??= new Anthropic({ timeout: 60_000, maxRetries: 1 })
  return client
}

/** Asks Claude for one recipe. `request` is the full instruction the app built. */
export async function writeRecipe(request: string): Promise<GeneratedRecipe> {
  let response
  try {
    response = await anthropic().messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: 'user', content: request }],
      output_config: { format: zodOutputFormat(GeneratedRecipeSchema), effort: 'low' },
    })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError || error instanceof Anthropic.APIConnectionError) {
      throw new AIRecipeError('Recipe help is busy right now. Try again in a minute.', 503)
    }
    if (error instanceof Anthropic.APIError) {
      console.error('ai recipe: model call failed', error.status, error.message)
      throw new AIRecipeError('Recipe help could not answer that. Try again.', 502)
    }
    throw error
  }
  if (response.stop_reason === 'refusal') throw new AIRecipeError('Savry can’t help with that request.', 422)
  if (response.stop_reason === 'max_tokens' || !response.parsed_output) throw new AIRecipeError('Recipe help could not finish that recipe. Try a simpler request.', 502)
  const recipe = response.parsed_output
  if (/not a cooking request/i.test(recipe.title)) throw new AIRecipeError('Savry only helps with food and cooking. Try asking for a recipe instead.', 422)
  return clamp(recipe)
}

/** Keeps numbers in the ranges the app accepts. */
function clamp(recipe: GeneratedRecipe): GeneratedRecipe {
  const between = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)))
  return {
    ...recipe,
    prepTime: between(recipe.prepTime, 0, 600),
    cookTime: between(recipe.cookTime, 0, 1440),
    servings: between(recipe.servings, 1, 100),
    ovenTemp: recipe.ovenTemp == null ? null : between(recipe.ovenTemp, 150, 550),
    ingredients: recipe.ingredients.slice(0, 40),
    instructions: recipe.instructions.slice(0, 25),
    tags: recipe.tags.slice(0, 6),
    dietaryTags: recipe.dietaryTags.slice(0, 6),
    allergens: recipe.allergens.slice(0, 12),
  }
}
