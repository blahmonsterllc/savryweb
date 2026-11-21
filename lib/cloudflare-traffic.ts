import 'server-only'

/**
 * Visit counts for /admin, read from Cloudflare Web Analytics through
 * Cloudflare's GraphQL Analytics API. Server only: the API token never leaves
 * the server.
 *
 * Configuration (server-side environment variables):
 *   CLOUDFLARE_API_TOKEN                 secret; a token with only "Account Analytics: Read"
 *   CLOUDFLARE_ACCOUNT_ID                the account id (not secret)
 *   CLOUDFLARE_WEB_ANALYTICS_SITE_TAG    optional: the site's tag, if the account counts more than one site
 */

const ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql'
const CACHE_MS = 5 * 60 * 1000

export type TrafficDay = { date: string; pageViews: number; visits: number }
export type TrafficRow = { name: string; pageViews: number }
export type Traffic =
  | { configured: false }
  | {
      configured: true
      error?: string
      days: TrafficDay[]
      totals: { pageViews: number; visits: number }
      topPages: TrafficRow[]
      topReferrers: TrafficRow[]
      topCountries: TrafficRow[]
      fetchedAt: string
    }

export function trafficConfig(env = process.env) {
  const token = env.CLOUDFLARE_API_TOKEN?.trim()
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim()
  const siteTag = env.CLOUDFLARE_WEB_ANALYTICS_SITE_TAG?.trim() || null
  if (!token || !accountId || !/^[a-f0-9]{32}$/i.test(accountId)) return null
  if (siteTag && !/^[A-Za-z0-9]{16,64}$/.test(siteTag)) return null
  return { token, accountId, siteTag }
}

const QUERY = `query SavryTraffic($accountTag: string, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      days: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 31, orderBy: [date_ASC]) { count sum { visits } dimensions { date } }
      pages: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 8, orderBy: [count_DESC]) { count dimensions { requestPath } }
      referrers: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 8, orderBy: [count_DESC]) { count dimensions { refererHost } }
      countries: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 8, orderBy: [count_DESC]) { count dimensions { countryName } }
    }
  }
}`

type Group = { count?: number; sum?: { visits?: number }; dimensions?: Record<string, string | null> }

let cached: { at: number; value: Traffic } | null = null

const rows = (groups: Group[] | undefined, key: string, blank: string): TrafficRow[] =>
  (groups ?? []).map((g) => ({ name: g.dimensions?.[key] || blank, pageViews: Number(g.count ?? 0) })).filter((r) => r.pageViews > 0)

/** The last seven days of visits to public pages, cached for five minutes. */
export async function weeklyTraffic(): Promise<Traffic> {
  const config = trafficConfig()
  if (!config) return { configured: false }
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value

  const end = new Date()
  const start = new Date(end.getTime() - 7 * 86_400_000)
  const filter: Record<string, string> = { datetime_geq: start.toISOString(), datetime_leq: end.toISOString() }
  if (config.siteTag) filter.siteTag = config.siteTag

  const empty = { days: [], totals: { pageViews: 0, visits: 0 }, topPages: [], topReferrers: [], topCountries: [], fetchedAt: end.toISOString() }
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { accountTag: config.accountId, filter } }),
      signal: AbortSignal.timeout(10_000),
    })
    const body = await response.json().catch(() => null)
    const errors = body?.errors as { message?: string }[] | null | undefined
    if (!response.ok || errors?.length) {
      return { configured: true, error: errors?.[0]?.message ?? `Cloudflare answered HTTP ${response.status}`, ...empty }
    }
    const account = body?.data?.viewer?.accounts?.[0] ?? {}
    const days: TrafficDay[] = ((account.days ?? []) as Group[]).map((g) => ({ date: g.dimensions?.date ?? '', pageViews: Number(g.count ?? 0), visits: Number(g.sum?.visits ?? 0) }))
    const value: Traffic = {
      configured: true,
      days,
      totals: { pageViews: days.reduce((n, d) => n + d.pageViews, 0), visits: days.reduce((n, d) => n + d.visits, 0) },
      topPages: rows(account.pages, 'requestPath', '(unknown)'),
      topReferrers: rows(account.referrers, 'refererHost', 'Direct or app'),
      topCountries: rows(account.countries, 'countryName', '(unknown)'),
      fetchedAt: end.toISOString(),
    }
    cached = { at: Date.now(), value }
    return value
  } catch (error) {
    return { configured: true, error: `Could not reach Cloudflare: ${(error as Error).message}`, ...empty }
  }
}
