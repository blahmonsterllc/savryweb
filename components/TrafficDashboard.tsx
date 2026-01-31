'use client'

import { useEffect, useState } from 'react'

interface TrafficSummary {
  totalRequests: number
  uniqueIPs: number
  uniqueUsers: number
  botRequests: number
  botPercentage: number
  suspiciousRequests: number
  suspiciousPercentage: number
  avgResponseTime: number
  successRequests: number
  errorRequests: number
  successRate: number
}

interface EndpointStat {
  endpoint: string
  count: number
}

interface IPStat {
  ip: string
  count: number
}

interface SuspiciousActivity {
  timestamp: Date
  ip: string
  path: string
  method: string
  userAgent: string
  reason: string
  requestCount: number
}

export default function TrafficDashboard() {
  const [summary, setSummary] = useState<TrafficSummary | null>(null)
  const [endpoints, setEndpoints] = useState<EndpointStat[]>([])
  const [topIPs, setTopIPs] = useState<IPStat[]>([])
  const [suspiciousActivity, setSuspiciousActivity] = useState<SuspiciousActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<'hour' | 'today' | 'week' | 'month'>('today')

  useEffect(() => {
    fetchStats()
  }, [period])

  async function fetchStats() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/traffic-stats?period=${period}`)
      if (!response.ok) {
        throw new Error('Failed to fetch traffic stats')
      }

      const data = await response.json()
      setSummary(data.summary)
      setEndpoints(data.endpoints)
      setTopIPs(data.topIPs)
      setSuspiciousActivity(data.suspiciousActivity)
    } catch (err: any) {
      console.error('Failed to load traffic stats:', err)
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

  if (error || !summary) {
    return (
      <div className="bg-red-50 rounded-lg border border-red-200 p-6">
        <h3 className="text-lg font-semibold text-red-800 mb-2">
          Failed to load traffic stats
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
            <h2 className="text-2xl font-bold text-gray-900">Traffic Analytics</h2>
            <p className="text-gray-600 text-sm mt-1">
              Monitor site traffic and detect suspicious activity
            </p>
          </div>
          <div className="flex gap-2">
            {(['hour', 'today', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  period === p
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p === 'hour' ? 'Last Hour' : p === 'today' ? 'Today' : p === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-5 text-white">
            <div className="text-blue-100 text-sm font-medium mb-1">Total Requests</div>
            <div className="text-3xl font-bold">{summary.totalRequests.toLocaleString()}</div>
            <div className="text-blue-100 text-xs mt-2">
              {summary.uniqueIPs} unique IPs
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-5 text-white">
            <div className="text-green-100 text-sm font-medium mb-1">Success Rate</div>
            <div className="text-3xl font-bold">{summary.successRate}%</div>
            <div className="text-green-100 text-xs mt-2">
              {summary.successRequests} successful
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-5 text-white">
            <div className="text-amber-100 text-sm font-medium mb-1">Bot Traffic</div>
            <div className="text-3xl font-bold">{summary.botPercentage}%</div>
            <div className="text-amber-100 text-xs mt-2">
              {summary.botRequests} bot requests
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-5 text-white">
            <div className="text-red-100 text-sm font-medium mb-1">Suspicious</div>
            <div className="text-3xl font-bold">{summary.suspiciousRequests}</div>
            <div className="text-red-100 text-xs mt-2">
              {summary.suspiciousPercentage}% of traffic
            </div>
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="text-gray-600 text-sm font-medium mb-2">Avg Response Time</div>
            <div className="text-2xl font-bold text-gray-900">{summary.avgResponseTime}ms</div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="text-gray-600 text-sm font-medium mb-2">Unique Users</div>
            <div className="text-2xl font-bold text-gray-900">{summary.uniqueUsers}</div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="text-gray-600 text-sm font-medium mb-2">Error Requests</div>
            <div className="text-2xl font-bold text-gray-900">{summary.errorRequests}</div>
          </div>
        </div>
      </div>

      {/* Top Endpoints */}
      {endpoints.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Endpoints</h3>
          <div className="space-y-3">
            {endpoints.map((endpoint, index) => {
              const maxCount = endpoints[0]?.count || 1
              const barWidth = (endpoint.count / maxCount) * 100

              return (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-16 text-sm text-gray-600 font-medium">#{index + 1}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm text-gray-900 font-mono">{endpoint.endpoint}</code>
                      <span className="text-sm text-gray-500">({endpoint.count} requests)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-teal-400 to-teal-600 h-2 rounded-full"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top IPs */}
      {topIPs.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top IP Addresses</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Rank</th>
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">IP Address</th>
                  <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">Requests</th>
                  <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {topIPs.map((ip, index) => {
                  const percentage = summary.totalRequests > 0
                    ? ((ip.count / summary.totalRequests) * 100).toFixed(1)
                    : 0

                  return (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3 text-sm text-gray-600">#{index + 1}</td>
                      <td className="py-3 px-3 text-sm font-mono text-gray-900">{ip.ip}</td>
                      <td className="py-3 px-3 text-sm text-right font-medium text-gray-900">
                        {ip.count.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-sm text-right text-gray-600">{percentage}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Suspicious Activity */}
      {suspiciousActivity.length > 0 && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">🚨</span>
            Suspicious Activity
          </h3>
          <div className="space-y-3">
            {suspiciousActivity.map((activity, index) => (
              <div key={index} className="bg-white rounded-lg p-4 border border-red-200">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold text-red-700">
                        {activity.ip}
                      </span>
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                        {activity.reason}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{activity.method}</span> {activity.path}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(activity.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="text-xs text-gray-500 truncate">
                  UA: {activity.userAgent}
                </div>
                {activity.requestCount && (
                  <div className="text-xs text-red-600 font-medium mt-1">
                    {activity.requestCount} requests in last minute
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security Status */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="text-2xl">🛡️</span>
          Security Status
        </h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            ✅ <strong>Rate Limiting:</strong> Active (100 requests/minute per IP)
          </p>
          <p>
            ✅ <strong>Bot Detection:</strong> {summary.botRequests} bots detected and blocked
          </p>
          <p>
            ✅ <strong>Auto IP Blocking:</strong> Suspicious IPs automatically blocked
          </p>
          <p>
            ✅ <strong>JWT Authentication:</strong> All API endpoints protected
          </p>
          <p>
            ⚠️ <strong>Suspicious Activity:</strong> {summary.suspiciousRequests} flagged requests
          </p>
        </div>
      </div>
    </div>
  )
}
