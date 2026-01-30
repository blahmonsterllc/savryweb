import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/firebase'

/**
 * Transcription Statistics API
 * 
 * Returns analytics for video transcriptions:
 * - Cache hit rate
 * - Cost savings
 * - Platform breakdown
 * - Daily trends
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { period = 'week' } = req.query

    // Calculate date range
    const today = new Date()
    const startDate = new Date(today)

    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0)
    } else if (period === 'week') {
      startDate.setDate(today.getDate() - 7)
    } else if (period === 'month') {
      startDate.setDate(today.getDate() - 30)
    } else if (period === 'all') {
      startDate.setFullYear(2020) // Get all data
    }

    const startDateStr = startDate.toISOString().split('T')[0]
    const todayStr = today.toISOString().split('T')[0]

    console.log(`📊 Fetching transcription stats: ${startDateStr} to ${todayStr}`)

    // Fetch stats documents
    const statsSnapshot = await db
      .collection('recipe_statistics')
      .where('date', '>=', startDateStr)
      .where('date', '<=', todayStr)
      .orderBy('date', 'asc')
      .get()

    // Aggregate data
    let totalImports = 0
    let successfulImports = 0
    let failedImports = 0
    let transcriptionsCreated = 0
    let transcriptsCached = 0
    let totalCost = 0

    const platformBreakdown: any = {
      tiktok: { count: 0, success: 0, failed: 0, cached: 0, transcribed: 0 },
      instagram: { count: 0, success: 0, failed: 0, cached: 0, transcribed: 0 },
      youtube: { count: 0, success: 0, failed: 0, cached: 0, transcribed: 0 },
    }

    const dailyData: any[] = []
    const topCuisines: any = {}

    statsSnapshot.forEach((doc) => {
      const data = doc.data()

      totalImports += data.totalImports || 0
      successfulImports += data.successfulImports || 0
      failedImports += data.failedImports || 0
      transcriptionsCreated += data.transcriptionsCreated || 0
      transcriptsCached += data.transcriptsCached || 0
      totalCost += data.totalTranscriptionCost || 0

      // Platform breakdown
      if (data.byPlatform) {
        Object.keys(data.byPlatform).forEach((platform) => {
          const platformData = data.byPlatform[platform]
          if (platformBreakdown[platform]) {
            platformBreakdown[platform].count += platformData.count || 0
            platformBreakdown[platform].success += platformData.success || 0
            platformBreakdown[platform].failed += platformData.failed || 0
            platformBreakdown[platform].cached += platformData.cached || 0
            platformBreakdown[platform].transcribed += platformData.transcribed || 0
          }
        })
      }

      // Daily data for chart
      dailyData.push({
        date: data.date,
        imports: data.totalImports || 0,
        cached: data.transcriptsCached || 0,
        transcribed: data.transcriptionsCreated || 0,
        cost: data.totalTranscriptionCost || 0,
        cacheHitRate: data.cacheHitRate || 0,
      })

      // Cuisines
      if (data.topCuisines) {
        Object.keys(data.topCuisines).forEach((cuisine) => {
          topCuisines[cuisine] = (topCuisines[cuisine] || 0) + data.topCuisines[cuisine]
        })
      }
    })

    // Calculate metrics
    const totalTranscriptRequests = transcriptionsCreated + transcriptsCached
    const cacheHitRate =
      totalTranscriptRequests > 0
        ? Math.round((transcriptsCached / totalTranscriptRequests) * 1000) / 10
        : 0

    const successRate =
      totalImports > 0 ? Math.round((successfulImports / totalImports) * 1000) / 10 : 0

    // Calculate cost saved from cache
    // Assuming average video is 60 seconds = $0.006
    const avgCostPerTranscription = 0.006
    const costSaved = transcriptsCached * avgCostPerTranscription

    // Get top cuisines
    const topCuisinesArray = Object.entries(topCuisines)
      .map(([cuisine, count]) => ({ cuisine, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5)

    // Get cache statistics from video_transcripts collection
    const transcriptsSnapshot = await db
      .collection('video_transcripts')
      .orderBy('accessCount', 'desc')
      .limit(10)
      .get()

    const topCachedVideos = transcriptsSnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        platform: data.platform,
        videoId: data.videoId,
        accessCount: data.accessCount || 0,
        transcriptionCost: data.transcriptionCost || 0,
        costSaved: (data.accessCount - 1) * (data.transcriptionCost || 0),
      }
    })

    return res.status(200).json({
      success: true,
      period,
      dateRange: {
        start: startDateStr,
        end: todayStr,
      },
      summary: {
        totalImports,
        successfulImports,
        failedImports,
        successRate,
        transcriptionsCreated,
        transcriptsCached,
        totalTranscriptRequests,
        cacheHitRate,
        totalCost: Math.round(totalCost * 100) / 100,
        costSaved: Math.round(costSaved * 100) / 100,
        totalSavings: Math.round((totalCost + costSaved) * 100) / 100,
      },
      platformBreakdown,
      dailyData,
      topCuisines: topCuisinesArray,
      topCachedVideos,
    })
  } catch (error: any) {
    console.error('❌ Transcription stats error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch stats',
    })
  }
}
