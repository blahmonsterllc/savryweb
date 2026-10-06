/**
 * Refreshes the cached pages for one of the caller's own recipes after they
 * change it from the site (taking it off the table, accepting a tweak), so the
 * change shows at once instead of when the five-minute cache runs out.
 *
 * POST /api/recipes/refresh
 *   Authorization: Bearer <Supabase access token>
 *   { "slug": "<recipe slug>" }
 *
 * → 200 { refreshed: true }
 *   401 not signed in · 404 not the caller's recipe
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { refreshRecipePages, requireMember } from '@/lib/member-api'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const member = await requireMember(req, res)
  if (!member) return

  const slug = typeof req.body?.slug === 'string' ? req.body.slug.trim() : ''
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) return res.status(404).json({ error: 'Recipe not found' })

  // Only the caller's own recipe; anyone else's reads as not found.
  const supabase = getSupabaseAdmin()
  const { data: recipe, error } = await supabase.from('recipes').select('id').eq('slug', slug).eq('author_id', member.user.id).maybeSingle()
  if (error) return res.status(500).json({ error: 'Could not refresh the recipe' })
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' })
  const { data: profile } = await supabase.from('profiles').select('username').eq('id', member.user.id).maybeSingle()

  await refreshRecipePages(res, { slug, username: (profile as { username?: string | null } | null)?.username ?? null })
  return res.status(200).json({ refreshed: true })
}
