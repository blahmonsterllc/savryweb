// Puts the recipes that fit a cook's onboarding picks (favourite cuisines,
// how they eat) first, without hiding any. Plain JS so the Node test runner
// can import it directly.

/**
 * Stable: recipes that fit equally keep the order they came in (popular first).
 * A recipe that is tagged with every diet the cook picked counts most; one in
 * a picked cuisine counts next. With no picks the order is unchanged.
 *
 * @template {{ cuisine?: string | null, category?: string | null, dietaryTags?: string[] | null }} R
 * @param {R[]} recipes
 * @param {{ cuisines?: string[], diets?: string[] }} picks
 * @returns {R[]}
 */
export function orderByTaste(recipes, picks) {
  const cuisines = (picks.cuisines ?? []).map((c) => c.trim().toLowerCase()).filter(Boolean)
  const diets = (picks.diets ?? []).map((d) => d.trim().toLowerCase()).filter(Boolean)
  if (!cuisines.length && !diets.length) return [...recipes]
  const score = (recipe) => {
    const tags = (recipe.dietaryTags ?? []).map((t) => String(t).toLowerCase())
    const cuisine = String(recipe.cuisine ?? '').toLowerCase()
    const fitsDiet = diets.length > 0 && diets.every((d) => tags.includes(d))
    const fitsCuisine = cuisine !== '' && cuisines.some((c) => cuisine.includes(c) || c.includes(cuisine))
    return (fitsDiet ? 2 : 0) + (fitsCuisine ? 1 : 0)
  }
  return recipes.map((recipe, index) => ({ recipe, index, score: score(recipe) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.recipe)
}
