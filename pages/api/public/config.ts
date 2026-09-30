import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishableKey) {
    return res.status(503).json({ error: 'Community service is not configured' })
  }

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
  return res.status(200).json({
    version: 1,
    supabase: { url, publishableKey },
    capabilities: {
      accounts: true,
      recipePublishing: true,
      communityContributions: true, // Made Its, tweaks, reports via Supabase RPCs
      aiChef: false,
    },
  })
}
