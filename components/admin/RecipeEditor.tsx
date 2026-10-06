'use client'

import { useState } from 'react'
import { ingredientRowsToText } from '@/lib/ingredient-lines.mjs'

const ALLERGENS = ['milk', 'eggs', 'wheat', 'soy', 'peanuts', 'tree nuts', 'fish', 'shellfish', 'sesame']
const DIETARY = ['vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'nut-free', 'egg-free']

type Editable = {
  id: string
  title: string
  description: string | null
  notes: string | null
  prepTime: number | null
  cookTime: number | null
  servings: number | null
  allergens: string[]
  dietaryTags: string[]
  ingredients: { name: string; amount: string | null; unit: string | null; isOptional: boolean }[]
  steps: string[]
}

/**
 * Revise a recipe in admin: text, times, servings, labels, ingredients (one
 * per line, as a cook writes them) and steps (one per line). Saving keeps the
 * previous version and recomputes nutrition and cost on the server.
 */
export default function RecipeEditor({ recipe, onSaved, onCancel }: { recipe: Editable; onSaved: (message: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(recipe.title)
  const [description, setDescription] = useState(recipe.description ?? '')
  const [notes, setNotes] = useState(recipe.notes ?? '')
  const [prepTime, setPrepTime] = useState(String(recipe.prepTime ?? 0))
  const [cookTime, setCookTime] = useState(String(recipe.cookTime ?? 0))
  const [servings, setServings] = useState(String(recipe.servings ?? 1))
  const [ingredientsText, setIngredientsText] = useState(ingredientRowsToText(recipe.ingredients))
  const [stepsText, setStepsText] = useState(recipe.steps.join('\n'))
  const [allergens, setAllergens] = useState<string[]>(recipe.allergens)
  const [dietaryTags, setDietaryTags] = useState<string[]>(recipe.dietaryTags)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (list: string[], set: (next: string[]) => void, value: string) => set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  async function save() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/admin/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: recipe.id, edit: { title, description, notes, prepTime, cookTime, servings, ingredientsText, stepsText, allergens, dietaryTags } }),
    })
    const body = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || !body.success) return setError(body.error ?? 'Could not save the recipe')
    const cost = typeof body.costPerServing === 'number' ? `$${body.costPerServing.toFixed(2)} a serving` : 'cost not shown (too few ingredients priced)'
    onSaved(`Saved as version ${body.version}. ${body.calories != null ? `${body.calories} kcal, ` : ''}${cost}.`)
  }

  const field = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-500 focus:outline-none'
  const label = 'block text-sm font-semibold text-gray-800'

  return (
    <section className="mt-6 rounded-2xl border border-gray-300 bg-white p-5 shadow-sm" aria-label="Edit recipe">
      <h2 className="text-lg font-bold text-gray-900">Edit recipe</h2>
      <p className="mt-1 text-sm text-gray-500">Saving keeps the previous version and recomputes nutrition and cost. Allergens and diet labels are yours to check.</p>

      <div className="mt-4 grid gap-4">
        <label className={label}>Title<input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></label>
        <label className={label}>Description<textarea className={field} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} /></label>
        <div className="grid grid-cols-3 gap-3">
          <label className={label}>Prep (min)<input className={field} inputMode="numeric" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} /></label>
          <label className={label}>Cook (min)<input className={field} inputMode="numeric" value={cookTime} onChange={(e) => setCookTime(e.target.value)} /></label>
          <label className={label}>Servings<input className={field} inputMode="numeric" value={servings} onChange={(e) => setServings(e.target.value)} /></label>
        </div>
        <label className={label}>Ingredients <span className="font-normal text-gray-500">one per line, e.g. &ldquo;2 cups all-purpose flour (250 g)&rdquo;; add &ldquo;(optional)&rdquo; where it applies</span>
          <textarea className={`${field} font-mono`} rows={Math.min(22, Math.max(8, recipe.ingredients.length + 2))} value={ingredientsText} onChange={(e) => setIngredientsText(e.target.value)} />
        </label>
        <label className={label}>Method <span className="font-normal text-gray-500">one step per line</span>
          <textarea className={field} rows={Math.min(20, Math.max(6, recipe.steps.length * 2))} value={stepsText} onChange={(e) => setStepsText(e.target.value)} />
        </label>
        <label className={label}>Notes <span className="font-normal text-gray-500">shown under the method, e.g. &ldquo;Can substitute chocolate chips for the raisins.&rdquo;</span>
          <textarea className={field} rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
        </label>
        <fieldset>
          <legend className={label}>Contains</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALLERGENS.map((a) => (
              <label key={a} className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-900">
                <input type="checkbox" checked={allergens.includes(a)} onChange={() => toggle(allergens, setAllergens, a)} /> {a}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className={label}>Diet</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DIETARY.map((d) => (
              <label key={d} className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-sm text-green-900">
                <input type="checkbox" checked={dietaryTags.includes(d)} onChange={() => toggle(dietaryTags, setDietaryTags, d)} /> {d}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="mt-5 flex gap-3">
        <button type="button" onClick={save} disabled={busy} className="rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save changes'}</button>
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-full px-5 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-300">Cancel</button>
      </div>
    </section>
  )
}
