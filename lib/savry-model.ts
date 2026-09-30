import { z } from 'zod'

export const savryIngredientSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.string().trim().max(40).optional(),
  amount: z.string().trim().max(40).optional(),
  unit: z.string().trim().max(40).optional(),
  section: z.string().trim().max(60).optional(),
  isOptional: z.boolean().optional(),
})

export const savryRecipeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1200).optional(),
  ingredients: z.array(savryIngredientSchema).min(2).max(80),
  instructions: z.array(z.string().trim().min(1).max(1600)).min(1).max(60),
  prepTime: z.number().int().min(0).max(6000).optional(),
  cookTime: z.number().int().min(0).max(6000).optional(),
  totalTime: z.number().int().min(0).max(6000).optional(),
  servings: z.number().int().min(1).max(100).optional(),
  calories: z.number().int().min(0).max(10000).optional(),
  difficulty: z.string().trim().max(40).optional(),
  cuisine: z.string().trim().max(80).optional(),
  dietaryTags: z.array(z.string().trim().max(40)).max(20).optional(),
  tips: z.array(z.string().trim().max(500)).max(12).optional(),
})

export type SavryRecipe = z.infer<typeof savryRecipeSchema>

export const savryRecipeRequestSchema = z.object({
  request: z.string().trim().min(3).max(2000).optional(),
  ingredients: z.array(z.string().trim().min(1).max(160)).max(50).optional(),
  cuisine: z.string().trim().max(80).optional(),
  dietaryRestrictions: z.array(z.string().trim().max(60)).max(20).optional(),
  cookingTime: z.number().int().min(5).max(600).optional(),
  servings: z.number().int().min(1).max(100).optional(),
  difficulty: z.string().trim().max(40).optional(),
  budget: z.number().min(0).max(10000).optional(),
}).refine((value) => value.request || value.ingredients?.length, {
  message: 'Describe the recipe you want or provide at least one ingredient.',
})

export type SavryRecipeRequest = z.infer<typeof savryRecipeRequestSchema>

export class SavryModelUnavailableError extends Error {
  constructor(message = 'The Savry recipe model is not configured yet.') {
    super(message)
    this.name = 'SavryModelUnavailableError'
  }
}

const recipeJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'ingredients', 'instructions'],
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: 'string' },
          quantity: { type: 'string' },
          amount: { type: 'string' },
          unit: { type: 'string' },
          section: { type: 'string' },
          isOptional: { type: 'boolean' },
        },
      },
    },
    instructions: { type: 'array', items: { type: 'string' } },
    prepTime: { type: 'integer' },
    cookTime: { type: 'integer' },
    totalTime: { type: 'integer' },
    servings: { type: 'integer' },
    calories: { type: 'integer' },
    difficulty: { type: 'string' },
    cuisine: { type: 'string' },
    dietaryTags: { type: 'array', items: { type: 'string' } },
    tips: { type: 'array', items: { type: 'string' } },
  },
}

/**
 * Calls the independently hosted Savry recipe model. This intentionally has
 * no OpenAI or ChatGPT fallback: if Savry's model is unavailable, callers get
 * a clear 503 instead of silently sending recipe data to another provider.
 */
export async function generateSavryRecipe(input: SavryRecipeRequest): Promise<SavryRecipe> {
  const endpoint = process.env.SAVRY_MODEL_URL?.trim()
  if (!endpoint) throw new SavryModelUnavailableError()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.SAVRY_MODEL_API_KEY ? { Authorization: `Bearer ${process.env.SAVRY_MODEL_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: process.env.SAVRY_MODEL_ID || 'savry-recipe-v1',
        task: 'recipe.generate',
        input,
        response_schema: recipeJsonSchema,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      console.error('Savry model request failed', response.status)
      throw new SavryModelUnavailableError('The Savry recipe model is temporarily unavailable.')
    }

    const payload = await response.json()
    const parsed = savryRecipeSchema.safeParse(payload?.recipe ?? payload?.output ?? payload)
    if (!parsed.success) {
      console.error('Savry model returned an invalid recipe shape', parsed.error.flatten())
      throw new SavryModelUnavailableError('The Savry recipe model returned an incomplete recipe.')
    }
    return parsed.data
  } catch (error) {
    if (error instanceof SavryModelUnavailableError) throw error
    console.error('Savry model connection failed', error)
    throw new SavryModelUnavailableError('The Savry recipe model is temporarily unavailable.')
  } finally {
    clearTimeout(timeout)
  }
}
