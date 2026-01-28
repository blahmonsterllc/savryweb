'use client'

import { useEffect, useState } from 'react'

interface CostData {
  period: string
  dateRange: {
    start: string
    end: string
  }
  summary: {
    totalCost: number
    totalRequests: number
    avgCostPerRequest: number
    costByModel: Record<string, number>
    tokensByModel: Record<string, number>
  }
  tierBreakdown: {
    free: {
      cost: number
      requests: number
      avgPerRequest: number
    }
    pro: {
      cost: number
      requests: number
      avgPerRequest: number
    }
  }
  dailyCosts: Array<{
    date: string
    cost: number
    requests: number
  }>
  topUsers: Array<{
    userId: string
    email: string
    tier: string
    requests: number
    cost: number
  }>
}

export default function AICostTracker() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month')
  const [data, setData] = useState<CostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCostData()
  }, [period])

  async function fetchCostData() {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/admin/ai-costs?period=${period}`)
      if (!response.ok) {
        throw new Error('Failed to fetch cost data')
      }
      
      const costData = await response.json()
      setData(costData)
    } catch (err: any) {
      console.error('Failed to load cost data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function formatCurrency(amount: number): string {
    if (amount < 0.01) {
      return `${(amount * 100).toFixed(4)}¢`
    }
    return `$${amount.toFixed(4)}`
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
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

  if (error || !data) {
    return (
      <div className="bg-red-50 rounded-lg border border-red-200 p-6">
        <h3 className="text-lg font-semibold text-red-800 mb-2">Failed to load cost data</h3>
        <p className="text-red-600">{error || 'Unknown error'}</p>
        <button
          onClick={fetchCostData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  const { summary, tierBreakdown, dailyCosts, topUsers } = data

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">AI Cost Tracking</h2>
          <div className="flex gap-2">
            {(['today', 'week', 'month', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p === 'all' ? 'All Time' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg p-5 text-white">
            <div className="text-teal-100 text-sm font-medium mb-1">Total Cost</div>
            <div className="text-3xl font-bold">${summary.totalCost.toFixed(2)}</div>
            <div className="text-teal-100 text-xs mt-2">
              {summary.totalRequests} requests
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-5 text-white">
            <div className="text-blue-100 text-sm font-medium mb-1">Avg per Request</div>
            <div className="text-3xl font-bold">{formatCurrency(summary.avgCostPerRequest)}</div>
            <div className="text-blue-100 text-xs mt-2">
              {period === 'all' ? 'All time' : 'This ' + period}
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-5 text-white">
            <div className="text-purple-100 text-sm font-medium mb-1">GPT-4o Cost</div>
            <div className="text-3xl font-bold">
              ${(summary.costByModel['gpt-4o'] || 0).toFixed(2)}
            </div>
            <div className="text-purple-100 text-xs mt-2">
              {(summary.tokensByModel['gpt-4o'] || 0).toLocaleString()} tokens
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-5 text-white">
            <div className="text-green-100 text-sm font-medium mb-1">GPT-4o-mini Cost</div>
            <div className="text-3xl font-bold">
              ${(summary.costByModel['gpt-4o-mini'] || 0).toFixed(2)}
            </div>
            <div className="text-green-100 text-xs mt-2">
              {(summary.tokensByModel['gpt-4o-mini'] || 0).toLocaleString()} tokens
            </div>
          </div>
        </div>

        {/* Free vs Pro Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Free Tier Users</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Cost:</span>
                <span className="font-semibold">${tierBreakdown.free.cost.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Requests:</span>
                <span className="font-semibold">{tierBreakdown.free.requests}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg/Request:</span>
                <span className="font-semibold">{formatCurrency(tierBreakdown.free.avgPerRequest)}</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200">
            <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
              <span className="text-amber-600">⭐</span> Pro Tier Users
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-amber-700">Total Cost:</span>
                <span className="font-semibold text-amber-900">${tierBreakdown.pro.cost.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-700">Requests:</span>
                <span className="font-semibold text-amber-900">{tierBreakdown.pro.requests}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-700">Avg/Request:</span>
                <span className="font-semibold text-amber-900">{formatCurrency(tierBreakdown.pro.avgPerRequest)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Cost Chart */}
      {dailyCosts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Costs</h3>
          <div className="space-y-2">
            {dailyCosts.map((day) => {
              const maxCost = Math.max(...dailyCosts.map(d => d.cost))
              const widthPercent = maxCost > 0 ? (day.cost / maxCost) * 100 : 0
              
              return (
                <div key={day.date} className="flex items-center gap-3">
                  <div className="text-sm text-gray-600 w-20 flex-shrink-0">
                    {formatDate(day.date)}
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-teal-500 to-teal-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${widthPercent}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-3 text-sm font-medium">
                      <span className={widthPercent > 30 ? 'text-white' : 'text-gray-700'}>
                        ${day.cost.toFixed(4)} ({day.requests} requests)
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top Users Table */}
      {topUsers.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Users by Cost</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Requests
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Total Cost
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Avg/Request
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {topUsers.map((user, index) => (
                  <tr key={user.userId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-semibold">
                      #{index + 1}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.tier === 'PRO'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {user.tier === 'PRO' ? '⭐ Pro' : 'Free'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {user.requests}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                      ${user.cost.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">
                      {formatCurrency(user.cost / user.requests)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-teal-50 rounded-lg border border-blue-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">💡 Cost Insights</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            • <strong>Model Split:</strong> GPT-4o costs{' '}
            {summary.costByModel['gpt-4o'] > 0 && summary.costByModel['gpt-4o-mini'] > 0
              ? `${((summary.costByModel['gpt-4o'] / (summary.costByModel['gpt-4o'] + summary.costByModel['gpt-4o-mini'])) * 100).toFixed(1)}% `
              : '0% '}
            of total (premium model for modifications)
          </p>
          <p>
            • <strong>User Distribution:</strong>{' '}
            {tierBreakdown.free.requests + tierBreakdown.pro.requests > 0
              ? `${((tierBreakdown.pro.requests / (tierBreakdown.free.requests + tierBreakdown.pro.requests)) * 100).toFixed(1)}% `
              : '0% '}
            of requests from Pro users
          </p>
          <p>
            • <strong>Projected Monthly:</strong> If current usage continues, estimated monthly cost is{' '}
            ${((summary.totalCost / Math.max(1, dailyCosts.length)) * 30).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  )
}
