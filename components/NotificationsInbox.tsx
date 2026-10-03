'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

type Cook = { username: string | null; displayName: string; avatarUrl: string | null }
type Item = {
  id: string
  kind: 'made' | 'note' | 'reply' | 'tweak' | 'tweak_accepted' | 'tweak_declined' | 'follow' | 'recipe_live'
  at: string
  read: boolean
  actor: Cook | null
  recipe: { slug: string; title: string; imageUrl: string | null } | null
  note: string | null
  photoUrl: string | null
}

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

function Who({ cook }: { cook: Cook | null }) {
  if (!cook) return <strong>Savry</strong>
  return cook.username ? <Link href={`/cooks/${cook.username}`}><strong>{cook.displayName}</strong></Link> : <strong>{cook.displayName}</strong>
}

function Sentence({ item }: { item: Item }) {
  const recipe = item.recipe ? <Link href={`/recipes/${item.recipe.slug}`}>{item.recipe.title}</Link> : <span>a recipe</span>
  switch (item.kind) {
    case 'made': return <><Who cook={item.actor} /> made {recipe}</>
    case 'note': return <><Who cook={item.actor} /> left a cook note on {recipe}</>
    case 'reply': return <><Who cook={item.actor} /> replied to your note on {recipe}</>
    case 'tweak': return <><Who cook={item.actor} /> suggested a tweak to {recipe}</>
    case 'tweak_accepted': return <><Who cook={item.actor} /> accepted your tweak to {recipe}</>
    case 'tweak_declined': return <><Who cook={item.actor} /> passed on your tweak to {recipe}</>
    case 'follow': return <><Who cook={item.actor} /> is now following you</>
    case 'recipe_live': return <>{recipe} is on the shared table. A Savry editor read it and published it.</>
  }
}

export default function NotificationsInbox() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      const supabase = getSupabaseBrowserClient()
      const { data: auth } = await supabase.auth.getUser()
      if (!active) return
      if (!auth.user) return setSignedIn(false)
      setSignedIn(true)
      const { data, error: rpcError } = await supabase.rpc('my_notifications', { result_limit: 60 })
      if (!active) return
      if (rpcError) return setError(rpcError.message)
      const list = ((data as { items?: Item[] } | null)?.items ?? [])
      setItems(list)
      // Opening the inbox is reading it.
      if (list.some((item) => !item.read)) await supabase.rpc('mark_notifications_read')
    }
    load().catch((e) => active && setError(e?.message || 'Could not load notifications.'))
    return () => { active = false }
  }, [])

  if (signedIn === false) {
    return (
      <main className="inbox site-shell">
        <div className="feed__empty"><Bell size={20} /><p><Link href="/app-login?returnTo=/notifications">Sign in</Link> to see what&rsquo;s happening with your recipes.</p></div>
      </main>
    )
  }

  return (
    <main className="inbox site-shell">
      <header className="inbox__header">
        <span className="eyebrow">Notifications</span>
        <h1>What&rsquo;s happening with your cooking.</h1>
      </header>
      {error && <p className="settings-note" role="alert">{error}</p>}
      {items && items.length === 0 && (
        <div className="feed__empty"><Bell size={20} /><p>Nothing yet. Share a recipe or follow some cooks and this fills up.</p></div>
      )}
      <ol className="inbox__list">
        {items?.map((item) => (
          <li key={item.id} className={`inbox-item ${item.read ? '' : 'is-unread'}`}>
            <span className="feed-avatar" aria-hidden="true">
              {item.actor?.avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={item.actor.avatarUrl} alt="" width={40} height={40} />
                : <span>{initials(item.actor?.displayName ?? 'Savry')}</span>}
            </span>
            <div className="inbox-item__body">
              <p><Sentence item={item} /></p>
              {item.note && <blockquote>{item.note}</blockquote>}
              <time dateTime={item.at}>{when(item.at)}</time>
            </div>
            {(item.photoUrl || item.recipe?.imageUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="inbox-item__thumb" src={item.photoUrl ?? item.recipe?.imageUrl ?? ''} alt="" loading="lazy" />
            )}
          </li>
        ))}
      </ol>
      {!items && !error && <p className="feed__loading">Checking the table…</p>}
    </main>
  )
}
