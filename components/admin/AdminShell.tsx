'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/moderation', label: 'Moderation' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/members', label: 'Members' },
  { href: '/admin/recipes', label: 'Recipes' },
  { href: '/admin/security', label: 'Health & security' },
]

/** Frame for every admin page. The login page renders without it. */
export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  if (pathname === '/admin/login') return <>{children}</>

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut()
    window.location.assign('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <Link href="/admin" className="text-sm font-bold uppercase tracking-wide text-gray-900">Savry admin</Link>
          <nav className="flex flex-wrap gap-1" aria-label="Admin">
            {NAV.map((item) => {
              const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
              return (
                <Link key={item.href} href={item.href} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <Link href="/" className="text-gray-600 hover:underline">View site</Link>
            <button type="button" onClick={signOut} className="text-gray-600 hover:underline">Sign out</button>
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
