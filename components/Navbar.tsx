'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import NotificationBell from '@/components/NotificationBell'

type Viewer = { name: string; avatarUrl: string | null }

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'S'
}

export default function Navbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [viewer, setViewer] = useState<Viewer | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    let supabase: ReturnType<typeof getSupabaseBrowserClient>
    try {
      supabase = getSupabaseBrowserClient()
    } catch {
      setViewer(null)
      return
    }
    async function load() {
      const { data } = await supabase.auth.getUser()
      if (!active) return
      if (!data.user) {
        setViewer(null)
        return
      }
      const fallback = String(data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Savry cook')
      const { data: profile } = await supabase.rpc('my_profile')
      if (!active) return
      setViewer({ name: profile?.displayName || fallback, avatarUrl: profile?.avatarUrl ?? null })
    }
    load().catch(() => active && setViewer(null))
    const { data: subscription } = supabase.auth.onAuthStateChange(() => { load().catch(() => undefined) })
    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const close = () => setOpen(false)
  const returnTo = pathname && pathname !== '/app-login' ? pathname : '/account'

  return (
    <nav className="savry-nav">
      <div className="site-shell savry-nav__inner">
        <Link href="/" className="savry-nav__brand" onClick={close}>
          <Image src="/savry-logo.svg" alt="Savry" width={42} height={40} priority />
          <span>Savry</span>
        </Link>

        <button className="savry-nav__toggle" type="button" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? <X size={23} /> : <Menu size={23} />}
        </button>

        <div className={`savry-nav__links ${open ? 'savry-nav__links--open' : ''}`}>
          {viewer && <Link href="/feed" onClick={close} className={pathname === '/feed' ? 'is-active' : ''}>Your table</Link>}
          <Link href="/recipes" onClick={close} className={pathname === '/recipes' || (pathname?.startsWith('/recipes/') && pathname !== '/recipes/new') ? 'is-active' : ''}>Community recipes</Link>
          <Link href="/cooks" onClick={close} className={pathname?.startsWith('/cooks') ? 'is-active' : ''}>Cooks</Link>
          <Link href="/recipes/new" onClick={close} className={pathname === '/recipes/new' ? 'is-active' : ''}>Add a recipe</Link>
          <Link href="/savry-plus" onClick={close} className={pathname === '/savry-plus' ? 'is-active' : ''}>Savry+</Link>
          <a href="/#app-coming-soon" onClick={close}>The app</a>

          {viewer && <NotificationBell onNavigate={close} />}
          {viewer ? (
            <Link href="/account" className="savry-nav__me" onClick={close} aria-label="Your account">
              {viewer.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={viewer.avatarUrl} alt="" width={34} height={34} />
              ) : (
                <span aria-hidden="true">{initials(viewer.name)}</span>
              )}
              <strong>{viewer.name}</strong>
            </Link>
          ) : (
            <>
              <Link href={`/app-login?returnTo=${encodeURIComponent(returnTo)}`} className="savry-nav__login" onClick={close}>Log in</Link>
              <Link href="/app-login?returnTo=/account" className="savry-nav__download" onClick={close}>Join the community <span aria-hidden="true">→</span></Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
