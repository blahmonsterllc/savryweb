#!/usr/bin/env node
/**
 * Refreshes Savry's grocery price table from the Bureau of Labor Statistics
 * average retail prices (US city average), for every food BLS tracks.
 *
 *   node scripts/cost/refresh-bls.mjs [--dry-run]
 *
 * Writes content/cost/food-prices.json: each mapped food gets the latest BLS
 * month converted to US dollars per kilogram as bought, with the series and
 * month recorded. Foods BLS does not track keep their shelf estimate (basis
 * "est"). Run it monthly, then node scripts/nutrition/sync-ios.mjs and
 * node scripts/cost/apply.mjs --project-ref <ref>.
 *
 * Public API, no key needed (25 series per request).
 *
 * Guarded so a bad month cannot reach every recipe and phone: the newest
 * point is chosen by date, not by position; a price must be between $0.05
 * and $500 a kilogram; and a move of more than 40% from the price already in
 * the table stops the run (the workflow then fails and emails the owner).
 * Pass --accept-large-moves after checking a real jump by hand.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const LB = 0.45359

/**
 * BLS series → Savry foods. `kgPerUnit` is how many kilograms the BLS unit
 * holds; `factor` turns the BLS item into the Savry food when they differ.
 */
export const BLS_SERIES = [
  { series: 'APU0000FS1101', item: 'Butter, salted, grade AA, stick, per lb', kgPerUnit: LB, foods: [173430, 173410] },
  { series: 'APU0000708111', item: 'Eggs, grade A, large, per doz.', kgPerUnit: 0.6, foods: [171287] },
  { series: 'APU0000709112', item: 'Milk, fresh, whole, fortified, per gal.', kgPerUnit: 3.9, foods: [171265] },
  { series: 'APU0000701111', item: 'Flour, white, all purpose, per lb', kgPerUnit: LB, foods: [168894] },
  { series: 'APU0000715211', item: 'Sugar, white, all sizes, per lb', kgPerUnit: LB, foods: [169655] },
  { series: 'APU0000706111', item: 'Chicken, fresh, whole, per lb', kgPerUnit: LB, foods: [171447] },
  { series: 'APU0000FF1101', item: 'Chicken breast, boneless, per lb', kgPerUnit: LB, foods: [171077] },
  { series: 'APU0000706212', item: 'Chicken legs, bone-in, per lb', kgPerUnit: LB, foods: [172378] },
  { series: 'APU0000703112', item: 'Ground beef, 100% beef, per lb', kgPerUnit: LB, foods: [174036] },
  { series: 'APU0000704111', item: 'Bacon, sliced, per lb', kgPerUnit: LB, foods: [168277] },
  { series: 'APU0000704211', item: 'Chops, center cut, bone-in, per lb', kgPerUnit: LB, foods: [168242] },
  { series: 'APU0000710212', item: 'Cheddar cheese, natural, per lb', kgPerUnit: LB, foods: [173414] },
  { series: 'APU0000701312', item: 'Rice, white, long grain, uncooked, per lb', kgPerUnit: LB, foods: [168877] },
  { series: 'APU0000712112', item: 'Potatoes, white, per lb', kgPerUnit: LB, foods: [170027] },
  { series: 'APU0000712311', item: 'Tomatoes, field grown, per lb', kgPerUnit: LB, foods: [170457] },
  { series: 'APU0000711211', item: 'Bananas, per lb', kgPerUnit: LB, foods: [173944] },
  { series: 'APU0000712211', item: 'Lettuce, iceberg, per lb', kgPerUnit: LB, foods: [169248] },
  // A lemon is about 108 g and gives about 48 g of juice.
  { series: 'APU0000711412', item: 'Lemons, per lb', kgPerUnit: LB, factor: 108 / 48, foods: [167747] },
]

