'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'

type Member = {
  id: string
  displayName: string
  username: string | null
  email: string | null
  tier: string
  isBanned: boolean
  isFeatured: boolean
  createdAt: string
  lastSeenAt: string | null
  emailConfirmed: boolean
  provider: string
  recipeCount: number
  contributionCount: number
  reportsAgainst: number
}

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : '—'
}

export default function AdminMembersPage() {
  const [query, setQuery] = useState('')
  const [members, setMembers] = useState<Member[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (q: string) => {
    setError(null)
    const res = await fetch(`/api/admin/members?q=${encodeURIComponent(q)}&limit=100`, { cache: 'no-store' })
    if (!res.ok) return setError('Could not load members')
    setMembers((await res.json()).members)
  }, [])

  useEffect(() => { load('') }, [load])

  function search(event: FormEvent) {
    event.preventDefault()
    load(query)
  }

  async function setBan(member: Member, banned: boolean) {
    const verb = banned ? 'Ban' : 'Unban'
    if (!window.confirm(`${verb} ${member.displayName}? ${banned ? 'Everything they posted is hidden and their recipes go private.' : 'They can post again; their content stays private until restored.'}`)) return
    setBusy(member.id)
    const res = await fetch('/api/admin/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: member.id, banned }) })
    setBusy(null)
    if (!res.ok) return setError((await res.json()).error ?? 'Could not update the member')
    load(query)
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Members</h1>
      <p className="mt-1 text-sm text-gray-500">Search by name, username, email, or id. Banning hides everything a member posted.</p>

      <form onSubmit={search} className="mt-6 flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members" className="w-full max-w-md rounded-xl border border-gray-300 px-4 py-2" />
        <button type="submit" className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">Search</button>
      </form>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!members && !error && <p className="mt-6 text-gray-500">Loading…</p>}

      {members && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3 text-right">Recipes</th>
                <th className="px-4 py-3 text-right">Posts</th>
                <th className="px-4 py-3 text-right">Reports</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Last seen</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((m) => (
                <tr key={m.id} className={m.isBanned ? 'bg-red-50/60' : ''}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{m.displayName}{m.isFeatured ? ' · official' : ''}{m.isBanned ? ' · banned' : ''}</div>
                    <div className="text-xs text-gray-500">{m.username ? <a href={`/cooks/${m.username}`} target="_blank" rel="noreferrer" className="hover:underline">@{m.username}</a> : 'no username'} · {m.provider}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{m.email ?? '—'}{m.emailConfirmed ? '' : <span className="ml-1 text-xs text-amber-700">unconfirmed</span>}</td>
                  <td className="px-4 py-3">{m.tier === 'free' ? 'Free' : 'Savry+'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{m.recipeCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{m.contributionCount}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${m.reportsAgainst > 0 ? 'font-bold text-amber-700' : ''}`}>{m.reportsAgainst}</td>
                  <td className="px-4 py-3 text-gray-600">{when(m.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-600">{when(m.lastSeenAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {!m.isFeatured && (
                      <button type="button" disabled={busy === m.id} onClick={() => setBan(m, !m.isBanned)} className={`rounded-full px-3 py-1 text-xs font-bold ${m.isBanned ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {busy === m.id ? '…' : m.isBanned ? 'Unban' : 'Ban'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {members.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No members match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
