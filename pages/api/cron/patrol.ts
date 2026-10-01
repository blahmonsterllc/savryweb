/**
 * Scheduled patrol run. Vercel Cron calls this every 10 minutes (vercel.json)
 * with `Authorization: Bearer <CRON_SECRET>`; nothing else may trigger it.
 *
 * GET /api/cron/patrol → { configured, reviewed, flagged, errors, note? }
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { createHash, timingSafeEqual } from 'node:crypto'
import { runPatrol } from '@/lib/patrol'

export const config = { maxDuration: 60 }

function sameSecret(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return res.status(503).json({ configured: false, error: 'CRON_SECRET is not set' })
  const header = req.headers.authorization ?? ''
  if (!header.startsWith('Bearer ') || !sameSecret(header.slice(7), secret)) return res.status(401).json({ error: 'Unauthorized' })

  const result = await runPatrol()
  // Without a model key the run is a no-op, not a failure.
  return res.status(200).json(result)
}
