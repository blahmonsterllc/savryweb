/**
 * Public community recipes: the documents the iOS app publishes and the
 * website renders. Supabase/PostgreSQL is the only backend; nothing is
 * retained temporarily as a migration fallback until production validation.
 */
import { z } from 'zod'
import { createHash } from 'node:crypto'
import { recipePageURL } from '@/lib/site-url'


// ---------------------------------------------------------------------------
// Payload the iOS app sends to the publish_recipe_v2 database function
// (mirrors PublishedRecipePayload in the app's SavryPublishService.swift)
// ---------------------------------------------------------------------------

export const publishPayloadSchema = z.object({
  sourceClient: z.enum(['savry-ios', 'savry-web', 'savry-android']).default('savry-ios'),
  rightsAttested: z.boolean().default(false),
  clientRecipeId: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullish(),
  prepTime: z.number().int().min(0).max(6000).default(0),
  cookTime: z.number().int().min(0).max(6000).default(0),
  servings: z.number().int().min(1).max(500).default(1),
  servingType: z.enum(['servings', 'yields']).default('servings'),
  yieldUnit: z.string().max(40).nullish(),
  difficulty: z.string().max(20).default('Medium'),
  category: z.string().max(40).default('Other'),
  cuisine: z.string().max(60).nullish(),
  tags: z.array(z.string().max(40)).max(20).default([]),
  dietaryTags: z.array(z.string().max(40)).max(20).default([]),
  allergens: z.array(z.string().max(40)).max(20).default([]),
  equipment: z.array(z.string().max(60)).max(20).default([]),
  ovenTemp: z.number().int().min(100).max(700).nullish(),
  notes: z.string().max(2000).nullish(),
  ingredients: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        amount: z.string().max(40).nullish(),
        unit: z.string().max(40).nullish(),
        section: z.string().max(60).nullish(),
        isOptional: z.boolean().default(false),
      })
    )
    .min(1)
    .max(80),
  instructions: z.array(z.string().trim().min(1).max(2000)).min(1).max(60),
  nutritionPerServing: z
    .object({
      calories: z.number().int().min(0),
      protein: z.number().int().min(0),
      carbohydrates: z.number().int().min(0),
      fat: z.number().int().min(0),
      fiber: z.number().int().min(0),
      sugar: z.number().int().min(0),
      sodium: z.number().int().min(0),
      cholesterol: z.number().int().min(0),
      saturatedFat: z.number().int().min(0).nullish(),
      servingGrams: z.number().int().min(0).nullish(),
      source: z.enum(['usdaFoodDataCentral', 'packageLabel', 'onDeviceEstimate', 'localReference', 'imported']).nullish(),
      ingredientCoverage: z.number().min(0).max(1).nullish(),
    })
    .nullish(),
  sourceURL: z.string().url().max(2000).nullish(),
  /** JPEG, base64, no data: prefix. Capped so a request stays well under Vercel limits. */
  imageBase64: z.string().max(1_200_000).nullish(),
})

export type PublishPayload = z.infer<typeof publishPayloadSchema>

// ---------------------------------------------------------------------------
// Search, quality, and deduplication metadata
// ---------------------------------------------------------------------------

function searchWords(value: unknown): string[] {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= 2)
}

/** Exact tokens plus short prefixes for responsive search. */
export function buildSearchTokens(recipe: any, authorName = ''): string[] {
  const ingredients = (recipe.ingredients ?? []).map((item: any) => item?.name ?? item?.ingredient ?? item)
  const source = [
    recipe.title,
    recipe.category,
    recipe.cuisine,
    ...(recipe.tags ?? []),
    ...(recipe.dietaryTags ?? recipe.dietary ?? []),
    ...ingredients,
    authorName,
  ]
  const words = source.flatMap(searchWords)
  const tokens = new Set<string>()
  for (const word of words) {
    tokens.add(word.slice(0, 32))
    for (let length = 2; length <= Math.min(word.length, 10); length++) tokens.add(word.slice(0, length))
    if (tokens.size >= 180) break
  }
  return Array.from(tokens).slice(0, 180)
}

export function recipeContentHash(recipe: any): string {
  const stable = {
    title: recipe.title ?? recipe.name ?? '',
    description: recipe.description ?? '',
    prepTime: Number(recipe.prepTime ?? 0),
    cookTime: Number(recipe.cookTime ?? 0),
    servings: Number(recipe.servings ?? 1),
    category: recipe.category ?? '',
    cuisine: recipe.cuisine ?? '',
    tags: recipe.tags ?? [],
    dietaryTags: recipe.dietaryTags ?? recipe.dietary ?? [],
    allergens: recipe.allergens ?? [],
    ingredients: (recipe.ingredients ?? []).map((item: any) => ({
      name: item?.name ?? item?.ingredient ?? item,
      amount: item?.amount ?? item?.quantity ?? null,
      unit: item?.unit ?? null,
      section: item?.section ?? null,
      isOptional: !!item?.isOptional,
    })),
    instructions: (recipe.instructions ?? []).map((step: any) => step?.text ?? step?.instruction ?? step),
    notes: recipe.notes ?? recipe.recipeNotes ?? '',
  }
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex')
}

/** Stable per-account id makes publishing idempotent across retries and devices. */
export function publishedRecipeId(userId: string, clientRecipeId: string): string {
  return `recipe_${createHash('sha256').update(`${userId}:${clientRecipeId}`).digest('hex').slice(0, 28)}`
}

