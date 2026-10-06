// Allergen detection for recipe pages: the same rules as the Savry app's
// AllergenSafetyService (whiskit/Services/AllergenSafetyService.swift).
// Change both together. It flags possible allergens from ingredient names
// and the recipe's own labels; it never says a recipe is safe.

const WHEAT = [
  'wheat', 'flour', 'all purpose flour', 'bread flour', 'cake flour', 'pastry flour',
  'durum', 'semolina', 'farro', 'spelt', 'bulgur', 'couscous', 'seitan',
  'pasta', 'bread', 'panko', 'breadcrumbs', 'bread crumbs', 'noodles',
]

const WHEAT_FREE_LOOKALIKES = [
  'almond flour', 'coconut flour', 'rice flour', 'oat flour', 'chickpea flour',
  'corn flour', 'cornflour', 'buckwheat flour', 'tapioca flour', 'cassava flour',
  'potato flour', 'gluten free flour', 'gluten free pasta', 'gluten free bread',
  'gluten free noodles', 'rice noodles', 'glass noodles', 'cornbread', 'corn bread',
]

/** @type {Record<string, string[]>} */
const ALIASES = {
  Milk: [
    'milk', 'butter', 'buttermilk', 'cheese', 'cream', 'creme fraiche',
    'whey', 'casein', 'caseinate', 'yogurt', 'yoghurt', 'ghee', 'half and half',
    'parmesan', 'parmigiano', 'mozzarella', 'cheddar', 'ricotta', 'mascarpone',
  ],
  Eggs: ['egg', 'eggs', 'egg white', 'egg whites', 'egg yolk', 'egg yolks', 'mayonnaise', 'mayo', 'meringue', 'albumen'],
  Fish: [
    'fish', 'anchovy', 'anchovies', 'bass', 'cod', 'haddock', 'halibut', 'salmon', 'sardine', 'sardines',
    'tilapia', 'trout', 'tuna', 'fish sauce', 'worcestershire sauce',
  ],
  Shellfish: [
    'shellfish', 'shrimp', 'prawn', 'prawns', 'crab', 'crabmeat', 'lobster', 'crayfish', 'crawfish',
    'scallop', 'scallops', 'clam', 'clams', 'mussel', 'mussels', 'oyster', 'oysters',
  ],
  'Tree nuts': [
    'almond', 'almonds', 'brazil nut', 'brazil nuts', 'cashew', 'cashews',
    'hazelnut', 'hazelnuts', 'filbert', 'filberts', 'macadamia', 'pecan', 'pecans', 'pistachio',
    'pistachios', 'walnut', 'walnuts', 'pine nut', 'pine nuts', 'chestnut', 'chestnuts',
    'marzipan', 'praline', 'pralines', 'nougat', 'gianduja', 'nutella', 'frangelico',
    'amaretto', 'amaretti', 'macaron', 'macarons', 'baklava', 'pesto', 'almond extract',
    'nut', 'nuts', 'mixed nuts', 'nut butter', 'nut flour', 'nut meal', 'nut milk',
  ],
  Peanuts: ['peanut', 'peanuts', 'groundnut', 'groundnuts'],
  Wheat: WHEAT,
  Soy: ['soy', 'soya', 'soybean', 'soybeans', 'edamame', 'tofu', 'tempeh', 'miso', 'tamari', 'soy sauce', 'textured vegetable protein'],
  Sesame: ['sesame', 'tahini', 'benne'],
}

/** The recipe's own labels ("dairy", "tree nut", "egg") mapped to these names. */
const LABELS = {
  milk: 'Milk', dairy: 'Milk', eggs: 'Eggs', egg: 'Eggs', fish: 'Fish',
  shellfish: 'Shellfish', 'crustacean shellfish': 'Shellfish',
  'tree nuts': 'Tree nuts', 'tree nut': 'Tree nuts', peanuts: 'Peanuts', peanut: 'Peanuts',
  wheat: 'Wheat', gluten: 'Wheat', soy: 'Soy', sesame: 'Sesame',
}

/** @param {string} value */
export function normalized(value) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** @param {string} text @param {string} phrase */
const containsPhrase = (text, phrase) => phrase !== '' && ` ${text} `.includes(` ${phrase} `)

/** @param {string} text @param {string} allergen */
function matches(text, allergen) {
  let searchable = text
  /** @param {string[]} list */
  const remove = (list) => list.forEach((p) => { searchable = ` ${searchable} `.split(` ${normalized(p)} `).join('  ').trim() })
  if (allergen === 'Milk') {
    remove(['almond milk', 'cashew milk', 'coconut milk', 'oat milk', 'rice milk', 'soy milk',
      'almond butter', 'cashew butter', 'coconut butter', 'peanut butter', 'coconut cream', 'cream of coconut'])
  }
  if (allergen === 'Tree nuts') remove(['water chestnut', 'water chestnuts', 'tree nut free', 'nut free', 'peanut', 'peanuts'])
  if (allergen === 'Wheat') remove(WHEAT_FREE_LOOKALIKES)
  return ALIASES[allergen].some((alias) => containsPhrase(searchable, normalized(alias)))
}

/**
 * Possible allergens, in a fixed order, with the ingredient lines behind each.
 * @param {{ name: string, amount?: string | null, unit?: string | null }[]} ingredients
 * @param {string[]} [labels] the recipe's own allergen labels
 * @returns {{ allergen: string, lines: string[] }[]}
 */
export function detectAllergens(ingredients, labels = []) {
  /** @type {Map<string, string[]>} */
  const found = new Map()
  for (const label of labels) {
    const text = normalized(label)
    // "dairy", "tree nut", or a food the cook named ("hazelnuts").
    const named = LABELS[/** @type {keyof typeof LABELS} */ (text)]
    for (const allergen of named ? [named] : Object.keys(ALIASES).filter((a) => matches(text, a))) {
      if (!found.has(allergen)) found.set(allergen, [])
    }
  }
  for (const ingredient of ingredients) {
    const text = normalized(ingredient.name || '')
    for (const allergen of Object.keys(ALIASES)) {
      if (!matches(text, allergen)) continue
      const lines = found.get(allergen) ?? []
      lines.push(ingredient.name)
      found.set(allergen, lines)
    }
  }
  return Object.keys(ALIASES).filter((a) => found.has(a)).map((allergen) => ({ allergen, lines: found.get(allergen) ?? [] }))
}
