/**
 * The grocery price table the cost engine uses, so the app can pick up the
 * monthly BLS refresh without waiting for an App Store release.
 *
 * GET /api/prices/table → content/cost/food-prices.json
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import priceFile from '@/content/cost/food-prices.json'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400')
  return res.status(200).json(priceFile)
}
