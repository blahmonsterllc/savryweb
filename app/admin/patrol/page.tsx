'use client'

/**
 * Patrol: content the automated reviewer flagged as not fit for a family
 * site. The reviewer only flags; every removal and ban is decided here.
 */
import { useCallback, useEffect, useState } from 'react'

type Flag = {
  id: string
  kind: 'recipe' | 'contribution' | 'profile'
  verdict: 'review' | 'severe'
  categories: string[]
  reason: string | null
  preview: string | null
  reviewedAt: string
  recipeSlug: string | null
  recipeTitle: string | null
  recipeVisibility: string | null
  userId: string | null
  userName: string | null
  userUsername: string | null
  userJoined: string | null
  userBanned: boolean | null
  userFlags30d: number
  userReports30d: number
}
type Watched = { userId: string; userName: string; userUsername: string | null; userBanned: boolean; userJoined: string; flags: number; lastFlagAt: string }
type Summary = {
  lastRun: { finishedAt: string; reviewed: number; flagged: number; errors: number; note: string | null } | null
  runs24h: number
  reviewed24h: number
  reviewedTotal: number
  openFlags: number
  openSevere: number
  waiting: number
  watchList: Watched[]
}
type Payload = { configured: boolean; scheduled: boolean; summary: Summary; flags: Flag[] }

const KIND_LABEL: Record<Flag['kind'], string> = { recipe: 'Recipe', contribution: 'Comment or post', profile: 'Profile' }

