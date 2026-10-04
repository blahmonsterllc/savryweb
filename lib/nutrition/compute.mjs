// Nutrition per serving, calculated from a recipe's ingredient list and USDA
// FoodData Central (SR Legacy) values. Plain JS so the scripts, the site, and
// the Node test runner all use the same code.
//
// Inputs:
//   rules  content/nutrition/ingredient-rules.json   ingredient phrases -> USDA food + gram weights
//   foods  content/nutrition/usda-foods.json          per-100 g nutrients for every food the rules use
//
// What is counted: every ingredient as listed. Not counted: optional
// ingredients, anything listed "for serving", and water. Frying oil and salt
// for cooking water count only for the share that ends up in the food.

import { parseAmount } from '../scale-ingredients.mjs'

const GRAMS_PER = { lb: 453.59, oz: 28.35, g: 1, kg: 1000 }
const CUPS_PER = { cup: 1, tbsp: 1 / 16, tsp: 1 / 48, pint: 2, quart: 4, gallon: 16, floz: 1 / 8, ml: 1 / 236.588, l: 1000 / 236.588 }
// Every spelling a cook might type, mapped to the unit the tables above use.
const UNIT_ALIASES = {
  tablespoon: 'tbsp', tablespoons: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tbl: 'tbsp',
  teaspoon: 'tsp', teaspoons: 'tsp', tsps: 'tsp',
  cups: 'cup', c: 'cup', pints: 'pint', pt: 'pint', quarts: 'quart', qt: 'quart', gallons: 'gallon', gal: 'gallon',
  'fl oz': 'floz', 'fluid ounce': 'floz', 'fluid ounces': 'floz',
  milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml', mls: 'ml',
  liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  pound: 'lb', pounds: 'lb', lbs: 'lb', ounce: 'oz', ounces: 'oz',
  gram: 'g', grams: 'g', gm: 'g', gms: 'g', kilogram: 'kg', kilograms: 'kg', kgs: 'kg',
  cans: 'can', cloves: 'clove', pinches: 'pinch', sprigs: 'sprig', slices: 'slice', pieces: 'piece', bunches: 'bunch', dashes: 'dash',
  each: null, whole: null, ea: null,
}

