import 'server-only'

/**
 * Real shelf prices from Kroger's public Products API (Kroger, Ralphs, Fred
 * Meyer, King Soopers, Smith's, Fry's, Harris Teeter, QFC, Dillons and the
 * other Kroger banners). Free for registered developers; the app talks to
 * Savry's server, never to Kroger, so the credentials stay here.
 *
 * Needs KROGER_CLIENT_ID and KROGER_CLIENT_SECRET (developer.kroger.com).
 * Without them every call reports "not configured" and the app falls back to
 * regional averages.
 */

const API = 'https://api.kroger.com/v1'

export const krogerConfigured = () => Boolean(process.env.KROGER_CLIENT_ID && process.env.KROGER_CLIENT_SECRET)

type Token = { value: string; expiresAt: number }
let token: Token | null = null

async function accessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 30_000) return token.value
  const basic = Buffer.from(`${process.env.KROGER_CLIENT_ID}:${process.env.KROGER_CLIENT_SECRET}`).toString('base64')
  const response = await fetch(`${API}/connect/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=product.compact',
  })
  if (!response.ok) throw new Error(`Kroger token ${response.status}`)
  const body = (await response.json()) as { access_token: string; expires_in: number }
  token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 }
  return token.value
}

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API}${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const response = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken()}`, Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Kroger ${path} ${response.status}`)
  return (await response.json()) as T
}

export type KrogerStore = { locationId: string; name: string; chain: string; city: string; state: string }

/** The nearest Kroger-family store to a ZIP code, or null when there is none within reach. */
export async function nearestStore(zip: string): Promise<KrogerStore | null> {
  const body = await get<{ data?: { locationId: string; name: string; chain: string; address?: { city?: string; state?: string } }[] }>('/locations', {
    'filter.zipCode.near': zip,
    'filter.radiusInMiles': '25',
    'filter.limit': '1',
  })
  const store = body.data?.[0]
  if (!store) return null
  return { locationId: store.locationId, name: store.name, chain: store.chain, city: store.address?.city ?? '', state: store.address?.state ?? '' }
}

export type KrogerProduct = { description?: string; items?: { size?: string; price?: { regular?: number; promo?: number } }[] }

/** Up to `limit` products matching the words, with that store's prices. */
export async function searchProducts(term: string, locationId: string, limit = 8): Promise<KrogerProduct[]> {
  const body = await get<{ data?: KrogerProduct[] }>('/products', {
    'filter.term': term,
    'filter.locationId': locationId,
    'filter.limit': String(limit),
  })
  return body.data ?? []
}
