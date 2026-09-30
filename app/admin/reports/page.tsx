'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

type Report = {
  id: string
  reason: string
  detail: string | null
  createdAt: string
  reporterName: string
  reporterId: string
  recipeSlug: string | null
  recipeTitle: string | null
  recipeVisibility: string | null
  contributionId: string | null
  contributionText: string | null
  contributionHidden: boolean | null
  targetUserId: string | null
  targetName: string | null
  targetBanned: boolean | null
}

const REASON: Record<string, string> = { spam: 'Spam', abusive: 'Abusive', unsafe: 'Unsafe', not_a_recipe: 'Not a recipe', copied: 'Copied', other: 'Other' }

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/reports?limit=200', { cache: 'no-store' })
    if (!res.ok) return setError('Could not load reports')
    setReports((await res.json()).reports)
  }, [])

  useEffect(() => { load() }, [load])

  async function ban(report: Report) {
    if (!report.targetUserId || !window.confirm(`Ban ${report.targetName ?? 'this member'}? Everything they posted is hidden.`)) return
    setBusy(report.id)
    const res = await fetch('/api/admin/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: report.targetUserId, banned: true }) })
    setBusy(null)
    if (!res.ok) return setError('Could not ban the member')
    load()
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
      <p className="mt-1 text-sm text-gray-500">Every report cooks have filed, newest first. Content is hidden automatically after enough reports and lands in <Link href="/admin/moderation" className="underline">Moderation</Link>.</p>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!reports && !error && <p className="mt-6 text-gray-500">Loading…</p>}
      {reports && reports.length === 0 && <p className="mt-6 rounded-2xl bg-green-50 p-5 text-green-900">No reports yet.</p>}

      {reports && reports.length > 0 && (
        <ul className="mt-6 space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">{REASON[r.reason] ?? r.reason}</span>
                <span className="text-gray-500">{new Date(r.createdAt).toLocaleString()}</span>
                <span className="text-gray-500">by {r.reporterName}</span>
              </div>
              <div className="mt-3 text-sm text-gray-800">
                {r.contributionId ? (
                  <p><span className="font-semibold">Post</span> by {r.targetName ?? 'unknown'}{r.contributionHidden ? <span className="ml-2 text-xs text-gray-500">hidden</span> : null}: <span className="text-gray-600">“{r.contributionText ?? ''}”</span></p>
                ) : (
                  <p><span className="font-semibold">Recipe</span> by {r.targetName ?? 'unknown'}: {r.recipeTitle ?? r.recipeSlug} <span className="ml-2 text-xs text-gray-500">{r.recipeVisibility}</span></p>
                )}
                {r.detail && <p className="mt-1 text-gray-600">Reporter said: “{r.detail}”</p>}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                {r.recipeSlug && <a href={`/recipes/${r.recipeSlug}`} target="_blank" rel="noreferrer" className="font-semibold text-gray-700 hover:underline">Open recipe ↗</a>}
                {r.targetUserId && <Link href={`/admin/members?q=${r.targetUserId}`} className="font-semibold text-gray-700 hover:underline">Member</Link>}
                {r.targetUserId && !r.targetBanned && (
                  <button type="button" disabled={busy === r.id} onClick={() => ban(r)} className="font-semibold text-red-700 hover:underline">{busy === r.id ? '…' : 'Ban member'}</button>
                )}
                {r.targetBanned && <span className="text-xs font-bold text-red-700">member banned</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
