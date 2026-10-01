/**
 * Patrol flags for /admin/patrol. Admin-only via middleware.ts and requireAdmin.
 *
 * GET  /api/admin/patrol                       summary, open flags, watch list
 * POST /api/admin/patrol { id, action }        action: dismiss | remove | ban
 * POST /api/admin/patrol { action: 'run' }     review one batch now
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-session'
import { isPatrolConfigured, runPatrol } from '@/lib/patrol'

export const config = { maxDuration: 60 }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminId = await requireAdmin(req, res)
  if (!adminId) return
  const supabase = getSupabaseAdmin()

  if (req.method === 'GET') {
    const [{ data: summary, error: summaryError }, { data: flags, error: flagsError }] = await Promise.all([supabase.rpc('admin_patrol_summary'), supabase.rpc('admin_patrol_flags', { page_limit: 100 })])
    if (summaryError || flagsError) return res.status(500).json({ success: false, error: (summaryError ?? flagsError)?.message })
    return res.status(200).json({ success: true, configured: isPatrolConfigured(), scheduled: Boolean(process.env.CRON_SECRET?.trim()), summary, flags: flags ?? [] })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const action = req.body?.action
  if (action === 'run') {
    const result = await runPatrol({ limit: 30, budgetMs: 45_000 })
    return res.status(200).json({ success: true, result })
  }

  const id = typeof req.body?.id === 'string' ? req.body.id : ''
  if (!UUID.test(id) || !['dismiss', 'remove', 'ban'].includes(action)) return res.status(400).json({ success: false, error: 'Bad request' })
  const { error } = await supabase.rpc('admin_patrol_resolve', { flag: id, action, admin_id: adminId })
  if (error) return res.status(400).json({ success: false, error: error.message })
  return res.status(200).json({ success: true })
}
