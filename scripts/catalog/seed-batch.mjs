#!/usr/bin/env node
/**
 * Load Savry Kitchen recipe batches into Supabase as PRIVATE DRAFTS. Nothing
 * becomes public here: an admin reads each draft at /admin/recipes and flips
 * it to Public when it passes review.
 *
 *   node scripts/catalog/validate-batch.mjs content/launch-catalog/batches/*.json   # must pass first
 *   node scripts/catalog/seed-batch.mjs --project-ref qnpekzrchqftdoaebzuf content/launch-catalog/batches/*.json [--dry-run] [--update]
 *
 * Recipes are owned by the existing Savry Kitchen account (kitchen@savry.io);
 * this script never creates or edits that account. A recipe already seeded
 * (same slug) is skipped unless --update is passed, and --update never changes
 * a recipe's visibility.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).
 */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

const AUTHOR_EMAIL = 'kitchen@savry.io'

function flag(name) {
  return process.argv.includes(`--${name}`)
}
function value(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

async function findKitchenUser(supabase) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    const found = data.users.find((user) => user.email === AUTHOR_EMAIL)
    if (found) return found
    if (data.users.length < 100) break
  }
  throw new Error(`${AUTHOR_EMAIL} does not exist in this project; run seed-savry-kitchen first`)
}

async function main() {
  const expectedRef = value('project-ref')
  const files = process.argv.slice(2).filter((a, i, all) => a.endsWith('.json') && all[i - 1] !== '--project-ref')
  const dryRun = flag('dry-run')
  const update = flag('update')
  if (!files.length || !expectedRef) {
    console.error('usage: seed-batch.mjs --project-ref <ref> <batch.json> [...] [--dry-run] [--update]')
    process.exit(1)
  }

  const recipes = []
  for (const file of files) recipes.push(...JSON.parse(await readFile(file, 'utf8')))
  console.log(`${recipes.length} recipes from ${files.length} file(s)`)
  if (dryRun) {
    for (const recipe of recipes) console.log(`  draft  ${recipe.slug}  (${recipe.category}, ${recipe.cuisine}; ${recipe.dietaryTags.join(', ') || 'no dietary tags'})`)
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secret) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required')
  if (new URL(url).hostname.split('.')[0] !== expectedRef) throw new Error('Project guard failed: the URL does not match --project-ref')
  const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } })
  const author = await findKitchenUser(supabase)

  let created = 0
  let updated = 0
  let skipped = 0
  for (const recipe of recipes) {
    const clientRecipeID = `savry-kitchen:${recipe.slug}`
    const { data: existing, error: existingError } = await supabase.from('recipes').select('id, visibility').eq('slug', recipe.slug).maybeSingle()
    if (existingError) throw existingError
    if (existing && !update) {
      skipped += 1
      continue
    }

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
      yield_unit: recipe.servingType === 'yields' ? recipe.yieldUnit ?? null : null,
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
      image_url: recipe.imageURL ?? null,
      content_hash: createHash('sha256').update(JSON.stringify(recipe)).digest('hex'),
      schema_version: 2,
      quality_score: recipe.imageURL ? 85 : 70,
    }

    let recipeID = existing?.id
    if (recipeID) {
      const { error } = await supabase.from('recipes').update(row).eq('id', recipeID)
      if (error) throw new Error(`${recipe.slug}: ${error.message}`)
      for (const table of ['recipe_ingredients', 'recipe_steps']) {
        const { error: deleteError } = await supabase.from(table).delete().eq('recipe_id', recipeID)
        if (deleteError) throw new Error(`${recipe.slug}: ${deleteError.message}`)
      }
      updated += 1
    } else {
      const { data, error } = await supabase.from('recipes').insert({ ...row, visibility: 'private', published_at: null }).select('id').single()
      if (error) throw new Error(`${recipe.slug}: ${error.message}`)
      recipeID = data.id
      created += 1
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
      }))
    )
    if (ingredientError) throw new Error(`${recipe.slug}: ${ingredientError.message}`)
    const { error: stepError } = await supabase.from('recipe_steps').insert(recipe.instructions.map((instruction, position) => ({ recipe_id: recipeID, position, instruction })))
    if (stepError) throw new Error(`${recipe.slug}: ${stepError.message}`)
    const { error: versionError } = await supabase.from('recipe_versions').upsert(
      { recipe_id: recipeID, version: 1, snapshot: recipe, change_summary: 'Savry Kitchen draft', created_by: author.id },
      { onConflict: 'recipe_id,version' }
    )
    if (versionError) throw new Error(`${recipe.slug}: ${versionError.message}`)
  }
  console.log(JSON.stringify({ author: 'Savry Kitchen', created, updated, skipped, visibility: 'private (drafts awaiting review)' }))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
