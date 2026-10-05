'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChefHat,
  Clock3,
  ImagePlus,
  ListChecks,
  Plus,
  Send,
  Users,
} from 'lucide-react'
import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import { newPhotoPath } from '@/lib/photo-upload'
import { ingredientRowsToText, parseIngredientLines, parseInstructionLines } from '@/lib/ingredient-lines.mjs'

type IngredientDraft = {
  amount: string
  unit: string
  name: string
  isOptional: boolean
}

type RecipeDraft = {
  clientRecipeId: string
  title: string
  description: string
  prepTime: string
  cookTime: string
  servings: string
  servingType: 'servings' | 'yields'
  yieldUnit: string
  difficulty: string
  category: string
  cuisine: string
  tags: string
  dietaryTags: string
  allergens: string
  equipment: string
  ovenTemp: string
  notes: string
  sourceURL: string
  imageBase64: string
  ingredients: IngredientDraft[]
  instructions: string[]
  /** What the cook typed, one ingredient per line; `ingredients` is parsed from it. */
  ingredientText: string
  /** What the cook typed, one step per line; `instructions` is parsed from it. */
  instructionText: string
  rightsAttested: boolean
}

const DRAFT_KEY = 'savry_web_recipe_draft_v1'
const steps = ['The dish', 'Ingredients', 'Method', 'Review']
const categories = ['Breakfast', 'Lunch', 'Dinner', 'Soup', 'Salad', 'Side', 'Dessert', 'Snack', 'Drink', 'Sauce', 'Other']

function blankDraft(): RecipeDraft {
  return {
    clientRecipeId: '',
    title: '',
    description: '',
    prepTime: '15',
    cookTime: '30',
    servings: '4',
    servingType: 'servings',
    yieldUnit: '',
    difficulty: 'Easy',
    category: 'Dinner',
    cuisine: '',
    tags: '',
    dietaryTags: '',
    allergens: '',
    equipment: '',
    ovenTemp: '',
    notes: '',
    sourceURL: '',
    imageBase64: '',
    ingredients: [],
    instructions: [],
    ingredientText: '',
    instructionText: '',
    rightsAttested: false,
  }
}

function splitList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function toNumber(value: string, fallback = 0): number {
  const result = Number.parseInt(value, 10)
  return Number.isFinite(result) ? result : fallback
}

function imageToJPEG(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectURL = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(objectURL)
      const longest = Math.max(image.naturalWidth, image.naturalHeight)
      const scale = longest > 1200 ? 1200 / longest : 1
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) return reject(new Error('Could not prepare this image.'))
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.8, 0.65, 0.5, 0.35]) {
        const encoded = canvas.toDataURL('image/jpeg', quality).split(',')[1] ?? ''
        if (encoded.length <= 1_150_000) return resolve(encoded)
      }
      reject(new Error('That photo is too large. Try a smaller image.'))
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectURL)
      reject(new Error('Savry could not read that photo.'))
    }
    image.src = objectURL
  })
}

/**
 * Nutrition per serving from the ingredient list, with the same USDA engine
 * and rules the Savry Kitchen recipes use. Loaded only when publishing. Null
 * when too few lines matched a known food (the page then shows no label
 * rather than a wrong one).
 */
async function nutritionFor(servings: number, ingredients: IngredientDraft[]): Promise<Record<string, number | string> | null> {
  try {
    const [{ computeRecipeNutrition, createMatcher }, rules, usda] = await Promise.all([
      import('@/lib/nutrition/compute.mjs'),
      import('@/content/nutrition/ingredient-rules.json'),
      import('@/content/nutrition/usda-foods.json'),
    ])
    const ruleList = ((rules as { default?: unknown }).default ?? rules) as object[]
    const foods = (((usda as { default?: { foods?: unknown } }).default ?? usda) as { foods: Record<string, object> }).foods
    const reference = { rules: ruleList, foods, resolve: createMatcher(ruleList) }
    const result = computeRecipeNutrition({ servings, ingredients: ingredients.map((i) => ({ name: i.name, amount: i.amount || null, unit: i.unit || null, isOptional: i.isOptional })) }, reference)
    if (!result || result.coverage < 0.95) return null
    const n = result.perServing
    return { calories: n.calories, protein: n.protein, carbohydrates: n.carbohydrates, fat: n.fat, fiber: n.fiber, sugar: n.sugar, sodium: n.sodium, cholesterol: n.cholesterol, saturatedFat: n.saturatedFat, source: 'usdaFoodDataCentral', ingredientCoverage: result.coverage }
  } catch {
    return null
  }
}

