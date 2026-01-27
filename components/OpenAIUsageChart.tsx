'use client'

import { useEffect, useState } from 'react'

interface UsageStats {
  totalCalls: number
  totalTokens: number
  totalCost: number
  last24Hours: {
    calls: number
    tokens: number
    cost: number
  }
  last7Days: {
    calls: number
    tokens: number
    cost: number
  }
  byModel: Record<string, {
    calls: number
    tokens: number
    cost: number
  }>
  hourlyData: Array<{
    hour: string
    calls: number
    tokens: number
    cost: number
  }>
}

export default function OpenAIUsageChart() {
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'calls' | 'tokens' | 'cost'>('calls')

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/openai-usage', { cache: 'no-store' })
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch OpenAI usage:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-48 bg-gray-100 rounded"></div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <p className="text-gray-600">No usage data available</p>
      </div>
    )
  }

  const maxValue = Math.max(
    ...stats.hourlyData.map(d => {
      if (view === 'calls') return d.calls
      if (view === 'tokens') return d.tokens
      return d.cost
    }),
    1
  )

  const formatHour = (hour: string) => {
    const date = new Date(hour)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toFixed(0)
  }

  const formatCost = (cost: number) => `$${cost.toFixed(4)}`

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">OpenAI API Usage</h3>
          <p className="text-sm text-gray-600 mt-1">Last 24 hours</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('calls')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              view === 'calls'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Calls
          </button>
          <button
            onClick={() => setView('tokens')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              view === 'tokens'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Tokens
          </button>
          <button
            onClick={() => setView('cost')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              view === 'cost'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Cost
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
          <div className="text-xs font-medium text-gray-600 mb-1">Total Calls</div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalCalls}</div>
          <div className="text-xs text-gray-600 mt-1">
            {stats.last24Hours.calls} in 24h
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
          <div className="text-xs font-medium text-gray-600 mb-1">Total Tokens</div>
          <div className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalTokens)}</div>
          <div className="text-xs text-gray-600 mt-1">
            {formatNumber(stats.last24Hours.tokens)} in 24h
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
          <div className="text-xs font-medium text-gray-600 mb-1">Total Cost</div>
          <div className="text-2xl font-bold text-gray-900">{formatCost(stats.totalCost)}</div>
          <div className="text-xs text-gray-600 mt-1">
            {formatCost(stats.last24Hours.cost)} in 24h
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-48 mb-4">
        {stats.hourlyData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No data in the last 24 hours
          </div>
        ) : (
          <div className="flex items-end justify-between gap-1 h-full">
            {stats.hourlyData.slice(-24).map((data, i) => {
              const value = view === 'calls' ? data.calls : view === 'tokens' ? data.tokens : data.cost
              const height = (value / maxValue) * 100
              const isRecent = i >= stats.hourlyData.length - 3

              return (
                <div key={data.hour} className="flex-1 flex flex-col items-center group relative">
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap z-10">
                    <div className="font-semibold">{formatHour(data.hour)}</div>
                    <div>Calls: {data.calls}</div>
                    <div>Tokens: {formatNumber(data.tokens)}</div>
                    <div>Cost: {formatCost(data.cost)}</div>
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                      <div className="border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>

                  {/* Bar */}
                  <div
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      isRecent
                        ? 'bg-gradient-to-t from-primary-500 to-primary-400'
                        : 'bg-gradient-to-t from-gray-300 to-gray-200'
                    } hover:from-primary-600 hover:to-primary-500`}
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />

                  {/* Hour label (show every 4 hours) */}
                  {i % 4 === 0 && (
                    <div className="text-[10px] text-gray-500 mt-2 transform -rotate-45 origin-top-left">
                      {formatHour(data.hour)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Model Breakdown */}
      <div className="border-t border-gray-200 pt-4">
        <div className="text-xs font-semibold text-gray-700 mb-3">By Model</div>
        <div className="space-y-2">
          {Object.entries(stats.byModel).map(([model, data]) => (
            <div key={model} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  model === 'gpt-4o' ? 'bg-purple-500' : 'bg-blue-500'
                }`}></div>
                <span className="font-mono text-gray-700">{model}</span>
              </div>
              <div className="flex gap-4 text-gray-600">
                <span>{data.calls} calls</span>
                <span>{formatNumber(data.tokens)} tokens</span>
                <span className="font-semibold">{formatCost(data.cost)}</span>
              </div>
            </div>
          ))}
          {Object.keys(stats.byModel).length === 0 && (
            <div className="text-gray-500 text-center py-2">No API calls yet</div>
          )}
        </div>
      </div>
    </div>
  )
}
