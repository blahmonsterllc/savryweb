'use client'

import { useEffect, useState } from 'react'

const PRICE_KEY = 'savry.recipePrice'

/**
 * A recipe's estimated cost, per serving or for the whole recipe, as the
 * reader chooses. The choice is remembered in this browser only.
 */
export default function RecipeCost({ perServing, servings, unit }: { perServing: number; servings: number; unit: string }) {
  const [mode, setMode] = useState<'serving' | 'recipe'>('serving')

  useEffect(() => {
    try {
      if (window.localStorage.getItem(PRICE_KEY) === 'recipe') setMode('recipe')
    } catch {}
  }, [])

  function choose(next: 'serving' | 'recipe') {
    setMode(next)
    try { window.localStorage.setItem(PRICE_KEY, next) } catch {}
  }

  const whole = perServing * Math.max(1, servings)
  return (
    <div className="recipe-cost">
      <div className="recipe-cost__figure">
        <span className="recipe-cost__label">Estimated cost</span>
        <strong>${(mode === 'serving' ? perServing : whole).toFixed(2)}</strong>
        <span className="recipe-cost__per">{mode === 'serving' ? `per ${unit}` : `for the whole recipe (${servings} ${unit}${servings === 1 ? '' : 's'})`}</span>
      </div>
      <div className="recipe-cost__switch" role="group" aria-label="Show cost">
        <button type="button" aria-pressed={mode === 'serving'} onClick={() => choose('serving')}>Per {unit}</button>
        <button type="button" aria-pressed={mode === 'recipe'} onClick={() => choose('recipe')}>Whole recipe</button>
      </div>
      <p className="recipe-cost__note">At US average grocery prices. Your store will vary; the Savry app adjusts for where you live.</p>
    </div>
  )
}
