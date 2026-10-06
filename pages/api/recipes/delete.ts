/**
 * Deletes one of the caller's own recipes, its photos, and its cached pages.
 *
 * POST /api/recipes/delete
 *   Authorization: Bearer <Supabase access token>
 *   { "slug": "<recipe slug>" }
 *
 * The delete itself runs as the member (delete_my_recipe checks authorship).
 * The browser cannot remove storage objects since the bucket's SELECT policy
 * was dropped, so the photos go here, with the service role, and only from the
 * caller's own folder: the recipe's photo and earlier versions' photos, unless
 * something else of theirs still shows the same file.
 *
 * → 200 { deleted: true, photosRemoved }
 *   401 not signed in · 404 not the caller's recipe
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { memberClient, refreshRecipePages, removeOwnPhotos, requireMember } from '@/lib/member-api'
import { ownPhotoPaths } from '@/lib/member-cleanup.mjs'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const member = await requireMember(req, res)
  if (!member) return
  const userId = member.user.id

  const slug = typeof req.body?.slug === 'string' ? req.body.slug.trim() : ''
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) return res.status(404).json({ error: 'Recipe not found' })

  // Only the caller's own recipe; anyone else's reads as not found.
  const supabase = getSupabaseAdmin()
  const { data: recipe, error } = await supabase
    .from('recipes')
    .select('id, image_path, recipe_versions(image_path:snapshot->recipe->>image_path)')
    .eq('slug', slug)
    .eq('author_id', userId)
    .maybeSingle()
  if (error) return res.status(500).json({ error: 'Could not delete the recipe' })
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' })

  const versions = (recipe.recipe_versions ?? []) as { image_path?: unknown }[]
  const candidates = ownPhotoPaths(userId, [recipe.image_path, ...versions.map((v) => v.image_path)])
  const { data: profile } = await supabase.from('profiles').select('username').eq('id', userId).maybeSingle()
  const username = (profile as { username?: string | null } | null)?.username ?? null

  const { error: deleteError } = await memberClient(member.token).rpc('delete_my_recipe', { target_slug: slug })
  if (deleteError) return res.status(400).json({ error: deleteError.message })

  // A file another of the caller's recipes, their avatar, or a Made It still shows stays.
  let photosRemoved = 0
  if (candidates.length) {
    const [recipes, profiles, contributions] = await Promise.all([
      supabase.from('recipes').select('image_path').in('image_path', candidates),
      supabase.from('profiles').select('avatar_path').in('avatar_path', candidates),
      supabase.from('contributions').select('photo_path').in('photo_path', candidates),
    ])
    if (!recipes.error && !profiles.error && !contributions.error) {
      const inUse = new Set<string>([
        ...(recipes.data ?? []).map((r) => r.image_path as string),
        ...(profiles.data ?? []).map((p) => p.avatar_path as string),
        ...(contributions.data ?? []).map((c) => c.photo_path as string),
      ])
      photosRemoved = await removeOwnPhotos(userId, candidates.filter((path) => !inUse.has(path)))
    }
  }

  await refreshRecipePages(res, { slug, username })
  return res.status(200).json({ deleted: true, photosRemoved })
}
