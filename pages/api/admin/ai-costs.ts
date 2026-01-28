import { NextApiRequest, NextApiResponse } from 'next'
import { getTotalCosts, getUserCosts, getDailyCosts } from '@/lib/aiCostTracking'
import { db } from '@/lib/firebase'

/**
 * Admin AI Cost Analytics API
 * Provides comprehensive cost data for admin dashboard
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { period = 'month' } = req.query

    // Calculate date range
    const now = new Date()
    let startDate: Date
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'all':
        startDate = new Date(2020, 0, 1) // All time
        break
    }

    // Get total costs
    const costs = await getTotalCosts(startDate, now)
    
    // Get daily breakdown for charts
    const dailyCosts = await getDailyCosts(startDate, now)

    // Get top users by cost
    const requestsSnapshot = await db.collection('ai_requests')
      .where('createdAt', '>=', startDate)
      .where('success', '==', true)
      .get()

    // Aggregate by user
    const userCostMap: Record<string, { 
      cost: number
      requests: number
      tier: string
      email?: string 
    }> = {}

    requestsSnapshot.forEach(doc => {
      const data = doc.data()
      const userId = data.userId
      
      if (!userCostMap[userId]) {
        userCostMap[userId] = {
          cost: 0,
          requests: 0,
          tier: data.userTier || 'FREE'
        }
      }
      
      userCostMap[userId].cost += data.costUSD || 0
      userCostMap[userId].requests += 1
    })

    // Get user emails for top users
    const topUserIds = Object.entries(userCostMap)
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 10)
      .map(([userId]) => userId)

    const topUsers = await Promise.all(
      topUserIds.map(async (userId) => {
        const userDoc = await db.collection('users').doc(userId).get()
        const userData = userDoc.data()
        
        return {
          userId,
          email: userData?.email || 'Unknown',
          tier: userCostMap[userId].tier,
          requests: userCostMap[userId].requests,
          cost: userCostMap[userId].cost
        }
      })
    )

    // Calculate Free vs Pro breakdown
    let freeTierCost = 0
    let freeTierRequests = 0
    let proTierCost = 0
    let proTierRequests = 0

    Object.values(userCostMap).forEach(user => {
      if (user.tier === 'PRO') {
        proTierCost += user.cost
        proTierRequests += user.requests
      } else {
        freeTierCost += user.cost
        freeTierRequests += user.requests
      }
    })

    return res.status(200).json({
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      },
      summary: {
        totalCost: costs.totalCost,
        totalRequests: costs.requestCount,
        avgCostPerRequest: costs.avgCostPerRequest,
        costByModel: costs.costByModel,
        tokensByModel: costs.tokensByModel
      },
      tierBreakdown: {
        free: {
          cost: freeTierCost,
          requests: freeTierRequests,
          avgPerRequest: freeTierRequests > 0 ? freeTierCost / freeTierRequests : 0
        },
        pro: {
          cost: proTierCost,
          requests: proTierRequests,
          avgPerRequest: proTierRequests > 0 ? proTierCost / proTierRequests : 0
        }
      },
      dailyCosts,
      topUsers
    })

  } catch (error: any) {
    console.error('❌ AI costs API error:', error)
    return res.status(500).json({ error: error.message })
  }
}