export function recipeQualityScore(recipe: any): number {
  let score = 20 // A valid publish always has a title, ingredients, and instructions.
  if (String(recipe.description ?? '').trim().length >= 40) score += 10
  if (recipe.imageUrl) score += 15
  if (Number(recipe.prepTime ?? 0) > 0 || Number(recipe.cookTime ?? 0) > 0) score += 10
  if ((recipe.tags ?? []).length > 0) score += 8
  if (recipe.category && recipe.category !== 'Other') score += 7
  if (recipe.cuisine) score += 5
  if ((recipe.dietaryTags ?? recipe.dietary ?? []).length > 0) score += 5
  if ((recipe.equipment ?? []).length > 0) score += 5
  if (String(recipe.notes ?? '').trim()) score += 5
  if (recipe.nutritionPerServing) score += 10
  return Math.min(score, 100)
}

export function buildRecipeIndex(recipe: any, authorName = '') {
  const totalTime = Number(recipe.totalTime ?? Number(recipe.prepTime ?? 0) + Number(recipe.cookTime ?? 0))
  const normalizeKey = (value: unknown) => searchWords(value).join('-').slice(0, 60)
  const qualityScore = recipeQualityScore(recipe)
  return {
    schemaVersion: 2,
    contentHash: recipeContentHash(recipe),
    searchTokens: buildSearchTokens(recipe, authorName),
    categoryKey: normalizeKey(recipe.category || 'other'),
    cuisineKey: normalizeKey(recipe.cuisine),
    dietaryKeys: (recipe.dietaryTags ?? recipe.dietary ?? []).map(normalizeKey).filter(Boolean),
    allergenKeys: (recipe.allergens ?? []).map(normalizeKey).filter(Boolean),
    totalTimeBucket: totalTime <= 30 ? 'under-30' : totalTime <= 60 ? '30-to-60' : 'over-60',
    qualityScore,
  }
}

// ---------------------------------------------------------------------------
// What the website renders
// ---------------------------------------------------------------------------

export interface PublicRecipe {
  id: string
  slug: string
  url: string
  title: string
  description: string | null
  imageUrl: string | null
  authorName: string
  authorUsername: string | null
  publishedAt: string // ISO
  prepTime: number
  cookTime: number
  totalTime: number
  servings: number
  servingType: 'servings' | 'yields'
  yieldUnit: string | null
  difficulty: string
  category: string
  cuisine: string | null
  tags: string[]
  dietaryTags: string[]
  allergens: string[]
  equipment: string[]
  ovenTemp: number | null
  notes: string | null
  ingredients: { name: string; amount: string | null; unit: string | null; section: string | null; isOptional: boolean }[]
  instructions: string[]
  nutritionPerServing: PublishPayload['nutritionPerServing'] | null
  /** Estimated US dollars per serving from Savry's price table; null when too few ingredients were priced. */
  costPerServing: number | null
  sourceURL: string | null
  viewCount: number
  madeCount: number
  /** Chosen by a Savry editor; set only from admin. */
  editorsPick?: boolean
  commentCount: number
  version: number
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'recipe'
}



export async function getPublicRecipeBySlug(slug: string): Promise<PublicRecipe | null> {
  const { getSupabasePublicRecipeBySlug } = await import('@/lib/community-recipes-supabase')
  return getSupabasePublicRecipeBySlug(slug)
}

export async function listPublicRecipes(limit = 24): Promise<PublicRecipe[]> {
  const { listSupabasePublicRecipes } = await import('@/lib/community-recipes-supabase')
  return listSupabasePublicRecipes(limit)
}

/** ISO 8601 duration for schema.org, e.g. 25 minutes -> PT25M */
export function isoDuration(minutes: number): string | undefined {
  if (!minutes || minutes <= 0) return undefined
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}` || undefined
}

export function ingredientLine(i: PublicRecipe['ingredients'][number]): string {
  return [i.amount, i.unit, i.name].filter(Boolean).join(' ') + (i.isOptional ? ' (optional)' : '')
}

/** schema.org/Recipe JSON-LD. The Savry iOS importer reads exactly this. */
export function recipeJsonLd(r: PublicRecipe) {
  const nutrition = r.nutritionPerServing
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    '@id': r.url,
    url: r.url,
    name: r.title,
    description: r.description ?? undefined,
    image: r.imageUrl ? [r.imageUrl] : undefined,
    author: { '@type': 'Person', name: r.authorName },
    datePublished: r.publishedAt,
    prepTime: isoDuration(r.prepTime),
    cookTime: isoDuration(r.cookTime),
    totalTime: isoDuration(r.totalTime),
    recipeYield: r.servingType === 'yields' ? `${r.servings} ${r.yieldUnit ?? 'items'}` : `${r.servings} servings`,
    recipeCategory: r.category,
    recipeCuisine: r.cuisine ?? undefined,
    keywords: [...r.tags, ...r.dietaryTags].join(', ') || undefined,
    suitableForDiet: undefined,
    recipeIngredient: r.ingredients.map(ingredientLine),
    recipeInstructions: r.instructions.map((text, i) => ({ '@type': 'HowToStep', position: i + 1, text })),
    nutrition: nutrition
      ? {
          '@type': 'NutritionInformation',
          servingSize: '1 serving',
          calories: `${nutrition.calories} calories`,
          proteinContent: `${nutrition.protein} g`,
          carbohydrateContent: `${nutrition.carbohydrates} g`,
          fatContent: `${nutrition.fat} g`,
          fiberContent: `${nutrition.fiber} g`,
          sugarContent: `${nutrition.sugar} g`,
          sodiumContent: `${nutrition.sodium} mg`,
          cholesterolContent: `${nutrition.cholesterol} mg`,
        }
      : undefined,
  }
}
