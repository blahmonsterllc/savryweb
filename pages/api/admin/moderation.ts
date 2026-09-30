/**
 * Admin moderation queue, backed by Supabase. middleware.ts restricts
 * /api/admin/* to the admin Google accounts; the service-role client is the
 * only caller allowed to run admin_moderation_queue / admin_moderate.
 *
 * GET  /api/admin/moderation                      open items, newest first
 * POST /api/admin/moderation  { id, action }      action: restore | remove | ban
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = getSupabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await supabase.rpc('admin_moderation_queue')
    if (error) return res.status(500).json({ success: false, error: error.message })
    return res.status(200).json({ success: true, items: data ?? [] })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const id = typeof req.body?.id === 'string' ? req.body.id : ''
  const action = req.body?.action
  if (!id || !['restore', 'remove', 'ban'].includes(action)) return res.status(400).json({ success: false, error: 'Bad request' })

  const { error } = await supabase.rpc('admin_moderate', { payload: { id, action } })
  if (error) return res.status(400).json({ success: false, error: error.message })
  return res.status(200).json({ success: true })
}
