/**
 * The weekly email. Vercel Cron calls this on Sunday afternoon (vercel.json)
 * with `Authorization: Bearer <CRON_SECRET>`; nothing else may trigger it.
 * Each cook gets at most one per week, so a re-run only reaches whoever was
 * missed.
 *
 * GET /api/cron/weekly-email → { configured, week, sent, skipped, failed, errors }
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { createHash, timingSafeEqual } from 'node:crypto'
import { sendWeeklyDigests } from '@/lib/weekly-digest'

export const config = { maxDuration: 300 }

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

  // Up to 300 cooks per run; the cron re-runs reach the rest.
  const result = await sendWeeklyDigests({ limit: 300 })
  return res.status(200).json(result)
}
