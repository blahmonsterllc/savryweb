/**
 * Admin recipe management. Admin-only via middleware.ts.
 *
 * GET  /api/admin/recipes?q=&limit=           search by title, slug, or author
 * GET  /api/admin/recipes?id=<uuid>           one recipe in full, drafts included
 * POST /api/admin/recipes { id, visibility }  public | unlisted | private (clears review hold)
 * POST /api/admin/recipes { id, editorsPick }  true | false
 * DELETE /api/admin/recipes?id=<uuid>         removes the recipe and everything attached to it
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-session'

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
