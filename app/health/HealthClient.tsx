'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type HealthPayload = {
  ok: boolean
  timestamp: string
  uptimeSec: number
  node: { version: string; env: string }
  app: { version: string }
  memory: { rssBytes: number; heapTotalBytes: number; heapUsedBytes: number }
  env: Record<string, boolean>
  firestore: {
    ok: boolean
    latencyMs?: number
    details?: string
    sampleCounts?: {
      supermarketDiscounts?: number
      storeItemLocations?: number
    }
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let val = bytes
  let unit = 0
  while (val >= 1024 && unit < units.length - 1) {
    val /= 1024
    unit++
  }
  return `${val.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

function formatUptime(sec: number): string {
  if (!Number.isFinite(sec)) return '—'
  const s = Math.max(0, Math.floor(sec))
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  if (days > 0) return `${days}d ${hours}h ${mins}m`
  if (hours > 0) return `${hours}h ${mins}m`
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

export default function HealthClient() {
  const [data, setData] = useState<HealthPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/health', { cache: 'no-store' })
      const json = (await res.json()) as HealthPayload
      setData(json)
      if (!res.ok) {
        setError(json?.firestore?.details || `Health check failed (${res.status})`)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    const id = window.setInterval(fetchHealth, 5000)
    return () => window.clearInterval(id)
  }, [fetchHealth])

  const status = useMemo(() => {
    if (loading && !data) return { label: 'Checking…', ok: null as null | boolean }
    if (data?.ok) return { label: 'Healthy', ok: true }
    return { label: 'Degraded', ok: false }
  }, [data, loading])

  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Server Health</h1>
          <p className="text-gray-600 mt-1">
            Live status from <span className="font-mono text-sm">/api/health</span> (auto-refreshes every 5s)
          </p>
        </div>
        <button
          onClick={fetchHealth}
          className="w-fit bg-white text-gray-900 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 hover:border-gray-300 transition-all"
        >
          Refresh now
        </button>
      </div>

      <div className="mt-6">
        <div
          className={[
            'rounded-2xl p-6 border shadow-sm',
            status.ok === true ? 'bg-green-50 border-green-200' : '',
            status.ok === false ? 'bg-amber-50 border-amber-200' : '',
            status.ok === null ? 'bg-gray-50 border-gray-200' : '',
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-gray-700">Overall</div>
              <div className="text-2xl font-extrabold text-gray-900">{status.label}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Last updated</div>
              <div className="font-mono text-sm text-gray-900">
                {data?.timestamp ? new Date(data.timestamp).toLocaleString() : '—'}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-white/70 border border-red-200 p-4">
              <div className="text-sm font-semibold text-red-700">Error</div>
              <div className="text-sm text-red-700 mt-1 break-words">{error}</div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="text-sm font-semibold text-gray-700">Runtime</div>
          <div className="mt-3 space-y-2 text-sm text-gray-800">
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Uptime</span>
              <span className="font-mono">{data ? formatUptime(data.uptimeSec) : '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Node</span>
              <span className="font-mono">{data?.node?.version || '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">NODE_ENV</span>
              <span className="font-mono">{data?.node?.env || '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">App version</span>
              <span className="font-mono">{data?.app?.version || '—'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="text-sm font-semibold text-gray-700">Memory</div>
          <div className="mt-3 space-y-2 text-sm text-gray-800">
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">RSS</span>
              <span className="font-mono">{data ? formatBytes(data.memory.rssBytes) : '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Heap used</span>
              <span className="font-mono">{data ? formatBytes(data.memory.heapUsedBytes) : '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Heap total</span>
              <span className="font-mono">{data ? formatBytes(data.memory.heapTotalBytes) : '—'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="text-sm font-semibold text-gray-700">Firestore</div>
          <div className="mt-3 space-y-2 text-sm text-gray-800">
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Status</span>
              <span className={`font-mono ${data?.firestore?.ok ? 'text-green-700' : 'text-amber-700'}`}>
                {data ? (data.firestore.ok ? 'OK' : 'ERROR') : '—'}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Latency</span>
              <span className="font-mono">{data?.firestore?.latencyMs != null ? `${data.firestore.latencyMs}ms` : '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Deals sample</span>
              <span className="font-mono">{data?.firestore?.sampleCounts?.supermarketDiscounts ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Locations sample</span>
              <span className="font-mono">{data?.firestore?.sampleCounts?.storeItemLocations ?? '—'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="text-sm font-semibold text-gray-700">Environment flags</div>
          <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
            {Object.entries(data?.env || {}).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4">
                <span className="font-mono text-xs text-gray-700">{k}</span>
                <span className={`font-mono text-xs ${v ? 'text-green-700' : 'text-gray-400'}`}>{v ? 'set' : 'missing'}</span>
              </div>
            ))}
            {!data && <div className="text-gray-500">—</div>}
          </div>
        </div>
      </div>

      <details className="mt-6 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-gray-700">
          Raw JSON
        </summary>
        <pre className="mt-4 text-xs overflow-auto bg-gray-50 border border-gray-200 rounded-xl p-4">
{JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  )
}



