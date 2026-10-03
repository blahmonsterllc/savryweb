'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ChefHat, Sparkles, Utensils } from 'lucide-react'
import FollowButton from '@/components/FollowButton'
import MadeItComposer from '@/components/MadeItComposer'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

type Cook = { id: string; username: string | null; displayName: string; chefTitle: string | null; avatarUrl: string | null; followerCount: number; recipeCount: number }
type FeedRecipe = { slug: string; title: string; imageUrl: string | null; description?: string | null; category?: string | null; totalTime?: number; madeCount?: number; saveCount?: number; authorName?: string; authorUsername?: string | null }
type FeedItem =
  | { kind: 'recipe'; at: string; cook: Cook; recipe: FeedRecipe }
  | { kind: 'made'; at: string; cook: Cook; recipe: FeedRecipe; note: string | null; photoUrl: string | null }
  | { kind: 'tweak'; at: string; cook: Cook; recipe: FeedRecipe; note: string | null; version: number | null }
type Feed = { scope: 'following' | 'everyone'; following: number; items: FeedItem[] }

const PAGE = 20

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'S'
}

function when(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min ago`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`
  if (seconds < 86400 * 7) return `${Math.round(seconds / 86400)} d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Avatar({ cook }: { cook: Cook }) {
  const inner = cook.avatarUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={cook.avatarUrl} alt="" width={40} height={40} />
    : <span aria-hidden="true">{initials(cook.displayName)}</span>
  return cook.username ? <Link href={`/cooks/${cook.username}`} className="feed-avatar">{inner}</Link> : <span className="feed-avatar">{inner}</span>
}

function CookName({ cook }: { cook: Cook }) {
  return cook.username ? <Link href={`/cooks/${cook.username}`} className="feed-cook">{cook.displayName}</Link> : <span className="feed-cook">{cook.displayName}</span>
}

/** The home feed: what the cooks you follow are doing, or everyone when you are new. */
export default function HomeFeed() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [scope, setScope] = useState<'following' | 'everyone'>('following')
  const [feed, setFeed] = useState<Feed | null>(null)
  const [suggested, setSuggested] = useState<Cook[]>([])
  const [needsSetup, setNeedsSetup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [exhausted, setExhausted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (which: 'following' | 'everyone', offset: number) => {
    const supabase = getSupabaseBrowserClient()
    const { data, error: rpcError } = await supabase.rpc('home_feed', { scope: which, result_limit: PAGE, result_offset: offset })
    if (rpcError) throw rpcError
    return data as Feed
  }, [])

  useEffect(() => {
    let active = true
    async function start() {
      const supabase = getSupabaseBrowserClient()
      const { data: auth } = await supabase.auth.getUser()
      if (!active) return
      const isSignedIn = Boolean(auth.user)
      setSignedIn(isSignedIn)
      setViewerId(auth.user?.id ?? null)
      const first = await load(isSignedIn ? 'following' : 'everyone', 0)
      if (!active) return
      // A cook who follows nobody yet sees everyone, plus who to follow.
      if (isSignedIn && first.following === 0) {
        const everyone = await load('everyone', 0)
        if (!active) return
        setScope('everyone')
        setFeed({ ...everyone, following: 0 })
      } else {
        setScope(first.scope)
        setFeed(first)
      }
      setExhausted(false)
      const { data: cooks } = await supabase.rpc('suggested_cooks', { result_limit: 6 })
      if (active) setSuggested(((cooks as { cooks?: Cook[] } | null)?.cooks ?? []).filter((c) => c.username))
      if (isSignedIn) {
        const { data: profile } = await supabase.rpc('my_profile')
        if (active) setNeedsSetup(Boolean(profile) && !profile.onboardedAt)
      }
    }
    start().catch((e) => active && setError(e?.message || 'Could not load the table.')).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [load])

  async function switchScope(which: 'following' | 'everyone') {
    if (which === scope) return
    setLoading(true)
    setError(null)
    try {
      const next = await load(which, 0)
      setScope(which)
      setFeed(next)
      setExhausted(next.items.length < PAGE)
    } catch (e: any) {
      setError(e?.message || 'Could not load the table.')
    } finally {
      setLoading(false)
    }
  }

  async function reload() {
    try {
      const next = await load(scope, 0)
      setFeed(next)
      setExhausted(next.items.length < PAGE)
    } catch {
      // The post went through; the feed catches up on the next load.
    }
  }

  async function more() {
    if (!feed) return
    setLoading(true)
    try {
      const next = await load(scope, feed.items.length)
      setFeed({ ...feed, items: [...feed.items, ...next.items] })
      if (next.items.length < PAGE) setExhausted(true)
    } catch (e: any) {
      setError(e?.message || 'Could not load more.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="feed site-shell">
      <header className="feed__header">
        <div>
          <span className="eyebrow">Your table</span>
          <h1>{signedIn ? 'What your cooks are making.' : 'What the Savry community is making.'}</h1>
        </div>
        {signedIn && (
          <div className="feed__scope" role="tablist" aria-label="Whose cooking to show">
            <button type="button" role="tab" aria-selected={scope === 'following'} className={scope === 'following' ? 'is-active' : ''} onClick={() => switchScope('following')}>Following{feed ? ` · ${feed.following}` : ''}</button>
            <button type="button" role="tab" aria-selected={scope === 'everyone'} className={scope === 'everyone' ? 'is-active' : ''} onClick={() => switchScope('everyone')}>Everyone</button>
          </div>
        )}
      </header>

      <div className="feed__layout">
        <section className="feed__stream" aria-live="polite">
          {viewerId && <MadeItComposer viewerId={viewerId} onPosted={reload} />}
          {error && <p className="settings-note" role="alert">{error}</p>}
          {signedIn && feed && feed.following === 0 && (
            <div className="feed__empty">
              <ChefHat size={22} />
              <p><strong>Follow a few cooks and this becomes your table.</strong> Until then, here is everyone.</p>
            </div>
          )}
          {feed && feed.items.length === 0 && !loading && (
            <div className="feed__empty">
              <Utensils size={22} />
              <p>{scope === 'following' ? 'Quiet so far. The cooks you follow have not posted yet.' : 'Nothing on the table yet.'}</p>
            </div>
          )}
          <ol className="feed__list">
            {feed?.items.map((item, index) => (
              <li key={`${item.kind}-${item.at}-${index}`} className={`feed-item feed-item--${item.kind}`}>
                <div className="feed-item__head">
                  <Avatar cook={item.cook} />
                  <p>
                    <CookName cook={item.cook} />{' '}
                    {item.kind === 'recipe' && <>put <Link href={`/recipes/${item.recipe.slug}`}>{item.recipe.title}</Link> on the table</>}
                    {item.kind === 'made' && <>made <Link href={`/recipes/${item.recipe.slug}`}>{item.recipe.title}</Link>{item.recipe.authorUsername && item.recipe.authorUsername !== item.cook.username ? <> by <Link href={`/cooks/${item.recipe.authorUsername}`}>{item.recipe.authorName}</Link></> : null}</>}
                    {item.kind === 'tweak' && <>improved <Link href={`/recipes/${item.recipe.slug}`}>{item.recipe.title}</Link>{item.version ? ` (now version ${item.version})` : ''}</>}
                    <time dateTime={item.at}>{when(item.at)}</time>
                  </p>
                </div>
                {item.kind === 'recipe' && (
                  <Link href={`/recipes/${item.recipe.slug}`} className="feed-recipe">
                    {item.recipe.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.recipe.imageUrl} alt="" loading="lazy" />
                    ) : (
                      <span className="feed-recipe__placeholder">{item.recipe.title.charAt(0)}</span>
                    )}
                    <span className="feed-recipe__body">
                      <strong>{item.recipe.title}</strong>
                      {item.recipe.description && <span>{item.recipe.description}</span>}
                      <small>{[item.recipe.category, item.recipe.totalTime ? `${item.recipe.totalTime} min` : null, item.recipe.madeCount ? `${item.recipe.madeCount} made it` : null].filter(Boolean).join(' · ')}</small>
                    </span>
                  </Link>
                )}
                {item.kind === 'made' && (
                  <div className="feed-made">
                    {item.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.photoUrl} alt={`${item.cook.displayName} made ${item.recipe.title}`} loading="lazy" />
                    )}
                    {item.note && <blockquote>{item.note}</blockquote>}
                  </div>
                )}
                {item.kind === 'tweak' && item.note && <blockquote className="feed-tweak"><Sparkles size={14} /> {item.note}</blockquote>}
              </li>
            ))}
          </ol>
          {feed && feed.items.length > 0 && !exhausted && (
            <button type="button" className="button button--light feed__more" onClick={more} disabled={loading}>{loading ? 'Loading…' : 'More'}</button>
          )}
          {loading && !feed && <p className="feed__loading">Setting the table…</p>}
        </section>

        <aside className="feed__side">
          {needsSetup && (
            <div className="feed-card feed-card--setup">
              <h2>Set your table.</h2>
              <p>Three quick steps: what you like to cook, a few cooks to follow, a few recipes to save.</p>
              <Link href="/welcome" className="button button--coral">Start</Link>
            </div>
          )}
          {!signedIn && signedIn !== null && (
            <div className="feed-card">
              <h2>Pull up a chair.</h2>
              <p>Follow cooks, save recipes, and post what you made. Free, no ads.</p>
              <Link href="/app-login?returnTo=/feed" className="button button--coral">Join the community</Link>
            </div>
          )}
          {suggested.length > 0 && (
            <div className="feed-card">
              <h2>Cooks to follow</h2>
              <ul className="feed-cooks">
                {suggested.map((cook) => (
                  <li key={cook.id}>
                    <Avatar cook={cook} />
                    <div>
                      <CookName cook={cook} />
                      <small>{cook.chefTitle || `${cook.recipeCount} recipe${cook.recipeCount === 1 ? '' : 's'}`}</small>
                    </div>
                    {cook.username && <FollowButton username={cook.username} compact onChange={(state) => { if (state.following) setFeed((f) => (f ? { ...f, following: f.following + 1 } : f)) }} />}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="feed-card feed-card--quiet">
            <h2>Add to the table</h2>
            <p>Share a recipe, or post a photo of something you cooked from one.</p>
            <Link href="/recipes/new" className="text-link">Share a recipe →</Link>
          </div>
        </aside>
      </div>
    </main>
  )
}
