'use client'

/**
 * Made Its, photos, tweaks, and comments under a recipe page. Talks to
 * /api/app/community/{slug}/contributions with the site JWT that /app-login
 * stores in localStorage. Signed-out visitors can read everything.
 */
import { useCallback, useEffect, useState } from 'react'
import { CHANGE_KINDS, summarizeChange, type ChangeKind, type CommunityFeed, type Contribution, type RecipeChange } from '@/lib/community-types'

interface Props {
  slug: string
  ingredients: string[]
  steps: string[]
}

type Feed = CommunityFeed & { viewer: { userId: string; isAuthor: boolean } | null }

const KIND_LABELS: Record<ChangeKind, string> = {
  'ingredient.replace': 'Swap an ingredient',
  'ingredient.amount': 'Change an amount',
  'ingredient.add': 'Add an ingredient',
  'ingredient.remove': 'Leave out an ingredient',
  'step.edit': 'Rewrite a step',
  'step.add': 'Add a step',
  'step.remove': 'Skip a step',
  time: 'Change timing',
  servings: 'Change servings',
  other: 'Something else',
}

function token(): string | null {
  try {
    return localStorage.getItem('savry_token')
  } catch {
    return null
  }
}

async function fileToBase64(file: File): Promise<string> {
  // Downscale in the browser so uploads stay small.
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
}