function ago(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`
  return `${Math.round(minutes / 60 / 24)} d ago`
}

function label(category: string): string {
  return category.replace(/_/g, ' ')
}

export default function PatrolPage() {
  const [data, setData] = useState<Payload | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/patrol', { cache: 'no-store' })
    if (!res.ok) return setError('Could not load the patrol')
    setError(null)
    setData(await res.json())
  }, [])

  useEffect(() => { load() }, [load])

  async function post(body: Record<string, string>, key: string) {
    setBusy(key)
    setMessage(null)
    const res = await fetch('/api/admin/patrol', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    setBusy(null)
    setConfirming(null)
    if (!res.ok) return setError(json.error ?? 'That action failed')
    if (body.action === 'run') {
      const r = json.result
      setMessage(!r.configured ? 'The patrol has no API key yet.' : `Reviewed ${r.reviewed}, flagged ${r.flagged}${r.errors ? `, ${r.errors} could not be checked` : ''}.${r.note ? ` ${r.note}.` : ''}`)
    }
    load()
  }

  if (error && !data) return <main className="mx-auto max-w-5xl px-6 py-10"><p className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p></main>
  if (!data) return <main className="mx-auto max-w-5xl px-6 py-10 text-gray-500">Loading…</main>

  const { summary, flags } = data
  const lastRunStale = summary.lastRun ? Date.now() - new Date(summary.lastRun.finishedAt).getTime() > 35 * 60000 : true

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patrol</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">An automated reviewer reads every recipe, comment, photo, and profile against the family-site rules and flags what a person should look at. It never removes anything or bans anyone on its own.</p>
        </div>
        <button type="button" disabled={busy === 'run' || !data.configured} onClick={() => post({ action: 'run' }, 'run')} className="rounded-full bg-gray-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          {busy === 'run' ? 'Reviewing…' : 'Run now'}
        </button>
      </div>

      {!data.configured && <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">The patrol is switched off: no Anthropic API key is set in Vercel (<code>ANTHROPIC_API_KEY</code>).</p>}
      {data.configured && !data.scheduled && <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">The schedule is off: <code>CRON_SECRET</code> is not set in Vercel, so the patrol only runs when you press Run now.</p>}
      {data.configured && data.scheduled && lastRunStale && <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">The patrol has not run in the last half hour. It should run every 10 minutes.</p>}
      {summary.lastRun?.note && <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Last run: {summary.lastRun.note}.</p>}
      {message && <p className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-900">{message}</p>}
      {error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}

      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4"><dt className="text-xs font-bold uppercase tracking-wide text-gray-500">Last run</dt><dd className="mt-1 text-lg font-bold text-gray-900">{ago(summary.lastRun?.finishedAt)}</dd></div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4"><dt className="text-xs font-bold uppercase tracking-wide text-gray-500">Reviewed, 24 h</dt><dd className="mt-1 text-lg font-bold tabular-nums text-gray-900">{summary.reviewed24h}</dd></div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4"><dt className="text-xs font-bold uppercase tracking-wide text-gray-500">Waiting to be read</dt><dd className="mt-1 text-lg font-bold tabular-nums text-gray-900">{summary.waiting >= 50 ? '50+' : summary.waiting}</dd></div>
        <div className={`rounded-2xl border bg-white p-4 ${summary.openFlags > 0 ? 'border-amber-300' : 'border-gray-200'}`}><dt className="text-xs font-bold uppercase tracking-wide text-gray-500">Open flags</dt><dd className={`mt-1 text-lg font-bold tabular-nums ${summary.openFlags > 0 ? 'text-amber-700' : 'text-gray-900'}`}>{summary.openFlags}{summary.openSevere > 0 ? <span className="ml-2 text-sm text-red-700">{summary.openSevere} severe</span> : null}</dd></div>
      </dl>

      <h2 className="mt-10 text-lg font-bold text-gray-900">Flagged for review</h2>
      {flags.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-white p-8 text-center text-gray-600 shadow-sm ring-1 ring-gray-200">Nothing flagged.</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {flags.map((flag) => (
            <li key={flag.id} className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ${flag.verdict === 'severe' ? 'ring-red-300' : 'ring-gray-200'}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-0.5 font-bold uppercase ${flag.verdict === 'severe' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'}`}>{flag.verdict === 'severe' ? 'Severe' : 'Review'}</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-semibold text-gray-700">{KIND_LABEL[flag.kind]}</span>
                {flag.categories.map((c) => <span key={c} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-gray-600">{label(c)}</span>)}
                <span className="text-gray-500">{ago(flag.reviewedAt)}</span>
              </div>
              {flag.reason && <p className="mt-3 text-sm font-semibold text-gray-900">{flag.reason}</p>}
              {flag.preview && <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{flag.preview}</p>}
              <p className="mt-3 text-xs text-gray-500">
                {flag.userName ?? 'Deleted account'}{flag.userUsername ? ` (@${flag.userUsername})` : ''}
                {flag.userJoined ? ` · joined ${ago(flag.userJoined)}` : ''}
                {` · ${flag.userFlags30d} flag${flag.userFlags30d === 1 ? '' : 's'} and ${flag.userReports30d} report${flag.userReports30d === 1 ? '' : 's'} in 30 days`}
                {flag.userBanned ? ' · already banned' : ''}
                {flag.recipeSlug && flag.recipeVisibility !== 'private' ? <> · <a href={`/recipes/${flag.recipeSlug}`} target="_blank" rel="noreferrer" className="font-semibold text-gray-700 underline">open recipe</a></> : null}
                {flag.kind === 'profile' && flag.userUsername ? <> · <a href={`/cooks/${flag.userUsername}`} target="_blank" rel="noreferrer" className="font-semibold text-gray-700 underline">open profile</a></> : null}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={busy === flag.id} onClick={() => post({ id: flag.id, action: 'dismiss' }, flag.id)} className="rounded-full bg-gray-100 px-4 py-1.5 text-sm font-semibold text-gray-800 disabled:opacity-50">It’s fine</button>
                <button type="button" disabled={busy === flag.id} onClick={() => post({ id: flag.id, action: 'remove' }, flag.id)} className="rounded-full bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{flag.kind === 'profile' ? 'Clear bio, links, photo' : 'Take it down'}</button>
                {confirming === flag.id ? (
                  <>
                    <button type="button" disabled={busy === flag.id} onClick={() => post({ id: flag.id, action: 'ban' }, flag.id)} className="rounded-full bg-red-700 px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50">Confirm ban</button>
                    <button type="button" onClick={() => setConfirming(null)} className="rounded-full px-3 py-1.5 text-sm text-gray-600">Cancel</button>
                  </>
                ) : (
                  <button type="button" disabled={busy === flag.id || !flag.userId} onClick={() => setConfirming(flag.id)} className="rounded-full px-4 py-1.5 text-sm font-semibold text-red-700 ring-1 ring-red-200 disabled:opacity-50">Take down and ban</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-lg font-bold text-gray-900">Watch list</h2>
      <p className="mt-1 text-sm text-gray-500">Members flagged two or more times in the last 30 days.</p>
      {summary.watchList.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-white p-6 text-center text-sm text-gray-600 shadow-sm ring-1 ring-gray-200">No one.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
              <tr><th className="px-4 py-3">Member</th><th className="px-4 py-3 text-right">Flags</th><th className="px-4 py-3">Last flag</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.watchList.map((w) => (
                <tr key={w.userId}>
                  <td className="px-4 py-3 font-semibold text-gray-900">{w.userName}{w.userUsername ? <span className="ml-1 font-normal text-gray-500">@{w.userUsername}</span> : null}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-amber-700">{w.flags}</td>
                  <td className="px-4 py-3 text-gray-600">{ago(w.lastFlagAt)}</td>
                  <td className="px-4 py-3 text-gray-600">{ago(w.userJoined)}</td>
                  <td className="px-4 py-3">{w.userBanned ? <span className="font-bold text-red-700">Banned</span> : <span className="text-gray-600">Active</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-8 text-xs text-gray-500">{summary.reviewedTotal} items reviewed in total · {summary.runs24h} runs in the last 24 hours.</p>
    </main>
  )
}
