'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Check = { id: string; label: string; ok: boolean; pending?: boolean }
type Payload = { status: 'ready' | 'attention'; checkedAt: string; checks: Check[] }

export default function SecurityCenterPage() {
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/security', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Security checks could not be loaded')
        return response.json()
      })
      .then(setData)
      .catch((reason) => setError(reason.message))
  }, [])

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin" className="text-sm text-primary-700 hover:underline">← Admin</Link>
      <h1 className="mt-4 text-3xl font-bold text-gray-900">Security center</h1>
      <p className="mt-2 text-gray-600">Safe configuration checks only. Secret values are never returned to this page.</p>

      {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
      {!data && !error && <p className="mt-6 text-gray-500">Running checks…</p>}
      {data && (
        <>
          <div className={`mt-6 rounded-2xl p-5 ${data.status === 'ready' ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'}`}>
            <strong>{data.status === 'ready' ? 'Launch boundaries are active' : 'Configuration needs attention'}</strong>
            <p className="mt-1 text-sm">Last checked {new Date(data.checkedAt).toLocaleString()}.</p>
          </div>
          <ul className="mt-5 space-y-3">
            {data.checks.map((check) => (
              <li key={check.id} className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <span className="font-medium text-gray-900">{check.label}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${check.pending ? 'bg-blue-50 text-blue-800' : check.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {check.pending ? 'COMING LATER' : check.ok ? 'PASS' : 'ACTION NEEDED'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
