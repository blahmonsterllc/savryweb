/**
 * The weekly email, for the admin's own account. Admin-only via middleware
 * and requireAdmin.
 *
 * GET  /api/admin/digest-preview            renders this week's email as HTML
 * GET  /api/admin/digest-preview?dry=1      what a cron run would do right now, without sending
 * POST /api/admin/digest-preview            sends the admin a test copy
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/admin-session'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { buildDigest, hasContent, isEmailConfigured, renderDigest, sendTestDigest, sendWeeklyDigests, unsubscribeLink } from '@/lib/weekly-digest'

export const config = { maxDuration: 60 }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminId = await requireAdmin(req, res)
  if (!adminId) return
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  const supabase = getSupabaseAdmin()
  const { data: profile } = await supabase.from('profiles').select('email_token').eq('id', adminId).maybeSingle()
  const token = (profile?.email_token as string | undefined) ?? '00000000-0000-0000-0000-000000000000'

  if (req.method === 'GET') {
    if (req.query.dry === '1') return res.status(200).json(await sendWeeklyDigests({ dryRun: true, limit: 500 }))
    const digest = await buildDigest(adminId, new Date(Date.now() - 7 * 86_400_000))
    if (!digest) return res.status(404).json({ error: 'No profile' })
    const message = renderDigest(digest, unsubscribeLink(token))
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    const banner = `<div style="background:#101d2f;color:#f7f2e8;padding:10px 16px;font:600 13px -apple-system,sans-serif">Preview · subject: ${message.subject.replace(/</g, '&lt;')} · ${hasContent(digest) ? 'would send' : 'quiet week: would be skipped'} · Resend ${isEmailConfigured() ? 'configured' : 'not configured'}</div>`
    return res.status(200).send(banner + message.html)
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { data: user } = await supabase.auth.admin.getUserById(adminId)
  const to = user?.user?.email
  if (!to) return res.status(400).json({ ok: false, error: 'Your account has no email address' })
  const sent = await sendTestDigest(adminId, to, token)
  return res.status(sent.ok ? 200 : 502).json(sent)
}
