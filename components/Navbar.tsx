'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'

export default function Navbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <nav className="savry-nav">
      <div className="site-shell savry-nav__inner">
        <Link href="/" className="savry-nav__brand" onClick={() => setOpen(false)}>
          <Image src="/savry-logo.svg" alt="Savry" width={42} height={40} priority />
          <span>Savry</span>
        </Link>

        <button className="savry-nav__toggle" type="button" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? <X size={23} /> : <Menu size={23} />}
        </button>

        <div className={`savry-nav__links ${open ? 'savry-nav__links--open' : ''}`}>
          <Link href="/recipes" onClick={() => setOpen(false)} className={pathname === '/recipes' || pathname?.startsWith('/recipes/') && pathname !== '/recipes/new' ? 'is-active' : ''}>Community recipes</Link>
          <Link href="/recipes/new" onClick={() => setOpen(false)} className={pathname === '/recipes/new' ? 'is-active' : ''}>Add a recipe</Link>
          <Link href="/account" onClick={() => setOpen(false)} className={pathname === '/account' ? 'is-active' : ''}>My Savry</Link>
          <a href="/#app-coming-soon" onClick={() => setOpen(false)}>App coming soon</a>
          <Link href="/app-login?returnTo=/account" className="savry-nav__download" onClick={() => setOpen(false)}>Join the community <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </nav>
  )
}