/** The unit as the calculator knows it; null means "counted whole". */
export function normalizeUnit(raw) {
  const unit = String(raw ?? '').trim().toLowerCase().replace(/\.$/, '')
  if (!unit) return null
  if (unit in UNIT_ALIASES) return UNIT_ALIASES[unit]
  return unit
}
const SIZE_FACTOR = { small: 0.75, medium: 1, large: 1.3, 'extra-large': 1.5, jumbo: 1.6 }
const DEFAULT_UNIT_GRAMS = { pinch: 0.4, dash: 0.6 }
// Units that only say "one of these": "2 stalks celery", "1 head garlic".
const COUNT_WORDS = new Set(['stalk', 'rib', 'head', 'ear', 'fillet', 'breast', 'thigh', 'link', 'sheet', 'leaf', 'wedge', 'item'])
// Share of shallow-frying oil that ends up in the food.
const FRYING_ABSORPTION = 0.25
// Share of the salt in pasta or blanching water that the food takes up.
const COOKING_WATER_UPTAKE = 0.1
const WEIGHT_UNIT = { oz: 'oz', ounce: 'oz', ounces: 'oz', lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb' }

export const NUTRIENT_KEYS = ['calories', 'protein', 'carbohydrates', 'fat', 'saturatedFat', 'fiber', 'sugar', 'sodium', 'cholesterol']

/** Builds a resolver: ingredient name -> rule. Earliest phrase wins; ties go to the longest phrase. */
export function createMatcher(rules) {
  const compiled = []
  rules.forEach((rule, index) => {
    for (const phrase of rule.phrases ?? []) {
      const escaped = phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      compiled.push({ regex: new RegExp(`(?<![a-z])${escaped}(?:e?s)?(?![a-z])`), phrase, index })
    }
  })
  return function resolve(name) {
    const text = String(name ?? '').toLowerCase()
    let best = null
    for (const candidate of compiled) {
      const match = candidate.regex.exec(text)
      if (!match) continue
      if (!best || match.index < best.at || (match.index === best.at && candidate.phrase.length > best.phrase.length)) best = { at: match.index, phrase: candidate.phrase, index: candidate.index }
    }
    return best ? { rule: rules[best.index], phrase: best.phrase } : null
  }
}

/** The part of the name that describes the measured amount (drops ", plus more for dusting" and similar). */
function measuredPart(name) {
  return String(name ?? '').toLowerCase().split(/,?\s+plus\s|,?\s+or more\b/)[0]
}

/** Why an ingredient is left out of the calculation, or null when it counts. */
export function exclusionFor(ingredient) {
  if (ingredient.isOptional) return 'optional'
  const text = measuredPart(ingredient.name)
  if (/\b(for serving|to serve|for the table|for garnish|for garnishing)\b/.test(text)) return 'for serving'
  // "salt and pepper", "salt, to taste": seasoning with no amount is not a measurable ingredient.
  if (!String(ingredient.amount ?? '').trim() && /^(?:(?:fine |kosher |sea |flaky |table )?salt(?: and (?:black |ground )?pepper)?|(?:black |ground |white )?pepper|salt and pepper)(?:,? to taste)?$|\bto taste\b/.test(text)) return 'to taste'
  return null
}

/** Only a share of some ingredients is eaten: frying oil, salt for cooking water. */
function shareEaten(name) {
  const text = measuredPart(name)
  if (/\bfor (?:deep[- ])?frying\b/.test(text)) return { share: FRYING_ABSORPTION, why: `${FRYING_ABSORPTION * 100}% absorbed in frying` }
  if (/\bfor the [a-z ]*water\b/.test(text)) return { share: COOKING_WATER_UPTAKE, why: `${COOKING_WATER_UPTAKE * 100}% taken up from the cooking water` }
  return { share: 1, why: '' }
}

/**
 * Grams of one ingredient line as it goes into the dish.
 * @returns {{ grams: number, basis: string } | null} null when the weight cannot be worked out
 */
export function gramsFor(ingredient, rule) {
  const name = String(ingredient.name ?? '').toLowerCase()
  // Some recipe editors put the size in the unit box: amount 1, unit "large", name "yellow onion".
  const rawUnit = String(ingredient.unit ?? '').trim().toLowerCase()
  const unitSize = SIZE_FACTOR[rawUnit] !== undefined ? rawUnit : null
  const unit = unitSize ? null : normalizeUnit(ingredient.unit)
  const parsed = parseAmount(ingredient.amount)
  const amount = parsed ? (parsed.high === null ? parsed.low : (parsed.low + parsed.high) / 2) : null
  // As bought -> as eaten: bones and trimmings always, peel only when the recipe peels it.
  const edible = (typeof rule.edible === 'number' ? rule.edible : 1) * (typeof rule.peeled === 'number' && /\bpeeled\b/.test(name) ? rule.peeled : 1)
  const eaten = shareEaten(name)
  const done = (grams, basis) => (Number.isFinite(grams) && grams > 0 ? { grams: grams * eaten.share, basis: eaten.share === 1 ? basis : `${basis}, ${eaten.why}` } : null)

  // 1. The recipe states the weight: "all-purpose flour (315 g)".
  const stated = name.match(/\((?:about |approx\.? )?(\d+(?:\.\d+)?)\s*g(?: each)?\b/)
  if (stated) {
    const each = /g each\b/.test(stated[0])
    if (!each) return done(Number(stated[1]), 'weight stated in the recipe')
    if (amount !== null) return done(Number(stated[1]) * amount, 'weight stated in the recipe')
  }
  if (amount === null) return null

  // 2. Measured by weight.
  if (unit && GRAMS_PER[unit]) return done(amount * GRAMS_PER[unit] * edible, 'measured by weight')

  // 3. A size given in the name: "(15 oz)", "(about 10 oz each)", "(about 1 1/4 lb)", "28 ounces".
  const sized = name.match(/\((?:about |approx\.? )?(\d+(?:\.\d+)?(?: \d+\/\d+)?|\d+\/\d+)(?:\s*-\s*|\s+)?(oz|ounces?|lbs?|pounds?)\b([^)]*)\)/) ?? (unit === 'can' ? name.match(/(\d+(?:\.\d+)?)(?:\s*-\s*|\s+)?(oz|ounces?)\b()/) : null)
  const sizedAmount = sized ? parseAmount(sized[1])?.low : null
  const isVolume = Boolean(unit && CUPS_PER[unit])
  if (unit === 'can') {
    const drained = /(?<!un)drained/.test(name)
    if (drained && rule.drainedCan) {
      // The drained share of a can stays the same whatever the can size.
      const scale = sizedAmount ? sizedAmount / rule.drainedCan.ofOz : 1
      return done(amount * rule.drainedCan.grams * scale, 'drained can')
    }
    if (sizedAmount) {
      // Liquids are labelled in fluid ounces, eight to the cup.
      if (rule.fluidCan && rule.cupGrams) return done(amount * sizedAmount * (rule.cupGrams / 8), 'can size in fluid ounces, stated in the recipe')
      return done(amount * sizedAmount * GRAMS_PER.oz, 'can size stated in the recipe')
    }
    return rule.unitGrams?.can ? done(amount * rule.unitGrams.can, `${rule.unitGrams.can} g per can`) : null
  }
  if (sizedAmount && !isVolume) {
    const weight = sizedAmount * GRAMS_PER[WEIGHT_UNIT[sized[2]]]
    // "(about 10 oz each)" is per item; "(about 2 lb)" is the whole line.
    const perItem = /\beach\b/.test(sized[3])
    return done((perItem ? amount * weight : weight) * edible, 'weight stated in the recipe')
  }

  // 4. Measured by volume.
  if (isVolume) return rule.cupGrams ? done(amount * CUPS_PER[unit] * rule.cupGrams, `${rule.cupGrams} g per cup`) : null

  // 5. A named unit: clove, slice, sprig, bunch, piece, pinch.
  if (unit) {
    const single = unit === 'leaves' ? 'leaf' : unit.replace(/s$/, '')
    const per = rule.unitGrams?.[unit] ?? rule.unitGrams?.[single] ?? DEFAULT_UNIT_GRAMS[unit] ?? DEFAULT_UNIT_GRAMS[single]
    if (per) return done(amount * per * edible, `${per} g per ${single}`)
    // "2 stalks celery" with no stalk weight on file is still two whole items.
    if (!(COUNT_WORDS.has(single) && rule.eachGrams)) return null
  }

  // 6. Counted whole: "2 carrots", "1 large yellow onion".
  if (!rule.eachGrams) return null
  const size = rule.fixedSize ? null : (unitSize ?? (measuredPart(name).split(/[,(]/)[0].match(/\b(small|medium|large|extra-large|jumbo)\b/) ?? [])[1])
  return done(amount * rule.eachGrams * (size ? SIZE_FACTOR[size] : 1) * edible, `${rule.eachGrams} g each${size && size !== 'medium' ? `, ${size}` : ''}`)
}

/**
 * @param {{ servings: number, ingredients: { name: string, amount: string | null, unit: string | null, isOptional?: boolean }[] }} recipe
 * @param {{ rules: object[], foods: Record<string, object>, resolve?: Function }} reference
 */
export function computeRecipeNutrition(recipe, reference) {
  const resolve = reference.resolve ?? createMatcher(reference.rules)
  const totals = Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, 0]))
  let totalGrams = 0
  let counted = 0
  let missed = 0
  const lines = []

  for (const ingredient of recipe.ingredients) {
    const line = { name: ingredient.name, amount: ingredient.amount ?? null, unit: ingredient.unit ?? null, status: 'counted', fdcId: null, grams: null, detail: '' }
    lines.push(line)
    const excluded = exclusionFor(ingredient)
    if (excluded) { line.status = 'excluded'; line.detail = excluded; continue }
    const hit = resolve(ingredient.name)
    if (!hit) { line.status = 'unmatched'; missed += 1; continue }
    if (hit.rule.skip) { line.status = 'skipped'; line.detail = 'no nutrition'; continue }
    const food = reference.foods[String(hit.rule.fdcId)]
    line.fdcId = hit.rule.fdcId
    if (!food) { line.status = 'unmatched'; line.detail = 'food missing from the reference'; missed += 1; continue }
    const weight = gramsFor(ingredient, hit.rule)
    if (!weight) { line.status = 'unweighed'; missed += 1; continue }
    line.grams = Math.round(weight.grams * 10) / 10
    line.detail = `${food.description}; ${weight.basis}`
    counted += 1
    totalGrams += weight.grams
    // A rule may correct single values the USDA stand-in gets wrong (see its `basis`).
    const per100g = hit.rule.per100g ? { ...food.per100g, ...hit.rule.per100g } : food.per100g
    for (const key of NUTRIENT_KEYS) totals[key] += ((per100g[key] ?? 0) * weight.grams) / 100
  }

  const servings = Math.max(1, Number(recipe.servings) || 1)
  const perServing = Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, Math.round(totals[key] / servings)]))
  const coverage = counted + missed === 0 ? 0 : counted / (counted + missed)
  return { perServing, servingGrams: Math.round(totalGrams / servings), coverage: Math.round(coverage * 10000) / 10000, counted, missed, lines }
}
