/**
 * Admin member management. Admin-only via middleware.ts.
 *
 * GET  /api/admin/members?q=&limit=      search by name, username, email, or id
 * POST /api/admin/members { id, banned }  ban (hides everything they posted) or unban
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
    const query = typeof req.query.q === 'string' ? req.query.q.slice(0, 120) : null
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
    const { data, error } = await supabase.rpc('admin_members', { query, page_limit: limit })
    if (error) return res.status(500).json({ success: false, error: error.message })
    return res.status(200).json({ success: true, members: data ?? [] })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const id = typeof req.body?.id === 'string' ? req.body.id : ''
  const banned = req.body?.banned
  if (!UUID.test(id) || typeof banned !== 'boolean') return res.status(400).json({ success: false, error: 'Bad request' })
  const { error } = await supabase.rpc('admin_set_ban', { target: id, banned })
  if (error) return res.status(400).json({ success: false, error: error.message })
  return res.status(200).json({ success: true })
}
