/** GET /api/admin/stats → overview numbers from admin_stats(). Admin-only via middleware.ts. */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  const { data, error } = await getSupabaseAdmin().rpc('admin_stats')
  if (error) return res.status(500).json({ success: false, error: error.message })
  return res.status(200).json({ success: true, stats: data })
}
