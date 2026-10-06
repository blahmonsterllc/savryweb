// What the /recipes explorer needs from each recipe, and how it ranks them.
// Plain JS (with JSDoc types) so the Node test runner can import it directly.

/**
 * @typedef {{
 *   id: string, slug: string, title: string, description: string | null, imageUrl: string | null,
 *   authorName: string, publishedAt: string, totalTime: number, difficulty: string, category: string,
 *   cuisine: string | null, tags: string[], dietaryTags: string[], ingredientNames: string[],
 *   madeCount: number, commentCount: number, version: number, costPerServing: number | null,
 *   servingType: 'servings' | 'yields'
 * }} ExplorerRecipe
 */

/**
 * Only the fields the explorer shows, filters, searches or sorts on. The page
 * hands every public recipe to the browser, so whole recipes (steps,
 * quantities, nutrition, notes) made it close to a megabyte.
 *
 * @param {{ id: string, slug: string, title: string, description: string | null, imageUrl: string | null,
 *   authorName: string, publishedAt: string, totalTime: number, difficulty: string, category: string,
 *   cuisine: string | null, tags: string[], dietaryTags: string[], ingredients: { name: string }[],
 *   madeCount: number, commentCount: number, version: number, costPerServing: number | null,
 *   servingType: 'servings' | 'yields' }} recipe
 * @returns {ExplorerRecipe}
 */
export function explorerRecipe(recipe) {
  return {
    id: recipe.id,
    slug: recipe.slug,
    title: recipe.title,
    description: recipe.description,
    imageUrl: recipe.imageUrl,
    authorName: recipe.authorName,
    publishedAt: recipe.publishedAt,
    totalTime: recipe.totalTime,
    difficulty: recipe.difficulty,
    category: recipe.category,
    cuisine: recipe.cuisine,
    tags: recipe.tags,
    dietaryTags: recipe.dietaryTags,
    ingredientNames: recipe.ingredients.map((ingredient) => ingredient.name),
    madeCount: recipe.madeCount,
    commentCount: recipe.commentCount,
    version: recipe.version,
    costPerServing: recipe.costPerServing,
    servingType: recipe.servingType,
  }
}

/**
 * The per-meal cost the "Cheapest per serving" sort ranks by, or null when the
 * recipe should not be ranked on it.
 *
 * A "yields" recipe (24 cookies, 8 slices) stores the cost of one item, not
 * of a serving: a 9-cent cookie is not a cheaper meal than a $1.40 bowl of
 * soup, and the whole batch is not one serving either. There is no honest
 * per-meal figure for it, so it is left out of the ranking and listed after
 * the priced meals, with the recipes that have no price, in their usual order.
 *
 * @param {{ costPerServing?: number | null, servingType?: string }} recipe
 * @returns {number | null}
 */
export function mealCost(recipe) {
  if (recipe.servingType === 'yields') return null
  return typeof recipe.costPerServing === 'number' && Number.isFinite(recipe.costPerServing) ? recipe.costPerServing : null
}

/**
 * Sort comparator for "Cheapest per serving". Ties and unranked recipes
 * compare equal, so the stable sort keeps them in the order given.
 *
 * @param {{ costPerServing?: number | null, servingType?: string }} a
 * @param {{ costPerServing?: number | null, servingType?: string }} b
 */
export function compareCheapest(a, b) {
  const x = mealCost(a)
  const y = mealCost(b)
  if (x === null && y === null) return 0
  if (x === null) return 1
  if (y === null) return -1
  return x - y
}
