'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { useState, useEffect } from 'react'

export default function Navbar() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav className="sticky top-0 z-50 bg-gradient-to-r from-primary-600 to-secondary-600 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative w-10 h-10 transform transition-transform group-hover:scale-110">
              <Image 
                src="/savry-logo.svg" 
                alt="Savry Logo" 
                width={40} 
                height={40}
                className="object-contain brightness-0 invert"
              />
            </div>
            <h1 className="text-2xl font-bold text-white">
              Savry
            </h1>
          </Link>
          
          <div className="hidden md:flex space-x-6">
            <Link 
              href="/"
              className={`transition-colors font-medium text-sm ${
                pathname === '/' 
                  ? 'text-white font-semibold' 
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Home
            </Link>
          </div>
          
          <div className="flex space-x-3 items-center">
            {/* No public auth/admin links for now (admin is available at /admin) */}
          </div>
        </div>
      </div>
    </nav>
  )
}


