/**
 * Kroger-family shelf prices sampled across regions in the last 45 days, in
 * aggregate: per food, the median US-equivalent price and how many states it
 * was seen in. Public, because it is a summary of public shelf prices; the
 * monthly refresh (scripts/cost/refresh-bls.mjs) reads it to calibrate the table.
 *
 * GET /api/prices/observations → { since, foods: { "<fdcId>": { medianPerKg, samples, states } } }
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { median } from '@/lib/cost/calibrate.mjs'

const WINDOW_DAYS = 45

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
  const rows: { fdc_id: number; national_per_kg: number | string; state: string }[] = []
  const supabase = getSupabaseAdmin()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('kroger_price_samples').select('fdc_id, national_per_kg, state').gte('sampled_on', since).range(from, from + 999)
    if (error) {
      console.error('[prices/observations]', error.message)
      res.setHeader('Cache-Control', 'no-store')
      return res.status(500).json({ error: 'Could not read observations' })
    }
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const byFood = new Map<number, { prices: number[]; states: Set<string> }>()
  for (const row of rows) {
    const entry = byFood.get(row.fdc_id) ?? { prices: [], states: new Set<string>() }
    entry.prices.push(Number(row.national_per_kg))
    entry.states.add(row.state)
    byFood.set(row.fdc_id, entry)
  }
  const foods: Record<string, { medianPerKg: number | null; samples: number; states: number }> = {}
  for (const [id, entry] of byFood) foods[String(id)] = { medianPerKg: median(entry.prices), samples: entry.prices.length, states: entry.states.size }
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400')
  return res.status(200).json({ since, foods })
}
