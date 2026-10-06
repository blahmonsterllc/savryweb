/**
 * Admin recipe management. Admin-only via middleware.ts.
 *
 * GET  /api/admin/recipes?q=&limit=           search by title, slug, or author
 * GET  /api/admin/recipes?id=<uuid>           one recipe in full, drafts included
 * POST /api/admin/recipes { id, visibility }  public | unlisted | private (clears review hold)
 * POST /api/admin/recipes { id, editorsPick }  true | false
 * POST /api/admin/recipes { id, edit: { title, description, notes, prepTime, cookTime, servings,
 *                                       ingredientsText, stepsText, allergens, dietaryTags } }
 *      revises the recipe (the version before is kept) and recomputes its nutrition and cost
 * DELETE /api/admin/recipes?id=<uuid>         removes the recipe and everything attached to it
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-session'
import { parseIngredientLines, parseInstructionLines } from '@/lib/ingredient-lines.mjs'
import { nutritionColumns } from '@/lib/nutrition/recipe-nutrition'
import { costColumns } from '@/lib/cost/recipe-cost'

const ALLERGENS = ['milk', 'eggs', 'wheat', 'soy', 'peanuts', 'tree nuts', 'fish', 'shellfish', 'sesame']
const DIETARY = ['vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'nut-free', 'egg-free']
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const whole = (value: unknown) => Math.max(0, Math.round(Number(value) || 0))

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return
  const supabase = getSupabaseAdmin()
  res.setHeader('Cache-Control', 'no-store, max-age=0')

  if (req.method === 'GET') {
    // ?id=<uuid> returns one recipe in full (drafts included) for review.
    if (typeof req.query.id === 'string') {
      if (!UUID.test(req.query.id)) return res.status(400).json({ success: false, error: 'Bad request' })
      const { data, error } = await supabase.rpc('admin_recipe_detail', { target: req.query.id })
      if (error) return res.status(500).json({ success: false, error: error.message })
      if (!data) return res.status(404).json({ success: false, error: 'Not found' })
      return res.status(200).json({ success: true, recipe: data })
    }
    const query = typeof req.query.q === 'string' ? req.query.q.slice(0, 120) : null
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500)
    const { data, error } = await supabase.rpc('admin_recipes', { query, page_limit: limit })
    if (error) return res.status(500).json({ success: false, error: error.message })
    return res.status(200).json({ success: true, recipes: data ?? [] })
  }

  if (req.method === 'DELETE') {
    const id = typeof req.query.id === 'string' ? req.query.id : ''
    if (!UUID.test(id)) return res.status(400).json({ success: false, error: 'Bad request' })
    const { data, error } = await supabase.rpc('admin_delete_recipe', { target: id })
    if (error) return res.status(400).json({ success: false, error: error.message })
    const imagePath = (data as { imagePath?: string | null } | null)?.imagePath
    if (imagePath) await supabase.storage.from('recipe-images').remove([imagePath]).catch(() => undefined)
    return res.status(200).json({ success: true, deleted: (data as { deleted?: boolean } | null)?.deleted === true })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const id = typeof req.body?.id === 'string' ? req.body.id : ''
  if (req.body?.edit && typeof req.body.edit === 'object') {
    if (!UUID.test(id)) return res.status(400).json({ success: false, error: 'Bad request' })
    const edit = req.body.edit
    type Parsed = { amount: string; unit: string; name: string; isOptional: boolean }
    const ingredients = (parseIngredientLines(text(edit.ingredientsText, 20000)).filter(Boolean) as Parsed[]).map((i) => ({ name: i.name, amount: i.amount || null, unit: i.unit || null, isOptional: i.isOptional }))
    const steps = parseInstructionLines(text(edit.stepsText, 60000))
    const payload = {
      title: text(edit.title, 120),
      description: text(edit.description, 600),
      notes: text(edit.notes, 4000),
      prepTime: whole(edit.prepTime),
      cookTime: whole(edit.cookTime),
      servings: whole(edit.servings),
      allergens: Array.isArray(edit.allergens) ? edit.allergens.filter((a: unknown) => ALLERGENS.includes(String(a))) : [],
      dietaryTags: Array.isArray(edit.dietaryTags) ? edit.dietaryTags.filter((d: unknown) => DIETARY.includes(String(d))) : [],
      ingredients,
      steps,
    }
    const { data, error } = await supabase.rpc('admin_update_recipe', { target: id, payload })
    if (error) return res.status(400).json({ success: false, error: error.message })
    // Nutrition and cost from the new ingredients, the same engines as everywhere else.
    const columns = { ...nutritionColumns(payload.servings, ingredients), ...costColumns(payload.servings, ingredients.map((i, position) => ({ position, name: i.name, amount: i.amount, unit: i.unit, is_optional: i.isOptional }))) }
    const { error: priceError } = await supabase.from('recipes').update(columns).eq('id', id)
    if (priceError) return res.status(500).json({ success: false, error: 'Saved, but nutrition and cost could not be updated' })
    const slug = (data as { slug?: string } | null)?.slug
    if (slug) await res.revalidate(`/recipes/${slug}`).catch(() => undefined)
    return res.status(200).json({ success: true, version: (data as { version?: number } | null)?.version, costPerServing: columns.cost_per_serving, calories: (columns.nutrition_per_serving as { calories?: number } | null)?.calories ?? null })
  }
  if (typeof req.body?.editorsPick === 'boolean') {
    if (!UUID.test(id)) return res.status(400).json({ success: false, error: 'Bad request' })
    const { error } = await supabase.rpc('admin_set_editors_pick', { target: id, pick: req.body.editorsPick })
    if (error) return res.status(400).json({ success: false, error: error.message })
    return res.status(200).json({ success: true })
  }
  const visibility = req.body?.visibility
  if (!UUID.test(id) || !['public', 'unlisted', 'private'].includes(visibility)) return res.status(400).json({ success: false, error: 'Bad request' })
  const { error } = await supabase.rpc('admin_set_recipe_visibility', { target: id, new_visibility: visibility })
  if (error) return res.status(400).json({ success: false, error: error.message })
  return res.status(200).json({ success: true })
}
