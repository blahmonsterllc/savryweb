'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowRight, BookOpen, Camera, Check, ExternalLink, LogOut, Plus, Trash2 } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import { memberPost } from '@/lib/member-fetch'
import { SOCIAL_NETWORKS, socialLinkURL } from '@/lib/social-links'
import { SITE_URL } from '@/lib/site-url'
import RecipeShareBar from '@/components/RecipeShareBar'

type Profile = {
  id: string
  displayName: string
  username: string | null
  bio: string | null
  avatarUrl: string | null
  socialLinks: Record<string, string>
  emailOptIn: boolean
  tier: string
  email: string | null
  emailConfirmed: boolean
  providers: string[]
  memberSince: string
  recipeCount: number
  madeCount: number
}

type RecipeRow = { id: string; slug: string; title: string; image_url: string | null; image_path: string | null; made_count: number; version: number; visibility: 'public' | 'unlisted' | 'private'; review_hold: boolean }

const SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'social', label: 'Social links' },
  { id: 'recipes', label: 'Your recipes' },
  { id: 'saved', label: 'Saved recipes' },
  { id: 'collections', label: 'Collections' },
  { id: 'email', label: 'Email' },
  { id: 'membership', label: 'Membership' },
  { id: 'account', label: 'Account' },
]

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'S'
}

// The database raises short, user-facing messages; anything else gets a generic line.
function friendly(error: unknown): string {
  const message = (error as { message?: string })?.message ?? ''
  if (message && message.length < 160 && !/^(TypeError|PGRST|JSON|permission)/i.test(message) && !message.includes('violates')) return message
  if (/unique|duplicate/i.test(message)) return 'That username is taken.'
  return 'Something went wrong. Please try again.'
}

function memberSince(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  } catch {
    return ''
  }
}

/** Downscale a chosen photo to a square JPEG so avatars stay small and quick. */
async function squareJPEG(file: File, size = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not process the image')
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not process the image'))), 'image/jpeg', 0.86))
}

export default function AccountHub() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [recipes, setRecipes] = useState<RecipeRow[]>([])
  const [status, setStatus] = useState<'loading' | 'signed-out' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let active = true
    const supabase = getSupabaseBrowserClient()
    async function load() {
      const { data: authData } = await supabase.auth.getUser()
      if (!active) return
      if (!authData.user) {
        setStatus('signed-out')
        return
      }
      const [{ data: me, error: profileError }, { data: rows, error: recipesError }] = await Promise.all([
        supabase.rpc('my_profile'),
        supabase.from('recipes').select('id,slug,title,image_url,image_path,made_count,version,visibility,review_hold').eq('author_id', authData.user.id).order('created_at', { ascending: false }).limit(100),
      ])
      if (!active) return
      if (profileError || recipesError || !me) {
        setStatus('error')
        return
      }
      setProfile(me as Profile)
      setRecipes(rows ?? [])
      setStatus('ready')
    }
    load().catch(() => active && setStatus('error'))
    return () => { active = false }
  }, [])

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut()
    setProfile(null)
    setStatus('signed-out')
  }

  if (status === 'loading') return <div className="account-state">Opening your Savry kitchen…</div>

  if (status === 'signed-out') {
    return (
      <div className="account-state account-state--signin">
        <BookOpen size={34} />
        <h2>Join the first cooks at the table.</h2>
        <p>Create one community account with Apple or email. Use it to publish recipes, join the discussion, and connect the Savry app.</p>
        <Link className="button button--coral" href="/app-login?returnTo=/account">Create an account or sign in <ArrowRight size={18} /></Link>
      </div>
    )
  }

  if (status === 'error' || !profile) return <div className="account-state">We could not open your account right now. Please try again shortly.</div>

  const cookURL = profile.username ? `${SITE_URL}/cooks/${profile.username}` : null

  return (
    <div className="account-settings">
      <nav className="settings-nav" aria-label="Account sections">
        <div className="settings-nav__identity">
          <Avatar profile={profile} />
          <div>
            <strong>{profile.displayName}</strong>
            <span>{profile.username ? `@${profile.username}` : 'No username yet'}</span>
          </div>
        </div>
        <ul>
          {SECTIONS.map((section) => (
            <li key={section.id}><a href={`#${section.id}`}>{section.label}</a></li>
          ))}
        </ul>
        <button type="button" className="settings-nav__signout" onClick={signOut}><LogOut size={16} /> Sign out</button>
      </nav>

      <div className="settings-sections">
        <ProfileSection profile={profile} onChange={setProfile} cookURL={cookURL} />
        <SocialSection profile={profile} onChange={setProfile} cookURL={cookURL} />
        <RecipesSection recipes={recipes} />
        <SavedSection />
        <CollectionsSection username={profile.username ?? null} />
        <EmailSection profile={profile} onChange={setProfile} />
        <MembershipSection profile={profile} />
        <AccountSection profile={profile} onSignOut={signOut} />
      </div>
    </div>
  )
}

