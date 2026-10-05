/**
 * Re-prices every recipe from the price table this deploy carries. Vercel
 * Cron calls this daily (vercel.json) with `Authorization: Bearer
 * <CRON_SECRET>`; nothing else may trigger it. That picks up the monthly BLS
 * refresh (.github/workflows/bls-prices.yml) and any recipe published from
 * the app since yesterday. Only recipes whose cost changed are written; one
 * that falls below 95% priced coverage has its cost cleared, not kept.
 *
 * GET /api/cron/recost → { recipes, updated, cleared, asOf }
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { createHash, timingSafeEqual } from 'node:crypto'
import priceFile from '@/content/cost/food-prices.json'
import { costColumns } from '@/lib/cost/recipe-cost'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const config = { maxDuration: 120 }

const PAGE = 500

function sameSecret(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

type Row = { id: string; servings: number; cost_per_serving: number | string | null; cost_coverage: number | string | null; recipe_ingredients: { position: number; name: string; amount: string | null; unit: string | null; is_optional: boolean }[] }

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

  const supabase = getSupabaseAdmin()
  let recipes = 0
  let updated = 0
  let cleared = 0
  try {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, servings, cost_per_serving, cost_coverage, recipe_ingredients(position, name, amount, unit, is_optional)')
        .order('id')
        .range(from, from + PAGE - 1)
      if (error) throw error
      const rows = (data ?? []) as Row[]
      for (const row of rows) {
        recipes += 1
        const next = costColumns(row.servings, row.recipe_ingredients ?? [])
        const was = row.cost_per_serving === null ? null : Number(row.cost_per_serving)
        if (was === next.cost_per_serving && Number(row.cost_coverage) === next.cost_coverage) continue
        const { error: updateError } = await supabase.from('recipes').update(next).eq('id', row.id)
        if (updateError) throw updateError
        if (next.cost_per_serving === null) cleared += 1
        else updated += 1
      }
      if (rows.length < PAGE) break
    }
  } catch (error: any) {
    console.error('[cron/recost]', error?.message ?? error)
    return res.status(500).json({ error: 'Could not re-price recipes', recipes, updated, cleared })
  }
  return res.status(200).json({ recipes, updated, cleared, asOf: (priceFile as { asOf?: string }).asOf ?? null })
}
