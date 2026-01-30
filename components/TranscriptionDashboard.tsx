'use client'

import { useEffect, useState } from 'react'

interface TranscriptionStats {
  totalImports: number
  successfulImports: number
  failedImports: number
  successRate: number
  transcriptionsCreated: number
  transcriptsCached: number
  totalTranscriptRequests: number
  cacheHitRate: number
  totalCost: number
  costSaved: number
  totalSavings: number
}

interface PlatformStats {
  count: number
  success: number
  failed: number
  cached: number
  transcribed: number
}

interface DailyData {
  date: string
  imports: number
  cached: number
  transcribed: number
  cost: number
  cacheHitRate: number
}

interface CachedVideo {
  id: string
  platform: string
  videoId: string
  accessCount: number
  transcriptionCost: number
  costSaved: number
}

export default function TranscriptionDashboard() {
  const [stats, setStats] = useState<TranscriptionStats | null>(null)
  const [platformBreakdown, setPlatformBreakdown] = useState<Record<string, PlatformStats>>({})
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [topCachedVideos, setTopCachedVideos] = useState<CachedVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('week')

  useEffect(() => {
    fetchStats()
  }, [period])

  async function fetchStats() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/transcription-stats?period=${period}`)
      if (!response.ok) {
        throw new Error('Failed to fetch transcription stats')
      }

      const data = await response.json()
      setStats(data.summary)
      setPlatformBreakdown(data.platformBreakdown)
      setDailyData(data.dailyData)
      setTopCachedVideos(data.topCachedVideos || [])
    } catch (err: any) {
      console.error('Failed to load transcription stats:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 rounded-lg border border-red-200 p-6">
        <h3 className="text-lg font-semibold text-red-800 mb-2">
          Failed to load transcription stats
        </h3>
        <p className="text-red-600">{error || 'Unknown error'}</p>
        <button
          onClick={fetchStats}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Video Transcription Analytics</h2>
            <p className="text-gray-600 text-sm mt-1">
              OpenAI Whisper API with smart caching to save costs
            </p>
          </div>
          <div className="flex gap-2">
            {(['today', 'week', 'month', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  period === p
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p === 'today' ? 'Today' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'All Time'}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-5 text-white">
            <div className="text-blue-100 text-sm font-medium mb-1">Total Transcriptions</div>
            <div className="text-3xl font-bold">{stats.totalTranscriptRequests}</div>
            <div className="text-blue-100 text-xs mt-2">
              {stats.transcriptionsCreated} new, {stats.transcriptsCached} cached
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-5 text-white">
            <div className="text-green-100 text-sm font-medium mb-1">Cache Hit Rate</div>
            <div className="text-3xl font-bold">{stats.cacheHitRate}%</div>
            <div className="text-green-100 text-xs mt-2">
              {stats.transcriptsCached} of {stats.totalTranscriptRequests} requests
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-5 text-white">
            <div className="text-amber-100 text-sm font-medium mb-1">Total Cost</div>
            <div className="text-3xl font-bold">${stats.totalCost.toFixed(2)}</div>
            <div className="text-amber-100 text-xs mt-2">
              {stats.transcriptionsCreated} transcriptions
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-5 text-white">
            <div className="text-purple-100 text-sm font-medium mb-1">Cost Saved</div>
            <div className="text-3xl font-bold">${stats.costSaved.toFixed(2)}</div>
            <div className="text-purple-100 text-xs mt-2">
              From {stats.transcriptsCached} cache hits
            </div>
          </div>
        </div>

        {/* Savings Highlight */}
        {stats.costSaved > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="text-4xl">💰</div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-900">
                  You saved ${stats.costSaved.toFixed(2)} with caching!
                </h3>
                <p className="text-sm text-green-700 mt-1">
                  Without caching, you would have spent ${stats.totalSavings.toFixed(2)} total.
                  Cache efficiency: {stats.cacheHitRate}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Platform Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(platformBreakdown).map(([platform, data]) => {
            const total = data.count
            const cacheRate = total > 0 ? Math.round((data.cached / total) * 100) : 0

            return (
              <div key={platform} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 capitalize flex items-center gap-2">
                    {platform === 'tiktok' && '🎵'}
                    {platform === 'instagram' && '📸'}
                    {platform === 'youtube' && '▶️'}
                    {platform}
                  </h3>
                  <span className="text-2xl font-bold text-gray-900">{total}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">New transcriptions:</span>
                    <span className="font-medium text-gray-900">{data.transcribed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cached:</span>
                    <span className="font-medium text-green-600">{data.cached}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cache rate:</span>
                    <span className="font-medium text-teal-600">{cacheRate}%</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Daily Trend Chart */}
      {dailyData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Transcription Activity</h3>
          <div className="space-y-3">
            {dailyData.slice(-14).reverse().map((day, index) => {
              const maxImports = Math.max(...dailyData.map((d) => d.imports))
              const barWidth = maxImports > 0 ? (day.imports / maxImports) * 100 : 0

              return (
                <div key={day.date} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-gray-600 font-medium">{day.date}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-teal-400 to-teal-600 h-full rounded-full flex items-center justify-end pr-2"
                          style={{ width: `${barWidth}%` }}
                        >
                          {day.imports > 0 && (
                            <span className="text-white text-xs font-medium">{day.imports}</span>
                          )}
                        </div>
                      </div>
                      <div className="w-20 text-sm text-gray-600">
                        {day.cacheHitRate}% cache
                      </div>
                      <div className="w-16 text-sm text-gray-900 font-medium">
                        ${day.cost.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top Cached Videos */}
      {topCachedVideos.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Cached Videos</h3>
          <p className="text-sm text-gray-600 mb-4">
            Videos with the most cache hits (saving you the most money!)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">
                    Platform
                  </th>
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">
                    Video ID
                  </th>
                  <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">
                    Access Count
                  </th>
                  <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">
                    Original Cost
                  </th>
                  <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">
                    Total Saved
                  </th>
                </tr>
              </thead>
              <tbody>
                {topCachedVideos.map((video) => (
                  <tr key={video.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 text-sm">
                        {video.platform === 'tiktok' && '🎵'}
                        {video.platform === 'instagram' && '📸'}
                        {video.platform === 'youtube' && '▶️'}
                        <span className="capitalize">{video.platform}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-600 font-mono">
                      {video.videoId.substring(0, 15)}...
                    </td>
                    <td className="py-3 px-3 text-sm text-right font-medium text-gray-900">
                      {video.accessCount}
                    </td>
                    <td className="py-3 px-3 text-sm text-right text-gray-600">
                      ${video.transcriptionCost.toFixed(3)}
                    </td>
                    <td className="py-3 px-3 text-sm text-right font-medium text-green-600">
                      ${video.costSaved.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">💡 How Transcription Caching Works</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            <strong>1. First Request:</strong> When a user shares a TikTok/Instagram/YouTube video, we transcribe it with OpenAI Whisper ($0.006/minute) and cache the result.
          </p>
          <p>
            <strong>2. Subsequent Requests:</strong> If another user shares the same video URL, we return the cached transcript instantly (FREE!).
          </p>
          <p>
            <strong>3. Cost Savings:</strong> A viral video shared by 100 users costs $0.05 instead of $5.00 (99% savings).
          </p>
          <p>
            <strong>4. Current Efficiency:</strong> Your cache hit rate of {stats.cacheHitRate}% means you're avoiding {stats.cacheHitRate}% of transcription costs!
          </p>
        </div>
      </div>
    </div>
  )
}
