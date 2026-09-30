'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'

type Recipe = {
  id: string
  slug: string
  title: string
  visibility: 'public' | 'unlisted' | 'private'
  reviewHold: boolean
  reportCount: number
  madeCount: number
  commentCount: number
  version: number
  imageUrl: string | null
  createdAt: string
  publishedAt: string | null
  authorName: string
  authorUsername: string | null
  authorId: string
  authorBanned: boolean
}

export default function AdminRecipesPage() {
  const [query, setQuery] = useState('')
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (q: string) => {
    setError(null)
    const res = await fetch(`/api/admin/recipes?q=${encodeURIComponent(q)}&limit=100`, { cache: 'no-store' })
    if (!res.ok) return setError('Could not load recipes')
    setRecipes((await res.json()).recipes)
  }, [])

  useEffect(() => { load('') }, [load])

  function search(event: FormEvent) {
    event.preventDefault()
    load(query)
  }

  async function setVisibility(recipe: Recipe, visibility: Recipe['visibility']) {
    if (visibility === recipe.visibility) return
    setBusy(recipe.id)
    const res = await fetch('/api/admin/recipes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: recipe.id, visibility }) })
    setBusy(null)
    if (!res.ok) return setError((await res.json()).error ?? 'Could not update the recipe')
    load(query)
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
      <p className="mt-1 text-sm text-gray-500">Everything published or held. Changing visibility clears a review hold.</p>

      <form onSubmit={search} className="mt-6 flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title, slug, or author" className="w-full max-w-md rounded-xl border border-gray-300 px-4 py-2" />
        <button type="submit" className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">Search</button>
      </form>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!recipes && !error && <p className="mt-6 text-gray-500">Loading…</p>}

      {recipes && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Recipe</th>
                <th className="px-4 py-3">Author</th>
                <th className="px-4 py-3 text-right">Made</th>
                <th className="px-4 py-3 text-right">Comments</th>
                <th className="px-4 py-3 text-right">Reports</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3">Visibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recipes.map((r) => (
                <tr key={r.id} className={r.reviewHold ? 'bg-amber-50/70' : ''}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {r.imageUrl ? <img src={r.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 font-serif text-gray-500">{r.title.charAt(0)}</span>}
                      <div>
                        <a href={`/recipes/${r.slug}`} target="_blank" rel="noreferrer" className="font-semibold text-gray-900 hover:underline">{r.title}</a>
                        <div className="text-xs text-gray-500">v{r.version}{r.reviewHold ? ' · on hold after reports' : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.authorName}{r.authorBanned ? <span className="ml-1 text-xs font-bold text-red-700">banned</span> : null}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.madeCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.commentCount}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${r.reportCount > 0 ? 'font-bold text-amber-700' : ''}`}>{r.reportCount}</td>
                  <td className="px-4 py-3 text-gray-600">{r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <select value={r.visibility} disabled={busy === r.id} onChange={(e) => setVisibility(r, e.target.value as Recipe['visibility'])} className="rounded-lg border border-gray-300 px-2 py-1 text-sm">
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </td>
                </tr>
              ))}
              {recipes.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No recipes match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