export default function CommunitySection({ slug, ingredients, steps }: Props) {
  const [feed, setFeed] = useState<Feed | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'made' | 'comment' | 'tweak'>('made')

  // form state
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [withTweak, setWithTweak] = useState('')
  const [kind, setKind] = useState<ChangeKind>('ingredient.replace')
  const [index, setIndex] = useState(0)
  const [to, setTo] = useState('')
  const [madeIt, setMadeIt] = useState(false)

  const load = useCallback(async () => {
    const headers: Record<string, string> = {}
    const t = token()
    if (t) headers.Authorization = `Bearer ${t}`
    const res = await fetch(`/api/app/community/${encodeURIComponent(slug)}/contributions`, { headers, cache: 'no-store' })
    if (res.ok) setFeed(await res.json())
  }, [slug])

  useEffect(() => {
    setSignedIn(!!token())
    load().catch(() => setError('Could not load community activity.'))
  }, [load])

  const loginHref = `/app-login?returnTo=${encodeURIComponent(`/recipes/${slug}`)}`

  async function post(body: Record<string, unknown>) {
    const t = token()
    if (!t) {
      window.location.href = loginHref
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/app/community/${encodeURIComponent(slug)}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ source: 'web', ...body }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        localStorage.removeItem('savry_token')
        window.location.href = loginHref
        return
      }
      if (!res.ok) throw new Error(data?.error || 'Something went wrong')
      setText('')
      setPhoto(null)
      setTo('')
      setWithTweak('')
      setMadeIt(false)
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitMade() {
    if (!photo) {
      setError('Add a photo of your finished dish. That’s how a Made It counts.')
      return
    }
    await post({ madeIt: true, photoBase64: await fileToBase64(photo), text: text || undefined, tweakId: withTweak || undefined })
  }

  async function submitComment() {
    if (!text.trim()) return setError('Write something first.')
    await post({ text })
  }

  async function submitTweak() {
    const needsIndex = ['ingredient.replace', 'ingredient.amount', 'ingredient.remove', 'step.edit', 'step.remove', 'step.add'].includes(kind)
    const needsTo = !['ingredient.remove', 'step.remove', 'other'].includes(kind)
    if (needsTo && !to.trim()) return setError('Describe the change.')
    const list = kind.startsWith('step') ? steps : ingredients
    const change: RecipeChange = {
      kind,
      index: needsIndex ? index : undefined,
      from: needsIndex && kind !== 'step.add' ? list[index] : undefined,
      to: needsTo ? to.trim() : undefined,
      note: text.trim() || undefined,
    }
    const body: Record<string, unknown> = { changes: [change], text: text || undefined, madeIt }
    if (madeIt) {
      if (!photo) return setError('Add a photo to count your tweak as made.')
      body.photoBase64 = await fileToBase64(photo)
    }
    await post(body)
  }

  async function decide(tweakId: string, decision: 'accept' | 'decline') {
    const t = token()
    if (!t) return
    setBusy(true)
    try {
      const res = await fetch(`/api/app/community/${encodeURIComponent(slug)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ tweakId, decision }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not update tweak')
      await load()
      if (decision === 'accept') window.location.reload() // recipe body changed
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function report(contributionId: string | null) {
    const t = token()
    if (!t) {
      window.location.href = loginHref
      return
    }
    const reason = window.prompt('Why are you reporting this? Type one: spam, abusive, unsafe, not_a_recipe, copied, other', 'unsafe')
    if (!reason) return
    const res = await fetch(`/api/app/community/${encodeURIComponent(slug)}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ contributionId, reason: reason.trim().toLowerCase() }),
    })
    const data = await res.json().catch(() => ({}))
    setError(res.ok ? (data.hidden ? 'Thanks. It’s hidden while we review it.' : 'Thanks. We’ll take a look.') : data?.error || 'Could not send that report')
    if (res.ok) await load()
  }

  async function restorePrevious() {
    const t = token()
    if (!t || !feed) return
    const previous = feed.recipe.version - 1
    if (previous < 1 || !window.confirm(`Restore the recipe as it was in version ${previous}? Your current version is kept too.`)) return
    setBusy(true)
    const res = await fetch(`/api/app/community/${encodeURIComponent(slug)}/revert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ version: previous }),
    })
    setBusy(false)
    if (res.ok) window.location.reload()
    else setError((await res.json().catch(() => ({})))?.error || 'Could not restore that version')
  }

  const needsIndex = ['ingredient.replace', 'ingredient.amount', 'ingredient.remove', 'step.edit', 'step.remove', 'step.add'].includes(kind)
  const indexList = kind.startsWith('step') ? steps : ingredients

  return (
    <section className="mt-10 space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-bold text-gray-900">Community</h2>
        {feed && (
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-800">{feed.recipe.madeCount}</span> made it · {feed.comments.length} comments · {feed.tweaks.length} tweaks
          </p>
        )}
      </div>

      {feed && feed.photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {feed.photos.slice(0, 12).map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="Made by a Savry cook" className="h-24 w-24 flex-none rounded-xl object-cover" loading="lazy" />
          ))}
        </div>
      )}

      {feed && feed.tweaks.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Others also…</h3>
            {feed.viewer?.isAuthor && feed.recipe.version > 1 && (
              <button type="button" disabled={busy} onClick={restorePrevious} className="text-xs font-medium text-gray-500 underline hover:text-primary-700">
                Restore previous version
              </button>
            )}
          </div>
          <ul className="mt-3 space-y-3">
            {feed.tweaks.map((t) => (
              <TweakRow key={t.id} tweak={t} isAuthor={!!feed.viewer?.isAuthor} busy={busy} onDecide={decide} onReport={report} />
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl bg-white p-5 shadow">
        {!signedIn ? (
          <p className="text-gray-700">
            <a href={loginHref} className="font-semibold text-primary-700 underline">Sign in</a> to share that you made it, suggest a tweak, or comment.
          </p>
        ) : (
          <>
            <div className="flex rounded-xl bg-gray-100 p-1 text-sm font-medium">
              {(['made', 'tweak', 'comment'] as const).map((k) => (
                <button key={k} type="button" onClick={() => setTab(k)} className={`flex-1 rounded-lg py-2 ${tab === k ? 'bg-white shadow text-primary-700' : 'text-gray-500'}`}>
                  {k === 'made' ? 'I made it' : k === 'tweak' ? 'Suggest a tweak' : 'Comment'}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              {tab === 'tweak' && (
                <>
                  <select value={kind} onChange={(e) => setKind(e.target.value as ChangeKind)} className="w-full rounded-xl border border-gray-200 px-3 py-2">
                    {CHANGE_KINDS.map((k) => (
                      <option key={k} value={k}>{KIND_LABELS[k]}</option>
                    ))}
                  </select>
                  {needsIndex && (
                    <select value={index} onChange={(e) => setIndex(Number(e.target.value))} className="w-full rounded-xl border border-gray-200 px-3 py-2">
                      {kind === 'step.add' && <option value={-1}>At the start</option>}
                      {indexList.map((item, i) => (
                        <option key={i} value={i}>{kind.startsWith('step') ? `Step ${i + 1}: ` : ''}{item.slice(0, 80)}</option>
                      ))}
                    </select>
                  )}
                  {!['ingredient.remove', 'step.remove', 'other'].includes(kind) && (
                    <input value={to} onChange={(e) => setTo(e.target.value)} placeholder={kind.startsWith('step') ? 'New step text' : kind === 'time' ? 'e.g. prep 10, cook 25' : kind === 'servings' ? 'e.g. 6' : 'e.g. 1 cup oat milk'} className="w-full rounded-xl border border-gray-200 px-3 py-2" />
                  )}
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={madeIt} onChange={(e) => setMadeIt(e.target.checked)} /> I made it this way (add a photo)
                  </label>
                </>
              )}

              {tab === 'made' && feed && feed.tweaks.length > 0 && (
                <select value={withTweak} onChange={(e) => setWithTweak(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2">
                  <option value="">Made it as written</option>
                  {feed.tweaks.map((t) => (
                    <option key={t.id} value={t.id}>With: {t.changes.map(summarizeChange).join('; ')}</option>
                  ))}
                </select>
              )}

              {(tab === 'made' || (tab === 'tweak' && madeIt)) && (
                <label className="block text-sm text-gray-700">
                  Photo of your dish <span className="text-red-500">*</span>
                  <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
                </label>
              )}

              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={tab === 'made' ? 'How did it turn out? (optional)' : tab === 'tweak' ? 'Why this works (optional)' : 'Your comment'} className="w-full rounded-xl border border-gray-200 px-3 py-2" />

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button type="button" disabled={busy} onClick={tab === 'made' ? submitMade : tab === 'tweak' ? submitTweak : submitComment} className="rounded-xl bg-gradient-to-r from-primary-600 to-secondary-600 px-5 py-2.5 font-semibold text-white disabled:opacity-60">
                {busy ? 'Saving…' : tab === 'made' ? 'Share that I made it' : tab === 'tweak' ? 'Suggest tweak' : 'Post comment'}
              </button>
            </div>
          </>
        )}
      </div>

      {feed && feed.comments.length > 0 && (
        <ul className="space-y-4">
          {feed.comments.map((c) => (
            <li key={c.id} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm">
              {c.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photoUrl} alt="" className="h-16 w-16 flex-none rounded-lg object-cover" loading="lazy" />
              )}
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-semibold text-gray-900">{c.userName}</span>
                  {c.madeIt && <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Made it{c.source === 'app' ? ' in Savry' : ''}</span>}
                  <span className="ml-2 text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                </p>
                {c.text && <p className="mt-1 text-gray-700">{c.text}</p>}
                <button type="button" onClick={() => report(c.id)} className="mt-1 text-xs text-gray-400 hover:text-red-600">Report</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function TweakRow({ tweak, isAuthor, busy, onDecide, onReport }: { tweak: Contribution; isAuthor: boolean; busy: boolean; onDecide: (id: string, d: 'accept' | 'decline') => void; onReport: (id: string) => void }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <p className="font-medium text-gray-900">{tweak.changes.map(summarizeChange).join('; ')}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {tweak.userName} · {tweak.madeCount} made it this way
          {tweak.status === 'accepted' && <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 font-medium text-primary-800">In the recipe (v{tweak.acceptedInVersion})</span>}
        </p>
        {tweak.text && <p className="mt-1 text-sm text-gray-600">{tweak.text}</p>}
        {tweak.safetyFlags?.length > 0 && (
          <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">⚠️ Food safety: {tweak.safetyFlags.join('; ')}</p>
        )}
        <button type="button" onClick={() => onReport(tweak.id)} className="mt-1 text-xs text-gray-400 hover:text-red-600">Report</button>
      </div>
      {isAuthor && tweak.status === 'pending' && (
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => onDecide(tweak.id, 'accept')} className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">Accept</button>
          <button type="button" disabled={busy} onClick={() => onDecide(tweak.id, 'decline')} className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 disabled:opacity-60">Decline</button>
        </div>
      )}
    </li>
  )
}
