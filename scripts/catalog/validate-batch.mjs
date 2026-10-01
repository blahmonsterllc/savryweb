#!/usr/bin/env node
/**
 * Check Savry Kitchen recipe batches before they are seeded as drafts.
 *
 *   node scripts/catalog/validate-batch.mjs content/launch-catalog/batches/*.json
 *
 * Structural errors fail the run. Consistency findings (a "vegan" recipe with
 * butter, an allergen that is present but not listed) are also errors, because
 * dietary and allergen labels are safety information. Softer issues are
 * printed as warnings for the editor.
 */
import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import process from 'node:process'

const ROOT = resolve(import.meta.dirname, '../..')
const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Appetizer', 'Side Dish', 'Beverage', 'Other']
const DIFFICULTIES = ['Easy', 'Medium', 'Hard']
const DIETARY = ['vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'nut-free', 'egg-free']
const ALLERGENS = ['milk', 'eggs', 'wheat', 'soy', 'peanuts', 'tree nuts', 'fish', 'shellfish', 'sesame']
const UNITS = ['cup', 'tbsp', 'tsp', 'oz', 'lb', 'g', 'ml', 'clove', 'can', 'pinch', 'sprig', 'slice', 'piece', 'bunch', null]

// Ingredient words that imply an allergen or break a dietary claim. Phrases
// that negate them ("dairy-free", "gluten-free tamari", "coconut milk") are
// removed before matching.
const NEGATIONS = [
  /dairy-free [a-z ]+/g, /vegan [a-z ]+/g, /gluten-free [a-z -]+/g, /nut-free [a-z ]+/g, /egg-free [a-z ]+/g,
  /coconut (milk|cream|yogurt|oil|sugar|aminos|flakes|water)/g, /(oat|almond|soy|rice|cashew|plant|plant-based|non-dairy|unsweetened plant) (milk|yogurt|cream|butter)/g,
  /(peanut|almond|cashew|sunflower seed|sunflower|seed|cocoa|apple|pumpkin|nut) butter/g, /butter(nut| beans?| lettuce)/g, /cream of tartar/g,
  /eggplants?/g, /nutmeg/g, /water chestnuts?/g, /buckwheat/g, /nutritional yeast/g, /fish-free/g, /(vegetable|mushroom|chicken|beef) (broth|stock)/g,
]
const SIGNALS = {
  milk: /\b(butter|milk|cream|cheese|yogurt|ghee|parmesan|mozzarella|feta|ricotta|halloumi|cheddar|paneer|buttermilk|sour cream|mascarpone|whey|half-and-half|crema|queso|cotija|pecorino|gruyere|creme fraiche|condensed milk|evaporated milk)\b/,
  eggs: /\b(eggs?|egg yolks?|egg whites?|mayonnaise|mayo)\b/,
  wheat: /\b(flour|bread|breadcrumbs?|panko|pasta|spaghetti|penne|rigatoni|noodles?|tortillas?|pita|soy sauce|couscous|bulgur|farro|seitan|orzo|buns?|baguette|crackers?|semolina|udon|ramen|wonton|naan|hoisin|teriyaki)\b/,
  soy: /\b(soy sauce|tamari|tofu|miso|edamame|tempeh|soy|soybean|hoisin|teriyaki|gochujang|doubanjiang)\b/,
  peanuts: /\b(peanuts?|peanut butter|peanut oil)\b/,
  'tree nuts': /\b(almonds?|walnuts?|pecans?|cashews?|pistachios?|hazelnuts?|pine nuts?|macadamias?|almond flour|almond butter|almond milk|cashew butter|pesto)\b/,
  fish: /\b(salmon|cod|tuna|anchov(y|ies)|fish sauce|fish|halibut|tilapia|sardines?|trout|worcestershire|bonito|dashi|mahi|snapper|haddock)\b/,
  shellfish: /\b(shrimp|prawns?|crab|lobster|mussels?|clams?|scallops?|oyster sauce|oysters?)\b/,
  sesame: /\b(sesame|tahini)\b/,
}
const MEAT = /\b(chicken|beef|pork|lamb|turkey|bacon|sausage|ham|prosciutto|chorizo|pancetta|gelatin|lard|veal|duck)\b/
const HONEY = /\bhoney\b/

function clean(name) {
  let text = ` ${name.toLowerCase()} `
  for (const pattern of NEGATIONS) text = text.replace(pattern, ' ')
  // A bare "egg-free" / "dairy-free" qualifier is a negation, not the allergen.
  return text.replace(/\b(egg|dairy|gluten|nut|soy|fish|wheat|sesame)-free\b/g, ' ')
}

// Flours, noodles, and wrappers that are not wheat. Only applied when testing for wheat,
// so "almond flour" still counts as tree nuts.
const NOT_WHEAT = [
  /\b(almond|coconut|rice|oat|chickpea|tapioca|cassava|potato|corn|buckwheat|hazelnut|sorghum|teff|masa)\s+flour\b/g,
  /\bmasa harina\b/g, /\bcorn tortillas?\b/g, /\b(rice|glass|mung bean|sweet potato|kelp) noodles?\b/g, /\brice paper\b/g, /\bcornbread\b/g,
]
function withoutNonWheat(text) {
  let out = text
  for (const pattern of NOT_WHEAT) out = out.replace(pattern, ' ')
  return out
}

function checkRecipe(recipe, where, seenSlugs, errors, warnings) {
  const err = (message) => errors.push(`${where}: ${message}`)
  const warn = (message) => warnings.push(`${where}: ${message}`)

  for (const key of ['slug', 'title', 'description', 'prepTime', 'cookTime', 'servings', 'difficulty', 'category', 'cuisine', 'tags', 'dietaryTags', 'allergens', 'equipment', 'notes', 'ingredients', 'instructions']) {
    if (recipe[key] === undefined || recipe[key] === null || recipe[key] === '') err(`missing ${key}`)
  }
  if (errors.some((e) => e.startsWith(`${where}: missing`))) return

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(recipe.slug) || recipe.slug.length > 80) err(`bad slug "${recipe.slug}"`)
  if (seenSlugs.has(recipe.slug)) err(`duplicate slug "${recipe.slug}"`)
  seenSlugs.add(recipe.slug)
  if (recipe.title.length < 6 || recipe.title.length > 90) err('title length out of range')
  if (recipe.description.length < 40 || recipe.description.length > 260) warn(`description is ${recipe.description.length} chars`)
  if (/\b(best ever|ultimate|world's best|mouthwatering|to die for)\b/i.test(`${recipe.title} ${recipe.description}`)) warn('hype wording')
  for (const key of ['prepTime', 'cookTime', 'servings']) if (!Number.isInteger(recipe[key]) || recipe[key] < 0) err(`${key} must be a non-negative integer`)
  if (recipe.servings < 1 || recipe.servings > 60) err('servings out of range')
  if (recipe.prepTime + recipe.cookTime < 5) warn('total time under 5 minutes')
  if (!DIFFICULTIES.includes(recipe.difficulty)) err(`difficulty "${recipe.difficulty}"`)
  if (!CATEGORIES.includes(recipe.category)) err(`category "${recipe.category}"`)
  if (recipe.servingType !== undefined && recipe.servingType !== 'yields' && recipe.servingType !== 'servings') err('servingType must be "yields" or omitted')
  if (recipe.servingType === 'yields' && !recipe.yieldUnit) err('yields needs a yieldUnit')
  if (recipe.ovenTemp !== null && recipe.ovenTemp !== undefined && (!Number.isInteger(recipe.ovenTemp) || recipe.ovenTemp < 150 || recipe.ovenTemp > 550)) err(`ovenTemp ${recipe.ovenTemp}`)
  if (!Array.isArray(recipe.tags) || recipe.tags.length < 1 || recipe.tags.length > 6) err('tags must have 1 to 6 entries')
  for (const tag of recipe.dietaryTags) if (!DIETARY.includes(tag)) err(`unknown dietary tag "${tag}"`)
  for (const allergen of recipe.allergens) if (!ALLERGENS.includes(allergen)) err(`unknown allergen "${allergen}"`)

  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length < 4 || recipe.ingredients.length > 22) err(`ingredient count ${recipe.ingredients?.length}`)
  for (const [index, item] of recipe.ingredients.entries()) {
    if (!item.name || typeof item.name !== 'string') err(`ingredient ${index + 1} has no name`)
    if (item.amount !== null && item.amount !== undefined && !/^\d+( \d+\/\d+)?$|^\d+\/\d+$|^\d+(\.\d+)?$/.test(String(item.amount))) err(`ingredient "${item.name}" amount "${item.amount}"`)
    if (!UNITS.includes(item.unit ?? null)) err(`ingredient "${item.name}" unit "${item.unit}"`)
  }
  if (!Array.isArray(recipe.instructions) || recipe.instructions.length < 3 || recipe.instructions.length > 12) err(`step count ${recipe.instructions?.length}`)
  for (const [index, step] of recipe.instructions.entries()) {
    if (typeof step !== 'string' || step.length < 25) err(`step ${index + 1} is too short`)
    if (/^\s*(step\s*)?\d+[.):]/i.test(step)) err(`step ${index + 1} starts with a number`)
  }
  if (!/salt/i.test(recipe.ingredients.map((i) => i.name).join(' ')) && !['Beverage'].includes(recipe.category)) warn('no salt in the ingredient list')

  // Label consistency. Optional ingredients still count: the label must hold for the recipe as written.
  const names = recipe.ingredients.map((i) => clean(i.name))
  const all = names.join(' | ')
  const present = Object.entries(SIGNALS).filter(([allergen, pattern]) => pattern.test(allergen === 'wheat' ? withoutNonWheat(all) : all)).map(([allergen]) => allergen)
  for (const allergen of present) if (!recipe.allergens.includes(allergen)) err(`ingredients suggest "${allergen}" but it is not listed in allergens`)
  for (const allergen of recipe.allergens) if (!present.includes(allergen)) warn(`allergen "${allergen}" is listed but no ingredient obviously contains it`)

  const tags = new Set(recipe.dietaryTags)
  if (tags.has('vegan')) {
    for (const implied of ['vegetarian', 'dairy-free', 'egg-free']) if (!tags.has(implied)) warn(`vegan recipe should also carry "${implied}"`)
    if (present.includes('milk') || present.includes('eggs') || HONEY.test(all)) err('tagged vegan but contains dairy, eggs, or honey')
  }
  if ((tags.has('vegan') || tags.has('vegetarian')) && (MEAT.test(all) || present.includes('fish') || present.includes('shellfish'))) err('tagged vegetarian/vegan but contains meat or fish')
  if (tags.has('dairy-free') && present.includes('milk')) err('tagged dairy-free but contains dairy')
  if (tags.has('egg-free') && present.includes('eggs')) err('tagged egg-free but contains eggs')
  if (tags.has('gluten-free') && present.includes('wheat')) err('tagged gluten-free but an ingredient contains wheat (say "gluten-free" on it if it is)')
  if (tags.has('nut-free') && (present.includes('tree nuts') || present.includes('peanuts'))) err('tagged nut-free but contains nuts')
  if (tags.has('gluten-free') && /\boats?\b/.test(all) && !/certified gluten-free/i.test(recipe.ingredients.map((i) => i.name).join(' '))) warn('gluten-free recipe uses oats that are not marked certified gluten-free')

  // Food safety: meat and poultry recipes should state a safe temperature.
  const text = `${recipe.instructions.join(' ')} ${recipe.notes}`
  if (/\b(chicken|turkey)\b/.test(all) && !/165/.test(text)) warn('poultry recipe without the 165°F doneness temperature')
  if (/\bground (beef|pork|lamb)\b/.test(all) && !/160/.test(text)) warn('ground meat recipe without the 160°F doneness temperature')
}

