import 'server-only'

import type { NextApiRequest } from 'next'
import { getSupabaseAdmin } from './supabase/admin'
import { requestOrigin } from './admin-session'

type Entry = {
  targetType?: string
  targetId?: string | null
  /** Small facts about the change (what it became), never a whole payload. */
  detail?: Record<string, unknown>
}

/**
 * Writes one admin action to the append-only activity log (admin_log_action),
 * after the action has succeeded. The admin id is the one requireAdmin
 * verified; the database checks again that it belongs to an admin.
 * A failure to log is reported in the server log and does not undo the action.
 */
export async function logAdminAction(req: NextApiRequest, adminId: string, action: string, entry: Entry = {}): Promise<void> {
  const { ip, userAgent } = requestOrigin(req)
  try {
    const { error } = await getSupabaseAdmin().rpc('admin_log_action', {
      p_actor: adminId,
      p_action: action,
      p_target_type: entry.targetType ?? null,
      p_target_id: entry.targetId ?? null,
      p_detail: entry.detail ?? {},
      p_ip: ip,
      p_user_agent: userAgent,
    })
    if (error) console.error(`Admin activity log (${action}):`, error.message)
  } catch (error) {
    console.error(`Admin activity log (${action}):`, (error as Error).message)
  }
}
