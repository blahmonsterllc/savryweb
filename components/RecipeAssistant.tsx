'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChefHat, Clock3, Loader2, Sparkles, Users } from 'lucide-react'

type Ingredient = { name: string; quantity?: string; amount?: string; unit?: string }
type GeneratedRecipe = {
  name: string
  description?: string
  ingredients: Ingredient[]
  instructions: string[]
  prepTime?: number
  cookTime?: number
  servings?: number
  difficulty?: string
  cuisine?: string
  dietaryTags?: string[]
}

const suggestions = ['Use what is in my fridge', 'Make it weeknight-fast', 'Adapt a family favorite']

function getToken() {
  try {
    return window.localStorage.getItem('savry_token')
  } catch {
    return null
  }
}

export default function RecipeAssistant() {
  const [request, setRequest] = useState('')
  const [servings, setServings] = useState(4)
  const [time, setTime] = useState(35)
  const [recipe, setRecipe] = useState<GeneratedRecipe | null>(null)
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const ingredientPreview = useMemo(
    () => recipe?.ingredients.slice(0, 6).map((item) => [item.quantity ?? item.amount, item.unit, item.name].filter(Boolean).join(' ')) ?? [],
    [recipe]
  )

  async function createRecipe() {
    if (!request.trim()) {
      setStatus('error')
      setMessage('Tell Savry what you have or what you feel like cooking.')
      return
    }

    const token = getToken()
    if (!token) {
      window.location.href = `/app-login?returnTo=${encodeURIComponent('/#recipe-lab')}`
      return
    }

    setStatus('working')
    setMessage('')
    setRecipe(null)

    try {
      const response = await fetch('/api/app/recipes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ request: request.trim(), cookingTime: time, servings }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 401) {
        window.localStorage.removeItem('savry_token')
        window.location.href = `/app-login?returnTo=${encodeURIComponent('/#recipe-lab')}`
        return
      }
      if (!response.ok) throw new Error(data?.error || data?.message || 'Savry Chef could not finish that recipe.')
      setRecipe(data.recipe)
      setStatus('idle')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <section id="recipe-lab" className="recipe-lab" aria-labelledby="recipe-lab-title">
      <div className="recipe-lab__intro">
        <span className="eyebrow eyebrow--light">Savry Chef · private beta</span>
        <h2 id="recipe-lab-title">Start with the food, not a blank page.</h2>
        <p>
          Describe what is in your kitchen, a recipe you want to improve, or the kind of dinner you need. Savry’s own recipe model turns it into a practical first draft.
        </p>
        <div className="recipe-lab__principles" aria-label="Savry Chef principles">
          <span><ChefHat size={17} /> Trained for cooking</span>
          <span><Sparkles size={17} /> Learns from accepted tweaks</span>
          <span><Users size={17} /> Built for sharing</span>
        </div>
      </div>

      <div className="recipe-lab__workbench">
        <div className="assistant-input">
          <label htmlFor="recipe-request">What are we making?</label>
          <textarea
            id="recipe-request"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            placeholder="I have chickpeas, spinach and half a lemon. Make something cozy with one pan."
            rows={4}
          />
          <div className="prompt-chips" aria-label="Prompt ideas">
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => setRequest(suggestion)}>{suggestion}</button>
            ))}
          </div>
          <div className="assistant-controls">
            <label>
              <span><Clock3 size={15} /> Time</span>
              <select value={time} onChange={(event) => setTime(Number(event.target.value))}>
                <option value={20}>20 min</option>
                <option value={35}>35 min</option>
                <option value={50}>50 min</option>
                <option value={75}>75 min</option>
              </select>
            </label>
            <label>
              <span><Users size={15} /> Serves</span>
              <select value={servings} onChange={(event) => setServings(Number(event.target.value))}>
                {[1, 2, 4, 6, 8].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <button className="button button--coral" type="button" onClick={createRecipe} disabled={status === 'working'}>
              {status === 'working' ? <><Loader2 className="spin" size={18} /> Building your recipe</> : <>Make a first draft <ArrowRight size={18} /></>}
            </button>
          </div>
          {message && <p className="assistant-message" role="alert">{message}</p>}
        </div>

        <div className={`recipe-draft ${recipe ? 'recipe-draft--ready' : ''}`} aria-live="polite">
          {recipe ? (
            <>
              <div className="recipe-draft__topline">
                <span>{recipe.cuisine || 'Savry original'}</span>
                <span>{(recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)} min · serves {recipe.servings ?? servings}</span>
              </div>
              <h3>{recipe.name}</h3>
              {recipe.description && <p>{recipe.description}</p>}
              <div className="recipe-draft__columns">
                <div>
                  <h4>Start with</h4>
                  <ul>{ingredientPreview.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <h4>First moves</h4>
                  <ol>{recipe.instructions.slice(0, 3).map((step, index) => <li key={index}>{step}</li>)}</ol>
                </div>
              </div>
              <p className="recipe-draft__note">Save it in the Savry app, cook it, then share the version that worked.</p>
            </>
          ) : (
            <div className="recipe-draft__empty">
              <span className="recipe-draft__number">01</span>
              <h3>Your recipe will take shape here.</h3>
              <p>Specific ingredients, honest time limits and the equipment you have all make the first draft better.</p>
              <Link href="/recipes">Or start from a community recipe <ArrowRight size={16} /></Link>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
