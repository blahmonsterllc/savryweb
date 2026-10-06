'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Bookmark, Check, ChefHat } from 'lucide-react'
import FollowButton from '@/components/FollowButton'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import { orderByTaste } from '@/lib/taste-order.mjs'

const CUISINES = ['Italian', 'Mexican', 'Indian', 'Thai', 'Japanese', 'Chinese', 'Korean', 'Vietnamese', 'Middle Eastern', 'Greek', 'French', 'Spanish', 'American', 'Southern', 'Caribbean', 'West African', 'British', 'Vegetarian comfort']
const DIETS = [
  ['vegetarian', 'Vegetarian'], ['vegan', 'Vegan'], ['gluten-free', 'Gluten-free'], ['dairy-free', 'Dairy-free'],
  ['nut-free', 'Nut-free'], ['egg-free', 'Egg-free'], ['pescatarian', 'Pescatarian'], ['halal', 'Halal'], ['kosher', 'Kosher'],
] as const

type Cook = { id: string; username: string | null; displayName: string; chefTitle: string | null; avatarUrl: string | null; recipeCount: number }
type Recipe = { id: string; slug: string; title: string; imageUrl: string | null; category: string | null; cuisine: string | null; dietaryTags: string[]; totalTime: number; authorName: string; saved: boolean }

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'S'
}

