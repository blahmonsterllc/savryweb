/**
 * The admin activity log for /admin/activity. Admin-only via middleware.ts and
 * requireAdmin. Read-only: nothing on the site can change or delete an entry.
 *
 * GET /api/admin/activity?before=<ISO time>&limit=   entries newest first, and this week's counts
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-session'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminId = await requireAdmin(req, res)
  if (!adminId) return
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const rawBefore = typeof req.query.before === 'string' ? req.query.before : ''
  const before = rawBefore && !Number.isNaN(Date.parse(rawBefore)) ? new Date(rawBefore).toISOString() : null
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500)

  const supabase = getSupabaseAdmin()
  const [{ data: entries, error }, { data: summary, error: summaryError }] = await Promise.all([
    supabase.rpc('admin_activity_log', { page_limit: limit, before_at: before }),
    supabase.rpc('admin_activity_summary'),
  ])
  if (error || summaryError) return res.status(500).json({ success: false, error: (error ?? summaryError)?.message })
  return res.status(200).json({ success: true, entries: entries ?? [], summary })
}