/**
 * Estimated cost per serving from the same rules and Savry's price table.
 * Null when too few lines could be priced; the page then shows no cost.
 */
async function costFor(servings: number, ingredients: IngredientDraft[]): Promise<{ cost: number; coverage: number } | null> {
  try {
    const [{ computeRecipeCost }, { createMatcher }, rules, priceFile] = await Promise.all([
      import('@/lib/cost/compute.mjs'),
      import('@/lib/nutrition/compute.mjs'),
      import('@/content/nutrition/ingredient-rules.json'),
      import('@/content/cost/food-prices.json'),
    ])
    const ruleList = ((rules as { default?: unknown }).default ?? rules) as object[]
    const prices = (((priceFile as { default?: { prices?: unknown } }).default ?? priceFile) as { prices: Record<string, { perKg: number }> }).prices
    const result = computeRecipeCost({ servings, ingredients: ingredients.map((i) => ({ name: i.name, amount: i.amount || null, unit: i.unit || null, isOptional: i.isOptional })) }, { rules: ruleList, prices, resolve: createMatcher(ruleList) })
    if (!result || result.coverage < 0.95) return null
    return { cost: result.perServing, coverage: result.coverage }
  } catch {
    return null
  }
}

function base64JPEG(value: string): Blob {
  const binary = window.atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: 'image/jpeg' })
}

