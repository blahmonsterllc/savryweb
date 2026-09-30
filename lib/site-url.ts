/**
 * Canonical public base URL for absolute links (JSON-LD, Open Graph, the URLs
 * we hand back to the iOS app). www.savry.io is the live domain; set NEXT_PUBLIC_SITE_URL
 * only to override it (previews, local dev).
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.savry.io').replace(/\/$/, '')

export const APP_STORE_URL = 'https://apps.apple.com/app/savry'

/** Custom URL scheme registered by the iOS app (Info.plist CFBundleURLSchemes). */
export const APP_URL_SCHEME = 'foodprep'

export function recipePageURL(slug: string): string {
  return `${SITE_URL}/recipes/${slug}`
}

/** Deep link that makes the iOS app import a recipe page. */
export function openInSavryURL(pageURL: string): string {
  return `${APP_URL_SCHEME}://import?url=${encodeURIComponent(pageURL)}`
}
