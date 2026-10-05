/**
 * Works out and stores the cost per serving of one of the caller's own
 * recipes, from the ingredients the database holds. The browser sends only
 * which recipe; it never sends a cost.
 *
 * POST /api/recipes/cost
 *   Authorization: Bearer <Supabase access token>
 *   { "slug": "<recipe slug>" }
 *
 * → 200 { costPerServing | null }
 *   401 not signed in · 403 banned · 404 not the caller's recipe
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { costColumns } from '@/lib/cost/recipe-cost'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Sign in first' })
  const supabase = getSupabaseAdmin()
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) return res.status(401).json({ error: 'Sign in first' })

  const slug = typeof req.body?.slug === 'string' ? req.body.slug.trim() : ''
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) return res.status(404).json({ error: 'Recipe not found' })

  const { data: profile } = await supabase.from('profiles').select('is_banned').eq('id', userData.user.id).maybeSingle()
  if (profile?.is_banned) return res.status(403).json({ error: 'This account cannot publish' })

  // Only the caller's own recipe; anyone else's reads as not found.
  const { data: recipe, error } = await supabase
    .from('recipes')
    .select('id, servings, recipe_ingredients(position, name, amount, unit, is_optional)')
    .eq('slug', slug)
    .eq('author_id', userData.user.id)
    .maybeSingle()
  if (error) return res.status(500).json({ error: 'Could not price the recipe' })
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' })

  const columns = costColumns(recipe.servings, recipe.recipe_ingredients ?? [])
  const { error: updateError } = await supabase.from('recipes').update(columns).eq('id', recipe.id)
  if (updateError) return res.status(500).json({ error: 'Could not price the recipe' })
  return res.status(200).json({ costPerServing: columns.cost_per_serving })
}
