/**
 * Re-prices every recipe from the price table this deploy carries, after the
 * monthly BLS refresh (.github/workflows/bls-prices.yml) lands. Vercel Cron
 * calls this monthly (vercel.json) with `Authorization: Bearer <CRON_SECRET>`;
 * nothing else may trigger it. Only recipes whose cost changed are written;
 * a recipe below 95% priced coverage is left as it is, as scripts/cost/apply.mjs does.
 *
 * GET /api/cron/recost → { recipes, updated, belowCoverage, asOf }
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { createHash, timingSafeEqual } from 'node:crypto'
import rules from '@/content/nutrition/ingredient-rules.json'
import priceFile from '@/content/cost/food-prices.json'
import { createMatcher } from '@/lib/nutrition/compute.mjs'
import { computeRecipeCost } from '@/lib/cost/compute.mjs'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const config = { maxDuration: 120 }

const MIN_COVERAGE = 0.95
const PAGE = 500

function sameSecret(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

type Row = { id: string; servings: number; cost_per_serving: number | null; recipe_ingredients: { position: number; name: string; amount: string | null; unit: string | null; is_optional: boolean }[] }

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

  const ruleList = rules as object[]
  const reference = { rules: ruleList, prices: priceFile.prices as Record<string, { perKg: number }>, resolve: createMatcher(ruleList) }
  const supabase = getSupabaseAdmin()
  let recipes = 0
  let updated = 0
  let belowCoverage = 0
  try {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, servings, cost_per_serving, recipe_ingredients(position, name, amount, unit, is_optional)')
        .order('id')
        .range(from, from + PAGE - 1)
      if (error) throw error
      const rows = (data ?? []) as Row[]
      for (const row of rows) {
        recipes += 1
        const ingredients = [...row.recipe_ingredients].sort((a, b) => a.position - b.position).map((i) => ({ name: i.name, amount: i.amount, unit: i.unit, isOptional: i.is_optional }))
        const result = computeRecipeCost({ servings: row.servings, ingredients }, reference)
        if (result.coverage < MIN_COVERAGE) { belowCoverage += 1; continue }
        if (row.cost_per_serving !== null && Number(row.cost_per_serving) === result.perServing) continue
        const { error: updateError } = await supabase.from('recipes').update({ cost_per_serving: result.perServing, cost_coverage: result.coverage, cost_source: 'savry_price_table' }).eq('id', row.id)
        if (updateError) throw updateError
        updated += 1
      }
      if (rows.length < PAGE) break
    }
  } catch (error: any) {
    console.error('[cron/recost]', error?.message ?? error)
    return res.status(500).json({ error: 'Could not re-price recipes', recipes, updated })
  }
  return res.status(200).json({ recipes, updated, belowCoverage, asOf: (priceFile as { asOf?: string }).asOf ?? null })
}
