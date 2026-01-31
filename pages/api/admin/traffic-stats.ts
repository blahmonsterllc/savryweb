import { NextApiRequest, NextApiResponse } from 'next'
import { getTrafficStats, getSuspiciousActivity } from '@/lib/traffic-analytics'

/**
 * Traffic Analytics API
 * 
 * Returns comprehensive traffic statistics and bot detection data
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { period = 'today', includeSuspicious = 'true' } = req.query

    // Calculate date range
    const now = new Date()
    let startDate = new Date()

    if (period === 'hour') {
      startDate.setHours(now.getHours() - 1)
    } else if (period === 'today') {
      startDate.setHours(0, 0, 0, 0)
    } else if (period === 'week') {
      startDate.setDate(now.getDate() - 7)
    } else if (period === 'month') {
      startDate.setMonth(now.getMonth() - 1)
    } else if (period === 'all') {
      startDate.setFullYear(2020)
    }

    console.log(`📊 Fetching traffic stats: ${startDate.toISOString()} to ${now.toISOString()}`)

    // Get traffic statistics
    const stats = await getTrafficStats(startDate, now)

    // Get suspicious activity if requested
    let suspiciousActivity = []
    if (includeSuspicious === 'true') {
      suspiciousActivity = await getSuspiciousActivity(20)
    }

    // Calculate additional metrics
    const botPercentage = stats.totalRequests > 0
      ? Math.round((stats.botRequests / stats.totalRequests) * 1000) / 10
      : 0

    const suspiciousPercentage = stats.totalRequests > 0
      ? Math.round((stats.suspiciousRequests / stats.totalRequests) * 1000) / 10
      : 0

    // Get top endpoints
    const topEndpoints = Object.entries(stats.requestsByEndpoint)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Success/error breakdown
    const successRequests = Object.entries(stats.requestsByStatus)
      .filter(([status]) => status.startsWith('2'))
      .reduce((sum, [, count]) => sum + (count as number), 0)

    const errorRequests = Object.entries(stats.requestsByStatus)
      .filter(([status]) => !status.startsWith('2'))
      .reduce((sum, [, count]) => sum + (count as number), 0)

    const successRate = stats.totalRequests > 0
      ? Math.round((successRequests / stats.totalRequests) * 1000) / 10
      : 0

    return res.status(200).json({
      success: true,
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString(),
      },
      summary: {
        totalRequests: stats.totalRequests,
        uniqueIPs: stats.uniqueIPs,
        uniqueUsers: stats.uniqueUsers,
        botRequests: stats.botRequests,
        botPercentage,
        suspiciousRequests: stats.suspiciousRequests,
        suspiciousPercentage,
        avgResponseTime: Math.round(stats.avgResponseTime),
        successRequests,
        errorRequests,
        successRate,
      },
      endpoints: topEndpoints,
      topIPs: stats.topIPs,
      topUserAgents: stats.topUserAgents,
      statusCodes: stats.requestsByStatus,
      suspiciousActivity: suspiciousActivity.map((activity: any) => ({
        timestamp: activity.timestamp?.toDate?.() || activity.timestamp,
        ip: activity.ip,
        path: activity.path,
        method: activity.method,
        userAgent: activity.userAgent?.substring(0, 100),
        reason: activity.reason,
        requestCount: activity.requestCount,
      })),
      updated: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('❌ Traffic stats error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch traffic stats',
    })
  }
}