async function main() {
  const files = process.argv.slice(2)
  if (!files.length) {
    console.error('usage: validate-batch.mjs <batch.json> [...]')
    process.exit(1)
  }
  const existing = JSON.parse(await readFile(resolve(ROOT, 'content/launch-catalog/savry-kitchen-recipes.json'), 'utf8'))
  const seenSlugs = new Set(existing.map((r) => r.slug))
  const seenTitles = new Set(existing.map((r) => r.title.toLowerCase()))
  const errors = []
  const warnings = []
  let total = 0
  for (const file of files) {
    let recipes
    try {
      recipes = JSON.parse(await readFile(file, 'utf8'))
    } catch (error) {
      errors.push(`${basename(file)}: not valid JSON (${error.message})`)
      continue
    }
    if (!Array.isArray(recipes)) {
      errors.push(`${basename(file)}: expected a JSON array`)
      continue
    }
    for (const recipe of recipes) {
      total += 1
      const where = `${basename(file)} › ${recipe.title ?? recipe.slug ?? '?'}`
      if (recipe.title && seenTitles.has(recipe.title.toLowerCase())) errors.push(`${where}: duplicate title`)
      if (recipe.title) seenTitles.add(recipe.title.toLowerCase())
      checkRecipe(recipe, where, seenSlugs, errors, warnings)
    }
  }
  for (const warning of warnings) console.log(`warn  ${warning}`)
  for (const error of errors) console.log(`ERROR ${error}`)
  console.log(`\n${total} recipes in ${files.length} file(s): ${errors.length} error(s), ${warnings.length} warning(s)`)
  process.exit(errors.length ? 1 : 0)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
