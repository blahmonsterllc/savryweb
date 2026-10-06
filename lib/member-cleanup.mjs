// Pure helpers for the member routes that delete things and refresh cached
// pages. Kept free of Supabase and Next so the rules can be tested directly.

/**
 * The storage paths from `paths` that sit in this member's own folder of the
 * recipe-images bucket (`<userId>/...`, the folder the upload policy confines
 * them to). Anything else, including traversal tricks, is dropped, so a
 * cleanup can never reach another member's photos.
 *
 * @param {string} userId
 * @param {Iterable<unknown>} paths
 * @returns {string[]}
 */
export function ownPhotoPaths(userId, paths) {
  if (typeof userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(userId)) return []
  const prefix = `${userId}/`
  const kept = new Set()
  for (const path of paths) {
    if (typeof path !== 'string') continue
    if (!path.startsWith(prefix) || path.length === prefix.length) continue
    if (path.includes('..') || path.includes('\\') || path.includes('//')) continue
    kept.add(path)
  }
  return [...kept]
}

/**
 * The cached pages that show a recipe: its own page, the recipe list, the
 * home page, and its cook's page when the cook has one.
 *
 * @param {{ slug?: string | null, username?: string | null }} recipe
 * @returns {string[]}
 */
export function recipePagePaths({ slug, username }) {
  const paths = ['/recipes', '/']
  if (typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) paths.unshift(`/recipes/${slug}`)
  if (typeof username === 'string' && /^[A-Za-z0-9._-]{1,40}$/.test(username)) paths.push(`/cooks/${username.toLowerCase()}`)
  return paths
}