async function fetchLatest(seriesIds) {
  const year = new Date().getFullYear()
  const response = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seriesid: seriesIds, startyear: String(year - 1), endyear: String(year), ...(process.env.BLS_API_KEY ? { registrationkey: process.env.BLS_API_KEY } : {}) }),
  })
  const body = await response.json()
  if (body.status !== 'REQUEST_SUCCEEDED') throw new Error(`BLS: ${body.status} ${(body.message ?? []).join(' ')}`)
  const latest = {}
  for (const series of body.Results.series) {
    // Monthly points only (M01..M12; M13 is an annual average), newest first by date.
    const points = series.data
      .filter((p) => /^M(0[1-9]|1[0-2])$/.test(p.period) && Number.isFinite(Number(p.value)) && Number(p.value) > 0)
      .sort((a, b) => `${b.year}${b.period}`.localeCompare(`${a.year}${a.period}`))
    const point = points[0]
    if (point) latest[series.seriesID] = { value: Number(point.value), period: `${point.year}-${point.period.replace('M', '')}` }
  }
  return latest
}

async function main() {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
  const file = path.join(root, 'content/cost/food-prices.json')
  const table = JSON.parse(await readFile(file, 'utf8'))
  const latest = await fetchLatest(BLS_SERIES.map((s) => s.series))

  const mapped = new Set()
  const changes = []
  const problems = []
  const acceptLargeMoves = process.argv.includes('--accept-large-moves')
  for (const entry of BLS_SERIES) {
    const point = latest[entry.series]
    if (!point) { console.log(`  no recent data for ${entry.series} (${entry.item}); left as it was`); continue }
    const perKg = Math.round((point.value / entry.kgPerUnit) * (entry.factor ?? 1) * 100) / 100
    for (const food of entry.foods) {
      const id = String(food)
      if (!table.prices[id]) throw new Error(`BLS map names food ${id}, which is not in the price table`)
      if (!Number.isFinite(perKg) || perKg < 0.05 || perKg > 500) { problems.push(`${id} ${entry.item}: $${perKg}/kg is outside $0.05–$500`); continue }
      const was = table.prices[id].perKg
      if (!acceptLargeMoves && Number.isFinite(was) && was > 0 && Math.abs(perKg - was) / was > 0.4) { problems.push(`${id} ${entry.item}: $${was}/kg → $${perKg}/kg is a ${Math.round((perKg / was - 1) * 100)}% move`); continue }
      mapped.add(id)
      const before = table.prices[id].perKg
      table.prices[id] = { ...table.prices[id], perKg, basis: 'bls', blsSeries: entry.series, blsPeriod: point.period }
      changes.push({ id, item: entry.item, before, after: perKg, period: point.period })
    }
  }
  // A food is only "bls" if this run priced it from BLS.
  for (const [id, price] of Object.entries(table.prices)) {
    if (price.basis === 'bls' && !mapped.has(id)) {
      table.prices[id] = { perKg: price.perKg, basis: 'est', description: price.description }
    }
  }
  if (problems.length > 0) {
    for (const problem of problems) console.error(`  REFUSED ${problem}`)
    throw new Error(`${problems.length} price(s) failed the plausibility check; nothing written. Check them on data.bls.gov, then rerun with --accept-large-moves if they are real.`)
  }
  const periods = [...new Set(changes.map((c) => c.period))].sort()
  table.asOf = periods.at(-1) ?? table.asOf
  table.basis.bls = 'BLS average retail price, US city average, latest month (series and month on each food)'

  for (const c of changes) console.log(`${c.id.padEnd(7)} ${('$' + (c.before * LB).toFixed(2)).padStart(7)} → ${('$' + (c.after * LB).toFixed(2)).padStart(7)} /lb  ${c.period}  ${c.item}`)
  if (process.argv.includes('--dry-run')) { console.log('dry run, nothing written'); return }
  await writeFile(file, JSON.stringify(table, null, 1) + '\n')
  console.log(`${changes.length} foods priced from BLS, as of ${table.asOf}`)
}

main().catch((error) => { console.error(error.message ?? error); process.exit(1) })
