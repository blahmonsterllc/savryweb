import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import SiteFooter from '@/components/SiteFooter'
import { Providers } from './providers'
import { SITE_URL } from '@/lib/site-url'

const inter = Inter({ subsets: ['latin'] })

const description = 'Discover recipes, join the Savry cooking community, and share recipes from your own kitchen.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Savry — recipes worth sharing',
    template: '%s | Savry',
  },
  description,
  icons: { icon: '/savry-logo.svg' },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  // No site-wide canonical or og:url: each page declares its own so search
  // engines never treat every page as a duplicate of the home page.
  openGraph: {
    type: 'website',
    siteName: 'Savry',
    title: 'Savry — recipes worth sharing',
    description: 'A recipe workshop for home cooks and bakers to create, share, discuss, and improve recipes together.',
    images: [{ url: '/images/savry-editorial-hero.webp', width: 1600, height: 1000, alt: 'A shared table of Savry recipes' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Savry — recipes worth sharing',
    description,
    images: ['/images/savry-editorial-hero.webp'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <Navbar />
          <main className="relative">
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  )
}
