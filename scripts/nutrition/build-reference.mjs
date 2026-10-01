#!/usr/bin/env node
/**
 * Builds content/nutrition/usda-foods.json: per-100 g nutrients for every USDA
 * food that content/nutrition/ingredient-rules.json refers to.
 *
 * Source: USDA FoodData Central, SR Legacy (public domain). Download and unzip
 *   https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
 * then run
 *   node scripts/nutrition/build-reference.mjs --usda-dir <unzipped folder>
 *
 * Fails if a rule names an fdcId that is not in the dataset.
 */
import { createReadStream } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import path from 'node:path'
import process from 'node:process'

// FoodData Central nutrient ids.
const NUTRIENTS = { 1008: 'calories', 1003: 'protein', 1004: 'fat', 1005: 'carbohydrates', 1079: 'fiber', 2000: 'sugar', 1093: 'sodium', 1253: 'cholesterol', 1258: 'saturatedFat' }

function csvLine(line) {
  const cells = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i += 1 } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { cells.push(cell); cell = '' } else cell += ch
  }
  cells.push(cell)
  return cells
}

async function* rows(file) {
  const reader = createInterface({ input: createReadStream(file), crlfDelay: Infinity })
  let header = null
  for await (const line of reader) {
    if (!line) continue
    const cells = csvLine(line)
    if (!header) { header = cells; continue }
    yield Object.fromEntries(header.map((key, i) => [key, cells[i]]))
  }
}

async function main() {
  const at = process.argv.indexOf('--usda-dir')
  const dir = at > -1 ? process.argv[at + 1] : undefined
  if (!dir) { console.error('usage: build-reference.mjs --usda-dir <unzipped SR Legacy csv folder>'); process.exit(1) }
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
  const rules = JSON.parse(await readFile(path.join(root, 'content/nutrition/ingredient-rules.json'), 'utf8'))
  const wanted = new Set(rules.filter((rule) => !rule.skip).map((rule) => String(rule.fdcId)))

  const foods = {}
  for await (const row of rows(path.join(dir, 'food.csv'))) {
    if (wanted.has(row.fdc_id)) foods[row.fdc_id] = { description: row.description, per100g: {} }
  }
  const missing = [...wanted].filter((id) => !foods[id])
  if (missing.length) { console.error(`Not in SR Legacy: ${missing.join(', ')}`); process.exit(1) }

  for await (const row of rows(path.join(dir, 'food_nutrient.csv'))) {
    const key = NUTRIENTS[row.nutrient_id]
    if (key && foods[row.fdc_id]) foods[row.fdc_id].per100g[key] = Number(row.amount)
  }
  const noEnergy = Object.entries(foods).filter(([, food]) => typeof food.per100g.calories !== 'number').map(([id, food]) => `${id} ${food.description}`)
  if (noEnergy.length) { console.error(`No energy value for: ${noEnergy.join('; ')}`); process.exit(1) }

  const sorted = Object.fromEntries(Object.keys(foods).sort((a, b) => Number(a) - Number(b)).map((id) => [id, foods[id]]))
  const out = { source: 'USDA FoodData Central, SR Legacy (April 2018 release). Public domain.', unit: 'per 100 g; energy kcal; sodium and cholesterol mg; everything else g', foods: sorted }
  await writeFile(path.join(root, 'content/nutrition/usda-foods.json'), JSON.stringify(out, null, 1) + '\n')
  console.log(`${Object.keys(sorted).length} foods written to content/nutrition/usda-foods.json`)
}

main().catch((error) => { console.error(error.message); process.exit(1) })
