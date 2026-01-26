import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { supermarketScraper } from '@/lib/supermarket-scraper'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const session = await getServerSession(req, res, authOptions)
    
    if (!session?.user) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    // Only Pro tier users can access discounts
    if (session.user.tier !== 'PRO') {
      return res.status(403).json({ 
        message: 'This feature is only available for Pro tier users',
        upgrade: true 
      })
    }

    const { location } = req.query
    const category = req.query.category as string | undefined

    if (typeof location !== 'string') {
      return res.status(400).json({ message: 'Invalid location' })
    }

    // Discounts are disabled for now; return empty list
    return res.status(200).json([])
  } catch (error) {
    console.error('Get discounts error:', error)
    return res.status(500).json({ message: 'Failed to fetch discounts' })
  }
}







