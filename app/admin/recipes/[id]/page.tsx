'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import RecipeEditor from '@/components/admin/RecipeEditor'

type Ingredient = { section: string | null; name: string; amount: string | null; unit: string | null; isOptional: boolean }
type Detail = {
  id: string
  slug: string
  title: string
  description: string | null
  visibility: 'public' | 'unlisted' | 'private'
  reviewHold: boolean
  editorsPickAt: string | null
  imageUrl: string | null
  prepTime: number | null
  cookTime: number | null
  servings: number | null
  servingType: string | null
  yieldUnit: string | null
  difficulty: string | null
  category: string | null
  cuisine: string | null
  tags: string[]
  dietaryTags: string[]
  allergens: string[]
  equipment: string[]
  ovenTemp: number | null
  notes: string | null
  authorName: string
  createdAt: string
  publishedAt: string | null
  ingredients: Ingredient[]
  steps: string[]
}

const CHECKLIST = [
  'Quantities, times, and temperatures read right',
  'Steps are in order and each has a doneness cue',
  'Dietary tags are strictly true for the ingredients',
  'Every allergen present is listed',
  'Food-safety temperatures are stated where they matter',
]

/** Full read of one recipe, drafts included, with the publish decision. */
export default function AdminRecipeReviewPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id
  const [recipe, setRecipe] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    const res = await fetch(`/api/admin/recipes?id=${id}`, { cache: 'no-store' })
    if (!res.ok) return setError(res.status === 404 ? 'That recipe no longer exists.' : 'Could not load the recipe')
    setRecipe((await res.json()).recipe)
  }, [id])

  useEffect(() => { load() }, [load])

  async function setVisibility(visibility: Detail['visibility'], thenBack: boolean) {
    if (!recipe) return
    setBusy(true)
    const res = await fetch('/api/admin/recipes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: recipe.id, visibility }) })
    setBusy(false)
    if (!res.ok) return setError((await res.json()).error ?? 'Could not update the recipe')
    if (thenBack) router.push('/admin/recipes')
    else load()
  }

  async function setPick(editorsPick: boolean) {
    if (!recipe) return
    setBusy(true)
    const res = await fetch('/api/admin/recipes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: recipe.id, editorsPick }) })
    setBusy(false)
    if (!res.ok) return setError((await res.json()).error ?? 'Could not update the recipe')
    load()
  }

  async function deleteRecipe() {
    if (!recipe) return
    setBusy(true)
    const res = await fetch(`/api/admin/recipes?id=${recipe.id}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) return setError((await res.json()).error ?? 'Could not delete the recipe')
    router.push('/admin/recipes')
  }

  if (error) return <main className="mx-auto max-w-3xl px-6 py-10"><p className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p></main>
  if (!recipe) return <main className="mx-auto max-w-3xl px-6 py-10 text-gray-500">Loading…</main>

  const sections = new Map<string, Ingredient[]>()
  for (const item of recipe.ingredients) {
    const key = item.section ?? ''
    sections.set(key, [...(sections.get(key) ?? []), item])
  }
  const isDraft = recipe.visibility === 'private'
  const yieldText = recipe.servingType === 'yields' ? `Makes ${recipe.servings} ${recipe.yieldUnit ?? ''}`.trim() : `Serves ${recipe.servings}`

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin/recipes" className="text-sm text-gray-600 hover:underline">← Recipes</Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${isDraft ? 'bg-amber-100 text-amber-900' : recipe.visibility === 'public' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
            {isDraft ? 'Draft' : recipe.visibility === 'public' ? 'Public' : 'Unlisted'}{recipe.reviewHold ? ' · on hold' : ''}
          </span>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">{recipe.title}</h1>
          <p className="mt-1 text-sm text-gray-500">by {recipe.authorName} · {[recipe.category, recipe.cuisine, recipe.difficulty].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex items-center gap-4">
          {!editing && <button type="button" onClick={() => { setEditing(true); setSaved(null) }} className="rounded-full px-4 py-1.5 text-sm font-semibold text-gray-800 ring-1 ring-gray-300 hover:bg-gray-50">Edit</button>}
          {recipe.visibility === 'public' && <a href={`/recipes/${recipe.slug}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-gray-700 hover:underline">View live ↗</a>}
        </div>
      </div>

      {saved && <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-900">{saved}</p>}
      {editing && (
        <RecipeEditor
          recipe={recipe}
          onCancel={() => setEditing(false)}
          onSaved={(message) => { setEditing(false); setSaved(message); load() }}
        />
      )}

      {recipe.description && <p className="mt-4 text-lg text-gray-700">{recipe.description}</p>}

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-xl bg-white p-3 ring-1 ring-gray-200"><dt className="text-xs uppercase text-gray-500">Prep</dt><dd className="font-semibold">{recipe.prepTime ?? '—'} min</dd></div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-gray-200"><dt className="text-xs uppercase text-gray-500">Cook</dt><dd className="font-semibold">{recipe.cookTime ?? '—'} min</dd></div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-gray-200"><dt className="text-xs uppercase text-gray-500">Yield</dt><dd className="font-semibold">{yieldText}</dd></div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-gray-200"><dt className="text-xs uppercase text-gray-500">Oven</dt><dd className="font-semibold">{recipe.ovenTemp ? `${recipe.ovenTemp}°F` : '—'}</dd></div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
        {recipe.dietaryTags.map((t) => <span key={t} className="rounded-full bg-green-50 px-2.5 py-1 font-medium text-green-800">{t}</span>)}
        {recipe.allergens.map((a) => <span key={a} className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800">contains {a}</span>)}
        {recipe.allergens.length === 0 && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">no major allergens listed</span>}
        {recipe.tags.map((t) => <span key={t} className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">{t}</span>)}
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-gray-900">Ingredients</h2>
        {[...sections.entries()].map(([section, items]) => (
          <div key={section} className="mt-3">
            {section && <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">{section}</h3>}
            <ul className="mt-1 space-y-1 text-gray-800">
              {items.map((item, index) => (
                <li key={index}>
                  <span className="font-semibold tabular-nums">{[item.amount, item.unit].filter(Boolean).join(' ')}</span> {item.name}{item.isOptional ? <span className="text-gray-500"> (optional)</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {recipe.equipment.length > 0 && <p className="mt-3 text-sm text-gray-600"><span className="font-semibold">Equipment:</span> {recipe.equipment.join(', ')}</p>}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-gray-900">Method</h2>
        <ol className="mt-3 space-y-3">
          {recipe.steps.map((step, index) => (
            <li key={index} className="flex gap-3">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">{index + 1}</span>
              <p className="pt-0.5 text-gray-800">{step}</p>
            </li>
          ))}
        </ol>
        {recipe.notes && <p className="mt-5 rounded-xl bg-yellow-50 p-4 text-sm text-yellow-900"><span className="font-semibold">Notes: </span>{recipe.notes}</p>}
      </section>

      <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-gray-900">Review</h2>
          {recipe.visibility !== 'public' && (
            <button type="button" onClick={() => setChecked(checked.size === CHECKLIST.length ? new Set() : new Set(CHECKLIST.map((_, index) => index)))} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-800 hover:bg-gray-200">
              {checked.size === CHECKLIST.length ? 'Clear all' : 'Select all'}
            </button>
          )}
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {CHECKLIST.map((item, index) => (
            <li key={index}>
              <label className="flex cursor-pointer items-start gap-2">
                <input type="checkbox" className="mt-0.5" checked={checked.has(index)} onChange={() => setChecked((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next })} />
                <span>{item}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-3">
          {recipe.visibility !== 'public' ? (
            <button type="button" disabled={busy || checked.size < CHECKLIST.length} onClick={() => setVisibility('public', true)} className="rounded-full bg-green-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-40">
              {busy ? 'Publishing…' : 'Publish to the community'}
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => setVisibility('private', false)} className="rounded-full bg-gray-900 px-5 py-2 text-sm font-bold text-white disabled:opacity-40">Take back to draft</button>
          )}
          {recipe.visibility === 'public' && (
            <button type="button" disabled={busy} onClick={() => setPick(!recipe.editorsPickAt)} className={`rounded-full px-5 py-2 text-sm font-bold ring-1 disabled:opacity-40 ${recipe.editorsPickAt ? 'bg-amber-100 text-amber-900 ring-amber-300' : 'text-gray-700 ring-gray-200 hover:bg-gray-50'}`}>
              {recipe.editorsPickAt ? '★ Editor’s pick · remove' : '☆ Make it an Editor’s pick'}
            </button>
          )}
          <Link href="/admin/recipes" className="rounded-full px-5 py-2 text-sm font-semibold text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50">{isDraft ? 'Leave as draft' : 'Back'}</Link>
          {confirmingDelete ? (
            <span className="ml-auto flex items-center gap-2 text-sm">
              <span className="text-gray-600">Delete this recipe and everything attached to it?</span>
              <button type="button" disabled={busy} onClick={deleteRecipe} className="rounded-full bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Deleting…' : 'Yes, delete'}</button>
              <button type="button" disabled={busy} onClick={() => setConfirmingDelete(false)} className="rounded-full px-4 py-2 text-sm font-semibold text-gray-600 ring-1 ring-gray-200">Keep</button>
            </span>
          ) : (
            <button type="button" disabled={busy} onClick={() => setConfirmingDelete(true)} className="ml-auto rounded-full px-5 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50">Delete recipe</button>
          )}
        </div>
        {recipe.visibility !== 'public' && checked.size < CHECKLIST.length && <p className="mt-2 text-xs text-gray-500">Tick every check to enable publishing.</p>}
      </section>
    </main>
  )
}
