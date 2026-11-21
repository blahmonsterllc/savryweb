'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

type Entry = {
  id: string
  at: string
  action: string
  targetType: string | null
  targetId: string | null
  detail: Record<string, unknown>
  ip: string | null
  userAgent: string | null
  actorId: string | null
  actorEmail: string | null
  actorName: string | null
  actorIsAdmin: boolean
}

type Summary = { signInsLast7Days: number; actionsLast7Days: number; deniedLast7Days: number; lastSignInAt: string | null }

const ACTION: Record<string, string> = {
  'admin.signed_in': 'Signed in to admin',
  'admin.denied': 'Turned away from admin (not an admin)',
  'members.searched': 'Searched members',
  'member.banned': 'Banned a member',
  'member.unbanned': 'Unbanned a member',
  'moderation.restore': 'Restored reported content',
  'moderation.remove': 'Removed reported content',
  'moderation.ban': 'Banned from the moderation queue',
  'patrol.run_now': 'Ran the content patrol',
  'patrol.dismiss': 'Dismissed a patrol flag',
  'patrol.remove': 'Removed flagged content',
  'patrol.ban': 'Banned from a patrol flag',
  'recipe.deleted': 'Deleted a recipe',
  'recipe.edited': 'Edited a recipe',
  'recipe.editors_pick': "Changed an editor's pick",
  'recipe.visibility': 'Changed who can see a recipe',
  'email.test_sent': 'Sent a test weekly email',
}

const FILTERS = [
  { id: 'all', label: 'Everything' },
  { id: 'sign-ins', label: 'Sign-ins' },
  { id: 'changes', label: 'Changes' },
  { id: 'denied', label: 'Turned away' },
] as const
type Filter = (typeof FILTERS)[number]['id']

function matches(entry: Entry, filter: Filter): boolean {
  if (filter === 'sign-ins') return entry.action === 'admin.signed_in'
  if (filter === 'denied') return entry.action === 'admin.denied'
  if (filter === 'changes') return entry.action !== 'admin.signed_in' && entry.action !== 'admin.denied'
  return true
}

/** A short, readable browser name from a user-agent string. */
function browser(userAgent: string | null): string {
  if (!userAgent) return ''
  const os = /iPhone|iPad/.test(userAgent) ? 'iOS' : /Mac OS X/.test(userAgent) ? 'Mac' : /Android/.test(userAgent) ? 'Android' : /Windows/.test(userAgent) ? 'Windows' : /Linux/.test(userAgent) ? 'Linux' : ''
  const name = /Edg\//.test(userAgent) ? 'Edge' : /Firefox\//.test(userAgent) ? 'Firefox' : /Chrome\//.test(userAgent) ? 'Chrome' : /Safari\//.test(userAgent) ? 'Safari' : 'Browser'
  return os ? `${name} on ${os}` : name
}

function detailText(entry: Entry): string {
  const d = entry.detail ?? {}
  const parts: string[] = []
  if (Array.isArray(d.methods) && d.methods.length) parts.push(`with ${d.methods.join(' + ')}`)
  if (typeof d.query === 'string') parts.push(`“${d.query}”`)
  if (typeof d.title === 'string') parts.push(`“${d.title}”`)
  else if (typeof d.slug === 'string') parts.push(d.slug)
  if (typeof d.visibility === 'string') parts.push(`now ${d.visibility}`)
  if (typeof d.pick === 'boolean') parts.push(d.pick ? 'picked' : 'unpicked')
  if (typeof d.version === 'number') parts.push(`version ${d.version}`)
  if (typeof d.reviewed === 'number') parts.push(`${d.reviewed} reviewed, ${d.flagged ?? 0} flagged`)
  if (typeof d.path === 'string') parts.push(d.path)
  return parts.join(' · ')
}

export default function AdminActivityPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [more, setMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(async (before?: string) => {
    const url = `/api/admin/activity?limit=200${before ? `&before=${encodeURIComponent(before)}` : ''}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      setError('Could not load the activity log')
      return
    }
    const body = await res.json()
    setSummary(body.summary)
    setMore(body.entries.length === 200)
    setEntries((current) => (before && current ? [...current, ...body.entries] : body.entries))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function loadOlder() {
    if (!entries?.length) return
    setLoadingMore(true)
    await load(entries[entries.length - 1].at)
    setLoadingMore(false)
  }

  const shown = entries?.filter((e) => matches(e, filter)) ?? []

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
      <p className="mt-1 text-sm text-gray-500">
        Every admin sign-in, every change made in admin, every member search, and every signed-in member turned away from these pages. Nothing here can be edited or deleted.
        Cloudflare keeps its own log of who passed or failed its sign-in (Zero Trust → Logs → Access).
      </p>

      {summary && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Admin sign-ins, 7 days</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-gray-900">{summary.signInsLast7Days}</p>
            {summary.lastSignInAt && <p className="mt-1 text-xs text-gray-500">Last {new Date(summary.lastSignInAt).toLocaleString()}</p>}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Changes, 7 days</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-gray-900">{summary.actionsLast7Days}</p>
          </div>
          <div className={`rounded-2xl border bg-white p-5 shadow-sm ${summary.deniedLast7Days ? 'border-amber-300' : 'border-gray-200'}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Turned away, 7 days</p>
            <p className={`mt-2 text-3xl font-bold tabular-nums ${summary.deniedLast7Days ? 'text-amber-700' : 'text-gray-900'}`}>{summary.deniedLast7Days}</p>
            <p className="mt-1 text-xs text-gray-500">Signed-in members who are not admins</p>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Filter">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${filter === f.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!entries && !error && <p className="mt-6 text-gray-500">Loading…</p>}
      {entries && shown.length === 0 && <p className="mt-6 rounded-2xl bg-gray-100 p-5 text-gray-700">Nothing here yet.</p>}

      {shown.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Who</th>
                <th className="px-4 py-3">What</th>
                <th className="px-4 py-3">From</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map((e) => (
                <tr key={e.id} className={e.action === 'admin.denied' ? 'bg-amber-50' : undefined}>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">{new Date(e.at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-gray-900">{e.actorName || e.actorEmail || 'Deleted account'}</span>
                    {e.actorEmail && e.actorName && <span className="block text-xs text-gray-500">{e.actorEmail}</span>}
                    {!e.actorIsAdmin && e.actorId && <span className="block text-xs font-bold text-amber-800">not an admin</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-800">
                    {ACTION[e.action] ?? e.action}
                    {detailText(e) && <span className="block text-xs text-gray-500">{detailText(e)}</span>}
                    {e.targetType === 'member' && e.targetId && (
                      <Link href={`/admin/members?q=${e.targetId}`} className="block text-xs font-semibold text-gray-700 hover:underline">Member</Link>
                    )}
                    {e.targetType === 'recipe' && e.targetId && e.action !== 'recipe.deleted' && (
                      <Link href={`/admin/recipes/${e.targetId}`} className="block text-xs font-semibold text-gray-700 hover:underline">Recipe</Link>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {e.ip && <span className="block font-mono">{e.ip}</span>}
                    {browser(e.userAgent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {entries && more && (
        <button type="button" onClick={loadOlder} disabled={loadingMore} className="mt-4 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50">
          {loadingMore ? 'Loading…' : 'Load older'}
        </button>
      )}
    </main>
  )
}
