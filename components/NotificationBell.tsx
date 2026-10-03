'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

/** Unread count in the nav. Refreshes on focus and every minute; no sockets. */
export default function NotificationBell({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let active = true
    async function refresh() {
      try {
        const { data } = await getSupabaseBrowserClient().rpc('unread_notification_count')
        if (active) setUnread(Number(data ?? 0))
      } catch {
        // Signed out or offline: the bell just shows nothing.
      }
    }
    refresh()
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [pathname])

  return (
    <Link href="/notifications" onClick={onNavigate} className={`savry-nav__bell ${pathname === '/notifications' ? 'is-active' : ''}`} aria-label={unread ? `${unread} new notification${unread === 1 ? '' : 's'}` : 'Notifications'}>
      <Bell size={20} />
      {unread > 0 && <span className="savry-nav__badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
    </Link>
  )
}