function Avatar({ profile, size = 56 }: { profile: Profile; size?: number }) {
  return profile.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profile.avatarUrl} alt="" className="settings-avatar" width={size} height={size} style={{ width: size, height: size }} />
  ) : (
    <span className="settings-avatar settings-avatar--initials" style={{ width: size, height: size }} aria-hidden="true">{initials(profile.displayName)}</span>
  )
}

function SectionCard({ id, title, lede, children }: { id: string; title: string; lede: string; children: React.ReactNode }) {
  return (
    <section id={id} className="settings-card" aria-labelledby={`${id}-title`}>
      <header>
        <h2 id={id + '-title'}>{title}</h2>
        <p>{lede}</p>
      </header>
      {children}
    </section>
  )
}

function ProfileSection({ profile, onChange, cookURL }: { profile: Profile; onChange: (p: Profile) => void; cookURL: string | null }) {
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [username, setUsername] = useState(profile.username ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const fileInput = useRef<HTMLInputElement>(null)

  function onUsernameChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value.replace(/^@/, '').toLowerCase()
    setUsername(value)
    setSaved(false)
    window.clearTimeout(timer.current)
    if (!value || value === (profile.username ?? '')) {
      setAvailability('idle')
      return
    }
    setAvailability('checking')
    timer.current = window.setTimeout(async () => {
      const { data } = await getSupabaseBrowserClient().rpc('username_available', { candidate: value })
      setAvailability(data ? 'available' : 'taken')
    }, 400)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    const { data, error: rpcError } = await getSupabaseBrowserClient().rpc('update_my_profile', {
      payload: { displayName: displayName.trim(), username: username.trim(), bio: bio.trim() },
    })
    setBusy(false)
    if (rpcError || !data) {
      setError(friendly(rpcError))
      return
    }
    onChange(data as Profile)
    setAvailability('idle')
    setSaved(true)
  }

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const blob = await squareJPEG(file)
      const supabase = getSupabaseBrowserClient()
      const path = `${profile.id}/avatar-${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage.from('recipe-images').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
      if (uploadError) throw uploadError
      const { data, error: rpcError } = await supabase.rpc('update_my_profile', { payload: { avatarPath: path } })
      if (rpcError || !data) throw rpcError ?? new Error('Could not save the photo')
      onChange(data as Profile)
    } catch (caught) {
      setError(friendly(caught))
    } finally {
      setUploading(false)
    }
  }

  async function removePhoto() {
    setUploading(true)
    setError(null)
    const { data, error: rpcError } = await getSupabaseBrowserClient().rpc('update_my_profile', { payload: { avatarPath: '' } })
    setUploading(false)
    if (rpcError || !data) {
      setError(friendly(rpcError))
      return
    }
    onChange(data as Profile)
  }

  return (
    <SectionCard id="profile" title="Profile" lede="How other cooks see you on recipes, comments, and your cook page.">
      <div className="settings-avatar-row">
        <Avatar profile={profile} size={84} />
        <div>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={choosePhoto} />
          <button type="button" className="button button--ghost-dark" onClick={() => fileInput.current?.click()} disabled={uploading}>
            <Camera size={16} /> {uploading ? 'Saving…' : profile.avatarUrl ? 'Change photo' : 'Add a photo'}
          </button>
          {profile.avatarUrl && <button type="button" className="text-link text-link--muted" onClick={removePhoto} disabled={uploading}>Remove</button>}
          <small>Square photos look best. Up to 2 MB.</small>
        </div>
      </div>

      <form onSubmit={save} className="community-login__form settings-form">
        <label>
          Display name
          <input type="text" required maxLength={60} value={displayName} onChange={(e) => { setDisplayName(e.target.value); setSaved(false) }} autoComplete="nickname" />
          <small>Your Apple or email name was used to start. Change it to anything you like.</small>
        </label>
        <label>
          Username
          <span className="settings-handle">
            <span aria-hidden="true">@</span>
            <input type="text" maxLength={30} value={username} onChange={onUsernameChange} placeholder="pick-a-handle" autoComplete="username" spellCheck={false} />
          </span>
          <small className={availability === 'taken' ? 'is-bad' : availability === 'available' ? 'is-good' : ''}>
            {availability === 'checking' && 'Checking…'}
            {availability === 'available' && 'Available'}
            {availability === 'taken' && 'Taken or not allowed. Try another.'}
            {availability === 'idle' && (username ? `Your page: savry.io/cooks/${username}` : '3 to 30 letters, numbers, dots, dashes, or underscores. Gives you a public cook page.')}
          </small>
        </label>
        <label>
          Bio
          <textarea maxLength={280} rows={3} value={bio} onChange={(e) => { setBio(e.target.value); setSaved(false) }} placeholder="What do you love to cook?" />
          <small>{280 - bio.length} characters left. Put links in Social links below.</small>
        </label>
        {error && <p className="community-login__error" role="alert">{error}</p>}
        <div className="settings-actions">
          <button type="submit" className="button button--coral" disabled={busy || availability === 'taken' || availability === 'checking'}>
            {busy ? 'Saving…' : saved ? <><Check size={16} /> Saved</> : 'Save profile'}
          </button>
          {cookURL && <Link href={cookURL.replace(SITE_URL, '')} className="text-link">View your cook page <ExternalLink size={14} /></Link>}
        </div>
      </form>
    </SectionCard>
  )
}

function SocialSection({ profile, onChange, cookURL }: { profile: Profile; onChange: (p: Profile) => void; cookURL: string | null }) {
  const [links, setLinks] = useState<Record<string, string>>(() => ({ ...profile.socialLinks }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    const { data, error: rpcError } = await getSupabaseBrowserClient().rpc('update_my_profile', { payload: { socialLinks: links } })
    setBusy(false)
    if (rpcError || !data) {
      setError(friendly(rpcError))
      return
    }
    onChange(data as Profile)
    setLinks({ ...(data as Profile).socialLinks })
    setSaved(true)
  }

  return (
    <SectionCard id="social" title="Social links" lede="Shown on your cook page so people who find your recipes can follow you elsewhere.">
      <form onSubmit={save} className="community-login__form settings-form settings-form--two">
        {SOCIAL_NETWORKS.map((network) => (
          <label key={network.key}>
            {network.label}
            <span className="settings-handle">
              {network.key !== 'website' && <span aria-hidden="true">@</span>}
              <input
                type={network.key === 'website' ? 'url' : 'text'}
                value={links[network.key] ?? ''}
                placeholder={network.placeholder}
                maxLength={network.key === 'website' ? 200 : 40}
                spellCheck={false}
                onChange={(e) => { setLinks({ ...links, [network.key]: e.target.value }); setSaved(false) }}
              />
            </span>
          </label>
        ))}
        {error && <p className="community-login__error settings-form__wide" role="alert">{error}</p>}
        <div className="settings-actions settings-form__wide">
          <button type="submit" className="button button--coral" disabled={busy}>{busy ? 'Saving…' : saved ? <><Check size={16} /> Saved</> : 'Save links'}</button>
          {Object.entries(profile.socialLinks).length > 0 && (
            <span className="settings-linklist">
              {Object.entries(profile.socialLinks).map(([key, value]) => {
                const url = socialLinkURL(key, value)
                return url ? <a key={key} href={url} target="_blank" rel="me noopener noreferrer">{SOCIAL_NETWORKS.find((n) => n.key === key)?.label ?? key} <ExternalLink size={12} /></a> : null
              })}
            </span>
          )}
        </div>
      </form>

      <div className="settings-share">
        <h3>Share your cook page</h3>
        {cookURL ? (
          <>
            <p>Post it to your profiles so followers can find every recipe you share.</p>
            <RecipeShareBar title={`${profile.displayName} on Savry`} url={cookURL} imageUrl={profile.avatarUrl} />
          </>
        ) : (
          <p>Pick a username in Profile above and you get a page at savry.io/cooks/your-name to share.</p>
        )}
      </div>
    </SectionCard>
  )
}

function RecipesSection({ recipes: initial }: { recipes: RecipeRow[] }) {
  const [recipes, setRecipes] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => setRecipes(initial), [initial])

  function standing(recipe: RecipeRow): string {
    if (recipe.visibility === 'public') return `On the table · ${recipe.made_count} made it · version ${recipe.version}`
    if (recipe.review_hold) return 'In review · a Savry editor reads it before it joins the table'
    return 'Private · only you can see it'
  }

  async function withdraw(recipe: RecipeRow) {
    setBusy(recipe.slug)
    setMessage(null)
    const { error } = await getSupabaseBrowserClient().rpc('unpublish_recipe', { target_slug: recipe.slug })
    if (error) {
      setBusy(null)
      return setMessage(error.message)
    }
    // The recipe's cached pages would show it for a few more minutes; refresh them now. Best effort.
    await memberPost('/api/recipes/refresh', { slug: recipe.slug }).catch(() => undefined)
    setBusy(null)
    setRecipes((current) => current.map((r) => (r.slug === recipe.slug ? { ...r, visibility: 'private', review_hold: false } : r)))
  }

  async function remove(recipe: RecipeRow) {
    setBusy(recipe.slug)
    setMessage(null)
    // The server deletes the recipe as this cook, removes its photos (the browser
    // cannot list or delete storage objects), and refreshes its cached pages.
    const result = await memberPost('/api/recipes/delete', { slug: recipe.slug }).catch(() => null)
    setBusy(null)
    setConfirming(null)
    if (!result?.ok) return setMessage(result?.data.error || 'Could not delete the recipe. Please try again.')
    setRecipes((current) => current.filter((r) => r.slug !== recipe.slug))
  }

  return (
    <SectionCard id="recipes" title="Your recipes" lede="Everything you have shared with the community, and anything waiting for review.">
      <div className="settings-actions">
        <Link href="/recipes/new" className="button button--coral"><Plus size={16} /> Add a recipe</Link>
      </div>
      {message && <p className="settings-note" role="alert">{message}</p>}
      {recipes.length ? (
        <ul className="account-library__list">
          {recipes.map((recipe) => (
            <li key={recipe.id} className="account-library__saved">
              {(() => {
                const body = (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {recipe.image_url ? <img src={recipe.image_url} alt="" /> : <span className="account-library__initial">{recipe.title.charAt(0)}</span>}
                    <div><strong>{recipe.title}</strong><span>{standing(recipe)}</span></div>
                  </>
                )
                // Only public recipes have a page; in-review and private ones would 404.
                return recipe.visibility === 'public' ? <Link href={`/recipes/${recipe.slug}`}>{body}</Link> : <div className="account-library__unlinked">{body}</div>
              })()}
              {confirming === recipe.slug ? (
                <span className="account-library__confirm">
                  <button type="button" className="account-library__remove account-library__remove--danger" disabled={busy === recipe.slug} onClick={() => remove(recipe)}>{busy === recipe.slug ? 'Deleting…' : 'Yes, delete it'}</button>
                  <button type="button" className="account-library__remove" disabled={busy === recipe.slug} onClick={() => setConfirming(null)}>Keep</button>
                </span>
              ) : (
                <span className="account-library__confirm">
                  {recipe.visibility === 'public' && <button type="button" className="account-library__remove" disabled={busy === recipe.slug} onClick={() => withdraw(recipe)}>{busy === recipe.slug ? 'Working…' : 'Take off the table'}</button>}
                  <button type="button" className="account-library__remove" disabled={busy === recipe.slug} onClick={() => setConfirming(recipe.slug)}>Delete</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="account-library__empty">
          <p>You have not shared a recipe yet. Start with the dish friends or family always ask you to make.</p>
        </div>
      )}
    </SectionCard>
  )
}

type CollectionCard = { id: string; slug: string; title: string; description: string | null; isPublic: boolean; itemCount: number; coverUrls: string[] }

/** The cook's collections: start one, make it private or public, or remove it. Recipes go in from each recipe's Collect button. */
function CollectionsSection({ username }: { username: string | null }) {
  const [collections, setCollections] = useState<CollectionCard[] | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getSupabaseBrowserClient().rpc('my_collections').then(({ data, error }: { data: unknown; error: { message: string } | null }) => {
      if (!active) return
      if (error) return setMessage(error.message)
      setCollections(((data as { collections?: CollectionCard[] } | null)?.collections ?? []))
    })
    return () => { active = false }
  }, [])

  async function create() {
    const name = title.trim()
    if (!name) return
    setBusy('new')
    setMessage(null)
    const { data, error } = await getSupabaseBrowserClient().rpc('create_collection', { title: name })
    setBusy(null)
    if (error) return setMessage(error.message)
    setCollections((list) => [data as CollectionCard, ...(list ?? [])])
    setTitle('')
  }

  async function setPublic(collection: CollectionCard, isPublic: boolean) {
    setBusy(collection.slug)
    const { data, error } = await getSupabaseBrowserClient().rpc('update_collection', { target_slug: collection.slug, payload: { isPublic } })
    setBusy(null)
    if (error) return setMessage(error.message)
    setCollections((list) => (list ?? []).map((c) => (c.slug === collection.slug ? (data as CollectionCard) : c)))
  }

  async function remove(collection: CollectionCard) {
    setBusy(collection.slug)
    const { error } = await getSupabaseBrowserClient().rpc('delete_collection', { target_slug: collection.slug })
    setBusy(null)
    setConfirming(null)
    if (error) return setMessage(error.message)
    setCollections((list) => (list ?? []).filter((c) => c.slug !== collection.slug))
  }

  return (
    <SectionCard id="collections" title="Collections" lede="Named lists of recipes you can share: Sunday roasts, kid-approved, the holiday table. Add recipes from the Collect button on any recipe.">
      <form className="settings-inline-form" onSubmit={(event) => { event.preventDefault(); create() }}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="New collection, e.g. Weeknight dinners" maxLength={80} aria-label="New collection name" />
        <button type="submit" className="button button--coral" disabled={busy === 'new' || !title.trim()}><Plus size={16} /> Start</button>
      </form>
      {message && <p className="settings-note" role="alert">{message}</p>}
      {collections && collections.length > 0 ? (
        <ul className="account-library__list">
          {collections.map((collection) => (
            <li key={collection.id} className="account-library__saved">
              {username ? (
                <Link href={`/cooks/${username}/collections/${collection.slug}`}>
                  <span className="account-library__initial">{collection.itemCount}</span>
                  <div><strong>{collection.title}</strong><span>{collection.isPublic ? 'Public' : 'Private'} · {collection.itemCount} recipe{collection.itemCount === 1 ? '' : 's'}</span></div>
                </Link>
              ) : (
                <span className="account-library__static">
                  <span className="account-library__initial">{collection.itemCount}</span>
                  <div><strong>{collection.title}</strong><span>{collection.isPublic ? 'Public' : 'Private'} · {collection.itemCount} recipe{collection.itemCount === 1 ? '' : 's'} · pick a username to get a page for it</span></div>
                </span>
              )}
              {confirming === collection.slug ? (
                <span className="account-library__confirm">
                  <button type="button" className="account-library__remove account-library__remove--danger" disabled={busy === collection.slug} onClick={() => remove(collection)}>{busy === collection.slug ? 'Removing…' : 'Yes, remove it'}</button>
                  <button type="button" className="account-library__remove" onClick={() => setConfirming(null)}>Keep</button>
                </span>
              ) : (
                <span className="account-library__confirm">
                  <button type="button" className="account-library__remove" disabled={busy === collection.slug} onClick={() => setPublic(collection, !collection.isPublic)}>{collection.isPublic ? 'Make private' : 'Make public'}</button>
                  <button type="button" className="account-library__remove" onClick={() => setConfirming(collection.slug)}>Remove</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : collections ? (
        <div className="account-library__empty"><p>No collections yet. Start one above, then add recipes from the Collect button on any recipe.</p></div>
      ) : null}
    </SectionCard>
  )
}

type SavedCard = { id: string; slug: string; title: string; imageUrl: string | null; authorName: string; totalTime: number }

/** Recipes the member saved, here or in the app. The list is the same in both. */
function SavedSection() {
  const [saved, setSaved] = useState<SavedCard[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getSupabaseBrowserClient()
      .rpc('my_saved_recipes', { result_limit: 100 })
      .then(({ data }: { data: { recipes?: SavedCard[] } | null }) => { if (active) setSaved(data?.recipes ?? []) })
    return () => { active = false }
  }, [])

  async function remove(slug: string) {
    setBusy(slug)
    const { error } = await getSupabaseBrowserClient().rpc('toggle_recipe_save', { target_slug: slug })
    setBusy(null)
    if (!error) setSaved((current) => (current ?? []).filter((recipe) => recipe.slug !== slug))
  }

  return (
    <SectionCard id="saved" title="Saved recipes" lede="Recipes you saved on Savry.io or in the Savry app. The list is the same in both.">
      {saved === null ? (
        <p className="settings-hint">Loading…</p>
      ) : saved.length ? (
        <ul className="account-library__list">
          {saved.map((recipe) => (
            <li key={recipe.id} className="account-library__saved">
              <Link href={`/recipes/${recipe.slug}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {recipe.imageUrl ? <img src={recipe.imageUrl} alt="" /> : <span className="account-library__initial">{recipe.title.charAt(0)}</span>}
                <div><strong>{recipe.title}</strong><span>by {recipe.authorName}{recipe.totalTime ? ` · ${recipe.totalTime} min` : ''}</span></div>
              </Link>
              <button type="button" className="account-library__remove" disabled={busy === recipe.slug} onClick={() => remove(recipe.slug)}>Remove</button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="account-library__empty">
          <p>Nothing saved yet. Tap Save on any recipe to keep it here.</p>
          <Link href="/recipes" className="button button--light">Browse recipes</Link>
        </div>
      )}
    </SectionCard>
  )
}

