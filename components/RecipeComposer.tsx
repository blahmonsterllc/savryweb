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
  Minus,
  Plus,
  Send,
  Trash2,
  Users,
} from 'lucide-react'
import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import { newPhotoPath } from '@/lib/photo-upload'

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
  rightsAttested: boolean
}

const DRAFT_KEY = 'savry_web_recipe_draft_v1'
const steps = ['The dish', 'Ingredients', 'Method', 'Review']
const categories = ['Breakfast', 'Lunch', 'Dinner', 'Soup', 'Salad', 'Side', 'Dessert', 'Snack', 'Drink', 'Sauce', 'Other']
const units = ['', 'tsp', 'tbsp', 'cup', 'oz', 'lb', 'g', 'kg', 'ml', 'l', 'pinch', 'clove', 'can', 'package']

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
    ingredients: [
      { amount: '', unit: '', name: '', isOptional: false },
      { amount: '', unit: '', name: '', isOptional: false },
      { amount: '', unit: '', name: '', isOptional: false },
    ],
    instructions: ['', '', ''],
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
      const next = saved ? { ...blankDraft(), ...JSON.parse(saved) } : blankDraft()
      next.clientRecipeId ||= window.crypto.randomUUID()
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

  function updateIngredient(index: number, changes: Partial<IngredientDraft>) {
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient, itemIndex) => itemIndex === index ? { ...ingredient, ...changes } : ingredient),
    }))
  }

  function updateInstruction(index: number, value: string) {
    setDraft((current) => ({
      ...current,
      instructions: current.instructions.map((instruction, itemIndex) => itemIndex === index ? value : instruction),
    }))
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

      const { data: result, error: publishError } = await supabase.rpc('publish_recipe_v2', {
        payload: {
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
              <label className="recipe-field recipe-field--hero"><span>Recipe name</span><input autoFocus value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder="Example: Roasted tomato white bean skillet" maxLength={200} /></label>
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
              <div className="recipe-form-section__title"><ListChecks /><div><span>02</span><h2>Build the ingredient list</h2></div></div>
              <p className="recipe-form-section__hint">Keep the amount and unit separate so Savry can scale servings and build an accurate grocery list.</p>
              <div className="ingredient-editor">
                {draft.ingredients.map((ingredient, index) => (
                  <div className="ingredient-editor__row" key={index}>
                    <span className="ingredient-editor__number">{index + 1}</span>
                    <input aria-label={`Ingredient ${index + 1} amount`} value={ingredient.amount} onChange={(event) => updateIngredient(index, { amount: event.target.value })} placeholder="1 1/2" />
                    <select aria-label={`Ingredient ${index + 1} unit`} value={ingredient.unit} onChange={(event) => updateIngredient(index, { unit: event.target.value })}>{units.map((unit) => <option key={unit} value={unit}>{unit || 'unit'}</option>)}</select>
                    <input aria-label={`Ingredient ${index + 1} name`} value={ingredient.name} onChange={(event) => updateIngredient(index, { name: event.target.value })} placeholder="ingredient" maxLength={200} />
                    <label className="ingredient-editor__optional"><input type="checkbox" checked={ingredient.isOptional} onChange={(event) => updateIngredient(index, { isOptional: event.target.checked })} /> optional</label>
                    <button type="button" aria-label={`Remove ingredient ${index + 1}`} onClick={() => update('ingredients', draft.ingredients.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={17} /></button>
                  </div>
                ))}
              </div>
              <button type="button" className="recipe-add-row" onClick={() => update('ingredients', [...draft.ingredients, { amount: '', unit: '', name: '', isOptional: false }])}><Plus size={17} /> Add ingredient</button>
              <div className="recipe-field-grid">
                <label className="recipe-field"><span>Equipment <small>comma separated</small></span><input value={draft.equipment} onChange={(event) => update('equipment', event.target.value)} placeholder="sheet pan, blender" /></label>
                <label className="recipe-field"><span>Oven temperature °F <small>optional</small></span><input type="number" min="100" max="700" value={draft.ovenTemp} onChange={(event) => update('ovenTemp', event.target.value)} placeholder="425" /></label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="recipe-form-section">
              <div className="recipe-form-section__title"><ListChecks /><div><span>03</span><h2>Write the method</h2></div></div>
              <p className="recipe-form-section__hint">Use one clear action per step. Timers and hands-free cooking tools can read these in the app.</p>
              <div className="method-editor">
                {draft.instructions.map((instruction, index) => (
                  <div className="method-editor__row" key={index}>
                    <span>{index + 1}</span>
                    <textarea aria-label={`Step ${index + 1}`} value={instruction} onChange={(event) => updateInstruction(index, event.target.value)} placeholder={index === 0 ? 'Heat the oven and prepare the pan…' : 'Describe the next step…'} rows={3} maxLength={2000} />
                    <button type="button" aria-label={`Remove step ${index + 1}`} onClick={() => update('instructions', draft.instructions.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={17} /></button>
                  </div>
                ))}
              </div>
              <button type="button" className="recipe-add-row" onClick={() => update('instructions', [...draft.instructions, ''])}><Plus size={17} /> Add step</button>
              <label className="recipe-field"><span>Cook’s notes <small>optional</small></span><textarea value={draft.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Storage, substitutions, serving ideas, or what you learned…" rows={4} maxLength={2000} /></label>
              <div className="recipe-field-grid">
                <label className="recipe-field"><span>Tags <small>comma separated</small></span><input value={draft.tags} onChange={(event) => update('tags', event.target.value)} placeholder="one pan, weeknight, cozy" /></label>
                <label className="recipe-field"><span>Dietary tags</span><input value={draft.dietaryTags} onChange={(event) => update('dietaryTags', event.target.value)} placeholder="vegetarian, gluten-free" /></label>
                <label className="recipe-field"><span>Allergens</span><input value={draft.allergens} onChange={(event) => update('allergens', event.target.value)} placeholder="dairy, peanuts" /></label>
                <label className="recipe-field"><span>Original source URL <small>if adapted</small></span><input type="url" value={draft.sourceURL} onChange={(event) => update('sourceURL', event.target.value)} placeholder="https://…" /></label>
              </div>
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

        <aside className="recipe-phone-preview" aria-label="Recipe preview">
          <div className="recipe-phone-preview__notch" />
          <div className="recipe-phone-preview__bar"><span>9:41</span><b>S</b><span>•••</span></div>
          {draft.imageBase64 ? <img src={`data:image/jpeg;base64,${draft.imageBase64}`} alt="" /> : <div className="recipe-phone-preview__photo"><ChefHat /><span>Your photo</span></div>}
          <div className="recipe-phone-preview__body">
            <span className="recipe-phone-preview__category">{draft.category || 'Your kitchen'}</span>
            <h2>{draft.title || 'Your recipe title'}</h2>
            <p>{draft.description || 'A short introduction will appear here when you share this recipe.'}</p>
            <div className="recipe-phone-preview__facts"><span><Clock3 /> {totalTime} min</span><span><Users /> {draft.servings || 1}</span></div>
            <h3>Ingredients</h3>
            {(validIngredients.length ? validIngredients : [{ name: 'Your ingredients appear here', amount: '', unit: '', isOptional: false }]).slice(0, 5).map((ingredient, index) => (
              <div className="recipe-phone-preview__ingredient" key={index}><i /> <span>{[ingredient.amount, ingredient.unit, ingredient.name].filter(Boolean).join(' ')}</span></div>
            ))}
            {validIngredients.length > 5 && <small>+ {validIngredients.length - 5} more</small>}
          </div>
        </aside>
      </div>
    </main>
  )
}
