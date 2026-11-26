/**
 * Visits to the public site over the last seven days, from Cloudflare Web
 * Analytics, for the admin overview. Admin-only via middleware.ts and requireAdmin.
 *
 * GET /api/admin/traffic → { configured, days, totals, topPages, topReferrers, topCountries, error? }
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/admin-session'
import { weeklyTraffic } from '@/lib/cloudflare-traffic'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminId = await requireAdmin(req, res)
  if (!adminId) return
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  return res.status(200).json(await weeklyTraffic())
}
