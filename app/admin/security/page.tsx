'use client'

import { useCallback, useEffect, useState } from 'react'

type Check = { id: string; label: string; ok: boolean; detail?: string; pending?: boolean }
type Group = { id: string; label: string; checks: Check[] }
type Payload = { status: 'ready' | 'attention'; attention: number; checkedAt: string; groups: Group[] }

export default function SecurityCenterPage() {
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)

  const run = useCallback(async () => {
    setRunning(true)
    setError('')
    try {
      const response = await fetch('/api/admin/health', { cache: 'no-store' })
      if (!response.ok) throw new Error('Health checks could not be loaded')
      setData(await response.json())
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setRunning(false)
    }
  }, [])

  useEffect(() => { run() }, [run])

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Health &amp; security</h1>
          <p className="mt-1 text-sm text-gray-500">Live checks against the environment, the database, email DNS, and the public site. Secret values are never shown.</p>
        </div>
        <button type="button" onClick={run} disabled={running} className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{running ? 'Running…' : 'Run checks again'}</button>
      </div>

      {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
      {!data && !error && <p className="mt-6 text-gray-500">Running checks…</p>}

      {data && (
        <>
          <div className={`mt-6 rounded-2xl p-5 ${data.status === 'ready' ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'}`}>
            <strong>{data.status === 'ready' ? 'Everything is in order' : `${data.attention} check${data.attention === 1 ? '' : 's'} need attention`}</strong>
            <p className="mt-1 text-sm">Checked {new Date(data.checkedAt).toLocaleString()}.</p>
          </div>

          {data.groups.map((group) => (
            <section key={group.id} className="mt-8">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">{group.label}</h2>
              <ul className="mt-3 space-y-2">
                {group.checks.map((check) => (
                  <li key={check.id} className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div>
                      <p className="font-medium text-gray-900">{check.label}</p>
                      {check.detail && <p className="mt-0.5 text-xs text-gray-500">{check.detail}</p>}
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${check.pending ? 'bg-blue-50 text-blue-800' : check.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {check.pending ? 'LATER' : check.ok ? 'PASS' : 'ACTION'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-sm">
            <h2 className="font-bold text-gray-900">Automated tests</h2>
            <p className="mt-1">Every push to GitHub runs the security test suite and a full type check before Vercel deploys. Results live under <a href="https://github.com/blahmonsterllc/savryweb/actions" target="_blank" rel="noopener noreferrer" className="underline">GitHub Actions</a>. The database audit above runs the same invariants against production on demand.</p>
          </section>
        </>
      )}
    </main>
  )
}
