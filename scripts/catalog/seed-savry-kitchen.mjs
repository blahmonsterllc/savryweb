#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

const ROOT = resolve(import.meta.dirname, '../..')
const SEED_FILE = resolve(ROOT, 'content/launch-catalog/savry-kitchen-recipes.json')
const AUTHOR_EMAIL = 'kitchen@savry.io'

function projectRef(url) {
  return new URL(url).hostname.split('.')[0]
}

async function findOrCreateKitchenUser(supabase) {
  let page = 1
  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    const existing = data.users.find((user) => user.email === AUTHOR_EMAIL)
    if (existing) return existing
    if (data.users.length < 100) break
    page += 1
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: AUTHOR_EMAIL,
    password: randomBytes(32).toString('base64url'),
    email_confirm: true,
    user_metadata: { full_name: 'Savry Kitchen', account_type: 'editorial' },
  })
  if (error) throw error
  return data.user
}

async function main() {
  const expectedProjectRef = process.argv[process.argv.indexOf('--project-ref') + 1]
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secret) throw new Error('Supabase URL and secret key are required')
  if (!expectedProjectRef || projectRef(url) !== expectedProjectRef) throw new Error('Project guard failed')

  const recipes = JSON.parse(await readFile(SEED_FILE, 'utf8'))
  const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } })
  const author = await findOrCreateKitchenUser(supabase)

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: author.id,
    username: 'savry-kitchen',
    display_name: 'Savry Kitchen',
    bio: 'Original recipes prepared for the Savry community preview.',
    chef_title: 'Launch kitchen',
    is_featured: false,
  })
  if (profileError) throw profileError

  for (const recipe of recipes) {
    const clientRecipeID = `savry-kitchen:${recipe.slug}`
    const contentHash = createHash('sha256').update(JSON.stringify(recipe)).digest('hex')
    const { data: existing, error: existingError } = await supabase
      .from('recipes')
      .select('id')
      .eq('author_id', author.id)
      .eq('client_recipe_id', clientRecipeID)
      .maybeSingle()
    if (existingError) throw existingError

    const row = {
      author_id: author.id,
      client_recipe_id: clientRecipeID,
      slug: recipe.slug,
      title: recipe.title,
      description: recipe.description,
      prep_time_minutes: recipe.prepTime,
      cook_time_minutes: recipe.cookTime,
      servings: recipe.servings,
      serving_type: recipe.servingType === 'yields' ? 'yields' : 'servings',
      yield_unit: recipe.yieldUnit ?? null,
      difficulty: recipe.difficulty,
      category: recipe.category,
      cuisine: recipe.cuisine,
      tags: recipe.tags,
      dietary_tags: recipe.dietaryTags,
      allergens: recipe.allergens,
      equipment: recipe.equipment,
      oven_temp_f: recipe.ovenTemp ?? null,
      notes: recipe.notes,
      source_url: null,
      image_url: recipe.imageURL,
      visibility: 'public',
      published_at: new Date().toISOString(),
      content_hash: contentHash,
      schema_version: 2,
      quality_score: recipe.imageURL ? 85 : 70,
    }

    let recipeID = existing?.id
    if (recipeID) {
      const { error } = await supabase.from('recipes').update(row).eq('id', recipeID)
      if (error) throw error
      const { error: ingredientDeleteError } = await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeID)
      if (ingredientDeleteError) throw ingredientDeleteError
      const { error: stepDeleteError } = await supabase.from('recipe_steps').delete().eq('recipe_id', recipeID)
      if (stepDeleteError) throw stepDeleteError
    } else {
      const { data, error } = await supabase.from('recipes').insert(row).select('id').single()
      if (error) throw error
      recipeID = data.id
    }

    const { error: ingredientError } = await supabase.from('recipe_ingredients').insert(
      recipe.ingredients.map((ingredient, position) => ({
        recipe_id: recipeID,
        position,
        section: ingredient.section ?? null,
        name: ingredient.name,
        amount: ingredient.amount ?? null,
        unit: ingredient.unit ?? null,
        is_optional: Boolean(ingredient.isOptional),
      })),
    )
    if (ingredientError) throw ingredientError

    const { error: stepError } = await supabase.from('recipe_steps').insert(
      recipe.instructions.map((instruction, position) => ({ recipe_id: recipeID, position, instruction })),
    )
    if (stepError) throw stepError

    const { error: versionError } = await supabase.from('recipe_versions').upsert({
      recipe_id: recipeID,
      version: 1,
      snapshot: recipe,
      change_summary: 'Savry Kitchen preview recipe',
      created_by: author.id,
    }, { onConflict: 'recipe_id,version' })
    if (versionError) throw versionError
  }

  console.log(JSON.stringify({ author: 'Savry Kitchen', publishedRecipes: recipes.length }))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
