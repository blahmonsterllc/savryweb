'use client'

import { Minus, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { scaledIngredientLine } from '@/lib/scale-ingredients.mjs'
import { setServingFactor, useServingFactor } from '@/lib/serving-scale'

type Ingredient = { name: string; amount: string | null; unit: string | null; section: string | null; isOptional: boolean }
type Props = { ingredients: Ingredient[]; servings: number; servingType: string; yieldUnit: string | null }

/**
 * The ingredient checklist with a servings control. Changing the servings
 * rescales every amount here and in Cooking Mode; the recipe itself is not changed.
 */
export default function RecipeIngredients({ ingredients, servings, servingType, yieldUnit }: Props) {
  const base = Math.max(1, servings)
  const isYield = servingType === 'yields'
  // Servings go up one at a time. A batch ("makes 18 cookies") moves by half
  // batches so amounts stay measurable.
  const step = !isYield && base <= 12 ? 1 : base % 2 === 0 ? base / 2 : base
  const [count, setCount] = useState(base)
  const factor = useServingFactor()

  useEffect(() => {
    setServingFactor(count / base)
  }, [count, base])
  // Leaving the recipe puts the shared scale back to "as written".
  useEffect(() => () => setServingFactor(1), [])

  const sections = new Map<string, Ingredient[]>()
  for (const ingredient of ingredients) {
    const key = ingredient.section ?? ''
    sections.set(key, [...(sections.get(key) ?? []), ingredient])
  }
  const unitLabel = isYield ? (yieldUnit ?? 'items') : count === 1 ? 'serving' : 'servings'

  return (
    <>
      <div className="recipe-servings" role="group" aria-label={isYield ? 'Amount to make' : 'Number of servings'}>
        <span className="recipe-servings__label">{isYield ? 'Makes' : 'Serves'}</span>
        <button type="button" aria-label="Fewer" disabled={count - step < 1} onClick={() => setCount((c) => Math.max(step, c - step))}><Minus size={16} aria-hidden="true" /></button>
        <output aria-live="polite"><strong>{count}</strong> {unitLabel}</output>
        <button type="button" aria-label="More" disabled={count + step > base * 10} onClick={() => setCount((c) => Math.min(base * 10, c + step))}><Plus size={16} aria-hidden="true" /></button>
        {count !== base && <button type="button" className="recipe-servings__reset" onClick={() => setCount(base)}>Reset</button>}
      </div>
      {count !== base && <p className="recipe-servings__note">Amounts are adjusted for {count} {unitLabel}. Cooking times and pan sizes in the method are for the original {base}.</p>}

      {[...sections.entries()].map(([section, items]) => (
        <div key={section} className="mt-4">
          {section && <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary-700">{section}</h3>}
          <ul className="space-y-2">
            {items.map((ingredient, index) => (
              <li key={index} className="recipe-ingredient">
                <label>
                  <input type="checkbox" />
                  <span>{scaledIngredientLine(ingredient, factor)}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}
