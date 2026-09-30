/**
 * Social networks a cook can list on their profile. Values are stored as bare
 * handles (validated in the database); these helpers turn them into links.
 */
export const SOCIAL_NETWORKS = [
  { key: 'instagram', label: 'Instagram', placeholder: 'yourname', url: (h: string) => `https://www.instagram.com/${h}` },
  { key: 'tiktok', label: 'TikTok', placeholder: 'yourname', url: (h: string) => `https://www.tiktok.com/@${h}` },
  { key: 'threads', label: 'Threads', placeholder: 'yourname', url: (h: string) => `https://www.threads.net/@${h}` },
  { key: 'x', label: 'X', placeholder: 'yourname', url: (h: string) => `https://x.com/${h}` },
  { key: 'youtube', label: 'YouTube', placeholder: 'yourchannel', url: (h: string) => `https://www.youtube.com/@${h}` },
  { key: 'pinterest', label: 'Pinterest', placeholder: 'yourname', url: (h: string) => `https://www.pinterest.com/${h}` },
  { key: 'facebook', label: 'Facebook', placeholder: 'yourpage', url: (h: string) => `https://www.facebook.com/${h}` },
  { key: 'website', label: 'Website', placeholder: 'https://', url: (h: string) => h },
] as const

export type SocialKey = (typeof SOCIAL_NETWORKS)[number]['key']

export function socialLinkURL(key: string, value: string): string | null {
  const network = SOCIAL_NETWORKS.find((n) => n.key === key)
  if (!network || !value) return null
  const url = network.url(value)
  return /^https:\/\//.test(url) ? url : null
}

/** Human label for a link, e.g. "@yourname on Threads" or the bare website host. */
export function socialLinkLabel(key: string, value: string): string {
  if (key === 'website') {
    try {
      return new URL(value).host.replace(/^www\./, '')
    } catch {
      return value
    }
  }
  const network = SOCIAL_NETWORKS.find((n) => n.key === key)
  return `@${value}${network ? ` on ${network.label}` : ''}`
}
