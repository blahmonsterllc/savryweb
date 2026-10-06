/**
 * For cached (ISR) pages that list data. When the database read fails while
 * a page is being refreshed, throwing makes Next keep serving the last good
 * copy instead of caching an empty one. During `next build` there is no last
 * copy, and one failed read should not fail a deploy, so the build gets
 * `fallback` and the page refreshes on its normal schedule.
 */
export function failOrFallback<T>(where: string, error: unknown, fallback: T): T {
  console.error(`${where}: failed to load`, error)
  if (process.env.NEXT_PHASE === 'phase-production-build') return fallback
  throw error instanceof Error ? error : new Error(`${where}: failed to load`)
}
