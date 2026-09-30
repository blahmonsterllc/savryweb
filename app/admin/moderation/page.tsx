'use client'

/**
 * Admin moderation queue. /admin/* is already restricted to admin Google
 * accounts by middleware.ts. Items arrive here when enough cooks report a
 * comment, tweak, or recipe and it has been hidden automatically.
 */
import { useCallback, useEffect, useState } from 'react'

interface Item {
  id: string
  recipeSlug: string
  contributionId: string | null
  kind: string
  preview: string
  reasons: string[]
  reportCount: number
  createdAt: string | null
}

export default function ModerationPage() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/moderation', { cache: 'no-store' })
    if (!res.ok) return setError('Could not load the queue')
    setItems((await res.json()).items)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function act(id: string, action: 'restore' | 'remove' | 'ban') {
    if (action === 'ban' && !confirm('Remove this and ban the account from posting?')) return
    setBusy(id)
    const res = await fetch('/api/admin/moderation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    setBusy(null)
    if (!res.ok) return setError('That action failed')
    load()
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Moderation queue</h1>
      <p className="mt-1 text-sm text-gray-500">Hidden automatically after reports. Restore if it was fine, remove if not, ban repeat offenders.</p>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {items === null ? (
        <p className="mt-6 text-gray-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-white p-8 text-center text-gray-600 shadow">Nothing waiting. 🎉</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl bg-white p-5 shadow">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold uppercase text-gray-700">{item.kind}</span>
                <span className="text-gray-500">{item.reportCount} reports · {item.reasons?.join(', ')}</span>
                <a href={`/recipes/${item.recipeSlug}`} target="_blank" className="text-primary-700 underline">open recipe</a>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-gray-800">{item.preview || '(no text)'}</p>
              <div className="mt-3 flex gap-2">
                <button disabled={busy === item.id} onClick={() => act(item.id, 'restore')} className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">Restore</button>
                <button disabled={busy === item.id} onClick={() => act(item.id, 'remove')} className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-800 disabled:opacity-60">Remove</button>
                <button disabled={busy === item.id} onClick={() => act(item.id, 'ban')} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">Remove + ban</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
