/**
 * The weekly email. Vercel Cron calls this on Sunday afternoon (vercel.json)
 * with `Authorization: Bearer <CRON_SECRET>`; nothing else may trigger it.
 * One run pages through every opted-in cook until it is done or close to the
 * function's time limit; Sunday's later runs (vercel.json) pick up anyone a
 * cut-off run left. Each cook gets at most one per week, so a re-run only
 * reaches whoever was missed.
 *
 * GET /api/cron/weekly-email → { configured, week, sent, skipped, failed, errors, complete }
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { createHash, timingSafeEqual } from 'node:crypto'
import { sendWeeklyDigests } from '@/lib/weekly-digest'

export const config = { maxDuration: 300 }
const SEND_WINDOW_MS = (300 - 60) * 1000

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

  // Stop starting new pages a minute before maxDuration, so a page in flight
  // (digests built, one Resend call, the send records) can finish.
  const result = await sendWeeklyDigests({ pageSize: 100, deadline: Date.now() + SEND_WINDOW_MS })
  return res.status(200).json(result)
}