/** Three short steps that make the feed worth opening: tastes, cooks, recipes. */
export default function WelcomeFlow() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [cuisines, setCuisines] = useState<string[]>([])
  const [diets, setDiets] = useState<string[]>([])
  const [cooks, setCooks] = useState<Cook[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [followed, setFollowed] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      const supabase = getSupabaseBrowserClient()
      const { data: auth } = await supabase.auth.getUser()
      if (!active) return
      if (!auth.user) return setSignedIn(false)
      setSignedIn(true)
      const [{ data: profile }, { data: suggested }, { data: browse }] = await Promise.all([
        supabase.rpc('my_profile'),
        supabase.rpc('suggested_cooks', { result_limit: 8 }),
        // More than are shown, so the picks from step one can choose which come first.
        supabase.rpc('browse_public_recipes', { sort_by: 'popular', result_limit: 36, result_offset: 0 }),
      ])
      if (!active) return
      setCuisines((profile?.favoriteCuisines as string[] | undefined) ?? [])
      setDiets((profile?.dietTags as string[] | undefined) ?? [])
      setCooks(((suggested as { cooks?: Cook[] } | null)?.cooks ?? []).filter((c) => c.username))
      setRecipes(((browse as { recipes?: Recipe[] } | null)?.recipes ?? []))
    }
    load().catch((e) => active && setError(e?.message || 'Could not load.'))
    return () => { active = false }
  }, [])

  function toggle(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  async function toggleSave(recipe: Recipe) {
    const { data, error: rpcError } = await getSupabaseBrowserClient().rpc('toggle_recipe_save', { target_slug: recipe.slug })
    if (rpcError) return setError(rpcError.message)
    setRecipes((list) => list.map((r) => (r.slug === recipe.slug ? { ...r, saved: Boolean((data as { saved?: boolean } | null)?.saved ?? !r.saved) } : r)))
  }

  async function finish() {
    setBusy(true)
    setError(null)
    const { error: rpcError } = await getSupabaseBrowserClient().rpc('finish_onboarding', { cuisines, diets })
    setBusy(false)
    if (rpcError) return setError(rpcError.message)
    router.push('/feed')
  }

  // The cuisines and diets picked in step one decide which popular recipes are suggested first.
  const suggestions = useMemo(() => orderByTaste(recipes, { cuisines, diets }).slice(0, 9), [recipes, cuisines, diets])

  if (signedIn === false) {
    return (
      <main className="welcome site-shell">
        <div className="feed__empty"><ChefHat size={20} /><p><Link href="/app-login?returnTo=/welcome">Sign in</Link> to set your table.</p></div>
      </main>
    )
  }

  const saved = recipes.filter((r) => r.saved).length

  return (
    <main className="welcome site-shell">
      <header className="welcome__header">
        <span className="eyebrow">Step {step + 1} of 3</span>
        <h1>{step === 0 ? 'What do you like to cook?' : step === 1 ? 'Cooks worth following.' : 'Save a few to start with.'}</h1>
        <p>
          {step === 0 && 'Pick as many as you like. Recipes that fit come first in the ones we suggest; it never limits what you can find.'}
          {step === 1 && 'Their recipes, what they make, and the tweaks they get accepted will show up on your table.'}
          {step === 2 && 'Saved recipes live on your account page and in the Savry app, the same list in both.'}
        </p>
      </header>
      {error && <p className="settings-note" role="alert">{error}</p>}

      {step === 0 && (
        <section className="welcome__step">
          <h2>Cuisines</h2>
          <div className="chip-row">
            {CUISINES.map((c) => (
              <button type="button" key={c} className={`chip ${cuisines.includes(c) ? 'is-on' : ''}`} aria-pressed={cuisines.includes(c)} onClick={() => toggle(cuisines, c, setCuisines)}>{cuisines.includes(c) && <Check size={14} />}{c}</button>
            ))}
          </div>
          <h2>How you eat</h2>
          <div className="chip-row">
            {DIETS.map(([value, label]) => (
              <button type="button" key={value} className={`chip ${diets.includes(value) ? 'is-on' : ''}`} aria-pressed={diets.includes(value)} onClick={() => toggle(diets, value, setDiets)}>{diets.includes(value) && <Check size={14} />}{label}</button>
            ))}
          </div>
          <p className="welcome__fine">Allergies and food restrictions are kept in the Savry app&rsquo;s Food safety profile; they are never guessed from this.</p>
        </section>
      )}

      {step === 1 && (
        <section className="welcome__step">
          {cooks.length === 0 ? <p className="feed__loading">Finding cooks…</p> : (
            <ul className="welcome-cooks">
              {cooks.map((cook) => (
                <li key={cook.id}>
                  <span className="feed-avatar" aria-hidden="true">
                    {cook.avatarUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={cook.avatarUrl} alt="" width={40} height={40} />
                      : <span>{initials(cook.displayName)}</span>}
                  </span>
                  <div>
                    <Link href={`/cooks/${cook.username}`} className="feed-cook">{cook.displayName}</Link>
                    <small>{cook.chefTitle || `${cook.recipeCount} recipe${cook.recipeCount === 1 ? '' : 's'}`}</small>
                  </div>
                  {cook.username && <FollowButton username={cook.username} compact onChange={(s) => setFollowed((n) => n + (s.following ? 1 : -1))} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="welcome__step">
          <ul className="welcome-recipes">
            {suggestions.map((recipe) => (
              <li key={recipe.id} className={recipe.saved ? 'is-saved' : ''}>
                <Link href={`/recipes/${recipe.slug}`} target="_blank" rel="noopener">
                  {recipe.imageUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={recipe.imageUrl} alt="" loading="lazy" />
                    : <span className="welcome-recipes__placeholder">{recipe.title.charAt(0)}</span>}
                </Link>
                <div>
                  <strong>{recipe.title}</strong>
                  <small>{[recipe.category, recipe.totalTime ? `${recipe.totalTime} min` : null, recipe.authorName].filter(Boolean).join(' · ')}</small>
                </div>
                <button type="button" className={`chip chip--save ${recipe.saved ? 'is-on' : ''}`} aria-pressed={recipe.saved} onClick={() => toggleSave(recipe)}>
                  <Bookmark size={14} /> {recipe.saved ? 'Saved' : 'Save'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="welcome__actions">
        {step > 0 ? <button type="button" className="button button--light" onClick={() => setStep(step - 1)}>Back</button> : <span />}
        <span className="welcome__progress">{step === 1 && followed > 0 ? `Following ${followed}` : step === 2 && saved > 0 ? `${saved} saved` : ''}</span>
        {step < 2 ? (
          <button type="button" className="button button--coral" onClick={() => setStep(step + 1)}>Next</button>
        ) : (
          <button type="button" className="button button--coral" onClick={finish} disabled={busy}>{busy ? 'Setting the table…' : 'Set my table'}</button>
        )}
      </footer>
    </main>
  )
}
