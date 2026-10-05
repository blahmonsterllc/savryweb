import 'server-only'

import type { PublicRecipe } from '@/lib/community-recipes'
import { recipePageURL } from '@/lib/site-url'
import { getSupabasePublic } from '@/lib/supabase/public'

const PUBLIC_RECIPE_SELECT = `
  id, slug, title, description, image_url, published_at,
  prep_time_minutes, cook_time_minutes, servings, serving_type, yield_unit,
  difficulty, category, cuisine, tags, dietary_tags, allergens, equipment,
  oven_temp_f, notes, source_url, nutrition_per_serving, nutrition_source,
  nutrition_coverage, cost_per_serving, cost_coverage, view_count, made_count, comment_count, version, editors_pick_at,
  author:profiles!recipes_author_id_fkey(display_name, username),
  ingredients:recipe_ingredients(position, section, name, amount, unit, is_optional),
  steps:recipe_steps(position, instruction)
`

function nutritionSource(source: string | null | undefined): string | undefined {
  return source
    ? {
        usda_food_data_central: 'usdaFoodDataCentral',
        package_label: 'packageLabel',
        on_device_estimate: 'onDeviceEstimate',
        local_reference: 'localReference',
        imported: 'imported',
      }[source]
    : undefined
}

function firstRelation(value: any): any {
  return Array.isArray(value) ? value[0] : value
}

export function fromSupabaseRecipe(row: any): PublicRecipe {
  const prepTime = Number(row.prep_time_minutes ?? 0)
  const cookTime = Number(row.cook_time_minutes ?? 0)
  const nutrition = row.nutrition_per_serving
    ? {
        ...row.nutrition_per_serving,
        source: nutritionSource(row.nutrition_source),
        ingredientCoverage: row.nutrition_coverage == null ? undefined : Number(row.nutrition_coverage),
      }
    : null
  return {
    id: row.id,
    slug: String(row.slug),
    url: recipePageURL(String(row.slug)),
    title: row.title,
    description: row.description ?? null,
    imageUrl: row.image_url ?? null,
    authorName: firstRelation(row.author)?.display_name ?? 'Savry cook',
    authorUsername: firstRelation(row.author)?.username ?? null,
    publishedAt: row.published_at ?? new Date().toISOString(),
    prepTime,
    cookTime,
    totalTime: prepTime + cookTime,
    servings: Number(row.servings ?? 1),
    servingType: row.serving_type === 'yields' ? 'yields' : 'servings',
    yieldUnit: row.yield_unit ?? null,
    difficulty: row.difficulty ?? 'Medium',
    category: row.category ?? 'Other',
    cuisine: row.cuisine ?? null,
    tags: row.tags ?? [],
    dietaryTags: row.dietary_tags ?? [],
    allergens: row.allergens ?? [],
    equipment: row.equipment ?? [],
    ovenTemp: row.oven_temp_f ?? null,
    notes: row.notes ?? null,
    ingredients: (row.ingredients ?? [])
      .sort((a: any, b: any) => Number(a.position) - Number(b.position))
      .map((item: any) => ({
        name: item.name,
        amount: item.amount ?? null,
        unit: item.unit ?? null,
        section: item.section ?? null,
        isOptional: !!item.is_optional,
      })),
    instructions: (row.steps ?? [])
      .sort((a: any, b: any) => Number(a.position) - Number(b.position))
      .map((step: any) => step.instruction),
    nutritionPerServing: nutrition,
    sourceURL: typeof row.source_url === 'string' && row.source_url.startsWith('http') ? row.source_url : null,
    viewCount: Number(row.view_count ?? 0),
    madeCount: Number(row.made_count ?? 0),
    editorsPick: Boolean(row.editors_pick_at),
    // Shown only when nearly all of the recipe could be priced.
    costPerServing: row.cost_per_serving == null || Number(row.cost_coverage ?? 0) < 0.95 ? null : Number(row.cost_per_serving),
    commentCount: Number(row.comment_count ?? 0),
    version: Number(row.version ?? 1),
  }
}

export async function getSupabasePublicRecipeBySlug(slug: string): Promise<PublicRecipe | null> {
  const { data, error } = await getSupabasePublic()
    .from('recipes')
    .select(PUBLIC_RECIPE_SELECT)
    .eq('slug', slug)
    .eq('visibility', 'public')
    .maybeSingle()
  if (error) throw error
  return data ? fromSupabaseRecipe(data) : null
}

export async function listSupabasePublicRecipes(limit = 24): Promise<PublicRecipe[]> {
  const { data, error } = await getSupabasePublic()
    .from('recipes')
    .select(PUBLIC_RECIPE_SELECT)
    .eq('visibility', 'public')
    .order('published_at', { ascending: false })
    // The whole table is small enough to list; the explorer filters on the client.
    .limit(Math.min(Math.max(limit, 1), 2000))
  if (error) throw error
  return (data ?? []).map(fromSupabaseRecipe)
}

export interface PublicCook {
  id: string
  username: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  socialLinks: Record<string, string>
  memberSince: string
  recipes: PublicRecipe[]
}

/** A cook's public page: profile fields they chose plus their public recipes. */
export async function getSupabasePublicCook(username: string): Promise<PublicCook | null> {
  const handle = username.trim().replace(/^@/, '').toLowerCase()
  if (!/^[a-z0-9][a-z0-9_.-]{2,29}$/.test(handle)) return null
  const supabase = getSupabasePublic()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_path, social_links, created_at')
    .eq('username', handle)
    .maybeSingle()
  if (error) throw error
  if (!profile) return null
  const { data: rows, error: recipesError } = await supabase
    .from('recipes')
    .select(PUBLIC_RECIPE_SELECT)
    .eq('author_id', profile.id)
    .eq('visibility', 'public')
    .order('published_at', { ascending: false })
    .limit(60)
  if (recipesError) throw recipesError
  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/recipe-images`
  const links = profile.social_links && typeof profile.social_links === 'object' ? profile.social_links : {}
  return {
    id: profile.id,
    username: String(profile.username),
    displayName: profile.display_name,
    bio: profile.bio ?? null,
    avatarUrl: profile.avatar_path ? `${storageBase}/${profile.avatar_path}` : null,
    socialLinks: Object.fromEntries(Object.entries(links).filter(([, v]) => typeof v === 'string')) as Record<string, string>,
    memberSince: profile.created_at,
    recipes: (rows ?? []).map(fromSupabaseRecipe),
  }
}