function EmailSection({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle(event: ChangeEvent<HTMLInputElement>) {
    setBusy(true)
    setError(null)
    const { data, error: rpcError } = await getSupabaseBrowserClient().rpc('update_my_profile', { payload: { emailOptIn: event.target.checked } })
    setBusy(false)
    if (rpcError || !data) {
      setError(friendly(rpcError))
      return
    }
    onChange(data as Profile)
  }

  return (
    <SectionCard id="email" title="Email" lede="Sign-in and security emails always arrive. Everything else is up to you.">
      <dl className="settings-facts">
        <div><dt>Address</dt><dd>{profile.email ?? 'Hidden by Apple private relay'}{profile.emailConfirmed ? '' : ' · not confirmed yet'}</dd></div>
        <div><dt>Sign-in method</dt><dd>{profile.providers.includes('apple') ? 'Apple' : 'Email and password'}</dd></div>
      </dl>
      <label className="settings-toggle">
        <input type="checkbox" checked={profile.emailOptIn} onChange={toggle} disabled={busy} />
        <span><strong>Savry updates</strong><small>Occasional news about the community and the app. No more than a couple a month.</small></span>
      </label>
      {error && <p className="community-login__error" role="alert">{error}</p>}
      {profile.providers.includes('email') && !profile.providers.includes('apple') && (
        <p className="settings-note">To change your password, sign out and use “Forgot password?” on the sign-in page.</p>
      )}
    </SectionCard>
  )
}

function MembershipSection({ profile }: { profile: Profile }) {
  const plus = profile.tier === 'plus' || profile.tier === 'pro'
  return (
    <SectionCard id="membership" title="Membership" lede={plus ? 'Thanks for supporting Savry.' : 'The community is free. Savry+ adds the app’s kitchen tools.'}>
      <dl className="settings-facts">
        <div><dt>Plan</dt><dd>{plus ? 'Savry+' : 'Free community account'}</dd></div>
        <div><dt>Member since</dt><dd>{memberSince(profile.memberSince)}</dd></div>
        <div><dt>Recipes shared</dt><dd>{profile.recipeCount}</dd></div>
        <div><dt>Times cooked by others</dt><dd>{profile.madeCount}</dd></div>
      </dl>
      <div className="settings-actions">
        {plus ? (
          <p className="settings-note">Savry+ renews through Apple. Change or cancel it in the Savry app under Settings, or in your iPhone’s Subscriptions.</p>
        ) : (
          <Link href="/savry-plus" className="button button--ghost-dark">See what Savry+ adds <ArrowRight size={16} /></Link>
        )}
      </div>
    </SectionCard>
  )
}

function AccountSection({ profile, onSignOut }: { profile: Profile; onSignOut: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function deleteAccount() {
    setBusy(true)
    setError(null)
    // The server removes every photo in this cook's folder along with the account.
    const result = await memberPost('/api/account/delete').catch(() => null)
    if (!result?.ok) {
      setBusy(false)
      setError(friendly({ message: result?.data.error }))
      return
    }
    await getSupabaseBrowserClient().auth.signOut()
    window.location.assign('/?deleted=1')
  }

  return (
    <SectionCard id="account" title="Account" lede="Sign out here, or close your account for good.">
      <div className="settings-actions">
        <button type="button" className="button button--ghost-dark" onClick={onSignOut}><LogOut size={16} /> Sign out</button>
      </div>
      <div className="settings-danger">
        <h3>Delete your account</h3>
        <p>Removes your Savry account, every recipe you published, and your comments, tweaks, and photos. Recipes saved in the Savry app on your phone are not affected. This cannot be undone.</p>
        <p>Savry+ is billed by Apple and is not cancelled by this; cancel it in your iPhone&rsquo;s Subscriptions if you want it to stop. If you keep it, sign in to a new Savry account in the app and the subscription links to that account.</p>
        {confirming ? (
          <div className="settings-danger__confirm">
            <label>
              Type <strong>DELETE</strong> to confirm
              <input type="text" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" spellCheck={false} />
            </label>
            {error && <p className="community-login__error" role="alert">{error}</p>}
            <div className="settings-actions">
              <button type="button" className="button button--danger" disabled={busy || phrase !== 'DELETE'} onClick={deleteAccount}><Trash2 size={16} /> {busy ? 'Deleting…' : `Delete ${profile.displayName}’s account`}</button>
              <button type="button" className="text-link text-link--muted" onClick={() => { setConfirming(false); setPhrase('') }} disabled={busy}>Keep my account</button>
            </div>
          </div>
        ) : (
          <button type="button" className="text-link text-link--danger" onClick={() => setConfirming(true)}><Trash2 size={15} /> Delete my account</button>
        )}
      </div>
    </SectionCard>
  )
}