export default function RecipeComposer() {
  const [draft, setDraft] = useState<RecipeDraft>(blankDraft)
  const [step, setStep] = useState(0)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [publishedURL, setPublishedURL] = useState<string | null>(null)
  // A cook's first recipes wait for an editor before they appear on the table.
  const [pendingReview, setPendingReview] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY)
      const next: RecipeDraft = saved ? { ...blankDraft(), ...JSON.parse(saved) } : blankDraft()
      next.clientRecipeId ||= window.crypto.randomUUID()
      // A draft from the row-by-row editor: carry its rows into the text boxes.
      if (!next.ingredientText && next.ingredients.some((row) => row.name)) next.ingredientText = ingredientRowsToText(next.ingredients)
      if (!next.instructionText && next.instructions.some(Boolean)) next.instructionText = next.instructions.filter(Boolean).join('\n')
      next.ingredients = parseIngredientLines(next.ingredientText) as IngredientDraft[]
      next.instructions = parseInstructionLines(next.instructionText)
      setDraft(next)
    } catch {
      setDraft({ ...blankDraft(), clientRecipeId: window.crypto.randomUUID() })
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready || publishedURL) return
    const timer = window.setTimeout(() => {
      try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch {}
    }, 300)
    return () => window.clearTimeout(timer)
  }, [draft, publishedURL, ready])

  const validIngredients = useMemo(() => draft.ingredients.filter((item) => item.name.trim()), [draft.ingredients])
  const validInstructions = useMemo(() => draft.instructions.map((item) => item.trim()).filter(Boolean), [draft.instructions])
  const totalTime = toNumber(draft.prepTime) + toNumber(draft.cookTime)

  function update<K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setMessage(null)
  }



  function canContinue(): boolean {
    if (step === 0 && !draft.title.trim()) {
      setMessage('Give your recipe a name before continuing.')
      return false
    }
    if (step === 1 && validIngredients.length === 0) {
      setMessage('Add at least one ingredient.')
      return false
    }
    if (step === 2 && validInstructions.length === 0) {
      setMessage('Add at least one cooking step.')
      return false
    }
    setMessage(null)
    return true
  }

  function nextStep() {
    if (canContinue()) setStep((current) => Math.min(current + 1, steps.length - 1))
  }

  async function pickImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage('Choose a photo file.')
      return
    }
    try {
      update('imageBase64', await imageToJPEG(file))
    } catch (error: any) {
      setMessage(error?.message || 'Could not add that photo.')
    }
  }

  async function publish() {
    if (!draft.rightsAttested) {
      setMessage('Confirm that this is your recipe, or that you have permission to share it.')
      return
    }
    const supabase = getSupabaseBrowserClient()
    const { data: authData } = await supabase.auth.getUser()
    const user = authData.user
    if (!user) {
      window.location.assign('/app-login?returnTo=/recipes/new')
      return
    }

    setBusy(true)
    setMessage(null)
    try {
      let imagePath: string | null = null
      let imageURL: string | null = null
      if (draft.imageBase64) {
        // A fresh path each time: members may add files to their own folder
        // but not overwrite one, so replacing in place is refused by storage.
        imagePath = newPhotoPath(user.id, 'recipe')
        const { error: uploadError } = await supabase.storage
          .from('recipe-images')
          .upload(imagePath, base64JPEG(draft.imageBase64), { contentType: 'image/jpeg', upsert: false })
        if (uploadError) throw uploadError
        imageURL = supabase.storage.from('recipe-images').getPublicUrl(imagePath).data.publicUrl
      }

      const nutritionPerServing = await nutritionFor(Math.max(1, toNumber(draft.servings, 1)), validIngredients)
      const { data: result, error: publishError } = await supabase.rpc('publish_recipe_v2', {
        payload: {
          nutritionPerServing,
          clientRecipeId: draft.clientRecipeId,
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          prepTime: toNumber(draft.prepTime),
          cookTime: toNumber(draft.cookTime),
          servings: Math.max(1, toNumber(draft.servings, 1)),
          servingType: draft.servingType,
          yieldUnit: draft.yieldUnit.trim() || null,
          difficulty: draft.difficulty,
          category: draft.category,
          cuisine: draft.cuisine.trim() || null,
          tags: splitList(draft.tags),
          dietaryTags: splitList(draft.dietaryTags),
          allergens: splitList(draft.allergens),
          equipment: splitList(draft.equipment),
          ovenTemp: draft.ovenTemp ? toNumber(draft.ovenTemp) : null,
          notes: draft.notes.trim() || null,
          ingredients: validIngredients.map((ingredient) => ({
            name: ingredient.name.trim(),
            amount: ingredient.amount.trim() || null,
            unit: ingredient.unit.trim() || null,
            section: null,
            isOptional: ingredient.isOptional,
          })),
          instructions: validInstructions,
          sourceURL: draft.sourceURL.trim() || null,
          imagePath,
          imageURL,
          rightsAttested: true,
        },
      })
      if (publishError) throw publishError
      const published = result as { url?: string; status?: string } | null
      if (!published?.url) throw new Error('Savry could not publish this recipe.')
      // The cost estimate rides alongside: a miss here must not undo a publish that worked.
      const slug = published.url.split('/').filter(Boolean).pop()
      if (slug) {
        const estimate = await costFor(Math.max(1, toNumber(draft.servings, 1)), validIngredients)
        await supabase.rpc('set_my_recipe_cost', { recipe_slug: slug, cost: estimate?.cost ?? null, coverage: estimate?.coverage ?? null }).then(() => undefined, () => undefined)
      }
      window.localStorage.removeItem(DRAFT_KEY)
      setPendingReview(published.status === 'pending_review')
      setPublishedURL(published.url)
    } catch (error: any) {
      setMessage(error?.message || 'Savry could not publish this recipe.')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return <main className="recipe-composer recipe-composer--loading site-shell">Opening your recipe book…</main>

  if (publishedURL) {
    return (
      <main className="recipe-composer recipe-composer--success site-shell">
        <div className="recipe-published">
          <span className="recipe-published__check"><Check size={38} /></span>
          <span className="eyebrow">Fresh from your kitchen</span>
          {pendingReview ? (
            <>
              <h1>Your recipe is in for review.</h1>
              <p>A Savry editor reads each cook&rsquo;s first recipes before they join the shared table, usually within a day. You can see and edit it from your account meanwhile.</p>
            </>
          ) : (
            <>
              <h1>Your recipe is on the shared table.</h1>
              <p>It is now public, shareable, and credited to your Savry community account.</p>
            </>
          )}
          <div>
            <a href={publishedURL} className="button button--coral">{pendingReview ? 'See your recipe' : 'View your recipe'}</a>
            <button
              type="button"
              className="button button--light"
              onClick={() => {
                setDraft({ ...blankDraft(), clientRecipeId: window.crypto.randomUUID() })
                setPublishedURL(null)
                setStep(0)
              }}
            >Add another</button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="recipe-composer site-shell">
      <header className="recipe-composer__header">
        <div>
          <span className="eyebrow">From your kitchen to the community</span>
          <h1>Add a recipe.</h1>
          <p>Write it the way you cook it. Savry keeps a draft on this device until you are ready to publish.</p>
        </div>
        <div className="recipe-composer__app-note"><ChefHat size={20} /><span>The Apple apps are coming soon.<b>Your web account and recipes are being built to connect with them.</b></span></div>
      </header>

      <nav className="recipe-composer__progress" aria-label="Recipe progress">
        {steps.map((label, index) => (
          <button type="button" key={label} onClick={() => index <= step && setStep(index)} className={index === step ? 'is-current' : index < step ? 'is-done' : ''}>
            <span>{index < step ? <Check size={14} /> : index + 1}</span>{label}
          </button>
        ))}
      </nav>

      <div className="recipe-composer__layout">
        <section className="recipe-composer__panel">
          {step === 0 && (
            <div className="recipe-form-section">
              <div className="recipe-form-section__title"><ChefHat /><div><span>01</span><h2>Tell us about the dish</h2></div></div>
              <label className="recipe-field recipe-field--hero"><span>Recipe name</span><input autoFocus value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder="Example: Lemon garlic chicken" maxLength={200} /></label>
              <label className={`recipe-photo-field ${draft.imageBase64 ? 'has-photo' : ''}`}>
                {draft.imageBase64 ? <img src={`data:image/jpeg;base64,${draft.imageBase64}`} alt="Recipe preview" /> : <><ImagePlus /><strong>Add a finished-dish photo</strong><span>Portrait or landscape works</span></>}
                <input type="file" accept="image/*" onChange={pickImage} />
              </label>
              <label className="recipe-field"><span>Short introduction</span><textarea value={draft.description} onChange={(event) => update('description', event.target.value)} placeholder="What makes this one worth cooking?" rows={3} maxLength={2000} /></label>
              <div className="recipe-field-grid recipe-field-grid--four">
                <label className="recipe-field"><span>Prep minutes</span><input type="number" min="0" value={draft.prepTime} onChange={(event) => update('prepTime', event.target.value)} /></label>
                <label className="recipe-field"><span>Cook minutes</span><input type="number" min="0" value={draft.cookTime} onChange={(event) => update('cookTime', event.target.value)} /></label>
                <label className="recipe-field"><span>Serves</span><input type="number" min="1" value={draft.servings} onChange={(event) => update('servings', event.target.value)} /></label>
                <label className="recipe-field"><span>Difficulty</span><select value={draft.difficulty} onChange={(event) => update('difficulty', event.target.value)}><option>Easy</option><option>Medium</option><option>Advanced</option></select></label>
              </div>
              <div className="recipe-field-grid">
                <label className="recipe-field"><span>Category</span><select value={draft.category} onChange={(event) => update('category', event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
                <label className="recipe-field"><span>Cuisine <small>optional</small></span><input value={draft.cuisine} onChange={(event) => update('cuisine', event.target.value)} placeholder="Mediterranean" maxLength={60} /></label>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="recipe-form-section">
              <div className="recipe-form-section__title"><ListChecks /><div><span>02</span><h2>What goes in</h2></div></div>
              <p className="recipe-form-section__hint">One ingredient per line, written the way you&rsquo;d say it. Savry works out the amounts, so servings can be scaled and grocery lists built. Add &ldquo;(optional)&rdquo; where it applies.</p>
              <p className="lines-editor__dictate">On a phone, tap the microphone on your keyboard and say each ingredient on its own line.</p>
              <textarea
                className="lines-editor"
                autoFocus
                value={draft.ingredientText}
                onChange={(event) => setDraft((current) => ({ ...current, ingredientText: event.target.value, ingredients: parseIngredientLines(event.target.value) as IngredientDraft[] }))}
                placeholder={'2 chicken breasts\n3 cloves garlic\n1 lemon\n2 tbsp olive oil\nsalt and pepper\nfresh parsley (optional)'}
                rows={10}
                spellCheck
              />
              {validIngredients.length > 0 && (
                <ol className="lines-preview" aria-label="How Savry read your ingredients">
                  {validIngredients.map((ingredient, index) => (
                    <li key={index}>
                      <b>{[ingredient.amount, ingredient.unit].filter(Boolean).join(' ') || '·'}</b>
                      <span>{ingredient.name}{ingredient.isOptional ? <em> optional</em> : null}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="recipe-form-section">
              <div className="recipe-form-section__title"><ListChecks /><div><span>03</span><h2>How it&rsquo;s made</h2></div></div>
              <p className="recipe-form-section__hint">One step per line. Savry numbers them, and the app can read them aloud and set timers.</p>
              <p className="lines-editor__dictate">On a phone, tap the microphone on your keyboard and say each step; say &ldquo;new line&rdquo; between them.</p>
              <textarea
                className="lines-editor"
                autoFocus
                value={draft.instructionText}
                onChange={(event) => setDraft((current) => ({ ...current, instructionText: event.target.value, instructions: parseInstructionLines(event.target.value) }))}
                placeholder={'Season the chicken and let it sit while the pan heats.\nSear 4 minutes a side, then add the garlic and lemon.\nRest 5 minutes before slicing.'}
                rows={10}
                spellCheck
              />
              {validInstructions.length > 0 && (
                <ol className="lines-preview lines-preview--steps" aria-label="How Savry read your method">
                  {validInstructions.map((instruction, index) => <li key={index}><b>{index + 1}</b><span>{instruction}</span></li>)}
                </ol>
              )}
              <label className="recipe-field"><span>Cook&rsquo;s notes <small>optional</small></span><textarea value={draft.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Storage, substitutions, serving ideas, or what you learned…" rows={3} maxLength={2000} /></label>
            </div>
          )}

          {step === 3 && (
            <div className="recipe-form-section recipe-review">
              <div className="recipe-form-section__title"><Send /><div><span>04</span><h2>Ready for the shared table?</h2></div></div>
              <div className="recipe-review__stats">
                <span><Clock3 /> <b>{totalTime}</b> minutes</span>
                <span><Users /> <b>{draft.servings}</b> servings</span>
                <span><ListChecks /> <b>{validIngredients.length}</b> ingredients</span>
              </div>
              <div className="recipe-review__checklist">
                <p className={draft.title.trim() ? 'is-complete' : ''}><Check /> Clear recipe name</p>
                <p className={validIngredients.length ? 'is-complete' : ''}><Check /> Ingredient list</p>
                <p className={validInstructions.length ? 'is-complete' : ''}><Check /> Cooking method</p>
                <p className={draft.imageBase64 ? 'is-complete' : ''}><Check /> Finished-dish photo <small>recommended</small></p>
              </div>
              <details className="recipe-more">
                <summary>More details <small>all optional</small></summary>
                <div className="recipe-field-grid">
                  <label className="recipe-field"><span>Equipment <small>comma separated</small></span><input value={draft.equipment} onChange={(event) => update('equipment', event.target.value)} placeholder="sheet pan, blender" /></label>
                  <label className="recipe-field"><span>Oven temperature °F</span><input type="number" min="100" max="700" value={draft.ovenTemp} onChange={(event) => update('ovenTemp', event.target.value)} placeholder="425" /></label>
                  <label className="recipe-field"><span>Tags <small>comma separated</small></span><input value={draft.tags} onChange={(event) => update('tags', event.target.value)} placeholder="one pan, weeknight, cozy" /></label>
                  <label className="recipe-field"><span>Dietary tags</span><input value={draft.dietaryTags} onChange={(event) => update('dietaryTags', event.target.value)} placeholder="vegetarian, gluten-free" /></label>
                  <label className="recipe-field"><span>Allergens</span><input value={draft.allergens} onChange={(event) => update('allergens', event.target.value)} placeholder="dairy, peanuts" /></label>
                  <label className="recipe-field"><span>Original source URL <small>if adapted</small></span><input type="url" value={draft.sourceURL} onChange={(event) => update('sourceURL', event.target.value)} placeholder="https://…" /></label>
                </div>
              </details>
              <label className="recipe-rights">
                <input type="checkbox" checked={draft.rightsAttested} onChange={(event) => update('rightsAttested', event.target.checked)} />
                <span>I created this recipe or have permission to publish it, including its photo. I understand it will be visible to the Savry community.</span>
              </label>
              <p className="recipe-review__fineprint">Your recipe will be public and shareable. Community comments and structured improvements are coming later in the preview. See the <Link href="/terms">community terms</Link>.</p>
              <button type="button" className="recipe-publish-button" onClick={publish} disabled={busy || !draft.rightsAttested}><Send size={19} /> {busy ? 'Publishing…' : 'Publish to Savry'}</button>
            </div>
          )}

          {message && <p className="recipe-composer__message" role="alert">{message}</p>}
          <div className="recipe-composer__controls">
            <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}><ArrowLeft size={17} /> Back</button>
            {step < steps.length - 1 && <button type="button" className="is-primary" onClick={nextStep}>Continue <ArrowRight size={17} /></button>}
          </div>
        </section>

      </div>
    </main>
  )
}
