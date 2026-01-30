'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import OpenAIUsageChart from '@/components/OpenAIUsageChart'
import AICostTracker from '@/components/AICostTracker'
import EmailMarketingDashboard from '@/components/EmailMarketingDashboard'
import TranscriptionDashboard from '@/components/TranscriptionDashboard'

type HealthPayload = {
  ok: boolean
  timestamp: string
  uptimeSec: number
  node: { version: string; env: string }
  app: { version: string }
  memory: { rssBytes: number; heapTotalBytes: number; heapUsedBytes: number }
  env: Record<string, boolean>
  firestore: { ok: boolean; latencyMs?: number; details?: string }
}

export default function AdminHomePage() {
  const [health, setHealth] = useState<HealthPayload | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const res = await fetch('/api/health', { cache: 'no-store' })
      const json = (await res.json()) as HealthPayload
      if (mounted) setHealth(json)
    })().catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin</h1>
          <p className="text-gray-600 mt-1">Private server overview.</p>
        </div>
        <button
          onClick={logout}
          className="bg-white text-gray-900 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 hover:border-gray-300 transition-all"
        >
          Logout
        </button>
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-4">
        <Link
          href="/health"
          className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:border-gray-300 transition-all"
        >
          <div className="text-sm font-semibold text-gray-700">Health dashboard</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">/health</div>
          <div className="text-sm text-gray-600 mt-2">
            {health ? (health.ok ? 'Healthy' : 'Degraded') : '…'}
          </div>
        </Link>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="text-sm font-semibold text-gray-700">Quick stats</div>
          <div className="mt-3 text-sm text-gray-800 space-y-2">
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Env</span>
              <span className="font-mono">{health?.node?.env || '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Node</span>
              <span className="font-mono">{health?.node?.version || '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Firestore</span>
              <span className={`font-mono ${health?.firestore?.ok ? 'text-green-700' : 'text-amber-700'}`}>
                {health ? (health.firestore.ok ? 'OK' : 'ERROR') : '—'}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Traffic + OpenAI usage counters are next (we’ll add them without exposing user logins).
          </p>
        </div>
      </div>

      {/* OpenAI Usage Chart */}
      <div className="mt-6">
        <OpenAIUsageChart />
      </div>

      {/* AI Cost Tracking */}
      <div className="mt-6">
        <AICostTracker />
      </div>

      {/* Email Marketing */}
      <div className="mt-6">
        <EmailMarketingDashboard />
      </div>

      {/* Video Transcription Analytics */}
      <div className="mt-6">
        <TranscriptionDashboard />
      </div>
    </div>
  )
}

